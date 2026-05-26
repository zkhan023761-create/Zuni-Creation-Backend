import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema(
  {
    name:       { type: String, required: true },
    email:      { type: String, required: true, unique: true },
    password:   { type: String, required: true },
    role:       { type: String, enum: ['admin', 'user'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    emoji:      { type: String, default: '🌸' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 14); // 14 rounds — strong & secure
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
