import 'dotenv/config';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app';
import { initSocket } from './services/socket.service';
import { runDailyProfitSharing } from './services/profit-sharing.service';
import { cleanupExpiredKeys } from './services/idempotency.service';
import { query } from './config/database';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '4000');

// ── HTTP + Socket.io ──────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

initSocket(io);

// ── Start ─────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`[Server] LUX Supreme v4.3 listening on port ${PORT}`);
  logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ── Scheduled tasks ───────────────────────────────────────────────────────
// Profit sharing: every 30 min (service is idempotent — safe to run often)
setInterval(() => {
  runDailyProfitSharing().catch(err => logger.error('[Cron] Profit sharing failed:', err.message));
}, 30 * 60_000);

// Idempotency key cleanup: every 6 hours
setInterval(() => {
  cleanupExpiredKeys().catch(() => {});
}, 6 * 60 * 60_000);

// MRR snapshot: every 24 hours
setInterval(() => {
  query('SELECT take_mrr_snapshot()').catch(() => {});
}, 24 * 60 * 60_000);

// Take initial snapshot 30s after startup
setTimeout(() => {
  query('SELECT take_mrr_snapshot()').catch(() => {});
}, 30_000);

// ── Graceful shutdown ─────────────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info(`[Server] ${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    logger.info('[Server] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => { logger.error('[Server] Forced shutdown'); process.exit(1); }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.error('[Server] Uncaught exception:', err); process.exit(1); });
process.on('unhandledRejection', (reason) => { logger.error('[Server] Unhandled rejection:', reason); });

export { httpServer, io };
