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

// ── Frontend dist path (served by Express in production) ─────────────────
// server.js is at: backend/dist/server.js
// frontend dist is at: frontend/dist/ (relative to repo root)
// __dirname = /app/backend/dist → 2 levels up = /app → + frontend/dist
const FRONTEND_DIST = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
const hasFrontend   = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

// ── Security ─────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // allow inline scripts from Vite build
  crossOriginEmbedderPolicy: false,
}));

// CORS — only needed for API calls; static files don't need CORS
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));

// ── Raw body for Stripe webhook (BEFORE express.json) ────────────────────
app.use(`${API}/billing/webhook`, express.raw({ type: 'application/json' }));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

// ── Request ID ────────────────────────────────────────────────────────────
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.requestId = `lux-${uuidv4().slice(0, 12)}`;
  next();
});

// ── Health check — no auth ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status:   'ok',
  ts:       new Date().toISOString(),
  frontend: hasFrontend ? 'served' : 'not-built',
}));

// ── Serve frontend static assets ──────────────────────────────────────────
if (hasFrontend) {
  // Serve hashed assets with long cache
  app.use('/assets', express.static(path.join(FRONTEND_DIST, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  // Service Worker — no cache
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(FRONTEND_DIST, 'sw.js'));
  });
  // Other static files (favicon, manifest, etc.)
  app.use(express.static(FRONTEND_DIST, { index: false }));
}

// ── PUBLIC API routes (no JWT) ────────────────────────────────────────────
app.use(`${API}/auth/staff`, authRoutes);    // /branch/:id, /pin, /login
app.use(`${API}/billing`,    billingRoutes); // /plans, /webhook
app.use(`${API}/menu`,       menuRoutes);    // /public, /qr/session/:token

// ── AUTHENTICATED API routes (JWT required) ───────────────────────────────
app.use(`${API}`, requireStaffAuth);
app.use(`${API}`, checkSubscription);
app.use(`${API}/orders`,    ordersRoutes);
app.use(`${API}/hr`,        hrRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}`,           adminRoutes);    // /admin/*, /referral/*

// ── SPA fallback — all non-API routes serve index.html ────────────────────
if (hasFrontend) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// ── 404 for unknown API routes ────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
