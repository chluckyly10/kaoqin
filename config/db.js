const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+08:00'
});

const query = async (sql, params = []) => {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET NAMES utf8mb4");
    // 防御：把 undefined 转为 null，避免 mysql2 抛 TypeError 导致进程崩溃
    const safeParams = Array.isArray(params)
      ? params.map((p) => (p === undefined ? null : p))
      : params;
    const [rows] = await connection.execute(sql, safeParams);
    return rows;
  } finally {
    connection.release();
  }
};

const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET NAMES utf8mb4");
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = { pool, query, transaction };