"use client";

import { useState, useCallback, useEffect } from "react";
import UploadZone from "@/components/UploadZone";
import ProgressTracker from "@/components/ProgressTracker";

type AppState = "idle" | "processing" | "done" | "error";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AppState>("idle");
  const [jobId, setJobId] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => setMounted(true), []);

  const handleSubmit = useCallback(async (data: { type: "url" | "file"; value: string | File }) => {
    setState("processing");
    setErrorMsg("");
    try {
      let res: Response;
      if (data.type === "url") {
        res = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl: data.value as string }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", data.value as File);
        res = await fetch("/api/process", { method: "POST", body: formData });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sunucu hatası");
      }
      const { jobId: newJobId } = await res.json();
      setJobId(newJobId);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "İş başlatılamadı.");
    }
  }, []);

  const handleComplete = useCallback((url: string) => {
    setDownloadUrl(url);
    setState("done");
  }, []);

  const handleError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setState("error");
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setJobId("");
    setDownloadUrl("");
    setErrorMsg("");
  }, []);

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="inline-block w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "var(--brand)" }}
          >
            S
          </div>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            ses.net.tr
          </span>
        </div>
        <span
          className="text-xs px-3 py-1 rounded-full font-medium"
          style={{
            background: "var(--brand-dim)",
            color: "var(--brand)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          Beta
        </span>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {state === "idle" && (
          <>
            <div className="text-center mb-12 fade-up">
              <div
                className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-full mb-6 font-medium"
                style={{
                  background: "var(--brand-dim)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  color: "rgba(129,140,248,0.9)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Yapay Zeka Destekli Türkçe Dublaj
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-5 leading-[1.1]">
                Eğitim videolarını
                <br />
                <span className="gradient-text">Türkçe dinle</span>
              </h1>
              <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                YouTube linki veya video dosyası yükle.
                Yapay zeka metne dönüştürür, Türkçeye çevirir ve seslendirir.
              </p>
            </div>

            <UploadZone onSubmit={handleSubmit} isLoading={false} />

            <div className="grid grid-cols-3 gap-4 mt-16 max-w-2xl w-full fade-up">
              {[
                { icon: "🎯", title: "Yüksek Doğruluk", desc: "Whisper ile %95+ transkripsiyon" },
                { icon: "🇹🇷", title: "Doğal Türkçe", desc: "Coqui TTS ile akıcı seslendirme" },
                { icon: "⚡", title: "Hızlı İşlem", desc: "30 dk video 3 dakikada hazır" },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-4 rounded-xl text-center"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
                >
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{f.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {state === "processing" && !jobId && (
          <div className="flex flex-col items-center gap-4 fade-up">
            <span className="inline-block w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>İş başlatılıyor...</p>
          </div>
        )}

        {state === "processing" && jobId && (
          <div className="w-full max-w-2xl">
            <div className="text-center mb-10 fade-up">
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Dublaj oluşturuluyor
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Sayfayı kapatmayın, işlem devam ediyor
              </p>
            </div>
            <ProgressTracker jobId={jobId} onComplete={handleComplete} onError={handleError} />
          </div>
        )}

        {state === "done" && (
          <div className="w-full max-w-2xl text-center fade-up space-y-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto glow-brand"
              style={{ background: "var(--brand-dim)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              ✓
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Hazır!</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Türkçe dublajlı videon oluşturuldu</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "var(--brand)" }}
              >
                Videoyu İndir
              </a>
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all"
                style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              >
                Yeni Video
              </button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="w-full max-w-2xl text-center fade-up space-y-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              ✕
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Bir hata oluştu</h2>
              <p className="text-sm" style={{ color: "#ef4444" }}>{errorMsg}</p>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Tekrar Dene
            </button>
          </div>
        )}
      </section>

      <footer className="py-6 text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          ses.net.tr · Eğitim videoları için Türkçe AI dublaj
        </p>
      </footer>
    </main>
  );
}
