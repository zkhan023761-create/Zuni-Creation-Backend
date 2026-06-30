import 'dotenv/config';
import mongoose from 'mongoose';
import Gallery from '../models/Gallery.js';

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const galleryItems = [
  { id: 1,  src: '/gallery/mehndi 1.jpeg',  title: 'Floral Bridal Full Hands',       category: 'Bridal',      tag: 'Bridal' },
  { id: 2,  src: '/gallery/mehndi 2.jpeg',  title: 'Dark Floral Full Hands',         category: 'Bridal',      tag: 'Bridal' },
  { id: 3,  src: '/gallery/mehndi 3.jpeg',  title: 'Floral Bridal Full Hands',       category: 'Bridal',      tag: 'Bridal' },
  { id: 4,  src: '/gallery/mehndi 4.jpeg',  title: 'Rose Floral Pattern',            category: 'Arabic',      tag: 'Arabic' },
  { id: 5,  src: '/gallery/mehndi 5.jpeg',  title: 'Full Sleeve Bridal',             category: 'Bridal',      tag: 'Bridal' },
  { id: 6,  src: '/gallery/mehndi 6.jpeg',  title: 'Single Hand Floral',             category: 'Arabic',      tag: 'Arabic' },
  { id: 7,  src: '/gallery/mehndi 7.jpeg',  title: 'Heart & Floral Pattern',         category: 'Bridal',      tag: 'Bridal' },
  { id: 8,  src: '/gallery/mehndi 8.jpeg',  title: 'Floral Hibiscus Design',         category: 'Arabic',      tag: 'Arabic' },
  { id: 9,  src: '/gallery/mehndi 9.jpeg',  title: 'Custom OK Initials',             category: 'Bridal',      tag: 'Custom' },
  { id: 10, src: '/gallery/mehndi 10.jpeg', title: 'Full Sleeve Dark Bridal',        category: 'Bridal',      tag: 'Bridal' },
  { id: 11, src: '/gallery/mehndi 11.jpeg', title: 'Floral Vine Design',             category: 'Arabic',      tag: 'Arabic' },
  { id: 12, src: '/gallery/mehndi 12.jpeg', title: 'Mandala Full Hand',              category: 'Bridal',      tag: 'Bridal' },
  { id: 13, src: '/gallery/mehndi 13.jpeg', title: 'OK Initials Bridal',             category: 'Bridal',      tag: 'Custom' },
  { id: 14, src: '/gallery/mehndi 14.jpeg', title: 'Maroon Stain Floral',            category: 'Arabic',      tag: 'Arabic' },
  { id: 15, src: '/gallery/mehndi 15.jpeg', title: 'Full Sleeve Bridal',             category: 'Bridal',      tag: 'Bridal' },
  { id: 16, src: '/gallery/mehndi 16.jpeg', title: 'Bridal Feet Design',             category: 'Feet Mehndi', tag: 'Feet' },
  { id: 17, src: '/gallery/mehndi 17.jpeg', title: 'Happy Karwa Chauth',             category: 'Bridal',      tag: 'Custom' },
  { id: 18, src: '/gallery/mehndi 18.jpeg', title: 'Traditional Story Mehndi',       category: 'Bridal',      tag: 'Bridal' },
  { id: 19, src: '/gallery/mehndi 19.jpeg', title: 'Arabic Geometric Design',        category: 'Arabic',      tag: 'Arabic' },
  { id: 20, src: '/gallery/mehndi 20.jpeg', title: 'Full Sleeve Bridal 2',           category: 'Bridal',      tag: 'Bridal' },
  { id: 21, src: '/gallery/mehndi 21.jpeg', title: 'Rose Floral Palms',              category: 'Arabic',      tag: 'Arabic' },
  { id: 22, src: '/gallery/mehndi 22.jpeg', title: 'Indian Bridal Full Hand',        category: 'Bridal',      tag: 'Bridal' },
  { id: 23, src: '/gallery/mehndi 23.jpeg', title: 'Intricate Bridal Design',        category: 'Bridal',      tag: 'Bridal' },
  { id: 24, src: '/gallery/mehndi 24.jpeg', title: 'Floral Arabic Pattern',          category: 'Arabic',      tag: 'Arabic' },
  { id: 25, src: '/gallery/mehndi 25.jpeg', title: 'Full Coverage Bridal',           category: 'Bridal',      tag: 'Bridal' },
  { id: 26, src: '/gallery/mehndi 26.jpeg', title: 'Bridal Full Sleeve',             category: 'Bridal',      tag: 'Bridal' },
  { id: 27, src: '/gallery/mehndi 27.jpeg', title: 'Floral Engagement Design',       category: 'Bridal',      tag: 'Bridal' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    await Gallery.deleteMany({});
    console.log('🗑️  Cleared existing gallery items');

    const docs = galleryItems.map(item => ({
      title: item.title,
      description: item.title,
      imageUrl: `${BASE_URL}${item.src}`,
      category: item.category,
      isActive: true,
    }));

    const inserted = await Gallery.insertMany(docs);
    console.log(`✅ Inserted ${inserted.length} gallery images:`);
    inserted.forEach(g => console.log(`   [${g.category}] ${g.title}`));

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
