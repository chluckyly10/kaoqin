const { query } = require('../config/db');

const getList = async (req, res) => {
  const { page = 1, size = 10, employee_id, exception_type, audit_status, apply_date, keyword = '' } = req.query;
  const offset = (page - 1) * size;
  
  let sql = `
    SELECT ae.*, e.real_name, e.username, d.dept_name, au.real_name as audit_user_name
    FROM attendance_exception ae
    LEFT JOIN sys_employee e ON ae.employee_id = e.id
    LEFT JOIN sys_department d ON e.dept_id = d.id
    LEFT JOIN sys_employee au ON ae.audit_user_id = au.id
    WHERE ae.is_deleted = 0
  `;
  const params = [];
  
  if (employee_id) {
    sql += ' AND ae.employee_id = ?';
    params.push(employee_id);
  }
  
  if (exception_type) {
    sql += ' AND ae.exception_type = ?';
    params.push(exception_type);
  }
  
  if (audit_status !== undefined && audit_status !== '') {
    sql += ' AND ae.audit_status = ?';
    params.push(audit_status);
  }
  
  if (apply_date) {
    sql += ' AND ae.apply_date = ?';
    params.push(apply_date);
  }
  
  if (keyword) {
    sql += ' AND (e.real_name LIKE ? OR e.username LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  sql += ' ORDER BY ae.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(size), parseInt(offset));
  
  const rows = await query(sql, params);
  
  const countSql = sql.replace('SELECT ae.*, e.real_name, e.username, d.dept_name, au.real_name as audit_user_name', 'SELECT COUNT(*) as total').replace('ORDER BY ae.created_at DESC LIMIT ? OFFSET ?', '');
  const countParams = params.slice(0, -2);
  const countResult = await query(countSql, countParams);
  
  res.json({ code: 200, data: { list: rows, total: countResult[0].total } });
};

const getById = async (req, res) => {
  const { id } = req.params;
  
  const exceptions = await query(`
    SELECT ae.*, e.real_name, e.username, d.dept_name, au.real_name as audit_user_name
    FROM attendance_exception ae
    LEFT JOIN sys_employee e ON ae.employee_id = e.id
    LEFT JOIN sys_department d ON e.dept_id = d.id
    LEFT JOIN sys_employee au ON ae.audit_user_id = au.id
    WHERE ae.id = ? AND ae.is_deleted = 0
  `, [id]);
  
  if (exceptions.length === 0) {
    return res.json({ code: 400, message: '申诉不存在' });
  }
  
  res.json({ code: 200, data: exceptions[0] });
};

const create = async (req, res) => {
  const { employee_id, record_id, exception_type, apply_date, reason, attach } = req.body;
  
  const result = await query(
    'INSERT INTO attendance_exception (employee_id, record_id, exception_type, apply_date, reason, attach) VALUES (?, ?, ?, ?, ?, ?)',
    [employee_id ?? null, record_id ?? null, exception_type ?? null, apply_date ?? null, reason ?? null, attach ?? null]
  );
  
  res.json({ code: 200, message: '提交成功', data: { id: result.insertId } });
};

const audit = async (req, res) => {
  const { id } = req.params;
  const { audit_status, audit_comment, audit_user_id } = req.body;
  
  const result = await query(
    'UPDATE attendance_exception SET audit_status = ?, audit_comment = ?, audit_user_id = ?, audit_time = NOW() WHERE id = ?',
    [audit_status ?? null, audit_comment ?? null, audit_user_id ?? null, id]
  );
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '审核失败' });
  }
  
  res.json({ code: 200, message: '审核成功' });
};

const remove = async (req, res) => {
  const { id } = req.params;
  
  const result = await query('UPDATE attendance_exception SET is_deleted = 1 WHERE id = ?', [id]);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '删除失败' });
  }
  
  res.json({ code: 200, message: '删除成功' });
};

module.exports = { getList, getById, create, audit, remove };