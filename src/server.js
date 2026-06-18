import 'dotenv/config'; // Load env vars before anything else
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Rate Limiters ──────────────────────────────────────────────────────────

// Strict limiter for auth endpoints (login / register / refresh)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                      // max 10 attempts per window
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter for all other routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,                     // max 200 requests per window
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public form submission limiter (bookings / contact)
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 10,                      // max 10 form submissions per hour per IP
  message: { message: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general limiter to all API routes
app.use('/api', apiLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────

// Auth routes get the strict limiter
app.use('/api/auth',  authLimiter, authRoutes);
app.use('/api/users', authLimiter, userRoutes);

// Public booking creation & contact form get the form limiter (POST only)
// Admin GET/PUT/DELETE on bookings are NOT rate-limited by formLimiter
app.post('/api/bookings', formLimiter);
app.post('/api/contact',  formLimiter);
app.use('/api/bookings', bookingRoutes);
app.use('/api/contact',  contactRoutes);

app.use('/api/services',     serviceRoutes);
app.use('/api/gallery',      galleryRoutes);


app.get('/', (req, res) => {
  res.json({ message: 'Zuniii Creation API is running', version: '1.0.0' });
});

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  connectDB();
});

export default app;
