const { query } = require('./config/db');

// 打卡状态: 0=正常, 1=迟到, 2=早退, 3=缺卡, 4=外勤
// 打卡类型: 1=签到, 2=签退
// 打卡来源: 1=后台录入, 2=移动端, 3=人脸设备, 4=外勤打卡
async function main() {
  try {
    await query('DELETE FROM attendance_record');

    // 获取所有未删除的排班（含规则信息）
    const schedules = await query(`
      SELECT s.id as schedule_id, s.employee_id, s.schedule_date, s.rule_id,
             r.rule_name, r.start_time, r.end_time
      FROM attendance_schedule s
      LEFT JOIN attendance_rule r ON s.rule_id = r.id
      WHERE s.is_deleted = 0
      ORDER BY s.schedule_date, s.employee_id
    `);

    const records = [];

    for (const s of schedules) {
      // 日期：schedule_date 是 UTC 16:00，本地是次日 00:00，取日期字符串
      const d = new Date(s.schedule_date);
      const local = new Date(d.getTime() + 8 * 3600 * 1000);
      const dateStr = local.toISOString().split('T')[0];

      const startTime = s.start_time || '09:00:00';
      const endTime = s.end_time || '18:00:00';

      // 为每个排班生成签到 + 签退 2 条记录
      // 根据员工 id 和日期制造不同状态分布
      const empId = s.employee_id;
      const dayOfMonth = local.getDate();

      // 决定当天状态：周期性分布让数据多样化
      let status;
      const seed = (empId + dayOfMonth) % 7;
      if (seed === 0) status = 0;        // 正常
      else if (seed === 1) status = 1;   // 迟到
      else if (seed === 2) status = 2;   // 早退
      else if (seed === 3) status = 4;   // 外勤
      else if (seed === 4) status = 0;   // 正常
      else if (seed === 5) status = 1;   // 迟到
      else status = 0;                   // 正常

      // 签到记录
      let signTimeStr;
      let signSource = 1;
      let address = '公司总部';
      let remark = '';

      if (status === 1) {
        // 迟到：比上班时间晚 20-40 分钟
        const [h, m] = startTime.split(':').map(Number);
        const lateMin = 20 + (empId % 3) * 10;
        const total = h * 60 + m + lateMin;
        const nh = Math.floor(total / 60).toString().padStart(2, '0');
        const nm = (total % 60).toString().padStart(2, '0');
        signTimeStr = `${dateStr} ${nh}:${nm}:00`;
        remark = '迟到';
        signSource = 2;
      } else if (status === 4) {
        // 外勤：正常时间但地址不同
        signTimeStr = `${dateStr} ${startTime}`;
        address = '客户现场-上海市浦东新区';
        signSource = 4;
        remark = '客户现场支持';
      } else {
        // 正常/早退：签到都正常
        signTimeStr = `${dateStr} ${startTime}`;
      }

      records.push([
        s.employee_id,
        s.schedule_id,
        s.rule_id,
        1, // 签到
        signTimeStr,
        address,
        '121.4737',
        '31.2304',
        signSource === 1 ? '后台录入' : signSource === 2 ? '手机APP' : '外勤设备',
        signSource,
        status,
        remark,
      ]);

      // 签退记录
      let signOutTimeStr;
      let outStatus = status; // 默认与签到同状态
      let outAddress = '公司总部';
      let outRemark = '';
      let outSource = 1;

      if (status === 2) {
        // 早退：比下班时间早 30-60 分钟
        const [h, m] = endTime.split(':').map(Number);
        const earlyMin = 30 + (empId % 3) * 15;
        const total = h * 60 + m - earlyMin;
        const nh = Math.floor(total / 60).toString().padStart(2, '0');
        const nm = (total % 60).toString().padStart(2, '0');
        signOutTimeStr = `${dateStr} ${nh}:${nm}:00`;
        outRemark = '早退';
        outSource = 2;
      } else if (status === 4) {
        // 外勤签退
        signOutTimeStr = `${dateStr} ${endTime}`;
        outAddress = '客户现场-上海市浦东新区';
        outSource = 4;
        outRemark = '客户现场支持';
      } else {
        // 正常签退
        signOutTimeStr = `${dateStr} ${endTime}`;
      }

      // 缺卡：跳过签退记录
      if (status !== 3) {
        records.push([
          s.employee_id,
          s.schedule_id,
          s.rule_id,
          2, // 签退
          signOutTimeStr,
          outAddress,
          '121.4737',
          '31.2304',
          outSource === 1 ? '后台录入' : outSource === 2 ? '手机APP' : '外勤设备',
          outSource,
          outStatus,
          outRemark,
        ]);
      }
    }

    // 批量插入
    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    const values = records.flat();
    const result = await query(
      `INSERT INTO attendance_record (employee_id, schedule_id, rule_id, sign_type, sign_time, address, longitude, latitude, device, sign_source, status, remark) VALUES ${placeholders}`,
      values
    );

    console.log(`成功插入 ${result.affectedRows} 条打卡记录`);

    // 统计预览
    const stats = await query(`
      SELECT
        e.real_name,
        COUNT(*) as total,
        SUM(CASE WHEN ar.status = 0 THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN ar.status = 1 THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 2 THEN 1 ELSE 0 END) as early,
        SUM(CASE WHEN ar.status = 4 THEN 1 ELSE 0 END) as field_work
      FROM attendance_record ar
      LEFT JOIN sys_employee e ON ar.employee_id = e.id
      WHERE ar.is_deleted = 0
      GROUP BY e.id
      ORDER BY e.id
    `);
    console.log('\n按员工统计:');
    console.log(JSON.stringify(stats, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
}

main();
