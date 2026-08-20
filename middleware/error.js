const errorHandler = (error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    code: 500,
    message: error.message || '服务器内部错误'
  });
};

const notFound = (req, res, next) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  });
};

module.exports = { errorHandler, notFound };