const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  centerName: {
    type: String,
    required: true,
    trim: true
  },
  centerAddress: {
    type: String,
    required: true,
    trim: true
  },
  pcName: {
    type: String,
    required: true,
    trim: true
  },
  macAddress: {
    type: String,
    required: true,
    trim: true
  },
  uuid: {
    type: String,
    required: true,
    unique: true
  },
  hostname: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'inactive']
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }
});

module.exports = mongoose.model('Registration', registrationSchema);