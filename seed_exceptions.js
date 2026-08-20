const { query } = require('./config/db');

async function main() {
  try {
    await query('DELETE FROM attendance_exception');

    const records = [
      [2, 1, 1, '2026-08-15', '迟到原因：地铁故障导致延误，望领导批准', null, 0, null, null, null],
      [3, 2, 2, '2026-08-16', '早退原因：家中有急事需要提前离开', null, 1, 1, '2026-08-17 10:00:00', '情况属实，同意'],
      [4, 3, 3, '2026-08-17', '缺卡原因：外出办公忘记打卡，附上客户拜访记录', null, 2, 1, '2026-08-18 09:30:00', '需提供客户确认函，暂拒绝'],
      [2, 4, 4, '2026-08-18', '外勤原因：远程到客户现场支持，未回公司打卡', '/uploads/exception/20260818.jpg', 0, null, null, null],
      [3, 1, 1, '2026-08-19', '迟到原因：送孩子上学途中堵车', null, 0, null, null, null],
    ];

    for (const r of records) {
      await query(
        'INSERT INTO attendance_exception (employee_id, record_id, exception_type, apply_date, reason, attach, audit_status, audit_user_id, audit_time, audit_comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        r
      );
    }

    const rows = await query('SELECT id, employee_id, exception_type, apply_date, reason, audit_status FROM attendance_exception ORDER BY id ASC');
    console.log('插入完成，共', rows.length, '条');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
}

main();
