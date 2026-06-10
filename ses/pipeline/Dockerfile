FROM python:3.11-slim

# FFmpeg kur
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Önce requirements (layer cache için)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Whisper modeli önceden indir (ilk istekte gecikme olmasın)
RUN python -c "import whisper; whisper.load_model('small')"

# Coqui TTS Türkçe modeli önceden indir
RUN python -c "from TTS.api import TTS; TTS(model_name='tts_models/tr/common-voice/glow-tts')"

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
