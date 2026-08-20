const { query } = require('../config/db');

const TABLE_NAME = 'attendance_out_setting';

const getSetting = async (req, res) => {
  try {
    const rows = await query(`SHOW TABLES LIKE '${TABLE_NAME}'`);
    
    if (rows.length === 0) {
      return res.json({ 
        code: 200, 
        data: { 
          enabled: false, 
          radius: 300, 
          require_photo: false, 
          require_remark: false, 
          require_location: true,
          allowed_employee_ids: [],
          allowed_department_ids: []
        } 
      });
    }
    
    const settings = await query(`SELECT * FROM ${TABLE_NAME} WHERE id = 1 LIMIT 1`);
    
    if (settings.length === 0) {
      return res.json({ 
        code: 200, 
        data: { 
          enabled: false, 
          radius: 300, 
          require_photo: false, 
          require_remark: false, 
          require_location: true,
          allowed_employee_ids: [],
          allowed_department_ids: []
        } 
      });
    }
    
    const row = settings[0];
    res.json({ 
      code: 200, 
      data: { 
        enabled: row.enabled || false, 
        radius: row.radius || 300, 
        require_photo: row.require_photo || false, 
        require_remark: row.require_remark || false, 
        require_location: row.require_location !== undefined ? row.require_location : true,
        allowed_employee_ids: row.allowed_employee_ids ? JSON.parse(row.allowed_employee_ids) : [],
        allowed_department_ids: row.allowed_department_ids ? JSON.parse(row.allowed_department_ids) : []
      } 
    });
  } catch (error) {
    console.error('Get out setting error:', error);
    res.json({ 
      code: 200, 
      data: { 
        enabled: false, 
        radius: 300, 
        require_photo: false, 
        require_remark: false, 
        require_location: true,
        allowed_employee_ids: [],
        allowed_department_ids: []
      } 
    });
  }
};

const saveSetting = async (req, res) => {
  const { enabled, radius, require_photo, require_remark, require_location, allowed_employee_ids, allowed_department_ids } = req.body;
  
  try {
    await query(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      enabled TINYINT(1) DEFAULT 0,
      radius INT DEFAULT 300,
      require_photo TINYINT(1) DEFAULT 0,
      require_remark TINYINT(1) DEFAULT 0,
      require_location TINYINT(1) DEFAULT 1,
      allowed_employee_ids TEXT,
      allowed_department_ids TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    
    const employeeIds = JSON.stringify(allowed_employee_ids || []);
    const deptIds = JSON.stringify(allowed_department_ids || []);
    
    const existing = await query(`SELECT id FROM ${TABLE_NAME} WHERE id = 1`);
    
    if (existing.length === 0) {
      await query(`INSERT INTO ${TABLE_NAME} (id, enabled, radius, require_photo, require_remark, require_location, allowed_employee_ids, allowed_department_ids) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`, 
        [enabled ? 1 : 0, radius, require_photo ? 1 : 0, require_remark ? 1 : 0, require_location ? 1 : 0, employeeIds, deptIds]);
    } else {
      await query(`UPDATE ${TABLE_NAME} SET enabled = ?, radius = ?, require_photo = ?, require_remark = ?, require_location = ?, allowed_employee_ids = ?, allowed_department_ids = ? WHERE id = 1`,
        [enabled ? 1 : 0, radius, require_photo ? 1 : 0, require_remark ? 1 : 0, require_location ? 1 : 0, employeeIds, deptIds]);
    }
    
    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    console.error('Save out setting error:', error);
    res.json({ code: 500, message: '保存失败' });
  }
};

module.exports = { getSetting, saveSetting };
