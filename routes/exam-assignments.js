const express = require('express');
const ExamAssignment = require('../models/ExamAssignment');
const ListeningPaper = require('../models/ListeningPaper');
const SpeakingPaper = require('../models/SpeakingPaper');
const WritingPaper = require('../models/WritingPaper');
const Student = require('../models/Student');

const router = express.Router();

// Get all exam assignments or filter by student_id
router.get('/', async (req, res) => {
  try {
    const { student_id } = req.query;
    console.log('Fetching exam assignments for student_id:', student_id);
    let query = {};

    if (student_id) {
      const student = await Student.findOne({ student_id });
      console.log('Student find result:', student ? { _id: student._id, student_id: student.student_id } : 'null');
      if (student) {
        query.student = student._id;
        console.log('query.student set to:', student._id);
      } else {
        console.log('Student not found for student_id:', student_id);
        return res.status(404).json({ error: 'Student not found' });
      }
    }

    // Always filter by visible and valid statuses
    query.is_visible = true;
    query.status = { $in: ['assigned', 'in_progress'] };
    console.log('Final query:', query);

    const assignments = await ExamAssignment.find(query)
      .populate('student', 'name student_id')
      .sort({ createdAt: -1 });
    console.log('Assignments found:', assignments.length, assignments.map(a => ({ _id: a._id, exam_type: a.exam_type, exam_paper: a.exam_paper })));

    res.status(200).json({ assignments });
  } catch (error) {
    console.error('Get exam assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific exam assignment
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await ExamAssignment.findById(id).populate('student', 'name student_id');
    if (!assignment) {
      return res.status(404).json({ error: 'Exam assignment not found' });
    }

    res.status(200).json({ assignment });
  } catch (error) {
    console.error('Get exam assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update exam assignment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const assignment = await ExamAssignment.findByIdAndUpdate(id, updates, { new: true });
    if (!assignment) {
      return res.status(404).json({ error: 'Exam assignment not found' });
    }

    res.status(200).json({ message: 'Exam assignment updated successfully', assignment });
  } catch (error) {
    console.error('Update exam assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;