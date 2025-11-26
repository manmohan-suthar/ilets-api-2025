const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  questionType: {
    type: String,
    required: true,
    enum: ['multiple-choice', 'Blank_in_Space']
  },
  question: {
    type: String,
    default: '',
    trim: true
  },
  audioTimestamp: {
    type: String,
    default: ''
  },
  options: [{
    letter: {
      type: String,
      required: true,
      enum: ['A', 'B', 'C', 'D']
    },
    text: {
      type: String,
      default: ''
    }
  }],
  correctAnswer: {
    type: String,
    enum: ['A', 'B', 'C', 'D']
  }
});

const sectionSchema = new mongoose.Schema({
  sectionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  audioFile: {
    type: String // path to audio file
  },
  audioUrl: {
    type: String // alternative audio URL
  },
  startTime: {
    type: String,
    default: '00:00'
  },
  questions: [questionSchema]
});

const listeningPaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sections: [sectionSchema],
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  createdBy: {
    type: String, // admin username
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ListeningPaper', listeningPaperSchema);