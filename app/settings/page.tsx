// app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SettingsData {
    [key: string]: any;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold mb-4 text-muted uppercase tracking-wide">{title}</h2>
            <div className="grid grid-cols-2 gap-4">{children}</div>
        </div>
    );
}

function Field({
    label,
    name,
    value,
    onChange,
    type = "text",
    placeholder,
}: {
    label: string;
    name: string;
    value: any;
    onChange: (name: string, value: string) => void;
    type?: string;
    placeholder?: string;
}) {
    return (
        <div>
            <label className="text-xs text-muted mb-1.5 block">{label}</label>
            <input
                type={type}
                value={value ?? ""}
                placeholder={placeholder}
                onChange={(e) => onChange(name, e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
        </div>
    );
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<SettingsData>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState("");
    const [gmailNotice, setGmailNotice] = useState<{ type: "connected" | "error"; message: string } | null>(null);
    const [disconnectingGmail, setDisconnectingGmail] = useState(false);

    function loadSettings() {
        return fetch("/api/settings")
            .then((res) => res.json())
            .then((data) => {
                setSettings(data.settings ?? {});
                setLoading(false);
            });
    }

    useEffect(() => {
        loadSettings();

        // Read the ?gmail=connected|error redirect from the OAuth callback —
        // parsed client-side (not useSearchParams) so this page can stay static.
        const params = new URLSearchParams(window.location.search);
        const gmail = params.get("gmail");
        if (gmail === "connected") {
            const email = params.get("email");
            setGmailNotice({ type: "connected", message: email ? `Connected as ${email}` : "Gmail connected" });
        } else if (gmail === "error") {
            setGmailNotice({ type: "error", message: params.get("message") || "Failed to connect Gmail" });
        }
        if (gmail) {
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, []);

    async function handleDisconnectGmail() {
        if (!window.confirm("Disconnect Gmail? Outbound email sending will stop until reconnected.")) return;
        setDisconnectingGmail(true);
        try {
            const res = await fetch("/api/settings/gmail/disconnect", { method: "POST" });
            if (res.ok) {
                await loadSettings();
                setGmailNotice(null);
            } else {
                alert("Failed to disconnect Gmail");
            }
        } finally {
            setDisconnectingGmail(false);
        }
    }

    const NUMERIC_FIELDS = new Set([
        "calcomEventTypeId",
        "callStartHour",
        "callEndHour",
        "callsPerHourLimit",
        "callGapSeconds",
        "maxRetryAttempts",
        "voicemailOnAttempt",
        "maxEmailsPerDay",
        "emailSendStartHour",
        "emailSendEndHour",
        "emailGapSeconds",
    ]);

    function update(name: string, value: string) {
        const converted = NUMERIC_FIELDS.has(name) && value !== "" ? Number(value) : value;
        setSettings((prev) => ({ ...prev, [name]: converted }));
    }

    async function handleSave() {
        setSaving(true);
        setSavedMessage("");
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                setSavedMessage("Saved");
                setTimeout(() => setSavedMessage(""), 2000);
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || "Failed to save settings — check the server logs.");
            }
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="max-w-3xl mx-auto px-6 py-10 text-muted text-sm">Loading…</div>;
    }

    return (
        <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold">Settings</h1>
                    <Link href="/settings/icp" className="text-xs text-accent hover:underline mt-1 inline-block">
                        Manage ICP Settings →
                    </Link>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40"
                >
                    {saving ? "Saving…" : savedMessage || "Save Changes"}
                </button>
            </div>

            <Section title="Retell">
                <Field label="API Key" name="retellApiKey" value={settings.retellApiKey} onChange={update} type="password" />
                <Field label="Agent ID" name="retellAgentId" value={settings.retellAgentId} onChange={update} />
                <Field label="From Number" name="retellFromNumber" value={settings.retellFromNumber} onChange={update} placeholder="+1..." />
            </Section>

            <Section title="Apollo">
                <Field label="API Key" name="apolloApiKey" value={settings.apolloApiKey} onChange={update} type="password" />
            </Section>

            <Section title="Proxycurl">
                <Field label="API Key" name="proxycurlApiKey" value={settings.proxycurlApiKey} onChange={update} type="password" />
            </Section>

            <Section title="OpenAI">
                <Field label="API Key" name="openaiApiKey" value={settings.openaiApiKey} onChange={update} type="password" />
                <Field label="Model" name="openaiModel" value={settings.openaiModel} onChange={update} placeholder="gpt-4o-mini" />
            </Section>

            <Section title="Twilio">
                <Field label="Account SID" name="twilioAccountSid" value={settings.twilioAccountSid} onChange={update} type="password" />
                <Field label="Auth Token" name="twilioAuthToken" value={settings.twilioAuthToken} onChange={update} type="password" />
                <Field label="From Number" name="twilioFromNumber" value={settings.twilioFromNumber} onChange={update} placeholder="+1..." />
            </Section>

            <Section title="Cal.com">
                <Field label="API Key" name="calcomApiKey" value={settings.calcomApiKey} onChange={update} type="password" />
                <Field label="Event Type ID" name="calcomEventTypeId" value={settings.calcomEventTypeId} onChange={update} type="number" />
                <Field label="Webhook Secret" name="calcomWebhookSecret" value={settings.calcomWebhookSecret} onChange={update} type="password" />
            </Section>

            <Section title="Gmail">
                <Field label="OAuth Client ID" name="gmailClientId" value={settings.gmailClientId} onChange={update} />
                <Field label="OAuth Client Secret" name="gmailClientSecret" value={settings.gmailClientSecret} onChange={update} type="password" />
            </Section>

            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <h2 className="text-sm font-semibold mb-4 text-muted uppercase tracking-wide">Gmail Connection</h2>

                {gmailNotice && (
                    <div
                        className={`text-xs rounded-lg px-3 py-2 mb-4 ${gmailNotice.type === "connected"
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-300 border border-red-500/20"
                            }`}
                    >
                        {gmailNotice.message}
                    </div>
                )}

                {settings.gmailConnected ? (
                    <div className="flex items-center justify-between">
                        <p className="text-sm">
                            Connected as <span className="font-medium">{settings.gmailEmailAddress}</span>
                        </p>
                        <button
                            onClick={handleDisconnectGmail}
                            disabled={disconnectingGmail}
                            className="border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs rounded-full px-3 py-1.5 disabled:opacity-40"
                        >
                            {disconnectingGmail ? "Disconnecting…" : "Disconnect"}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted">Not connected — save a Client ID/Secret above first.</p>
                        <a
                            href="/api/auth/gmail/connect"
                            className="bg-linear-to-r from-accent to-accent-2 hover:opacity-90 text-white rounded-full px-4 py-2 text-xs font-medium"
                        >
                            Connect Gmail
                        </a>
                    </div>
                )}
            </div>

            <Section title="Calling Rules">
                <Field label="Start Hour (0-23)" name="callStartHour" value={settings.callStartHour} onChange={update} type="number" />
                <Field label="End Hour (0-23)" name="callEndHour" value={settings.callEndHour} onChange={update} type="number" />
                <Field label="Calls Per Hour Limit" name="callsPerHourLimit" value={settings.callsPerHourLimit} onChange={update} type="number" />
                <Field label="Gap Between Calls (seconds)" name="callGapSeconds" value={settings.callGapSeconds} onChange={update} type="number" />
                <Field label="Max Retry Attempts" name="maxRetryAttempts" value={settings.maxRetryAttempts} onChange={update} type="number" />
                <Field label="Leave Voicemail on Attempt #" name="voicemailOnAttempt" value={settings.voicemailOnAttempt} onChange={update} type="number" />
            </Section>

            <Section title="Email Rules">
                <Field label="Max Emails Per Day" name="maxEmailsPerDay" value={settings.maxEmailsPerDay} onChange={update} type="number" />
                <Field label="Send Window Start Hour" name="emailSendStartHour" value={settings.emailSendStartHour} onChange={update} type="number" />
                <Field label="Send Window End Hour" name="emailSendEndHour" value={settings.emailSendEndHour} onChange={update} type="number" />
                <Field label="Gap Between Sends (seconds)" name="emailGapSeconds" value={settings.emailGapSeconds} onChange={update} type="number" />
            </Section>

            <Section title="Booking & Email">
                <Field label="Gemini API Key" name="geminiApiKey" value={settings.geminiApiKey} onChange={update} type="password" />
                <Field label="Resend API Key" name="resendApiKey" value={settings.resendApiKey} onChange={update} type="password" />
                <Field label="Booking URL" name="bookingUrl" value={settings.bookingUrl} onChange={update} placeholder="https://calendly.com/..." />
            </Section>
        </div>
    );
}