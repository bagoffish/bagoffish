const TARGET_RATE = 22050;
const MAX_SECONDS = 600;
const MAX_BYTES = 120 * 1024 * 1024;

let modelPromise = null;

async function loadBasicPitch() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const tfModule = await import("@tensorflow/tfjs-node");
    const tf = tfModule.default || tfModule;
    const pitchModule = await import("@spotify/basic-pitch");
    const pkg = pitchModule.default || pitchModule;
    const { BasicPitch } = pkg;

    if (typeof BasicPitch !== "function") {
      throw new Error("Basic Pitch module loaded without BasicPitch");
    }

    await tf.setBackend("tensorflow");
    await tf.ready();
    console.log("Robloxify TensorFlow backend:", tf.getBackend());

    const urls = [
      process.env.BASIC_PITCH_MODEL_URL,
      "https://bagof.fish/basic-pitch-model/model.json",
      "https://www.bagof.fish/basic-pitch-model/model.json",
    ].filter(Boolean);

    let lastError = null;
    for (const url of urls) {
      try {
        const model = await tf.loadGraphModel(url);
        return {
          instance: new BasicPitch(model),
          addPitchBendsToNoteEvents: pkg.addPitchBendsToNoteEvents,
          noteFramesToTime: pkg.noteFramesToTime,
          outputToNotesPoly: pkg.outputToNotesPoly,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Could not load the Basic Pitch model");
  })().catch((error) => {
    modelPromise = null;
    throw error;
  });

  return modelPromise;
}

function toMono(audio) {
  const channels = Number(audio.numberOfChannels) || 1;
  const length = Number(audio.length) || 0;
  const rate = Number(audio.sampleRate) || TARGET_RATE;

  if (channels === 1) {
    return { samples: audio.getChannelData(0).slice(), sampleRate: rate };
  }

  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = audio.getChannelData(channel);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
  }
  return { samples: mono, sampleRate: rate };
}

function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;

  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    const source = i * ratio;
    const left = Math.floor(source);
    const right = Math.min(left + 1, samples.length - 1);
    const amount = source - left;
    output[i] = samples[left] * (1 - amount) + samples[right] * amount;
  }

  return output;
}

function audioLike(samples, sampleRate) {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => samples,
  };
}

function mergeNotes(primary, secondary) {
  const notes = [...(primary || [])];
  const buckets = new Map();

  for (const note of notes) {
    const key =
      Math.round(note.startTimeSeconds / 0.045) + ":" + Math.round(note.pitchMidi);
    buckets.set(key, note);
  }

  for (const note of secondary || []) {
    const time = Math.round(note.startTimeSeconds / 0.045);
    const pitch = Math.round(note.pitchMidi);
    let duplicate = false;

    for (let bucket = time - 1; bucket <= time + 1; bucket += 1) {
      const existing = buckets.get(bucket + ":" + pitch);
      if (
        existing &&
        Math.abs(existing.startTimeSeconds - note.startTimeSeconds) < 0.045 &&
        Math.abs(existing.durationSeconds - note.durationSeconds) < 0.12
      ) {
        duplicate = true;
        break;
      }
    }

    if (!duplicate) {
      notes.push(note);
      buckets.set(time + ":" + pitch, note);
    }
  }

  return notes
    .filter(
      (note) =>
        Number.isFinite(note.pitchMidi) &&
        Number.isFinite(note.startTimeSeconds) &&
        Number.isFinite(note.durationSeconds)
    )
    .sort(
      (a, b) =>
        a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi
    );
}

async function transcribeAudioBuffer(fileBuffer, mimeType = "") {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error("Empty audio file");
  }
  if (fileBuffer.length > MAX_BYTES) {
    throw new Error("Audio file too large (max 120 MB)");
  }

  let metadataDuration = 0;
  try {
    const mm = await import("music-metadata");
    const parsed = await mm.parseBuffer(
      fileBuffer,
      { mimeType: String(mimeType || "") },
      { duration: true, skipCovers: true }
    );
    metadataDuration = Number(parsed?.format?.duration) || 0;
  } catch (metadataError) {
    console.warn(
      "Audio metadata duration unavailable:",
      metadataError?.message || metadataError
    );
  }

  const decodeStartedAt = Date.now();
  const decoderModule = await import("@audio/decode");
  const decodeAudio = decoderModule.default || decoderModule;
  const decoded = await decodeAudio(fileBuffer);

  const channelData = Array.isArray(decoded?.channelData) ? decoded.channelData : [];
  const decodedSampleRate = Number(decoded?.sampleRate);
  const decodedLength =
    channelData.length && channelData[0] ? channelData[0].length : 0;
  const decodedDuration =
    decodedLength > 0 && decodedSampleRate > 0
      ? decodedLength / decodedSampleRate
      : Number(decoded?.duration) || 0;
  const duration = decodedDuration > 0 ? decodedDuration : metadataDuration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(
      "Could not determine audio duration. The uploaded audio format could not be read."
    );
  }
  if (duration > MAX_SECONDS) {
    throw new Error("Audio must be 600 seconds or shorter (10 minutes)");
  }

  if (
    !channelData.length ||
    !Number.isFinite(decodedSampleRate) ||
    decodedSampleRate <= 0 ||
    decodedLength <= 0
  ) {
    throw new Error("Decoded audio contains no usable samples");
  }

  const decodedAudio = {
    numberOfChannels: channelData.length,
    length: decodedLength,
    sampleRate: decodedSampleRate,
    getChannelData: (index) => channelData[index],
  };
  const mono = toMono(decodedAudio);
  const samples = resample(mono.samples, mono.sampleRate, TARGET_RATE);
  console.log(
    `Robloxify decode/resample: ${Date.now() - decodeStartedAt}ms (${duration.toFixed(2)}s audio)`
  );
  const pitchStartedAt = Date.now();
  const pitch = await loadBasicPitch();

  const frames = [];
  const onsets = [];
  const contours = [];

  await pitch.instance.evaluateModel(
    audioLike(samples, TARGET_RATE),
    (frameBatch, onsetBatch, contourBatch) => {
      frames.push(...frameBatch);
      onsets.push(...onsetBatch);
      contours.push(...contourBatch);
    },
    () => {}
  );

  console.log(
    `Robloxify Basic Pitch inference: ${Date.now() - pitchStartedAt}ms`
  );

  const notePostProcessStartedAt = Date.now();
  const primaryRaw = pitch.outputToNotesPoly(frames, onsets, 0.32, 0.38, 8);
  const sensitiveRaw = pitch.outputToNotesPoly(frames, onsets, 0.22, 0.30, 6);

  const primary = pitch.noteFramesToTime(
    pitch.addPitchBendsToNoteEvents(contours, primaryRaw)
  );
  const sensitive = pitch.noteFramesToTime(
    pitch.addPitchBendsToNoteEvents(contours, sensitiveRaw)
  );

  const notes = mergeNotes(primary, sensitive);
  console.log(
    `Robloxify note extraction: ${Date.now() - notePostProcessStartedAt}ms (${notes.length} notes)`
  );

  return {
    notes,
    duration,
    sampleRate: TARGET_RATE,
    noteCount: notes.length,
  };
}

function summarize(notes, duration) {
  const clean = (notes || []).filter(
    (note) =>
      Number.isFinite(note.pitchMidi) &&
      Number.isFinite(note.startTimeSeconds) &&
      Number.isFinite(note.durationSeconds)
  );

  const histogram = Array(12).fill(0);
  let low = 0;
  let mid = 0;
  let high = 0;
  let short = 0;
  let long = 0;
  const gaps = [];

  for (let i = 0; i < clean.length; i += 1) {
    const note = clean[i];
    histogram[((Math.round(note.pitchMidi) % 12) + 12) % 12] += 1;

    if (note.pitchMidi < 50) low += 1;
    else if (note.pitchMidi < 72) mid += 1;
    else high += 1;

    if (note.durationSeconds < 0.15) short += 1;
    if (note.durationSeconds > 0.7) long += 1;

    if (i > 0) {
      const gap = note.startTimeSeconds - clean[i - 1].startTimeSeconds;
      if (gap >= 0.05 && gap <= 2) gaps.push(gap);
    }
  }

  gaps.sort((a, b) => a - b);

  return {
    durationSeconds: Math.round(Number(duration || 0) * 100) / 100,
    noteCount: clean.length,
    notesPerSecond: Number(
      (clean.length / Math.max(1, duration || 1)).toFixed(3)
    ),
    pitchRange: clean.length
      ? {
          min: Math.min(...clean.map((note) => note.pitchMidi)),
          max: Math.max(...clean.map((note) => note.pitchMidi)),
        }
      : null,
    pitchClassHistogram: histogram,
    lowRatio: Number((low / Math.max(1, clean.length)).toFixed(3)),
    midRatio: Number((mid / Math.max(1, clean.length)).toFixed(3)),
    highRatio: Number((high / Math.max(1, clean.length)).toFixed(3)),
    shortNoteRatio: Number((short / Math.max(1, clean.length)).toFixed(3)),
    longNoteRatio: Number((long / Math.max(1, clean.length)).toFixed(3)),
    medianOnsetGapSeconds: gaps.length
      ? Number(gaps[Math.floor(gaps.length / 2)].toFixed(3))
      : 0,
  };
}

function fallbackPlan(notes, duration) {
  return {
    primaryRole: "vocals",
    supportRoles: ["bass", "keys", "arp"],
    drums: true,
    density: 0.38,
    swing: 0,
    quantizeGrid: 0.125,
    preserveMelody: true,
    tempoBpm: 120,
    harmonicComplexity: 0.45,
    bassPattern: "root",
    chordRhythm: "half",
    melodyOctave: 0,
    drumPattern: "basic",
    referenceUrl: REFERENCE_URL,
    referenceStyle: REFERENCE_STYLE,
    soundfontRoles: { ...SOUND_FONT_BY_ROLE },
    reason:
      "Permanent SEWH M.U.L.E / classic-Roblox reference style using a fixed repository SoundFont palette while preserving the uploaded instrumental.",
  };
}

// Style is deliberately NOT generated per upload.
// Basic Pitch only supplies the user's notes; this fixed plan supplies the
// musical identity every Robloxify conversion uses.
async function createRobloxifyStylePlan(notes, duration, referenceUrl = REFERENCE_URL) {
  const plan = fallbackPlan(notes, duration);
  return {
    ...plan,
    referenceUrl: REFERENCE_URL,
    referenceStyle: REFERENCE_STYLE,
    soundfonts: ROBLOX_SOUNDFONTS,
    soundfontRoles: { ...SOUND_FONT_BY_ROLE },
    ai: false,
    fixedStyle: true,
    model: null,
    analysis: summarize(notes, duration),
    webResearch: [],
  };
}

module.exports = {
  transcribeAudioBuffer,
  createRobloxifyStylePlan,
  ROBLOXIFY_LIMITS: {
    MAX_SECONDS,
    MAX_BYTES,
  },
};
