const express = require('express');
const router = express.Router();
const { login, getById } = require('../controllers/employee');
const { authenticate } = require('../middleware/auth');
const { getPublicKey } = require('../utils/rsa');

router.post('/login', login);

router.get('/profile', authenticate, async (req, res) => {
  const { id } = req.user;
  const employees = await getById({ params: { id } }, res);
});

router.get('/public-key', (req, res) => {
  const publicKey = getPublicKey();
  res.json({ code: 200, data: { publicKey } });
});

module.exports = router;