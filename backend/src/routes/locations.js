const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/locations - public, no auth needed
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name_en, name_ar, code FROM locations WHERE is_active = true ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Locations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
