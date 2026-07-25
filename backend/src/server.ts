import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { initDb } from './db/index.js';
import { ingestRoutes } from './routes/ingest.js';
import { apiRoutes } from './routes/api.js';
import { pushRoutes } from './routes/push.js';
import { startRetentionJob } from './retention.js';
import { Server } from 'socket.io';

const port = parseInt(process.env.PORT ?? '3000', 10);
const dbPath = process.env.DB_PATH ?? './data/netwatch.db';
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081'];
const logLevel = process.env.LOG_LEVEL ?? 'info';

const fastify = Fastify({
  logger: { level: logLevel }
});

// Initialize database
const db = initDb(dbPath);

// First-run admin password setup
const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
if (settings && !settings.passwordHash) {
  const adminPassword = process.env.NETWATCH_ADMIN_PASSWORD;
  if (!adminPassword) {
    fastify.log.error('NETWATCH_ADMIN_PASSWORD must be set in .env on first run to setup the admin account.');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare('UPDATE settings SET passwordHash = ? WHERE id = 1').run(hash);
  fastify.log.info('Admin password hashed and saved to database.');
}

// Initialize Socket.io
const io = new Server(fastify.server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.use((socket, next) => {
  try {
    // Check for agent secret first
    const agentSecret = process.env.NETWATCH_AGENT_SECRET || 'fallback-agent-secret';
    if (socket.handshake.auth && socket.handshake.auth.agentSecret === agentSecret) {
      return next(); // Authenticated as agent
    }

    const cookieHeader = socket.request.headers.cookie;
    if (!cookieHeader) throw new Error('No cookie header');
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    if (!tokenMatch) throw new Error('No token cookie');
    const token = tokenMatch[1];
    
    // fastify.jwt will be available by the time connections happen
    const decoded = fastify.jwt.verify(token);
    if (!decoded) throw new Error('Invalid token');
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  fastify.log.info(`Client connected via Socket.io: ${socket.id}`);
  socket.on('disconnect', () => {
    fastify.log.info(`Client disconnected: ${socket.id}`);
  });
});

// Expose db and io to routes via fastify decorator
fastify.decorate('db', db);
fastify.decorate('io', io);

declare module 'fastify' {
  interface FastifyInstance {
    db: import('better-sqlite3').Database;
    io: Server;
  }
}

// Register plugins
fastify.register(cors, {
  origin: corsOrigin,
  credentials: true,
});

fastify.register(fastifyCookie);
fastify.register(fastifyJwt, {
  secret: process.env.NETWATCH_JWT_SECRET || 'fallback-super-secret-netwatch-key-change-me',
  cookie: {
    cookieName: 'token',
    signed: false
  }
});

// Global authentication hook
fastify.addHook('onRequest', async (request, reply) => {
  // Allow login and status checks without JWT
  const openPaths = ['/api/auth/login', '/api/status'];
  if (openPaths.some(p => request.url.startsWith(p))) {
    return;
  }
  
  // Allow agent routes if they provide the valid secret
  const agentSecret = process.env.NETWATCH_AGENT_SECRET || 'fallback-agent-secret';
  if (request.headers['x-agent-secret'] === agentSecret) {
    return; // Authenticated as agent
  }

  // Otherwise require JWT
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Register routes
fastify.register(ingestRoutes);
fastify.register(apiRoutes, { prefix: '/api' });
fastify.register(pushRoutes);

// Start server
const start = async () => {
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
    startRetentionJob(fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
