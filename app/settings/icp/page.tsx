// app/settings/icp/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import TagInput from "@/components/TagInput";

interface ICPProfileData {
  id: string;
  name: string;
  isActive: boolean;
  targetIndustries: string[];
  employeeCountMin: number | null;
  employeeCountMax: number | null;
  geographyCountry: string | null;
  geographyRegion: string | null;
  targetJobTitles: string[];
  excludeJobTitles: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  linkedinPostKeywords: string[];
  websiteKeywords: string[];
  minScoreThreshold: number;
  competitorTools: string[];
  idealCustomerDescription: string | null;
  linkedinPresenceDescription: string | null;
  badFitDescription: string | null;
  immediateCallTrigger: string | null;
}

interface ProofPoint {
  id: string;
  name: string;
  metric: string;
  description: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6">
      <h2 className="text-sm font-semibold mb-4 text-muted uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted mb-1.5 block">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

function TextAreaField({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="text-xs text-muted mb-1 block">{label}</label>
      {helper && <p className="text-xs text-muted/70 mb-1.5">{helper}</p>}
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
      />
    </div>
  );
}

const EMPTY_PROFILE: Omit<ICPProfileData, "id" | "isActive"> = {
  name: "",
  targetIndustries: [],
  employeeCountMin: null,
  employeeCountMax: null,
  geographyCountry: null,
  geographyRegion: null,
  targetJobTitles: [],
  excludeJobTitles: [],
  positiveSignals: [],
  negativeSignals: [],
  linkedinPostKeywords: [],
  websiteKeywords: [],
  minScoreThreshold: 7,
  competitorTools: [],
  idealCustomerDescription: null,
  linkedinPresenceDescription: null,
  badFitDescription: null,
  immediateCallTrigger: null,
};

export default function ICPSettingsPage() {
  const [profiles, setProfiles] = useState<ICPProfileData[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [profile, setProfile] = useState<ICPProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  const [proofPoints, setProofPoints] = useState<ProofPoint[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [newProofPoint, setNewProofPoint] = useState({ name: "", metric: "", description: "" });
  const [newService, setNewService] = useState({ name: "", description: "" });

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/icp-profiles");
      const data = await res.json();
      const list: ICPProfileData[] = data.profiles ?? [];
      setProfiles(list);

      if (list.length > 0) {
        const active = list.find((p) => p.isActive) ?? list[0];
        setSelectedId(active.id);
        setProfile(active);
      } else {
        setSelectedId("");
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLibraries = useCallback(async () => {
    const [ppRes, svcRes] = await Promise.all([
      fetch("/api/proof-points"),
      fetch("/api/services"),
    ]);
    const ppData = await ppRes.json();
    const svcData = await svcRes.json();
    setProofPoints(ppData.proofPoints ?? []);
    setServices(svcData.services ?? []);
  }, []);

  useEffect(() => {
    loadProfiles();
    loadLibraries();
  }, [loadProfiles, loadLibraries]);

  function selectProfile(id: string) {
    setSelectedId(id);
    const found = profiles.find((p) => p.id === id);
    setProfile(found ?? null);
  }

  function updateField<K extends keyof ICPProfileData>(key: K, value: ICPProfileData[K]) {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
  }

  async function handleCreateProfile() {
    if (!newProfileName.trim()) return;
    const res = await fetch("/api/icp-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...EMPTY_PROFILE, name: newProfileName.trim() }),
    });
    const data = await res.json();
    if (data.profile) {
      setNewProfileName("");
      setCreatingNew(false);
      await loadProfiles();
      setSelectedId(data.profile.id);
      setProfile(data.profile);
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    setSavedMessage("");
    try {
      const { id, isActive, ...data } = profile;
      const res = await fetch(`/api/icp-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSavedMessage("Saved");
        setTimeout(() => setSavedMessage(""), 2000);
        await loadProfiles();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive() {
    if (!profile) return;
    await fetch(`/api/icp-profiles/${profile.id}/activate`, { method: "POST" });
    await loadProfiles();
  }

  async function handleDeleteProfile() {
    if (!profile) return;
    if (!confirm(`Delete ICP profile "${profile.name}"? This cannot be undone.`)) return;
    await fetch(`/api/icp-profiles/${profile.id}`, { method: "DELETE" });
    await loadProfiles();
  }

  async function handleAddProofPoint() {
    if (!newProofPoint.name.trim() || !newProofPoint.metric.trim() || !newProofPoint.description.trim()) {
      return;
    }
    const res = await fetch("/api/proof-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProofPoint),
    });
    if (res.ok) {
      setNewProofPoint({ name: "", metric: "", description: "" });
      await loadLibraries();
    }
  }

  async function handleDeleteProofPoint(id: string) {
    await fetch(`/api/proof-points/${id}`, { method: "DELETE" });
    await loadLibraries();
  }

  async function handleAddService() {
    if (!newService.name.trim() || !newService.description.trim()) return;
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newService),
    });
    if (res.ok) {
      setNewService({ name: "", description: "" });
      await loadLibraries();
    }
  }

  async function handleDeleteService(id: string) {
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    await loadLibraries();
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-10 text-muted text-sm">Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">ICP Settings</h1>
          <p className="text-sm text-muted mt-1">
            Define your ideal customer profile — used for scoring and personalization.
          </p>
        </div>
      </div>

      {/* Profile selector */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex items-center gap-3">
        <select
          value={selectedId}
          onChange={(e) => selectProfile(e.target.value)}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {profiles.length === 0 && <option value="">No profiles yet</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isActive ? "(Active)" : ""}
            </option>
          ))}
        </select>

        {profile && !profile.isActive && (
          <button
            onClick={handleSetActive}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2 transition-colors whitespace-nowrap"
          >
            Set Active
          </button>
        )}
        {profile?.isActive && (
          <span className="text-xs px-3 py-2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
            ● Active
          </span>
        )}

        <button
          onClick={() => setCreatingNew(!creatingNew)}
          className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2 transition-colors whitespace-nowrap"
        >
          + New Profile
        </button>
      </div>

      {creatingNew && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex items-center gap-3">
          <input
            type="text"
            placeholder="Profile name, e.g. Home Services SMBs"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={handleCreateProfile}
            className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-4 py-2 text-sm font-medium"
          >
            Create
          </button>
        </div>
      )}

      {profile && (
        <>
          <Section title="Structured Filters">
            <div className="mb-4">
              <TagInput
                label="Target Industries"
                values={profile.targetIndustries}
                onChange={(v) => updateField("targetIndustries", v)}
                placeholder="e.g. plumbing, landscaping…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <NumberField
                label="Employee Count Min"
                value={profile.employeeCountMin}
                onChange={(v) => updateField("employeeCountMin", v)}
              />
              <NumberField
                label="Employee Count Max"
                value={profile.employeeCountMax}
                onChange={(v) => updateField("employeeCountMax", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <TextField
                label="Geography — Country"
                value={profile.geographyCountry}
                onChange={(v) => updateField("geographyCountry", v)}
                placeholder="e.g. United States"
              />
              <TextField
                label="Geography — Region"
                value={profile.geographyRegion}
                onChange={(v) => updateField("geographyRegion", v)}
                placeholder="e.g. Texas, or Northeast"
              />
            </div>

            <div className="mb-4">
              <TagInput
                label="Target Job Titles"
                values={profile.targetJobTitles}
                onChange={(v) => updateField("targetJobTitles", v)}
                placeholder="e.g. Owner, Operations Manager…"
              />
            </div>

            <div className="mb-4">
              <TagInput
                label="Exclude Job Titles"
                values={profile.excludeJobTitles}
                onChange={(v) => updateField("excludeJobTitles", v)}
                placeholder="e.g. Intern, Student…"
              />
            </div>

            <div className="mb-4">
              <TagInput
                label="Positive Signals"
                values={profile.positiveSignals}
                onChange={(v) => updateField("positiveSignals", v)}
                placeholder="e.g. hiring, recently funded…"
              />
            </div>

            <div className="mb-4">
              <TagInput
                label="Negative Signals"
                values={profile.negativeSignals}
                onChange={(v) => updateField("negativeSignals", v)}
                placeholder="e.g. layoffs, shut down…"
              />
            </div>

            <div className="mb-4">
              <TagInput
                label="Keywords to Look For in LinkedIn Posts"
                values={profile.linkedinPostKeywords}
                onChange={(v) => updateField("linkedinPostKeywords", v)}
                placeholder="e.g. scheduling, dispatch…"
              />
            </div>

            <div className="mb-4">
              <TagInput
                label="Keywords to Look For on Company Website"
                values={profile.websiteKeywords}
                onChange={(v) => updateField("websiteKeywords", v)}
                placeholder="e.g. 24/7 service, family-owned…"
              />
            </div>

            <div className="mb-4">
              <label className="text-xs text-muted mb-1.5 block">
                Minimum Score Threshold — {profile.minScoreThreshold}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={profile.minScoreThreshold}
                onChange={(e) => updateField("minScoreThreshold", Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <div>
              <TagInput
                label="Competitor Tools List"
                values={profile.competitorTools}
                onChange={(v) => updateField("competitorTools", v)}
                placeholder="e.g. Jobber, ServiceTitan, Housecall Pro…"
              />
            </div>
          </Section>

          <Section title="Natural Language ICP">
            <TextAreaField
              label="Describe your ideal customer in your own words"
              helper="Their situation, problems, what makes them a good fit, what disqualifies them."
              value={profile.idealCustomerDescription}
              onChange={(v) => updateField("idealCustomerDescription", v)}
            />
            <TextAreaField
              label="Describe your ideal customer's LinkedIn presence"
              helper="What they post about, what signals in their posts indicate a good prospect."
              value={profile.linkedinPresenceDescription}
              onChange={(v) => updateField("linkedinPresenceDescription", v)}
            />
            <TextAreaField
              label="Describe what a bad fit looks like"
              helper="Who should never be called, even if the structured filters match."
              value={profile.badFitDescription}
              onChange={(v) => updateField("badFitDescription", v)}
            />
            <TextAreaField
              label="What is the one thing about a lead that would make you immediately want to call them?"
              helper="Becomes the highest-priority signal in scoring."
              value={profile.immediateCallTrigger}
              onChange={(v) => updateField("immediateCallTrigger", v)}
            />
          </Section>

          <div className="flex items-center justify-between mb-10">
            <button
              onClick={handleDeleteProfile}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Delete this profile
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {saving ? "Saving…" : savedMessage || "Save Profile"}
            </button>
          </div>
        </>
      )}

      {/* Proof Points Library */}
      <Section title="Conbyt Proof Points Library">
        <p className="text-xs text-muted/70 mb-4">
          Reusable proof points. AI picks the most relevant one per lead when generating briefs and emails.
        </p>
        <div className="flex flex-col gap-3 mb-4">
          {proofPoints.length === 0 && (
            <p className="text-sm text-muted">No proof points yet.</p>
          )}
          {proofPoints.map((pp) => (
            <div
              key={pp.id}
              className="bg-background border border-border rounded-lg p-3 flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {pp.name} <span className="text-accent">— {pp.metric}</span>
                </p>
                <p className="text-xs text-muted mt-0.5">{pp.description}</p>
              </div>
              <button
                onClick={() => handleDeleteProofPoint(pp.id)}
                className="text-muted hover:text-red-400 text-sm shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <input
            type="text"
            placeholder="Name, e.g. Response Time"
            value={newProofPoint.name}
            onChange={(e) => setNewProofPoint({ ...newProofPoint, name: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="text"
            placeholder="Metric, e.g. 40% faster dispatch"
            value={newProofPoint.metric}
            onChange={(e) => setNewProofPoint({ ...newProofPoint, metric: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="One-line description"
            value={newProofPoint.description}
            onChange={(e) => setNewProofPoint({ ...newProofPoint, description: e.target.value })}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={handleAddProofPoint}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2 transition-colors whitespace-nowrap"
          >
            Add
          </button>
        </div>
      </Section>

      {/* Services Library */}
      <Section title="Services Library">
        <p className="text-xs text-muted/70 mb-4">
          Conbyt's services, so the AI picks the right one to pitch per lead.
        </p>
        <div className="flex flex-col gap-3 mb-4">
          {services.length === 0 && <p className="text-sm text-muted">No services yet.</p>}
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-background border border-border rounded-lg p-3 flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted mt-0.5">{s.description}</p>
              </div>
              <button
                onClick={() => handleDeleteService(s.id)}
                className="text-muted hover:text-red-400 text-sm shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Service name"
            value={newService.name}
            onChange={(e) => setNewService({ ...newService, name: e.target.value })}
            className="w-48 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="text"
            placeholder="Short description"
            value={newService.description}
            onChange={(e) => setNewService({ ...newService, description: e.target.value })}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={handleAddService}
            className="border border-border hover:border-white/30 text-sm rounded-full px-4 py-2 transition-colors whitespace-nowrap"
          >
            Add
          </button>
        </div>
      </Section>
    </div>
  );
}