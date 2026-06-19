import dotenv from 'dotenv';
dotenv.config();

import { sendConfirmationEmail } from './src/services/notificationService.js';

const mockBooking = {
  customerName: 'Zaid Khan',
  email: 'zkhan023761@gmail.com',
  preferredDate: new Date('2206-11-11'),
  occasion: 'Test',
  designStyle: 'Test',
  numberOfPeople: 1,
  address: 'Mumbai',
  city: 'Mumbai Suburban'
};

async function test() {
  try {
    await sendConfirmationEmail(mockBooking);
    console.log('Test completed successfully');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
