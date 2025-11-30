const express = require('express');
const multer = require('multer');
const path = require('path');
const ListeningPaper = require('../models/ListeningPaper');
const ListeningResult = require('../models/ListeningResult');
const ExamAssignment = require('../models/ExamAssignment');

const router = express.Router();

// Multer configuration for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/audio/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Get all listening papers
router.get('/', async (req, res) => {
  try {
    const papers = await ListeningPaper.find({}).sort({ createdAt: -1 });
    res.status(200).json({ papers });
  } catch (error) {
    console.error('Get listening papers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific listening paper
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching listening paper for id:', id);
    const paper = await ListeningPaper.findById(id);
    console.log('Paper find result:', paper ? paper._id : 'null');
    if (!paper) {
      console.log('No paper found for id:', id);
      return res.status(404).json({ error: 'Paper not found' });
    }
    console.log('Returning paper:', paper._id);
    res.status(200).json({ paper });
  } catch (error) {
    console.error('Get listening paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start listening exam for a student
router.post('/:id/start-exam', async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, assignmentId } = req.body;

    if (!studentId || !assignmentId) {
      return res.status(400).json({ error: 'studentId and assignmentId are required' });
    }

    const paper = await ListeningPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Listening paper not found' });
    }

    // Here you could add additional validation for student access
    // For now, just return the paper (access control is handled at assignment level)

    res.status(200).json({
      message: 'Listening exam started successfully',
      paper,
      examStarted: true,
      startedAt: new Date()
    });
  } catch (error) {
    console.error('Start listening exam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new listening paper
router.post('/', async (req, res) => {
  try {
    const { title, description, questions, createdBy } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ error: 'Title and createdBy are required' });
    }

    const paper = new ListeningPaper({
      title,
      description,
      questions: questions || [],
      createdBy
    });

    await paper.save();
    res.status(201).json({ message: 'Paper created successfully', paper });
  } catch (error) {
    console.error('Create listening paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update listening paper
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const paper = await ListeningPaper.findByIdAndUpdate(id, updates, { new: true });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.status(200).json({ message: 'Paper updated successfully', paper });
  } catch (error) {
    console.error('Update listening paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete listening paper
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await ListeningPaper.findByIdAndDelete(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.status(200).json({ message: 'Paper deleted successfully' });
  } catch (error) {
    console.error('Delete listening paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload audio file for listening paper
router.post('/:id/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionIndex } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!sectionIndex || isNaN(sectionIndex)) {
      return res.status(400).json({ error: 'Section index is required and must be a number' });
    }

    const paper = await ListeningPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const sectionIdx = parseInt(sectionIndex) - 1; // Convert to 0-based index
    if (sectionIdx < 0 || sectionIdx >= paper.sections.length) {
      return res.status(400).json({ error: 'Invalid section index' });
    }

    paper.sections[sectionIdx].audioFile = req.file.path;
    await paper.save();

    res.status(200).json({
      message: 'Audio uploaded successfully',
      audioFile: req.file.path
    });
  } catch (error) {
    console.error('Upload audio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit listening exam results
router.post('/:id/submit-results', async (req, res) => {
  try {
    const { id } = req.params; // paper id
    const { studentId, assignmentId, answers } = req.body;

    if (!studentId || !assignmentId || !answers) {
      return res.status(400).json({
        error: 'studentId, assignmentId, and answers are required'
      });
    }

    // Validate that the assignment exists and matches
    const assignment = await ExamAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Exam assignment not found' });
    }

    console.log('Assignment found:', assignment._id);
    console.log('Assignment exam_paper:', assignment.exam_paper);
    console.log('Requested paper id:', id);

    if (assignment.student.toString() !== studentId) {
      return res.status(403).json({ error: 'Student does not match assignment' });
    }

    let assignedPaperId;
    if (typeof assignment.exam_paper === 'string') {
      assignedPaperId = assignment.exam_paper;
    } else {
      assignedPaperId = assignment.exam_paper.listening_exam_paper || assignment.exam_paper.listening || assignment.exam_paper;
    }
    console.log('Assigned paper id:', assignedPaperId, 'type:', typeof assignedPaperId);
    console.log('Assigned paper id toString:', assignedPaperId?.toString());

    if (assignedPaperId.toString() !== id) {
      console.log('Paper mismatch: assigned', assignedPaperId.toString(), 'vs requested', id);
      return res.status(400).json({ error: 'Paper does not match assignment' });
    }

    // Check if result already exists
    const existingResult = await ListeningResult.findOne({
      student: studentId,
      assignment: assignmentId
    });

    if (existingResult) {
      return res.status(409).json({ error: 'Results already submitted for this exam' });
    }

    // Calculate score for multiple choice questions
    const paper = await ListeningPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Listening paper not found' });
    }

    let scoreObtained = 0;
    let scoreTotal = 0;
    let studentAnswers = [];

    paper.sections.forEach(section => {
      section.questions.forEach(question => {
        const userAnswer = answers[question.questionNumber] || answers[`${question.questionNumber}-blank-0`] || '';
        studentAnswers.push({
          questionNumber: question.questionNumber,
          questionType: question.questionType,
          userAnswer: userAnswer,
          correctAnswer: question.correctAnswer || null
        });

        if (question.questionType === 'multiple-choice') {
          scoreTotal++;
          if (userAnswer && userAnswer === question.correctAnswer) {
            scoreObtained++;
          }
        }
        // For Blank_in_Space, score will be set later manually
      });
    });

    const result = new ListeningResult({
      student: studentId,
      assignment: assignmentId,
      paper: id,
      answers,
      studentAnswers,
      score: scoreObtained,
      scoreTotal,
      scoreObtained,
      submittedAt: new Date()
    });

    await result.save();

    // Update assignment status to completed
    assignment.status = 'completed';
    await assignment.save();

    res.status(201).json({
      message: 'Listening results submitted successfully',
      result: {
        id: result._id,
        score: result.score,
        submittedAt: result.submittedAt
      }
    });
  } catch (error) {
    console.error('Submit listening results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;