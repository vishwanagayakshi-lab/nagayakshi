'use client';
import { useState, useEffect, useCallback } from 'react';
import { paise, fmtDateTime } from '@/lib/utils';
import { getNakshatraByKey } from '@/lib/nakshatra';

interface Offering {
  id: string;
  offering_ref: string;
  devotee_name: string;
  nakshatra: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  purpose: string;
  amount: number; // paise
  status: 'pending' | 'payment_init' | 'paid' | 'failed';
  razorpay_payment_id: string | null;
  email_sent_at: string | null;
  created_at: string;
}

const STATUS_OPTS = [
  { value: '',             label: 'All Status' },
  { value: 'pending',      label: 'Pending' },
  { value: 'payment_init', label: 'Payment Init' },
  { value: 'paid',         label: 'Paid' },
  { value: 'failed',       label: 'Failed' },
];

const STATUS_COLOR: Record<string, string> = {
  pending:      'bg-stone-100 text-stone-600',
  payment_init: 'bg-amber-100 text-amber-700',
  paid:         'bg-green-100 text-green-700',
  failed:       'bg-red-100 text-red-700',
};

export default function AdminOfferingsPanel() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState('');
  const [search,    setSearch]    = useState('');
  const [dSearch,   setDSearch]   = useState('');
  const [viewing,   setViewing]   = useState<Offering | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '25' });
    if (status)  p.set('status', status);
    if (dSearch) p.set('search', dSearch);
    const res  = await fetch(`/api/admin/offerings?${p}`);
    const data = await res.json();
    if (data.success) { setOfferings(data.data); setTotal(data.meta.total); }
    setLoading(false);
  }, [page, status, dSearch]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 25);
  const paidTotal = offerings.filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0);

  return (
    <div>
      <p className="text-sm text-stone-500 mb-5">{total} total registrations{offerings.length ? ` · ${paise(paidTotal)} paid on this page` : ''}</p>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 mb-5 flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Search name, phone, email or ref…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 w-64"
        />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white">
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Ref', 'Name', 'Phone', 'Purpose', 'Amount', 'Status', 'Email', 'Created', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-stone-500 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-stone-400">Loading…</td></tr>
            ) : !offerings.length ? (
              <tr><td colSpan={9} className="text-center py-12 text-stone-400">No registrations found</td></tr>
            ) : offerings.map(o => (
              <tr key={o.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-stone-600">{o.offering_ref}</td>
                <td className="px-4 py-3 text-stone-700">{o.devotee_name}</td>
                <td className="px-4 py-3 text-stone-600">{o.phone}</td>
                <td className="px-4 py-3 text-stone-600 text-xs max-w-[160px] truncate">{o.purpose}</td>
                <td className="px-4 py-3 font-semibold text-red-800">{paise(o.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[o.status]}`}>{o.status}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {o.email_sent_at
                    ? <span className="text-green-600">Sent</span>
                    : <span className="text-stone-400">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{fmtDateTime(o.created_at)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setViewing(o)} className="text-xs px-2 py-1 rounded-lg border border-stone-200 hover:border-red-400 text-stone-600">View</button>
                </td>
              </tr>
            ))}
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

      {viewing && <OfferingDetailModal offering={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function OfferingDetailModal({ offering, onClose }: { offering: Offering; onClose: () => void }) {
  const nakshatra = getNakshatraByKey(offering.nakshatra)?.sanskrit ?? offering.nakshatra;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-stone-800">{offering.offering_ref}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-stone-500">Name</span><p className="font-medium">{offering.devotee_name}</p></div>
            <div><span className="text-stone-500">Nakshatra</span><p className="font-medium">{nakshatra}</p></div>
            <div><span className="text-stone-500">Phone</span><p className="font-medium">{offering.phone}</p></div>
            <div><span className="text-stone-500">Email</span><p className="font-medium">{offering.email}</p></div>
            <div><span className="text-stone-500">City</span><p className="font-medium">{offering.city}</p></div>
            <div><span className="text-stone-500">Amount</span><p className="font-semibold text-red-800">{paise(offering.amount)}</p></div>
            <div className="col-span-2"><span className="text-stone-500">Address</span><p className="font-medium">{offering.address}</p></div>
            <div className="col-span-2"><span className="text-stone-500">Purpose</span><p className="font-medium">{offering.purpose}</p></div>
            <div>
              <span className="text-stone-500">Status</span>
              <div><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[offering.status]}`}>{offering.status}</span></div>
            </div>
            <div><span className="text-stone-500">Email Sent</span><p className="font-medium">{offering.email_sent_at ? fmtDateTime(offering.email_sent_at) : '—'}</p></div>
            {offering.razorpay_payment_id && (
              <div className="col-span-2"><span className="text-stone-500">Payment ID</span><p className="font-mono text-xs">{offering.razorpay_payment_id}</p></div>
            )}
          </div>

          {offering.status === 'paid' && (
            <a
              href={`/api/offerings/${offering.id}/receipt.pdf`}
              target="_blank" rel="noopener"
              className="inline-block text-sm px-4 py-2 rounded-lg border border-red-800 text-red-800 hover:bg-red-50"
            >
              Download Receipt (PDF)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
