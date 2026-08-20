const express = require('express');
const router = express.Router();
const { sign, getRecords, updateRecord, removeRecord } = require('../controllers/attendance');
const { authenticate } = require('../middleware/auth');

router.post('/sign', authenticate, sign);
router.get('/record/page', authenticate, getRecords);
router.put('/record/:id', authenticate, updateRecord);
router.delete('/record/:id', authenticate, removeRecord);

module.exports = router;