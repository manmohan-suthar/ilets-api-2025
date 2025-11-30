const express = require('express');
const WritingResult = require('../models/WritingResult');
const ExamAssignment = require('../models/ExamAssignment');
const WritingPaper = require('../models/WritingPaper');

const router = express.Router();

// Submit writing exam results
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
      assignedPaperId = assignment.exam_paper.writing_exam_paper || assignment.exam_paper.writing || assignment.exam_paper;
    }
    console.log('Assigned paper id:', assignedPaperId, 'type:', typeof assignedPaperId);
    console.log('Assigned paper id toString:', assignedPaperId?.toString());

    if (assignedPaperId.toString() !== id) {
      console.log('Paper mismatch: assigned', assignedPaperId.toString(), 'vs requested', id);
      return res.status(400).json({ error: 'Paper does not match assignment' });
    }

    // Check if result already exists
    const existingResult = await WritingResult.findOne({
      student: studentId,
      assignment: assignmentId
    });

    if (existingResult) {
      return res.status(409).json({ error: 'Results already submitted for this exam' });
    }

    // For writing, scores are manual, so scoreTotal is number of tasks, scoreObtained is 0
    const paper = await WritingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Writing paper not found' });
    }

    let scoreTotal = paper.tasks ? paper.tasks.length : 0;
    let studentAnswers = [];

    paper.tasks.forEach(task => {
      const userAnswer = answers[task.taskNumber] || '';
      const wordCount = userAnswer.split(/\s+/).filter(word => word.length > 0).length;
      studentAnswers.push({
        taskNumber: task.taskNumber,
        answer: userAnswer,
        wordCount: wordCount
      });
    });

    const result = new WritingResult({
      student: studentId,
      assignment: assignmentId,
      paper: id,
      answers,
      studentAnswers,
      score: null, // manual grading
      scoreTotal,
      scoreObtained: 0,
      submittedAt: new Date()
    });

    await result.save();

    // Update assignment status to completed
    assignment.status = 'completed';
    await assignment.save();

    res.status(201).json({
      message: 'Writing results submitted successfully',
      result: {
        id: result._id,
        score: result.score,
        submittedAt: result.submittedAt
      }
    });
  } catch (error) {
    console.error('Submit writing results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;