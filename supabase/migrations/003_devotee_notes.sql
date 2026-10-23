-- ============================================================
-- DEVOTEE NOTES — admin-only CRM notes/tags, keyed by phone
-- (consolidates devotees seen across bookings + offerings, which
-- otherwise have no shared identity since offerings are guest-only)
-- ============================================================

CREATE TABLE devotee_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT UNIQUE NOT NULL,
  notes       TEXT,
  tags        TEXT[] DEFAULT '{}',
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devotee_notes_phone ON devotee_notes(phone);

-- Admin-only (service-role via API routes), same pattern as offerings.
ALTER TABLE devotee_notes ENABLE ROW LEVEL SECURITY;
