const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generateSlotsForDate } = require('./slots');

// Generate a short unique reference
function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'RES-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

// POST /api/bookings - create a booking
router.post('/', authenticate, async (req, res) => {
  const { slot_id, customer_name, customer_phone, customer_id_number, customer_workplace } = req.body;

  if (!slot_id || !customer_name || !customer_phone || !customer_id_number || !customer_workplace) {
    return res.status(400).json({ error: 'All fields are required: slot_id, customer_name, customer_phone, customer_id_number, customer_workplace' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock the slot row to prevent concurrent bookings
    const slotResult = await client.query(
      'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
      [slot_id]
    );

    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Slot not found' });
    }

    const slot = slotResult.rows[0];

    // Check if slot is blocked
    if (slot.is_blocked) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This slot is blocked by admin' });
    }

    // Check if slot date is in the past
    const today = new Date().toISOString().split('T')[0];
    if (slot.slot_date.toISOString().split('T')[0] < today) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot book a past slot' });
    }

    // Check availability
    if (slot.booked_count >= slot.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This slot is fully booked' });
    }

    // Generate unique reference
    let reference;
    let refExists = true;
    while (refExists) {
      reference = generateReference();
      const refCheck = await client.query('SELECT id FROM bookings WHERE reference = $1', [reference]);
      refExists = refCheck.rows.length > 0;
    }

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (reference, slot_id, user_id, customer_name, customer_phone, customer_id_number, customer_workplace, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING *`,
      [reference, slot_id, req.user.id, customer_name.trim(), customer_phone.trim(), customer_id_number.trim(), customer_workplace.trim()]
    );

    // Increment booked_count
    await client.query(
      'UPDATE slots SET booked_count = booked_count + 1 WHERE id = $1',
      [slot_id]
    );

    await client.query('COMMIT');

    // Return booking with slot details
    const fullBooking = await db.query(
      `SELECT b.*, s.slot_time, s.slot_date, s.slot_type, l.name_en as location_name_en, l.name_ar as location_name_ar
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN locations l ON s.location_id = l.id
       WHERE b.id = $1`,
      [bookingResult.rows[0].id]
    );

    res.status(201).json(fullBooking.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/bookings/my - get current user's bookings
router.get('/my', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, s.slot_time, s.slot_date, s.slot_type,
              l.name_en as location_name_en, l.name_ar as location_name_ar
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN locations l ON s.location_id = l.id
       WHERE b.user_id = $1
       ORDER BY s.slot_date DESC, s.slot_time DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('My bookings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bookings/reference/:ref - get booking by reference
router.get('/reference/:ref', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, s.slot_time, s.slot_date, s.slot_type,
              l.name_en as location_name_en, l.name_ar as location_name_ar,
              l.id as location_id
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN locations l ON s.location_id = l.id
       WHERE b.reference = $1`,
      [req.params.ref.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = result.rows[0];

    // Users can only view their own bookings; admins can view their location's bookings
    if (req.user.role === 'user' && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'admin' && booking.location_id !== req.user.location_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(booking);
  } catch (err) {
    console.error('Reference lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bookings/:id - edit a booking (change slot)
router.put('/:id', authenticate, async (req, res) => {
  const { slot_id, customer_name, customer_phone, customer_id_number, customer_workplace } = req.body;
  const bookingId = parseInt(req.params.id);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Get existing booking
    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Only the booking owner or admin can edit
    if (req.user.role === 'user' && booking.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Can only edit active bookings' });
    }

    let newSlotId = booking.slot_id;

    // If changing slot
    if (slot_id && slot_id !== booking.slot_id) {
      // Lock new slot
      const newSlotResult = await client.query(
        'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
        [slot_id]
      );

      if (newSlotResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'New slot not found' });
      }

      const newSlot = newSlotResult.rows[0];

      const today = new Date().toISOString().split('T')[0];
      if (newSlot.slot_date.toISOString().split('T')[0] < today) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot book a past slot' });
      }

      if (newSlot.booked_count >= newSlot.capacity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'New slot is fully booked' });
      }

      // Release old slot
      await client.query(
        'UPDATE slots SET booked_count = booked_count - 1 WHERE id = $1',
        [booking.slot_id]
      );

      // Book new slot
      await client.query(
        'UPDATE slots SET booked_count = booked_count + 1 WHERE id = $1',
        [slot_id]
      );

      newSlotId = slot_id;
    }

    // Update booking details
    const updatedBooking = await client.query(
      `UPDATE bookings
       SET slot_id = $1,
           customer_name = COALESCE($2, customer_name),
           customer_phone = COALESCE($3, customer_phone),
           customer_id_number = COALESCE($4, customer_id_number),
           customer_workplace = COALESCE($5, customer_workplace)
       WHERE id = $6
       RETURNING *`,
      [
        newSlotId,
        customer_name ? customer_name.trim() : null,
        customer_phone ? customer_phone.trim() : null,
        customer_id_number ? customer_id_number.trim() : null,
        customer_workplace ? customer_workplace.trim() : null,
        bookingId,
      ]
    );

    await client.query('COMMIT');

    const fullBooking = await db.query(
      `SELECT b.*, s.slot_time, s.slot_date, s.slot_type, l.name_en as location_name_en, l.name_ar as location_name_ar
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN locations l ON s.location_id = l.id
       WHERE b.id = $1`,
      [bookingId]
    );

    res.json(fullBooking.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/bookings/:id - cancel a booking
router.delete('/:id', authenticate, async (req, res) => {
  const bookingId = parseInt(req.params.id);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Permission check
    if (req.user.role === 'user' && booking.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking is already cancelled or completed' });
    }

    // Cancel booking
    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [bookingId]
    );

    // Release slot
    await client.query(
      'UPDATE slots SET booked_count = GREATEST(0, booked_count - 1) WHERE id = $1',
      [booking.slot_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ---- ADMIN ROUTES ----

// GET /api/bookings/admin - admin view bookings
router.get('/admin', authenticate, requireAdmin, async (req, res) => {
  const { location_id, date, status, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let conditions = [];
  let params = [];
  let paramIndex = 1;

  // Location-scoped admin can only see their own location
  if (req.user.role === 'admin') {
    conditions.push(`s.location_id = $${paramIndex++}`);
    params.push(req.user.location_id);
  } else if (location_id) {
    conditions.push(`s.location_id = $${paramIndex++}`);
    params.push(parseInt(location_id));
  }

  if (date) {
    conditions.push(`s.slot_date = $${paramIndex++}`);
    params.push(date);
  }

  if (status) {
    conditions.push(`b.status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       ${whereClause}`,
      params
    );

    const result = await db.query(
      `SELECT b.*, s.slot_time, s.slot_date, s.slot_type,
              l.name_en as location_name_en, l.name_ar as location_name_ar,
              l.id as location_id,
              u.username as booked_by_username, u.full_name as booked_by_name
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN locations l ON s.location_id = l.id
       JOIN users u ON b.user_id = u.id
       ${whereClause}
       ORDER BY s.slot_date DESC, s.slot_time ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      bookings: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Admin bookings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bookings/admin/stats - dashboard stats
router.get('/admin/stats', authenticate, requireAdmin, async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  let locationFilter = '';
  let params = [targetDate];

  if (req.user.role === 'admin') {
    locationFilter = 'AND s.location_id = $2';
    params.push(req.user.location_id);
  }

  try {
    const stats = await db.query(
      `SELECT
         l.id as location_id,
         l.name_en,
         l.name_ar,
         COUNT(b.id) FILTER (WHERE b.status = 'active') as active_bookings,
         COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
         COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
         SUM(s.capacity) FILTER (WHERE s.slot_type = 'regular') as regular_capacity,
         SUM(s.booked_count) FILTER (WHERE s.slot_type = 'regular') as regular_booked,
         SUM(s.capacity) FILTER (WHERE s.slot_type = 'urgent') as urgent_capacity,
         SUM(s.booked_count) FILTER (WHERE s.slot_type = 'urgent') as urgent_booked
       FROM locations l
       LEFT JOIN slots s ON s.location_id = l.id AND s.slot_date = $1
       LEFT JOIN bookings b ON b.slot_id = s.id ${locationFilter}
       ${req.user.role === 'admin' ? 'WHERE l.id = $2' : ''}
       GROUP BY l.id, l.name_en, l.name_ar
       ORDER BY l.id`,
      params
    );

    res.json({ date: targetDate, locations: stats.rows });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/bookings/admin/:id/status - update booking status
router.patch('/admin/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const bookingId = parseInt(req.params.id);

  if (!['active', 'cancelled', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT b.*, s.location_id FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       WHERE b.id = $1 FOR UPDATE`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Location-scoped admin check
    if (req.user.role === 'admin' && booking.location_id !== req.user.location_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    // If cancelling an active booking, release the slot
    if (booking.status === 'active' && status === 'cancelled') {
      await client.query(
        'UPDATE slots SET booked_count = GREATEST(0, booked_count - 1) WHERE id = $1',
        [booking.slot_id]
      );
    }

    // If re-activating a cancelled booking, check slot availability
    if (booking.status === 'cancelled' && status === 'active') {
      const slotResult = await client.query(
        'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
        [booking.slot_id]
      );
      const slot = slotResult.rows[0];
      if (slot.booked_count >= slot.capacity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Slot is fully booked, cannot re-activate' });
      }
      await client.query(
        'UPDATE slots SET booked_count = booked_count + 1 WHERE id = $1',
        [booking.slot_id]
      );
    }

    await client.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, bookingId]);
    await client.query('COMMIT');

    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
