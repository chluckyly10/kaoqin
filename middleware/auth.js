const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  let token = req.headers.authorization;

  // SSE / WebSocket 等场景无法设置 Authorization header，支持 query 参数 token
  if (!token && req.query && req.query.token) {
    token = 'Bearer ' + req.query.token;
  }

  if (!token) {
    return res.json({ code: 401, message: '未授权访问' });
  }

  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  } else if (token.startsWith('Token ')) {
    token = token.slice(6);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.json({ code: 401, message: 'token无效或已过期' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.is_admin !== 1) {
    return res.json({ code: 403, message: '无管理员权限' });
  }
  next();
};

module.exports = { authenticate, isAdmin };