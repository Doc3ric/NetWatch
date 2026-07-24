import Fastify from 'fastify';
import cors from '@fastify/cors';
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

// Initialize Socket.io
const io = new Server(fastify.server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
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
