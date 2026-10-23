import { useEffect, useState } from "react";

const ACCENT = "#2563eb";

// ─── Ctrl-to-copy ────────────────────────────────────────────────────────────
// Call once per table component (not per cell) — tracks whether Ctrl/Cmd is
// currently held so cells can show a copy affordance on hover.

export function useCtrlHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === "Control" || e.key === "Meta") setHeld(true); }
    function onKeyUp(e: KeyboardEvent) { if (e.key === "Control" || e.key === "Meta") setHeld(false); }
    function onBlur() { setHeld(false); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  return held;
}

// Wraps any cell's rendered value. While Ctrl/Cmd is held, hovering shows a
// dashed underline + copy cursor; clicking (still holding Ctrl/Cmd) copies
// `value` to the clipboard and flashes a "Copied" tag next to the cell.
// Legacy fallback for contexts where the async Clipboard API throws (e.g. the
// document doesn't currently have focus — common with DevTools open — or the
// permission simply isn't granted). document.execCommand is deprecated but
// still broadly supported and works in exactly those cases.
function legacyCopy(value: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

export function CopyableText({
  value, ctrlHeld, children,
}: { value: string; ctrlHeld: boolean; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleClick(e: React.MouseEvent) {
    // Prefer the tracked keyboard state over e.ctrlKey/metaKey on the click event
    // itself — releasing Ctrl a moment before the mouse click completes (easy to
    // do) makes the click event report false even though the user held it the
    // whole time they were aiming, which made this silently do nothing before.
    if (!(ctrlHeld || e.ctrlKey || e.metaKey) || !value) return;
    e.stopPropagation();
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = legacyCopy(value);
    }
    setStatus(ok ? "copied" : "failed");
    setTimeout(() => setStatus("idle"), 1200);
  }

  const active = ctrlHeld && !!value;

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      style={{
        cursor: active ? "copy" : "inherit",
        textDecoration: active && hover ? "underline dashed" : "none",
        textUnderlineOffset: 3,
        position: "relative",
      }}
    >
      {children}
      {status !== "idle" && (
        <span style={{
          position: "absolute", left: 0, top: "100%", marginTop: 2, whiteSpace: "nowrap",
          fontSize: 10, fontWeight: 600, color: "#fff",
          background: status === "copied" ? "#0f172a" : "#dc2626",
          padding: "2px 6px", borderRadius: 4, zIndex: 20,
        }}>
          {status === "copied" ? "Copied" : "Copy failed"}
        </span>
      )}
    </span>
  );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

export interface CsvColumn {
  key: string;
  label: string;
  // Second arg is the whole row — needed when a column's displayed value is
  // derived from more than just its own key (e.g. falling back to another
  // field), so the export matches what's actually shown on screen.
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

export function downloadCSV(rows: Record<string, unknown>[], cols: CsvColumn[], filename: string) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const val = (row: Record<string, unknown>, col: CsvColumn) => {
    const raw = row[col.key];
    if (col.format) return col.format(raw, row);
    return raw == null ? "" : String(raw);
  };
  const header = cols.map(c => esc(c.label)).join(",");
  const body = rows.map(row => cols.map(c => esc(val(row, c))).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${filename}.csv` });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function ExportCsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
        background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#64748b", transition: "all 0.15s",
        fontFamily: "inherit",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#64748b"; (e.currentTarget as HTMLElement).style.color = "#0f172a"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
    >
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Export CSV
    </button>
  );
}

// ─── Row selection + bulk soft-delete ───────────────────────────────────────

export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
  const someSelected = ids.some(id => selected.has(id));

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ids));
  }
  function clear() { setSelected(new Set()); }

  return { selected, toggle, toggleAll, clear, allSelected, someSelected };
}

export function HeaderCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={el => { if (el) el.indeterminate = indeterminate && !checked; }}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      style={{ width: 15, height: 15, cursor: "pointer", accentColor: ACCENT }}
    />
  );
}

// Bulk-delete/cancel action bar. Shows a two-step confirm (matches the existing
// single-row Archive/Delete pattern elsewhere in the admin) before calling
// `onDelete`. Rendered only when at least one row is selected. `tone`
// controls the accent color (danger = red, for destructive/hiding actions;
// warning = amber, for non-destructive status changes like cancelling).
export function BulkDeleteBar({
  count, onDelete, onClear, label = "Delete Selected", confirmText, busy = false, tone = "danger",
}: {
  count: number; onDelete: () => void; onClear: () => void;
  label?: string; confirmText?: string; busy?: boolean; tone?: "danger" | "warning";
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (count === 0) setConfirm(false); }, [count]);
  if (count === 0) return null;

  const c = tone === "danger"
    ? { border: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.08)", text: "#dc2626", solid: "#dc2626" }
    : { border: "rgba(217,119,6,0.35)", bg: "rgba(217,119,6,0.08)", text: "#b45309", solid: "#d97706" };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "9px 14px", borderRadius: 9, marginBottom: 12,
      background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)",
      fontSize: 12, color: "#1e3a8a",
    }}>
      <span style={{ fontWeight: 600 }}>{count} selected</span>

      {!confirm ? (
        <>
          <button
            onClick={() => setConfirm(true)}
            style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: "pointer" }}
          >
            {label}
          </button>
          <button onClick={onClear} style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Clear
          </button>
        </>
      ) : (
        <>
          <span>{confirmText ?? `Are you sure? This can be recovered by an admin later, but will hide ${count} row${count !== 1 ? "s" : ""} now.`}</span>
          <button
            onClick={onDelete}
            disabled={busy}
            style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", background: c.solid, color: "#fff", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, whiteSpace: "nowrap" }}
          >
            {busy ? "…" : "Confirm"}
          </button>
          <button onClick={() => setConfirm(false)} style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>
            Never mind
          </button>
        </>
      )}
    </div>
  );
}

// POSTs { ids } to a soft-delete endpoint. Returns an error message on
// failure, or null on success.
export async function bulkSoftDelete(endpoint: string, ids: string[]): Promise<string | null> {
  try {
    const res = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json().catch(() => ({ ok: false, error: `Server error ${res.status}` }));
    return json.ok ? null : (json.error || "Failed to delete.");
  } catch {
    return "Network error. Please try again.";
  }
}
