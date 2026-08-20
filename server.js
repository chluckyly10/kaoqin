const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/error');

const authRoutes = require('./routes/auth');
const departmentRoutes = require('./routes/department');
const employeeRoutes = require('./routes/employee');
const attendanceRoutes = require('./routes/attendance');
const ruleRoutes = require('./routes/rule');
const scheduleRoutes = require('./routes/schedule');
const exceptionRoutes = require('./routes/exception');
const uploadRoutes = require('./routes/upload');
const taskRoutes = require('./routes/task');
const statisticsRoutes = require('./routes/statistics');
const outSettingRoutes = require('./routes/outSetting');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

global.wss = wss;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/department', departmentRoutes);
app.use('/api/v1/employee', employeeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/attendance/rule', ruleRoutes);
app.use('/api/v1/attendance/schedule', scheduleRoutes);
app.use('/api/v1/attendance/exception', exceptionRoutes);
app.use('/api/v1/attendance/statistics', statisticsRoutes);
app.use('/api/v1/attendance/out-setting', outSettingRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/task', taskRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

app.get('/api/v1/attendance/latest-record', async (req, res) => {
  const { lastId } = req.query;
  const { query } = require('./config/db');
  
  let sql = 'SELECT ar.*, e.real_name, e.username, d.dept_name, r.rule_name FROM attendance_record ar LEFT JOIN sys_employee e ON ar.employee_id = e.id LEFT JOIN sys_department d ON e.dept_id = d.id LEFT JOIN attendance_rule r ON ar.rule_id = r.id WHERE ar.is_deleted = 0';
  
  if (lastId) {
    sql += ' AND ar.id > ?';
  }
  
  sql += ' ORDER BY ar.id DESC LIMIT 20';
  
  const records = await query(sql, lastId ? [lastId] : []);
  
  res.json({ code: 200, data: records });
});

app.use(notFound);
app.use(errorHandler);

wss.on('connection', (ws, req) => {
  // req.url 形如 "/ws?token=xxx"，用 URL 解析获取 token
  const urlObj = new URL(req.url, 'http://localhost');
  const token = urlObj.searchParams.get('token');

  if (!token) {
    ws.close();
    return;
  }

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;