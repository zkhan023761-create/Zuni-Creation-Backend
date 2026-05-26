/**
 * Migration: Move booking data from Contact collection to Booking collection
 * Run: node src/scripts/migrateContactsToBookings.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import Booking from '../models/Booking.js';

dotenv.config();

function parseMessage(msg) {
  // Format: "Occasion: X | Date: Y | People: Z | Style: A | City: B | Address: C | Notes: D"
  const result = {};
  if (!msg) return result;
  const parts = msg.split(' | ');
  parts.forEach((part) => {
    const idx = part.indexOf(':');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    result[key] = val;
  });
  return result;
}

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const contacts = await Contact.find();
  console.log(`Found ${contacts.length} contact entries`);

  let migrated = 0;
  let skipped = 0;

  for (const contact of contacts) {
    const parsed = parseMessage(contact.message);

    // Only migrate if it looks like a booking (has date/occasion/people)
    if (!parsed['date'] && !parsed['occasion']) {
      console.log(`Skipping non-booking contact: ${contact.name}`);
      skipped++;
      continue;
    }

    // Check if already migrated
    const exists = await Booking.findOne({ email: contact.email, customerName: contact.name });
    if (exists) {
      console.log(`Already migrated: ${contact.name}`);
      skipped++;
      continue;
    }

    const preferredDate = parsed['date'] ? new Date(parsed['date']) : new Date();

    await Booking.create({
      customerName: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      occasion: parsed['occasion'] || 'Other',
      preferredDate: isNaN(preferredDate) ? new Date() : preferredDate,
      numberOfPeople: parseInt(parsed['people']) || 1,
      designStyle: parsed['style'] || '',
      city: parsed['city'] || '',
      address: parsed['address'] || '',
      specialRequests: parsed['notes'] || '',
      status: 'pending',
    });

    console.log(`Migrated: ${contact.name}`);
    migrated++;
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
