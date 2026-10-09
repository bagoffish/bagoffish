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

const ROBLOX_SOUNDFONTS = [
  {
    "id": "stealth-drums",
    "name": "StealthPilot MIDI Drums",
    "url": "/audios/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/StealthPilot_MIDI_DRUMS_ONLY.sf2",
    "bankOffset": 1
  },
  {
    "id": "strategy-midi",
    "name": "The Great Strategy MIDI",
    "url": "/audios/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/The_Great_Strategy_MIDI.sf2",
    "bankOffset": 2
  },
  {
    "id": "fjords-midi",
    "name": "Wind of Fjords MIDI",
    "url": "/audios/soundfonts/Instruments/MIDI%20Compatible%20Soundfonts/Wind_of_Fjords_MIDI.sf2",
    "bankOffset": 3
  },
  {
    "id": "aqua-mod",
    "name": "AquaDoesStuff Modified",
    "url": "/audios/soundfonts/Instruments/Other%20People/AquaDoesStuff%20-%20Modified.sf2",
    "bankOffset": 4
  },
  {
    "id": "roblox-other",
    "name": "Roblox Soundfont",
    "url": "/audios/soundfonts/Instruments/Other%20People/Roblox%20Soundfont.sf2",
    "bankOffset": 5
  },
  {
    "id": "beastmasters",
    "name": "Beastmasters Tale",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Beastmasters%20Tale.sf2",
    "bankOffset": 6
  },
  {
    "id": "clan-raided",
    "name": "Clan Being Raided",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Clan%20Being%20Raided.sf2",
    "bankOffset": 7
  },
  {
    "id": "classic-days",
    "name": "Classic Days",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Classic%20Days.sf2",
    "bankOffset": 8
  },
  {
    "id": "crossroad",
    "name": "Crossroad Times",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Crossroad%20Times.sf2",
    "bankOffset": 9
  },
  {
    "id": "dance-potion",
    "name": "Dance Potion",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Dance%20Potion.sf2",
    "bankOffset": 10
  },
  {
    "id": "death-sounds",
    "name": "Death Sounds",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Death%20Sounds.sf2",
    "bankOffset": 11
  },
  {
    "id": "explore-roblox",
    "name": "Explore Roblox",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Explore%20Roblox.sf2",
    "bankOffset": 12
  },
  {
    "id": "gamehero",
    "name": "GameHero",
    "url": "/audios/soundfonts/Instruments/Soundfonts/GameHero%20Soundfont.sf2",
    "bankOffset": 13
  },
  {
    "id": "monster-mash",
    "name": "Monster Mash",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Monster%20Mash.sf2",
    "bankOffset": 14
  },
  {
    "id": "noob-alert",
    "name": "Noob Alert",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Noob%20Alert.sf2",
    "bankOffset": 15
  },
  {
    "id": "party-music",
    "name": "Party Music",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Party%20Music.sf2",
    "bankOffset": 16
  },
  {
    "id": "roblox-horror",
    "name": "Roblox Horror",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Roblox%20Horror.sf2",
    "bankOffset": 17
  },
  {
    "id": "roblox-old",
    "name": "Roblox Old Sounds",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Roblox%20Old%20Sounds.sf2",
    "bankOffset": 18
  },
  {
    "id": "stealth-v2",
    "name": "StealthPilot v2",
    "url": "/audios/soundfonts/Instruments/Soundfonts/StealthPilot%20v2.sf2",
    "bankOffset": 19
  },
  {
    "id": "stealth",
    "name": "StealthPilot",
    "url": "/audios/soundfonts/Instruments/Soundfonts/StealthPilot.sf2",
    "bankOffset": 20
  },
  {
    "id": "strategy",
    "name": "The Great Strategy",
    "url": "/audios/soundfonts/Instruments/Soundfonts/The%20Great%20Strategy.sf2",
    "bankOffset": 21
  },
  {
    "id": "training-day",
    "name": "Training Day",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Training%20Day.sf2",
    "bankOffset": 22
  },
  {
    "id": "trouble-ahead",
    "name": "Trouble Ahead",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Trouble%20Ahead.sf2",
    "bankOffset": 23
  },
  {
    "id": "waapp",
    "name": "WAAPP Whistle",
    "url": "/audios/soundfonts/Instruments/Soundfonts/WAAPP%20Whistle.sf2",
    "bankOffset": 24
  },
  {
    "id": "wiley-bricks",
    "name": "Wiley Metal Bricks",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Wiley,%20Metal%20Bricks.sf2",
    "bankOffset": 25
  },
  {
    "id": "fjords-voyage",
    "name": "Wind of Fjords + Voyage to Eternity",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Wind%20of%20Fjords%20%2B%20Voyage%20to%20Eternity%20(They%20share%20same%20Instruments).sf2",
    "bankOffset": 26
  },
  {
    "id": "fjords-hq",
    "name": "Wind of Fjords HQ",
    "url": "/audios/soundfonts/Instruments/Soundfonts/Wind%20of%20fjords%20HQ.sf2",
    "bankOffset": 27
  },
  {
    "id": "nokia",
    "name": "Nokia Tongbao Bank",
    "url": "/audios/soundfonts/Instruments/WorkingR-Blox/Nokia_Tongbao_Bank.sf2",
    "bankOffset": 28
  },
  {
    "id": "roblox-1",
    "name": "Roblox Soundfont 1",
    "url": "/audios/soundfonts/Instruments/WorkingR-Blox/Roblox%20Soundfont-1.sf2",
    "bankOffset": 29
  },
  {
    "id": "fjords",
    "name": "Wind of Fjords v2.5.1a",
    "url": "/audios/soundfonts/Instruments/WorkingR-Blox/Wind_Of_Fjords_V2.5.1a/WindOfFjordsV2.5.1a.sf2",
    "bankOffset": 30
  },
  {
    "id": "general-user",
    "name": "GeneralUser GS Orchestra",
    "url": "/audios/soundfonts/Orchestra/GeneralUser-GS.sf2",
    "bankOffset": 31
  }
];

const SOUND_FONT_BY_ROLE = {
  drums: "stealth-drums",
  bass: "fjords",
  cello: "fjords",
  vocals: "roblox-1",
  strings: "general-user",
  horn: "general-user",
  flute: "general-user",
  oboe: "general-user",
  clarinet: "general-user",
  arp: "general-user",
  keys: "general-user",
  pizz: "general-user",
  trumpet: "general-user",
  timpani: "general-user",
  guitar: "gamehero",
  pad: "fjords-midi",
};

const STUDIED_INSTRUMENTS = [
  { role: "vocals", name: "Violin", program: 40, bank: "roblox-1" },
  { role: "bass", name: "Contrabass", program: 43, bank: "fjords" },
  { role: "cello", name: "Cello", program: 42, bank: "fjords" },
  { role: "strings", name: "String ensemble", program: 48, bank: "general-user" },
  { role: "horn", name: "French horn", program: 60, bank: "general-user" },
  { role: "flute", name: "Flute", program: 73, bank: "general-user" },
  { role: "oboe", name: "Oboe", program: 68, bank: "general-user" },
  { role: "clarinet", name: "Clarinet", program: 71, bank: "general-user" },
  { role: "arp", name: "Orchestral harp", program: 46, bank: "general-user" },
  { role: "keys", name: "Piano", program: 0, bank: "general-user" },
  { role: "pizz", name: "Pizzicato strings", program: 45, bank: "general-user" },
  { role: "trumpet", name: "Trumpet", program: 56, bank: "general-user" },
  { role: "timpani", name: "Timpani", program: 47, bank: "general-user" },
  { role: "drums", name: "Kit", program: 0, bank: "stealth-drums" },
];

function choosePrebakedSoundfontPalette(analysis) {
  // Select a compact, coherent bank palette from the full catalog using detected
  // pitch range, note density, and sustain. Only selected banks are downloaded.
  const a = analysis || {};
  const dense = Number(a.notesPerSecond || 0) > 4.5 || Number(a.shortNoteRatio || 0) > 0.48;
  const lowHeavy = Number(a.lowRatio || 0) > 0.28;
  const sustained = Number(a.longNoteRatio || 0) > 0.28;
  const bright = Number(a.highRatio || 0) > 0.38;
  const ids = [
    "stealth-drums", lowHeavy ? "fjords" : "beastmasters",
    bright ? "gamehero" : "roblox-1",
    sustained ? "fjords-hq" : "classic-days",
    dense ? "nokia" : "fjords-midi",
    dense ? "dance-potion" : "roblox-old",
    bright ? "waapp" : "explore-roblox", "strategy", "general-user",
  ];
  return [...new Set(ids)].map((id) => ROBLOX_SOUNDFONTS.find((font) => font.id === id)).filter(Boolean);
}

function chooseSongAssets(analysis) {
  const a = analysis || {};
  const dense = Number(a.notesPerSecond || 0) > 4.5 || Number(a.shortNoteRatio || 0) > 0.48;
  const horror = Number(a.lowRatio || 0) > 0.4 && Number(a.longNoteRatio || 0) > 0.25;
  const assets = [
    { id: "kick", url: "/audios/WAV/MULE/Kick.wav", role: "kick", gain: 0.36 },
    { id: "snare", url: "/audios/WAV/MULE/Snare.wav", role: "snare", gain: 0.23 },
  ];
  if (dense) assets.push({ id: "closed-hat", url: "/audios/WAV/MULE/Closed%20Hat.wav", role: "hat", gain: 0.09 });
  if (Number(a.highRatio || 0) > 0.22) assets.push({ id: "crash", url: "/audios/WAV/MULE/Crash.wav", role: "crash", gain: 0.12 });
  if (horror) assets.push({ id: "impact", url: "/audios/WAV/MULE/Impact.wav", role: "accent", gain: 0.10 });
  return assets;
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
  const palette = choosePrebakedSoundfontPalette(analysis);
  const soundfontRoles = {
    drums: "stealth-drums",
    bass: analysis.lowRatio > 0.28 ? "fjords" : "beastmasters",
    cello: analysis.longNoteRatio > 0.25 ? "fjords-hq" : "fjords",
    vocals: analysis.highRatio > 0.38 ? "gamehero" : "roblox-1",
    strings: analysis.longNoteRatio > 0.28 ? "fjords-hq" : "classic-days",
    horn: "strategy",
    flute: analysis.highRatio > 0.22 ? "waapp" : "explore-roblox",
    oboe: "explore-roblox",
    clarinet: "roblox-old",
    arp: analysis.notesPerSecond > 4.5 ? "nokia" : "fjords-midi",
    keys: "classic-days",
    pizz: analysis.shortNoteRatio > 0.4 ? "dance-potion" : "crossroad",
    trumpet: "crossroad",
    timpani: "stealth-v2",
    guitar: "gamehero",
    pad: "fjords-midi",
  };
  const soundfontPalette = [...new Set([...Object.values(soundfontRoles), ...palette.map((font) => font.id)])]
    .map((id) => ROBLOX_SOUNDFONTS.find((font) => font.id === id)).filter(Boolean);
  const sampleAssets = chooseSongAssets(analysis);
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
    reason: "Bloxify selected " + soundfontPalette.length + " SoundFonts and " + sampleAssets.length + " WAV layers from public/audios using note density, pitch range, and sustain analysis. Violin-led Roblox orchestra with bass, cello, winds, harp, piano, pizzicato, trumpet, timpani, and a restrained sampled kit.",
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
