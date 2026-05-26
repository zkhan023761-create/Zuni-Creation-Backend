import mongoose, { Schema } from 'mongoose';

const testimonialSchema = new Schema(
  {
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true },
    image: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Testimonial', testimonialSchema);
