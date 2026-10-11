import asyncio
import base64
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path

import edge_tts
import runpod
from huggingface_hub import hf_hub_download

MODEL_DIR = Path(os.getenv("MODEL_DIR", "/models/scottcera"))
MODEL_REPO = os.getenv("MODEL_REPO", "Cyzzby/Dashs-RVC-Models")
MODEL_ARCHIVE = os.getenv("MODEL_ARCHIVE", "ScottCeraV2.zip")
TTS_VOICE = os.getenv("TTS_VOICE", "en-US-AndrewNeural")
RVC_DEVICE = os.getenv("RVC_DEVICE", "cuda:0")
INDEX_RATE = os.getenv("RVC_INDEX_RATE", "0.75")
MAX_TEXT_LENGTH = 2000


def load_model_files():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    existing_pth = list(MODEL_DIR.rglob("*.pth"))
    existing_indexes = list(MODEL_DIR.rglob("*.index"))
    if existing_pth and existing_indexes:
        return existing_pth[0], pick_index(existing_indexes)

    archive = hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_ARCHIVE)
    with zipfile.ZipFile(archive) as zf:
        zf.extractall(MODEL_DIR)

    pth_files = list(MODEL_DIR.rglob("*.pth"))
    index_files = list(MODEL_DIR.rglob("*.index"))
    if not pth_files:
        raise RuntimeError(f"No .pth model found in {MODEL_ARCHIVE}")
    if not index_files:
        raise RuntimeError(f"No .index file found in {MODEL_ARCHIVE}")
    pth = next((p for p in pth_files if "ScottCeraV2" in p.name), pth_files[0])
    return pth, pick_index(index_files)


def pick_index(index_files):
    return next((p for p in index_files if p.name.startswith("added_IVF")), index_files[0])


MODEL_PATH, INDEX_PATH = load_model_files()
print(f"ScottCera model loaded from {MODEL_PATH}")
print(f"ScottCera index loaded from {INDEX_PATH}")


async def generate_source_audio(text, output_path):
    communicate = edge_tts.Communicate(text, TTS_VOICE)
    await communicate.save(str(output_path))


def handler(event):
    payload = event.get("input") or {}
    text = str(payload.get("text", "")).strip()[:MAX_TEXT_LENGTH]
    if not text:
        raise ValueError("input.text is required")

    with tempfile.TemporaryDirectory(prefix="coy-voice-") as tmp:
        tmpdir = Path(tmp)
        source_mp3 = tmpdir / "source.mp3"
        source_wav = tmpdir / "source.wav"
        output_wav = tmpdir / "scottcera.wav"

        asyncio.run(generate_source_audio(text, source_mp3))
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(source_mp3),
             "-ar", "40000", "-ac", "1", str(source_wav)],
            check=True, timeout=30,
        )
        command = [
            "python", "-m", "rvc_python", "cli",
            "-i", str(source_wav), "-o", str(output_wav),
            "-mp", str(MODEL_PATH), "-ip", str(INDEX_PATH),
            "-de", RVC_DEVICE, "-me", "rmvpe",
            "-ir", INDEX_RATE, "-v", "v2",
        ]
        subprocess.run(command, check=True, timeout=100)
        audio_b64 = base64.b64encode(output_wav.read_bytes()).decode("ascii")
        return {"audio_base64": audio_b64, "content_type": "audio/wav"}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
