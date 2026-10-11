FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_DIR=/models/scottcera

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg unzip \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir runpod edge-tts huggingface_hub rvc-python

WORKDIR /app
COPY handler.py /app/handler.py
CMD ["python", "-u", "/app/handler.py"]
