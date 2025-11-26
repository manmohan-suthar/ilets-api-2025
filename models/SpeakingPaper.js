const mongoose = require('mongoose');

const speakingPassageSchema = new mongoose.Schema({
  title: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  images: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  order: {
    type: Number,
    default: 0
  },
  unitNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
    default: 1
  },
  sectionTitle: {
    type: String,
    default: ''
  },
  globalIndex: {
    type: Number,
    default: 0
  },
  localIndex: {
    type: Number,
    default: 0
  }
});

const speakingQuestionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['multiple_choice', 'true_false_not_given', 'gap_fill', 'matching_headings', 'short_answer', 'sentence_completion']
  },
  question: {
    type: String,
    default: ''
  },
  instructions: {
    type: String,
    default: ''
  },
  // For multiple choice and true/false/not given
  options: [{
    letter: String,
    text: String
  }],
  // For gap fill and sentence completion
  gaps: [{
    position: Number,
    answer: String,
    maxWords: {
      type: Number,
      default: 3
    }
  }],
  // For matching headings
  headings: [String],
  passages: [{
    label: String, // A, B, C, etc.
    content: String
  }],
  // Common correct answer
  correctAnswer: mongoose.Schema.Types.Mixed,
  // Passage reference
  passageIndex: {
    type: Number,
    default: 0
  },
  order: {
    type: Number,
    default: 0
  }
});

const speakingPaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  passages: [speakingPassageSchema],
  questions: [speakingQuestionSchema],
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  createdBy: {
    type: String,
    required: true
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 60
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SpeakingPaper', speakingPaperSchema);