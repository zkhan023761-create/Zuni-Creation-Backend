import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema(
  {
    name:       { type: String, required: true },
    email:      { type: String, required: true, unique: true },
    phone:      { type: String },
    password:   { type: String, required: true },
    role:       { type: String, enum: ['admin', 'user'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    emoji:      { type: String, default: '🌸' },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
