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
    let detailedResults = [];

    paper.questions.forEach(question => {
      // Handle question text that may contain JavaScript concatenation
      let questionText = question.question;
      if (typeof questionText === 'string' && questionText.includes('+')) {
        try {
          questionText = eval(questionText);
        } catch (e) {
          // keep as is
        }
      }

      // Create detailed result for all question types
      let detailedResult = {
        type: question.type,
        questionNumber: question.questionNumber,
        question: questionText,
        instructions: question.instructions,
        unitNumber: question.unitNumber,
        order: question.order,
        passageIndex: question.passageIndex,
        texts: question.texts || [],
        matchingQuestions: question.matchingQuestions || [],
        correctAnswer: question.correctAnswer || '',
        gapMappings: question.gapMappings || [],
        gaps: question.gaps || [],
        sentences: question.sentences || [],
        options: question.options || [],
        comprehensionQuestions: question.comprehensionQuestions || []
      };

      // Handle student answers based on question type
      if (question.type === 'type3_sentence_completion') {
        // Handle type3 with gap mappings
        const studentAnswersForType3 = question.gapMappings?.map(gap => {
          const gapKey = `gap-${gap.gapNumber}`;
          const selectedOption = answers[gapKey] || '';
          return {
            gapNumber: gap.gapNumber,
            selectedOption: selectedOption,
            isCorrect: selectedOption === gap.correctSentence
          };
        }) || [];
        detailedResult.studentAnswers = studentAnswersForType3;

        // Add to studentAnswers for each gap
        question.gapMappings?.forEach(gap => {
          const gapKey = `gap-${gap.gapNumber}`;
          const selectedOption = answers[gapKey] || '';
          studentAnswers.push({
            questionNumber: question.questionNumber || question.order + 1,
            questionType: question.type,
            userAnswer: selectedOption,
            correctAnswer: gap.correctSentence,
            _id: question._id
          });

          // Score each gap
          if (gap.correctSentence) {
            scoreTotal++;
            if (selectedOption && selectedOption === gap.correctSentence) {
              scoreObtained++;
            }
          }
        });
      } else if (question.type === 'type4_matching_headings') {
        // Handle type4 with multiple matching questions
        const studentAnswersForType4 = question.matchingQuestions?.map(mq => {
          const selectedText = answers[`type4-${mq.questionNumber}`] || '';
          return {
            questionNumber: mq.questionNumber,
            selectedText: selectedText,
            isCorrect: selectedText === mq.correctText
          };
        }) || [];
        detailedResult.studentAnswers = studentAnswersForType4;

        // Add to studentAnswers for each matching question
        question.matchingQuestions?.forEach(mq => {
          const selectedText = answers[`type4-${mq.questionNumber}`] || '';
          studentAnswers.push({
            questionNumber: mq.questionNumber,
            questionType: question.type,
            userAnswer: selectedText,
            correctAnswer: mq.correctText || null,
            _id: question._id
          });

          // Score each matching question
          if (mq.correctText) {
            scoreTotal++;
            if (selectedText && selectedText === mq.correctText) {
              scoreObtained++;
            }
          }
        });
      } else if (question.type === 'type5' || question.type === 'type5_reading_comprehension') {
        // Handle type5 with comprehension questions or single
        if (question.comprehensionQuestions?.length > 0) {
          // Handle comprehension questions
          const studentAnswersForType5 = question.comprehensionQuestions?.map(cq => {
            const answerKey = `type5-${cq.questionNumber}`;
            const userAnswer = answers[answerKey] || '';
            return {
              questionNumber: cq.questionNumber,
              userAnswer: userAnswer,
              isCorrect: userAnswer === cq.correctAnswer
            };
          }) || [];
          detailedResult.studentAnswers = studentAnswersForType5;

          // Add to studentAnswers for each comprehension question
          question.comprehensionQuestions.forEach(cq => {
            const answerKey = `type5-${cq.questionNumber}`;
            const userAnswer = answers[answerKey] || '';
            console.log(`Pushing type5 comprehension q ${cq.questionNumber}, userAnswer: ${userAnswer}, correct: ${cq.correctAnswer}`);
            studentAnswers.push({
              questionNumber: cq.questionNumber,
              questionType: 'type5_reading_comprehension',
              userAnswer: userAnswer,
              correctAnswer: cq.correctAnswer,
              _id: question._id
            });

            // Score each comprehension question
            if (cq.correctAnswer) {
              scoreTotal++;
              if (userAnswer && userAnswer === cq.correctAnswer) {
                scoreObtained++;
              }
            }
          });
        } else {
          // Single type5 question
          const userAnswer = answers[`type5-${question.questionNumber}`] || answers[`type5-${question.order + 1}`] || '';
          detailedResult.studentAnswers = [{
            questionNumber: question.questionNumber || question.order + 1,
            userAnswer: userAnswer,
            isCorrect: userAnswer === question.correctAnswer
          }];

          console.log(`Pushing single type5 q ${question.questionNumber || question.order + 1}, userAnswer: ${userAnswer}, correct: ${question.correctAnswer}`);
          studentAnswers.push({
            questionNumber: question.questionNumber || question.order + 1,
            questionType: 'type5_reading_comprehension',
            userAnswer: userAnswer,
            correctAnswer: question.correctAnswer || null,
            _id: question._id
          });

          // Score single type5
          if (question.correctAnswer) {
            scoreTotal++;
            if (userAnswer && userAnswer === question.correctAnswer) {
              scoreObtained++;
            }
          }
        }
      } else {
        // For type1 and type2, simple answer structure
        const prefix = question.type.split('_')[0];
        const userAnswer = answers[`${prefix}-${question.questionNumber}`] || answers[`${prefix}-${question.order + 1}`] || '';
        detailedResult.studentAnswers = [{
          questionNumber: question.questionNumber || question.order + 1,
          userAnswer: userAnswer,
          isCorrect: userAnswer === question.correctAnswer
        }];

        // Add to studentAnswers
        studentAnswers.push({
          questionNumber: question.questionNumber || question.order + 1,
          questionType: question.type,
          userAnswer: userAnswer,
          correctAnswer: question.correctAnswer || null,
          _id: question._id
        });

        // Score for type1 and type2
        if (question.correctAnswer) {
          scoreTotal++;
          if (userAnswer && userAnswer === question.correctAnswer) {
            scoreObtained++;
          }
        }
      }

      detailedResults.push(detailedResult);
    });

    // Filter out question answers from the answers object (keep only non-question keys if any)
    const filteredAnswers = Object.fromEntries(Object.entries(answers).filter(([key]) =>
      !key.startsWith('type1-') &&
      !key.startsWith('type2-') &&
      !key.startsWith('type4-') &&
      !key.startsWith('type5-') &&
      !key.startsWith('gap-')
    ));

    // Sort studentAnswers by questionNumber to ensure correct order
    studentAnswers.sort((a, b) => a.questionNumber - b.questionNumber);

    console.log('Final studentAnswers before save:', studentAnswers);

    const result = new ReadingResult({
      student: studentId,
      assignment: assignmentId,
      paper: id,
      answers: filteredAnswers,
      studentAnswers,
      detailedResults,
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