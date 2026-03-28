import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireStaffAuth } from './middleware/enterprise.middleware';
import { checkSubscription } from './middleware/checkSubscription';
import ordersRoutes from './routes/orders.routes';
import authRoutes from './routes/auth.routes';
import { hrRoutes, menuRoutes, billingRoutes, adminRoutes, customerRoutes } from './routes/other.routes';

const app = express();
const API = '/api/v1';

const FRONTEND_DIST = path.resolve(__dirname, '..', '..', '..', 'frontend', 'dist');
const hasFrontend   = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));

app.use(`${API}/billing/webhook`, express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.requestId = `lux-${uuidv4().slice(0, 12)}`;
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Serve static files FIRST (before SPA fallback) ──────────────────────────
if (hasFrontend) {
  // Hashed assets — long cache
  app.use('/assets', express.static(path.join(FRONTEND_DIST, 'assets'), {
    maxAge: '1y', immutable: true,
  }));
  // ALL other static files including /public/menu/*.jpg
  app.use(express.static(FRONTEND_DIST, { index: false }));
}

// ── API routes ───────────────────────────────────────────────────────────────
app.use(`${API}/auth/staff`, authRoutes);
app.use(`${API}/billing`,    billingRoutes);
app.use(`${API}/menu`,       menuRoutes);

app.use(`${API}`, requireStaffAuth);
app.use(`${API}`, checkSubscription);
app.use(`${API}/orders`,    ordersRoutes);
app.use(`${API}/hr`,        hrRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}`,           adminRoutes);

// ── SPA fallback — ONLY for non-static, non-API paths ───────────────────────
if (hasFrontend) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    // Don't intercept file requests (images, fonts, etc.)
    if (/\.[a-z0-9]+$/i.test(req.path)) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
