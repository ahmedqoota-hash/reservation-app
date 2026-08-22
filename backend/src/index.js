require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy (needed for Railway/Render)
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/slots', require('./routes/slots').router);
app.use('/api/bookings', require('./routes/bookings'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// One-time seed endpoint — protected by a secret key
app.post('/api/seed', async (req, res) => {
  if (req.headers['x-seed-key'] !== 'seed-reservation-2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const bcrypt = require('bcryptjs');
    const db = require('./db');

    const locations = [
      { name_en: 'Port Said', name_ar: 'بورسعيد', code: 'portsaid' },
      { name_en: 'Ismailia', name_ar: 'الإسماعيلية', code: 'ismailia' },
      { name_en: 'Suez', name_ar: 'السويس', code: 'suez' },
      { name_en: 'South Sinai', name_ar: 'جنوب سيناء', code: 'south_sinai' },
      { name_en: 'Luxor', name_ar: 'الأقصر', code: 'luxor' },
      { name_en: 'Aswan', name_ar: 'أسوان', code: 'aswan' },
    ];

    const locationIds = {};
    for (const loc of locations) {
      const result = await db.query(
        `INSERT INTO locations (name_en, name_ar, code) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name_en = $1, name_ar = $2 RETURNING id, code`,
        [loc.name_en, loc.name_ar, loc.code]
      );
      locationIds[loc.code] = result.rows[0].id;
    }

    const users = [
      { username: 'user01', full_name: 'Ahmed Mohamed' },
      { username: 'user02', full_name: 'Sara Ali' },
      { username: 'user03', full_name: 'Omar Hassan' },
      { username: 'user04', full_name: 'Nour Ibrahim' },
      { username: 'user05', full_name: 'Karim Youssef' },
      { username: 'user06', full_name: 'Hana Mahmoud' },
      { username: 'user07', full_name: 'Tarek Samir' },
      { username: 'user08', full_name: 'Dina Walid' },
      { username: 'user09', full_name: 'Yasser Fathy' },
      { username: 'user10', full_name: 'Mariam Nabil' },
      { username: 'user11', full_name: 'Khaled Ramadan' },
      { username: 'user12', full_name: 'Rania Sayed' },
      { username: 'user13', full_name: 'Mostafa Adel' },
      { username: 'user14', full_name: 'Layla Gamal' },
      { username: 'user15', full_name: 'Wael Tamer' },
      { username: 'user16', full_name: 'Amira Ossama' },
      { username: 'user17', full_name: 'Bassem Farouk' },
      { username: 'user18', full_name: 'Eman Hossam' },
      { username: 'user19', full_name: 'Sherif Magdi' },
      { username: 'user20', full_name: 'Nada Ashraf' },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash('User@1234', 12);
      await db.query(
        `INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, 'user')
         ON CONFLICT (username) DO UPDATE SET password_hash = $2, full_name = $3`,
        [u.username, hash, u.full_name]
      );
    }

    const admins = [
      { username: 'admin_portsaid', full_name: 'Admin Port Said', password: 'Admin@1234', role: 'admin', location: 'portsaid' },
      { username: 'admin_ismailia', full_name: 'Admin Ismailia', password: 'Admin@1234', role: 'admin', location: 'ismailia' },
      { username: 'admin_suez', full_name: 'Admin Suez', password: 'Admin@1234', role: 'admin', location: 'suez' },
      { username: 'admin_sinai', full_name: 'Admin South Sinai', password: 'Admin@1234', role: 'admin', location: 'south_sinai' },
      { username: 'admin_luxor', full_name: 'Admin Luxor', password: 'Admin@1234', role: 'admin', location: 'luxor' },
      { username: 'admin_aswan', full_name: 'Admin Aswan', password: 'Admin@1234', role: 'admin', location: 'aswan' },
      { username: 'superadmin1', full_name: 'Super Admin One', password: 'Super@1234', role: 'superadmin', location: null },
      { username: 'superadmin2', full_name: 'Super Admin Two', password: 'Super@1234', role: 'superadmin', location: null },
    ];

    for (const a of admins) {
      const hash = await bcrypt.hash(a.password, 12);
      const locationId = a.location ? locationIds[a.location] : null;
      await db.query(
        `INSERT INTO users (username, password_hash, full_name, role, location_id) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO UPDATE SET password_hash = $2, full_name = $3, role = $4, location_id = $5`,
        [a.username, hash, a.full_name, a.role, locationId]
      );
    }

    res.json({ success: true, message: 'Seed completed: 6 locations, 20 users, 8 admins created.' });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
