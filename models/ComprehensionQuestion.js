const mongoose = require('mongoose');

const comprehensionQuestionSchema = new mongoose.Schema({
  readingPaperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReadingPaper',
    required: true
  },
  passageIndex: {
    type: Number,
    required: true
  },
  questionNumber: {
    type: Number,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'short_answer', 'gap_fill'],
    required: true
  },
  options: [{
    letter: String,
    text: String
  }],
  correctAnswer: {
    type: String,
    required: true
  },
  maxWords: {
    type: Number,
    default: 3
  },
  unitNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ComprehensionQuestion', comprehensionQuestionSchema);