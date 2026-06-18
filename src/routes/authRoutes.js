import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { sendOtp, validateOtp } from '../services/otpService.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = express.Router();

const ACCESS_EXPIRY  = '15m';
const REFRESH_EXPIRY = '7d';

function generateAccessToken(id, email, role) {
  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET || 'defaultsecret',
    { expiresIn: ACCESS_EXPIRY }
  );
}

function generateRefreshToken(id) {
  return jwt.sign(
    { id },
    process.env.REFRESH_TOKEN_SECRET || 'refreshsecret',
    { expiresIn: REFRESH_EXPIRY }
  );
}

// ── Register ───────────────────────────────────────────────────────────────
router.post(
  '/register',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { name, email, password } = req.body;
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Email already exists' });
      const user = await User.create({ name, email, password, role: 'admin' });
      const accessToken  = generateAccessToken(user._id.toString(), user.email, user.role);
      const refreshToken = generateRefreshToken(user._id.toString());
      res.status(201).json({
        token: accessToken,
        refreshToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, emoji: user.emoji },
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ── Login ──────────────────────────────────────────────────────────────────
router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
      const accessToken  = generateAccessToken(user._id.toString(), user.email, user.role);
      const refreshToken = generateRefreshToken(user._id.toString());
      res.json({
        token: accessToken,
        refreshToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, emoji: user.emoji },
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ── Google Login ───────────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential is required' });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      // Create a new user with a random password since they use Google
      const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      user = await User.create({ name, email, password: randomPassword, role: 'user', isVerified: true });
    }

    const accessToken  = generateAccessToken(user._id.toString(), user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString());
    
    res.json({
      token: accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, emoji: user.emoji },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

// ── Refresh access token ───────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || 'refreshsecret'
    );
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });

    const newAccessToken = generateAccessToken(user._id.toString(), user.email, user.role);
    res.json({ token: newAccessToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// ── Me ─────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// ── Send admin password-reset OTP ──────────────────────────────────────────
router.post('/send-reset-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    await sendOtp(email, 'password_reset', user.name);
    res.status(202).json({ message: 'Password reset OTP sent to your email' });
  } catch (err) {
    console.error('admin sendResetOtp error:', err.message);
    if (err.message.includes('Email service'))
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Reset admin password with OTP ──────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    await validateOtp(email, otp, 'password_reset');

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Account not found' });

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    const codeMap = {
      OTP_NOT_FOUND: [400, 'OTP not found or already used'],
      OTP_EXPIRED:   [400, 'OTP has expired'],
      OTP_INVALID:   [400, 'Invalid OTP'],
    };
    const [status, message] = codeMap[err.code] || [500, 'Server error'];
    res.status(status).json({ message });
  }
});

// ── List all registered users with booking counts (admin only) ─────────────
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;

    const users = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Attach booking counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const [total, pending, confirmed, completed, cancelled] = await Promise.all([
          Booking.countDocuments({ email: user.email }),
          Booking.countDocuments({ email: user.email, status: 'pending' }),
          Booking.countDocuments({ email: user.email, status: 'confirmed' }),
          Booking.countDocuments({ email: user.email, status: 'completed' }),
          Booking.countDocuments({ email: user.email, status: 'cancelled' }),
        ]);
        return { ...user, bookings: { total, pending, confirmed, completed, cancelled } };
      })
    );

    res.json(usersWithStats);
  } catch (err) {
    console.error('admin getUsers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
