require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('Starting seed...');

  // ---- LOCATIONS ----
  const locations = [
    { name_en: 'Port Said', name_ar: 'بورسعيد', code: 'portsaid' },
    { name_en: 'Ismailia', name_ar: 'الإسماعيلية', code: 'ismailia' },
    { name_en: 'Suez', name_ar: 'السويس', code: 'suez' },
    { name_en: 'South Sinai', name_ar: 'جنوب سيناء', code: 'south_sinai' },
    { name_en: 'Luxor', name_ar: 'الأقصر', code: 'luxor' },
    { name_en: 'Aswan', name_ar: 'أسوان', code: 'aswan' },
  ];

  console.log('Inserting locations...');
  const locationIds = {};
  for (const loc of locations) {
    const result = await db.query(
      `INSERT INTO locations (name_en, name_ar, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name_en = $1, name_ar = $2
       RETURNING id, code`,
      [loc.name_en, loc.name_ar, loc.code]
    );
    locationIds[loc.code] = result.rows[0].id;
  }
  console.log('Locations inserted:', locationIds);

  // ---- USERS (20 booking staff) ----
  const users = [
    { username: 'user01', full_name: 'Ahmed Mohamed', password: 'User@1234' },
    { username: 'user02', full_name: 'Sara Ali', password: 'User@1234' },
    { username: 'user03', full_name: 'Omar Hassan', password: 'User@1234' },
    { username: 'user04', full_name: 'Nour Ibrahim', password: 'User@1234' },
    { username: 'user05', full_name: 'Karim Youssef', password: 'User@1234' },
    { username: 'user06', full_name: 'Hana Mahmoud', password: 'User@1234' },
    { username: 'user07', full_name: 'Tarek Samir', password: 'User@1234' },
    { username: 'user08', full_name: 'Dina Walid', password: 'User@1234' },
    { username: 'user09', full_name: 'Yasser Fathy', password: 'User@1234' },
    { username: 'user10', full_name: 'Mariam Nabil', password: 'User@1234' },
    { username: 'user11', full_name: 'Khaled Ramadan', password: 'User@1234' },
    { username: 'user12', full_name: 'Rania Sayed', password: 'User@1234' },
    { username: 'user13', full_name: 'Mostafa Adel', password: 'User@1234' },
    { username: 'user14', full_name: 'Layla Gamal', password: 'User@1234' },
    { username: 'user15', full_name: 'Wael Tamer', password: 'User@1234' },
    { username: 'user16', full_name: 'Amira Ossama', password: 'User@1234' },
    { username: 'user17', full_name: 'Bassem Farouk', password: 'User@1234' },
    { username: 'user18', full_name: 'Eman Hossam', password: 'User@1234' },
    { username: 'user19', full_name: 'Sherif Magdi', password: 'User@1234' },
    { username: 'user20', full_name: 'Nada Ashraf', password: 'User@1234' },
  ];

  console.log('Inserting users...');
  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 12);
    await db.query(
      `INSERT INTO users (username, password_hash, full_name, role, location_id)
       VALUES ($1, $2, $3, 'user', NULL)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, full_name = $3`,
      [user.username, hash, user.full_name]
    );
  }
  console.log('20 users inserted. Password for all: User@1234');

  // ---- ADMINS (8 admins) ----
  // 6 location admins + 2 superadmins
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

  console.log('Inserting admins...');
  for (const admin of admins) {
    const hash = await bcrypt.hash(admin.password, 12);
    const locationId = admin.location ? locationIds[admin.location] : null;
    await db.query(
      `INSERT INTO users (username, password_hash, full_name, role, location_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, full_name = $3, role = $4, location_id = $5`,
      [admin.username, hash, admin.full_name, admin.role, locationId]
    );
  }
  console.log('8 admins inserted.');

  console.log('\n========== SEED COMPLETE ==========');
  console.log('User accounts (20): user01 - user20 | Password: User@1234');
  console.log('Location admins (6): admin_portsaid, admin_ismailia, admin_suez, admin_sinai, admin_luxor, admin_aswan | Password: Admin@1234');
  console.log('Super admins (2): superadmin1, superadmin2 | Password: Super@1234');
  console.log('====================================\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
