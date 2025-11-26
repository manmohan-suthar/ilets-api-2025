const express = require('express');
const Registration = require('../models/Registration');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const ExamAssignment = require('../models/ExamAssignment');

const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  try {
    const { centerName, centerAddress, pcName, macAddress, uuid, hostname, platform } = req.body;

    // Validation
    if (!centerName || !centerAddress || !pcName || !macAddress || !uuid || !hostname || !platform) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if UUID already exists
    const existing = await Registration.findOne({ uuid });
    if (existing) {
      return res.status(409).json({ error: 'PC already registered' });
    }

    // Create new registration
    const registration = new Registration({
      centerName,
      centerAddress,
      pcName,
      macAddress,
      uuid,
      hostname,
      platform
    });

    await registration.save();

    res.status(201).json({ message: 'Registration successful', data: registration });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { student_id, password, macAddress, uuid, hostname, platform } = req.body;

    // Validation
    if (!student_id || !password || !macAddress || !uuid || !hostname || !platform) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if PC is registered
    const registration = await Registration.findOne({ macAddress, hostname, platform });
    if (!registration) {
      return res.status(403).json({ error: 'PC not registered. Please register this PC first.' });
    }

    // Check if device is active
    if (registration.status !== 'active') {
      return res.status(403).json({ error: 'Your device is not verified.' });
    }
// Check student credentials
const student = await Student.findOne({ student_id });
if (!student || student.password !== password) {
  return res.status(401).json({ error: 'Invalid student ID or password' });
}

// Get student's exam assignments
const assignments = await ExamAssignment.find({
  student: student._id,
  is_visible: true,
  status: { $in: ['assigned', 'in_progress'] }
}).populate('exam_paper', 'title description');

// Check if student has any exams within the allowed time window
const currentTime = new Date();

const validExams = assignments.filter(assignment => {
  const examDateTime = new Date(`${assignment.exam_date.toISOString().split('T')[0]}T${assignment.exam_time}`);
  const loginStartTime = new Date(examDateTime.getTime() - 10 * 60 * 1000);
  return currentTime >= loginStartTime && currentTime < examDateTime;
});

if (validExams.length === 0) {
  // Determine the appropriate error message
  let hasClosed = false;
  let hasStarted = false;
  let minTimeRemaining = Infinity;

  assignments.forEach(assignment => {
    const examDateTime = new Date(`${assignment.exam_date.toISOString().split('T')[0]}T${assignment.exam_time}`);
    const examEndTime = new Date(examDateTime.getTime() + assignment.duration * 60 * 1000);
    const loginStartTime = new Date(examDateTime.getTime() - 10 * 60 * 1000);

    if (currentTime >= examEndTime) {
      hasClosed = true;
    } else if (currentTime >= examDateTime) {
      hasStarted = true;
    } else {
      const timeDiff = loginStartTime.getTime() - currentTime.getTime();
      if (timeDiff > 0) {
        minTimeRemaining = Math.min(minTimeRemaining, timeDiff);
      }
    }
  });

  if (hasClosed) {
    return res.status(403).json({ error: 'The exam is closed. You cannot log in.' });
  } else if (hasStarted) {
    return res.status(403).json({ error: 'The exam has already started. You cannot log in now.' });
  } else if (minTimeRemaining < Infinity) {
    const minutesRemaining = Math.ceil(minTimeRemaining / (1000 * 60));
    return res.status(403).json({
      error: `You can only log in 10 minutes before the scheduled exam time. Time remaining: ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`
    });
  } else {
    return res.status(403).json({ error: 'No valid exam assignments found.' });
  }
}

console.log(student);

res.status(200).json({
  message: 'Login successful',
  student: {
    name: student.name,
    student_id: student.student_id,
    dob: student.dob,
    student_photo: student.student_photo,
    unr: student.unr,
    email: student.email,
    phone: student.phone,
    address: student.address,
    nationality: student.nationality,
    roll_no: student.roll_no,
    test_date: student.test_date,
    role: student.role
  },
  registration: {
    centerName: registration.centerName,
    centerAddress: registration.centerAddress,
    pcName: registration.pcName,
    macAddress: registration.macAddress,
    uuid: registration.uuid,
    hostname: registration.hostname,
    platform: registration.platform
  },
  assignments: validExams.map(assignment => ({
    _id: assignment._id,
    exam_type: assignment.exam_type,
    exam_paper: assignment.exam_paper,
    exam_date: assignment.exam_date,
    exam_tittle: assignment.exam_tittle,
    exam_bio: assignment.exam_bio,
    exam_time: assignment.exam_time,
    duration: assignment.duration,
    status: assignment.status,
    exam_paper: assignment.exam_paper
  }))

  
});
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// Seed admin (run once)
router.post('/seed-admin', async (req, res) => {
  try {
    const existingAdmin = await Admin.findOne({ admin: 'admin' });
    if (existingAdmin) {
      return res.status(200).json({ message: 'Admin already exists' });
    }

    const newAdmin = new Admin({
      admin: 'admin',
      password: 'admin'
    });

    await newAdmin.save();
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Seed admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-login for students based on PC
router.post('/auto-login', async (req, res) => {
  try {
    const { macAddress, uuid } = req.body;

    // Validation
    if (!macAddress || !uuid) {
      return res.status(400).json({ error: 'macAddress and uuid are required' });
    }

    // Find registration
    const registration = await Registration.findOne({ macAddress, uuid }).populate('studentId');
    if (!registration) {
      return res.status(404).json({ error: 'PC not registered' });
    }

    if (registration.status !== 'active') {
      return res.status(403).json({ error: 'PC is not active' });
    }

    const student = registration.studentId;
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({
      message: 'Auto-login successful',
      student: {
        _id: student._id,
        name: student.name,
        student_id: student.student_id,
        dob: student.dob,
        student_photo: student.student_photo,
        unr: student.unr,
        email: student.email,
        phone: student.phone,
        address: student.address,
        nationality: student.nationality,
        roll_no: student.roll_no,
        test_date: student.test_date,
        role: student.role
      }
    });
  } catch (error) {
    console.error('Auto-login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin login route
router.post('/admin-login', async (req, res) => {
  try {
    const { admin, password } = req.body;

    // Validation
    if (!admin || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check admin credentials
    const adminUser = await Admin.findOne({ admin });
    if (!adminUser || adminUser.password !== password) {
      return res.status(401).json({ error: 'Invalid admin username or password' });
    }

    res.status(200).json({
      message: 'Admin login successful',
      admin: {
        admin: adminUser.admin
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;