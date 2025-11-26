const mongoose = require('mongoose');

const loginSessionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  pc: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAssignment',
    required: true
  },
  loginTime: {
    type: Date,
    default: null
  },
  autoLoginTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['scheduled', 'logged_in', 'completed'],
    default: 'scheduled'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LoginSession', loginSessionSchema);