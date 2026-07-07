'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { fmtDate, paise, EVENT_STATUS_COLOR, EVENT_STATUS_LABEL } from '@/lib/utils';
import type { MuttuEvent, EventStatus } from '@/lib/types';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' }, { value: 'scheduled', label: 'Scheduled' },
  { value: 'open', label: 'Open' }, { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' }, { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }, { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminEventsPanel() {
  const [events,       setEvents]       = useState<MuttuEvent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [total,        setTotal]        = useState(0);
  const [showCreate,   setShowCreate]   = useState(false);
  const [editEvent,    setEditEvent]    = useState<MuttuEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (statusFilter) p.set('status', statusFilter);
    const res  = await fetch(`/api/admin/events?${p}`);
    const data = await res.json();
    if (data.success) { setEvents(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [statusFilter]);

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

  return (
    <div>
      <Toaster richColors position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Muttu Events</h1>
          <p className="text-sm text-stone-500">{total} events total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-red-800 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
        >
          + Create Event
        </button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === f.value ? 'bg-red-800 text-white border-red-800' : 'bg-white text-stone-600 border-stone-300 hover:border-red-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Event', 'Date', 'Online / Phone', 'Price', 'Confirmed', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-stone-400">Loading…</td></tr>
            ) : !events.length ? (
              <tr><td colSpan={7} className="text-center py-12 text-stone-400">No events found</td></tr>
            ) : events.map(e => (
              <tr key={e.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => setEditEvent(e)} className="font-semibold text-stone-800 hover:text-red-800 text-left">{e.name}</button>
                  {e.location && <p className="text-xs text-stone-400">{e.location}</p>}
                </td>
                <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{fmtDate(e.event_date)}</td>
                <td className="px-4 py-3 text-stone-600">
                  <span title="Online">{e.online_tokens}</span> / <span className="text-stone-400" title="Phone">{e.phone_tokens}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-red-800">{paise(e.price_per_muttu)}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="text-green-600">{e.confirmed_online ?? 0} online</span>
                  {' · '}
                  <span className="text-blue-600">{e.confirmed_phone ?? 0} phone</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${EVENT_STATUS_COLOR[e.status]}`}>
                    {EVENT_STATUS_LABEL[e.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setEditEvent(e)} className="text-xs px-2 py-1 rounded-lg border border-stone-200 hover:border-red-400 text-stone-600">Edit</button>
                    {e.status === 'draft'  && <button onClick={() => quickStatus(e.id, 'open')}   className="text-xs px-2 py-1 rounded-lg bg-green-100 hover:bg-green-200 text-green-700">Open</button>}
                    {e.status === 'open'   && <button onClick={() => quickStatus(e.id, 'paused')} className="text-xs px-2 py-1 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700">Pause</button>}
                    {e.status === 'paused' && <button onClick={() => quickStatus(e.id, 'open')}   className="text-xs px-2 py-1 rounded-lg bg-green-100 hover:bg-green-200 text-green-700">Resume</button>}
                    {['open','paused'].includes(e.status) && <button onClick={() => quickStatus(e.id, 'closed')} className="text-xs px-2 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700">Close</button>}
                    {['closed','completed'].includes(e.status) && <button onClick={() => quickStatus(e.id, 'completed')} className="text-xs px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700">Complete</button>}
                    {!['archived','cancelled','completed'].includes(e.status) && <button onClick={() => deleteEvent(e.id, e.name)} className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <EventModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editEvent  && <EventModal event={editEvent} onClose={() => setEditEvent(null)} onSaved={() => { setEditEvent(null); load(); }} />}
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

  const I = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-800';
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>{children}</div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-stone-800">{isEdit ? 'Edit Event' : 'Create New Event'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <F label="Event Name *"><input value={form.name} onChange={e => upd('name', e.target.value)} className={I} /></F>
          <F label="Description"><textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={2} className={`${I} resize-none`} /></F>
          <div className="grid grid-cols-2 gap-4">
            <F label="Event Date *"><input type="date" value={form.event_date} onChange={e => upd('event_date', e.target.value)} className={I} /></F>
            <F label="Event Time"><input type="time" value={form.event_time} onChange={e => upd('event_time', e.target.value)} className={I} /></F>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <F label="Total Tokens"><input type="number" value={form.total_tokens} onChange={e => upd('total_tokens', +e.target.value)} className={I} /></F>
            <F label="Online Tokens"><input type="number" value={form.online_tokens} onChange={e => upd('online_tokens', +e.target.value)} className={I} /></F>
            <F label="Phone Tokens"><input type="number" value={form.phone_tokens} onChange={e => upd('phone_tokens', +e.target.value)} className={I} /></F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Price per Muttu (₹)"><input type="number" step="1" value={form.price_per_muttu} onChange={e => upd('price_per_muttu', +e.target.value)} className={I} /></F>
            <F label="Max per Person"><input type="number" min={1} max={10} value={form.max_per_person} onChange={e => upd('max_per_person', +e.target.value)} className={I} /></F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Booking Opens At"><input type="datetime-local" value={form.booking_opens_at} onChange={e => upd('booking_opens_at', e.target.value)} className={I} /></F>
            <F label="Booking Closes At"><input type="datetime-local" value={form.booking_closes_at} onChange={e => upd('booking_closes_at', e.target.value)} className={I} /></F>
          </div>
          <F label="Location"><input value={form.location} onChange={e => upd('location', e.target.value)} className={I} /></F>
          <F label="Display Note (shown to users)"><textarea value={form.display_notes} onChange={e => upd('display_notes', e.target.value)} rows={2} className={`${I} resize-none`} /></F>
          <F label="Internal Notes"><textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} className={`${I} resize-none`} /></F>
          <F label="Status">
            <select value={form.status} onChange={e => upd('status', e.target.value)} className={`${I} bg-white`}>
              {Object.entries(EVENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 border border-stone-200 rounded-xl text-stone-600 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2.5 bg-red-800 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
