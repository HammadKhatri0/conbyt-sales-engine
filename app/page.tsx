// app/page.tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

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
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent-2/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full flex items-center justify-center">
        {!showForm && (
          <div className="text-center max-w-lg animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-1.5 text-xs text-muted mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              AI Sales Agent Online
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Talk to Our Sales Agent
            </h1>
            <p className="text-muted text-lg mb-10 max-w-md mx-auto">
              Drop your number below and our AI agent will call you in seconds — no waiting, no forms to fill out later.
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

        {showForm && status !== "success" && (
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

                {errorMsg && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="mt-2 bg-gradient-to-r from-accent to-accent-2 hover:opacity-90 disabled:opacity-50 text-white font-medium px-4 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {status === "loading" ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Calling...
                    </>
                  ) : (
                    "Call Me Now"
                  )}
                </button>

                <p className="text-xs text-muted text-center mt-1">
                  By submitting, you agree to receive an automated call from our sales agent.
                </p>
              </form>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="text-center max-w-md animate-fade-up">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-emerald-400/30" style={{ animation: "pulse-ring 1.5s ease-out infinite" }} />
              <div className="relative w-16 h-16 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2">You're all set!</h2>
            <p className="text-muted">
              Our agent is calling <span className="text-white font-medium">{phone}</span> now — please answer your phone.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}