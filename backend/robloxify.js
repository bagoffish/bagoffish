import * as tf from "@tensorflow/tfjs";
import {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
  BasicPitch,
} from "@spotify/basic-pitch";
import decodeAudio from "audio-decode";

const TARGET_RATE = 22050;
const MAX_SECONDS = 600; // 10 minutes
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB for longer tracks

let basicPitchPromise = null;

async function getBasicPitch() {
  if (!basicPitchPromise) {
    basicPitchPromise = (async () => {
      // Pure-JS backend — runs on the server so the user's browser stays free
      await tf.setBackend("cpu");
      await tf.ready();
      // Model is served by the static frontend; also try local copy if present
      const modelUrls = [
        process.env.BASIC_PITCH_MODEL_URL,
        "https://bagof.fish/basic-pitch-model/model.json",
        "https://www.bagof.fish/basic-pitch-model/model.json",
      ].filter(Boolean);
      let lastErr;
      for (const url of modelUrls) {
        try {
          const model = await tf.loadGraphModel(url);
          return new BasicPitch(model);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error("Could not load Basic Pitch model");
    })();
  }
  return basicPitchPromise;
}

function toMonoFloat32(audioBuffer) {
  const { numberOfChannels, length, sampleRate } = audioBuffer;
  if (numberOfChannels === 1) {
    return { samples: audioBuffer.getChannelData(0).slice(), sampleRate };
  }
  const out = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] += data[i] / numberOfChannels;
  }
  return { samples: out, sampleRate };
}

function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const newLen = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const t = src - i0;
    out[i] = samples[i0] * (1 - t) + samples[i1] * t;
  }
  return out;
}

function makeAudioBufferLike(samples, sampleRate) {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData() {
      return samples;
    },
  };
}

/**
 * Transcribe an audio file buffer into Basic Pitch note events.
 * @param {Buffer} fileBuffer
 * @param {(p: number) => void} [onProgress]
 */
export async function transcribeAudioBuffer(fileBuffer, onProgress) {
  if (!fileBuffer || !fileBuffer.length) {
    throw new Error("Empty audio file");
  }
  if (fileBuffer.length > MAX_BYTES) {
    throw new Error("Audio file too large (max 50 MB)");
  }

  const audioBuffer = await decodeAudio(
    fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    )
  );

  const duration =
    audioBuffer.duration || audioBuffer.length / audioBuffer.sampleRate;
  if (duration > MAX_SECONDS) {
    throw new Error(`Audio must be ${MAX_SECONDS} seconds or shorter (10 minutes)`);
  }

  let { samples, sampleRate } = toMonoFloat32(audioBuffer);
  samples = resampleLinear(samples, sampleRate, TARGET_RATE);
  sampleRate = TARGET_RATE;

  const basicPitch = await getBasicPitch();
  const frames = [];
  const onsets = [];
  const contours = [];
  let lastP = -1;

  await basicPitch.evaluateModel(
    makeAudioBufferLike(samples, sampleRate),
    (frameBatch, onsetBatch, contourBatch) => {
      frames.push(...frameBatch);
      onsets.push(...onsetBatch);
      contours.push(...contourBatch);
    },
    (value) => {
      const p = Math.max(0, Math.min(1, value));
      if (onProgress && (p - lastP >= 0.03 || p >= 1)) {
        lastP = p;
        onProgress(p);
      }
    }
  );

  const notes = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.34, 0.42, 8)
    )
  );

  return {
    notes,
    duration,
    sampleRate,
    noteCount: notes.length,
  };
}

export const ROBLOXIFY_LIMITS = { MAX_SECONDS, MAX_BYTES };
