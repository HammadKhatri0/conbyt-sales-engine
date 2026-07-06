// components/GoogleSheetsImportDialog.tsx
"use client";

import { useState } from "react";
import ColumnMapper, { LEAD_FIELDS, type LeadFieldKey } from "./ColumnMapper";

interface GoogleSheetsImportDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "url" | "loading" | "map" | "importing" | "done" | "error";

export default function GoogleSheetsImportDialog({ onClose, onSuccess }: GoogleSheetsImportDialogProps) {
  const [step, setStep] = useState<Step>("url");
  const [sheetUrl, setSheetUrl] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<LeadFieldKey, string>>({
    name: "",
    phone: "",
    company: "",
    industry: "",
    openerHook: "",
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<{
    inserted: number;
    skippedDuplicate: number;
    skippedInvalid: number;
  } | null>(null);

  async function handleFetchSheet() {
    if (!sheetUrl.trim()) {
      setErrorMsg("Please paste a Google Sheets URL");
      return;
    }

    setStep("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/leads/sheets-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to fetch sheet");
        setStep("error");
        return;
      }

      setHeaders(data.headers);
      setRows(data.rows);

      const autoMap: Record<LeadFieldKey, string> = {
        name: "",
        phone: "",
        company: "",
        industry: "",
        openerHook: "",
      };
      for (const field of LEAD_FIELDS) {
        const match = data.headers.find((h: string) => {
          const lower = h.toLowerCase();
          if (field.key === "openerHook") {
            return lower.includes("opener") || lower.includes("hook") || lower.includes("note");
          }
          return lower.includes(field.key.toLowerCase());
        });
        if (match) autoMap[field.key] = match;
      }
      setMapping(autoMap);
      setStep("map");
    } catch {
      setErrorMsg("Network error while fetching the sheet");
      setStep("error");
    }
  }

  async function handleImport() {
    if (!mapping.name || !mapping.phone) {
      setErrorMsg("Name and Phone columns must be mapped before importing");
      return;
    }

    setStep("importing");
    setErrorMsg("");

    const leads = rows.map((row) => ({
      name: row[mapping.name] ?? "",
      phone: row[mapping.phone] ?? "",
      company: mapping.company ? row[mapping.company] : undefined,
      industry: mapping.industry ? row[mapping.industry] : undefined,
      openerHook: mapping.openerHook ? row[mapping.openerHook] : undefined,
    }));

    try {
      const res = await fetch("/api/leads/sheets-import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Import failed");
        setStep("error");
        return;
      }

      setResults(data.results);
      setStep("done");
      onSuccess();
    } catch {
      setErrorMsg("Network error during import");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import from Google Sheets</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        {step === "url" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Paste the link to a sheet shared with the import service account.
            </p>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
            <button
              onClick={handleFetchSheet}
              className="bg-accent hover:opacity-90 text-white rounded-lg py-2.5 text-sm font-medium"
            >
              Fetch Sheet
            </button>
          </div>
        )}

        {step === "loading" && (
          <p className="text-sm text-muted text-center py-6">Fetching sheet data…</p>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Found {rows.length} rows. Map your columns below:
            </p>
            <ColumnMapper csvHeaders={headers} mapping={mapping} onChange={setMapping} />
            {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
            <button
              onClick={handleImport}
              className="bg-accent hover:opacity-90 text-white rounded-lg py-2.5 text-sm font-medium"
            >
              Import {rows.length} Leads
            </button>
          </div>
        )}

        {step === "importing" && (
          <p className="text-sm text-muted text-center py-6">Importing leads…</p>
        )}

        {step === "done" && results && (
          <div className="text-center py-4">
            <p className="text-emerald-400 font-medium mb-2">Import complete</p>
            <p className="text-sm text-muted">
              {results.inserted} added · {results.skippedDuplicate} duplicates skipped ·{" "}
              {results.skippedInvalid} invalid rows skipped
            </p>
            <button
              onClick={onClose}
              className="mt-4 text-sm text-muted hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="text-center py-4">
            <p className="text-red-400 text-sm">{errorMsg}</p>
            <button
              onClick={() => setStep("url")}
              className="mt-4 text-sm text-muted hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}