const { query } = require('../config/db');

const getList = async (req, res) => {
  const { page = 1, size = 10, keyword = '' } = req.query;
  const offset = (page - 1) * size;
  
  let sql = 'SELECT * FROM sys_department WHERE is_deleted = 0';
  const params = [];
  
  if (keyword) {
    sql += ' AND dept_name LIKE ?';
    params.push(`%${keyword}%`);
  }
  
  sql += ' ORDER BY sort ASC, created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(size), parseInt(offset));
  
  const rows = await query(sql, params);
  
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total').replace('ORDER BY sort ASC, created_at DESC LIMIT ? OFFSET ?', '');
  const countParams = params.slice(0, -2);
  const countResult = await query(countSql, countParams);
  
  res.json({ code: 200, data: { list: rows, total: countResult[0].total } });
};

const getTree = async (req, res) => {
  const rows = await query('SELECT * FROM sys_department WHERE is_deleted = 0 ORDER BY sort ASC');
  
  const buildTree = (list, parentId = 0) => {
    return list
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        ...item,
        children: buildTree(list, item.id)
      }));
  };
  
  const tree = buildTree(rows);
  res.json({ code: 200, data: tree });
};

const getById = async (req, res) => {
  const { id } = req.params;
  const departments = await query('SELECT * FROM sys_department WHERE id = ? AND is_deleted = 0', [id]);
  
  if (departments.length === 0) {
    return res.json({ code: 400, message: '部门不存在' });
  }
  
  res.json({ code: 200, data: departments[0] });
};

const create = async (req, res) => {
  const { parent_id, dept_name, sort, status } = req.body;
  
  const result = await query(
    'INSERT INTO sys_department (parent_id, dept_name, sort, status) VALUES (?, ?, ?, ?)',
    [parent_id || 0, dept_name, sort || 0, status || 1]
  );
  
  res.json({ code: 200, message: '创建成功', data: { id: result.insertId } });
};

const update = async (req, res) => {
  const { id } = req.params;
  const { parent_id, dept_name, sort, status } = req.body;
  
  const result = await query(
    'UPDATE sys_department SET parent_id = ?, dept_name = ?, sort = ?, status = ? WHERE id = ?',
    [parent_id || 0, dept_name, sort || 0, status, id]
  );
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '更新失败' });
  }
  
  res.json({ code: 200, message: '更新成功' });
};

const remove = async (req, res) => {
  const { id } = req.params;
  
  const children = await query('SELECT * FROM sys_department WHERE parent_id = ? AND is_deleted = 0', [id]);
  if (children.length > 0) {
    return res.json({ code: 400, message: '请先删除子部门' });
  }
  
  const employees = await query('SELECT * FROM sys_employee WHERE dept_id = ? AND is_deleted = 0', [id]);
  if (employees.length > 0) {
    return res.json({ code: 400, message: '该部门下仍有员工' });
  }
  
  const result = await query('UPDATE sys_department SET is_deleted = 1 WHERE id = ?', [id]);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '删除失败' });
  }
  
  res.json({ code: 200, message: '删除成功' });
};

module.exports = { getList, getTree, getById, create, update, remove };