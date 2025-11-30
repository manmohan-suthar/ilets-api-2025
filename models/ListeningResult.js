const mongoose = require('mongoose');

const listeningResultSchema = new mongoose.Schema({
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
    ref: 'ListeningPaper',
    required: true
  },
  answers: {
    type: Map,
    of: String, // key: questionNumber (or key for blanks), value: answer
    required: true
  },
  studentAnswers: [{
    questionNumber: Number,
    questionType: String,
    userAnswer: String,
    correctAnswer: String,
    adminMarked: {
      type: Boolean,
      default: null // null = not marked, true = correct, false = incorrect
    }
  }],
  score: {
    type: Number,
    default: null, // calculated later, or for blanks it's manual
    min: 0,
    max: 40 // assuming IELTS listening max score
  },
  scoreTotal: {
    type: Number,
    default: 0
  },
  scoreObtained: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
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
  }
}, {
  timestamps: true
});

// Index for efficient queries
listeningResultSchema.index({ student: 1, assignment: 1 }, { unique: true });

module.exports = mongoose.model('ListeningResult', listeningResultSchema);