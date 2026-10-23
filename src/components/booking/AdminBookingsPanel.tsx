'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { paise } from '@/lib/utils';
import { NAKSHATRAS, nakshatraLabel } from '@/lib/nakshatra';
import type { Booking, BookingStatus } from '@/lib/types';
import AdminTable, { type ColConfig } from '@/components/admin/AdminTable';

export default function AdminBookingsPanel() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [viewing,  setViewing]  = useState<Booking | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/bookings?limit=1000');
    const data = await res.json();
    if (data.success) setBookings(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmPhone(id: string) {
    const res  = await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_phone' }),
    });
    const data = await res.json();
    if (data.success) { toast.success('Booking confirmed'); load(); }
    else toast.error(data.error);
  }

  async function cancelBooking(id: string) {
    const reason = prompt('Cancel reason (optional):') ?? '';
    const res  = await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', cancel_reason: reason }),
    });
    const data = await res.json();
    if (data.success) { toast.success('Booking cancelled'); load(); }
    else toast.error(data.error);
  }

  const rows = bookings.map(b => ({
    ...b,
    event_name: (b.event as unknown as { name: string } | null)?.name ?? '',
  }));

  const columns: ColConfig[] = [
    { key: 'booking_ref',  label: 'Ref',    type: 'mono', filterable: true },
    { key: 'phone',        label: 'Phone',  filterable: true },
    { key: 'event_name',   label: 'Event',  filterable: true },
    { key: 'booking_type', label: 'Type',   filterable: true },
    { key: 'quantity',     label: 'Qty',    align: 'right' },
    { key: 'total_amount', label: 'Amount', type: 'currency', align: 'right' },
    { key: 'status',       label: 'Status', type: 'badge', filterable: true },
    { key: 'created_at',   label: 'Created', type: 'date' },
    {
      key: 'actions', label: '',
      render: row => {
        const b = row as unknown as Booking;
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ActionBtn onClick={() => setViewing(b)}>View</ActionBtn>
            {b.booking_type === 'phone' && ['pending', 'payment_init'].includes(b.status) && (
              <ActionBtn tone="positive" onClick={() => confirmPhone(b.id)}>Confirm</ActionBtn>
            )}
            {['pending', 'payment_init', 'confirmed'].includes(b.status) && (
              <ActionBtn tone="negative" onClick={() => cancelBooking(b.id)}>Cancel</ActionBtn>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return <p style={{ textAlign: 'center', padding: '64px 24px', fontSize: 13, color: '#94a3b8' }}>Loading…</p>;
  }

  return (
    <div>
      <Toaster richColors position="top-right" />

      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{bookings.length} total booking{bookings.length !== 1 ? 's' : ''}</p>

      <AdminTable data={rows} columns={columns} filename="bookings" idKey="id" />

      {viewing && <BookingDetailModal booking={viewing} onClose={() => { setViewing(null); load(); }} />}
    </div>
  );
}

function ActionBtn({ children, onClick, tone = 'neutral', disabled }: { children: React.ReactNode; onClick: () => void; tone?: 'neutral' | 'positive' | 'negative'; disabled?: boolean }) {
  const palette = {
    neutral:  { bg: '#fff',                    border: '#e2e8f0', color: '#64748b' },
    positive: { bg: 'rgba(16,185,129,0.1)',    border: 'rgba(52,211,153,0.3)', color: '#059669' },
    negative: { bg: 'rgba(239,68,68,0.08)',    border: 'rgba(248,113,113,0.3)', color: '#dc2626' },
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: `1.5px solid ${palette.border}`, background: palette.bg, color: palette.color, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 7,
  fontSize: 13, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', fontFamily: 'inherit',
};

type Item = { id: string; name: string; nakshatra: string; obstacles: string; token_number?: number };

function BookingDetailModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [full,    setFull]    = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [phone,   setPhone]   = useState('');
  const [items,   setItems]   = useState<Item[]>([]);

  const fetchFull = useCallback(async () => {
    const res = await fetch(`/api/admin/bookings/${booking.id}`);
    const d   = await res.json();
    if (d.success) {
      setFull(d.data);
      setPhone(d.data.phone);
      setItems((d.data.muttu_items ?? []) as Item[]);
    }
    setLoading(false);
  }, [booking.id]);

  useEffect(() => { fetchFull(); }, [fetchFull]);

  const event = full?.event as unknown as { name: string; event_date: string } | null;
  const STATUS_TEXT: Record<string, string> = { pending: '#9ca3af', payment_init: '#f59e0b', confirmed: '#34d399', failed: '#f87171', expired: '#f87171', cancelled: '#f87171', refunded: '#9ca3af' };

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <p style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', margin: '2px 0 0' }}>{value}</p>
    </div>
  );

  function updItem(id: string, k: keyof Item, v: string) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [k]: v } : it));
  }

  async function saveDetails() {
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_details', phone,
          items: items.map(it => ({ id: it.id, name: it.name, nakshatra: it.nakshatra, obstacles: it.obstacles })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Booking details updated');
      setFull(data.data);
      setEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function refund() {
    const note = prompt('Refund note (required):');
    if (!note) return;
    setBusy(true);
    try {
      const res  = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund', refund_note: note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Booking marked refunded');
      fetchFull();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to refund');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{booking.booking_ref}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!loading && !editing && (
              <button onClick={() => setEditing(true)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1.5px solid #2563eb', color: '#2563eb', background: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                Edit
              </button>
            )}
            <button onClick={onClose} style={{ color: '#94a3b8', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : editing ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Phone</label>
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            {items.map((item, idx) => (
              <div key={item.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Muttu {idx + 1}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input style={inputStyle} placeholder="Name" value={item.name} onChange={e => updItem(item.id, 'name', e.target.value)} />
                  <select style={{ ...inputStyle, background: '#fff' }} value={item.nakshatra} onChange={e => updItem(item.id, 'nakshatra', e.target.value)}>
                    {NAKSHATRAS.map(n => <option key={n.key} value={n.key}>{nakshatraLabel(n)}</option>)}
                  </select>
                  <textarea style={{ ...inputStyle, resize: 'none' }} rows={2} placeholder="Obstacles" value={item.obstacles} onChange={e => updItem(item.id, 'obstacles', e.target.value)} />
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setEditing(false); fetchFull(); }} style={{ padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDetails} disabled={saving} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {field('Event', event?.name)}
              {field('Type', <span style={{ textTransform: 'capitalize' }}>{full?.booking_type}</span>)}
              {field('Quantity', `${full?.quantity} Muttu`)}
              {field('Amount', <span style={{ color: '#059669', fontWeight: 600 }}>{paise(full?.total_amount ?? 0)}</span>)}
              {field('Phone', full?.phone)}
              {field('Status', (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: 'rgba(107,114,128,0.12)', color: STATUS_TEXT[full?.status as BookingStatus ?? 'pending'] }}>
                  {full?.status}
                </span>
              ))}
            </div>

            {items.map((item, idx) => (
              <div key={item.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, fontSize: 13, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                  Muttu {idx + 1} — {item.name}
                  {item.token_number && (
                    <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 6px' }}>
                      #{item.token_number}
                    </span>
                  )}
                </div>
                <div style={{ color: '#64748b' }}>{nakshatraLabel(NAKSHATRAS.find(n => n.key === item.nakshatra) ?? NAKSHATRAS[0])}</div>
                <div style={{ color: '#475569', marginTop: 2 }}>{item.obstacles}</div>
              </div>
            ))}

            {full?.status === 'confirmed' && (
              <div style={{ marginTop: 16 }}>
                <ActionBtn tone="negative" onClick={refund} disabled={busy}>{busy ? 'Processing…' : 'Mark Refunded'}</ActionBtn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
