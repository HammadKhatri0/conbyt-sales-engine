// components/CsvUploadDialog.tsx
"use client";

import { useState } from "react";
import Papa from "papaparse";
import ColumnMapper, { LEAD_FIELDS, type LeadFieldKey } from "./ColumnMapper";

interface CsvUploadDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "select" | "map" | "uploading" | "done" | "error";

export default function CsvUploadDialog({ onClose, onSuccess }: CsvUploadDialogProps) {
  const [step, setStep] = useState<Step>("select");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<LeadFieldKey, string>>({
    name: "",
    phone: "",
    company: "",
    industry: "",
    website: "",
    openerHook: "",
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<{
    inserted: number;
    skippedDuplicate: number;
    skippedInvalid: number;
  } | null>(null);

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data.length) {
          setErrorMsg("The CSV file appears to be empty");
          setStep("error");
          return;
        }
        const headers = result.meta.fields ?? [];
        setCsvHeaders(headers);
        setCsvRows(result.data);

        // Best-effort auto-map by matching header names loosely
        const autoMap: Record<LeadFieldKey, string> = {
          name: "",
          phone: "",
          company: "",
          industry: "",
          website: "",
          openerHook: "",
        };
        for (const field of LEAD_FIELDS) {
          const match = headers.find((h) => {
            const lower = h.toLowerCase();
            if (field.key === "openerHook") {
              return lower.includes("opener") || lower.includes("hook") || lower.includes("note");
            }
            if (field.key === "website") {
              return lower.includes("website") || lower.includes("domain") || lower.includes("url");
            }
            return lower.includes(field.key.toLowerCase());
          });
          if (match) autoMap[field.key] = match;
        }
        setMapping(autoMap);
        setStep("map");
      },
      error: (err) => {
        setErrorMsg(err.message);
        setStep("error");
      },
    });
  }

  async function handleImport() {
    if (!mapping.name || !mapping.phone) {
      setErrorMsg("Name and Phone columns must be mapped before importing");
      return;
    }

    setStep("uploading");
    setErrorMsg("");

    const leads = csvRows.map((row) => ({
      name: row[mapping.name] ?? "",
      phone: row[mapping.phone] ?? "",
      company: mapping.company ? row[mapping.company] : undefined,
      industry: mapping.industry ? row[mapping.industry] : undefined,
      website: mapping.website ? row[mapping.website] : undefined,
      openerHook: mapping.openerHook ? row[mapping.openerHook] : undefined,
    }));

    try {
      const res = await fetch("/api/leads/csv-upload", {
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
          <h2 className="text-lg font-semibold">Upload Leads CSV</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        {step === "select" && (
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent file:text-white"
            />
          </div>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Found {csvRows.length} rows. Map your columns below:
            </p>
            <ColumnMapper csvHeaders={csvHeaders} mapping={mapping} onChange={setMapping} />
            {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
            <button
              onClick={handleImport}
              className="bg-accent hover:opacity-90 text-white rounded-lg py-2.5 text-sm font-medium"
            >
              Import {csvRows.length} Leads
            </button>
          </div>
        )}

        {step === "uploading" && (
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
              onClick={() => setStep("select")}
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