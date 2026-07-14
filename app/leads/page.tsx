// app/leads/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import CsvUploadDialog from "@/components/CsvUploadDialogue";
import GoogleSheetsImportDialog from "@/components/GoogleSheetsImportDialog";
import GoogleSheetsExportDialog from "@/components/GoogleSheetsExportDialog";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  industry: string | null;
  website: string | null;
  status: string;
  enrichmentStatus: string;
  finalScore: number | null;
}

const STATUS_OPTIONS = [
  "NEW",
  "QUEUED",
  "CALLING",
  "BOOKED",
  "NOT_INTERESTED",
  "LINK_EMAILED",
  "CALLBACK_REQUESTED",
  "NO_ANSWER",
  "WRONG_NUMBER",
  "DO_NOT_CALL",
  "REPLIED",
];

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  QUEUED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  CALLING: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  BOOKED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  NOT_INTERESTED: "bg-red-500/15 text-red-300 border-red-500/30",
  LINK_EMAILED: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  CALLBACK_REQUESTED: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  NO_ANSWER: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  WRONG_NUMBER: "bg-red-500/15 text-red-300 border-red-500/30",
  DO_NOT_CALL: "bg-red-700/15 text-red-400 border-red-700/30",
  REPLIED: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

const ENRICHMENT_STYLES: Record<string, string> = {
  PENDING: "bg-slate-500/15 text-slate-300",
  ENRICHING: "bg-blue-500/15 text-blue-300 animate-pulse",
  READY: "bg-emerald-500/15 text-emerald-300",
  FAILED: "bg-red-500/15 text-red-300",
};

const PAGE_SIZE = 100;

function ExportMenu({
  label,
  disabled,
  options,
}: {
  label: string;
  disabled?: boolean;
  options: { label: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2.5 disabled:opacity-40 transition-colors flex items-center gap-1.5"
      >
        {label} <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-lg py-1.5 z-20">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                opt.onClick();
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-background transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showSheetsImport, setShowSheetsImport] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [preparingExport, setPreparingExport] = useState(false);
  const [exportLeadIds, setExportLeadIds] = useState<string[] | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  // Poll while any visible lead is actively enriching, so status updates
  // without the user needing to manually refresh.
  useEffect(() => {
    const hasEnriching = leads.some((l) => l.enrichmentStatus === "ENRICHING");
    if (!hasEnriching) return;
    const interval = setInterval(fetchLeads, 3000);
    return () => clearInterval(interval);
  }, [leads, fetchLeads]);

  function scoreBadgeColor(score: number | null): string {
    if (score == null) return "bg-slate-500/15 text-slate-300";
    if (score <= 4) return "bg-red-500/15 text-red-300";
    if (score <= 6) return "bg-orange-500/15 text-orange-300";
    return "bg-emerald-500/15 text-emerald-300";
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const allSelected = leads.every((l) => selectedIds.has(l.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        leads.forEach((l) => next.delete(l.id));
      } else {
        leads.forEach((l) => next.add(l.id));
      }
      return next;
    });
  }

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ all: "true" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      const allLeads: Lead[] = data.leads ?? [];

      const csv = Papa.unparse(
        allLeads.map((l) => ({
          Name: l.name,
          Phone: l.phone,
          Company: l.company ?? "",
          Industry: l.industry ?? "",
          Website: l.website ?? "",
          Status: l.status,
          Enrichment: l.enrichmentStatus,
        }))
      );

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleExportAll() {
    setPreparingExport(true);
    try {
      const params = new URLSearchParams({ all: "true" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      const ids: string[] = (data.leads ?? []).map((l: Lead) => l.id);

      if (ids.length === 0) {
        alert("No leads match your current search/filter");
        return;
      }
      setExportLeadIds(ids);
    } finally {
      setPreparingExport(false);
    }
  }

  function handleExportSelected() {
    if (selectedIds.size === 0) return;
    setExportLeadIds(Array.from(selectedIds));
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected lead${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete leads. If any selected lead has call history, remove it from the selection and try again.");
        return;
      }

      setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      setTotal((prev) => prev - data.deletedCount);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch {
      alert("Network error while deleting");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleEnrichSelected() {
    if (selectedIds.size === 0) return;

    setEnriching(true);
    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to queue enrichment");
        return;
      }

      setSelectedIds(new Set());
      setSelectMode(false);
      await fetchLeads();
    } catch {
      alert("Network error while queuing enrichment");
    } finally {
      setEnriching(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allOnPageSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted mt-1">{total} total</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {selectMode && selectedIds.size > 0 && (
            <>
              <button
                onClick={handleEnrichSelected}
                disabled={enriching}
                className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-40"
              >
                {enriching ? "Queuing…" : `Enrich ${selectedIds.size} selected`}
              </button>
              <button
                onClick={handleExportSelected}
                className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2.5 transition-colors"
              >
                {`Export ${selectedIds.size} to Sheets`}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-40"
              >
                {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size} selected`}
              </button>
            </>
          )}
          <button
            onClick={toggleSelectMode}
            className={`border text-sm rounded-full px-4 py-2.5 transition-colors ${selectMode ? "border-white/30 bg-card" : "border-border hover:border-white/30"
              }`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
          <button
            onClick={() => setShowSheetsImport(true)}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2.5 transition-colors"
          >
            Import from Sheets
          </button>
          <ExportMenu
            label={downloading || preparingExport ? "Preparing…" : "Export"}
            disabled={downloading || preparingExport || total === 0}
            options={[
              { label: `Download all (${total}) as CSV`, onClick: handleDownloadAll },
              { label: "Export to Google Sheets", onClick: handleExportAll },
            ]}
          />
          <Link
            href="/leads/import"
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2.5 transition-colors flex items-center"
          >
            Import from Apollo
          </Link>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-5 py-2.5 text-sm font-medium shadow-lg shadow-accent/20"
          >
            Upload CSV
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Search name, phone, or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted text-left">
            <tr>
              {selectMode && (
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} className="accent-accent" />
                </th>
              )}
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Enrichment</th>
              <th className="px-4 py-3 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No leads match your search
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => selectMode && toggleSelect(lead.id)}
                  className={`border-t border-border hover:bg-card/40 ${selectedIds.has(lead.id) ? "bg-accent/5" : ""
                    } ${selectMode ? "cursor-pointer" : ""}`}
                >
                  {selectMode && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="accent-accent"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {selectMode ? (
                      lead.name
                    ) : (
                      <Link href={`/leads/${lead.id}`} className="hover:text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                        {lead.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.phone}</td>
                  <td className="px-4 py-3 text-muted">{lead.company ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${STATUS_STYLES[lead.status] ?? ""}`}>
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${ENRICHMENT_STYLES[lead.enrichmentStatus] ?? ""}`}>
                      {lead.enrichmentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${scoreBadgeColor(lead.finalScore)}`}>
                      {lead.finalScore != null ? lead.finalScore.toFixed(1) : "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted">
          <span>
            Page {page} of {totalPages} · showing {leads.length} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-30"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {showUpload && <CsvUploadDialog onClose={() => setShowUpload(false)} onSuccess={fetchLeads} />}
      {showSheetsImport && (
        <GoogleSheetsImportDialog onClose={() => setShowSheetsImport(false)} onSuccess={fetchLeads} />
      )}
      {exportLeadIds && (
        <GoogleSheetsExportDialog leadIds={exportLeadIds} onClose={() => setExportLeadIds(null)} />
      )}
    </div>
  );
}