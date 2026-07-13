// components/GoogleSheetsExportDialog.tsx
"use client";

import { useState } from "react";

interface GoogleSheetsExportDialogProps {
  leadIds: string[];
  onClose: () => void;
}

type Step = "input" | "exporting" | "done" | "error";

export default function GoogleSheetsExportDialog({ leadIds, onClose }: GoogleSheetsExportDialogProps) {
  const [step, setStep] = useState<Step>("input");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [sheetName, setSheetName] = useState(`Export ${new Date().toISOString().slice(0, 10)}`);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [exportedCount, setExportedCount] = useState(0);

  async function handleExport() {
    if (!spreadsheetUrl.trim()) {
      setErrorMsg("Please paste a Google Sheets URL");
      return;
    }
    if (!sheetName.trim()) {
      setErrorMsg("Please name the export tab");
      return;
    }

    setStep("exporting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/leads/sheets-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, spreadsheetUrl, sheetName }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Export failed");
        setStep("error");
        return;
      }

      setResultUrl(data.sheetUrl);
      setExportedCount(data.exportedCount);
      setStep("done");
    } catch {
      setErrorMsg("Network error during export");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Export to Google Sheets</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        {step === "input" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Exporting {leadIds.length} lead{leadIds.length !== 1 ? "s" : ""}. The spreadsheet must be shared
              with the import service account as <span className="text-white">Editor</span> (Viewer isn't enough
              for writing).
            </p>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="text"
              placeholder="Tab name"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
            <button
              onClick={handleExport}
              className="bg-accent hover:opacity-90 text-white rounded-lg py-2.5 text-sm font-medium"
            >
              Export {leadIds.length} Leads
            </button>
          </div>
        )}

        {step === "exporting" && (
          <p className="text-sm text-muted text-center py-6">Exporting…</p>
        )}

        {step === "done" && (
          <div className="text-center py-4">
            <p className="text-emerald-400 font-medium mb-2">
              {exportedCount} lead{exportedCount !== 1 ? "s" : ""} exported
            </p>
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline"
            >
              Open the sheet →
            </a>
            <div>
              <button onClick={onClose} className="mt-4 text-sm text-muted hover:text-white transition-colors">
                Close
              </button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="text-center py-4">
            <p className="text-red-400 text-sm">{errorMsg}</p>
            <button onClick={() => setStep("input")} className="mt-4 text-sm text-muted hover:text-white transition-colors">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
