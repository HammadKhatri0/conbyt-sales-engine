// app/queue/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";

interface Lead {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  industry: string | null;
  status: string;
  createdAt: string;
}

interface ActiveCampaign {
  id: string;
  name: string;
  status: "RUNNING" | "PAUSED";
  totalLeads: number;
  queuedCount: number;
  calledCount: number;
  emailBeforeCall: boolean;
  emailWaitHours: number;
  emailedCount: number;
  awaitingEmailCount: number;
  awaitingWaitCount: number;
  currentLead: { id: string; name: string; phone: string } | null;
}

export default function QueuePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<ActiveCampaign | null>(null);
  const [pauseResumeLoading, setPauseResumeLoading] = useState(false);
  const [filteredOutCount, setFilteredOutCount] = useState(0);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "QUEUED", page: "1", excludeBelowThreshold: "true", excludeSuppressed: "true" });
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setFilteredOutCount(data.filteredOutCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActiveCampaign = useCallback(async () => {
    const res = await fetch("/api/campaigns/active");
    const data = await res.json();
    setActiveCampaign(data.campaign ?? null);
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchActiveCampaign();
  }, [fetchQueue, fetchActiveCampaign]);

  // Poll active campaign status every 5s while one is running/paused
  useEffect(() => {
    if (!activeCampaign) return;
    const interval = setInterval(fetchActiveCampaign, 5000);
    return () => clearInterval(interval);
  }, [activeCampaign, fetchActiveCampaign]);

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

  function toggleSelectAll() {
    const allSelected = leads.every((l) => selectedIds.has(l.id));
    setSelectedIds(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }

  async function handleStartCampaign() {
    if (selectedIds.size === 0) return;

    const name = window.prompt("Name this campaign:", `Campaign ${new Date().toLocaleDateString()}`);
    if (!name) return;

    const emailBeforeCall = window.confirm(
      "Send an AI-generated email first, then call leads who haven't converted after a wait period?\n\n" +
      "OK = email → wait → call. Cancel = call-only (as before)."
    );
    let emailWaitHours = 48;
    if (emailBeforeCall) {
      const hoursStr = window.prompt("Wait how many hours after the email before calling?", "48");
      if (hoursStr && !isNaN(Number(hoursStr))) emailWaitHours = Number(hoursStr);
    }

    setStarting(true);
    try {
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, leadIds: Array.from(selectedIds), emailBeforeCall, emailWaitHours }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        alert(createData.error || "Failed to create campaign");
        return;
      }

      const startRes = await fetch(`/api/campaigns/${createData.campaign.id}/start`, {
        method: "POST",
      });

      if (!startRes.ok) {
        alert("Campaign created but failed to start");
        return;
      }

      setSelectMode(false);
      setSelectedIds(new Set());
      await fetchActiveCampaign();
      await fetchQueue();
    } catch {
      alert("Network error while starting campaign");
    } finally {
      setStarting(false);
    }
  }

  async function handlePause() {
    if (!activeCampaign) return;
    setPauseResumeLoading(true);
    try {
      await fetch(`/api/campaigns/${activeCampaign.id}/pause`, { method: "POST" });
      await fetchActiveCampaign();
    } finally {
      setPauseResumeLoading(false);
    }
  }

  async function handleResume() {
    if (!activeCampaign) return;
    setPauseResumeLoading(true);
    try {
      await fetch(`/api/campaigns/${activeCampaign.id}/resume`, { method: "POST" });
      await fetchActiveCampaign();
    } finally {
      setPauseResumeLoading(false);
    }
  }

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Call Queue</h1>
          <p className="text-sm text-muted mt-1">
            {total} lead{total !== 1 ? "s" : ""} waiting to be called
          </p>
          {filteredOutCount > 0 && (
            <p className="text-xs text-amber-400/80 mt-1">
              {filteredOutCount} lead{filteredOutCount !== 1 ? "s" : ""} hidden — scored below your ICP's minimum threshold
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectMode && selectedIds.size > 0 && (
            <button
              onClick={handleStartCampaign}
              disabled={starting || !!activeCampaign}
              className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {starting ? "Starting…" : `Start Campaign (${selectedIds.size})`}
            </button>
          )}
          <button
            onClick={toggleSelectMode}
            disabled={!!activeCampaign}
            className={`border text-sm rounded-full px-4 py-2.5 transition-colors disabled:opacity-40 ${selectMode ? "border-white/30 bg-card" : "border-border hover:border-white/30"
              }`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
          <button
            onClick={fetchQueue}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2.5 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Active campaign banner */}
      {activeCampaign && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${activeCampaign.status === "RUNNING" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  }`}
              />
              <p className="font-medium text-sm">{activeCampaign.name}</p>
              <span className="text-xs text-muted">
                {activeCampaign.status === "RUNNING" ? "Running" : "Paused"}
              </span>
            </div>
            <p className="text-xs text-muted">
              {activeCampaign.calledCount} of {activeCampaign.totalLeads} called
              {activeCampaign.currentLead && (
                <> · currently calling {activeCampaign.currentLead.name} ({activeCampaign.currentLead.phone})</>
              )}
            </p>
            {activeCampaign.emailBeforeCall && (
              <p className="text-xs text-purple-300 mt-1">
                Email → wait {activeCampaign.emailWaitHours}h → call · {activeCampaign.emailedCount} emailed
                {activeCampaign.awaitingEmailCount > 0 && <>, {activeCampaign.awaitingEmailCount} awaiting email</>}
                {activeCampaign.awaitingWaitCount > 0 && <>, {activeCampaign.awaitingWaitCount} in wait window</>}
              </p>
            )}
          </div>
          <button
            onClick={activeCampaign.status === "RUNNING" ? handlePause : handleResume}
            disabled={pauseResumeLoading}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2 disabled:opacity-40"
          >
            {pauseResumeLoading
              ? "…"
              : activeCampaign.status === "RUNNING"
                ? "Pause"
                : "Resume"}
          </button>
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted text-left">
            <tr>
              {selectMode && (
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="accent-accent" />
                </th>
              )}
              <th className="px-4 py-3 font-medium w-12">#</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Industry</th>
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
                  Queue is empty — upload leads or wait for retries to land here
                </td>
              </tr>
            ) : (
              leads.map((lead, i) => (
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
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3">{lead.name}</td>
                  <td className="px-4 py-3 text-muted">{lead.phone}</td>
                  <td className="px-4 py-3 text-muted">{lead.company ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{lead.industry ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 100 && (
        <p className="text-xs text-muted mt-3">
          Showing first 100 of {total} queued leads.
        </p>
      )}
    </div>
  );
}