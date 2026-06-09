"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface UploadZoneProps {
  onSubmit: (data: { type: "url" | "file"; value: string | File }) => void;
  isLoading: boolean;
}

const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/mkv", "video/x-matroska"];
const MAX_SIZE_GB = 2;

export default function UploadZone({ onSubmit, isLoading }: UploadZoneProps) {
  const [mode, setMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const validateUrl = (val: string) => {
    if (!val) return "URL boş olamaz";
    const ytPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/;
    if (!ytPattern.test(val)) return "Geçerli bir YouTube URL'si girin";
    return "";
  };

  const validateFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp4|webm|mkv)$/i)) {
      return "Desteklenen formatlar: MP4, WebM, MKV";
    }
    if (f.size > MAX_SIZE_GB * 1024 * 1024 * 1024) {
      return `Maksimum dosya boyutu ${MAX_SIZE_GB}GB`;
    }
    return "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    const err = validateFile(dropped);
    if (err) { setFileError(err); return; }
    setFileError("");
    setFile(dropped);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const err = validateFile(selected);
    if (err) { setFileError(err); return; }
    setFileError("");
    setFile(selected);
  };

  const handleSubmit = () => {
    if (mode === "url") {
      const err = validateUrl(url);
      if (err) { setUrlError(err); return; }
      setUrlError("");
      onSubmit({ type: "url", value: url });
    } else {
      if (!file) { setFileError("Lütfen bir video dosyası seçin"); return; }
      setFileError("");
      onSubmit({ type: "file", value: file });
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto fade-up">
      {/* Mod seçici */}
      <div className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ background: "var(--surface)" }}>
        {(["url", "file"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setUrlError(""); setFileError(""); }}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              background: mode === m ? "var(--brand)" : "transparent",
              color: mode === m ? "#fff" : "var(--text-secondary)",
            }}
          >
            {m === "url" ? "🔗 YouTube URL" : "📁 Video Yükle"}
          </button>
        ))}
      </div>

      {/* URL modu */}
      {mode === "url" && (
        <div className="space-y-3">
          <div className="relative">
            <Input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="https://youtube.com/watch?v=..."
              className="h-14 pl-4 pr-4 text-base rounded-xl"
              style={{
                background: "var(--surface)",
                border: urlError ? "1px solid #ef4444" : "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              disabled={isLoading}
            />
          </div>
          {urlError && (
            <p className="text-sm" style={{ color: "#ef4444" }}>{urlError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {["İngilizce ders", "Almanca kurs", "Japonca tutorial"].map((ex) => (
              <Badge
                key={ex}
                variant="outline"
                className="cursor-pointer text-xs py-1 px-3"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
              >
                {ex}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dosya modu */}
      {mode === "file" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileRef.current?.click()}
          className="relative rounded-xl border-2 border-dashed cursor-pointer transition-all"
          style={{
            borderColor: dragOver
              ? "var(--brand)"
              : file
              ? "rgba(99,102,241,0.4)"
              : "var(--border-subtle)",
            background: dragOver ? "var(--brand-dim)" : "var(--surface)",
            minHeight: "160px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".mp4,.webm,.mkv"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="text-center p-6">
              <div className="text-4xl mb-3">🎬</div>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {file.name}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                {formatSize(file.size)}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="mt-3 text-xs px-3 py-1 rounded-lg"
                style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}
              >
                Değiştir
              </button>
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="text-5xl mb-4 opacity-40">↑</div>
              <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
                Videoyu buraya sürükle
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                veya tıkla, dosya seç
              </p>
              <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                MP4 · WebM · MKV · Maks. 2GB
              </p>
            </div>
          )}
        </div>
      )}

      {fileError && (
        <p className="text-sm mt-2" style={{ color: "#ef4444" }}>{fileError}</p>
      )}

      {/* Gönder butonu */}
      <Button
        onClick={handleSubmit}
        disabled={isLoading || (mode === "url" ? !url : !file)}
        className="w-full h-14 mt-6 text-base font-semibold rounded-xl transition-all"
        style={{
          background: isLoading || (mode === "url" ? !url : !file)
            ? "var(--surface-raised)"
            : "var(--brand)",
          color: isLoading || (mode === "url" ? !url : !file)
            ? "var(--text-muted)"
            : "#fff",
        }}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            İşleniyor...
          </span>
        ) : (
          "Türkçe Dublaj Oluştur →"
        )}
      </Button>
    </div>
  );
}
