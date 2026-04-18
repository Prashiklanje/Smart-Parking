-- Smart Parking — PostgreSQL schema
-- Run once in pgAdmin (Query Tool on database smart_parking) or auto-applied on server start.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  wallet_balance NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS parking_areas (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  layout_matrix JSONB NOT NULL,
  entry_point JSONB NOT NULL,
  slots JSONB NOT NULL,
  total_slots INT NOT NULL DEFAULT 0,
  price_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 0,
  vehicle_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  timings TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_areas_owner ON parking_areas (owner_id);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicles_user_plate_unique UNIQUE (user_id, vehicle_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles (UPPER(vehicle_number));

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  parking_area_id TEXT NOT NULL REFERENCES parking_areas (id) ON DELETE CASCADE,
  slot_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  hours NUMERIC(10, 2),
  total_price NUMERIC(12, 2),
  status TEXT NOT NULL,
  punch_in_time TIMESTAMPTZ,
  punch_out_time TIMESTAMPTZ,
  punch_type TEXT,
  payment_status TEXT,
  payment_intent_id TEXT,
  paid_amount NUMERIC(12, 2),
  paid_at TIMESTAMPTZ,
  imported BOOLEAN NOT NULL DEFAULT FALSE,
  import_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_area ON bookings (parking_area_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  amount_paise INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'inr',
  status TEXT NOT NULL,
  client_secret TEXT,
  created_ms BIGINT,
  payment_method_id TEXT,
  paid_at TIMESTAMPTZ,
  booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_booking ON payment_intents (booking_id);
