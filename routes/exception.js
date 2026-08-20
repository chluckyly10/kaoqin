const express = require('express');
const router = express.Router();
const { create, getList, audit } = require('../controllers/exception');
const { authenticate } = require('../middleware/auth');

router.post('/apply', authenticate, create);
router.get('/page', authenticate, getList);
router.put('/audit/:id', authenticate, audit);

module.exports = router;