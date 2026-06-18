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

import { authLimiter, apiLimiter, formLimiter, userLimiter } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────────────────────

const allowedOrigins = [
  'http://localhost:3000',
  'https://zunii-creation.vercel.app',
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general limiter to all API routes
app.use('/api', apiLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────

// Apply specific limiters to route groupings
app.use('/api/auth', authRoutes);
app.use('/api/users', userLimiter, userRoutes);

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
