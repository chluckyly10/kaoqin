const { query } = require('../config/db');

const sign = async (req, res) => {
  const { employeeId, signType, address, location, device, sign_source = 1 } = req.body;
  
  const longitude = location?.longitude || '';
  const latitude = location?.latitude || '';
  
  const today = new Date().toISOString().split('T')[0];
  
  const schedules = await query(
    'SELECT * FROM attendance_schedule WHERE employee_id = ? AND schedule_date = ? AND is_deleted = 0',
    [employeeId, today]
  );
  
  let schedule_id = null;
  let rule_id = null;
  let status = 0;
  
  if (schedules.length > 0) {
    schedule_id = schedules[0].id;
    rule_id = schedules[0].rule_id;
    
    const rules = await query('SELECT * FROM attendance_rule WHERE id = ? AND is_deleted = 0', [rule_id]);
    if (rules.length > 0) {
      const rule = rules[0];
      const now = new Date();
      
      if (signType === 1) {
        const signTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
          parseInt(rule.start_time.split(':')[0]), parseInt(rule.start_time.split(':')[1]));
        
        if (now > signTime && (now - signTime) / 60000 > rule.late_minute) {
          status = 1;
        }
      } else {
        const signTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
          parseInt(rule.end_time.split(':')[0]), parseInt(rule.end_time.split(':')[1]));
        
        if (now < signTime && (signTime - now) / 60000 > rule.early_minute) {
          status = 2;
        }
      }
    }
  } else {
    const defaultRules = await query('SELECT * FROM attendance_rule WHERE status = 1 AND is_deleted = 0 LIMIT 1');
    if (defaultRules.length > 0) {
      rule_id = defaultRules[0].id;
    }
  }
  
  const result = await query(
    'INSERT INTO attendance_record (employee_id, schedule_id, rule_id, sign_type, sign_time, address, longitude, latitude, device, sign_source, status) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)',
    [employeeId, schedule_id, rule_id, signType, address, longitude, latitude, device, sign_source, status]
  );
  
  const records = await query(`
    SELECT ar.*, e.real_name, e.username, d.dept_name, r.rule_name, r.start_time, r.end_time
    FROM attendance_record ar
    LEFT JOIN sys_employee e ON ar.employee_id = e.id
    LEFT JOIN sys_department d ON e.dept_id = d.id
    LEFT JOIN attendance_rule r ON ar.rule_id = r.id
    WHERE ar.id = ?
  `, [result.insertId]);
  
  const record = records[0];
  
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ event: 'new_attendance_record', data: record }));
      }
    });
  }
  
  const message = signType === 1 ? '签到成功' : '签退成功';
  res.json({ code: 200, message, data: record });
};

const getRecords = async (req, res) => {
  const { page = 1, pageSize = 10, employeeId, deptId, startDate, endDate, status, keyword = '' } = req.query;
  const offset = (page - 1) * pageSize;
  
  let sql = `
    SELECT ar.*, e.real_name, e.username, d.dept_name, r.rule_name, r.start_time, r.end_time
    FROM attendance_record ar
    LEFT JOIN sys_employee e ON ar.employee_id = e.id
    LEFT JOIN sys_department d ON e.dept_id = d.id
    LEFT JOIN attendance_rule r ON ar.rule_id = r.id
    WHERE ar.is_deleted = 0
  `;
  const params = [];
  
  if (employeeId) {
    sql += ' AND ar.employee_id = ?';
    params.push(employeeId);
  }
  
  if (deptId) {
    sql += ' AND e.dept_id = ?';
    params.push(deptId);
  }
  
  if (startDate) {
    sql += ' AND DATE(ar.sign_time) >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ' AND DATE(ar.sign_time) <= ?';
    params.push(endDate);
  }
  
  if (status !== undefined && status !== '') {
    sql += ' AND ar.status = ?';
    params.push(status);
  }
  
  if (keyword) {
    sql += ' AND (e.real_name LIKE ? OR e.username LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  sql += ' ORDER BY ar.sign_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), parseInt(offset));
  
  const rows = await query(sql, params);
  
  const countSql = sql.replace('SELECT ar.*, e.real_name, e.username, d.dept_name, r.rule_name, r.start_time, r.end_time', 'SELECT COUNT(*) as total').replace('ORDER BY ar.sign_time DESC LIMIT ? OFFSET ?', '');
  const countParams = params.slice(0, -2);
  const countResult = await query(countSql, countParams);
  
  res.json({ code: 200, data: { list: rows, total: countResult[0].total } });
};

const getRecordById = async (req, res) => {
  const { id } = req.params;
  
  const records = await query(`
    SELECT ar.*, e.real_name, e.username, d.dept_name, r.rule_name, r.start_time, r.end_time
    FROM attendance_record ar
    LEFT JOIN sys_employee e ON ar.employee_id = e.id
    LEFT JOIN sys_department d ON e.dept_id = d.id
    LEFT JOIN attendance_rule r ON ar.rule_id = r.id
    WHERE ar.id = ? AND ar.is_deleted = 0
  `, [id]);
  
  if (records.length === 0) {
    return res.json({ code: 400, message: '记录不存在' });
  }
  
  res.json({ code: 200, data: records[0] });
};

const createRecord = async (req, res) => {
  const { employeeId, schedule_id, rule_id, signType, sign_time, address, location, device, sign_source, status, remark } = req.body;
  
  const longitude = location?.longitude || '';
  const latitude = location?.latitude || '';
  
  const result = await query(
    'INSERT INTO attendance_record (employee_id, schedule_id, rule_id, sign_type, sign_time, address, longitude, latitude, device, sign_source, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [employeeId, schedule_id, rule_id, signType, sign_time, address, longitude, latitude, device, sign_source, status, remark]
  );
  
  res.json({ code: 200, message: '创建成功', data: { id: result.insertId } });
};

const updateRecord = async (req, res) => {
  const { id } = req.params;
  const { sign_time, address, location, device, sign_source, status, remark } = req.body;
  
  const longitude = location?.longitude || '';
  const latitude = location?.latitude || '';
  
  const result = await query(
    'UPDATE attendance_record SET sign_time = ?, address = ?, longitude = ?, latitude = ?, device = ?, sign_source = ?, status = ?, remark = ? WHERE id = ?',
    [sign_time, address, longitude, latitude, device, sign_source, status, remark, id]
  );
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '更新失败' });
  }
  
  res.json({ code: 200, message: '更新成功' });
};

const removeRecord = async (req, res) => {
  const { id } = req.params;
  
  const result = await query('UPDATE attendance_record SET is_deleted = 1 WHERE id = ?', [id]);
  
  if (result.affectedRows === 0) {
    return res.json({ code: 400, message: '删除失败' });
  }
  
  res.json({ code: 200, message: '删除成功' });
};

module.exports = { sign, getRecords, getRecordById, createRecord, updateRecord, removeRecord };