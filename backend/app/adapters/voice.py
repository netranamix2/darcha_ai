"""Optional voice messages (section 10): audio -> 16 kHz WAV (ffmpeg) -> Uzbek Whisper -> text.
Enabled with ENABLE_VOICE=1 and the `voice` extra installed. The text then goes through the normal pipeline."""
from __future__ import annotations

import subprocess
import threading

import numpy as np

from app.config import ASR_MODEL, DEVICE

SR = 16000
_lock = threading.Lock()
_asr = None


def decode(data: bytes) -> np.ndarray:
    out = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        input=data, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)


def _model():
    global _asr
    with _lock:
        if _asr is None:
            import torch
            from transformers import pipeline
            dev = DEVICE if DEVICE != "auto" else ("cuda" if torch.cuda.is_available() else "cpu")
            _asr = pipeline("automatic-speech-recognition", model=ASR_MODEL, device=dev,
                            dtype=torch.float16 if dev == "cuda" else torch.float32)
    return _asr


def transcribe(data: bytes) -> str:
    audio = decode(data)
    if audio.size < SR * 0.3:
        return ""
    out = _model()({"raw": audio, "sampling_rate": SR}, chunk_length_s=30,
                   generate_kwargs={"language": "uzbek", "task": "transcribe", "num_beams": 1})
    return out["text"].strip()
