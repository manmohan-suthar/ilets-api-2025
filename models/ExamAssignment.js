const mongoose = require('mongoose');

const examAssignmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  exam_type: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length > 0 && v.every(type => ['writing', 'speaking', 'listening', 'reading'].includes(type));
      },
      message: 'exam_type must be an array of valid exam types'
    }
  },
  exam_paper: {
    type: Object,
    required: true,
    // Structure: { reading: ObjectId, writing: ObjectId, listening: ObjectId, speaking: ObjectId }
  },
  exam_date: {
    type: Date,
    required: true
  },
  exam_time: {
    type: String, // HH:MM format
    required: true
  },
  duration: {
    type: Number, // minutes
    default: 60
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'assigned'
  },
  is_visible: {
    type: Boolean,
    default: false
  },
  exam_tittle: {
    type: String,
    required: true
  },
  exam_bio: {
    type: String,
    required: true
  },
  pc: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  },
  examStarted: {
    type: Boolean,
    default: false
  },
  startedAt: {
    type: Date,
    default: null
  },
  auto_login_time: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ExamAssignment', examAssignmentSchema);