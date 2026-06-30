import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['login', 'logout', 'password_reset_request', 'password_reset_success', 'profile_updated', 'password_changed', 'password_change_failed'],
  },
  status: {
    type: String,
    required: true,
    enum: ['success', 'failed'],
  },
  ip: {
    type: String,
    default: 'Unknown',
  },
  details: {
    type: String,
    default: '',
  }
}, { timestamps: true });

export default mongoose.models.SecurityLog || mongoose.model('SecurityLog', securityLogSchema);
