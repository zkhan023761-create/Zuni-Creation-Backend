import mongoose, { Schema } from 'mongoose';

const otpSchema = new Schema({
  email:     { type: String, required: true },
  hashedOtp: { type: String, required: true },
  purpose:   { type: String, enum: ['registration', 'login', 'password_reset'], required: true },
  expiresAt: { type: Date,   required: true },
  createdAt: { type: Date,   default: Date.now, expires: 600 }, // TTL: auto-delete after 10 min
});

// Compound index for fast lookup per (email, purpose)
otpSchema.index({ email: 1, purpose: 1 });

export default mongoose.model('OTP', otpSchema);
