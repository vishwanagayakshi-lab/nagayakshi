'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { fmtDate, paise, EVENT_STATUS_LABEL } from '@/lib/utils';
import type { MuttuEvent, EventStatus } from '@/lib/types';
import AdminTable, { type ColConfig } from '@/components/admin/AdminTable';

export default function AdminEventsPanel() {
  const [events,     setEvents]     = useState<MuttuEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editEvent,  setEditEvent]  = useState<MuttuEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/events?limit=1000');
    const data = await res.json();
    if (data.success) setEvents(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function quickStatus(id: string, status: EventStatus) {
    const res  = await fetch(`/api/admin/events/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) { toast.success(`Event ${status}`); load(); }
    else toast.error(data.error);
  }

  async function deleteEvent(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This may archive it if it has bookings.`)) return;
    const res  = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast.success(`Event ${data.data.action}`); load(); }
    else toast.error(data.error);
  }

  const columns: ColConfig[] = [
    {
      key: 'name', label: 'Event', filterable: true,
      render: e => (
        <div>
          <button
            onClick={() => setEditEvent(e as unknown as MuttuEvent)}
            style={{ fontWeight: 600, color: '#0f172a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', font: 'inherit' }}
          >
            {e.name as string}
          </button>
          {!!e.location && <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{e.location as string}</p>}
        </div>
      ),
    },
    { key: 'event_date', label: 'Date', render: e => <span style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(e.event_date as string)}</span> },
    {
      key: 'online_tokens', label: 'Online / Phone',
      render: e => <span style={{ color: '#1e293b' }}>{e.online_tokens as number} <span style={{ color: '#94a3b8' }}>/ {e.phone_tokens as number}</span></span>,
    },
    { key: 'price_per_muttu', label: 'Price', type: 'currency' },
    {
      key: 'confirmed_online', label: 'Confirmed',
      render: e => (
        <span style={{ fontSize: 12 }}>
          <span style={{ color: '#059669' }}>{(e.confirmed_online as number) ?? 0} online</span>
          {' · '}
          <span style={{ color: '#2563eb' }}>{(e.confirmed_phone as number) ?? 0} phone</span>
        </span>
      ),
    },
    { key: 'status', label: 'Status', type: 'badge', filterable: true },
    {
      key: 'actions', label: '',
      render: row => {
        const e = row as unknown as MuttuEvent;
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ActionBtn onClick={() => setEditEvent(e)}>Edit</ActionBtn>
            {e.status === 'draft'  && <ActionBtn tone="positive" onClick={() => quickStatus(e.id, 'open')}>Open</ActionBtn>}
            {e.status === 'open'   && <ActionBtn tone="warning"  onClick={() => quickStatus(e.id, 'paused')}>Pause</ActionBtn>}
            {e.status === 'paused' && <ActionBtn tone="positive" onClick={() => quickStatus(e.id, 'open')}>Resume</ActionBtn>}
            {['open', 'paused'].includes(e.status) && <ActionBtn tone="warning" onClick={() => quickStatus(e.id, 'closed')}>Close</ActionBtn>}
            {['closed', 'completed'].includes(e.status) && <ActionBtn onClick={() => quickStatus(e.id, 'completed')}>Complete</ActionBtn>}
            {!['archived', 'cancelled', 'completed'].includes(e.status) && <ActionBtn tone="negative" onClick={() => deleteEvent(e.id, e.name)}>Delete</ActionBtn>}
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{events.length} event{events.length !== 1 ? 's' : ''} total</p>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: '#2563eb', color: '#fff', padding: '9px 18px', borderRadius: 9, fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}
        >
          + Create Event
        </button>
      </div>

      <AdminTable data={events as unknown as Record<string, unknown>[]} columns={columns} filename="events" idKey="id" />

      {showCreate && <EventModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editEvent  && <EventModal event={editEvent} onClose={() => setEditEvent(null)} onSaved={() => { setEditEvent(null); load(); }} />}
    </div>
  );
}

function ActionBtn({ children, onClick, tone = 'neutral' }: { children: React.ReactNode; onClick: () => void; tone?: 'neutral' | 'positive' | 'negative' | 'warning' }) {
  const palette = {
    neutral:  { bg: '#fff',                 border: '#e2e8f0',              color: '#64748b' },
    positive: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(52,211,153,0.3)', color: '#059669' },
    negative: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(248,113,113,0.3)', color: '#dc2626' },
    warning:  { bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.3)',  color: '#b45309' },
  }[tone];
  return (
    <button
      onClick={onClick}
      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: `1.5px solid ${palette.border}`, background: palette.bg, color: palette.color, cursor: 'pointer', fontWeight: 500 }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8,
  fontSize: 13, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', fontFamily: 'inherit',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function EventModal({ event, onClose, onSaved }: { event?: MuttuEvent; onClose: () => void; onSaved: () => void }) {
  const isEdit  = !!event;
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState({
    name:              event?.name              ?? '',
    description:       event?.description       ?? '',
    event_date:        event?.event_date        ?? '',
    event_time:        event?.event_time        ?? '',
    total_tokens:      event?.total_tokens      ?? 150,
    online_tokens:     event?.online_tokens     ?? 100,
    phone_tokens:      event?.phone_tokens      ?? 50,
    max_per_person:    event?.max_per_person    ?? 5,
    price_per_muttu:   event ? event.price_per_muttu / 100 : 0,
    booking_opens_at:  event?.booking_opens_at  ?? '',
    booking_closes_at: event?.booking_closes_at ?? '',
    status:            event?.status            ?? 'draft',
    location:          event?.location          ?? '',
    notes:             event?.notes             ?? '',
    display_notes:     event?.display_notes     ?? '',
  });

  function upd(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name || !form.event_date) { toast.error('Name and date are required'); return; }
    if (form.online_tokens + form.phone_tokens !== form.total_tokens) {
      toast.error('Online + Phone tokens must equal Total'); return;
    }
    setSaving(true);
    try {
      const url    = isEdit ? `/api/admin/events/${event!.id}` : '/api/admin/events';
      const method = isEdit ? 'PATCH' : 'POST';
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price_per_muttu: Number(form.price_per_muttu) }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(isEdit ? 'Event updated!' : 'Event created!');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
  const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{isEdit ? 'Edit Event' : 'Create New Event'}</h2>
          <button onClick={onClose} style={{ color: '#94a3b8', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Event Name *"><input value={form.name} onChange={e => upd('name', e.target.value)} style={inputStyle} /></Field>
          <Field label="Description"><textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} /></Field>

          <div style={row2}>
            <Field label="Event Date *"><input type="date" value={form.event_date} onChange={e => upd('event_date', e.target.value)} style={inputStyle} /></Field>
            <Field label="Event Time"><input type="time" value={form.event_time} onChange={e => upd('event_time', e.target.value)} style={inputStyle} /></Field>
          </div>

          <div style={row3}>
            <Field label="Total Tokens"><input type="number" value={form.total_tokens} onChange={e => upd('total_tokens', +e.target.value)} style={inputStyle} /></Field>
            <Field label="Online Tokens"><input type="number" value={form.online_tokens} onChange={e => upd('online_tokens', +e.target.value)} style={inputStyle} /></Field>
            <Field label="Phone Tokens"><input type="number" value={form.phone_tokens} onChange={e => upd('phone_tokens', +e.target.value)} style={inputStyle} /></Field>
          </div>

          <div style={row2}>
            <Field label="Price per Muttu (₹)"><input type="number" step="1" value={form.price_per_muttu} onChange={e => upd('price_per_muttu', +e.target.value)} style={inputStyle} /></Field>
            <Field label="Max per Person"><input type="number" min={1} max={10} value={form.max_per_person} onChange={e => upd('max_per_person', +e.target.value)} style={inputStyle} /></Field>
          </div>

          <div style={row2}>
            <Field label="Booking Opens At"><input type="datetime-local" value={form.booking_opens_at} onChange={e => upd('booking_opens_at', e.target.value)} style={inputStyle} /></Field>
            <Field label="Booking Closes At"><input type="datetime-local" value={form.booking_closes_at} onChange={e => upd('booking_closes_at', e.target.value)} style={inputStyle} /></Field>
          </div>

          <Field label="Location"><input value={form.location} onChange={e => upd('location', e.target.value)} style={inputStyle} /></Field>
          <Field label="Display Note (shown to users)"><textarea value={form.display_notes} onChange={e => upd('display_notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} /></Field>
          <Field label="Internal Notes"><textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={e => upd('status', e.target.value)} style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
              {Object.entries(EVENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: 9, color: '#64748b', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={save} disabled={saving}
            style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
