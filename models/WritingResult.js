const mongoose = require('mongoose');

const writingResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAssignment',
    required: true
  },
  paper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WritingPaper',
    required: true
  },
  answers: {
    type: Map,
    of: String, // key: taskNumber, value: answer text
    required: true
  },
  studentAnswers: [{
    taskNumber: Number,
    answer: String,
    wordCount: Number,
    adminScore: {
      type: Number,
      default: null,
      min: 0,
      max: 9 // IELTS writing task scores are typically 0-9
    }
  }],
  score: {
    type: Number,
    default: null, // manual grading
    min: 0,
    max: 20 // assuming IELTS writing max score per task or total
  },
  scoreTotal: {
    type: Number,
    default: 0
  },
  scoreObtained: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'reviewed'],
    default: 'submitted'
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin' // or Agent?
  },
  gradedAt: {
    type: Date
  },
  feedback: {
    type: String
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
writingResultSchema.index({ student: 1, assignment: 1 }, { unique: true });

module.exports = mongoose.model('WritingResult', writingResultSchema);