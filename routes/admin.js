const express = require('express');
const multer = require('multer');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const crypto = require('crypto');
const Registration = require('../models/Registration');
const Student = require('../models/Student');
const ExamAssignment = require('../models/ExamAssignment');
const WritingPaper = require('../models/WritingPaper');
const SpeakingPaper = require('../models/SpeakingPaper');
const ListeningPaper = require('../models/ListeningPaper');
const ReadingPaper = require('../models/ReadingPaper');
const ComprehensionQuestion = require('../models/ComprehensionQuestion');
const LoginSession = require('../models/LoginSession');
const Agent = require('../models/Agent');
const ListeningResult = require('../models/ListeningResult');
const ReadingResult = require('../models/ReadingResult');
const WritingResult = require('../models/WritingResult');
const Instructions = require('../models/Instructions');
console.log(process.env.AWS_REGION)
// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const router = express.Router();

// Multer configuration for audio uploads (memory storage for S3)
const uploadAudio = multer({
  storage: multer.memoryStorage(),
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

// Multer configuration for photo uploads (memory storage for S3)
const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});


// Get all registrations (admin only)
router.get('/registrations', async (req, res) => {
  try {
    const registrations = await Registration.find({});
    res.status(200).json({ registrations });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all students (admin only)
router.get('/students', async (req, res) => {
  try {
    const students = await Student.find({});
    res.status(200).json({ students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start exam for a student-PC combination (admin only)
router.post('/start-exam', async (req, res) => {
  try {
    const { studentId, macAddress } = req.body;

    if (!studentId || !macAddress) {
      return res.status(400).json({ error: 'studentId and macAddress are required' });
    }

    // Find the registration
    const registration = await Registration.findOne({ macAddress });
    if (!registration) {
      return res.status(404).json({ error: 'PC not found' });
    }

    // Get today's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in ms
    const todayIST = new Date(now.getTime() + istOffset);
    todayIST.setUTCHours(0, 0, 0, 0);
    const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

    // Find the assignment for this student for today
    const assignment = await ExamAssignment.findOne({
      student: studentId,
      exam_date: { $gte: todayIST, $lt: tomorrowIST },
      examStarted: false
    }).populate('student', 'name student_id');

    if (!assignment) {
      return res.status(404).json({ error: 'No exam is scheduled for this student today. Please check the exam assignments and ensure the student has a valid assignment.' });
    }

    // Assign PC to the assignment and start the exam
    assignment.pc = registration._id;
    assignment.examStarted = true;
    await assignment.save();

    // Assign student to the PC
    registration.studentId = studentId;
    await registration.save();

    res.status(200).json({ message: 'Exam started successfully', assignment });
  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check exam status for a student-PC combination
router.get('/check-exam-status', async (req, res) => {
  try {
    const { macAddress, studentId } = req.query;

    if (!macAddress || !studentId) {
      return res.status(400).json({ error: 'macAddress and studentId are required' });
    }

    // Find the registration
    const registration = await Registration.findOne({ macAddress });
    if (!registration) {
      return res.status(200).json({ examStarted: false, hasAssignment: false });
    }

    // Get today's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(now.getTime() + istOffset);
    todayIST.setUTCHours(0, 0, 0, 0);
    const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

    // Check if there's any assignment for this student today
    const anyAssignment = await ExamAssignment.findOne({
      student: studentId,
      exam_date: { $gte: todayIST, $lt: tomorrowIST }
    });

    // Check for auto-login: if there's an assignment with auto_login_time <= now and not completed, start it
    const currentTime = new Date();
    const autoLoginAssignment = await ExamAssignment.findOne({
      student: studentId,
      pc: registration._id,
      auto_login_time: { $lte: currentTime },
      status: { $ne: 'completed' },
      examStarted: false
    });

    if (autoLoginAssignment) {
      autoLoginAssignment.examStarted = true;
      await autoLoginAssignment.save();
    }

    // Find if there's a started exam for this student and PC
    const assignment = await ExamAssignment.findOne({
      student: studentId,
      pc: registration._id,
      examStarted: true
    }).populate('pc student', 'name student_id');

    if (assignment) {
      res.status(200).json({
        examStarted: true,
        hasAssignment: true,
        assignment: {
          _id: assignment._id,
          exam_type: assignment.exam_type,
          exam_paper: assignment.exam_paper,
          exam_date: assignment.exam_date,
          exam_tittle: assignment.exam_tittle,
          exam_bio: assignment.exam_bio
        }
      });
    } else {
      res.status(200).json({ examStarted: false, hasAssignment: !!anyAssignment });
    }
  } catch (error) {
    console.error('Check exam status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update student role (admin only)
router.put('/students/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const student = await Student.findByIdAndUpdate(id, { role }, { new: true });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({ message: 'Role updated successfully', student });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update registration status (admin only)
router.put('/registrations/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const registration = await Registration.findByIdAndUpdate(id, { status }, { new: true });
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.status(200).json({ message: 'Status updated successfully', registration });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new student (admin only)
router.post('/students', async (req, res) => {
  try {
    const { name, dob, student_photo, email, phone, address, nationality, roll_no, test_date } = req.body;

    if (!name || !dob || !student_photo || !email || !address || !nationality) {
      return res.status(400).json({ error: 'Name, DOB, student photo, email, address, and nationality are required' });
    }

    // Auto-generate student_id (simple increment or random)
    const lastStudent = await Student.findOne().sort({ createdAt: -1 });
    const studentId = lastStudent ? `STU${String(parseInt(lastStudent.student_id.slice(3)) + 1).padStart(6, '0')}` : 'STU000001';

    // Auto-generate password from DOB (DDMMYY)
    const dobDate = new Date(dob);
    const day = String(dobDate.getDate()).padStart(2, '0');
    const month = String(dobDate.getMonth() + 1).padStart(2, '0');
    const year = String(dobDate.getFullYear()).slice(-2);
    const password = `${day}${month}${year}`;

    // Auto-generate UNR (example format)
    const unr = `LCA/${String(dobDate.getDate()).padStart(2, '0')}${String(dobDate.getMonth() + 1).padStart(2, '0')}${String(dobDate.getFullYear()).slice(-2)}/${Math.random().toString().slice(2, 30)}`;

    const student = new Student({
      name,
      student_id: studentId,
      password,
      dob: dobDate,
      student_photo,
      unr,
      email,
      phone,
      address,
      nationality,
      roll_no,
      test_date: test_date ? new Date(test_date) : null
    });

    await student.save();
    res.status(201).json({ message: 'Student created successfully', student });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update student (admin only)
router.put('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const student = await Student.findByIdAndUpdate(id, updates, { new: true });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({ message: 'Student updated successfully', student });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete student (admin only)
router.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload photo to S3
router.post('/upload-photo', uploadPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const fileExtension = path.extname(req.file.originalname);
    const key = `photos/photo-${uniqueSuffix}${fileExtension}`;

    // Upload to S3
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      
      },
    });

    const result = await upload.done();

    // Construct the public URL
    const photoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    res.status(200).json({ photoUrl });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo to S3' });
  }
});

// Get exam papers by type
router.get('/exam-papers/:type', async (req, res) => {
  try {
    const { type } = req.params;
    let papers = [];

    switch (type.toLowerCase()) {
      case 'writing':
        papers = await WritingPaper.find({}).select('title description').sort({ createdAt: -1 });
        break;
      case 'speaking':
        papers = await SpeakingPaper.find({}).select('title description').sort({ createdAt: -1 });
        break;
      case 'listening':
        papers = await ListeningPaper.find({}).select('title description').sort({ createdAt: -1 });
        break;
      case 'reading':
        papers = await ReadingPaper.find({}).select('title description').sort({ createdAt: -1 });
        break;
      default:
        return res.status(400).json({ error: 'Invalid exam type' });
    }

    res.status(200).json({ papers });
  } catch (error) {
    console.error('Get exam papers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create exam assignment
router.post('/exam-assignments', async (req, res) => {
  try {
    const { student, agent, exam_type, exam_paper, exam_date, exam_tittle, exam_bio, auto_login_time, is_visible } = req.body;

    if (!student || !exam_type || !exam_paper || !exam_date || !exam_tittle || !exam_bio) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate exam_type is array and contains valid types
    if (!Array.isArray(exam_type) || exam_type.length === 0) {
      return res.status(400).json({ error: 'exam_type must be a non-empty array' });
    }
    if (!exam_type.every(type => ['writing', 'speaking', 'listening', 'reading'].includes(type))) {
      return res.status(400).json({ error: 'Invalid exam type in array' });
    }

    // Validate exam_paper is object and has papers for each type
    if (typeof exam_paper !== 'object' || exam_paper === null) {
      return res.status(400).json({ error: 'exam_paper must be an object' });
    }
    for (const type of exam_type) {
      if (!exam_paper[`${type}_exam_paper`]) {
        return res.status(400).json({ error: `Missing exam paper for ${type}` });
      }
    }

    // Check if student exists
    const studentExists = await Student.findById(student);
    if (!studentExists) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if exam papers exist
    for (const type of exam_type) {
      const paperId = exam_paper[`${type}_exam_paper`];
      let paperExists = false;
      switch (type) {
        case 'writing':
          paperExists = await WritingPaper.findById(paperId);
          break;
        case 'speaking':
          paperExists = await SpeakingPaper.findById(paperId);
          break;
        case 'listening':
          paperExists = await ListeningPaper.findById(paperId);
          break;
        case 'reading':
          paperExists = await ReadingPaper.findById(paperId);
          break;
      }
      if (!paperExists) {
        return res.status(404).json({ error: `Exam paper not found for ${type}` });
      }
    }

    const assignment = new ExamAssignment({
      student,
      agent: agent || null,
      exam_type,
      exam_paper,
      exam_date: new Date(exam_date),
      exam_tittle,
      exam_bio,
      auto_login_time: auto_login_time ? new Date(auto_login_time) : null,
      is_visible: is_visible !== undefined ? is_visible : true
    });

    await assignment.save();
    res.status(201).json({ message: 'Exam assignment created successfully', assignment });
  } catch (error) {
    console.error('Create exam assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get exam assignments
router.get('/exam-assignments', async (req, res) => {
  try {
    const assignments = await ExamAssignment.find({})
      .populate('student', 'name student_id')
      .populate('agent', 'name agent_id')
      .populate('pc', 'macAddress pcName')
      .sort({ createdAt: -1 });

    // Dynamically populate exam_paper for each assignment
    const populatedAssignments = await Promise.all(assignments.map(async (assignment) => {
      if (assignment.exam_paper && Array.isArray(assignment.exam_type)) {
        const populatedPapers = {};
        for (const type of assignment.exam_type) {
          const paperId = assignment.exam_paper[`${type}_exam_paper`];
          if (paperId) {
            let modelName = '';
            if (type === 'listening') modelName = 'ListeningPaper';
            else if (type === 'speaking') modelName = 'SpeakingPaper';
            else if (type === 'writing') modelName = 'WritingPaper';
            else if (type === 'reading') modelName = 'ReadingPaper';

            if (modelName) {
              const PaperModel = require(`../models/${modelName}`);
              const paper = await PaperModel.findById(paperId).select('title description');
              if (paper) {
                populatedPapers[`${type}_exam_paper`] = paper;
              }
            }
          }
        }
        assignment._doc.exam_paper = populatedPapers;
      }
      return assignment;
    }));

    res.status(200).json({ assignments: populatedAssignments });
  } catch (error) {
    console.error('Get exam assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific exam assignment
router.get('/exam-assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await ExamAssignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Dynamically populate exam_paper based on exam_type array
    if (assignment.exam_paper && Array.isArray(assignment.exam_type)) {
      const populatedPapers = {};
      for (const type of assignment.exam_type) {
        const paperId = assignment.exam_paper[`${type}_exam_paper`];
        if (paperId) {
          let modelName = '';
          if (type === 'listening') modelName = 'ListeningPaper';
          else if (type === 'speaking') modelName = 'SpeakingPaper';
          else if (type === 'writing') modelName = 'WritingPaper';
          else if (type === 'reading') modelName = 'ReadingPaper';

          if (modelName) {
            const PaperModel = require(`../models/${modelName}`);
            const paper = await PaperModel.findById(paperId);
            if (paper) {
              populatedPapers[`${type}_exam_paper`] = paper;
            }
          }
        }
      }
      assignment._doc.exam_paper = populatedPapers;
    }

    res.status(200).json({ assignment });
  } catch (error) {
    console.error('Get exam assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update exam assignment status
router.put('/exam-assignments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['assigned', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const assignment = await ExamAssignment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('student', 'name student_id');

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.status(200).json({ message: 'Status updated successfully', assignment });
  } catch (error) {
    console.error('Update assignment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update exam assignment visibility
router.put('/exam-assignments/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_visible } = req.body;

    const assignment = await ExamAssignment.findByIdAndUpdate(
      id,
      { is_visible: Boolean(is_visible) },
      { new: true }
    ).populate('student', 'name student_id');

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.status(200).json({ message: 'Visibility updated successfully', assignment });
  } catch (error) {
    console.error('Update assignment visibility error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update exam assignment
router.put('/exam-assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle date conversions
    if (updates.auto_login_time) {
      updates.auto_login_time = new Date(updates.auto_login_time);
    }

    const assignment = await ExamAssignment.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    ).populate('student', 'name student_id');

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.status(200).json({ message: 'Assignment updated successfully', assignment });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Listening Papers CRUD operations

// Get all listening papers
router.get('/listening-papers', async (req, res) => {
  try {
    const papers = await ListeningPaper.find({}).sort({ createdAt: -1 });
    res.status(200).json({ papers });
  } catch (error) {
    console.error('Get listening papers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific listening paper
router.get('/listening-papers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await ListeningPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    res.status(200).json({ paper });
  } catch (error) {
    console.error('Get listening paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new listening paper
router.post('/listening-papers', async (req, res) => {
  try {
    const { title, description, sections, status, createdBy } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ error: 'Title and createdBy are required' });
    }

    const paper = new ListeningPaper({
      title,
      description,
      sections: sections || [],
      status: status || 'draft',
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
router.put('/listening-papers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Clean up correctAnswer if empty string
    if (updates.sections) {
      updates.sections.forEach(section => {
        if (section.questions) {
          section.questions.forEach(question => {
            if (question.correctAnswer === '') {
              delete question.correctAnswer;
            }
          });
        }
      });
    }

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
router.delete('/listening-papers/:id', async (req, res) => {
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


// Upload audio file for listening paper section
router.post('/listening-papers/:id/upload-audio', uploadAudio.any(), async (req, res) => {
  try {
    const { id } = req.params;
    const sectionIndex = parseInt(req.body.sectionIndex);

    const audioFile = req.files.find(file => file.fieldname === 'audio');
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (isNaN(sectionIndex) || sectionIndex < 1) {
      return res.status(400).json({ error: 'Invalid section index' });
    }

    const paper = await ListeningPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const index = sectionIndex - 1;
    if (!paper.sections) {
      paper.sections = [];
    }

    // Ensure sections array has enough elements
    while (paper.sections.length <= index) {
      paper.sections.push({
        sectionNumber: paper.sections.length + 1,
        introduction: '',
        audioFile: '',
        audioUrl: '',
        startTime: '00:00',
        questions: []
      });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const fileExtension = path.extname(audioFile.originalname);
    const key = `audio/audio-${uniqueSuffix}${fileExtension}`;

    // Upload to S3
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: audioFile.buffer,
        ContentType: audioFile.mimetype,
      },
    });

    const result = await upload.done();

    // Construct the public URL
    const audioUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // Update the specific section with the audio URL
    paper.sections[index].audioUrl = audioUrl;

    // Mark the sections array as modified to ensure it gets saved
    paper.markModified('sections');
    await paper.save();

    // Refresh the paper object to ensure we return the latest saved version
    const updatedPaper = await ListeningPaper.findById(id);

    res.status(200).json({
      message: 'Audio uploaded successfully',
      paper: updatedPaper,
      audioUrl
    });
  } catch (error) {
    console.error('Upload audio error:', error);
    res.status(500).json({ error: 'Failed to upload audio to S3' });
  }
});

// Create login session
router.post('/login-sessions', async (req, res) => {
  try {
    const { student, pc, assignment, autoLoginTime } = req.body;

    if (!student || !pc || !assignment) {
      return res.status(400).json({ error: 'Student, PC, and assignment are required' });
    }

    const session = new LoginSession({
      student,
      pc,
      assignment,
      autoLoginTime: autoLoginTime ? new Date(autoLoginTime) : null,
      status: autoLoginTime ? 'scheduled' : 'logged_in',
      loginTime: autoLoginTime ? null : new Date()
    });

    await session.save();
    res.status(201).json({ message: 'Login session created', session });
  } catch (error) {
    console.error('Create login session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get login sessions
router.get('/login-sessions', async (req, res) => {
  try {
    const sessions = await LoginSession.find({})
      .populate('student', 'name student_id')
      .populate('pc', 'macAddress pcName')
      .populate('assignment', 'exam_type exam_date')
      .sort({ createdAt: -1 });

    res.status(200).json({ sessions });
  } catch (error) {
    console.error('Get login sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update login session status
router.put('/login-sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['scheduled', 'logged_in', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const session = await LoginSession.findByIdAndUpdate(id, { status }, { new: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(200).json({ message: 'Session updated', session });
  } catch (error) {
    console.error('Update login session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check for auto-login session
router.get('/check-auto-login', async (req, res) => {
  try {
    const { macAddress } = req.query;

    if (!macAddress) {
      return res.status(400).json({ error: 'macAddress is required' });
    }

    // Find the registration
    const registration = await Registration.findOne({ macAddress });
    if (!registration) {
      console.log('PC not found for macAddress:', macAddress);
      return res.status(404).json({ error: 'PC not found' });
    }

    const currentTime = new Date();
    console.log('Current time:', currentTime);

    // Get today's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(now.getTime() + istOffset);
    todayIST.setUTCHours(0, 0, 0, 0);
    const tomorrowIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);

    // Find scheduled sessions for this PC with today's assignments
    const scheduledSessions = await LoginSession.find({
      pc: registration._id,
      status: 'scheduled'
    }).populate({
      path: 'assignment',
      match: { exam_date: { $gte: todayIST, $lt: tomorrowIST } }
    }).populate('student').sort({ createdAt: 1 });

    // Filter out sessions where assignment didn't match (i.e., assignment is null)
    const validScheduledSessions = scheduledSessions.filter(session => session.assignment !== null);

    console.log('Scheduled sessions found:', validScheduledSessions.length);

    if (validScheduledSessions.length === 0) {
      console.log('No scheduled sessions');
      return res.status(200).json({ eligible: false, reason: 'No scheduled sessions' });
    }

    // Check for each session if eligible for auto-login
    for (const session of validScheduledSessions) {
      console.log('Checking session:', session._id, 'autoLoginTime:', session.autoLoginTime, 'assignment examStarted:', session.assignment?.examStarted);
      let isEligible = false;
      if (session.autoLoginTime && session.autoLoginTime <= currentTime) {
        isEligible = true;
        console.log('Eligible due to autoLoginTime reached');
      } else if (session.autoLoginTime === null && session.assignment && session.assignment.examStarted === true) {
        isEligible = true;
        console.log('Eligible due to exam started and no autoLoginTime');
      }

      if (isEligible) {
        const existingLoggedIn = await LoginSession.findOne({
          student: session.student._id,
          pc: registration._id,
          status: 'logged_in'
        });

        console.log('Existing logged in session:', existingLoggedIn);

        if (!existingLoggedIn) {
          console.log('Eligible for auto-login');
          // Eligible for auto-login
          return res.status(200).json({
            eligible: true,
            session: {
              _id: session._id,
              student: session.student,
              assignment: session.assignment
            }
          });
        } else {
          console.log('Already logged in');
        }
      } else {
        console.log('Not eligible');
      }
    }

    console.log('No eligible sessions found');
    // No eligible sessions
    res.status(200).json({ eligible: false, reason: 'No eligible sessions' });
  } catch (error) {
    console.error('Check auto-login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent Management Routes

// Get all agents
router.get('/agents', async (req, res) => {
  try {
    const agents = await Agent.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ agents });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new agent
router.post('/agents', async (req, res) => {
  try {
    const { name, agent_id, password } = req.body;

    if (!name || !agent_id || !password) {
      return res.status(400).json({ error: 'Name, agent ID, and password are required' });
    }

    // Check if agent ID already exists
    const existingAgent = await Agent.findOne({ agent_id: agent_id.toUpperCase() });
    if (existingAgent) {
      return res.status(400).json({ error: 'Agent ID already exists' });
    }

    const agent = new Agent({
      name,
      agent_id: agent_id.toUpperCase(),
      password
    });

    await agent.save();

    // Return agent without password
    const agentResponse = agent.toJSON();
    res.status(201).json({
      message: 'Agent created successfully',
      agent: agentResponse
    });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update agent
router.put('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow password updates through this route
    delete updates.password;

    const agent = await Agent.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.status(200).json({
      message: 'Agent updated successfully',
      agent
    });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete agent
router.delete('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if agent has assigned exams
    const assignedExams = await ExamAssignment.find({ agent: id });
    if (assignedExams.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete agent with assigned exams. Please reassign exams first.'
      });
    }

    const agent = await Agent.findByIdAndDelete(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.status(200).json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reading Papers CRUD operations

// Get all reading papers
router.get('/reading-papers', async (req, res) => {
  try {
    const papers = await ReadingPaper.find({}).sort({ createdAt: -1 });

    // For each paper, attach comprehension questions to type5 questions
    for (const paper of papers) {
      if (paper.questions) {
        for (const question of paper.questions) {
          if (question.type === 'type5_reading_comprehension') {
            const comprehensionQuestions = await ComprehensionQuestion.find({
              readingPaperId: paper._id,
              passageIndex: question.passageIndex
            }).sort({ order: 1 });
            question.comprehensionQuestions = comprehensionQuestions.map(cq => ({
              questionNumber: cq.questionNumber,
              question: cq.question,
              questionType: cq.questionType,
              options: cq.options,
              correctAnswer: cq.correctAnswer,
              maxWords: cq.maxWords
            }));
          }
        }
      }
    }

    res.status(200).json({ papers });
  } catch (error) {
    console.error('Get reading papers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific reading paper
router.get('/reading-papers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await ReadingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Attach comprehension questions to type5 questions
    if (paper.questions) {
      for (const question of paper.questions) {
        if (question.type === 'type5_reading_comprehension') {
          const comprehensionQuestions = await ComprehensionQuestion.find({
            readingPaperId: paper._id,
            passageIndex: question.passageIndex
          }).sort({ order: 1 });
          question.comprehensionQuestions = comprehensionQuestions.map(cq => ({
            questionNumber: cq.questionNumber,
            question: cq.question,
            questionType: cq.questionType,
            options: cq.options,
            correctAnswer: cq.correctAnswer,
            maxWords: cq.maxWords
          }));
        }
      }
    }

    res.status(200).json({ paper });
  } catch (error) {
    console.error('Get reading paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new reading paper
router.post('/reading-papers', async (req, res) => {
  try {
    const { title, description, passages, questions, status, estimatedTime, createdBy } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ error: 'Title and createdBy are required' });
    }

    const paper = new ReadingPaper({
      title,
      description,
      passages: passages || [],
      questions: questions || [],
      status: status || 'draft',
      estimatedTime: estimatedTime || 60,
      createdBy
    });

    await paper.save();

    // If there are comprehension questions, save them separately
    if (questions && questions.some(q => q.type === 'type5_reading_comprehension' && q.comprehensionQuestions)) {
      const comprehensionQuestions = [];
      questions.forEach((question, index) => {
        if (question.type === 'type5_reading_comprehension' && question.comprehensionQuestions) {
          question.comprehensionQuestions.forEach((cq, cqIndex) => {
            comprehensionQuestions.push({
              readingPaperId: paper._id,
              passageIndex: question.passageIndex,
              questionNumber: cq.questionNumber,
              question: cq.question,
              questionType: cq.questionType,
              options: cq.options,
              correctAnswer: cq.correctAnswer,
              maxWords: cq.maxWords,
              unitNumber: question.unitNumber,
              order: cqIndex
            });
          });
        }
      });
      if (comprehensionQuestions.length > 0) {
        await ComprehensionQuestion.insertMany(comprehensionQuestions);
      }
    }

    res.status(201).json({ message: 'Paper created successfully', paper });
  } catch (error) {
    console.error('Create reading paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update reading paper
router.put('/reading-papers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const paper = await ReadingPaper.findByIdAndUpdate(id, updates, { new: true });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Handle comprehension questions
    if (updates.questions && updates.questions.some(q => q.type === 'type5_reading_comprehension' && q.comprehensionQuestions)) {
      // Delete existing comprehension questions for this paper
      await ComprehensionQuestion.deleteMany({ readingPaperId: id });

      // Insert new ones
      const comprehensionQuestions = [];
      updates.questions.forEach((question) => {
        if (question.type === 'type5_reading_comprehension' && question.comprehensionQuestions) {
          question.comprehensionQuestions.forEach((cq, cqIndex) => {
            comprehensionQuestions.push({
              readingPaperId: id,
              passageIndex: question.passageIndex,
              questionNumber: cq.questionNumber,
              question: cq.question,
              questionType: cq.questionType,
              options: cq.options,
              correctAnswer: cq.correctAnswer,
              maxWords: cq.maxWords,
              unitNumber: question.unitNumber,
              order: cqIndex
            });
          });
        }
      });
      if (comprehensionQuestions.length > 0) {
        await ComprehensionQuestion.insertMany(comprehensionQuestions);
      }
    }

    res.status(200).json({ message: 'Paper updated successfully', paper });
  } catch (error) {
    console.error('Update reading paper error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete reading paper
router.delete('/reading-papers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete comprehension questions first
    await ComprehensionQuestion.deleteMany({ readingPaperId: id });

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

// Get all student results (admin only) - optionally filter by assignment
router.get('/results', async (req, res) => {
  try {
    const { assignment } = req.query;

    let listeningQuery = {};
    let readingQuery = {};
    let writingQuery = {};

    if (assignment) {
      listeningQuery.assignment = assignment;
      readingQuery.assignment = assignment;
      writingQuery.assignment = assignment;
    }

    const [listeningResults, readingResults, writingResults] = await Promise.all([
      ListeningResult.find(listeningQuery)
        .populate('student', 'name student_id')
        .populate({
          path: 'paper',
          select: 'title sections',
          populate: {
            path: 'sections.questions',
            model: 'ListeningQuestion'
          }
        })
        .populate('assignment', 'exam_type')
        .sort({ submittedAt: -1 }),
      ReadingResult.find(readingQuery)
        .populate('student', 'name student_id')
        .populate('paper', 'title questions')
        .populate('assignment', 'exam_type')
        .sort({ submittedAt: -1 }),
      WritingResult.find(writingQuery)
        .populate('student', 'name student_id')
        .populate('paper', 'title tasks')
        .populate('assignment', 'exam_type')
        .sort({ submittedAt: -1 })
    ]);

    // Combine all results into a single array with examType
    const allResults = [
      ...listeningResults.map(result => ({ ...result.toObject(), examType: 'listening' })),
      ...readingResults.map(result => ({ ...result.toObject(), examType: 'reading' })),
      ...writingResults.map(result => ({ ...result.toObject(), examType: 'writing' }))
    ];

    // Sort by submittedAt descending
    allResults.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.status(200).json({ results: allResults });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update listening result with admin decisions
router.put('/listening-results/:id/admin-mark', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminDecisions } = req.body; // array of { questionNumber, blankIndex, isCorrect }

    if (!Array.isArray(adminDecisions)) {
      return res.status(400).json({ error: 'adminDecisions must be an array' });
    }

    const result = await ListeningResult.findById(id);
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Update admin decisions
    adminDecisions.forEach(decision => {
      const answer = result.studentAnswers.find(a => a.questionNumber === decision.questionNumber && a.blankIndex === decision.blankIndex);
      if (answer && answer.questionType === 'Blank_in_Space') {
        answer.adminMarked = decision.isCorrect;
      }
    });

    // Recalculate score
    let correctCount = 0;
    result.studentAnswers.forEach(answer => {
      if (answer.questionType === 'multiple-choice') {
        // Auto-scored
        if (answer.userAnswer === answer.correctAnswer) {
          correctCount++;
        }
      } else if (answer.questionType === 'Blank_in_Space') {
        // Admin marked
        if (answer.adminMarked === true) {
          correctCount++;
        }
      }
    });

    result.score = correctCount;
    result.scoreObtained = correctCount;
    result.scoreTotal = result.studentAnswers.length;
    result.status = 'graded';
    result.gradedBy = req.admin?._id || null; // Assuming admin is authenticated
    result.gradedAt = new Date();

    await result.save();

    res.status(200).json({
      message: 'Result updated successfully',
      result: {
        _id: result._id,
        score: result.score,
        status: result.status,
        studentAnswers: result.studentAnswers
      }
    });
  } catch (error) {
    console.error('Update listening result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update writing result with admin scores
router.put('/writing-results/:id/admin-score', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminScores } = req.body; // array of { taskNumber, score }

    if (!Array.isArray(adminScores)) {
      return res.status(400).json({ error: 'adminScores must be an array' });
    }

    const result = await WritingResult.findById(id);
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Update admin scores
    adminScores.forEach(scoreData => {
      const answer = result.studentAnswers.find(a => a.taskNumber === scoreData.taskNumber);
      if (answer) {
        answer.adminScore = scoreData.score;
      }
    });

    // Recalculate total score
    const totalScore = result.studentAnswers.reduce((sum, answer) => sum + (answer.adminScore || 0), 0);
    result.score = totalScore;
    result.scoreObtained = totalScore;
    result.scoreTotal = result.studentAnswers.length * 9; // Max 9 points per task
    result.status = 'graded';
    result.gradedBy = req.admin?._id || null;
    result.gradedAt = new Date();

    await result.save();

    res.status(200).json({
      message: 'Writing result updated successfully',
      result: {
        _id: result._id,
        score: result.score,
        status: result.status,
        studentAnswers: result.studentAnswers
      }
    });
  } catch (error) {
    console.error('Update writing result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Instructions CRUD operations

// Get instructions for a category
router.get('/instructions/:category', async (req, res) => {
  try {
    const { category } = req.params;

    if (!['listening', 'reading', 'writing'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const instruction = await Instructions.findOne({ category });
    if (!instruction) {
      return res.status(200).json({ instruction: { category, content: '' } });
    }

    res.status(200).json({ instruction });
  } catch (error) {
    console.error('Get instructions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update instructions for a category
router.put('/instructions/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { content, createdBy } = req.body;

    if (!['listening', 'reading', 'writing'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    if (!createdBy) {
      return res.status(400).json({ error: 'createdBy is required' });
    }

    const instruction = await Instructions.findOneAndUpdate(
      { category },
      { content: content || '', createdBy },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: 'Instructions saved successfully',
      instruction
    });
  } catch (error) {
    console.error('Save instructions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;