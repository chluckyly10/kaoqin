const express = require('express');
const router = express.Router();
const { getEmployeeStatistics, getDepartmentStatistics } = require('../controllers/statistics');
const { authenticate } = require('../middleware/auth');

router.get('/employee', authenticate, getEmployeeStatistics);
router.get('/department', authenticate, getDepartmentStatistics);

module.exports = router;
