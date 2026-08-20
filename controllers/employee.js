  const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { decryptPassword } = require('../utils/rsa');

const login = async (req, res) => {
  const { username, password } = req.body;
  
  const employees = await query('SELECT * FROM sys_employee WHERE username = ? AND is_deleted = 0', [username]);
  if (employees.length === 0) {
    return res.json({ code: 401, message: '账号不存在' });
  }
  
  const employee = employees[0];
  
  let plainPassword;
  try {
    plainPassword = decryptPassword(password);
  } catch (error) {
    // RSA解密失败：可能是密钥对更换后缓存的旧公钥加密，或前端直接发送明文
    // 先尝试直接用接收到的密码做明文比较
    plainPassword = password;
  }
  
  const isPasswordValid = await bcrypt.compare(plainPassword, employee.password);
  
  if (!isPasswordValid) {
    return res.json({ code: 401, message: '密码错误' });
  }
  
  const token = jwt.sign(
    { id: employee.id, username: employee.username, is_admin: employee.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
  
  delete employee.password;
  res.json({ code: 200, message: '登录成功', data: { ...employee, token } });
};

const getList = async (req, res) => {
  const { page = 1, size = 10, keyword = '', dept_id } = req.query;
  const offset = (page - 1) * size;
  
  let sql = 'SELECT e.*, d.dept_name FROM sys_employee e LEFT JOIN sys_department d ON e.dept_id = d.id WHERE e.is_deleted = 0';
  const params = [];
  
  if (keyword) {
    sql += ' AND (e.username LIKE ? OR e.real_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (dept_id) {
    sql += ' AND e.dept_id = ?';
    params.push(dept_id);
  }
  
  sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(size), parseInt(offset));
  
  const rows = await query(sql, params);
  
  const countSql = sql.replace('SELECT e.*, d.dept_name', 'SELECT COUNT(*) as total').replace('ORDER BY e.created_at DESC LIMIT ? OFFSET ?', '');
  const countParams = params.slice(0, -2);
  const countResult = await query(countSql, countParams);
  
  res.json({ code: 200, data: { list: rows, total: countResult[0].total } });
};

const getById = async (req, res) => {
  const { id } = req.params;
  const employees = await query('SELECT * FROM sys_employee WHERE id = ? AND is_deleted = 0', [id]);
  
  if (employees.length === 0) {
    return res.json({ code: 400, message: '员工不存在' });
  }
  
  const employee = employees[0];
  delete employee.password;
  res.json({ code: 200, data: employee });
};

const create = async (req, res) => {
  const { dept_id, username, password, real_name, phone, avatar, status } = req.body;
  
  const existing = await query('SELECT * FROM sys_employee WHERE username = ? AND is_deleted = 0', [username]);
  if (existing.length > 0) {
    return res.json({ code: 400, message: '账号已存在' });
  }
  
  let plainPassword;
  try {
    plainPassword = decryptPassword(password);
  } catch (error) {
    // RSA解密失败：回退为明文
    plainPassword = password;
  }
  
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  
  const result = await query(
    'INSERT INTO sys_employee (dept_id, username, password, real_name, phone, avatar, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [dept_id, username, hashedPassword, real_name, phone, avatar, status]
  );
  
  res.json({ code: 200, message: '创建成功', data: { id: result.insertId } });
};

const update = async (req, res) => {
  const { id } = req.params;
  const { dept_id, real_name, phone, avatar, status } = req.body;
  
  const result = await query(
    'UPDATE sys_employee SET dept_id = ?, real_name = ?, phone = ?, avatar = ?, status = ? WHERE id = ?',
    [dept_id, real_name, phone, avatar, status, id]
  );
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '更新失败' });
  }
  
  res.json({ code: 200, message: '更新成功' });
};

const updatePassword = async (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword } = req.body;
  
  const employees = await query('SELECT * FROM sys_employee WHERE id = ? AND is_deleted = 0', [id]);
  
  if (employees.length === 0) {
    return res.json({ code: 400, message: '员工不存在' });
  }
  
  const employee = employees[0];
  
  let plainOldPassword;
  let plainNewPassword;
  try {
    plainOldPassword = decryptPassword(oldPassword);
  } catch (error) {
    plainOldPassword = oldPassword;
  }
  try {
    plainNewPassword = decryptPassword(newPassword);
  } catch (error) {
    plainNewPassword = newPassword;
  }
  
  const isPasswordValid = await bcrypt.compare(plainOldPassword, employee.password);
  
  if (!isPasswordValid) {
    return res.json({ code: 400, message: '旧密码错误' });
  }
  
  const hashedPassword = await bcrypt.hash(plainNewPassword, 10);
  await query('UPDATE sys_employee SET password = ? WHERE id = ?', [hashedPassword, id]);
  
  res.json({ code: 200, message: '密码修改成功' });
};

const remove = async (req, res) => {
  const { id } = req.params;
  
  const result = await query('UPDATE sys_employee SET is_deleted = 1 WHERE id = ?', [id]);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '删除失败' });
  }
  
  res.json({ code: 200, message: '删除成功' });
};

module.exports = { login, getList, getById, create, update, updatePassword, remove };