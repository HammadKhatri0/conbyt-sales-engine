// components/CallDetailModal.tsx
"use client";

export interface CallAttemptDetail {
  id: string;
  retellCallId: string;
  outcome: string | null;
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
  durationSeconds: number | null;
  disconnectionReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  mainPainPoint: string | null;
  prospectEmail: string | null;
  preferredTimes: string | null;
  bookedDate: string | null;
  bookedDay: string | null;
  bookedTime: string | null;
  teamSize: string | null;
  lead: {
    id: string;
    name: string;
    phone: string;
    company: string | null;
    industry: string | null;
  };
}

const STATUS_STYLES: Record<string, string> = {
  BOOKED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  NOT_INTERESTED: "bg-red-500/15 text-red-300 border-red-500/30",
  LINK_EMAILED: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  CALLBACK_REQUESTED: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  NO_ANSWER: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  WRONG_NUMBER: "bg-red-500/15 text-red-300 border-red-500/30",
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function downloadTranscript(call: CallAttemptDetail) {
  const header = `Call transcript — ${call.lead.name} (${call.lead.phone})\n${formatDateTime(
    call.startedAt ?? call.createdAt
  )}\n${"-".repeat(50)}\n\n`;
  const blob = new Blob([header + (call.transcript ?? "")], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcript_${call.lead.name.replace(/\s+/g, "_")}_${call.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default function CallDetailModal({
  call,
  onClose,
}: {
  call: CallAttemptDetail;
  onClose: () => void;
}) {
  const bookingInfo = [call.bookedDay, call.bookedDate, call.bookedTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold">{call.lead.name}</h2>
            <p className="text-sm text-muted mt-0.5">
              {call.lead.phone}
              {call.lead.company ? ` · ${call.lead.company}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          {call.outcome && (
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                STATUS_STYLES[call.outcome] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30"
              }`}
            >
              {call.outcome.replace(/_/g, " ")}
            </span>
          )}
          <span className="text-xs text-muted">{formatDateTime(call.startedAt ?? call.createdAt)}</span>
          <span className="text-xs text-muted">· {formatDuration(call.durationSeconds)}</span>
          {call.disconnectionReason && (
            <span className="text-xs text-muted">· {call.disconnectionReason.replace(/_/g, " ")}</span>
          )}
        </div>

        {call.summary && (
          <div className="mb-5">
            <p className="text-xs text-muted mb-1.5">Summary</p>
            <div className="text-sm bg-background border border-border rounded-lg p-3 whitespace-pre-line">
              {call.summary}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-5">
          <DetailField label="Main pain point" value={call.mainPainPoint} />
          <DetailField label="Prospect email" value={call.prospectEmail} />
          <DetailField label="Preferred times" value={call.preferredTimes} />
          <DetailField label="Team size" value={call.teamSize} />
          {bookingInfo && <DetailField label="Booked for" value={bookingInfo} />}
        </div>

        {call.recordingUrl && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted">Recording</p>
              <a
                href={call.recordingUrl}
                download={`recording_${call.lead.name.replace(/\s+/g, "_")}_${call.id}.wav`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Download
              </a>
            </div>
            <audio controls src={call.recordingUrl} className="w-full h-10" />
          </div>
        )}

        {call.transcript && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted">Transcript</p>
              <button
                onClick={() => downloadTranscript(call)}
                className="text-xs text-accent hover:underline"
              >
                Download
              </button>
            </div>
            <div className="text-sm bg-background border border-border rounded-lg p-3 whitespace-pre-line max-h-64 overflow-y-auto text-muted">
              {call.transcript}
            </div>
          </div>
        )}

        {!call.summary && !call.transcript && (
          <p className="text-sm text-muted text-center py-6">
            No transcript or summary available for this call yet.
          </p>
        )}
      </div>
    </div>
  );
}