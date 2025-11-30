const express = require('express');
const ReadingResult = require('../models/ReadingResult');
const ExamAssignment = require('../models/ExamAssignment');
const ReadingPaper = require('../models/ReadingPaper');

const router = express.Router();

// Submit reading exam results
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
      assignedPaperId = assignment.exam_paper.reading_exam_paper || assignment.exam_paper.reading || assignment.exam_paper;
    }
    console.log('Assigned paper id:', assignedPaperId, 'type:', typeof assignedPaperId);
    console.log('Assigned paper id toString:', assignedPaperId?.toString());

    if (assignedPaperId.toString() !== id) {
      console.log('Paper mismatch: assigned', assignedPaperId.toString(), 'vs requested', id);
      return res.status(400).json({ error: 'Paper does not match assignment' });
    }

    // Check if result already exists
    const existingResult = await ReadingResult.findOne({
      student: studentId,
      assignment: assignmentId
    });

    if (existingResult) {
      return res.status(409).json({ error: 'Results already submitted for this exam' });
    }

    // Calculate score for multiple choice questions
    const paper = await ReadingPaper.findById(id);
    if (!paper) {
      return res.status(404).json({ error: 'Reading paper not found' });
    }

    let scoreObtained = 0;
    let scoreTotal = 0;
    let studentAnswers = [];

    paper.questions.forEach(question => {
      const userAnswer = answers[question.questionNumber] || answers[question.order + 1] || answers[`gap-${question.order + 1}`] || '';
      studentAnswers.push({
        questionNumber: question.questionNumber || question.order + 1,
        questionType: question.type || question.questionType,
        userAnswer: userAnswer,
        correctAnswer: question.correctAnswer || null
      });

      // For multiple choice and true/false, count score
      if ((question.type === 'type1_word_replacement' || question.type === 'type2_gap_fill' ||
           (question.type === 'type5_reading_comprehension' && question.questionType === 'multiple_choice') ||
           (question.type === 'type5_reading_comprehension' && question.questionType === 'true_false')) &&
          question.correctAnswer) {
        scoreTotal++;
        if (userAnswer && userAnswer === question.correctAnswer) {
          scoreObtained++;
        }
      }
      // For other types like short_answer, gap_fill, etc., score is manual
    });

    const result = new ReadingResult({
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
      message: 'Reading results submitted successfully',
      result: {
        id: result._id,
        score: result.score,
        submittedAt: result.submittedAt
      }
    });
  } catch (error) {
    console.error('Submit reading results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;