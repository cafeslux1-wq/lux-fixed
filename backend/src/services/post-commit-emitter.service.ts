import { logger } from '../utils/logger';
import { emitToBranch, emitToKDS, emitToPOS, emitToOwner, emitToCustomer, emitToTracking } from './socket.service';

type EmissionTarget =
  | { room: 'branch';   tenantId: string; branchId: string }
  | { room: 'kds';      tenantId: string; branchId: string }
  | { room: 'pos';      tenantId: string; branchId: string }
  | { room: 'owner';    tenantId: string }
  | { room: 'customer'; tenantId: string; recipientId: string }
  | { room: 'tracking'; orderId: string };

interface QueuedEmission { target: EmissionTarget; event: string; payload: unknown }

export interface PostCommitEmitter {
  queue(event: string, target: EmissionTarget, payload: unknown): void;
  flush(): void;
  discard(): void;
  readonly size: number;
}

export function createPostCommitEmitter(): PostCommitEmitter {
  const queue: QueuedEmission[] = [];
  let flushed = false;
  return {
    queue(event, target, payload) {
      if (flushed) { logger.warn('[PostCommitEmitter] queue() after flush() — ignored'); return; }
      queue.push({ target, event, payload });
    },
    flush() {
      if (flushed) return;
      flushed = true;
      for (const { target, event, payload } of queue) {
        try {
          switch (target.room) {
            case 'branch':   emitToBranch(target.tenantId, target.branchId, event, payload); break;
            case 'kds':      emitToKDS(target.tenantId, target.branchId, event, payload); break;
            case 'pos':      emitToPOS(target.tenantId, target.branchId, event, payload); break;
            case 'owner':    emitToOwner(target.tenantId, event, payload); break;
            case 'customer': emitToCustomer(target.tenantId, target.recipientId, event, payload); break;
            case 'tracking': emitToTracking(target.orderId, event, payload); break;
          }
        } catch (err) {
          logger.error('[PostCommitEmitter] Emission failed:', { event, error: (err as Error).message });
        }
      }
      logger.debug(`[PostCommitEmitter] Flushed ${queue.length} event(s)`);
    },
    discard() { queue.length = 0; flushed = true; logger.debug('[PostCommitEmitter] Discarded'); },
    get size() { return queue.length; },
  };
}
