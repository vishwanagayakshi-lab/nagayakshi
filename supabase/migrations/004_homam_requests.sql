-- ============================================================
-- HOMAM REQUESTS — devotee interest/request for a specific homam
-- or pooja, reviewed by admin before any payment is arranged.
-- Replaces the external Google Form "Enquire" links.
-- ============================================================

CREATE TABLE homam_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_ref        TEXT UNIQUE NOT NULL,  -- e.g. HMR-20261122-a1b2

  devotee_name       TEXT NOT NULL,
  nakshatra          TEXT NOT NULL,
  phone              TEXT NOT NULL,
  email              TEXT NOT NULL,
  city               TEXT,
  address            TEXT,

  homam_type         TEXT NOT NULL,
  preferred_date     DATE,
  message            TEXT,  -- devotee's own notes / special requirements

  status             TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'contacted', 'scheduled', 'converted', 'completed', 'cancelled')),
  admin_notes        TEXT,

  -- Set once an admin converts this into a payable offering (see
  -- /api/admin/homam-requests/[id] action=convert_to_offering).
  linked_offering_id UUID REFERENCES offerings(id),

  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_homam_requests_status ON homam_requests(status);
CREATE INDEX idx_homam_requests_phone  ON homam_requests(phone);

-- Guests never query this table directly (service-role only via API routes).
ALTER TABLE homam_requests ENABLE ROW LEVEL SECURITY;
