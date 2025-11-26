const express = require('express');
const multer = require('multer');
const path = require('path');
const WritingPaper = require('../models/WritingPaper');

const router = express.Router();

// Multer configuration for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for images
  }
});

// Get all writing papers
router.get('/', async (req, res) => {
  try {
    const papers = await WritingPaper.find({}).sort({ createdAt: -1 });
    res.status(200).json({ papers });
  } catch (error) {
    console.error('Get writing papers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific writing paper
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await WritingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    res.status(200).json({ paper });
  } catch (error) {
    console.error('Get writing paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start writing exam for a student
router.post('/:id/start-exam', async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, assignmentId } = req.body;

    if (!studentId || !assignmentId) {
      return res.status(400).json({ error: 'studentId and assignmentId are required' });
    }

    const paper = await WritingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Writing paper not found' });
    }

    // Here you could add additional validation for student access
    // For now, just return the paper (access control is handled at assignment level)

    res.status(200).json({
      message: 'Writing exam started successfully',
      paper,
      examStarted: true,
      startedAt: new Date()
    });
  } catch (error) {
    console.error('Start writing exam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new writing paper
router.post('/', async (req, res) => {
  try {
    const { title, description, tasks, estimatedTime, createdBy } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ error: 'Title and createdBy are required' });
    }

    const paper = new WritingPaper({
      title,
      description,
      tasks: tasks || [],
      estimatedTime: estimatedTime || 60,
      createdBy
    });

    await paper.save();
    res.status(201).json({ message: 'Paper created successfully', paper });
  } catch (error) {
    console.error('Create writing paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update writing paper
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const paper = await WritingPaper.findByIdAndUpdate(id, updates, { new: true });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.status(200).json({ message: 'Paper updated successfully', paper });
  } catch (error) {
    console.error('Update writing paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete writing paper
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await WritingPaper.findByIdAndDelete(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.status(200).json({ message: 'Paper deleted successfully' });
  } catch (error) {
    console.error('Delete writing paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload image for writing paper task
router.post('/:id/upload-image', uploadImage.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { taskNumber } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    };

    const paper = await WritingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const taskIdx = parseInt(taskNumber) - 1;
    if (!paper.tasks[taskIdx]) {
      paper.tasks[taskIdx] = { images: [] };
    }

    if (!paper.tasks[taskIdx].images) {
      paper.tasks[taskIdx].images = [];
    }

    paper.tasks[taskIdx].images.push(imageData);
    await paper.save();

    res.status(200).json({
      message: 'Image uploaded successfully',
      paper,
      imageUrl: req.file.path,
      imageData
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;