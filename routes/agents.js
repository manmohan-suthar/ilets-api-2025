const express = require('express');
const Agent = require('../models/Agent');
const ExamAssignment = require('../models/ExamAssignment');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Get all agents (admin only)
router.get('/', async (req, res) => {
  try {
    const agents = await Agent.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ agents });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new agent (admin only)
router.post('/', async (req, res) => {
  try {
    const { name, agent_id, password } = req.body;

    if (!name || !agent_id || !password) {
      return res.status(400).json({ error: 'Name, agent ID, and password are required' });
    }

    // Check if agent ID already exists
    const existingAgent = await Agent.findOne({ agent_id: agent_id.toUpperCase() });
    if (existingAgent) {
      return res.status(400).json({ error: 'Agent ID already exists' });
    }

    const agent = new Agent({
      name,
      agent_id: agent_id.toUpperCase(),
      password
    });

    await agent.save();

    // Return agent without password
    const agentResponse = agent.toJSON();
    res.status(201).json({
      message: 'Agent created successfully',
      agent: agentResponse
    });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update agent (admin only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow password updates through this route
    delete updates.password;

    const agent = await Agent.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.status(200).json({
      message: 'Agent updated successfully',
      agent
    });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete agent (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if agent has assigned exams
    const assignedExams = await ExamAssignment.find({ agent: id });
    if (assignedExams.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete agent with assigned exams. Please reassign exams first.'
      });
    }

    const agent = await Agent.findByIdAndDelete(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.status(200).json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent login
router.post('/login', async (req, res) => {
  try {
    const { agent_id, password } = req.body;

    if (!agent_id || !password) {
      return res.status(400).json({ error: 'Agent ID and password are required' });
    }

    // Find agent by agent_id
    const agent = await Agent.findOne({ agent_id: agent_id.toUpperCase() });
    if (!agent) {
      return res.status(401).json({ error: 'Invalid agent ID or password' });
    }

    // Check password
    const isValidPassword = await agent.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid agent ID or password' });
    }

    // Check if agent is active
    if (agent.status !== 'active') {
      return res.status(401).json({ error: 'Agent account is inactive' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { agentId: agent._id, agent_id: agent.agent_id, role: 'agent' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' }
    );

    // Get assigned exams
    const assignedExams = await ExamAssignment.find({ agent: agent._id })
      .populate('student', 'name student_id')
      .populate('pc', 'macAddress pcName')
      .sort({ exam_date: 1, exam_time: 1 });

    res.status(200).json({
      message: 'Login successful',
      agent: {
        _id: agent._id,
        name: agent.name,
        agent_id: agent.agent_id,
        role: agent.role,
        status: agent.status
      },
      token,
      assignedExams
    });
  } catch (error) {
    console.error('Agent login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get agent's assigned exams
router.get('/:id/assigned-exams', async (req, res) => {
  try {
    const { id } = req.params;

    const assignedExams = await ExamAssignment.find({ agent: id })
      .populate('student', 'name student_id')
      .populate('pc', 'macAddress pcName')
      .sort({ exam_date: 1, exam_time: 1 });

    res.status(200).json({ assignedExams });
  } catch (error) {
    console.error('Get assigned exams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start monitoring exam session
router.post('/:agentId/start-monitoring/:examId', async (req, res) => {
  try {
    const { agentId, examId } = req.params;

    // Update agent's current session
    await Agent.findByIdAndUpdate(agentId, {
      currentSession: {
        examAssignment: examId,
        startTime: new Date(),
        isActive: true
      }
    });

    // Update exam assignment status if needed
    await ExamAssignment.findByIdAndUpdate(examId, {
      status: 'in_progress'
    });

    res.status(200).json({ message: 'Monitoring session started' });
  } catch (error) {
    console.error('Start monitoring error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End monitoring exam session
router.post('/:agentId/end-monitoring/:examId', async (req, res) => {
  try {
    const { agentId, examId } = req.params;

    // Clear agent's current session
    await Agent.findByIdAndUpdate(agentId, {
      currentSession: {
        examAssignment: null,
        startTime: null,
        isActive: false
      }
    });

    res.status(200).json({ message: 'Monitoring session ended' });
  } catch (error) {
    console.error('End monitoring error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;