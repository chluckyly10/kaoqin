const { query } = require('../config/db');

const getList = async (req, res) => {
  const { page = 1, size = 10, keyword = '' } = req.query;
  const offset = (page - 1) * size;
  
  let sql = 'SELECT * FROM attendance_rule WHERE is_deleted = 0';
  const params = [];
  
  if (keyword) {
    sql += ' AND rule_name LIKE ?';
    params.push(`%${keyword}%`);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(size), parseInt(offset));
  
  const rows = await query(sql, params);
  
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total').replace('ORDER BY created_at DESC LIMIT ? OFFSET ?', '');
  const countParams = params.slice(0, -2);
  const countResult = await query(countSql, countParams);
  
  res.json({ code: 200, data: { list: rows, total: countResult[0].total } });
};

const getAll = async (req, res) => {
  const rows = await query('SELECT * FROM attendance_rule WHERE is_deleted = 0 AND status = 1 ORDER BY id ASC');
  res.json({ code: 200, data: rows });
};

const getById = async (req, res) => {
  const { id } = req.params;
  const rules = await query('SELECT * FROM attendance_rule WHERE id = ? AND is_deleted = 0', [id]);
  
  if (rules.length === 0) {
    return res.json({ code: 400, message: '规则不存在' });
  }
  
  res.json({ code: 200, data: rules[0] });
};

const create = async (req, res) => {
  const { rule_name, start_time, end_time, late_minute, early_minute, allow_outside_sign, status } = req.body;
  
  const result = await query(
    'INSERT INTO attendance_rule (rule_name, start_time, end_time, late_minute, early_minute, allow_outside_sign, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [rule_name, start_time, end_time, late_minute || 15, early_minute || 15, allow_outside_sign || 0, status || 1]
  );
  
  res.json({ code: 200, message: '创建成功', data: { id: result.insertId } });
};

const update = async (req, res) => {
  const { id } = req.params;
  const { rule_name, start_time, end_time, late_minute, early_minute, allow_outside_sign, status } = req.body;
  
  const result = await query(
    'UPDATE attendance_rule SET rule_name = ?, start_time = ?, end_time = ?, late_minute = ?, early_minute = ?, allow_outside_sign = ?, status = ? WHERE id = ?',
    [rule_name ?? null, start_time ?? null, end_time ?? null, late_minute ?? null, early_minute ?? null, allow_outside_sign ?? 0, status ?? 1, id]
  );
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '更新失败' });
  }
  
  res.json({ code: 200, message: '更新成功' });
};

const remove = async (req, res) => {
  const { id } = req.params;
  
  const schedules = await query('SELECT * FROM attendance_schedule WHERE rule_id = ? AND is_deleted = 0', [id]);
  if (schedules.length > 0) {
    return res.json({ code: 400, message: '该规则下仍有排班' });
  }
  
  const result = await query('UPDATE attendance_rule SET is_deleted = 1 WHERE id = ?', [id]);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '删除失败' });
  }
  
  res.json({ code: 200, message: '删除成功' });
};

const getRuleEmployees = async (req, res) => {
  const { ruleId } = req.params;
  
  try {
    const rows = await query(
      `SELECT e.id, e.real_name, e.username, d.dept_name 
       FROM sys_employee e 
       LEFT JOIN sys_department d ON e.dept_id = d.id 
       WHERE e.is_deleted = 0 
       AND e.id IN (SELECT employee_id FROM attendance_schedule WHERE rule_id = ? AND is_deleted = 0)`,
      [ruleId]
    );
    
    res.json({ code: 200, data: rows });
  } catch (error) {
    console.error('Get rule employees error:', error);
    res.json({ code: 500, message: '获取规则员工失败' });
  }
};

module.exports = { getList, getAll, getById, create, update, remove, getRuleEmployees };