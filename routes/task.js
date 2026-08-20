const express = require('express');
const router = express.Router();
const { exportAttendance, importAttendance } = require('../controllers/importExport');
const { getById, getList, generateReport } = require('../controllers/task');
const { query } = require('../config/db');
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');

router.post('/import-attendance', authenticate, upload.single('file'), importAttendance);
router.post('/export-attendance', authenticate, exportAttendance);
router.post('/generate-report', authenticate, generateReport);
router.get('/sse/:taskId', authenticate, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendStatus = async () => {
    try {
      const rows = await query(
        `SELECT t.*, e.real_name as employee_name
         FROM sys_task t
         LEFT JOIN sys_employee e ON t.employee_id = e.id
         WHERE t.id = ? AND t.is_deleted = 0`,
        [req.params.taskId]
      );
      if (rows.length > 0) {
        res.write(`data: ${JSON.stringify(rows[0])}\n\n`);
      }
    } catch (e) {
      // 查询失败不关闭连接，等下次重试
    }
  };

  await sendStatus();

  const interval = setInterval(sendStatus, 2000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});
router.get('/list', authenticate, getList);
router.get('/:id', authenticate, getById);

module.exports = router;