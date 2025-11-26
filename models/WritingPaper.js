const mongoose = require('mongoose');

const writingTaskSchema = new mongoose.Schema({
  taskNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 4
  },
  title: {
    type: String,
    default: ''
  },
  instructions: {
    type: String,
    default: ''
  },
  prompt: {
    type: String,
    default: ''
  },
  wordCount: {
    type: Number,
    default: 150 // Task 1: 150, Task 2: 250
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 20
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
  }
});

const writingPaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  tasks: [writingTaskSchema],
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

module.exports = mongoose.model('WritingPaper', writingPaperSchema);