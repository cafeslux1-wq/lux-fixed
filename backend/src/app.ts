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

// ✅ FIX: Trust Railway's reverse proxy (fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

const FRONTEND_DIST = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
const hasFrontend = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
console.log(`[App] Frontend dist: ${FRONTEND_DIST} (exists: ${hasFrontend})`);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(`${API}/billing/webhook`, express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit — now works correctly with trust proxy
app.use(rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use((req: any, _res: express.Response, next: express.NextFunction) => {
  req.requestId = `lux-${uuidv4().slice(0, 12)}`;
  next();
});

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  ts: new Date().toISOString(),
  frontend: hasFrontend ? `found at ${FRONTEND_DIST}` : `NOT FOUND`,
}));

if (hasFrontend) {
  app.use('/assets', express.static(path.join(FRONTEND_DIST, 'assets'), {
    maxAge: '1y', immutable: true,
  }));
  app.use(express.static(FRONTEND_DIST, { index: false }));
  console.log(`[App] Serving static files from ${FRONTEND_DIST}`);
}

app.use(`${API}/auth/staff`, authRoutes);
app.use(`${API}/billing`,    billingRoutes);
app.use(`${API}/menu`,       menuRoutes);

app.use(`${API}`, requireStaffAuth);
app.use(`${API}`, checkSubscription);
app.use(`${API}/orders`,    ordersRoutes);
app.use(`${API}/hr`,        hrRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}`,           adminRoutes);

if (hasFrontend) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (/\.[a-zA-Z0-9]{1,10}$/.test(req.path)) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[App] Error:', err.message);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
