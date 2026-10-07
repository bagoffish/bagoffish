const brain = require("./robloxify-knowledge.json");

const TARGET_RATE = 22050;
const MAX_SECONDS = 600;
const MAX_BYTES = 50 * 1024 * 1024;

let modelPromise = null;
let stemSeparatorPromise = null;

const DEMUCS_WEIGHTS_URL = process.env.ROBLOXIFY_DEMUCS_WEIGHTS_URL || "https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/main/";

async function loadStemSeparator() {
  if (!stemSeparatorPromise) {
    stemSeparatorPromise = import("@audio/neural-separate").then(mod => mod.default || mod.separate || mod).catch(error => {
      stemSeparatorPromise = null;
      throw error;
    });
  }
  return stemSeparatorPromise;
}

function encodeStereoWav(left, right, sampleRate) {
  const frames = Math.min(left.length, right.length);
  const buffer = Buffer.allocUnsafe(44 + frames * 4);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + frames * 4, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(frames * 4, 40);

  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    const l = Math.max(-1, Math.min(1, Number(left[i]) || 0));
    const r = Math.max(-1, Math.min(1, Number(right[i]) || 0));
    buffer.writeInt16LE(l < 0 ? l * 0x8000 : l * 0x7fff, offset);
    buffer.writeInt16LE(r < 0 ? r * 0x8000 : r * 0x7fff, offset + 2);
    offset += 4;
  }
  return buffer;
}

async function separateToInstrumental(fileBuffer, mimeType = "") {
  const separator = await loadStemSeparator();
  const decoderModule = await import("@audio/decode");
  const decodeAudio = decoderModule.default || decoderModule;
  const decoded = await decodeAudio(fileBuffer);

  const channelData = Array.isArray(decoded?.channelData) ? decoded.channelData : [];
  const sampleRate = Number(decoded?.sampleRate);
  if (!channelData.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Could not decode audio for stem separation");
  }

  const left = channelData[0];
  const right = channelData[1] || left;
  console.log("Robloxify backend Demucs: separating drums/bass/other/vocals");

  const separated = await separator([left, right], {
    sampleRate,
    model: "htdemucs",
    weights: DEMUCS_WEIGHTS_URL,
    device: "cpu",
    progress: info => {
      if (info && Number.isFinite(info.chunk) && Number.isFinite(info.totalChunks)) {
        console.log(`Robloxify Demucs chunk ${info.chunk + 1}/${info.totalChunks}`);
      }
    },
  });

  const stems = separated?.stems || {};
  const bass = stems.bass;
  const drums = stems.drums;
  const other = stems.other;
  if (!bass || !drums || !other) {
    throw new Error("Stem separator did not return the required instrumental stems");
  }

  const stemLeft = value => value?.[0] || value?.left || new Float32Array(0);
  const stemRight = value => value?.[1] || value?.right || stemLeft(value);
  const bassL = stemLeft(bass);
  const bassR = stemRight(bass);
  const drumsL = stemLeft(drums);
  const drumsR = stemRight(drums);
  const otherL = stemLeft(other);
  const otherR = stemRight(other);
  const length = Math.min(bassL.length, bassR.length, drumsL.length, drumsR.length, otherL.length, otherR.length);
  if (!length) throw new Error("Stem separator returned empty stems");

  const instrumentalL = new Float32Array(length);
  const instrumentalR = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    instrumentalL[i] = Math.max(-1, Math.min(1, (bassL[i] || 0) + (otherL[i] || 0) + (drumsL[i] || 0) * 0.16));
    instrumentalR[i] = Math.max(-1, Math.min(1, (bassR[i] || 0) + (otherR[i] || 0) + (drumsR[i] || 0) * 0.16));
  }

  const instrumental = encodeStereoWav(instrumentalL, instrumentalR, sampleRate);
  return { buffer: instrumental, mimeType: "audio/wav" };
}

const ROLES = ["drums", "bass", "guitar", "vocals", "keys", "pad", "strings", "arp"];

// Robloxify has one permanent musical reference. The reference is learned once
// and represented here as a fixed style profile; uploads must not cause the AI
// to invent a new genre, instrumentation, or arrangement direction.
const REFERENCE_URL = "https://youtu.be/XWpqGrSfd_0?si=r3tQJEW9U4K_bRIy";
const REFERENCE_STYLE = {
  name: "Robloxify Reference Style",
  traits: [
    "MIDI-era Roblox/game-music character",
    "bright synthetic lead",
    "compact repeating motifs",
    "clear root-driven bass",
    "simple triadic harmony",
    "short quantized notes",
    "small arpeggio accents",
    "restrained game percussion",
    "lo-fi crunchy SoundFont character",
  ],
  arrangement: "Keep the uploaded melody and timing recognizable, then express it through a compact Roblox/game-MIDI arrangement.",
  instrumentation: "Use the fixed classic-Roblox SoundFont palette from the repository; assign different fixed banks to different roles, never per-song.",
};

// Robloxify uses a permanent, hand-picked classic-Roblox SoundFont palette.
// The palette is fixed for every song; uploads never choose a new SoundFont.
const ROBLOX_SOUNDFONTS = [
  {
    id: "fjords",
    name: "Wind of Fjords",
    url: "/soundfonts/Instruments/WorkingR-Blox/Wind_Of_Fjords_V2.5.1a/WindOfFjordsV2.5.1a.sf2",
    character: "classic Roblox/MIDI melodic instruments",
    bankOffset: 0,
  },
  {
    id: "roblox-sf",
    name: "Roblox Soundfont",
    url: "/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2",
    character: "classic Roblox synthetic colors",
    bankOffset: 1,
  },
  {
    id: "strategy",
    name: "The Great Strategy",
    url: "/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/The_Great_Strategy_MIDI.sf2",
    character: "retro game orchestral colors",
    bankOffset: 2,
  },
  {
    id: "classic-days",
    name: "Classic Days",
    url: "/soundfonts/Instruments/Soundfonts/Classic%20Days.sf2",
    character: "older game/MIDI colors",
    bankOffset: 3,
  },
  {
    id: "gamehero",
    name: "GameHero",
    url: "/soundfonts/Instruments/Soundfonts/GameHero%20Soundfont.sf2",
    character: "bright game instruments",
    bankOffset: 4,
  },
  {
    id: "stealth",
    name: "StealthPilot",
    url: "/soundfonts/Instruments/Soundfonts/StealthPilot.sf2",
    character: "retro electronic colors",
    bankOffset: 5,
  },
  {
    id: "nokia",
    name: "Nokia Tongbao",
    url: "/soundfonts/Instruments/WorkingR-Blox/Nokia_Tongbao_Bank.sf2",
    character: "compact mobile/MIDI tones",
    bankOffset: 6,
  },
  {
    id: "drums",
    name: "StealthPilot Drums",
    url: "/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/StealthPilot_MIDI_DRUMS_ONLY.sf2",
    character: "classic electronic/game percussion",
    bankOffset: 7,
  },
];

const SOUND_FONT_BY_ROLE = {
  drums: "drums",
  bass: "fjords",
  guitar: "gamehero",
  vocals: "roblox-sf",
  keys: "classic-days",
  pad: "strategy",
  strings: "strategy",
  arp: "nokia",
};

function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

async function loadBasicPitch() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    // Use the native Node TensorFlow backend. The pure-JS tfjs CPU backend is
    // dramatically slower for Basic Pitch on Render.
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
  })().catch(error => {
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
    const key = Math.round(note.startTimeSeconds / 0.045) + ":" + Math.round(note.pitchMidi);
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
    .filter(note =>
      Number.isFinite(note.pitchMidi) &&
      Number.isFinite(note.startTimeSeconds) &&
      Number.isFinite(note.durationSeconds)
    )
    .sort((a, b) =>
      a.startTimeSeconds - b.startTimeSeconds ||
      a.pitchMidi - b.pitchMidi
    );
}

async function transcribeAudioBuffer(fileBuffer, mimeType = "") {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error("Empty audio file");
  }
  if (fileBuffer.length > MAX_BYTES) {
    throw new Error("Audio file too large (max 50 MB)");
  }

  let metadataDuration = 0;
  try {
    const mm = await import("music-metadata");
    const parsed = await mm.parseBuffer(fileBuffer, { mimeType: String(mimeType || "") }, { duration: true, skipCovers: true });
    metadataDuration = Number(parsed?.format?.duration) || 0;
  } catch (metadataError) {
    console.warn("Audio metadata duration unavailable:", metadataError?.message || metadataError);
  }

  const decodeStartedAt = Date.now();
  const decoderModule = await import("@audio/decode");
  const decodeAudio = decoderModule.default || decoderModule;
  const decoded = await decodeAudio(fileBuffer);

  const channelData = Array.isArray(decoded?.channelData) ? decoded.channelData : [];
  const decodedSampleRate = Number(decoded?.sampleRate);
  const decodedLength = channelData.length && channelData[0] ? channelData[0].length : 0;
  const decodedDuration = decodedLength > 0 && decodedSampleRate > 0
    ? decodedLength / decodedSampleRate
    : Number(decoded?.duration) || 0;
  const duration = decodedDuration > 0 ? decodedDuration : metadataDuration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine audio duration. The uploaded audio format could not be read.");
  }
  if (duration > MAX_SECONDS) {
    throw new Error("Audio must be 600 seconds or shorter (10 minutes)");
  }

  if (!channelData.length || !Number.isFinite(decodedSampleRate) || decodedSampleRate <= 0 || decodedLength <= 0) {
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
  console.log(`Robloxify decode/resample: ${Date.now() - decodeStartedAt}ms (${duration.toFixed(2)}s audio)`);
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
    () => {
      // Basic Pitch 1.0.1 requires a PercentCallback. The API endpoint does
      // not stream progress, so the backend intentionally keeps this callback
      // lightweight and lets the HTTP request complete normally.
    }
  );

  console.log(`Robloxify Basic Pitch inference: ${Date.now() - pitchStartedAt}ms`);

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
  console.log(`Robloxify note extraction: ${Date.now() - notePostProcessStartedAt}ms (${notes.length} notes)`);

  return {
    notes,
    duration,
    sampleRate: TARGET_RATE,
    noteCount: notes.length,
  };
}

function summarize(notes, duration) {
  const clean = (notes || []).filter(note =>
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
    notesPerSecond: Number((clean.length / Math.max(1, duration || 1)).toFixed(3)),
    pitchRange: clean.length
      ? {
          min: Math.min(...clean.map(note => note.pitchMidi)),
          max: Math.max(...clean.map(note => note.pitchMidi)),
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
    reason: "Permanent classic-Roblox reference style using a fixed repository SoundFont palette while preserving the uploaded instrumental.",
  };
}

// The style is deliberately NOT generated per upload.
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
  separateToInstrumental,
  transcribeAudioBuffer,
  createRobloxifyStylePlan,
  ROBLOXIFY_LIMITS: {
    MAX_SECONDS,
    MAX_BYTES,
  },
};
