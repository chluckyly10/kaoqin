const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const exportDir = process.env.EXPORT_DIR || './exports';
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const exportAttendance = async (req, res) => {
  const { employee_id, start_date, end_date } = req.body;
  const employeeId = req.user.id;
  
  const taskResult = await query(
    'INSERT INTO sys_task (task_type, employee_id, params, status, progress) VALUES (?, ?, ?, ?, ?)',
    ['export_attendance', employeeId, JSON.stringify({ employee_id, start_date, end_date }), 0, 0]
  );
  const taskId = taskResult.insertId;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const sendProgress = async (progress, status, msg, fileUrl) => {
    await query(
      'UPDATE sys_task SET progress = ?, status = ?, msg = ?, file_url = ? WHERE id = ?',
      [progress, status, msg, fileUrl, taskId]
    );
    res.write(`data: ${JSON.stringify({ task_id: taskId, progress, status, msg, file_url: fileUrl })}\n\n`);
  };
  
  setTimeout(async () => {
    try {
      await sendProgress(10, 0, '正在查询数据...');
      
      let sql = `
        SELECT ar.*, e.real_name, e.username, d.dept_name, r.rule_name, r.start_time, r.end_time
        FROM attendance_record ar
        LEFT JOIN sys_employee e ON ar.employee_id = e.id
        LEFT JOIN sys_department d ON e.dept_id = d.id
        LEFT JOIN attendance_rule r ON ar.rule_id = r.id
        WHERE ar.is_deleted = 0
      `;
      const params = [];
      
      if (employee_id) {
        sql += ' AND ar.employee_id = ?';
        params.push(employee_id);
      }
      
      if (start_date) {
        sql += ' AND DATE(ar.sign_time) >= ?';
        params.push(start_date);
      }
      
      if (end_date) {
        sql += ' AND DATE(ar.sign_time) <= ?';
        params.push(end_date);
      }
      
      sql += ' ORDER BY ar.sign_time DESC';
      const records = await query(sql, params);
      
      await sendProgress(30, 0, '数据查询完成，正在处理...');
      
      const statusMap = { 0: '正常', 1: '迟到', 2: '早退', 3: '缺卡', 4: '外勤打卡' };
      const signTypeMap = { 1: '签到', 2: '签退' };
      const signSourceMap = { 1: '后台手动录入', 2: 'H5移动端', 3: '人脸设备' };
      
      const data = records.map(record => ({
        '打卡时间': record.sign_time,
        '员工姓名': record.real_name,
        '账号': record.username,
        '部门': record.dept_name,
        '打卡类型': signTypeMap[record.sign_type],
        '考勤规则': record.rule_name,
        '上班时间': record.start_time,
        '下班时间': record.end_time,
        '状态': statusMap[record.status],
        '打卡来源': signSourceMap[record.sign_source],
        '打卡地址': record.address,
        '备注': record.remark
      }));
      
      await sendProgress(60, 0, '正在生成Excel...');
      
      const worksheet = xlsx.utils.json_to_sheet(data);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, '考勤记录');
      
      const fileName = `attendance_export_${Date.now()}.xlsx`;
      const filePath = path.join(exportDir, fileName);
      xlsx.writeFile(workbook, filePath);
      
      await sendProgress(100, 1, '导出完成', `/exports/${fileName}`);
      
      res.end();
    } catch (error) {
      await sendProgress(0, 2, error.message);
      res.end();
    }
  }, 100);
};

const importAttendance = async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.json({ code: 400, message: '请上传文件' });
  }
  
  const employeeId = req.user.id;
  
  const taskResult = await query(
    'INSERT INTO sys_task (task_type, employee_id, params, status, progress) VALUES (?, ?, ?, ?, ?)',
    ['import_attendance', employeeId, JSON.stringify({ filename: file.filename }), 0, 0]
  );
  const taskId = taskResult.insertId;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const sendProgress = async (progress, status, msg) => {
    await query(
      'UPDATE sys_task SET progress = ?, status = ?, msg = ? WHERE id = ?',
      [progress, status, msg, taskId]
    );
    res.write(`data: ${JSON.stringify({ task_id: taskId, progress, status, msg })}\n\n`);
  };
  
  setTimeout(async () => {
    try {
      await sendProgress(10, 0, '正在读取文件...');
      
      const workbook = xlsx.readFile(file.path);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      await sendProgress(30, 0, `读取到 ${data.length} 条数据...`);
      
      let successCount = 0;
      let failCount = 0;
      const errors = [];
      
      const statusMap = { '正常': 0, '迟到': 1, '早退': 2, '缺卡': 3, '外勤打卡': 4 };
      const signTypeMap = { '签到': 1, '签退': 2 };
      const signSourceMap = { '后台手动录入': 1, 'H5移动端': 2, '人脸设备': 3 };
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const progress = 30 + Math.floor((i / data.length) * 60);
        
        try {
          const employees = await query('SELECT id FROM sys_employee WHERE username = ? AND is_deleted = 0', [row['账号']]);
          if (employees.length === 0) {
            failCount++;
            errors.push(`第${i + 2}行：账号 ${row['账号']} 不存在`);
            continue;
          }
          
          const employeeId = employees[0].id;
          const ruleName = row['考勤规则'];
          let ruleId = null;
          
          if (ruleName) {
            const rules = await query('SELECT id FROM attendance_rule WHERE rule_name = ? AND is_deleted = 0', [ruleName]);
            if (rules.length > 0) {
              ruleId = rules[0].id;
            }
          }
          
          await query(
            'INSERT INTO attendance_record (employee_id, rule_id, sign_type, sign_time, address, sign_source, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              employeeId,
              ruleId,
              signTypeMap[row['打卡类型']] || 1,
              row['打卡时间'],
              row['打卡地址'],
              signSourceMap[row['打卡来源']] || 1,
              statusMap[row['状态']] || 0,
              row['备注']
            ]
          );
          
          successCount++;
        } catch (error) {
          failCount++;
          errors.push(`第${i + 2}行：${error.message}`);
        }
        
        await sendProgress(progress, 0, `正在导入... ${successCount + failCount}/${data.length}`);
      }
      
      await sendProgress(100, 1, `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`);
      
      res.end();
    } catch (error) {
      await sendProgress(0, 2, error.message);
      res.end();
    } finally {
      fs.unlinkSync(file.path);
    }
  }, 100);
};

const chunkUpload = async (req, res) => {
  const { chunkNumber, totalChunks, fileHash, filename } = req.query;
  const file = req.file;
  
  if (!file) {
    return res.json({ code: 400, message: '请上传文件' });
  }
  
  const chunkDir = path.join(process.env.UPLOAD_DIR, fileHash);
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }
  
  const chunkPath = path.join(chunkDir, chunkNumber);
  fs.renameSync(file.path, chunkPath);
  
  const currentChunk = parseInt(chunkNumber);
  if (currentChunk >= totalChunks) {
    const chunks = [];
    for (let i = 1; i <= totalChunks; i++) {
      const chunkFilePath = path.join(chunkDir, i.toString());
      chunks.push(fs.readFileSync(chunkFilePath));
    }
    
    const fullBuffer = Buffer.concat(chunks);
    const finalFilename = `${Date.now()}_${filename}`;
    const finalPath = path.join(process.env.UPLOAD_DIR, finalFilename);
    fs.writeFileSync(finalPath, fullBuffer);
    
    fs.rmSync(chunkDir, { recursive: true });
    
    res.json({ code: 200, message: '上传完成', data: { filename: finalFilename, path: `/uploads/${finalFilename}` } });
  } else {
    res.json({ code: 200, message: '分片上传成功', data: { chunkNumber: currentChunk, totalChunks } });
  }
};

const checkChunk = async (req, res) => {
  const { fileHash, totalChunks } = req.query;
  
  const chunkDir = path.join(process.env.UPLOAD_DIR, fileHash);
  const uploadedChunks = [];
  
  if (fs.existsSync(chunkDir)) {
    const files = fs.readdirSync(chunkDir);
    files.forEach(file => {
      uploadedChunks.push(parseInt(file));
    });
  }
  
  const finalPath = path.join(process.env.UPLOAD_DIR, `${fileHash}.tmp`);
  const isCompleted = fs.existsSync(finalPath);
  
  res.json({ code: 200, data: { uploadedChunks, totalChunks, isCompleted } });
};

module.exports = { exportAttendance, importAttendance, chunkUpload, checkChunk };