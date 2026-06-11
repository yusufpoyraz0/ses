# pipeline/main.py
import os
import shutil
import subprocess
import traceback
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="ses.net.tr AI Pipeline", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STORAGE_BASE = os.environ.get("STORAGE_PATH", "/data/videos")
UPLOADS_DIR  = Path(STORAGE_BASE) / "uploads"
OUTPUT_DIR   = Path(STORAGE_BASE) / "output"
TEMP_DIR     = Path(STORAGE_BASE) / "temp"
NEXTJS_URL   = os.environ.get("NEXTJS_URL", "http://localhost:3000")
DEVICE       = os.environ.get("DEVICE", "cpu")

# Windows'ta ffmpeg tam path, Linux'ta sadece "ffmpeg"
import sys
if sys.platform == "win32":
    FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"
else:
    FFMPEG = "ffmpeg"

for d in [UPLOADS_DIR, OUTPUT_DIR, TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)


class ProcessRequest(BaseModel):
    job_id: str
    type: str
    youtube_url: Optional[str] = None
    file_path: Optional[str] = None
    source_lang: str = "en"
    target_lang: str = "tr"


class HealthResponse(BaseModel):
    status: str
    whisper: bool
    tts: bool
    ffmpeg: bool


async def report_progress(job_id: str, step: str, progress: int, message: str):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{NEXTJS_URL}/api/internal/progress",
                json={"jobId": job_id, "step": step, "progress": progress, "message": message},
            )
    except Exception as e:
        print(f"[progress] Bildirim gönderilemedi: {e}")


def extract_audio(input_path: str, workdir: Path) -> Path:
    audio_path = workdir / "audio.wav"
    cmd = [FFMPEG, "-y", "-i", input_path, "-vn", "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le", str(audio_path)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg ses çıkarma hatası: {result.stderr}")
    return audio_path


def download_youtube(youtube_url: str, workdir: Path) -> Path:
    output_template = str(workdir / "yt_audio.%(ext)s")
    ffmpeg_dir = str(Path(FFMPEG).parent) if sys.platform == "win32" else "ffmpeg"
    cmd = [
        "yt-dlp",
        "--js-runtimes", "nodejs",
        "--ffmpeg-location", ffmpeg_dir,
        "-x",
        "--audio-format", "wav",
        "--audio-quality", "0",
        "-o", output_template,
        "--no-playlist",
        youtube_url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp hatası: {result.stderr}")

    for f in workdir.glob("yt_audio.*"):
        if f.suffix in [".wav", ".mp3", ".m4a", ".webm", ".opus"]:
            if f.suffix != ".wav":
                wav_path = workdir / "audio.wav"
                subprocess.run([FFMPEG, "-y", "-i", str(f), "-ac", "1", "-ar", "16000", str(wav_path)], check=True)
                return wav_path
            return f

    raise RuntimeError("yt-dlp çıktı dosyası bulunamadı")


def transcribe_audio(audio_path: Path, source_lang: str = "en") -> list[dict]:
    import whisper
    print(f"[whisper] Model yükleniyor (device={DEVICE})...")
    model = whisper.load_model("small", device=DEVICE)
    print(f"[whisper] Transkripsiyon başlıyor: {audio_path}")
    result = model.transcribe(str(audio_path), language=source_lang, word_timestamps=False, verbose=False)
    segments = [{"id": s["id"], "start": s["start"], "end": s["end"], "text": s["text"].strip()} for s in result["segments"]]
    print(f"[whisper] {len(segments)} segment bulundu")
    return segments


def translate_segments(segments: list[dict], src: str = "en", tgt: str = "tr") -> list[dict]:
    from transformers import MarianMTModel, MarianTokenizer
    model_map = {
        ("en", "tr"): "Helsinki-NLP/opus-mt-tc-big-en-tr",
        ("de", "tr"): "Helsinki-NLP/opus-mt-de-tr",
        ("fr", "tr"): "Helsinki-NLP/opus-mt-fr-tr",
        ("es", "tr"): "Helsinki-NLP/opus-mt-es-tr",
    }
    model_name = model_map.get((src, tgt), "Helsinki-NLP/opus-mt-tc-big-en-tr")
    print(f"[translate] Model: {model_name}")
    tokenizer = MarianTokenizer.from_pretrained(model_name)
    model = MarianMTModel.from_pretrained(model_name)
    translated = []
    for i in range(0, len(segments), 8):
        batch = segments[i:i+8]
        texts = [s["text"] for s in batch]
        inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=512)
        outputs = model.generate(**inputs, num_beams=4)
        tr_texts = tokenizer.batch_decode(outputs, skip_special_tokens=True)
        for seg, tr_text in zip(batch, tr_texts):
            translated.append({**seg, "tr_text": tr_text})
    print(f"[translate] {len(translated)} segment çevrildi")
    return translated


def synthesize_speech(segments: list[dict], workdir: Path) -> list[dict]:
    from TTS.api import TTS as CoquiTTS
    print("[tts] Coqui TTS model yükleniyor...")
    tts = CoquiTTS(model_name="tts_models/tr/common-voice/glow-tts", progress_bar=False)
    audio_segments = []
    for i, seg in enumerate(segments):
        seg_path = workdir / f"seg_{i:04d}.wav"
        text = seg.get("tr_text", seg["text"])
        if not text.strip():
            duration = seg["end"] - seg["start"]
            subprocess.run([FFMPEG, "-y", "-f", "lavfi", "-i", f"anullsrc=r=22050:cl=mono", "-t", str(duration), str(seg_path)], check=True, capture_output=True)
        else:
            tts.tts_to_file(text=text, file_path=str(seg_path))
        audio_segments.append({**seg, "audio_path": str(seg_path)})
    print(f"[tts] {len(audio_segments)} ses dosyası oluşturuldu")
    return audio_segments


def merge_video_audio(original_input: str, audio_segments: list[dict], output_path: Path, workdir: Path) -> None:
    filter_parts = []
    inputs = []
    for i, seg in enumerate(audio_segments):
        inputs.extend(["-i", seg["audio_path"]])
        delay_ms = int(seg["start"] * 1000)
        filter_parts.append(f"[{i+1}:a]adelay={delay_ms}|{delay_ms}[seg{i}]")
    seg_labels = "".join(f"[seg{i}]" for i in range(len(audio_segments)))
    n = len(audio_segments)
    filter_parts.append(f"{seg_labels}amix=inputs={n}:duration=longest:normalize=0[dubbed]")
    filter_parts.append("[0:a]volume=0.15[bg]")
    filter_parts.append("[dubbed][bg]amix=inputs=2:duration=first:normalize=0[final]")
    filter_complex = "; ".join(filter_parts)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ([FFMPEG, "-y", "-i", original_input] + inputs + ["-filter_complex", filter_complex, "-map", "0:v", "-map", "[final]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(output_path)])
    print(f"[ffmpeg] Birleştirme başlıyor → {output_path}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg birleştirme hatası: {result.stderr[-1000:]}")
    print(f"[ffmpeg] Tamamlandı: {output_path}")


async def run_pipeline(req: ProcessRequest):
    job_id  = req.job_id
    workdir = TEMP_DIR / job_id
    workdir.mkdir(parents=True, exist_ok=True)

    try:
        await report_progress(job_id, "downloading", 10, "Ses ayrıştırılıyor...")

        if req.type == "url" and req.youtube_url:
            audio_path = download_youtube(req.youtube_url, workdir)
            original_video = str(audio_path)
            has_video = False
        else:
            file_path = req.file_path or str(UPLOADS_DIR / f"{job_id}.mp4")
            audio_path = extract_audio(file_path, workdir)
            original_video = file_path
            has_video = True

        await report_progress(job_id, "transcribing", 30, "Konuşmalar metne dönüştürülüyor...")
        segments = transcribe_audio(audio_path, req.source_lang)

        if not segments:
            raise RuntimeError("Videoda konuşma tespit edilemedi")

        await report_progress(job_id, "translating", 55, "Türkçe'ye çevriliyor...")
        translated = translate_segments(segments, req.source_lang, req.target_lang)

        await report_progress(job_id, "tts", 75, "Türkçe seslendirme oluşturuluyor...")
        audio_segments = synthesize_speech(translated, workdir)

        await report_progress(job_id, "mixing", 90, "Ses ve video birleştiriliyor...")
        output_path = OUTPUT_DIR / f"{job_id}_dubbed.mp4"

        if has_video:
            merge_video_audio(original_video, audio_segments, output_path, workdir)
        else:
            concat_list = workdir / "concat.txt"
            with open(concat_list, "w") as f:
                for seg in audio_segments:
                    f.write(f"file '{seg['audio_path']}'\n")
            merged_audio = workdir / "merged_tr.wav"
            subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), str(merged_audio)], check=True, capture_output=True)
            subprocess.run([FFMPEG, "-y", "-f", "lavfi", "-i", "color=c=black:s=1280x720:r=24", "-i", str(merged_audio), "-c:v", "libx264", "-c:a", "aac", "-shortest", str(output_path)], check=True, capture_output=True)

        shutil.rmtree(workdir, ignore_errors=True)
        await report_progress(job_id, "done", 100, "Dublaj tamamlandı!")
        print(f"[pipeline] ✓ {job_id} tamamlandı → {output_path}")

    except Exception as e:
        err_msg = str(e)
        print(f"[pipeline] ✗ {job_id} hata: {err_msg}")
        traceback.print_exc()
        shutil.rmtree(workdir, ignore_errors=True)
        await report_progress(job_id, "error", 0, err_msg)


@app.get("/health", response_model=HealthResponse)
async def health():
    whisper_ok = False
    tts_ok = False
    try:
        import whisper
        whisper_ok = True
    except ImportError:
        pass
    try:
        from TTS.api import TTS
        tts_ok = True
    except ImportError:
        pass
    ffmpeg_ok = Path(FFMPEG).exists() if sys.platform == "win32" else shutil.which("ffmpeg") is not None
    return HealthResponse(status="ok" if (whisper_ok and tts_ok and ffmpeg_ok) else "degraded", whisper=whisper_ok, tts=tts_ok, ffmpeg=ffmpeg_ok)


@app.post("/process")
async def process(req: ProcessRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline, req)
    return {"status": "started", "job_id": req.job_id}


@app.get("/")
async def root():
    return {"service": "ses.net.tr AI Pipeline", "version": "1.0.0"}