const express = require('express');
const router = express.Router();
const { getSetting, saveSetting } = require('../controllers/outSetting');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getSetting);
router.post('/save', authenticate, saveSetting);

module.exports = router;
