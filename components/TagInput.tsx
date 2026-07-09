// components/TagInput.tsx
"use client";

import { useState, type KeyboardEvent } from "react";

export default function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(values.filter((v) => v !== tag));
  }

  return (
    <div>
      <label className="text-xs text-muted mb-1.5 block">{label}</label>
      <div className="bg-background border border-border rounded-lg px-3 py-2 flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-accent">
        {values.map((tag) => (
          <span
            key={tag}
            className="bg-accent/15 text-accent text-xs px-2 py-1 rounded-md flex items-center gap-1.5"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-white leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[100px] bg-transparent text-sm focus:outline-none py-0.5"
        />
      </div>
    </div>
  );
}