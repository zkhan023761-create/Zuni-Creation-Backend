import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { sendOtp, validateOtp } from '../services/otpService.js';

const ACCESS_EXPIRY  = '15m';
const REFRESH_EXPIRY = '7d';

function generateAccessToken(id, email, role) {
  return jwt.sign({ id, email, role }, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: ACCESS_EXPIRY });
}

function generateRefreshToken(id) {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET || 'refreshsecret', { expiresIn: REFRESH_EXPIRY });
}

function tokenPair(user) {
  return {
    accessToken:  generateAccessToken(user._id.toString(), user.email, user.role),
    refreshToken: generateRefreshToken(user._id.toString()),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, emoji: user.emoji },
  };
}

// ── POST /api/users/register ───────────────────────────────────────────────
export async function register(req, res) {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email });
    if (existing?.isVerified)
      return res.status(409).json({ message: 'Email already registered' });

    // Remove any unverified account with same email (allow re-registration)
    if (existing && !existing.isVerified) await User.deleteOne({ _id: existing._id });

    // Create unverified user
    const hashedPassword = await bcrypt.hash(password, 14);
    await User.create({ name, email, phone, password: hashedPassword, role: 'user', isVerified: false });

    await sendOtp(email, 'registration', name);
    res.status(202).json({ message: 'OTP sent to your email. Please verify to complete registration.' });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

// ── POST /api/users/verify-otp ─────────────────────────────────────────────
export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    await validateOtp(email, otp, 'registration');

    const user = await User.findOneAndUpdate(
      { email, role: 'user' },
      { isVerified: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'Account not found' });

    res.status(201).json(tokenPair(user));
  } catch (err) {
    const codeMap = {
      OTP_NOT_FOUND: [400, 'OTP not found or already used'],
      OTP_EXPIRED:   [400, 'OTP has expired'],
      OTP_INVALID:   [400, 'Invalid OTP'],
    };
    const [status, message] = codeMap[err.code] || [500, 'Server error'];
    res.status(status).json({ message });
  }
}

// ── POST /api/users/login-password ────────────────────────────────────────
export async function loginPassword(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email, role: 'user', isVerified: true });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    res.json(tokenPair(user));
  } catch (err) {
    console.error('loginPassword error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ── POST /api/users/send-login-otp ────────────────────────────────────────
export async function sendLoginOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email, role: 'user', isVerified: true });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    await sendOtp(email, 'login', user.name);
    res.status(202).json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('sendLoginOtp error:', err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}

// ── POST /api/users/login-otp ─────────────────────────────────────────────
export async function loginOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email, role: 'user', isVerified: true });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    await validateOtp(email, otp, 'login');
    res.json(tokenPair(user));
  } catch (err) {
    const codeMap = {
      OTP_NOT_FOUND: [400, 'OTP not found or already used'],
      OTP_EXPIRED:   [400, 'OTP has expired'],
      OTP_INVALID:   [400, 'Invalid OTP'],
    };
    const [status, message] = codeMap[err.code] || [500, 'Server error'];
    res.status(status).json({ message });
  }
}

// ── POST /api/users/refresh ───────────────────────────────────────────────
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || 'refreshsecret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.role !== 'user') return res.status(401).json({ message: 'Invalid refresh token' });

    res.json({ accessToken: generateAccessToken(user._id.toString(), user.email, user.role) });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

// ── GET /api/users/me ─────────────────────────────────────────────────────
export async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, emoji: user.emoji });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
}

// ── GET /api/users/my-bookings ────────────────────────────────────────────
export async function myBookings(req, res) {
  try {
    const bookings = await Booking.find({ email: req.user.email })
      .sort({ preferredDate: -1 })
      .lean();
    res.json(bookings);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
}

// ── POST /api/users/send-reset-otp ────────────────────────────────────────
export async function sendResetOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    await sendOtp(email, 'password_reset', user.name);
    res.status(202).json({ message: 'Password reset OTP sent to your email' });
  } catch (err) {
    console.error('sendResetOtp error:', err.message);
    if (err.message.includes('Email service'))
      return res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
    res.status(500).json({ message: 'Server error' });
  }
}

// ── POST /api/users/reset-password ───────────────────────────────────────
export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    await validateOtp(email, otp, 'password_reset');

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Account not found' });

    user.password = await bcrypt.hash(newPassword, 14);
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
}

// ── PUT /api/users/profile/emoji ──────────────────────────────────────────
export async function updateEmoji(req, res) {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'Emoji is required' });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { emoji },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, emoji: user.emoji });
  } catch (err) {
    console.error('updateEmoji error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}
