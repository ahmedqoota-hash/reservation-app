-- =============================================
-- RESERVATION SYSTEM DATABASE SCHEMA
-- =============================================

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (staff who make bookings + admins)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin', 'superadmin')),
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slots table: generated daily per location
-- 60 regular + 10 urgent per location per day
-- Time blocks: 8:30am - 1:30pm, every 15 mins
-- Regular: 8:30 - 13:15 (60 slots x 5 mins... adjusted to 15-min blocks)
-- 8:30 to 1:30 = 300 mins / 15 = 20 blocks
-- We'll use capacity per block: regular blocks hold 3 (20x3=60), urgent blocks hold 1 (10x1=10) at end
CREATE TABLE IF NOT EXISTS slots (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  slot_type VARCHAR(10) NOT NULL CHECK (slot_type IN ('regular', 'urgent')),
  capacity INTEGER NOT NULL DEFAULT 1,
  booked_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, slot_date, slot_time)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(20) UNIQUE NOT NULL,
  slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_id_number VARCHAR(50) NOT NULL,
  customer_workplace VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast slot lookups
CREATE INDEX IF NOT EXISTS idx_slots_location_date ON slots(location_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(reference);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- =============================================
-- SLOT GENERATION LOGIC (run daily via API)
-- Generates slots for a given date if not exists
-- Regular slots: 8:30 to 13:00 (19 blocks x 15min) = capacity 3 each = 57 + 3 = need adjustment
-- Let's do: 8:30-12:45 = 17 slots x capacity 4 = 68 -> too many
-- Correct: 60 regular in 15-min blocks across 8:30-13:00
-- 8:30 to 13:00 = 270 mins / 15 = 18 blocks (capacity per block = ~3.3)
-- Better approach: 20 time blocks, first 15 = regular (capacity 4 each = 60), last 5 = urgent (capacity 2 each = 10)
-- Time: 8:30, 8:45, 9:00 ... each +15min
-- Block 1-15 (8:30-11:45): regular, capacity 4 each = 60 regular slots
-- Block 16-20 (12:00-13:00): urgent, capacity 2 each = 10 urgent slots  
-- Total: 8:30 to 13:15 (last block ends 13:15, within 13:30 window) ✓
-- =============================================
