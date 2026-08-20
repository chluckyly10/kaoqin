const express = require('express');
const router = express.Router();
const { getList, create, update, remove } = require('../controllers/department');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/list', authenticate, getList);
router.post('/create', authenticate, isAdmin, create);
router.put('/:id', authenticate, isAdmin, update);
router.delete('/:id', authenticate, isAdmin, remove);

module.exports = router;