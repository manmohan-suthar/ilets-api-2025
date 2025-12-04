const express = require('express');
const Instructions = require('../models/Instructions');

const router = express.Router();

// Get instructions for a category (public route for students)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    if (!category || !['listening', 'reading', 'writing'].includes(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }

    const instruction = await Instructions.findOne({ category });
    if (!instruction) {
      return res.status(200).json({ instruction: { category, content: '' } });
    }

    res.status(200).json({ instruction });
  } catch (error) {
    console.error('Get instructions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;