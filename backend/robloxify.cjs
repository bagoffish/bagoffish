const brain = require("./robloxify-knowledge.json");

const TARGET_RATE = 22050;
const MAX_SECONDS = 600;
const MAX_BYTES = 50 * 1024 * 1024;

let modelPromise = null;

const ROLES = ["drums", "bass", "guitar", "vocals", "keys", "pad", "strings", "arp"];
const REFERENCE_URL = "https://youtu.be/XWpqGrSfd_0?si=r3tQJEW9U4K_bRIy";
const ROBLOX_SOUNDFONTS = [
  { id: "nokia", name: "Nokia Tongbao", character: "small, bright, lo-fi mobile-game timbres" },
  { id: "roblox-sf", name: "Roblox Soundfont", character: "classic Roblox/general MIDI palette" },
  { id: "gamehero", name: "GameHero", character: "arcade/game-style tones" },
  { id: "classic-days", name: "Classic Days", character: "retro game/keyboard colors" },
  { id: "stealth", name: "StealthPilot", character: "digital synth colors" },
  { id: "drums", name: "StealthPilot Drums", character: "compact game percussion" },
  { id: "fjords-midi", name: "Wind of Fjords MIDI", character: "MIDI-era melodic/harmonic colors" },
];

function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

async function loadBasicPitch() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const tfModule = await import("@tensorflow/tfjs");
    const tf = tfModule.default || tfModule;
    const pitchModule = await import("@spotify/basic-pitch");
    const pkg = pitchModule.default || pitchModule;
    const { BasicPitch } = pkg;

    if (typeof BasicPitch !== "function") {
      throw new Error("Basic Pitch module loaded without BasicPitch");
    }

    await tf.setBackend("cpu");
    await tf.ready();

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

  const primaryRaw = pitch.outputToNotesPoly(frames, onsets, 0.32, 0.38, 8);
  const sensitiveRaw = pitch.outputToNotesPoly(frames, onsets, 0.22, 0.30, 6);

  const primary = pitch.noteFramesToTime(
    pitch.addPitchBendsToNoteEvents(contours, primaryRaw)
  );
  const sensitive = pitch.noteFramesToTime(
    pitch.addPitchBendsToNoteEvents(contours, sensitiveRaw)
  );

  const notes = mergeNotes(primary, sensitive);

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
  const analysis = summarize(notes, duration);

  if (analysis.notesPerSecond > 12 && analysis.shortNoteRatio > 0.5) {
    return {
      primaryRole: "vocals",
      supportRoles: ["bass", "guitar", "keys"],
      drums: true,
      density: 0.9,
      swing: 0,
      quantizeGrid: 0.125,
      preserveMelody: true,
      tempoBpm: 120,
      harmonicComplexity: 0.5,
      bassPattern: "pulse",
      chordRhythm: "quarter",
      melodyOctave: 0,
      drumPattern: "basic",
      reason: "Dense melodic performance.",
    };
  }

  if (analysis.lowRatio > 0.45 && analysis.notesPerSecond < 5) {
    return {
      primaryRole: "bass",
      supportRoles: ["keys", "strings"],
      drums: true,
      density: 0.55,
      swing: 0,
      quantizeGrid: 0.25,
      preserveMelody: true,
      tempoBpm: 120,
      harmonicComplexity: 0.5,
      bassPattern: "root",
      chordRhythm: "half",
      melodyOctave: 0,
      drumPattern: "basic",
      reason: "Sparse bass-heavy performance.",
    };
  }

  if (analysis.highRatio > 0.4 && analysis.notesPerSecond > 7) {
    return {
      primaryRole: "vocals",
      supportRoles: ["bass", "guitar", "arp"],
      drums: true,
      density: 0.8,
      swing: 0,
      quantizeGrid: 0.125,
      preserveMelody: true,
      tempoBpm: 120,
      harmonicComplexity: 0.6,
      bassPattern: "pulse",
      chordRhythm: "quarter",
      melodyOctave: 0,
      drumPattern: "basic",
      reason: "Bright high-register performance.",
    };
  }

  return {
    primaryRole: "guitar",
    supportRoles: ["bass", "keys", "strings"],
    drums: false,
    density: 0.65,
    swing: 0,
    quantizeGrid: 0.25,
    preserveMelody: true,
    tempoBpm: 120,
    harmonicComplexity: 0.55,
    bassPattern: "root",
    chordRhythm: "half",
    melodyOctave: 0,
    drumPattern: "none",
    reason: "Balanced arrangement.",
  };
}

function parseJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Planner did not return a JSON object");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function sanitizePlan(plan, fallback) {
  const source = plan && typeof plan === "object" ? plan : {};
  const result = { ...fallback, ...source };

  if (!ROLES.includes(result.primaryRole)) result.primaryRole = fallback.primaryRole;

  result.supportRoles = Array.isArray(result.supportRoles)
    ? [...new Set(result.supportRoles.filter(role => ROLES.includes(role)))].slice(0, 4)
    : fallback.supportRoles;

  result.drums = Boolean(result.drums);
  result.density = clamp(result.density, 0.25, 1, fallback.density);
  result.swing = clamp(result.swing, 0, 0.35, fallback.swing);
  result.tempoBpm = clamp(result.tempoBpm, 70, 180, 120);
  result.harmonicComplexity = clamp(result.harmonicComplexity, 0, 1, 0.5);
  result.preserveMelody = result.preserveMelody !== false;

  if (![0.0625, 0.125, 0.25, 0.5].includes(Number(result.quantizeGrid))) {
    result.quantizeGrid = fallback.quantizeGrid;
  }

  if (!["root", "octave", "walking", "pulse"].includes(result.bassPattern)) {
    result.bassPattern = fallback.bassPattern;
  }

  if (!["sustained", "half", "quarter", "syncopated"].includes(result.chordRhythm)) {
    result.chordRhythm = fallback.chordRhythm;
  }

  result.melodyOctave = [-1, 0, 1].includes(Number(result.melodyOctave))
    ? Number(result.melodyOctave)
    : 0;

  if (!["none", "basic", "four_on_floor", "breakbeat"].includes(result.drumPattern)) {
    result.drumPattern = fallback.drumPattern;
  }

  result.reason = typeof result.reason === "string"
    ? result.reason.slice(0, 500)
    : fallback.reason;

  result.webResearch = Array.isArray(result.webResearch)
    ? result.webResearch.slice(0, 8).map(item => ({
        title: String(item?.title || "").slice(0, 180),
        url: String(item?.url || "").slice(0, 500),
        takeaway: String(item?.takeaway || "").slice(0, 300),
      }))
    : [];

  return result;
}

async function createRobloxifyStylePlan(notes, duration, referenceUrl = REFERENCE_URL) {
  const fallback = fallbackPlan(notes, duration);
  const analysis = summarize(notes, duration);

  if (!process.env.OPENAI_API_KEY) {
    return { ...fallback, ai: false, analysis, webResearch: [] };
  }

  try {
    const model = process.env.ROBLOXIFY_AI_MODEL || "gpt-6-luna";
    const prompt = [
      "You are the musical director for Robloxify.",
      "Create a vocal-less 8-bit chiptune/game-console arrangement based on the supplied reference URL and its publicly available information.",
      "Study the reference URL with web search before deciding the arrangement. Extract broad traits such as tempo feel, rhythmic density, melodic phrasing, harmony, instrumentation, texture, distortion/bit-crush character, and mix balance.",
      "Do not copy the reference song, melody, lyrics, recording, or distinctive arrangement. Recreate only broad sonic characteristics for the user's uploaded song.",
      "The actual instruments must come from the Roblox SF2 palette supplied below. Choose the closest palette members for each role rather than inventing external instruments.",
      "Preserve the uploaded performance's melody, timing, contour, and recognizable structure while converting its instrumentation into crunchy 8-bit/chiptune sounds.",
      "Favor square/pulse leads, short synth bass, compact chord stabs, arpeggios, simple game-style drums, and a deliberately lo-fi/bit-crushed texture.",
      "Use the supplied reference library as broad arrangement knowledge.",
      "REFERENCE_URL: " + referenceUrl,
      "ROBLOX_SOUNDFONTS: " + JSON.stringify(ROBLOX_SOUNDFONTS),
      "Do not copy any specific song, lyric, melody, or distinctive arrangement.",
      "Return JSON only.",
      JSON.stringify({ referenceLibrary: brain }),
      JSON.stringify({
        transcription: analysis,
        schema: {
          primaryRole: "guitar|keys|arp|vocals",
          supportRoles: "array of up to four roles",
          drums: "boolean",
          density: "0.25-1",
          swing: "0-0.35",
          quantizeGrid: "0.0625|0.125|0.25|0.5",
          preserveMelody: "boolean",
          tempoBpm: "70-180",
          harmonicComplexity: "0-1",
          bassPattern: "root|octave|walking|pulse",
          chordRhythm: "sustained|half|quarter|syncopated",
          melodyOctave: "-1|0|1",
          drumPattern: "none|basic|four_on_floor|breakbeat",
          soundfontRoles: "object mapping lead,bass,harmony,arp,drums to soundfont IDs from ROBLOX_SOUNDFONTS",
          referenceStyle: "short description of the broad sonic traits learned from the reference",
          reason: "short string describing the 8-bit arrangement",
          webResearch: "array of source summaries",
        },
      }),
    ].join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search" }],
        input: prompt,
        max_output_tokens: 1400,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error?.message || "Robloxify planner request failed");
    }

    const outputText = data.output_text ||
      (data.output || [])
        .flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("");

    return {
      ...sanitizePlan(parseJson(outputText), fallback),
      referenceUrl,
      ai: true,
      model,
      analysis,
    };
  } catch (error) {
    return {
      ...fallback,
      ai: false,
      aiError: error instanceof Error ? error.message : String(error),
      analysis,
      webResearch: [],
      referenceUrl,
    };
  }
}

module.exports = {
  transcribeAudioBuffer,
  createRobloxifyStylePlan,
  ROBLOXIFY_LIMITS: {
    MAX_SECONDS,
    MAX_BYTES,
  },
};
