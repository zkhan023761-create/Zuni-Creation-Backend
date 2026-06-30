import express from 'express';
import SecurityLog from '../models/SecurityLog.js';
import ActivityLog from '../models/ActivityLog.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// ── GET Security Logs ───────────────────────────────────────────────────────
router.get('/security', auth, adminOnly, async (req, res) => {
  try {
    const logs = await SecurityLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch security logs' });
  }
});

// ── GET Activity Logs ───────────────────────────────────────────────────────
router.get('/activity', auth, adminOnly, async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch activity logs' });
  }
});

export default router;
