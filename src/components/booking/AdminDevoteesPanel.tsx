'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { paise, fmtDateTime } from '@/lib/utils';
import AdminTable, { type ColConfig } from '@/components/admin/AdminTable';

interface Devotee {
  phone: string;
  name: string;
  email: string | null;
  booking_count: number;
  offering_count: number;
  total_spent: number;
  last_activity: string;
  notes: string;
  tags: string[];
}

export default function AdminDevoteesPanel() {
  const [devotees, setDevotees] = useState<Devotee[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [viewing,  setViewing]  = useState<Devotee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/devotees');
    const data = await res.json();
    if (data.success) setDevotees(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = devotees.map(d => ({ ...d, tags_text: d.tags.join(', ') }));

  const columns: ColConfig[] = [
    { key: 'phone',          label: 'Phone', type: 'mono', filterable: true },
    { key: 'name',           label: 'Name',  filterable: true },
    { key: 'email',          label: 'Email', filterable: true },
    { key: 'booking_count',  label: 'Bookings',  align: 'right' },
    { key: 'offering_count', label: 'Offerings', align: 'right' },
    { key: 'total_spent',    label: 'Total Spent', type: 'currency', align: 'right' },
    { key: 'tags_text',      label: 'Tags', filterable: true },
    { key: 'last_activity',  label: 'Last Activity', type: 'date' },
    {
      key: 'view', label: '',
      render: row => (
        <button
          onClick={() => setViewing(row as unknown as Devotee)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}
        >
          View
        </button>
      ),
    },
  ];

  if (loading) {
    return <p style={{ textAlign: 'center', padding: '64px 24px', fontSize: 13, color: '#94a3b8' }}>Loading…</p>;
  }

  return (
    <div>
      <Toaster richColors position="top-right" />

      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{devotees.length} devotee{devotees.length !== 1 ? 's' : ''} on record</p>

      <AdminTable data={rows} columns={columns} filename="devotees" idKey="phone" />

      {viewing && (
        <DevoteeDetailModal
          devotee={viewing}
          onClose={() => setViewing(null)}
          onSaved={() => load()}
        />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 7,
  fontSize: 13, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', fontFamily: 'inherit',
};

interface BookingRow { id: string; booking_ref: string; status: string; total_amount: number; quantity: number; created_at: string; event: { name: string } | null }
interface OfferingRow { id: string; offering_ref: string; status: string; amount: number; purpose: string; created_at: string }

function DevoteeDetailModal({ devotee, onClose, onSaved }: { devotee: Devotee; onClose: () => void; onSaved: () => void }) {
  const [loading,  setLoading]  = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [notes, setNotes] = useState(devotee.notes);
  const [tagsInput, setTagsInput] = useState(devotee.tags.join(', '));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/devotees/${encodeURIComponent(devotee.phone)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBookings(d.data.bookings);
          setOfferings(d.data.offerings);
        }
      })
      .finally(() => setLoading(false));
  }, [devotee.phone]);

  async function saveNotes() {
    setSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const res  = await fetch(`/api/admin/devotees/${encodeURIComponent(devotee.phone)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, tags }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Notes saved');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  }

  const row = (ref: string, right: string, sub: string, created: string, color: string) => (
    <div key={ref} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{ref}</span>
        <span style={{ fontWeight: 600, fontSize: 13, color }}>{right}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 12, color: '#475569' }}>{sub}</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDateTime(created)}</span>
      </div>
    </div>
  );

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{devotee.name || devotee.phone}</h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{devotee.phone}{devotee.email ? ` · ${devotee.email}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ color: '#94a3b8', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags (comma separated)</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. regular, vip, follow-up" />
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes about this devotee…" />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button onClick={saveNotes} disabled={saving} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: 13 }}>Loading history…</p>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Bookings ({bookings.length})</h3>
                {bookings.length ? bookings.map(b => row(b.booking_ref, paise(b.total_amount), `${b.event?.name ?? ''} · ${b.quantity} muttu · ${b.status}`, b.created_at, '#059669')) : (
                  <p style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>No bookings.</p>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Offerings & Donations ({offerings.length})</h3>
                {offerings.length ? offerings.map(o => row(o.offering_ref, paise(o.amount), `${o.purpose} · ${o.status}`, o.created_at, '#2563eb')) : (
                  <p style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>No offerings.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
