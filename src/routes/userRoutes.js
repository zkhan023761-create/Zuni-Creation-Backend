import express from 'express';
import { auth, userOnly } from '../middleware/auth.js';
import {
  register,
  verifyOtp,
  loginPassword,
  sendLoginOtp,
  loginOtp,
  refresh,
  me,
  myBookings,
  sendResetOtp,
  resetPassword,
  updateEmoji,
} from '../controllers/userController.js';

import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes
router.post('/register',         authLimiter, register);
router.post('/verify-otp',       authLimiter, verifyOtp);
router.post('/login-password',   authLimiter, loginPassword);
router.post('/send-login-otp',   authLimiter, sendLoginOtp);
router.post('/login-otp',        authLimiter, loginOtp);
router.post('/refresh',          authLimiter, refresh);
router.post('/send-reset-otp',   authLimiter, sendResetOtp);
router.post('/reset-password',   authLimiter, resetPassword);

// Protected routes (customer only)
router.get('/me',          auth, userOnly, me);
router.get('/my-bookings', auth, userOnly, myBookings);

// Protected routes (both customers and admin)
router.put('/profile/emoji', auth, updateEmoji);

export default router;
