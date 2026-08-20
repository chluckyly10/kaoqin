const { query } = require('../config/db');

const getList = async (req, res) => {
  const { page = 1, size = 10, employee_id, schedule_date, rule_id } = req.query;
  const offset = (page - 1) * size;
  
  let sql = `
    SELECT asch.*, e.real_name, e.username, r.rule_name, r.start_time, r.end_time
    FROM attendance_schedule asch
    LEFT JOIN sys_employee e ON asch.employee_id = e.id
    LEFT JOIN attendance_rule r ON asch.rule_id = r.id
    WHERE asch.is_deleted = 0
  `;
  const params = [];
  
  if (employee_id) {
    sql += ' AND asch.employee_id = ?';
    params.push(employee_id);
  }
  
  if (schedule_date) {
    sql += ' AND asch.schedule_date = ?';
    params.push(schedule_date);
  }
  
  if (rule_id) {
    sql += ' AND asch.rule_id = ?';
    params.push(rule_id);
  }
  
  sql += ' ORDER BY asch.schedule_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(size), parseInt(offset));
  
  const rows = await query(sql, params);
  
  const countSql = sql.replace('SELECT asch.*, e.real_name, e.username, r.rule_name, r.start_time, r.end_time', 'SELECT COUNT(*) as total').replace('ORDER BY asch.schedule_date DESC LIMIT ? OFFSET ?', '');
  const countParams = params.slice(0, -2);
  const countResult = await query(countSql, countParams);
  
  res.json({ code: 200, data: { list: rows, total: countResult[0].total } });
};

const getById = async (req, res) => {
  const { id } = req.params;
  
  const schedules = await query(`
    SELECT asch.*, e.real_name, e.username, r.rule_name, r.start_time, r.end_time
    FROM attendance_schedule asch
    LEFT JOIN sys_employee e ON asch.employee_id = e.id
    LEFT JOIN attendance_rule r ON asch.rule_id = r.id
    WHERE asch.id = ? AND asch.is_deleted = 0
  `, [id]);
  
  if (schedules.length === 0) {
    return res.json({ code: 400, message: '排班不存在' });
  }
  
  res.json({ code: 200, data: schedules[0] });
};

const create = async (req, res) => {
  const { employee_id, rule_id, schedule_date, remark } = req.body;
  
  const existing = await query(
    'SELECT * FROM attendance_schedule WHERE employee_id = ? AND schedule_date = ? AND is_deleted = 0',
    [employee_id, schedule_date]
  );
  
  if (existing.length > 0) {
    return res.json({ code: 400, message: '该员工当天已有排班' });
  }
  
  const result = await query(
    'INSERT INTO attendance_schedule (employee_id, rule_id, schedule_date, remark) VALUES (?, ?, ?, ?)',
    [employee_id, rule_id, schedule_date, remark]
  );
  
  res.json({ code: 200, message: '创建成功', data: { id: result.insertId } });
};

const batchCreate = async (req, res) => {
  const { schedules: inputSchedules } = req.body;

  if (!Array.isArray(inputSchedules) || inputSchedules.length === 0) {
    return res.json({ code: 400, message: '没有需要创建的排班' });
  }

  // 一次性查出已存在的排班（软删除的允许重新创建）
  const placeholders = inputSchedules.map(() => '(employee_id = ? AND schedule_date = ?)').join(' OR ');
  const existParams = inputSchedules.flatMap(s => [s.employee_id, s.schedule_date]);

  const existingRows = await query(
    `SELECT employee_id, schedule_date FROM attendance_schedule WHERE is_deleted = 0 AND (${placeholders})`,
    existParams
  );
  const existingKeys = new Set(existingRows.map(r => `${r.employee_id}_${r.schedule_date}`));

  const toCreate = inputSchedules.filter(s => !existingKeys.has(`${s.employee_id}_${s.schedule_date}`));

  if (toCreate.length === 0) {
    return res.json({ code: 400, message: '所选员工在所选日期均已存在排班' });
  }

  const insertPlaceholders = toCreate.map(() => '(?, ?, ?, ?)').join(',');
  const values = toCreate.flatMap(s => [s.employee_id, s.rule_id, s.schedule_date, s.remark || null]);

  // 使用 ON DUPLICATE KEY UPDATE 兜底：软删除的旧记录会被恢复，避免唯一索引冲突
  await query(
    `INSERT INTO attendance_schedule (employee_id, rule_id, schedule_date, remark) VALUES ${insertPlaceholders} ON DUPLICATE KEY UPDATE rule_id = VALUES(rule_id), remark = VALUES(remark), is_deleted = 0`,
    values
  );

  res.json({ code: 200, message: `成功生成 ${toCreate.length} 条排班` });
};

const update = async (req, res) => {
  const { id } = req.params;
  const { rule_id, remark } = req.body;
  
  const result = await query(
    'UPDATE attendance_schedule SET rule_id = ?, remark = ? WHERE id = ?',
    [rule_id, remark, id]
  );
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '更新失败' });
  }
  
  res.json({ code: 200, message: '更新成功' });
};

const remove = async (req, res) => {
  const { id } = req.params;
  
  const result = await query('UPDATE attendance_schedule SET is_deleted = 1 WHERE id = ?', [id]);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '删除失败' });
  }
  
  res.json({ code: 200, message: '删除成功' });
};

module.exports = { getList, getById, create, batchCreate, update, remove };