"use client";

import { useState, useCallback } from "react";
import UploadZone from "@/components/UploadZone";
import ProgressTracker from "@/components/ProgressTracker";

type AppState = "idle" | "processing" | "done" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [jobId, setJobId] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleSubmit = async (data: { type: "url" | "file"; value: string | File }) => {
    setState("processing");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("type", data.type);

      if (data.type === "url") {
        formData.append("url", data.value as string);
      } else {
        formData.append("file", data.value as File);
      }

      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Sunucu hatası");

      const { jobId } = await res.json();
      setJobId(jobId);
    } catch (err) {
      setState("error");
      setErrorMsg("İş başlatılamadı. Lütfen tekrar deneyin.");
    }
  };

  const handleComplete = useCallback((url: string) => {
    setDownloadUrl(url);
    setState("done");
  }, []);

  const handleError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setState("error");
  }, []);

  const reset = () => {
    setState("idle");
    setJobId("");
    setDownloadUrl("");
    setErrorMsg("");
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
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
        <div className="flex items-center gap-2">
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
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {state === "idle" && (
          <>
            {/* Başlık */}
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
                Yapay zeka metne dönüştürür, Türkçe'ye çevirir ve seslendirir.
              </p>
            </div>

            {/* Upload zone */}
            <UploadZone onSubmit={handleSubmit} isLoading={false} />

            {/* Özellikler */}
            <div className="grid grid-cols-3 gap-4 mt-16 max-w-2xl w-full fade-up">
              {[
                { icon: "🎯", title: "Yüksek Doğruluk", desc: "Whisper ile %95+ transkripsiyon" },
                { icon: "🇹🇷", title: "Doğal Türkçe", desc: "Coqui TTS ile akıcı seslendirme" },
                { icon: "⚡", title: "Hızlı İşlem", desc: "30 dk video ~3 dk'da hazır" },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-4 rounded-xl text-center"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                    {f.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* İşleme ekranı */}
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
            <ProgressTracker
              jobId={jobId}
              onComplete={handleComplete}
              onError={handleError}
            />
          </div>
        )}

        {/* Tamamlandı ekranı */}
        {state === "done" && (
          <div className="w-full max-w-2xl text-center fade-up space-y-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto glow-brand"
              style={{ background: "var(--brand-dim)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              ✓
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Hazır!
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Türkçe dublajlı videon oluşturuldu
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "var(--brand)" }}
              >
                ⬇ Videoyu İndir
              </a>
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all"
                style={{
                  background: "var(--surface)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                Yeni Video
              </button>
            </div>
          </div>
        )}

        {/* Hata ekranı */}
        {state === "error" && (
          <div className="w-full max-w-2xl text-center fade-up space-y-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              ✕
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Bir hata oluştu
              </h2>
              <p className="text-sm" style={{ color: "#ef4444" }}>
                {errorMsg}
              </p>
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

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          ses.net.tr · Eğitim videoları için Türkçe AI dublaj
        </p>
      </footer>
    </main>
  );
}
