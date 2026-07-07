'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { fmtDateTime, paise, BOOKING_STATUS_COLOR, BOOKING_STATUS_LABEL } from '@/lib/utils';
import type { Booking, BookingStatus } from '@/lib/types';

const STATUS_OPTS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' }, { value: 'payment_init', label: 'Payment Init' },
  { value: 'confirmed', label: 'Confirmed' }, { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' }, { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

export default function AdminBookingsPanel() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [status,   setStatus]   = useState('');
  const [type,     setType]     = useState('');
  const [search,   setSearch]   = useState('');
  const [dSearch,  setDSearch]  = useState('');
  const [viewing,  setViewing]  = useState<Booking | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '25' });
    if (status)  p.set('status', status);
    if (type)    p.set('type', type);
    if (dSearch) p.set('search', dSearch);
    const res  = await fetch(`/api/admin/bookings?${p}`);
    const data = await res.json();
    if (data.success) { setBookings(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, status, type, dSearch]);

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

  const totalPages = Math.ceil(total / 25);

  return (
    <div>
      <Toaster richColors position="top-right" />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">All Bookings</h1>
          <p className="text-sm text-stone-500">{total} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 mb-5 flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Search phone or ref…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 w-56"
        />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white">
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">All Types</option>
          <option value="online">Online</option>
          <option value="phone">Phone</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Ref', 'Phone', 'Event', 'Type', 'Qty', 'Amount', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-stone-400">Loading…</td></tr>
            ) : !bookings.length ? (
              <tr><td colSpan={9} className="text-center py-12 text-stone-400">No bookings found</td></tr>
            ) : bookings.map((b: Booking) => {
              const event = b.event as unknown as { name: string } | null;
              return (
                <tr key={b.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-stone-600">{b.booking_ref}</td>
                  <td className="px-4 py-3 text-stone-700">{b.phone}</td>
                  <td className="px-4 py-3 text-stone-600 text-xs max-w-[140px] truncate">{event?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.booking_type === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {b.booking_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{b.quantity}</td>
                  <td className="px-4 py-3 font-semibold text-red-800">{paise(b.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${BOOKING_STATUS_COLOR[b.status]}`}>
                      {BOOKING_STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{fmtDateTime(b.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setViewing(b)} className="text-xs px-2 py-1 rounded-lg border border-stone-200 hover:border-red-400 text-stone-600">View</button>
                      {b.booking_type === 'phone' && ['pending','payment_init'].includes(b.status) && (
                        <button onClick={() => confirmPhone(b.id)} className="text-xs px-2 py-1 rounded-lg bg-green-100 hover:bg-green-200 text-green-700">Confirm</button>
                      )}
                      {['pending','payment_init','confirmed'].includes(b.status) && (
                        <button onClick={() => cancelBooking(b.id)} className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border rounded-lg text-sm disabled:opacity-40">← Prev</button>
          <span className="px-4 py-2 text-sm text-stone-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 border rounded-lg text-sm disabled:opacity-40">Next →</button>
        </div>
      )}

      {/* Booking detail drawer */}
      {viewing && (
        <BookingDetailModal booking={viewing} onClose={() => { setViewing(null); load(); }} />
      )}
    </div>
  );
}

function BookingDetailModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [full,    setFull]    = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/bookings/${booking.id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setFull(d.data); })
      .finally(() => setLoading(false));
  }, [booking.id]);

  const items    = (full?.muttu_items ?? []) as { id: string; name: string; nakshatra: string; obstacles: string; token_number?: number }[];
  const event    = full?.event as unknown as { name: string; event_date: string } | null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-stone-800">{booking.booking_ref}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl">✕</button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400">Loading…</div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-stone-500">Event</span><p className="font-medium">{event?.name}</p></div>
              <div><span className="text-stone-500">Type</span><p className="font-medium capitalize">{full?.booking_type}</p></div>
              <div><span className="text-stone-500">Quantity</span><p className="font-medium">{full?.quantity} Muttu</p></div>
              <div><span className="text-stone-500">Amount</span><p className="font-semibold text-red-800">{paise(full?.total_amount ?? 0)}</p></div>
              <div><span className="text-stone-500">Phone</span><p className="font-medium">{full?.phone}</p></div>
              <div><span className="text-stone-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BOOKING_STATUS_COLOR[full?.status as BookingStatus ?? 'pending']}`}>
                  {BOOKING_STATUS_LABEL[full?.status as BookingStatus ?? 'pending']}
                </span>
              </div>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} className="bg-stone-50 rounded-xl p-4 text-sm">
                <div className="font-semibold mb-1">Muttu {idx + 1} — {item.name}
                  {item.token_number && <span className="ml-2 font-mono text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">#{item.token_number}</span>}
                </div>
                <div className="text-stone-500">{item.nakshatra}</div>
                <div className="text-stone-600 mt-1">{item.obstacles}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
