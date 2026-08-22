const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Generate slots for a location on a given date if not already generated
async function generateSlotsForDate(locationId, date) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT COUNT(*) FROM slots WHERE location_id = $1 AND slot_date = $2',
      [locationId, date]
    );

    if (parseInt(existing.rows[0].count) > 0) {
      await client.query('COMMIT');
      return;
    }

    // 8:30 to 13:15 in 15-min blocks = 20 blocks total
    // Blocks 1-15: regular, capacity 4 each = 60
    // Blocks 16-20: urgent, capacity 2 each = 10
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
        'INSERT INTO slots (location_id, slot_date, slot_time, slot_type, capacity, booked_count, is_blocked) VALUES ($1, $2, $3, $4, $5, 0, false)',
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

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ error: 'Cannot view slots for past dates' });
  }

  try {
    await generateSlotsForDate(parseInt(location_id), date);

    const result = await db.query(
      `SELECT s.id, s.slot_time, s.slot_type, s.capacity, s.booked_count,
              s.is_blocked, s.blocked_reason,
              CASE WHEN s.is_blocked THEN 0 ELSE (s.capacity - s.booked_count) END as available
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

// GET /api/slots/admin?location_id=1&date=2026-08-21 — admin view with full details
router.get('/admin', authenticate, requireAdmin, async (req, res) => {
  const { location_id, date } = req.query;

  if (!location_id || !date) {
    return res.status(400).json({ error: 'location_id and date are required' });
  }

  // Location admin can only view their own location
  if (req.user.role === 'admin' && parseInt(location_id) !== req.user.location_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await generateSlotsForDate(parseInt(location_id), date);

    const result = await db.query(
      `SELECT s.id, s.slot_time, s.slot_type, s.capacity, s.booked_count,
              s.is_blocked, s.blocked_reason,
              (s.capacity - s.booked_count) as available
       FROM slots s
       WHERE s.location_id = $1 AND s.slot_date = $2
       ORDER BY s.slot_time`,
      [location_id, date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Admin slots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/slots/:id/block — block a single slot
router.patch('/:id/block', authenticate, requireAdmin, async (req, res) => {
  const { reason } = req.body;
  const slotId = parseInt(req.params.id);

  try {
    // Check location access for location-scoped admins
    const slotResult = await db.query('SELECT * FROM slots WHERE id = $1', [slotId]);
    if (slotResult.rows.length === 0) return res.status(404).json({ error: 'Slot not found' });

    const slot = slotResult.rows[0];
    if (req.user.role === 'admin' && slot.location_id !== req.user.location_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query(
      'UPDATE slots SET is_blocked = true, blocked_reason = $1 WHERE id = $2',
      [reason || null, slotId]
    );

    res.json({ message: 'Slot blocked successfully' });
  } catch (err) {
    console.error('Block slot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/slots/:id/unblock — unblock a single slot
router.patch('/:id/unblock', authenticate, requireAdmin, async (req, res) => {
  const slotId = parseInt(req.params.id);

  try {
    const slotResult = await db.query('SELECT * FROM slots WHERE id = $1', [slotId]);
    if (slotResult.rows.length === 0) return res.status(404).json({ error: 'Slot not found' });

    const slot = slotResult.rows[0];
    if (req.user.role === 'admin' && slot.location_id !== req.user.location_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query(
      'UPDATE slots SET is_blocked = false, blocked_reason = NULL WHERE id = $1',
      [slotId]
    );

    res.json({ message: 'Slot unblocked successfully' });
  } catch (err) {
    console.error('Unblock slot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/slots/block-day — block all slots for a location on a date
router.post('/block-day', authenticate, requireAdmin, async (req, res) => {
  const { location_id, date, reason } = req.body;

  if (!location_id || !date) {
    return res.status(400).json({ error: 'location_id and date are required' });
  }

  if (req.user.role === 'admin' && parseInt(location_id) !== req.user.location_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    // Generate slots first if needed
    await generateSlotsForDate(parseInt(location_id), date);

    await db.query(
      'UPDATE slots SET is_blocked = true, blocked_reason = $1 WHERE location_id = $2 AND slot_date = $3',
      [reason || null, location_id, date]
    );

    res.json({ message: 'All slots blocked for this date' });
  } catch (err) {
    console.error('Block day error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/slots/unblock-day — unblock all slots for a location on a date
router.post('/unblock-day', authenticate, requireAdmin, async (req, res) => {
  const { location_id, date } = req.body;

  if (!location_id || !date) {
    return res.status(400).json({ error: 'location_id and date are required' });
  }

  if (req.user.role === 'admin' && parseInt(location_id) !== req.user.location_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await db.query(
      'UPDATE slots SET is_blocked = false, blocked_reason = NULL WHERE location_id = $1 AND slot_date = $2',
      [location_id, date]
    );

    res.json({ message: 'All slots unblocked for this date' });
  } catch (err) {
    console.error('Unblock day error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, generateSlotsForDate };
