import 'dotenv/config';
import mongoose from 'mongoose';
import Service from '../models/Service.js';

const services = [
  {
    title: 'Bridal Mehndi',
    description: 'Full hand & feet intricate bridal designs with detailed patterns. Perfect for weddings and reception.',
    price: 2999,
    duration: '2-4 hours',
    features: ['Full hand coverage', 'Feet design included', 'Custom bridal pattern', 'Touch-up service'],
    isActive: true,
  },
  {
    title: 'Arabic Mehndi',
    description: 'Elegant Arabic patterns with bold outlines and minimal filling. Perfect for Eid and parties.',
    price: 999,
    duration: '1-2 hours',
    features: ['Modern Arabic style', 'Elegant patterns', 'Quick drying paste', 'Dark stain results'],
    isActive: true,
  },
  {
    title: 'Engagement Mehndi',
    description: 'Beautiful designs perfect for engagement ceremonies. Combines traditional and modern styles.',
    price: 1499,
    duration: '1-2 hours',
    features: ['Custom design', 'Quick application', 'Long-lasting', 'Photo-ready look'],
    isActive: true,
  },
  {
    title: 'Festival Mehndi',
    description: 'Perfect for Diwali, Eid, Navratri celebrations. Trendy designs at affordable prices.',
    price: 499,
    duration: '30-60 mins',
    features: ['Festival special designs', 'Affordable rates', 'Fast application', 'Community discounts'],
    isActive: true,
  },
  {
    title: 'Group Bookings',
    description: 'Planning a mehndi party? Get special rates for groups of 5 or more!',
    price: 0,
    duration: 'Varies',
    features: ['Special group rates', 'Multiple designs', 'Flexible timing', 'Coordination support'],
    isActive: true,
  },
  {
    title: 'Kids Mehndi',
    description: 'Fun, simple, and safe mehndi designs for kids. Non-chemical, skin-friendly paste.',
    price: 299,
    duration: '15-30 mins',
    features: ['Kid-friendly designs', 'Safe ingredients', 'Quick session', 'Fun patterns'],
    isActive: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    await Service.deleteMany({});
    console.log('🗑️  Cleared existing services');

    const inserted = await Service.insertMany(services);
    console.log(`✅ Inserted ${inserted.length} services:`);
    inserted.forEach(s => console.log(`   - ${s.title} (₹${s.price || 'Contact for quote'})`));

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
