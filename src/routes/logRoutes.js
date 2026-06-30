import express from 'express';
import SecurityLog from '../models/SecurityLog.js';
import ActivityLog from '../models/ActivityLog.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// ── GET Security Logs ───────────────────────────────────────────────────────
router.get('/security', auth, adminOnly, async (req, res) => {
  try {
    const logs = await SecurityLog.find().sort({ createdAt: -1 }).limit(200);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch security logs' });
  }
});

// ── GET Activity Logs ───────────────────────────────────────────────────────
router.get('/activity', auth, adminOnly, async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(200);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch activity logs' });
  }
});

// ── GET Activity Stats — last 7 days breakdown for bar chart ────────────────
router.get('/activity-stats', auth, adminOnly, async (req, res) => {
  try {
    const days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const logs = await ActivityLog.find({
        createdAt: { $gte: date, $lt: nextDate },
      }).lean();

      const secLogs = await SecurityLog.find({
        createdAt: { $gte: date, $lt: nextDate },
      }).lean();

      days.push({
        label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        bookings: logs.filter(l => ['booking_created', 'booking_status_changed'].includes(l.action)).length,
        services: logs.filter(l => ['service_added', 'service_updated', 'service_deleted'].includes(l.action)).length,
        gallery:  logs.filter(l => ['gallery_added', 'gallery_deleted'].includes(l.action)).length,
        security: logs.filter(l => ['password_changed', 'admin_profile_updated', 'user_password_changed', 'user_registered', 'user_profile_updated'].includes(l.action)).length
                + secLogs.filter(l => ['profile_updated', 'password_changed'].includes(l.action)).length,
      });
    }

    // Totals for stats cards
    const allActivity = await ActivityLog.find().lean();
    const allSecurity = await SecurityLog.find().lean();
    const totals = {
      total:    allActivity.length,
      bookings: allActivity.filter(l => ['booking_created', 'booking_status_changed'].includes(l.action)).length,
      services: allActivity.filter(l => ['service_added', 'service_updated', 'service_deleted'].includes(l.action)).length,
      gallery:  allActivity.filter(l => ['gallery_added', 'gallery_deleted'].includes(l.action)).length,
      security: allActivity.filter(l => ['password_changed', 'admin_profile_updated', 'user_password_changed', 'user_registered', 'user_profile_updated'].includes(l.action)).length
              + allSecurity.length,
      loginSuccess: allSecurity.filter(l => l.action === 'login' && l.status === 'success').length,
      loginFailed:  allSecurity.filter(l => l.action === 'login' && l.status === 'failed').length,
    };

    res.json({ days, totals });
  } catch (error) {
    console.error('activity-stats error:', error);
    res.status(500).json({ message: 'Failed to fetch activity stats' });
  }
});

export default router;
