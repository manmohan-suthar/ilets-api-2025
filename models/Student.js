const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  student_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  dob: {
    type: Date,
    required: true
  },
  student_photo: {
    type: String,
    required: true
  },
  unr: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  nationality: {
    type: String,
    required: true,
    trim: true
  },
  roll_no: {
    type: String,
    trim: true
  },
  test_date: {
    type: Date
  },
  role: {
    type: String,
    default: 'student'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);