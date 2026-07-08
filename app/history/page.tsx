// app/history/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Papa from "papaparse";
import CallDetailModal, { type CallAttemptDetail } from "@/components/CallDetailModal";

const OUTCOME_OPTIONS = [
  "BOOKED",
  "NOT_INTERESTED",
  "LINK_EMAILED",
  "CALLBACK_REQUESTED",
  "NO_ANSWER",
  "WRONG_NUMBER",
];

const STATUS_STYLES: Record<string, string> = {
  BOOKED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  NOT_INTERESTED: "bg-red-500/15 text-red-300 border-red-500/30",
  LINK_EMAILED: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  CALLBACK_REQUESTED: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  NO_ANSWER: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  WRONG_NUMBER: "bg-red-500/15 text-red-300 border-red-500/30",
};

const PAGE_SIZE = 50;

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallAttemptDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallAttemptDetail | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (outcome) params.set("outcome", outcome);

      const res = await fetch(`/api/call-history?${params}`);
      const data = await res.json();
      setCalls(data.callAttempts ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, outcome]);

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ all: "true" });
      if (search) params.set("search", search);
      if (outcome) params.set("outcome", outcome);

      const res = await fetch(`/api/call-history?${params}`);
      const data = await res.json();
      const allCalls: CallAttemptDetail[] = data.callAttempts ?? [];

      const csv = Papa.unparse(
        allCalls.map((c) => ({
          Date: formatDateTime(c.startedAt ?? c.createdAt),
          Name: c.lead.name,
          Phone: c.lead.phone,
          Company: c.lead.company ?? "",
          Outcome: c.outcome ?? "",
          "Duration (s)": c.durationSeconds ?? "",
          Summary: c.summary ?? "",
          "Main Pain Point": c.mainPainPoint ?? "",
          "Prospect Email": c.prospectEmail ?? "",
          "Disconnection Reason": c.disconnectionReason ?? "",
          "Recording URL": c.recordingUrl ?? "",
        }))
      );

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call_history_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
  }, [search, outcome]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Call History</h1>
          <p className="text-sm text-muted mt-1">{total} call{total !== 1 ? "s" : ""} logged</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadAll}
            disabled={downloading || total === 0}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2.5 disabled:opacity-40 transition-colors"
          >
            {downloading ? "Preparing…" : `Download all (${total})`}
          </button>
          <button
            onClick={fetchHistory}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2.5 transition-colors"
          >
            Refresh
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
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All outcomes</option>
          {OUTCOME_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : calls.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No calls match your search
                </td>
              </tr>
            ) : (
              calls.map((call) => (
                <tr
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="border-t border-border hover:bg-card/40 cursor-pointer"
                >
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {formatDateTime(call.startedAt ?? call.createdAt)}
                  </td>
                  <td className="px-4 py-3">{call.lead.name}</td>
                  <td className="px-4 py-3 text-muted">{call.lead.phone}</td>
                  <td className="px-4 py-3">
                    {call.outcome ? (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                          STATUS_STYLES[call.outcome] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30"
                        }`}
                      >
                        {call.outcome.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {formatDuration(call.durationSeconds)}
                  </td>
                  <td className="px-4 py-3 text-muted max-w-xs truncate">
                    {call.summary ?? "—"}
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
            Page {page} of {totalPages} · showing {calls.length} of {total}
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

      {selectedCall && (
        <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}