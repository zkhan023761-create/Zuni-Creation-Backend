import mongoose, { Schema } from 'mongoose';

const bookingSchema = new Schema(
  {
    customerName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    zipCode: { type: String },
    occasion: { type: String },
    designStyle: { type: String },
    service: { type: Schema.Types.ObjectId, ref: 'Service' },
    preferredDate: { type: Date, required: true },
    numberOfPeople: { type: Number, required: true, min: 1 },
    specialRequests: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Booking', bookingSchema);
