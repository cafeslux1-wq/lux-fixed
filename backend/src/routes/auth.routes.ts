import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate';
import { requireStaffAuth } from '../middleware/enterprise.middleware';
import {
  loginWithPassword,
  loginWithPin,
  getBranchStaffList,
  logout,
  getMe,
  changePin,
} from '../controllers/auth.controller';

const router = Router();

// ── PUBLIC — No JWT required ──────────────────────────────────────────────

// Get staff list for PIN login screen (called by POS on startup)
router.get(
  '/branch/:branchId',
  getBranchStaffList
);

// Login with PIN (POS tablet)
router.post(
  '/pin',
  validate(Joi.object({
    staffId:  Joi.string().uuid().required(),
    pin:      Joi.string().min(4).max(8).required(),
    branchId: Joi.string().uuid().required(),
  })),
  loginWithPin
);

// Login with password (manager / web)
router.post(
  '/login',
  validate(Joi.object({
    phone:    Joi.string().required(),
    password: Joi.string().required(),
  })),
  loginWithPassword
);

// ── AUTHENTICATED — JWT required ─────────────────────────────────────────
router.use(requireStaffAuth);

router.get('/me', getMe);
router.post('/logout', logout);
router.post(
  '/change-pin',
  validate(Joi.object({
    currentPin: Joi.string().min(4).max(8).required(),
    newPin:     Joi.string().min(4).max(8).required(),
  })),
  changePin
);

export default router;
