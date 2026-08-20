const express = require('express');
const router = express.Router();
const { getList, batchCreate, remove } = require('../controllers/schedule');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/page', authenticate, getList);
router.post('/batch', authenticate, isAdmin, batchCreate);
router.delete('/:id', authenticate, isAdmin, remove);

module.exports = router;