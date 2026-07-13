// app/leads/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

interface CallAttempt {
    id: string;
    outcome: string | null;
    transcript: string | null;
    summary: string | null;
    recordingUrl: string | null;
    durationSeconds: number | null;
    mainPainPoint: string | null;
    prospectEmail: string | null;
    preferredTimes: string | null;
    bookedDate: string | null;
    bookedDay: string | null;
    bookedTime: string | null;
    teamSize: string | null;
    createdAt: string;
}

interface Lead {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    company: string | null;
    industry: string | null;
    website: string | null;
    employeeCount: number | null;
    location: string | null;
    jobTitle: string | null;
    seniorityLevel: string | null;
    briefOpenerHook: string | null;
    briefPainAssumption: string | null;
    briefProofPoint: string | null;
    briefPersonalizedPitch: string | null;
    briefGeneratedAt: string | null;
    status: string;
    enrichmentStatus: string;
    websiteSummary: any;
    newsSummary: any;
    techStackDetected: string[];
    finalScore: number | null;
    structuredScore: number | null;
    naturalLanguageScore: number | null;
    scoreBreakdown: { label: string; points: number }[] | null;
    notes: string | null;
    isSuppressed: boolean;
    callbackAt: string | null;
    emailSubject: string | null;
    emailBody: string | null;
    emailGeneratedAt: string | null;
    emailSentAt: string | null;
    callAttempts: CallAttempt[];
}

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
};

function scoreBadgeColor(score: number | null): string {
    if (score == null) return "bg-slate-500/15 text-slate-300";
    if (score <= 4) return "bg-red-500/15 text-red-300";
    if (score <= 6) return "bg-orange-500/15 text-orange-300";
    return "bg-emerald-500/15 text-emerald-300";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold mb-4 text-muted uppercase tracking-wide">{title}</h2>
            {children}
        </div>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-muted mb-0.5">{label}</p>
            <p className="text-sm">{value ?? "—"}</p>
        </div>
    );
}

export default function LeadProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [notesDraft, setNotesDraft] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [emailSubjectDraft, setEmailSubjectDraft] = useState("");
    const [emailBodyDraft, setEmailBodyDraft] = useState("");
    const [generatingEmail, setGeneratingEmail] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);

    async function fetchLead() {
        setLoading(true);
        try {
            const res = await fetch(`/api/leads/${id}`);
            const data = await res.json();
            if (res.ok) {
                setLead(data.lead);
                setNotesDraft(data.lead.notes ?? "");
                setEmailSubjectDraft(data.lead.emailSubject ?? "");
                setEmailBodyDraft(data.lead.emailBody ?? "");
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchLead();
    }, [id]);

    async function patchLead(data: Record<string, any>) {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/leads/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                await fetchLead();
            } else {
                alert("Action failed");
            }
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSaveNotes() {
        setSavingNotes(true);
        try {
            await patchLead({ notes: notesDraft });
        } finally {
            setSavingNotes(false);
        }
    }

    async function handleMarkBooked() {
        if (!window.confirm("Mark this lead as Booked manually?")) return;
        await patchLead({ status: "BOOKED", isSuppressed: false, callbackAt: null });
    }

    async function handleScheduleCallback() {
        const dateStr = window.prompt("Callback date/time (e.g. 2026-07-15 14:00):");
        if (!dateStr) return;
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
            alert("Couldn't parse that date/time — try format YYYY-MM-DD HH:MM");
            return;
        }
        await patchLead({ status: "CALLBACK_REQUESTED", callbackAt: parsed.toISOString(), isSuppressed: false });
    }

    async function handleCancelCallback() {
        if (!window.confirm("Cancel this scheduled callback?")) return;
        await patchLead({ callbackAt: null, status: "QUEUED" });
    }

    async function handleToggleSuppress() {
        if (lead!.isSuppressed) {
            // Suppressing sets status to DO_NOT_CALL — undo that too, or the
            // badge stays stuck on "DO NOT CALL" after unsuppressing.
            await patchLead({ isSuppressed: false, status: "QUEUED" });
        } else {
            if (!window.confirm("Add to suppression list? This lead will be excluded from all future campaigns.")) return;
            await patchLead({ isSuppressed: true, status: "DO_NOT_CALL", callbackAt: null });
        }
    }

    async function handleGenerateEmail() {
        setGeneratingEmail(true);
        try {
            const res = await fetch(`/api/leads/${id}/email/generate`, { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                await fetchLead();
            } else {
                alert(data.error || "Failed to generate email");
            }
        } finally {
            setGeneratingEmail(false);
        }
    }

    async function handleSendEmail() {
        if (!lead?.email) return;
        if (!window.confirm(`Send this email to ${lead.email}?`)) return;
        setSendingEmail(true);
        try {
            const res = await fetch(`/api/leads/${id}/email/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject: emailSubjectDraft, body: emailBodyDraft }),
            });
            const data = await res.json();
            if (res.ok) {
                await fetchLead();
            } else {
                alert(data.error || "Failed to send email");
            }
        } finally {
            setSendingEmail(false);
        }
    }

    async function handleAddToCampaign() {
        // See note above: puts the lead back into the general queue pool,
        // since there's no per-lead "attach to an existing campaign" flow yet.
        await patchLead({ status: "QUEUED", campaignId: null });
        alert("Lead moved to Queued — it'll now appear in the Call Queue for the next campaign.");
    }

    async function handleDelete() {
        if (!window.confirm(`Permanently delete ${lead?.name}? This cannot be undone.`)) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
            if (res.ok) {
                router.push("/leads");
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete — this lead may have call history attached.");
            }
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) {
        return <div className="max-w-4xl mx-auto px-6 py-10 text-muted text-sm">Loading…</div>;
    }

    if (!lead) {
        return <div className="max-w-4xl mx-auto px-6 py-10 text-muted text-sm">Lead not found.</div>;
    }

    const wsSummary = lead.websiteSummary;
    const news = lead.newsSummary;

    return (
        <div className="max-w-4xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <button onClick={() => router.push("/leads")} className="text-xs text-muted hover:text-white mb-2">
                        ← Back to Leads
                    </button>
                    <h1 className="text-2xl font-semibold">{lead.name}</h1>
                    <p className="text-sm text-muted mt-1">
                        {lead.jobTitle ? `${lead.jobTitle} at ` : ""}
                        {lead.company ?? "Unknown company"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${scoreBadgeColor(lead.finalScore)}`}>
                        Score: {lead.finalScore != null ? lead.finalScore.toFixed(1) : "—"}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${STATUS_STYLES[lead.status] ?? ""}`}>
                        {lead.status.replace(/_/g, " ")}
                    </span>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mb-8">
                <button onClick={handleAddToCampaign} disabled={actionLoading} className="border border-border hover:border-white/30 text-xs rounded-full px-3 py-1.5 disabled:opacity-40">
                    Add to Campaign
                </button>
                <button onClick={handleMarkBooked} disabled={actionLoading} className="border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs rounded-full px-3 py-1.5 disabled:opacity-40">
                    Mark as Booked
                </button>
                {lead.callbackAt ? (
                    <button onClick={handleCancelCallback} disabled={actionLoading} className="border border-purple-500/50 bg-purple-500/10 text-purple-300 text-xs rounded-full px-3 py-1.5 disabled:opacity-40">
                        Cancel Callback
                    </button>
                ) : (
                    <button onClick={handleScheduleCallback} disabled={actionLoading} className="border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-xs rounded-full px-3 py-1.5 disabled:opacity-40">
                        Schedule Callback
                    </button>
                )}
                <button
                    onClick={handleToggleSuppress}
                    disabled={actionLoading}
                    className={`border text-xs rounded-full px-3 py-1.5 disabled:opacity-40 ${lead.isSuppressed
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                        : "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                        }`}
                >
                    {lead.isSuppressed ? "Unsuppress" : "Add to Suppression List"}
                </button>
                <button onClick={handleDelete} disabled={actionLoading} className="border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs rounded-full px-3 py-1.5 disabled:opacity-40 ml-auto">
                    Delete
                </button>
            </div>

            {lead.callbackAt && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 mb-6 text-sm text-purple-300">
                    Callback scheduled for {new Date(lead.callbackAt).toLocaleString()}
                </div>
            )}

            {/* Basic data */}
            <Section title="Basic Info">
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Phone" value={lead.phone} />
                    <Field label="Email" value={lead.email} />
                    <Field label="Company" value={lead.company} />
                    <Field label="Industry" value={lead.industry} />
                    <Field label="Employee Count" value={lead.employeeCount} />
                    <Field label="Location" value={lead.location} />
                    <Field label="Job Title" value={lead.jobTitle} />
                    <Field label="Seniority" value={lead.seniorityLevel} />
                    <Field label="Website" value={lead.website} />
                </div>
            </Section>

            {/* LinkedIn — not available */}
            <Section title="LinkedIn Data">
                <p className="text-sm text-muted italic">
                    Not available — LinkedIn enrichment isn't connected (Proxycurl was discontinued; no replacement vendor configured yet).
                </p>
            </Section>

            {/* Website research */}
            <Section title="Website Research">
                {lead.enrichmentStatus !== "READY" ? (
                    <p className="text-sm text-muted italic">Enrichment status: {lead.enrichmentStatus}</p>
                ) : wsSummary ? (
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Services Offered" value={wsSummary.servicesOffered?.join(", ") || "—"} />
                        <Field label="Location Coverage" value={wsSummary.locationCoverage} />
                        <Field label="Team Size Language" value={wsSummary.teamSizeLanguage} />
                        <Field label="Tech Stack Mentioned" value={wsSummary.techStackMentioned?.join(", ") || "—"} />
                        <Field label="Software Tools Mentioned" value={wsSummary.softwareToolsMentioned?.join(", ") || "—"} />
                    </div>
                ) : (
                    <p className="text-sm text-muted italic">No website data yet.</p>
                )}
            </Section>

            {/* News */}
            <Section title="News">
                {news ? (
                    <div>
                        <p className="text-sm mb-2">{news.summary ?? "No relevant summary generated."}</p>
                        {news.signals?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {news.signals.map((s: string, i: number) => (
                                    <span key={i} className="px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted italic">No news data yet.</p>
                )}
            </Section>

            {/* Score breakdown */}
            <Section title="ICP Score Breakdown">
                <div className="flex items-center gap-6 mb-4">
                    <Field label="Final Score" value={lead.finalScore?.toFixed(1) ?? "—"} />
                    <Field label="Structured" value={lead.structuredScore?.toFixed(1) ?? "—"} />
                    <Field label="Natural Language" value={lead.naturalLanguageScore?.toFixed(1) ?? "—"} />
                </div>
                {lead.scoreBreakdown?.length ? (
                    <div className="flex flex-col gap-1.5">
                        {lead.scoreBreakdown.map((line, i) => (
                            <div key={i} className="flex items-center justify-between text-sm border-t border-border pt-1.5">
                                <span className="text-muted">{line.label}</span>
                                <span className={line.points > 0 ? "text-emerald-400" : line.points < 0 ? "text-red-400" : "text-muted"}>
                                    {line.points > 0 ? "+" : ""}{line.points}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted italic">Not scored yet.</p>
                )}
            </Section>

            <Section title="Generated Content">
                {lead.briefGeneratedAt ? (
                    <div className="grid grid-cols-1 gap-3">
                        <Field label="Opener Hook" value={lead.briefOpenerHook} />
                        <Field label="Pain Assumption" value={lead.briefPainAssumption} />
                        <Field label="Proof Point" value={lead.briefProofPoint} />
                        <Field label="Personalized Pitch" value={lead.briefPersonalizedPitch} />
                    </div>
                ) : (
                    <p className="text-sm text-muted italic">
                        No call brief generated yet — this happens automatically once a lead clears your ICP's score threshold.
                    </p>
                )}
            </Section>

            {/* Outbound email */}
            <Section title="Outbound Email">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-muted">
                        {lead.emailSentAt
                            ? `Sent ${new Date(lead.emailSentAt).toLocaleString()}`
                            : lead.emailGeneratedAt
                                ? `Generated ${new Date(lead.emailGeneratedAt).toLocaleString()} — not sent yet`
                                : "No email generated yet."}
                    </p>
                    <button
                        onClick={handleGenerateEmail}
                        disabled={generatingEmail}
                        className="border border-border hover:border-white/30 text-xs rounded-full px-3 py-1.5 disabled:opacity-40"
                    >
                        {generatingEmail ? "Generating…" : lead.emailGeneratedAt ? "Regenerate" : "Generate Email"}
                    </button>
                </div>

                {(emailSubjectDraft || emailBodyDraft) && (
                    <div className="flex flex-col gap-3">
                        <div>
                            <p className="text-xs text-muted mb-1">Subject</p>
                            <input
                                value={emailSubjectDraft}
                                onChange={(e) => setEmailSubjectDraft(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                        </div>
                        <div>
                            <p className="text-xs text-muted mb-1">Body</p>
                            <textarea
                                value={emailBodyDraft}
                                onChange={(e) => setEmailBodyDraft(e.target.value)}
                                rows={7}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            />
                        </div>
                        <button
                            onClick={handleSendEmail}
                            disabled={sendingEmail || !lead.email}
                            title={!lead.email ? "This lead has no email address on file" : undefined}
                            className="self-start bg-accent hover:opacity-90 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
                        >
                            {sendingEmail ? "Sending…" : "Send Email"}
                        </button>
                    </div>
                )}
            </Section>

            {/* Call history */}
            <Section title={`Call History (${lead.callAttempts.length})`}>
                {lead.callAttempts.length === 0 ? (
                    <p className="text-sm text-muted italic">No calls yet.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {lead.callAttempts.map((call) => (
                            <div key={call.id} className="border border-border rounded-xl p-4">
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLES[call.outcome ?? ""] ?? ""}`}>
                                            {call.outcome?.replace(/_/g, " ") ?? "Unknown"}
                                        </span>
                                        <span className="text-xs text-muted">{new Date(call.createdAt).toLocaleString()}</span>
                                        {call.durationSeconds != null && (
                                            <span className="text-xs text-muted">{Math.round(call.durationSeconds / 60)}m {call.durationSeconds % 60}s</span>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted">{expandedCallId === call.id ? "▲" : "▼"}</span>
                                </div>

                                {expandedCallId === call.id && (
                                    <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                                        {call.summary && (
                                            <div>
                                                <p className="text-xs text-muted mb-1">AI Summary</p>
                                                <p className="text-sm whitespace-pre-line">{call.summary}</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <Field label="Main Pain Point" value={call.mainPainPoint} />
                                            <Field label="Prospect Email" value={call.prospectEmail} />
                                            <Field label="Preferred Times" value={call.preferredTimes} />
                                            <Field label="Team Size" value={call.teamSize} />
                                            <Field label="Booked Date" value={call.bookedDate} />
                                            <Field label="Booked Day/Time" value={call.bookedDay && call.bookedTime ? `${call.bookedDay} ${call.bookedTime}` : null} />
                                        </div>
                                        {call.recordingUrl && (
                                            <div>
                                                <p className="text-xs text-muted mb-1">Recording</p>
                                                <audio controls src={call.recordingUrl} className="w-full h-10" />
                                            </div>
                                        )}
                                        {call.transcript && (
                                            <div>
                                                <p className="text-xs text-muted mb-1">Transcript</p>
                                                <p className="text-sm whitespace-pre-line bg-background rounded-lg p-3 max-h-64 overflow-y-auto">
                                                    {call.transcript}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Notes */}
            <Section title="Notes">
                <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    placeholder="Free text notes about this lead…"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
                <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="mt-2 bg-accent hover:opacity-90 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                    {savingNotes ? "Saving…" : "Save Notes"}
                </button>
            </Section>
        </div>
    );
}