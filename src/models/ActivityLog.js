import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  user: {
    type: String, // e.g., "System" or Admin name
    default: 'System',
  },
  action: {
    type: String,
    required: true,
    enum: ['booking_created', 'booking_status_changed', 'service_added', 'service_updated', 'service_deleted', 'gallery_added', 'gallery_deleted', 'password_changed', 'admin_profile_updated', 'user_password_changed', 'user_registered', 'user_profile_updated'],
  },
  details: {
    type: String,
    required: true,
  },
}, { timestamps: true });

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
