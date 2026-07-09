// app/leads/import/page.tsx
"use client";

import { useEffect, useState } from "react";
import TagInput from "@/components/TagInput";
import type { ApolloPersonResult } from "@/lib/apollo";

interface Filters {
  industries: string[];
  jobTitles: string[];
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  geographyCountry: string;
  geographyRegion: string;
}

const EMPTY_FILTERS: Filters = {
  industries: [],
  jobTitles: [],
  employeeCountMin: null,
  employeeCountMax: null,
  geographyCountry: "",
  geographyRegion: "",
};

export default function LeadsImportPage() {
  const [activeTab] = useState<"apollo">("apollo");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [icpLoaded, setIcpLoaded] = useState(false);
  const [icpProfileName, setIcpProfileName] = useState<string | null>(null);

  const [results, setResults] = useState<ApolloPersonResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skippedDuplicate: number;
    skippedNoPhone: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/icp-profiles/active")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setIcpProfileName(data.profile.name);
          setFilters({
            industries: data.profile.targetIndustries ?? [],
            jobTitles: data.profile.targetJobTitles ?? [],
            employeeCountMin: data.profile.employeeCountMin ?? null,
            employeeCountMax: data.profile.employeeCountMax ?? null,
            geographyCountry: data.profile.geographyCountry ?? "",
            geographyRegion: data.profile.geographyRegion ?? "",
          });
        }
      })
      .finally(() => setIcpLoaded(true));
  }, []);

  async function runSearch(targetPage: number) {
    setSearching(true);
    setError("");
    setImportResult(null);
    try {
      const res = await fetch("/api/leads/apollo-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industries: filters.industries,
          jobTitles: filters.jobTitles,
          employeeCountMin: filters.employeeCountMin,
          employeeCountMax: filters.employeeCountMax,
          geographyCountry: filters.geographyCountry || undefined,
          geographyRegion: filters.geographyRegion || undefined,
          page: targetPage,
          perPage: 25,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        setResults([]);
        return;
      }

      setResults(data.people ?? []);
      setPage(data.page ?? targetPage);
      setTotalPages(data.totalPages ?? 1);
      setTotalEntries(data.totalEntries ?? 0);
      setSelected(new Set());
    } catch {
      setError("Network error during search");
    } finally {
      setSearching(false);
    }
  }

  function toggleSelect(apolloId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(apolloId)) next.delete(apolloId);
      else next.add(apolloId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.apolloId)));
    }
  }

  async function handleImport() {
    const chosen = results.filter((r) => selected.has(r.apolloId));
    if (chosen.length === 0) return;

    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/leads/apollo-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: chosen }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      setImportResult(data.results);
      setSelected(new Set());
    } catch {
      setError("Network error during import");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-1">Import Leads</h1>
      <p className="text-sm text-muted mb-6">
        Source new leads from Apollo, pre-filled from your active ICP profile.
      </p>

      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
            activeTab === "apollo" ? "border-accent text-white" : "border-transparent text-muted"
          }`}
        >
          Apollo
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        {icpLoaded && (
          <p className="text-xs text-muted mb-4">
            {icpProfileName
              ? `Pre-filled from your active ICP profile: "${icpProfileName}". Edit anything below before searching.`
              : "No active ICP profile found — search with the filters below, or set one up in Settings → ICP Settings for automatic pre-fill."}
          </p>
        )}

        <div className="mb-4">
          <TagInput
            label="Industries"
            values={filters.industries}
            onChange={(v) => setFilters({ ...filters, industries: v })}
            placeholder="e.g. plumbing, landscaping…"
          />
        </div>

        <div className="mb-4">
          <TagInput
            label="Job Titles"
            values={filters.jobTitles}
            onChange={(v) => setFilters({ ...filters, jobTitles: v })}
            placeholder="e.g. Owner, Operations Manager…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-muted mb-1.5 block">Employee Count Min</label>
            <input
              type="number"
              value={filters.employeeCountMin ?? ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  employeeCountMin: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1.5 block">Employee Count Max</label>
            <input
              type="number"
              value={filters.employeeCountMax ?? ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  employeeCountMax: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs text-muted mb-1.5 block">Country</label>
            <input
              type="text"
              value={filters.geographyCountry}
              onChange={(e) => setFilters({ ...filters, geographyCountry: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1.5 block">Region</label>
            <input
              type="text"
              value={filters.geographyRegion}
              onChange={(e) => setFilters({ ...filters, geographyRegion: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <button
          onClick={() => runSearch(1)}
          disabled={searching}
          className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          {searching ? "Searching…" : "Search Apollo"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-sm text-red-300">
          {error}
        </div>
      )}

      {importResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 text-sm text-emerald-300">
          Imported {importResult.inserted} lead{importResult.inserted !== 1 ? "s" : ""} ·{" "}
          {importResult.skippedDuplicate} duplicate{importResult.skippedDuplicate !== 1 ? "s" : ""} skipped ·{" "}
          {importResult.skippedNoPhone} skipped (no phone number)
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted">
              {totalEntries} total results · page {page} of {totalPages} · {selected.size} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={toggleSelectAll}
                className="text-sm text-accent hover:underline"
              >
                {selected.size === results.length ? "Deselect all" : "Select all on page"}
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                {importing ? "Importing…" : `Import Selected (${selected.size})`}
              </button>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-card text-muted text-left">
                <tr>
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Title</th>
                  <th className="px-3 py-3 font-medium">Company</th>
                  <th className="px-3 py-3 font-medium">Employees</th>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Phone</th>
                  <th className="px-3 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.apolloId}
                    onClick={() => toggleSelect(r.apolloId)}
                    className="border-t border-border hover:bg-card/40 cursor-pointer"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.apolloId)}
                        onChange={() => toggleSelect(r.apolloId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-3">{r.name}</td>
                    <td className="px-3 py-3 text-muted">{r.jobTitle ?? "—"}</td>
                    <td className="px-3 py-3 text-muted">{r.company ?? "—"}</td>
                    <td className="px-3 py-3 text-muted">{r.employeeCount ?? "—"}</td>
                    <td className="px-3 py-3 text-muted">{r.location ?? "—"}</td>
                    <td className="px-3 py-3 text-muted">
                      {r.phone ?? <span className="text-red-400/70">no phone</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-500/15 text-slate-300 border border-slate-500/30">
                        Pending
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted mb-10">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => runSearch(page - 1)}
                  disabled={page === 1 || searching}
                  className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => runSearch(page + 1)}
                  disabled={page === totalPages || searching}
                  className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}