FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_DIR=/models/scottcera

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg unzip \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "numpy<2" runpod edge-tts huggingface_hub rvc-python \
    && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu118 \
       torch==2.1.1+cu118 torchaudio==2.1.1+cu118

WORKDIR /app
COPY handler.py /app/handler.py
CMD ["python", "-u", "/app/handler.py"]
