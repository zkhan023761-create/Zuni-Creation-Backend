import express from 'express';
import Booking from '../models/Booking.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { sendConfirmationEmail, buildWhatsAppMessage, sendCompletionEmail, buildCompletionWhatsAppMessage } from '../services/notificationService.js';

const router = express.Router();

// Admin: get all bookings
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find().populate('service').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: create booking
router.post('/', async (req, res) => {
  try {
    const booking = await Booking.create(req.body);
    res.status(201).json(booking);
  } catch (error) {
    console.error('Booking create error:', error.message);
    if (error.name === 'ValidationError') {
      // Return the first missing/invalid field message
      const msg = Object.values(error.errors)[0]?.message || 'Validation failed';
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// Admin: update booking status — sends notifications when status → 'confirmed'
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const prevBooking = await Booking.findById(req.params.id);
    if (!prevBooking) return res.status(404).json({ message: 'Booking not found' });

    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Determine what just changed
    const isNowConfirmed  = req.body.status === 'confirmed'  && prevBooking.status !== 'confirmed';
    const isNowCompleted  = req.body.status === 'completed'  && prevBooking.status !== 'completed';

    const customerPhone = booking.phone?.replace(/\D/g, '');
    const phoneWithCode = customerPhone
      ? (customerPhone.startsWith('91') ? customerPhone : '91' + customerPhone)
      : null;

    if (isNowConfirmed) {
      // 1. Send confirmation email (non-blocking)
      sendConfirmationEmail(booking).catch((err) =>
        console.error('Email send failed:', err.message)
      );

      // 2. Build WhatsApp deep-link for admin to send manually
      const waText = buildWhatsAppMessage(booking);
      const waLink = phoneWithCode
        ? `https://wa.me/${phoneWithCode}?text=${waText}`
        : null;

      return res.json({ ...booking.toObject(), whatsappLink: waLink });
    }

    if (isNowCompleted) {
      // 1. Send thank-you / completion email (non-blocking)
      sendCompletionEmail(booking).catch((err) =>
        console.error('Completion email send failed:', err.message)
      );

      // 2. Build thank-you WhatsApp deep-link for admin to send manually
      const waText = buildCompletionWhatsAppMessage(booking);
      const waLink = phoneWithCode
        ? `https://wa.me/${phoneWithCode}?text=${waText}`
        : null;

      return res.json({ ...booking.toObject(), whatsappLink: waLink, notificationType: 'completed' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Booking update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: delete booking
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Booking deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
