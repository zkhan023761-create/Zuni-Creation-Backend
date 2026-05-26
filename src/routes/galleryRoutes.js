import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import Gallery from '../models/Gallery.js';
import { auth, adminOnly } from '../middleware/auth.js';

// Configure cloudinary using credentials in .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const router = express.Router();

// Admin: upload image to Cloudinary
router.post('/upload', auth, adminOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'zunii-gallery' },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({ message: 'Failed to upload image' });
        }
        res.json({ imageUrl: result.secure_url });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (error) {
    console.error('Server upload handler error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: get active gallery items
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category, isActive: true } : { isActive: true };
    const gallery = await Gallery.find(filter).sort({ createdAt: -1 });
    res.json(gallery);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: get categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Gallery.distinct('category', { isActive: true });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: get all gallery items
router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const gallery = await Gallery.find().sort({ createdAt: -1 });
    res.json(gallery);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const item = await Gallery.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const item = await Gallery.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const item = await Gallery.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
