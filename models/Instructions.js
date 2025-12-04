const mongoose = require('mongoose');

const instructionsSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['listening', 'reading', 'writing'],
    unique: true
  },
  content: {
    type: String,
    default: '',
    trim: true
  },
  createdBy: {
    type: String, // admin username
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Instructions', instructionsSchema);