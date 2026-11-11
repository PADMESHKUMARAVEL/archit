const mysql = require('mysql2/promise');
const { required } = require('./env');

const sslEnabled = process.env.DB_SSL === 'true';
const sslCa = process.env.DB_SSL_CA;

if (sslEnabled && !sslCa) {
  throw new Error('DB_SSL_CA is required when DB_SSL=true');
}

const pool = mysql.createPool({
  host: required('DB_HOST'),
  port: Number(required('DB_PORT')),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  database: required('DB_NAME'),
  ...(sslEnabled ? { ssl: { ca: sslCa, rejectUnauthorized: true } } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

module.exports = pool;
