const mongoose = require('mongoose');

const readingPassageSchema = new mongoose.Schema({
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
    max: 5,
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

const readingQuestionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['type1_word_replacement', 'type2_gap_fill', 'type3_sentence_completion', 'type4_matching_headings', 'type5_reading_comprehension']
  },
  // Common fields
  question: {
    type: String,
    default: ''
  },
  instructions: {
    type: String,
    default: ''
  },
  passageIndex: {
    type: Number,
    default: 0
  },
  order: {
    type: Number,
    default: 0
  },
  unitNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    default: 1
  },
  questionNumber: {
    type: Number,
    default: 0
  },

  // Type 1: Word replacement (A, B, C, D options, one correct)
  options: [{
    letter: String, // A, B, C, D
    text: String
  }],
  correctAnswer: {
    type: String,
    default: ''
  },

  // Type 2: Gap fill (multiple gaps, 3 options each: A, B, C)
  gaps: [{
    gapNumber: Number,
    options: [{
      letter: String, // A, B, C
      text: String
    }],
    correctAnswer: String
  }],

  // Type 3: Sentence completion (drag and drop sentences A-H into gaps)
  sentences: [{
    letter: String, // A, B, C, D, E, F, G, H
    text: String,
    isExtra: {
      type: Boolean,
      default: false
    }
  }],
  gapMappings: [{
    gapNumber: Number,
    correctSentence: String // Letter of correct sentence
  }],

  // Type 4: Matching headings (questions matched to texts A-D)
  texts: [{
    letter: String, // A, B, C, D
    content: String
  }],
  matchingQuestions: [{
    questionNumber: Number,
    question: String,
    correctText: String // Letter of correct text A-D
  }],

  // Type 5: Reading comprehension (various question types)
  comprehensionQuestions: [{
    questionNumber: Number,
    question: String,
    questionType: {
      type: String,
      enum: ['multiple_choice', 'true_false', 'short_answer', 'gap_fill']
    },
    options: [{
      letter: String,
      text: String
    }],
    correctAnswer: String,
    maxWords: {
      type: Number,
      default: 3
    }
  }]
});

const readingPaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  passages: [readingPassageSchema],
  questions: [readingQuestionSchema],
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

module.exports = mongoose.model('ReadingPaper', readingPaperSchema);