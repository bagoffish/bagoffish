// One thread keeps the native TensorFlow heap small enough for the 512 MB instance.
process.env.TF_NUM_INTRAOP_THREADS = process.env.TF_NUM_INTRAOP_THREADS || "1";
process.env.TF_NUM_INTEROP_THREADS = process.env.TF_NUM_INTEROP_THREADS || "1";

const { createRequire } = require("module");
const requireFromHere = createRequire(__filename);

const ROLES = ["drums", "bass", "cello", "vocals", "strings", "horn", "flute", "oboe", "clarinet", "arp", "keys", "pizz", "trumpet", "timpani"];

const REFERENCE_URL = "https://youtu.be/XWpqGrSfd_0?si=r3tQJEW9U4K_bRIy";
const REFERENCE_STYLE = {
  name: "SEWH M.U.L.E / Bloxify Orchestra",
  source: "SEWH:RECODE M.U.L.E rips",
  traits: [
    "classic Roblox MIDI orchestra, not a square-wave loop",
    "violin lead that follows the heard tune and stays in front",
    "contrabass and cello in long notes, not constant eighths",
    "string ensemble, horn, flute, oboe, and clarinet answering in phrases",
    "harp broken chords, soft piano stabs, and pizzicato offbeats",
    "trumpet only at a phrase ending",
    "timpani on the downbeat and a short roll at the cadence",
    "light kit: kick and snare, hats only sometimes, a rest every few bars",
    "small timing delays so the section does not attack together",
    "lo-fi SoundFont crunch from the Roblox banks plus GeneralUser GS",
    "vocal-less instrumental MIDI",
  ],
  arrangement: "Keep the uploaded melody recognizable on the violin. Write the other parts as an orchestra that breathes: one color instrument at a time, rests in the fourth bar of a phrase, and no machine-gun accompaniment.",
  instrumentation: "Study violin, contrabass, cello, string ensemble, horn, flute, oboe, clarinet, harp, piano, pizzicato, trumpet, timpani, and drums. Choose SoundFonts per role from the complete public/audios/soundfonts catalog; layer selected WAV percussion and accents from public/audios/WAV when the note analysis suits them.",
  tempoFeel: "steady mid-tempo game pulse, typically 100–140 BPM feel",
  density: "violin lead plus a small orchestra, thinner when the tune is sparse",
};

const study = require("../src/WinXP/apps/MusicAI/robloxStudy.json");
const ROBLOX_SOUNDFONTS = study.soundfonts.map((font) => ({
  id: font.id,
  name: font.name,
  url: font.url,
  bankOffset: font.bankOffset,
  presets: font.presets || {},
  drumProgram: font.drumProgram,
  drumKit: font.drumKit || null,
  lead: font.lead || "",
}));
const SOUNDFONT_BY_ID = Object.fromEntries(ROBLOX_SOUNDFONTS.map((font) => [font.id, font]));
const SOUNDFONT_ALIASES = study.aliases || {};
function resolveBankId(id) {
  if (SOUNDFONT_BY_ID[id]) return id;
  return SOUNDFONT_ALIASES[id] || id;
}
function encodeAudioPath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

const SOUND_FONT_BY_ROLE = {
  drums: "stealth",
  bass: "strategy",
  cello: "strategy",
  vocals: "strategy",
  strings: "strategy",
  horn: "strategy",
  flute: "beastmasters",
  oboe: "beastmasters",
  clarinet: "gamehero",
  arp: "beastmasters",
  keys: "strategy",
  pizz: "gamehero",
  trumpet: "strategy",
  timpani: "strategy",
  guitar: "stealth",
  pad: "fjords-hq",
};

const STUDIED_INSTRUMENTS = [
  { role: "vocals", name: "Violin", program: 3, bank: "strategy" },
  { role: "strings", name: "String", program: 4, bank: "strategy" },
  { role: "horn", name: "Brass", program: 1, bank: "strategy" },
  { role: "trumpet", name: "Trumpet", program: 2, bank: "strategy" },
  { role: "keys", name: "Digo Piano", program: 0, bank: "strategy" },
  { role: "flute", name: "Flute", program: 0, bank: "beastmasters" },
  { role: "arp", name: "Harp", program: 2, bank: "beastmasters" },
  { role: "bass", name: "Bass", program: 4, bank: "fjords-voyage" },
  { role: "drums", name: "Soundtrack kit WAV", program: 0, bank: "stealth" },
];

function chooseStudiedFamily(analysis) {
  const a = analysis || {};
  const dense = Number(a.notesPerSecond || 0) > 4.5 || Number(a.shortNoteRatio || 0) > 0.5;
  const lowHeavy = Number(a.lowRatio || 0) > 0.34;
  const sustained = Number(a.longNoteRatio || 0) > 0.28;
  const bright = Number(a.highRatio || 0) > 0.42;
  // Studied 2009 covers and the soundtrack itself stay on one bank, or a
  // Fjords + Strategy pair. Spreading every role across a different song
  // is what made the orchestra sound like the wrong game.
  if (lowHeavy && sustained) return { id: "horror", primary: "roblox-horror", pair: "trouble-ahead", kit: null };
  if (dense && bright) return { id: "dance", primary: "dance-potion", pair: "party-music", kit: "Dance Potion" };
  if (bright && !lowHeavy) return { id: "whistle", primary: "waapp", pair: "monster-mash", kit: "Monster Mash" };
  if (dense) return { id: "explore", primary: "explore-roblox", pair: "wiley-bricks", kit: "Explore Roblox" };
  if (sustained) return { id: "fjords", primary: "fjords-hq", pair: "strategy", kit: "Wind Of Fjords & Voyage of Eternity" };
  return { id: "strategy", primary: "strategy", pair: "beastmasters", kit: "The Great Strategy" };
}

function programsForFamily(family) {
  const primary = SOUNDFONT_BY_ID[family.primary] || SOUNDFONT_BY_ID.strategy;
  const pair = SOUNDFONT_BY_ID[family.pair] || primary;
  const programs = {};
  const roles = {};
  const use = (roleId, font) => {
    if (!font || !font.presets || font.presets[roleId] == null) return;
    programs[roleId] = font.presets[roleId];
    roles[roleId] = font.id;
  };
  ["vocals", "strings", "horn", "trumpet", "keys", "cello", "timpani", "bass", "guitar", "pad"].forEach((roleId) => use(roleId, primary));
  ["flute", "oboe", "arp", "clarinet", "pizz"].forEach((roleId) => use(roleId, pair.presets && pair.presets[roleId] != null ? pair : primary));
  if (!roles.vocals) use("vocals", pair);
  if (!roles.bass) use("bass", pair);
  roles.drums = primary.id;
  programs.drums = primary.drumProgram == null ? 0 : primary.drumProgram;
  programs.studied = true;
  return { programs, roles, fonts: [primary, pair].filter((font, index, list) => font && list.findIndex((item) => item.id === font.id) === index) };
}

const DRUM_KITS = {
  "The Great Strategy": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav", crash: "Cymbal.wav" },
  "Beastmasters Tale": { kick: "KICK_LEFT.wav", snare: "Snare.wav", hat: "HI_HAT.wav", crash: "LOW_CYMBAL.wav" },
  "Wind Of Fjords & Voyage of Eternity": { kick: "Bass hit.wav", snare: "Snare.wav", hat: "Hi Hat.wav", crash: "Cymbal.wav" },
  "StealthPilot": { kick: "StealthPilot Kick.mp3", snare: "StealthPilot Snare.mp3", hat: "Single Drum/HiHat Closed.wav", crash: "Single Drum/Crash1.wav" },
  "Classic Days": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav" },
  "Crossroad Times": { kick: "Kick.wav", snare: "Snare.wav", hat: "Snare Cymbal.wav" },
  "Dance Potion": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav", crash: "Impact.wav" },
  "Explore Roblox": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav" },
  "Monster Mash": { kick: "Kick.wav", snare: "Clap.wav", hat: "Hat.wav" },
  "Noob Alert": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav" },
  "Party Music": { kick: "Kick.wav", snare: "Snare.wav", hat: "Snare Impact.wav" },
  "Metal Bricks": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav" },
  "Training Day": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav" },
  "Trouble Ahead": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav" },
  "Clan Being Raided": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav" },
  "MULE": { kick: "Kick.wav", snare: "Snare.wav", hat: "Hat.wav", crash: "Impact.wav" },
};

function chooseSongAssets(analysis) {
  const family = chooseStudiedFamily(analysis);
  const kit = DRUM_KITS[family.kit];
  if (!kit) return [];
  const root = "/audios/soundeffects/Drums/" + family.kit;
  return Object.entries(kit).map(([role, file]) => ({
    id: role,
    url: encodeAudioPath(root + "/" + file),
    role: role === "crash" ? "crash" : role,
    gain: role === "kick" ? 0.34 : role === "snare" ? 0.22 : role === "crash" ? 0.1 : 0.08,
  }));
}

function choosePrebakedSoundfontPalette(analysis) {
  return programsForFamily(chooseStudiedFamily(analysis)).fonts;
}

const TARGET_RATE = 22050;
const MAX_SECONDS = 300;
const MAX_BYTES = 120 * 1024 * 1024;

let modelPromise = null;

// Basic Pitch never disposes the window tensors it builds. On the free Render
// instance those tensors accumulate until Linux OOM-kills the process, and the
// dropped connection shows up in the browser as a CORS failure.
function tensorApis() {
  const apis = [];
  const add = (mod) => {
    const tf = mod && (typeof mod.engine === "function" ? mod : mod.default);
    if (!tf || typeof tf.engine !== "function") return;
    const engine = tf.engine();
    if (apis.some((api) => api.engine() === engine)) return;
    apis.push(tf);
  };

  add(requireFromHere("@tensorflow/tfjs-node"));
  try {
    const pitchEntry = requireFromHere.resolve("@spotify/basic-pitch");
    const pitchTfPath = requireFromHere.resolve("@tensorflow/tfjs", {
      paths: [pitchEntry],
    });
    add(requireFromHere(pitchTfPath));
  } catch (err) {
    console.warn("Bloxify Basic Pitch TensorFlow resolve failed:", err.message);
  }
  return apis;
}

function tensorSnapshot(apis) {
  return apis
    .map((tf) => {
      const memory = tf.memory();
      return `${memory.numTensors} tensors/${Math.round(memory.numBytes / (1024 * 1024))}MB`;
    })
    .join(" | ");
}

async function evaluateWithoutLeaking(pitch, audio) {
  const apis = tensorApis();
  const before = tensorSnapshot(apis);
  for (const tf of apis) tf.engine().startScope("bloxify");
  const frames = [];
  const onsets = [];
  const contours = [];
  try {
    await pitch.instance.evaluateModel(
      audio,
      (frameBatch, onsetBatch, contourBatch) => {
        frames.push(...frameBatch);
        onsets.push(...onsetBatch);
        contours.push(...contourBatch);
      },
      () => {}
    );
    return { frames, onsets, contours };
  } finally {
    for (let i = apis.length - 1; i >= 0; i -= 1) {
      try {
        apis[i].engine().endScope();
      } catch (err) {
        console.warn("Bloxify tensor scope cleanup failed:", err.message);
      }
    }
    const rss = Math.round(process.memoryUsage().rss / (1024 * 1024));
    console.log(`Bloxify tensors ${before} -> ${tensorSnapshot(apis)}, rss ${rss}MB`);
  }
}

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
    console.log("Bloxify TensorFlow backend:", tf.getBackend());

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
    throw new Error("Audio must be shorter than 5 minutes");
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
    `Bloxify decode/resample: ${Date.now() - decodeStartedAt}ms (${duration.toFixed(2)}s audio)`
  );
  const pitchStartedAt = Date.now();
  const pitch = await loadBasicPitch();
  const { frames, onsets, contours } = await evaluateWithoutLeaking(
    pitch,
    audioLike(samples, TARGET_RATE)
  );

  console.log(
    `Bloxify Basic Pitch inference: ${Date.now() - pitchStartedAt}ms`
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
    `Bloxify note extraction: ${Date.now() - notePostProcessStartedAt}ms (${notes.length} notes)`
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
  const analysis = summarize(notes, duration);
  const family = chooseStudiedFamily(analysis);
  const selected = programsForFamily(family);
  const soundfontRoles = selected.roles;
  const soundfontPalette = selected.fonts;
  const sampleAssets = chooseSongAssets(analysis);
  const studied = (study.songs || []).filter((song) => song.family === family.id || (family.id === "strategy" && song.family === "strategy"));
  return {
    primaryRole: "vocals",
    supportRoles: ["bass", "cello", "strings", "horn", "flute", "oboe", "clarinet", "arp", "keys", "pizz", "trumpet", "timpani"],
    drums: true,
    density: 0.62,
    swing: 0,
    quantizeGrid: 0.25,
    preserveMelody: true,
    tempoBpm: 120,
    harmonicComplexity: 0.72,
    bassPattern: "half-notes",
    chordRhythm: "phrases",
    melodyOctave: 0,
    drumPattern: "light",
    referenceUrl: REFERENCE_URL,
    referenceStyle: REFERENCE_STYLE,
    studiedInstruments: STUDIED_INSTRUMENTS,
    soundfontRoles,
    soundfontPalette,
    sampleAssets,
    soundfontCatalogSize: ROBLOX_SOUNDFONTS.length,
    programs: selected.programs,
    studiedFamily: family.id,
    studiedSongs: studied.slice(0, 8).map((song) => song.title),
    studiedCorpus: study.playlistCount,
    reason: "Studied " + study.playlistCount + " Roblox soundfont videos. This song matches the " + family.id + " bank (" + (soundfontPalette[0] && soundfontPalette[0].name) + "), using that font's real presets and " + sampleAssets.length + " WAV kit layers. Basic Pitch still supplies the heard melody.",
  };
}

// Keep Bloxify's recognizable orchestral identity consistent, while adapting
// its SoundFont roles and WAV sample layers to each upload's detected notes.
async function createBloxifyStylePlan(notes, duration, referenceUrl = REFERENCE_URL) {
  const plan = fallbackPlan(notes, duration);
  return {
    ...plan,
    referenceUrl: REFERENCE_URL,
    referenceStyle: REFERENCE_STYLE,
    soundfonts: ROBLOX_SOUNDFONTS,
    soundfontRoles: { ...plan.soundfontRoles },
    ai: true,
    fixedStyle: true,
    preBakedSoundFontCatalog: true,
    model: null,
    analysis: summarize(notes, duration),
    sampleAssets: plan.sampleAssets || [],
    webResearch: [],
  };
}

module.exports = {
  transcribeAudioBuffer,
  createBloxifyStylePlan,
  BLOXIFY_LIMITS: {
    MAX_SECONDS,
    MAX_BYTES,
  },
};
