const { query } = require('../config/db');
const fs = require('fs');
const path = require('path');

const getList = async (req, res) => {
  const { page = 1, size = 10, task_type, status, employee_id } = req.query;
  const offset = (page - 1) * size;
  
  let sql = `
    SELECT t.*, e.real_name as employee_name
    FROM sys_task t
    LEFT JOIN sys_employee e ON t.employee_id = e.id
    WHERE t.is_deleted = 0
  `;
  const params = [];
  
  if (task_type) {
    sql += ' AND t.task_type = ?';
    params.push(task_type);
  }
  
  if (status !== undefined && status !== '') {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  
  if (employee_id) {
    sql += ' AND t.employee_id = ?';
    params.push(employee_id);
  }
  
  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(size), parseInt(offset));
  
  const rows = await query(sql, params);
  
  const countSql = sql.replace('SELECT t.*, e.real_name as employee_name', 'SELECT COUNT(*) as total').replace('ORDER BY t.created_at DESC LIMIT ? OFFSET ?', '');
  const countParams = params.slice(0, -2);
  const countResult = await query(countSql, countParams);
  
  res.json({ code: 200, data: { list: rows, total: countResult[0].total } });
};

const getById = async (req, res) => {
  const { id } = req.params;
  
  const tasks = await query(`
    SELECT t.*, e.real_name as employee_name
    FROM sys_task t
    LEFT JOIN sys_employee e ON t.employee_id = e.id
    WHERE t.id = ? AND t.is_deleted = 0
  `, [id]);
  
  if (tasks.length === 0) {
    return res.json({ code: 400, message: '任务不存在' });
  }
  
  res.json({ code: 200, data: tasks[0] });
};

const create = async (req, res) => {
  const { task_type, employee_id, params } = req.body;
  
  const result = await query(
    'INSERT INTO sys_task (task_type, employee_id, params, status, progress) VALUES (?, ?, ?, ?, ?)',
    [task_type, employee_id, JSON.stringify(params), 0, 0]
  );
  
  res.json({ code: 200, message: '任务已创建', data: { id: result.insertId } });
};

const updateProgress = async (req, res) => {
  const { id } = req.params;
  const { progress, status, msg, file_url } = req.body;
  
  const updates = [];
  const params = [];
  
  if (progress !== undefined) {
    updates.push('progress = ?');
    params.push(progress);
  }
  
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }
  
  if (msg) {
    updates.push('msg = ?');
    params.push(msg);
  }
  
  if (file_url) {
    updates.push('file_url = ?');
    params.push(file_url);
  }
  
  params.push(id);
  
  const result = await query(`UPDATE sys_task SET ${updates.join(', ')} WHERE id = ?`, params);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '更新失败' });
  }
  
  res.json({ code: 200, message: '更新成功' });
};

const remove = async (req, res) => {
  const { id } = req.params;
  
  const result = await query('UPDATE sys_task SET is_deleted = 1 WHERE id = ?', [id]);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '删除失败' });
  }
  
  res.json({ code: 200, message: '删除成功' });
};

const generateReport = async (req, res) => {
  const { month, department_id, view_mode } = req.body;
  const employee_id = req.user?.id || 0;

  if (!month) {
    return res.json({ code: 400, message: '请选择月份' });
  }

  // 1. 创建任务
  const result = await query(
    'INSERT INTO sys_task (task_type, employee_id, params, status, progress) VALUES (?, ?, ?, ?, ?)',
    ['report', employee_id, JSON.stringify({ month, department_id, view_mode }), 0, 0]
  );

  const taskId = result.insertId;

  // 2. 异步模拟报表生成（更新进度 + 生成 CSV 文件）
  (async () => {
    try {
      const steps = [10, 30, 50, 70, 90, 100];
      for (const progress of steps) {
        await new Promise((r) => setTimeout(r, 500));
        const status = progress >= 100 ? 1 : 0;
        await query('UPDATE sys_task SET progress = ?, status = ? WHERE id = ?', [
          progress,
          status,
          taskId,
        ]);
      }

      // 3. 生成 CSV 报表文件
      const statsSql =
        view_mode === 'department'
          ? `
        SELECT d.dept_name as name,
          COUNT(DISTINCT e.id) as employee_count,
          COUNT(DISTINCT DATE(ar.sign_time)) as attendance_days,
          SUM(CASE WHEN ar.status = 0 THEN 1 ELSE 0 END) as normal_count,
          SUM(CASE WHEN ar.status = 1 THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN ar.status = 2 THEN 1 ELSE 0 END) as early_count
        FROM sys_department d
        LEFT JOIN sys_employee e ON e.dept_id = d.id AND e.is_deleted = 0
        LEFT JOIN attendance_record ar ON e.id = ar.employee_id AND ar.is_deleted = 0
          AND DATE_FORMAT(ar.sign_time, '%Y-%m') = ?
        WHERE d.is_deleted = 0
        GROUP BY d.id, d.dept_name
        ORDER BY d.dept_name
      `
          : `
        SELECT e.real_name as name, d.dept_name,
          COUNT(DISTINCT DATE(ar.sign_time)) as attendance_days,
          SUM(CASE WHEN ar.status = 0 THEN 1 ELSE 0 END) as normal_count,
          SUM(CASE WHEN ar.status = 1 THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN ar.status = 2 THEN 1 ELSE 0 END) as early_count,
          SUM(CASE WHEN ar.status = 4 THEN 1 ELSE 0 END) as field_work_count
        FROM sys_employee e
        LEFT JOIN sys_department d ON e.dept_id = d.id
        LEFT JOIN attendance_record ar ON e.id = ar.employee_id AND ar.is_deleted = 0
          AND DATE_FORMAT(ar.sign_time, '%Y-%m') = ?
        WHERE e.is_deleted = 0
        GROUP BY e.id, e.real_name, d.dept_name
        ORDER BY e.id
      `;

      const statsParams = [month];
      if (department_id) {
        const whereClause = view_mode === 'department' ? ' AND d.id = ?' : ' AND e.dept_id = ?';
        const finalSql = statsSql.replace('WHERE d.is_deleted = 0', 'WHERE d.is_deleted = 0' + whereClause).replace('WHERE e.is_deleted = 0', 'WHERE e.is_deleted = 0' + whereClause);
        const rows = await query(finalSql, [month, department_id]);
        await writeReportFile(taskId, month, view_mode, rows);
      } else {
        const rows = await query(statsSql, statsParams);
        await writeReportFile(taskId, month, view_mode, rows);
      }

      // 4. 更新任务为完成
      const fileName = `report_${taskId}_${month.replace('-', '')}.csv`;
      const fileUrl = `/exports/${fileName}`;
      await query('UPDATE sys_task SET progress = 100, status = 1, file_url = ?, msg = ? WHERE id = ?', [
        fileUrl,
        '报表生成完成',
        taskId,
      ]);
    } catch (e) {
      await query('UPDATE sys_task SET status = 2, msg = ? WHERE id = ?', [
        '生成失败: ' + e.message,
        taskId,
      ]);
    }
  })();

  res.json({ code: 200, message: '任务已创建', data: { task_id: taskId, id: taskId } });
};

// 写 CSV 文件到 exports 目录
async function writeReportFile(taskId, month, viewMode, rows) {
  const exportsDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const fileName = `report_${taskId}_${month.replace('-', '')}.csv`;
  const filePath = path.join(exportsDir, fileName);

  // 添加 BOM 让 Excel 正确识别 UTF-8 中文
  const headers =
    viewMode === 'department'
      ? ['部门名称', '员工数', '出勤天数', '正常打卡', '迟到次数', '早退次数']
      : ['姓名', '部门', '出勤天数', '正常打卡', '迟到次数', '早退次数', '外勤次数'];

  const keys =
    viewMode === 'department'
      ? ['name', 'employee_count', 'attendance_days', 'normal_count', 'late_count', 'early_count']
      : ['name', 'dept_name', 'attendance_days', 'normal_count', 'late_count', 'early_count', 'field_work_count'];

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(keys.map((k) => row[k] ?? 0).join(','));
  }

  fs.writeFileSync(filePath, '\ufeff' + lines.join('\n'), 'utf8');
}

module.exports = { getList, getById, create, updateProgress, remove, generateReport };