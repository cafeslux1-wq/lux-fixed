import 'dotenv/config';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app';
import { initSocket } from './services/socket.service';
import { runDailyProfitSharing } from './services/profit-sharing.service';
import { cleanupExpiredKeys } from './services/idempotency.service';
import { query } from './config/database';
import { logger } from './utils/logger';

// التأكد من قراءة المنفذ من متغيرات البيئة أو استخدام 4000 كافتراضي
const PORT = parseInt(process.env.PORT || '4000');

// ── HTTP + Socket.io ──────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    // دعم تعدد النطاقات بما فيها الدومين الجديد cafeslux.com
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

initSocket(io);

// ── Start (تم التعديل ليدعم 0.0.0.0 للعمل على Railway) ──────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`[Server] LUX Supreme v4.3 listening on port ${PORT} (0.0.0.0)`);
  logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ── Scheduled tasks (المهام المجدولة للمقهى) ────────────────────────────────
// توزيع الأرباح: كل 30 دقيقة
setInterval(() => {
  runDailyProfitSharing().catch(err => logger.error('[Cron] Profit sharing failed:', err.message));
}, 30 * 60_000);

// تنظيف مفاتيح التحقق: كل 6 ساعات
setInterval(() => {
  cleanupExpiredKeys().catch(() => {});
}, 6 * 60 * 60_000);

// أخذ لقطة إحصائية (MRR): كل 24 ساعة
setInterval(() => {
  query('SELECT take_mrr_snapshot()').catch(() => {});
}, 24 * 60 * 60_000);

// لقطة إحصائية أولية بعد 30 ثانية من التشغيل
setTimeout(() => {
  query('SELECT take_mrr_snapshot()').catch(() => {});
}, 30_000);

// ── Graceful shutdown (الإغلاق الآمن للسيرفر) ───────────────────────────────
function shutdown(signal: string) {
  logger.info(`[Server] ${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    logger.info('[Server] HTTP server closed');
    process.exit(0);
  });
  // إغلاق قسري بعد 10 ثوانٍ إذا تعذر الإغلاق الآمن
  setTimeout(() => { logger.error('[Server] Forced shutdown'); process.exit(1); }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.error('[Server] Uncaught exception:', err); process.exit(1); });
process.on('unhandledRejection', (reason) => { logger.error('[Server] Unhandled rejection:', reason); });

export { httpServer, io };
