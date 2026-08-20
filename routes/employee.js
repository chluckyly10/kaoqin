const express = require('express');
const router = express.Router();
const { getList, create, update, updatePassword, remove } = require('../controllers/employee');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/page', authenticate, getList);
router.post('/create', authenticate, isAdmin, create);
router.put('/:id', authenticate, isAdmin, update);
router.put('/:id/password', authenticate, updatePassword);
router.delete('/:id', authenticate, isAdmin, remove);

module.exports = router;