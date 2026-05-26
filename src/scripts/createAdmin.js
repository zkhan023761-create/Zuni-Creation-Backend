import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from backend root
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const ADMIN_NAME = 'Admin';
const ADMIN_EMAIL = 'admin@zuniii.com';
const ADMIN_PASSWORD = 'Admin@123';

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Define User schema inline (avoid circular imports)
    const userSchema = new mongoose.Schema({
      name: String,
      email: { type: String, unique: true },
      password: String,
      role: { type: String, default: 'admin' },
      isVerified: { type: Boolean, default: true },
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Check if admin already exists
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log(`\n✅ Admin already exists: ${ADMIN_EMAIL}`);
      console.log('   If login fails, run this script again to reset the password.\n');

      // Reset password in case it's wrong
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await User.updateOne({ email: ADMIN_EMAIL }, { password: hashed, isVerified: true });
      console.log('✅ Password has been reset to: Admin@123\n');
    } else {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashed,
        role: 'admin',
        isVerified: true,
      });
      console.log('\n✅ Admin account created successfully!');
      console.log(`   Email:    ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}\n`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

createAdmin();
