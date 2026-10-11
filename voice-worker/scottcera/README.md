# Coy ScottCera voice worker

RunPod Serverless worker that generates natural English source speech with Edge TTS, then converts it through the ScottCeraV2 RVC model and returns WAV audio as base64.

## Expected model archive

By default the worker downloads `ScottCeraV2.zip` from the public Hugging Face repository `Cyzzby/Dashs-RVC-Models`. The archive must contain the ScottCeraV2 `.pth` file and at least one `.index` file. If the archive or repository path changes, set `MODEL_REPO` and `MODEL_ARCHIVE` in the endpoint environment.

## Deploy

1. Build this directory as a RunPod Serverless worker image.
2. Create a GPU Serverless endpoint with the image and handler command already configured by the Dockerfile.
3. Set the environment variables only if needed: `MODEL_REPO`, `MODEL_ARCHIVE`, `TTS_VOICE`, `RVC_DEVICE`, `RVC_INDEX_RATE`.
4. Set the website backend variables:
   - `SCOTTCERA_TTS_URL=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync`
   - `SCOTTCERA_TTS_API_KEY=YOUR_RUNPOD_API_KEY`

The endpoint request/response wrapper is handled by `backend/personal-ai.js`. Keep the RunPod key in the backend's secret environment variables, never in frontend code.

## Test input

```json
{"input":{"text":"Hey, how's it going"}}
```

The RunPod output contains `audio_base64` and `content_type`. The model is downloaded at worker startup, so the first cold start can take longer than later calls.
