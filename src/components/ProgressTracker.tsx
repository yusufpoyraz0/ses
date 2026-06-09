"use client";

import { useEffect, useState } from "react";

interface Step {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const STEPS: Step[] = [
  { id: "extract",     label: "Ses Ayrıştırma",   description: "Video'dan ses dosyası çıkarılıyor",     icon: "🎵" },
  { id: "transcribe",  label: "Transkripsiyon",    description: "Konuşmalar metne dönüştürülüyor",       icon: "📝" },
  { id: "translate",   label: "Çeviri",            description: "Metin Türkçe'ye çevriliyor",            icon: "🌍" },
  { id: "tts",         label: "Seslendirme",       description: "Türkçe ses oluşturuluyor",              icon: "🔊" },
  { id: "merge",       label: "Birleştirme",       description: "Ses ve video senkronize ediliyor",      icon: "🎬" },
];

interface ProgressState {
  step: string;
  pct: number;
  status: "processing" | "done" | "error";
  downloadUrl?: string;
  errorMessage?: string;
}

interface ProgressTrackerProps {
  jobId: string;
  onComplete: (downloadUrl: string) => void;
  onError: (msg: string) => void;
}

export default function ProgressTracker({ jobId, onComplete, onError }: ProgressTrackerProps) {
  const [progress, setProgress] = useState<ProgressState>({
    step: "extract",
    pct: 0,
    status: "processing",
  });
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource(`/api/status/${jobId}`);

    es.onmessage = (e) => {
      const data: ProgressState = JSON.parse(e.data);
      setProgress(data);

      if (data.status === "done" && data.downloadUrl) {
        setCompletedSteps(new Set(STEPS.map((s) => s.id)));
        es.close();
        onComplete(data.downloadUrl);
      }

      if (data.status === "error") {
        es.close();
        onError(data.errorMessage || "Bir hata oluştu");
      }

      // Tamamlanan adımları işaretle
      const currentIdx = STEPS.findIndex((s) => s.id === data.step);
      if (currentIdx > 0) {
        setCompletedSteps((prev) => {
          const next = new Set(prev);
          STEPS.slice(0, currentIdx).forEach((s) => next.add(s.id));
          return next;
        });
      }
    };

    es.onerror = () => {
      es.close();
      onError("Sunucu bağlantısı kesildi");
    };

    return () => es.close();
  }, [jobId, onComplete, onError]);

  const currentStepIdx = STEPS.findIndex((s) => s.id === progress.step);
  const overallPct = Math.round(
    ((currentStepIdx / STEPS.length) * 100) + (progress.pct / STEPS.length)
  );

  return (
    <div className="w-full max-w-2xl mx-auto fade-up space-y-8">
      {/* Genel ilerleme */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Genel ilerleme
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--brand)" }}>
            %{overallPct}
          </span>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "var(--surface-raised)" }}
        >
          <div
            className="h-full rounded-full progress-shimmer transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Adım listesi */}
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = step.id === progress.step && progress.status === "processing";
          const isPending = !isCompleted && !isCurrent;

          return (
            <div
              key={step.id}
              className="flex items-center gap-4 p-4 rounded-xl transition-all"
              style={{
                background: isCurrent
                  ? "var(--brand-dim)"
                  : isCompleted
                  ? "var(--surface)"
                  : "transparent",
                border: isCurrent
                  ? "1px solid rgba(99,102,241,0.3)"
                  : "1px solid transparent",
                opacity: isPending ? 0.4 : 1,
              }}
            >
              {/* İkon / tik */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{
                  background: isCompleted
                    ? "rgba(99,102,241,0.2)"
                    : isCurrent
                    ? "var(--brand-dim)"
                    : "var(--surface-raised)",
                }}
              >
                {isCompleted ? "✓" : isCurrent ? (
                  <span className="inline-block w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                ) : step.icon}
              </div>

              {/* Metin */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-medium text-sm"
                  style={{
                    color: isCompleted || isCurrent ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {step.description}
                  </p>
                )}
              </div>

              {/* Adım yüzdesi (aktif adımda) */}
              {isCurrent && (
                <span
                  className="text-sm font-semibold flex-shrink-0"
                  style={{ color: "var(--brand)" }}
                >
                  %{progress.pct}
                </span>
              )}

              {isCompleted && (
                <span className="text-xs flex-shrink-0" style={{ color: "rgba(99,102,241,0.6)" }}>
                  Tamam
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Alt bilgi */}
      <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
        Video uzunluğuna göre 1–5 dakika sürebilir. Sayfayı kapatmayın.
      </p>
    </div>
  );
}
