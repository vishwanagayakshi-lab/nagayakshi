import { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from '@tanstack/react-table';
import {
  useCtrlHeld, CopyableText, downloadCSV, ExportCsvButton,
  useRowSelection, HeaderCheckbox, BulkDeleteBar, bulkSoftDelete,
} from './tableShared';

export interface ColConfig {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'currency' | 'badge' | 'mono' | 'highlight';
  filterable?: boolean;
  align?: 'left' | 'right';
  // When set, this column renders custom content (e.g. action buttons) from
  // the full row instead of a single formatted value. Such columns are
  // excluded from CSV export, since there's no single "value" to export.
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

interface AdminTableProps {
  data: Record<string, unknown>[];
  columns: ColConfig[];
  filename?: string;
  deleteEndpoint?: string;
  cancelEndpoint?: string;
  cancelLabel?: string;
  idKey?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatValue(value: unknown, type?: ColConfig['type']): string {
  if (value == null || value === '') return '—';
  switch (type) {
    case 'date':
      try {
        return new Date(value as string).toLocaleString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      } catch { return String(value); }
    case 'currency':
      return (Number(value) / 100).toLocaleString('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0,
      });
    default:
      return String(value);
  }
}

const BADGE_POSITIVE = ['confirmed', 'active', 'scheduled', 'paid', 'open'];
const BADGE_NEGATIVE = ['failed', 'cancelled', 'expired', 'rejected', 'banned'];

function Cell({ value, type, ctrlHeld }: { value: unknown; type?: ColConfig['type']; ctrlHeld: boolean }) {
  if (value == null || value === '') {
    return <span style={{ color: '#94a3b8' }}>—</span>;
  }
  const text = formatValue(value, type);

  let inner: React.ReactNode;
  switch (type) {
    case 'badge': {
      const v = String(value);
      const tone = BADGE_POSITIVE.includes(v) ? 'positive' : BADGE_NEGATIVE.includes(v) ? 'negative' : 'neutral';
      const palette = {
        positive: { bg: 'rgba(16,185,129,0.1)',  fg: '#34d399', border: 'rgba(52,211,153,0.25)' },
        negative: { bg: 'rgba(239,68,68,0.1)',   fg: '#f87171', border: 'rgba(248,113,113,0.25)' },
        neutral:  { bg: 'rgba(107,114,128,0.15)', fg: '#9ca3af', border: 'rgba(107,114,128,0.25)' },
      }[tone];
      inner = (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
          letterSpacing: '0.03em',
          background: palette.bg, color: palette.fg,
          border: `1px solid ${palette.border}`,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: palette.fg, flexShrink: 0 }} />
          {text}
        </span>
      );
      break;
    }
    case 'mono':
      inner = (
        <span style={{ fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',monospace", fontSize: 11, color: '#64748b', letterSpacing: '-0.01em' }}>
          {text}
        </span>
      );
      break;
    case 'highlight':
      inner = (
        <span style={{ fontWeight: 600, color: '#f87171', fontSize: 13 }}>
          {text}
        </span>
      );
      break;
    case 'date':
      inner = <span style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{text}</span>;
      break;
    case 'currency':
      inner = <span style={{ color: '#34d399', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{text}</span>;
      break;
    default:
      inner = <span style={{ color: '#1e293b' }}>{text}</span>;
  }

  return <CopyableText value={text} ctrlHeld={ctrlHeld}>{inner}</CopyableText>;
}

// ─── sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, marginLeft: 5, opacity: dir ? 1 : 0.3 }}>
      <span style={{ width: 0, height: 0, borderLeft: '3.5px solid transparent', borderRight: '3.5px solid transparent', borderBottom: `4px solid ${dir === 'asc' ? '#2563eb' : '#cbd5e1'}` }} />
      <span style={{ width: 0, height: 0, borderLeft: '3.5px solid transparent', borderRight: '3.5px solid transparent', borderTop: `4px solid ${dir === 'desc' ? '#2563eb' : '#cbd5e1'}` }} />
    </span>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

const ACCENT = '#2563eb';

export default function AdminTable({ data, columns, filename = 'export', deleteEndpoint, cancelEndpoint, cancelLabel = 'Cancel Selected', idKey = 'id' }: AdminTableProps) {
  const [rows, setRows] = useState(data);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const ctrlHeld = useCtrlHeld();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => { setRows(data); }, [data]);

  const tanColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => columns.map(col => ({
      id: col.key, accessorKey: col.key, header: col.label,
      enableColumnFilter: col.filterable ?? false,
      cell: ({ getValue, row }) => col.render
        ? col.render(row.original)
        : <Cell value={getValue()} type={col.type} ctrlHeld={ctrlHeld} />,
    })),
    [columns, ctrlHeld],
  );

  const table = useReactTable({
    data: rows, columns: tanColumns,
    state: { globalFilter, sorting, columnFilters, pagination },
    onGlobalFilterChange: v => { setGlobalFilter(v); setPagination(p => ({ ...p, pageIndex: 0 })); },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
  });

  const filteredRows = table.getFilteredRowModel().rows.map(r => r.original);
  const pageRows = table.getRowModel().rows;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const hasFilters = columnFilters.some(f => f.value);
  const isFiltered = globalFilter || hasFilters;

  const csvColumns = useMemo(
    () => columns.filter(c => !c.render).map(c => ({ key: c.key, label: c.label, format: (v: unknown) => formatValue(v, c.type) })),
    [columns],
  );

  const filteredIds = useMemo(() => filteredRows.map(r => String(r[idKey])), [filteredRows, idKey]);
  const selection = useRowSelection(filteredIds);

  async function handleBulkDelete() {
    if (!deleteEndpoint) return;
    setDeleting(true);
    setDeleteError('');
    const ids = Array.from(selection.selected);
    const err = await bulkSoftDelete(deleteEndpoint, ids);
    if (err) {
      setDeleteError(err);
    } else {
      setRows(prev => prev.filter(r => !ids.includes(String(r[idKey]))));
      selection.clear();
    }
    setDeleting(false);
  }

  async function handleBulkCancel() {
    if (!cancelEndpoint) return;
    setCancelling(true);
    setCancelError('');
    const ids = Array.from(selection.selected);
    const err = await bulkSoftDelete(cancelEndpoint, ids);
    if (err) {
      setCancelError(err);
    } else {
      setRows(prev => prev.map(r => ids.includes(String(r[idKey])) ? { ...r, status: 'cancelled' } : r));
      selection.clear();
    }
    setCancelling(false);
  }

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0, maxWidth: 420 }}>
          <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#64748b', pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={globalFilter}
            onChange={e => { setGlobalFilter(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
            placeholder="Search all columns…"
            style={{
              paddingLeft: 34, paddingRight: globalFilter ? 32 : 12, paddingTop: 8, paddingBottom: 8,
              width: '100%', boxSizing: 'border-box', borderRadius: 8, fontSize: 13, outline: 'none', transition: 'border-color 0.15s',
              background: '#f8fafc', border: `1.5px solid ${globalFilter ? ACCENT : '#e2e8f0'}`,
              color: '#0f172a',
            }}
            onFocus={e => (e.target.style.borderColor = ACCENT)}
            onBlur={e => (e.target.style.borderColor = globalFilter ? ACCENT : '#e2e8f0')}
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 15, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >✕</button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {filteredRows.length.toLocaleString()} row{filteredRows.length !== 1 ? 's' : ''}
            {isFiltered ? ' filtered' : ''}
          </span>

          {isFiltered && (
            <button
              onClick={() => { setGlobalFilter(''); setColumnFilters([]); }}
              style={{ fontSize: 12, color: '#6b7280', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Clear
            </button>
          )}

          <ExportCsvButton onClick={() => downloadCSV(filteredRows, csvColumns, filename)} />
        </div>
      </div>

      {cancelEndpoint && (
        <BulkDeleteBar
          count={selection.selected.size}
          onDelete={handleBulkCancel}
          onClear={selection.clear}
          busy={cancelling}
          label={cancelLabel}
          tone="warning"
          confirmText={`Are you sure? This cancels ${selection.selected.size} appointment${selection.selected.size !== 1 ? 's' : ''} and frees up ${selection.selected.size !== 1 ? 'those slots' : 'that slot'} for booking again.`}
        />
      )}
      {cancelError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', fontSize: 12, color: '#b45309' }}>
          {cancelError}
        </div>
      )}
      {deleteEndpoint && (
        <BulkDeleteBar
          count={selection.selected.size}
          onDelete={handleBulkDelete}
          onClear={selection.clear}
          busy={deleting}
        />
      )}
      {deleteError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#dc2626' }}>
          {deleteError}
        </div>
      )}

      {/* ── Table card ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(37,99,235,0.08)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          {pageRows.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '64px 24px', fontSize: 13, color: '#94a3b8' }}>
              {isFiltered ? 'No results match your filters.' : 'No data yet.'}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} style={{
                    background: '#f8fafc',
                    borderBottom: `1px solid ${ACCENT}33`,
                  }}>
                    {deleteEndpoint && (
                      <th style={{ padding: '12px 8px 12px 20px', width: 1 }}>
                        <HeaderCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                      </th>
                    )}
                    {hg.headers.map(header => {
                      const col = columns.find(c => c.key === header.id);
                      const sorted = header.column.getIsSorted();
                      return (
                        <th key={header.id} style={{ padding: '0', textAlign: col?.align === 'right' ? 'right' : 'left' }}>
                          <div style={{ padding: '12px 20px 8px' }}>
                            <button
                              onClick={header.column.getToggleSortingHandler()}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 2,
                                fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
                                textTransform: 'uppercase', cursor: 'pointer',
                                color: sorted ? '#2563eb' : '#94a3b8',
                                background: 'none', border: 'none', padding: 0,
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={e => !sorted && ((e.currentTarget as HTMLElement).style.color = '#64748b')}
                              onMouseLeave={e => !sorted && ((e.currentTarget as HTMLElement).style.color = '#94a3b8')}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <SortIcon dir={sorted} />
                            </button>

                            {col?.filterable && (
                              <input
                                value={(header.column.getFilterValue() as string) ?? ''}
                                onChange={e => { header.column.setFilterValue(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                                placeholder="Filter…"
                                style={{
                                  display: 'block', marginTop: 6, width: '100%', boxSizing: 'border-box',
                                  padding: '4px 8px', borderRadius: 5, fontSize: 11, outline: 'none',
                                  background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b',
                                  transition: 'border-color 0.15s',
                                }}
                                onFocus={e => (e.target.style.borderColor = ACCENT + '80')}
                                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                              />
                            )}
                          </div>
                          {/* Per-column accent underline for sorted col */}
                          {sorted && (
                            <div style={{ height: 2, background: ACCENT, marginTop: -1, opacity: 0.7 }} />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>

              <tbody>
                {pageRows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < pageRows.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {deleteEndpoint && (
                      <td style={{ padding: '11px 8px 11px 20px' }}>
                        <input
                          type="checkbox"
                          checked={selection.selected.has(String(row.original[idKey]))}
                          onChange={() => selection.toggle(String(row.original[idKey]))}
                          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: ACCENT }}
                        />
                      </td>
                    )}
                    {row.getVisibleCells().map(cell => {
                      const col = columns.find(c => c.key === cell.column.id);
                      return (
                        <td key={cell.id} style={{ padding: '11px 20px', textAlign: col?.align === 'right' ? 'right' : 'left', verticalAlign: 'middle' }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Pagination ── */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => { table.setPageSize(Number(e.target.value)); setPagination(p => ({ ...p, pageIndex: 0 })); }}
              style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none', cursor: 'pointer' }}
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {[
              { label: '«', action: () => table.setPageIndex(0),   disabled: !table.getCanPreviousPage() },
              { label: '‹',  action: () => table.previousPage(),    disabled: !table.getCanPreviousPage() },
            ].map(btn => (
              <PagBtn key={btn.label} onClick={btn.action} disabled={btn.disabled}>{btn.label}</PagBtn>
            ))}

            <span style={{ padding: '0 10px', fontSize: 12, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
              {pageIndex + 1} / {pageCount}
            </span>

            {[
              { label: '›',  action: () => table.nextPage(),                      disabled: !table.getCanNextPage() },
              { label: '»', action: () => table.setPageIndex(pageCount - 1),     disabled: !table.getCanNextPage() },
            ].map(btn => (
              <PagBtn key={btn.label} onClick={btn.action} disabled={btn.disabled}>{btn.label}</PagBtn>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PagBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 7, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
        background: '#ffffff', border: '1.5px solid #e2e8f0', color: disabled ? '#cbd5e1' : '#64748b',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
      }}
      onMouseEnter={e => !disabled && ((e.currentTarget as HTMLElement).style.cssText += ';background:#eff6ff;color:#2563eb;border-color:#2563eb')}
      onMouseLeave={e => !disabled && ((e.currentTarget as HTMLElement).style.cssText = `width:30px;height:30px;border-radius:7px;font-size:14px;cursor:pointer;background:#ffffff;border:1.5px solid #e2e8f0;color:#64748b;display:flex;align-items:center;justify-content:center;transition:all 0.15s`)}
    >
      {children}
    </button>
  );
}
