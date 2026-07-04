// components/CallWidget.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type CallStatus =
  | "idle"
  | "loading"
  | "initiating"
  | "ringing"
  | "in_progress"
  | "ended"
  | "error";

const STATUS_LABELS: Record<string, string> = {
  loading: "Requesting call…",
  initiating: "Initiating",
  ringing: "Ringing",
  in_progress: "In Progress",
  ended: "Ended",
};

const POLL_INTERVAL_MS = 2000;

export interface CallWidgetProps {
  /** Headline shown before the user clicks "Get a Call Now" */
  heading?: string;
  /** Subtext under the headline */
  subheading?: string;
}

export default function CallWidget({
  heading = "Talk to Our Sales Agent",
  subheading = "Drop your number below and our AI agent will call in seconds — no waiting, no forms to fill out later.",
}: CallWidgetProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [callId, setCallId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(id: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/call/status/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMsg(data.error ?? "Failed to fetch call status");
          stopPolling();
          return;
        }

        setStatus(data.status as CallStatus);

        if (data.status === "ended") {
          stopPolling();
        }
      } catch {
        setStatus("error");
        setErrorMsg("Lost connection while checking call status");
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    setCallId(null);

    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong");
        return;
      }

      setCallId(data.call_id);
      setStatus("initiating");
      startPolling(data.call_id);
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  function reset() {
    stopPolling();
    setShowForm(false);
    setStatus("idle");
    setErrorMsg("");
    setCallId(null);
  }

  const isCallLive =
    status === "loading" ||
    status === "initiating" ||
    status === "ringing" ||
    status === "in_progress";
  const isCallDone = status === "ended";

  return (
    <div className="relative w-full flex items-center justify-center">
      {!showForm && status === "idle" && (
        <div className="text-center max-w-lg animate-fade-up">
          <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-1.5 text-xs text-muted mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Sales Agent Online
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            {heading}
          </h1>
          <p className="text-muted text-lg mb-10 max-w-md mx-auto">
            {subheading}
          </p>

          <button
            onClick={() => setShowForm(true)}
            className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-accent to-accent-2 hover:opacity-90 text-white font-medium px-8 py-3.5 rounded-full transition-all shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:scale-105"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Get a Call Now
          </button>

          <p className="text-xs text-muted mt-6">
            Free · Takes less than 30 seconds
          </p>
        </div>
      )}

      {showForm && status === "idle" && (
        <div className="w-full max-w-sm animate-fade-up">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
            <button
              onClick={() => setShowForm(false)}
              className="text-muted hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>

            <h2 className="text-2xl font-semibold mb-1">Request a Call</h2>
            <p className="text-sm text-muted mb-6">
              We'll ring you right after you submit.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-muted mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+923001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                className="mt-2 bg-gradient-to-r from-accent to-accent-2 hover:opacity-90 disabled:opacity-50 text-white font-medium px-4 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Call Me Now
              </button>

              <p className="text-xs text-muted text-center mt-1">
                By submitting, you agree to receive an automated call from our sales agent.
              </p>
            </form>
          </div>
        </div>
      )}

      {isCallLive && (
        <div className="text-center max-w-md animate-fade-up">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div
              className="absolute inset-0 rounded-full bg-accent/30"
              style={{ animation: "pulse-ring 1.5s ease-out infinite" }}
            />
            <div className="relative w-16 h-16 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-semibold mb-2">
            {STATUS_LABELS[status] ?? "Calling…"}
          </h2>
          <p className="text-muted">
            Calling <span className="text-white font-medium">{phone}</span> now — please answer your phone.
          </p>
          {callId && (
            <p className="text-xs text-muted/60 mt-4 font-mono break-all">
              call_id: {callId}
            </p>
          )}
        </div>
      )}

      {isCallDone && (
        <div className="text-center max-w-md animate-fade-up">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-400/30" style={{ animation: "pulse-ring 1.5s ease-out infinite" }} />
            <div className="relative w-16 h-16 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-semibold mb-2">Call finished</h2>
          <p className="text-muted">
            The call to <span className="text-white font-medium">{phone}</span> has ended.
          </p>
          <button
            onClick={reset}
            className="mt-6 text-sm text-muted hover:text-white transition-colors"
          >
            ← Make another call
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="text-center max-w-md animate-fade-up">
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 inline-block">
            {errorMsg}
          </p>
          <div>
            <button
              onClick={reset}
              className="mt-6 text-sm text-muted hover:text-white transition-colors"
            >
              ← Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}