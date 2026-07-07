-- ============================================================
-- MUTTU BOOKING SYSTEM — Full Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  email         TEXT,
  is_admin      BOOLEAN DEFAULT FALSE,
  is_banned     BOOLEAN DEFAULT FALSE,
  ban_reason    TEXT,
  total_bookings INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MUTTU EVENTS
-- ============================================================
CREATE TYPE event_status AS ENUM (
  'draft',        -- created, not yet open
  'scheduled',    -- open date set, not yet open
  'open',         -- booking is live
  'paused',       -- temporarily paused
  'closed',       -- booking window closed
  'completed',    -- event conducted
  'archived',     -- soft-deleted / hidden
  'cancelled'     -- cancelled entirely
);

CREATE TABLE muttu_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  event_date            DATE NOT NULL,
  event_time            TIME,

  -- Token configuration
  total_tokens          INTEGER NOT NULL DEFAULT 150 CHECK (total_tokens > 0),
  online_tokens         INTEGER NOT NULL DEFAULT 100 CHECK (online_tokens >= 0),
  phone_tokens          INTEGER NOT NULL DEFAULT 50  CHECK (phone_tokens >= 0),
  max_per_person        INTEGER NOT NULL DEFAULT 5   CHECK (max_per_person BETWEEN 1 AND 10),

  -- Pricing
  price_per_muttu       INTEGER NOT NULL CHECK (price_per_muttu >= 0), -- paise (₹1 = 100)
  currency              TEXT NOT NULL DEFAULT 'INR',

  -- Booking window
  booking_opens_at      TIMESTAMPTZ,
  booking_closes_at     TIMESTAMPTZ,

  -- Status
  status                event_status NOT NULL DEFAULT 'draft',

  -- Stats (denormalised for fast reads)
  confirmed_online      INTEGER DEFAULT 0,
  confirmed_phone       INTEGER DEFAULT 0,
  reserved_count        INTEGER DEFAULT 0, -- currently held (not yet paid)

  -- Metadata
  location              TEXT,
  notes                 TEXT,                -- internal admin notes
  display_notes         TEXT,               -- shown to users
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT tokens_match CHECK (online_tokens + phone_tokens = total_tokens)
);

-- ============================================================
-- TOKEN POOL (individual token slots for concurrency control)
-- ============================================================
CREATE TYPE token_type AS ENUM ('online', 'phone');
CREATE TYPE token_status AS ENUM ('available', 'reserved', 'confirmed', 'cancelled', 'blocked');

CREATE TABLE token_pool (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES muttu_events(id) ON DELETE CASCADE,
  token_number  INTEGER NOT NULL,
  token_type    token_type NOT NULL,
  status        token_status NOT NULL DEFAULT 'available',
  booking_id    UUID,               -- filled after reservation
  reserved_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,        -- reservation TTL (10 min)
  confirmed_at  TIMESTAMPTZ,

  UNIQUE (event_id, token_number)
);
CREATE INDEX idx_token_pool_event_status ON token_pool(event_id, status, token_type);
CREATE INDEX idx_token_pool_expires ON token_pool(expires_at) WHERE status = 'reserved';

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TYPE booking_type AS ENUM ('online', 'phone');
CREATE TYPE booking_status AS ENUM (
  'pending',      -- form submitted, tokens reserved, awaiting payment
  'payment_init', -- Razorpay order created
  'confirmed',    -- payment verified / phone booking confirmed
  'failed',       -- payment failed
  'expired',      -- reservation timed out
  'cancelled',    -- user or admin cancelled
  'refunded'      -- refund issued
);

CREATE TABLE bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref           TEXT UNIQUE NOT NULL, -- human-readable e.g. MTT-20240601-0042
  event_id              UUID NOT NULL REFERENCES muttu_events(id),
  user_id               UUID NOT NULL REFERENCES auth.users(id),
  phone                 TEXT NOT NULL,

  booking_type          booking_type NOT NULL DEFAULT 'online',
  quantity              INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 5),
  status                booking_status NOT NULL DEFAULT 'pending',

  -- Financials
  price_per_muttu       INTEGER NOT NULL,     -- snapshot at booking time
  total_amount          INTEGER NOT NULL,     -- paise
  currency              TEXT NOT NULL DEFAULT 'INR',

  -- Razorpay (online)
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  razorpay_signature    TEXT,
  payment_captured_at   TIMESTAMPTZ,

  -- Phone booking
  payment_screenshot_url TEXT,               -- Storage path
  admin_verified_by     UUID REFERENCES auth.users(id),
  admin_verified_at     TIMESTAMPTZ,
  admin_notes           TEXT,

  -- Token assignment
  token_numbers         INTEGER[],           -- e.g. {1,2,3}

  -- Reservation window
  reserved_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  confirmed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bookings_event ON bookings(event_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_expires ON bookings(expires_at) WHERE status IN ('pending','payment_init');
CREATE INDEX idx_bookings_ref ON bookings(booking_ref);

-- ============================================================
-- MUTTU ITEMS (per-person details within a booking)
-- ============================================================
CREATE TABLE muttu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_index    INTEGER NOT NULL CHECK (item_index BETWEEN 1 AND 5),
  token_number  INTEGER,
  name          TEXT NOT NULL,
  nakshatra     TEXT NOT NULL,      -- Sanskrit key e.g. 'ashwini'
  obstacles     TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (booking_id, item_index)
);
CREATE INDEX idx_muttu_items_booking ON muttu_items(booking_id);

-- ============================================================
-- AUDIT LOG (immutable event trail)
-- ============================================================
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  action      TEXT NOT NULL,   -- 'create','update','delete','status_change','payment','refund'
  old_data    JSONB,
  new_data    JSONB,
  actor_id    UUID REFERENCES auth.users(id),
  actor_phone TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at    BEFORE UPDATE ON profiles       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at      BEFORE UPDATE ON muttu_events   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at    BEFORE UPDATE ON bookings        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Generate human-readable booking ref
CREATE OR REPLACE FUNCTION generate_booking_ref(event_date DATE)
RETURNS TEXT AS $$
DECLARE
  seq   INTEGER;
  dated TEXT;
BEGIN
  dated := TO_CHAR(event_date, 'YYYYMMDD');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(booking_ref, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO seq
  FROM bookings
  WHERE booking_ref LIKE 'MTT-' || dated || '-%';
  RETURN 'MTT-' || dated || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Release expired reservations (called by cron every minute)
CREATE OR REPLACE FUNCTION release_expired_tokens()
RETURNS INTEGER AS $$
DECLARE released INTEGER;
BEGIN
  -- Mark expired bookings
  UPDATE bookings SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'payment_init') AND expires_at < NOW();

  -- Release their tokens back to pool
  UPDATE token_pool SET
    status = 'available',
    booking_id = NULL,
    reserved_at = NULL,
    expires_at = NULL
  WHERE status = 'reserved' AND expires_at < NOW();

  GET DIAGNOSTICS released = ROW_COUNT;

  -- Update event reserved_count
  UPDATE muttu_events e SET
    reserved_count = (
      SELECT COUNT(*) FROM token_pool tp
      WHERE tp.event_id = e.id AND tp.status = 'reserved'
    );

  RETURN released;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RESERVE TOKENS (atomic, concurrency-safe)
-- Returns booking_id on success, raises exception on failure
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_tokens(
  p_event_id    UUID,
  p_user_id     UUID,
  p_quantity    INTEGER,
  p_token_type  token_type DEFAULT 'online'
)
RETURNS UUID AS $$
DECLARE
  v_booking_id    UUID;
  v_booking_ref   TEXT;
  v_token_ids     UUID[];
  v_token_numbers INTEGER[];
  v_event         muttu_events%ROWTYPE;
  v_user_count    INTEGER;
  v_price         INTEGER;
BEGIN
  -- Validate event
  SELECT * INTO v_event FROM muttu_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event.status NOT IN ('open') THEN RAISE EXCEPTION 'Event is not open for booking'; END IF;
  IF v_event.booking_opens_at IS NOT NULL AND NOW() < v_event.booking_opens_at THEN
    RAISE EXCEPTION 'Booking has not opened yet';
  END IF;
  IF v_event.booking_closes_at IS NOT NULL AND NOW() > v_event.booking_closes_at THEN
    RAISE EXCEPTION 'Booking has closed';
  END IF;

  -- Check per-person limit
  SELECT COALESCE(SUM(quantity), 0) INTO v_user_count
  FROM bookings
  WHERE event_id = p_event_id AND user_id = p_user_id
    AND status IN ('pending','payment_init','confirmed');
  IF v_user_count + p_quantity > v_event.max_per_person THEN
    RAISE EXCEPTION 'Exceeds maximum % muttus per person', v_event.max_per_person;
  END IF;

  -- First release any expired tokens for this event
  UPDATE token_pool SET status='available', booking_id=NULL, reserved_at=NULL, expires_at=NULL
  WHERE event_id = p_event_id AND status='reserved' AND expires_at < NOW();

  -- Grab tokens atomically (SKIP LOCKED = Tatkal concurrency)
  SELECT ARRAY_AGG(id), ARRAY_AGG(token_number)
  INTO v_token_ids, v_token_numbers
  FROM (
    SELECT id, token_number FROM token_pool
    WHERE event_id = p_event_id
      AND token_type = p_token_type
      AND status = 'available'
    ORDER BY token_number
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  ) t;

  IF array_length(v_token_ids, 1) < p_quantity THEN
    RAISE EXCEPTION 'Not enough tokens available. Only % left.',
      COALESCE(array_length(v_token_ids, 1), 0);
  END IF;

  -- Create booking
  v_booking_ref := generate_booking_ref(v_event.event_date);
  v_price := v_event.price_per_muttu;

  INSERT INTO bookings (
    booking_ref, event_id, user_id, phone,
    booking_type, quantity, status,
    price_per_muttu, total_amount,
    token_numbers, reserved_at, expires_at
  )
  SELECT
    v_booking_ref, p_event_id, p_user_id,
    (SELECT phone FROM profiles WHERE id = p_user_id),
    p_token_type, p_quantity, 'pending',
    v_price, v_price * p_quantity,
    v_token_numbers, NOW(), NOW() + INTERVAL '10 minutes'
  RETURNING id INTO v_booking_id;

  -- Mark tokens as reserved
  UPDATE token_pool SET
    status = 'reserved',
    booking_id = v_booking_id,
    reserved_at = NOW(),
    expires_at = NOW() + INTERVAL '10 minutes'
  WHERE id = ANY(v_token_ids);

  -- Update event counter
  UPDATE muttu_events SET reserved_count = reserved_count + p_quantity WHERE id = p_event_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CONFIRM BOOKING (after payment verified)
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_booking(
  p_booking_id          UUID,
  p_razorpay_order_id   TEXT DEFAULT NULL,
  p_razorpay_payment_id TEXT DEFAULT NULL,
  p_razorpay_signature  TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF v_booking.status NOT IN ('pending','payment_init') THEN
    RAISE EXCEPTION 'Booking cannot be confirmed in status: %', v_booking.status;
  END IF;
  IF v_booking.expires_at < NOW() THEN
    RAISE EXCEPTION 'Booking reservation has expired';
  END IF;

  -- Confirm booking
  UPDATE bookings SET
    status = 'confirmed',
    razorpay_order_id   = COALESCE(p_razorpay_order_id,   razorpay_order_id),
    razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
    razorpay_signature  = COALESCE(p_razorpay_signature,  razorpay_signature),
    payment_captured_at = NOW(),
    confirmed_at = NOW()
  WHERE id = p_booking_id;

  -- Confirm tokens in pool
  UPDATE token_pool SET status = 'confirmed', confirmed_at = NOW()
  WHERE booking_id = p_booking_id;

  -- Update event confirmed count
  UPDATE muttu_events SET
    confirmed_online = confirmed_online + CASE WHEN v_booking.booking_type = 'online' THEN v_booking.quantity ELSE 0 END,
    confirmed_phone  = confirmed_phone  + CASE WHEN v_booking.booking_type = 'phone'  THEN v_booking.quantity ELSE 0 END,
    reserved_count   = GREATEST(0, reserved_count - v_booking.quantity)
  WHERE id = v_booking.event_id;

  -- Increment user booking count
  UPDATE profiles SET total_bookings = total_bookings + v_booking.quantity
  WHERE id = v_booking.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CANCEL BOOKING
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  UPDATE bookings SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancel_reason = p_reason
  WHERE id = p_booking_id;

  UPDATE token_pool SET
    status = 'available',
    booking_id = NULL, reserved_at = NULL, expires_at = NULL
  WHERE booking_id = p_booking_id;

  IF v_booking.status = 'confirmed' THEN
    UPDATE muttu_events SET
      confirmed_online = GREATEST(0, confirmed_online - CASE WHEN v_booking.booking_type='online' THEN v_booking.quantity ELSE 0 END),
      confirmed_phone  = GREATEST(0, confirmed_phone  - CASE WHEN v_booking.booking_type='phone'  THEN v_booking.quantity ELSE 0 END)
    WHERE id = v_booking.event_id;
  ELSIF v_booking.status IN ('pending','payment_init') THEN
    UPDATE muttu_events SET reserved_count = GREATEST(0, reserved_count - v_booking.quantity)
    WHERE id = v_booking.event_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED TOKEN POOL (call after creating an event)
-- ============================================================
CREATE OR REPLACE FUNCTION seed_token_pool(p_event_id UUID)
RETURNS VOID AS $$
DECLARE
  v_event muttu_events%ROWTYPE;
  i INTEGER;
BEGIN
  SELECT * INTO v_event FROM muttu_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  DELETE FROM token_pool WHERE event_id = p_event_id;

  -- Online tokens: 1 .. online_tokens
  FOR i IN 1..v_event.online_tokens LOOP
    INSERT INTO token_pool (event_id, token_number, token_type, status)
    VALUES (p_event_id, i, 'online', 'available');
  END LOOP;

  -- Phone tokens: (online_tokens+1) .. total_tokens
  FOR i IN 1..v_event.phone_tokens LOOP
    INSERT INTO token_pool (event_id, token_number, token_type, status)
    VALUES (p_event_id, v_event.online_tokens + i, 'phone', 'available');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE muttu_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE muttu_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_pool     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE AND is_banned = FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles
CREATE POLICY "Users can view own profile"    ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "Users can update own profile"  ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin full access profiles"    ON profiles FOR ALL USING (is_admin());

-- Events: public can read open events; admin can do all
CREATE POLICY "Public can read open events"   ON muttu_events FOR SELECT USING (status IN ('open','closed','completed','scheduled') OR is_admin());
CREATE POLICY "Admin manage events"           ON muttu_events FOR ALL USING (is_admin());

-- Bookings: users see own; admin sees all
CREATE POLICY "Users see own bookings"        ON bookings FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Users create bookings"         ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin manage bookings"         ON bookings FOR ALL USING (is_admin());

-- Muttu items
CREATE POLICY "Users see own items"           ON muttu_items FOR SELECT USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()) OR is_admin());
CREATE POLICY "Users create items"            ON muttu_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
CREATE POLICY "Admin manage items"            ON muttu_items FOR ALL USING (is_admin());

-- Token pool: users can only read counts
CREATE POLICY "Public read token availability" ON token_pool FOR SELECT USING (TRUE);
CREATE POLICY "Admin manage tokens"            ON token_pool FOR ALL USING (is_admin());

-- Audit log: admin only
CREATE POLICY "Admin read audit log"          ON audit_log FOR SELECT USING (is_admin());

-- ============================================================
-- NEW USER TRIGGER: auto-create profile
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, phone)
  VALUES (NEW.id, COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- STORAGE BUCKET (payment screenshots)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', FALSE)
ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users upload screenshots" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-screenshots' AND auth.uid() IS NOT NULL);
CREATE POLICY "Own screenshot readable" ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-screenshots' AND (auth.uid()::TEXT = (storage.foldername(name))[1] OR is_admin()));
CREATE POLICY "Admin manage screenshots" ON storage.objects FOR ALL
  USING (bucket_id = 'payment-screenshots' AND is_admin());
