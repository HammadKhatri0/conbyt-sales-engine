// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  summary: {
    totalLeads: number;
    totalCalls: number;
    totalBooked: number;
    bookingRate: number;
    activeCampaigns: number;
    emailsSent: number;
  };
  funnel: { label: string; count: number }[];
  bookingsByDay: { date: string; count: number }[];
  activity: {
    type: "call" | "email";
    leadId: string;
    leadName: string;
    detail: string;
    timestamp: string;
  }[];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h2 className="text-sm font-semibold mb-4 text-muted uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-xs text-muted mb-1.5">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sublabel && <p className="text-xs text-muted mt-1">{sublabel}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return <div className="max-w-6xl mx-auto px-6 py-10 text-muted text-sm">Loading…</div>;
  }

  const { summary, funnel, bookingsByDay, activity } = data;
  const funnelMax = Math.max(1, funnel[0]?.count ?? 1);
  const bookingsMax = Math.max(1, ...bookingsByDay.map((d) => d.count));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Pipeline overview across all leads and campaigns</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Leads" value={summary.totalLeads.toLocaleString()} />
        <StatCard label="Calls Made" value={summary.totalCalls.toLocaleString()} />
        <StatCard label="Booked" value={summary.totalBooked.toLocaleString()} />
        <StatCard label="Booking Rate" value={`${(summary.bookingRate * 100).toFixed(1)}%`} />
        <StatCard label="Active Campaigns" value={summary.activeCampaigns.toLocaleString()} />
        <StatCard label="Emails Sent" value={summary.emailsSent.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Funnel */}
        <Card title="Pipeline Funnel">
          <div className="flex flex-col gap-3">
            {funnel.map((stage, i) => {
              const widthPct = Math.max(4, (stage.count / funnelMax) * 100);
              const pctOfTotal = funnelMax > 0 ? ((stage.count / funnelMax) * 100).toFixed(0) : "0";
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted">{stage.label}</span>
                    <span className="text-white font-medium">
                      {stage.count.toLocaleString()}
                      {i > 0 && <span className="text-muted font-normal"> · {pctOfTotal}% of total</span>}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Booking chart */}
        <Card title={`Bookings — Last ${bookingsByDay.length} Days`}>
          {bookingsMax <= 1 && bookingsByDay.every((d) => d.count === 0) ? (
            <p className="text-sm text-muted italic py-8 text-center">No bookings yet in this window.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {bookingsByDay.map((d) => {
                const heightPct = Math.max(4, (d.count / bookingsMax) * 100);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <span className="text-[10px] text-muted mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count}
                    </span>
                    <div
                      className="w-full rounded-t bg-linear-to-t from-accent to-accent-2"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-muted mt-1.5">
                      {new Date(d.date).toLocaleDateString(undefined, { day: "numeric", month: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Activity feed */}
      <Card title="Recent Activity">
        {activity.length === 0 ? (
          <p className="text-sm text-muted italic">No activity yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      item.type === "call"
                        ? "bg-blue-500/15 text-blue-300"
                        : "bg-purple-500/15 text-purple-300"
                    }`}
                  >
                    {item.type === "call" ? "☎" : "✉"}
                  </span>
                  <div>
                    <Link href={`/leads/${item.leadId}`} className="text-sm hover:text-accent hover:underline">
                      {item.leadName}
                    </Link>
                    <p className="text-xs text-muted">{item.detail}</p>
                  </div>
                </div>
                <span className="text-xs text-muted shrink-0">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
