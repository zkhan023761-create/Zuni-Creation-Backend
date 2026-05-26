import mongoose, { Schema } from 'mongoose';

const gallerySchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String, required: true },
    category: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Gallery', gallerySchema);
