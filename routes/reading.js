const express = require('express');
const multer = require('multer');
const path = require('path');
const ReadingPaper = require('../models/ReadingPaper');

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

// Get all reading papers
router.get('/', async (req, res) => {
  try {
    const papers = await ReadingPaper.find({}).sort({ createdAt: -1 });
    res.status(200).json({ papers });
  } catch (error) {
    console.error('Get reading papers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific reading paper
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await ReadingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    res.status(200).json({ paper });
  } catch (error) {
    console.error('Get reading paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new reading paper
router.post('/', async (req, res) => {
  try {
    const { title, description, passages, questions, estimatedTime, createdBy } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ error: 'Title and createdBy are required' });
    }

    const paper = new ReadingPaper({
      title,
      description,
      passages: passages || [],
      questions: questions || [],
      estimatedTime: estimatedTime || 60,
      createdBy
    });

    await paper.save();
    res.status(201).json({ message: 'Paper created successfully', paper });
  } catch (error) {
    console.error('Create reading paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update reading paper
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const paper = await ReadingPaper.findByIdAndUpdate(id, updates, { new: true });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.status(200).json({ message: 'Paper updated successfully', paper });
  } catch (error) {
    console.error('Update reading paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete reading paper
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await ReadingPaper.findByIdAndDelete(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.status(200).json({ message: 'Paper deleted successfully' });
  } catch (error) {
    console.error('Delete reading paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload image for reading paper passage
router.post('/:id/upload-image', uploadImage.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { passageIndex } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    };

    const paper = await ReadingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const passageIdx = parseInt(passageIndex) || 0;
    if (!paper.passages[passageIdx]) {
      paper.passages[passageIdx] = { images: [] };
    }

    if (!paper.passages[passageIdx].images) {
      paper.passages[passageIdx].images = [];
    }

    paper.passages[passageIdx].images.push(imageData);
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

// Start reading exam for a student
router.post('/:id/start-exam', async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, assignmentId } = req.body;

    if (!studentId || !assignmentId) {
      return res.status(400).json({ error: 'studentId and assignmentId are required' });
    }

    const paper = await ReadingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Reading paper not found' });
    }

    res.status(200).json({
      message: 'Reading exam started successfully',
      paper,
      examStarted: true,
      startedAt: new Date()
    });
  } catch (error) {
    console.error('Start reading exam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit reading exam results
router.post('/:id/submit-exam', async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, assignmentId, answers, timeSpent } = req.body;

    if (!studentId || !assignmentId) {
      return res.status(400).json({ error: 'studentId and assignmentId are required' });
    }

    const paper = await ReadingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Reading paper not found' });
    }

    res.status(200).json({
      message: 'Reading exam submitted successfully',
      paperId: id,
      studentId,
      assignmentId,
      submittedAt: new Date(),
      answers: answers || [],
      timeSpent: timeSpent || 0
    });
  } catch (error) {
    console.error('Submit reading exam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reading exam status for a student
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, assignmentId } = req.query;

    const paper = await ReadingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Reading paper not found' });
    }

    res.status(200).json({
      paperId: id,
      title: paper.title,
      status: 'available',
      totalPassages: paper.passages ? paper.passages.length : 0,
      totalQuestions: paper.questions ? paper.questions.length : 0,
      estimatedTime: paper.estimatedTime || 60
    });
  } catch (error) {
    console.error('Get reading exam status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;