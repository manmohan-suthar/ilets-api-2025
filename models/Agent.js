const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  agent_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'agent',
    enum: ['agent']
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  assignedExams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAssignment'
  }],
  currentSession: {
    examAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamAssignment'
    },
    startTime: Date,
    isActive: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
agentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
agentSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
agentSchema.methods.toJSON = function() {
  const agentObject = this.toObject();
  delete agentObject.password;
  return agentObject;
};

module.exports = mongoose.model('Agent', agentSchema);