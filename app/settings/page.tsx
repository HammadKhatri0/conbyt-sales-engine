// app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

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

    useEffect(() => {
        fetch("/api/settings")
            .then((res) => res.json())
            .then((data) => {
                setSettings(data.settings ?? {});
                setLoading(false);
            });
    }, []);

    function update(name: string, value: string) {
        setSettings((prev) => ({ ...prev, [name]: value }));
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
                <h1 className="text-2xl font-semibold">Settings</h1>
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

            <Section title="Calendly">
                <Field label="Access Token" name="calendlyAccessToken" value={settings.calendlyAccessToken} onChange={update} type="password" />
                <Field label="Event Type URI" name="calendlyEventTypeUri" value={settings.calendlyEventTypeUri} onChange={update} />
            </Section>

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