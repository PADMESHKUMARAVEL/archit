const { required } = require('./config/env');
const http = require('http');

const FRONTEND_ORIGINS = required('FRONTEND_URL')
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...FRONTEND_ORIGINS
]);
const corsOptions = {
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
const JWT_SECRET = required('JWT_SECRET');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');
const db = require('./config/db');

const app = express();
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 120 }));
app.get('/api/health', (req,res) => res.json({ status: 'ok' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });
global.io = io;

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { next(new Error('Invalid token')); }
});

io.on('connection', socket => {
  socket.join(`user:${socket.user.id}`);
  socket.on('conversation:join', async ({ conversationId }) => {
    if (!Number.isInteger(Number(conversationId))) return;
    const [rows] = await db.execute(
      'SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?',
      [conversationId,socket.user.id]
    );
    if (rows.length) socket.join(`conversation:${conversationId}`);
  });
});

const port = Number(required('PORT'));
const backendUrl = required('BACKEND_URL');
server.listen(port, () => {
  console.log(`Archit API listening on port ${port}`);
  console.log(`Backend URL : ${backendUrl}`);
  console.log(`Frontend URLs: ${[...allowedOrigins].join(', ')}`);
  console.log(`DB          : ${required('DB_USER')}@${required('DB_HOST')}:${required('DB_PORT')}/${required('DB_NAME')}`);
});
