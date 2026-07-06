// components/ColumnMapper.tsx
"use client";

const LEAD_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "company", label: "Company", required: false },
  { key: "industry", label: "Industry", required: false },
  { key: "openerHook", label: "Opener Hook", required: false },
] as const;

export type LeadFieldKey = (typeof LEAD_FIELDS)[number]["key"];

interface ColumnMapperProps {
  csvHeaders: string[];
  mapping: Record<LeadFieldKey, string>;
  onChange: (mapping: Record<LeadFieldKey, string>) => void;
}

export default function ColumnMapper({ csvHeaders, mapping, onChange }: ColumnMapperProps) {
  return (
    <div className="flex flex-col gap-3">
      {LEAD_FIELDS.map((field) => (
        <div key={field.key} className="flex items-center justify-between gap-4">
          <label className="text-sm text-muted flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-red-400">*</span>}
          </label>
          <select
            value={mapping[field.key] ?? ""}
            onChange={(e) => onChange({ ...mapping, [field.key]: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
          >
            <option value="">— Skip —</option>
            {csvHeaders.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export { LEAD_FIELDS };