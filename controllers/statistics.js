const { query } = require('../config/db');

const getEmployeeStatistics = async (req, res) => {
  const { month, department_id } = req.query;
  
  let sql = `
    SELECT 
      e.id as employee_id,
      e.real_name,
      e.username,
      d.dept_name,
      COUNT(DISTINCT DATE(ar.sign_time)) as attendance_days,
      SUM(CASE WHEN ar.status = 0 THEN 1 ELSE 0 END) as normal_count,
      SUM(CASE WHEN ar.status = 1 THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN ar.status = 2 THEN 1 ELSE 0 END) as early_count,
      SUM(CASE WHEN ar.status = 3 THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN ar.sign_type = 4 THEN 1 ELSE 0 END) as field_work_count
    FROM sys_employee e
    LEFT JOIN sys_department d ON e.dept_id = d.id
    LEFT JOIN attendance_record ar ON e.id = ar.employee_id AND ar.is_deleted = 0
    WHERE e.is_deleted = 0
  `;
  
  const params = [];
  
  if (month) {
    sql += ' AND DATE_FORMAT(ar.sign_time, "%Y-%m") = ?';
    params.push(month);
  }
  
  if (department_id) {
    sql += ' AND e.dept_id = ?';
    params.push(department_id);
  }
  
  sql += ' GROUP BY e.id, e.real_name, e.username, d.dept_name ORDER BY late_count DESC';
  
  const rows = await query(sql, params);
  
  const data = rows.map(row => ({
    id: row.employee_id,
    name: row.real_name || row.username,
    department: row.dept_name,
    attendanceDays: row.attendance_days || 0,
    normalCount: row.normal_count || 0,
    lateCount: row.late_count || 0,
    earlyCount: row.early_count || 0,
    absentCount: row.absent_count || 0,
    fieldWorkCount: row.field_work_count || 0,
    attendanceRate: row.attendance_days > 0 ? Math.round(((row.normal_count || 0) / (row.attendance_days * 2)) * 100) : 0
  }));
  
  res.json({ code: 200, data: { list: data, total: data.length } });
};

const getDepartmentStatistics = async (req, res) => {
  const { month } = req.query;
  
  let sql = `
    SELECT 
      d.id as department_id,
      d.dept_name,
      COUNT(DISTINCT e.id) as employee_count,
      COUNT(DISTINCT DATE(ar.sign_time)) as attendance_days,
      SUM(CASE WHEN ar.status = 0 THEN 1 ELSE 0 END) as normal_count,
      SUM(CASE WHEN ar.status = 1 THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN ar.status = 2 THEN 1 ELSE 0 END) as early_count,
      SUM(CASE WHEN ar.status = 3 THEN 1 ELSE 0 END) as absent_count
    FROM sys_department d
    LEFT JOIN sys_employee e ON e.dept_id = d.id AND e.is_deleted = 0
    LEFT JOIN attendance_record ar ON e.id = ar.employee_id AND ar.is_deleted = 0
    WHERE d.is_deleted = 0
  `;
  
  const params = [];
  
  if (month) {
    sql += ' AND DATE_FORMAT(ar.sign_time, "%Y-%m") = ?';
    params.push(month);
  }
  
  sql += ' GROUP BY d.id, d.dept_name ORDER BY d.dept_name';
  
  const rows = await query(sql, params);
  
  const data = rows.map(row => ({
    id: row.department_id,
    name: row.dept_name,
    employeeCount: row.employee_count || 0,
    attendanceDays: row.attendance_days || 0,
    normalCount: row.normal_count || 0,
    lateCount: row.late_count || 0,
    earlyCount: row.early_count || 0,
    absentCount: row.absent_count || 0,
    attendanceRate: row.employee_count > 0 ? Math.round(((row.normal_count || 0) / Math.max(row.employee_count * 2, 1)) * 100) : 0
  }));
  
  res.json({ code: 200, data: { list: data, total: data.length } });
};

module.exports = { getEmployeeStatistics, getDepartmentStatistics };
