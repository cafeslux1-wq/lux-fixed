/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Enterprise Real-Time Hub (Socket.io v2)
 *  Strict tenant:branch room isolation
 *
 *  Room naming convention:
 *    tenant:{tenantId}:branch:{branchId}         → All branch staff
 *    tenant:{tenantId}:branch:{branchId}:kds     → Kitchen Display only
 *    tenant:{tenantId}:branch:{branchId}:pos     → POS screens only
 *    tenant:{tenantId}:owner                     → Owner dashboard (all branches)
 *    tenant:{tenantId}:driver:{staffId}           → Individual driver
 *    customer:{tenantId}:{customerId}             → Customer app
 *    order:track:{orderId}                        → Public tracking
 * ══════════════════════════════════════════════════════════
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { getPermissionsForRole, PERMISSIONS } from '../types/permissions';
import type { StaffJWTPayload, CustomerJWTPayload } from '../middleware/enterprise.middleware';

export let io: Server;

// ── Room name builders ────────────────────────────────────────────────────
export const Rooms = {
  branch:    (tId: string, bId: string)             => `tenant:${tId}:branch:${bId}`,
  kds:       (tId: string, bId: string)             => `tenant:${tId}:branch:${bId}:kds`,
  pos:       (tId: string, bId: string)             => `tenant:${tId}:branch:${bId}:pos`,
  owner:     (tId: string)                          => `tenant:${tId}:owner`,
  driver:    (tId: string, dId: string)             => `tenant:${tId}:driver:${dId}`,
  customer:  (tId: string, cId: string)             => `customer:${tId}:${cId}`,
  tracking:  (orderId: string)                      => `order:track:${orderId}`,
  allTenant: (tId: string)                          => `tenant:${tId}`,
};

// ── Typed emission helpers ────────────────────────────────────────────────
export function emitToBranch(tenantId: string, branchId: string, event: string, data: unknown): void {
  io?.to(Rooms.branch(tenantId, branchId)).emit(event, data);
}

export function emitToKDS(tenantId: string, branchId: string, event: string, data: unknown): void {
  io?.to(Rooms.kds(tenantId, branchId)).emit(event, data);
}

export function emitToPOS(tenantId: string, branchId: string, event: string, data: unknown): void {
  io?.to(Rooms.pos(tenantId, branchId)).emit(event, data);
}

export function emitToOwner(tenantId: string, event: string, data: unknown): void {
  io?.to(Rooms.owner(tenantId)).emit(event, data);
}

export function emitToDriver(tenantId: string, driverId: string, event: string, data: unknown): void {
  io?.to(Rooms.driver(tenantId, driverId)).emit(event, data);
}

export function emitToCustomer(tenantId: string, customerId: string, event: string, data: unknown): void {
  io?.to(Rooms.customer(tenantId, customerId)).emit(event, data);
}

export function emitToTracking(orderId: string, event: string, data: unknown): void {
  io?.to(Rooms.tracking(orderId)).emit(event, data);
}

// ── Authenticated socket ──────────────────────────────────────────────────
interface LuxSocket extends Socket {
  tenantId?:    string;
  branchId?:    string;
  userId?:      string;
  userType?:    'staff' | 'customer' | 'kds_display';
  role?:        string;
  permissions?: string[];
}

// ════════════════════════════════════════════════════════════════════════
//  INIT SOCKET.IO
// ════════════════════════════════════════════════════════════════════════
export function initSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin:      (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    transports:       ['websocket', 'polling'],
    pingTimeout:      30000,
    pingInterval:     10000,
    maxHttpBufferSize: 1e6, // 1MB max message
  });

  // ── JWT Authentication Middleware ───────────────────────────────────────
  io.use(async (socket: LuxSocket, next) => {
    const token = socket.handshake.auth?.token ||
                  (socket.handshake.headers.authorization || '').replace('Bearer ', '');

    // KDS display mode — no auth needed but needs branch context
    const role      = socket.handshake.query?.role as string;
    const branchId  = socket.handshake.query?.branchId as string;
    const tenantId  = socket.handshake.query?.tenantId as string;

    if (role === 'kds_display' && branchId && tenantId) {
      // Validate branch + tenant exist
      const check = await query<{ id: string }>(
        `SELECT id FROM branches WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
        [branchId, tenantId]
      ).catch(() => ({ rows: [] }));

      if (!check.rows.length) {
        return next(new Error('Invalid branch for KDS display'));
      }
      socket.tenantId  = tenantId;
      socket.branchId  = branchId;
      socket.userType  = 'kds_display';
      return next();
    }

    if (!token) return next(new Error('Authentication token required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as
        StaffJWTPayload | CustomerJWTPayload;

      if (decoded.type === 'staff') {
        const staff = decoded as StaffJWTPayload;
        // Verify staff is still active
        const staffCheck = await query<{ status: string }>(
          `SELECT status FROM staff WHERE id = $1`,
          [staff.sub]
        );
        if (!staffCheck.rows.length || staffCheck.rows[0].status === 'terminated') {
          return next(new Error('Staff account inactive'));
        }
        socket.tenantId    = staff.tenantId;
        socket.branchId    = staff.branchId;
        socket.userId      = staff.sub;
        socket.role        = staff.role;
        socket.userType    = 'staff';
        socket.permissions = staff.permissions || getPermissionsForRole(staff.role).map(String);

      } else if (decoded.type === 'customer') {
        const cust = decoded as CustomerJWTPayload;
        socket.tenantId  = cust.tenantId;
        socket.userId    = cust.sub;
        socket.userType  = 'customer';
        socket.permissions = [];
      }

      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(new Error('Token expired'));
      }
      next(new Error('Invalid token'));
    }
  });

  // ── Connection Handler ──────────────────────────────────────────────────
  io.on('connection', (socket: LuxSocket) => {
    const { tenantId, branchId, userId, role, userType } = socket;

    logger.info(`🔌 Socket connected: ${socket.id} [${userType}/${role || '?'}] tenant:${tenantId} branch:${branchId}`);

    // ── Auto-join rooms based on user type ──────────────────────────────
    if (tenantId && branchId) {
      // All branch staff join the branch room
      socket.join(Rooms.branch(tenantId, branchId));

      // Kitchen staff join the KDS room
      if (['cook', 'patissier', 'barista'].includes(role || '') || userType === 'kds_display') {
        socket.join(Rooms.kds(tenantId, branchId));
      }

      // Cashiers join the POS room
      if (['cashier', 'manager', 'owner'].includes(role || '')) {
        socket.join(Rooms.pos(tenantId, branchId));
      }
    }

    // Owner joins the owner room (all branches visibility)
    if (role === 'owner' && tenantId) {
      socket.join(Rooms.owner(tenantId));
      socket.join(Rooms.allTenant(tenantId));
    }

    // Manager joins owner room too for alerts
    if (role === 'manager' && tenantId) {
      socket.join(Rooms.owner(tenantId));
    }

    // Driver gets their personal room
    if (role === 'driver' && tenantId && userId) {
      socket.join(Rooms.driver(tenantId, userId));
      if (branchId) socket.join(Rooms.branch(tenantId, branchId));
    }

    // Customer gets their personal room
    if (userType === 'customer' && tenantId && userId) {
      socket.join(Rooms.customer(tenantId, userId));
    }

    // ── Client Events ───────────────────────────────────────────────────

    // Customer subscribes to live order tracking
    socket.on('track:subscribe', (orderId: string) => {
      socket.join(Rooms.tracking(orderId));
      logger.debug(`📡 ${socket.id} subscribed to tracking: ${orderId}`);
    });

    socket.on('track:unsubscribe', (orderId: string) => {
      socket.leave(Rooms.tracking(orderId));
    });

    // Driver sends GPS location
    socket.on('driver:location', async (data: {
      orderId?: string; lat: number; lng: number; speed?: number; heading?: number;
    }) => {
      if (socket.userType !== 'staff' || socket.role !== 'driver') return;
      if (!tenantId || !userId) return;

      // Validate lat/lng
      if (Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180) return;

      // Persist to DB
      storeDriverLocation(userId, tenantId, data).catch(() => {});

      // Broadcast to tracking subscribers and branch dispatchers
      const payload = {
        driverId:  userId,
        orderId:   data.orderId,
        latitude:  data.lat,
        longitude: data.lng,
        speed:     data.speed || 0,
        heading:   data.heading,
        timestamp: new Date().toISOString(),
      };

      if (data.orderId) {
        emitToTracking(data.orderId, 'courier:location', payload);
      }
      if (tenantId && branchId) {
        emitToBranch(tenantId, branchId, 'driver:location', payload);
      }
    });

    // KDS acknowledges order
    socket.on('kds:ack', (orderId: string) => {
      if (!tenantId || !branchId) return;
      emitToBranch(tenantId, branchId, 'kds:acknowledged', {
        orderId,
        by: userId,
        at: new Date().toISOString(),
      });
    });

    // POS requests KDS refresh
    socket.on('kds:refresh_request', () => {
      if (!tenantId || !branchId) return;
      emitToKDS(tenantId, branchId, 'kds:refresh', {});
    });

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Socket disconnected: ${socket.id} — ${reason}`);
      // Driver going offline
      if (role === 'driver' && tenantId && branchId) {
        emitToBranch(tenantId, branchId, 'driver:offline', { driverId: userId });
      }
    });

    // Confirm successful connection
    socket.emit('connected', {
      socketId:  socket.id,
      rooms:     [...socket.rooms].filter(r => r !== socket.id), // don't expose socket ID room
      server:    'LUX Supreme Intelligence v3.0',
      timestamp: new Date().toISOString(),
    });
  });

  logger.info('🔌 Enterprise Socket.io Hub initialized');
  return io;
}

// ── Async: store driver GPS to DB ─────────────────────────────────────────
async function storeDriverLocation(
  driverId: string,
  tenantId: string,
  data: { orderId?: string; lat: number; lng: number; speed?: number }
): Promise<void> {
  await Promise.all([
    query(`
      INSERT INTO driver_locations (driver_id, order_id, latitude, longitude, speed_kmh)
      VALUES ($1, $2, $3, $4, $5)
    `, [driverId, data.orderId || null, data.lat, data.lng, data.speed || null]),
    query(
      `UPDATE staff SET current_lat = $1, current_lng = $2 WHERE id = $3`,
      [data.lat, data.lng, driverId]
    ),
  ]);
}

// Alias for backward compatibility
export function initSocket(socketIo: Server): void {
  io = socketIo;
  socketIo.on('connection', (socket) => {
    const token = socket.handshake.auth?.token as string;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(token, process.env.JWT_SECRET || '') as { tenantId: string; branchId: string; sub: string; role: string };
        const tenantRoom = `tenant:${payload.tenantId}`;
        const branchRoom = `tenant:${payload.tenantId}:branch:${payload.branchId}`;
        socket.join([tenantRoom, branchRoom, `${branchRoom}:pos`, `${branchRoom}:kds`, `tenant:${payload.tenantId}:owner`]);
      } catch { socket.disconnect(true); }
    }
  });
}
