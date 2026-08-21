const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Generate slots for a location on a given date if not already generated
async function generateSlotsForDate(locationId, date) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check if slots already exist for this location+date
    const existing = await client.query(
      'SELECT COUNT(*) FROM slots WHERE location_id = $1 AND slot_date = $2',
      [locationId, date]
    );

    if (parseInt(existing.rows[0].count) > 0) {
      await client.query('COMMIT');
      return; // Already generated
    }

    // Slot generation:
    // 8:30 to 13:15 in 15-min blocks = 20 blocks total
    // Blocks 1-15 (8:30 to 11:45): regular, capacity 4 each = 60 regular slots
    // Blocks 16-20 (12:00 to 13:00): urgent, capacity 2 each = 10 urgent slots
    const slots = [];
    let hour = 8;
    let minute = 30;

    for (let i = 0; i < 20; i++) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      const slotType = i < 15 ? 'regular' : 'urgent';
      const capacity = i < 15 ? 4 : 2;
      slots.push({ time: timeStr, type: slotType, capacity });

      minute += 15;
      if (minute >= 60) {
        minute -= 60;
        hour += 1;
      }
    }

    for (const slot of slots) {
      await client.query(
        'INSERT INTO slots (location_id, slot_date, slot_time, slot_type, capacity, booked_count) VALUES ($1, $2, $3, $4, $5, 0)',
        [locationId, date, slot.time, slot.type, slot.capacity]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/slots?location_id=1&date=2026-08-21
router.get('/', authenticate, async (req, res) => {
  const { location_id, date } = req.query;

  if (!location_id || !date) {
    return res.status(400).json({ error: 'location_id and date are required' });
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Don't allow past dates
  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ error: 'Cannot view slots for past dates' });
  }

  try {
    // Auto-generate slots if needed
    await generateSlotsForDate(parseInt(location_id), date);

    const result = await db.query(
      `SELECT s.id, s.slot_time, s.slot_type, s.capacity, s.booked_count,
              (s.capacity - s.booked_count) as available
       FROM slots s
       WHERE s.location_id = $1 AND s.slot_date = $2
       ORDER BY s.slot_time`,
      [location_id, date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Slots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, generateSlotsForDate };
