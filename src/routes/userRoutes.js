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

const router = express.Router();

// Public routes
router.post('/register',         register);
router.post('/verify-otp',       verifyOtp);
router.post('/login-password',   loginPassword);
router.post('/send-login-otp',   sendLoginOtp);
router.post('/login-otp',        loginOtp);
router.post('/refresh',          refresh);
router.post('/send-reset-otp',   sendResetOtp);
router.post('/reset-password',   resetPassword);

// Protected routes (customer only)
router.get('/me',          auth, userOnly, me);
router.get('/my-bookings', auth, userOnly, myBookings);

// Protected routes (both customers and admin)
router.put('/profile/emoji', auth, updateEmoji);

export default router;
