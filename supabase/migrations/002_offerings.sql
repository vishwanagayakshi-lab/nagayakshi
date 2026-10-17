-- ============================================================
-- OFFERINGS — Guest pooja sponsorship & donation payments
-- (Utsav special poojas, /support general donations)
-- ============================================================

CREATE TABLE offerings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_ref          TEXT UNIQUE NOT NULL,  -- e.g. OFR-20261017-a1b2

  -- Devotee details (standard registration, used for the receipt)
  devotee_name          TEXT NOT NULL,
  nakshatra             TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  email                 TEXT NOT NULL,
  city                  TEXT NOT NULL,
  address               TEXT NOT NULL,

  -- What they're paying for
  purpose               TEXT NOT NULL,          -- e.g. "Ayilyam Pooja" or "General Donation"
  amount                INTEGER NOT NULL CHECK (amount > 0), -- paise
  currency              TEXT NOT NULL DEFAULT 'INR',

  -- Razorpay
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  razorpay_signature    TEXT,
  payment_captured_at   TIMESTAMPTZ,

  -- Status
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'payment_init', 'paid', 'failed')),

  -- Email receipt
  email_sent_at         TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offerings_status ON offerings(status);
CREATE INDEX idx_offerings_phone ON offerings(phone);
CREATE INDEX idx_offerings_email ON offerings(email);

-- Guests never query this table directly (service-role only via API routes),
-- so lock it down from the anon/public roles entirely.
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
