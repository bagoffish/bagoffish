const tf = require("@tensorflow/tfjs");
const basicPitchPackage = require("@spotify/basic-pitch");
const {
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
  BasicPitch,
} = basicPitchPackage;
const brain = require("./robloxify-knowledge.json");

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
async function transcribeAudioBuffer(fileBuffer, onProgress) {
  if (!fileBuffer || !fileBuffer.length) {
    throw new Error("Empty audio file");
  }
  if (fileBuffer.length > MAX_BYTES) {
    throw new Error("Audio file too large (max 50 MB)");
  }

  const decodeAudioPackage = await import("audio-decode");
  const decodeAudio = decodeAudioPackage.default || decodeAudioPackage;
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

  // Use a conservative pass plus a more sensitive pass from the same model output.
  // The conservative pass keeps clean notes; the sensitive pass recovers quieter/shorter
  // notes that would otherwise disappear. Near-identical events are merged below.
  const primary = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.32, 0.38, 8)
    )
  );
  const sensitive = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.22, 0.30, 6)
    )
  );

  const merged = [...(primary || [])];
  const noteBuckets = new Map();
  merged.forEach(note => {
    noteBuckets.set(
      Math.round(note.startTimeSeconds / 0.045) + ":" + Math.round(note.pitchMidi),
      note
    );
  });
  (sensitive || []).forEach(note => {
    const timeBucket = Math.round(note.startTimeSeconds / 0.045);
    const pitch = Math.round(note.pitchMidi);
    let duplicate = false;
    for (let bucket = timeBucket - 1; bucket <= timeBucket + 1 && !duplicate; bucket++) {
      const existing = noteBuckets.get(bucket + ":" + pitch);
      if (
        existing &&
        Math.abs(existing.startTimeSeconds - note.startTimeSeconds) < 0.045 &&
        Math.abs(existing.durationSeconds - note.durationSeconds) < 0.12
      ) {
        duplicate = true;
      }
    }
    if (!duplicate) {
      merged.push(note);
      noteBuckets.set(timeBucket + ":" + pitch, note);
    }
  });
  merged.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);

  return {
    notes: merged,
    duration,
    sampleRate,
    noteCount: merged.length,
  };
}



function pitchClassName(pc) {
  return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][pc % 12];
}

function summarizeForStyleAI(notes, duration) {
  const clean = (notes || []).filter(n =>
    Number.isFinite(n.pitchMidi) &&
    Number.isFinite(n.startTimeSeconds) &&
    Number.isFinite(n.durationSeconds)
  );
  const pitchHistogram = Array(12).fill(0);
  const onsetGaps = [];
  let low = 0, mid = 0, high = 0, short = 0, long = 0;
  for (let i = 0; i < clean.length; i++) {
    const n = clean[i];
    pitchHistogram[((Math.round(n.pitchMidi) % 12) + 12) % 12]++;
    if (n.pitchMidi < 50) low++;
    else if (n.pitchMidi < 72) mid++;
    else high++;
    if (n.durationSeconds < 0.15) short++;
    if (n.durationSeconds > 0.7) long++;
    if (i) {
      const gap = n.startTimeSeconds - clean[i - 1].startTimeSeconds;
      if (gap >= 0.05 && gap <= 2) onsetGaps.push(gap);
    }
  }
  const sortedGaps = onsetGaps.slice().sort((a,b) => a-b);
  const medianGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
  const topPitchClasses = pitchHistogram
    .map((count, pc) => ({ pc, name: pitchClassName(pc), count }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 5);
  const clusters = new Map();
  clean.forEach(n => {
    const bucket = Math.floor(n.startTimeSeconds / 0.5);
    const c = clusters.get(bucket) || new Set();
    c.add(((Math.round(n.pitchMidi) % 12) + 12) % 12);
    clusters.set(bucket, c);
  });
  const polyphonicWindows = [...clusters.values()].filter(s => s.size >= 3).length;
  const windowCount = Math.max(1, clusters.size);
  return {
    durationSeconds: Math.round(Number(duration || 0) * 100) / 100,
    noteCount: clean.length,
    notesPerSecond: Number((clean.length / Math.max(1, duration || 1)).toFixed(3)),
    pitchRange: clean.length ? {
      min: Math.min(...clean.map(n => n.pitchMidi)),
      max: Math.max(...clean.map(n => n.pitchMidi))
    } : null,
    pitchClassHistogram: pitchHistogram,
    strongestPitchClasses: topPitchClasses,
    lowRatio: Number((low / Math.max(1, clean.length)).toFixed(3)),
    midRatio: Number((mid / Math.max(1, clean.length)).toFixed(3)),
    highRatio: Number((high / Math.max(1, clean.length)).toFixed(3)),
    shortNoteRatio: Number((short / Math.max(1, clean.length)).toFixed(3)),
    longNoteRatio: Number((long / Math.max(1, clean.length)).toFixed(3)),
    medianOnsetGapSeconds: Number(medianGap.toFixed(3)),
    polyphonicWindowRatio: Number((polyphonicWindows / windowCount).toFixed(3)),
  };
}

function fallbackStylePlan(notes, duration) {
  const s = summarizeForStyleAI(notes, duration);
  if (s.notesPerSecond > 12 && s.shortNoteRatio > 0.5) {
    return {
      primaryRole: 'vocals',
      supportRoles: ['bass','guitar','keys'], drums: true,
      density: 0.9, swing: 0, quantizeGrid: 0.125,
      preserveMelody: true, reason: 'Fallback: dense short-note performance'
    };
  }
  if (s.lowRatio > 0.45 && s.notesPerSecond < 5) {
    return {
      primaryRole: 'bass',
      supportRoles: ['keys','strings'], drums: true,
      density: 0.55, swing: 0, quantizeGrid: 0.25,
      preserveMelody: true, reason: 'Fallback: bass-heavy sparse performance'
    };
  }
  if (s.highRatio > 0.4 && s.notesPerSecond > 7) {
    return {
      primaryRole: 'vocals',
      supportRoles: ['bass','guitar','arp'], drums: true,
      density: 0.8, swing: 0, quantizeGrid: 0.125,
      preserveMelody: true, reason: 'Fallback: bright high-register performance'
    };
  }
  return {
    primaryRole: 'guitar',
    supportRoles: ['bass','keys'], drums: false,
    density: 0.6, swing: 0, quantizeGrid: 0.25,
    preserveMelody: true, reason: 'Fallback: balanced Roblox-style arrangement'
  };
}

function parseAIJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  const candidate = fenced ? fenced[1] : raw;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('AI did not return a JSON plan');
  return JSON.parse(candidate.slice(first, last + 1));
}

function sanitizeStylePlan(plan, fallback) {
  const out = { ...fallback, ...(plan || {}) };
  const validRole = role => roles.some(r => r.id === role);
  out.primaryRole = validRole(out.primaryRole) ? out.primaryRole : fallback.primaryRole;
  out.supportRoles = Array.isArray(out.supportRoles)
    ? [...new Set(out.supportRoles.filter(validRole).slice(0, 4))]
    : fallback.supportRoles;
  out.drums = !!out.drums;
  out.density = Math.max(0.25, Math.min(1, Number(out.density) || fallback.density));
  out.swing = Math.max(0, Math.min(0.35, Number(out.swing) || 0));
  out.quantizeGrid = [0.0625,0.125,0.25,0.5].includes(Number(out.quantizeGrid)) ? Number(out.quantizeGrid) : fallback.quantizeGrid;
  out.preserveMelody = out.preserveMelody !== false;
  out.tempoBpm = Math.max(70, Math.min(180, Number(out.tempoBpm) || 120));
  out.harmonicComplexity = Math.max(0, Math.min(1, Number(out.harmonicComplexity) || 0.5));
  out.bassPattern = ['root','octave','walking','pulse'].includes(out.bassPattern) ? out.bassPattern : 'root';
  out.chordRhythm = ['sustained','half','quarter','syncopated'].includes(out.chordRhythm) ? out.chordRhythm : 'half';
  out.melodyOctave = [-1,0,1].includes(Number(out.melodyOctave)) ? Number(out.melodyOctave) : 0;
  out.drumPattern = ['none','basic','four_on_floor','breakbeat'].includes(out.drumPattern) ? out.drumPattern : 'none';
  out.reason = typeof out.reason === 'string' ? out.reason.slice(0, 500) : fallback.reason;
  out.webResearch = Array.isArray(out.webResearch) ? out.webResearch.slice(0, 8).map(x => ({
    title: String(x?.title || '').slice(0, 180),
    url: String(x?.url || '').slice(0, 500),
    takeaway: String(x?.takeaway || '').slice(0, 300)
  })) : [];
  return out;
}

async function createRobloxifyStylePlan(notes, duration) {
  const fallback = fallbackStylePlan(notes, duration);
  const analysis = summarizeForStyleAI(notes, duration);
  if (!process.env.OPENAI_API_KEY) {
    return { ...fallback, ai: false, analysis, webResearch: [] };
  }

  const model = process.env.ROBLOXIFY_AI_MODEL || 'gpt-6-luna';
  const prompt = [
    'You are the persistent musical director and reference brain for Robloxify.',
    'You already have broad musical knowledge from training. In addition, use the supplied Robloxify reference library as your stable house knowledge for classic Roblox and soundfont composition.',
    'Treat the reference library as learned arrangement knowledge and combine the complete palette into one coherent original orchestral arrangement. There is no single style choice.',
    'Use the complete Roblox soundfont palette as one orchestra. Assign sound families to useful musical functions, make their influences overlap smoothly, and preserve the original song's melody, timing, contour, and recognizable structure above all else.',
    'Use web search as optional fresh research and corroboration, not as the only source of musical knowledge.',
    'Study broad traits such as instrumentation, register, density, groove, melodic phrasing, chord movement, drum habits, arrangement structure, and soundfont choices.',
    'Do NOT copy a specific song, melody, lyric, chord progression, or distinctive rhythmic phrase. Produce an original style-level plan.',
    'Then study the supplied transcription statistics and decide how to turn THAT exact performance into a convincing Roblox-soundfont arrangement.',
    JSON.stringify({ stableReferenceLibrary: brain }),
    'Return JSON only. Do not write prose outside the JSON.',
    JSON.stringify({
      task: 'Create an original Roblox-soundfont arrangement plan',
      palette: 'complete Roblox soundfont library',
      analysis,
      outputSchema: {
        primaryRole: 'bass|guitar|vocals|keys|pad|strings|arp',
        supportRoles: ['up to four roles'],
        drums: true,
        density: '0.25 to 1',
        swing: '0 to 0.35',
        quantizeGrid: '0.0625|0.125|0.25|0.5',
        preserveMelody: true,
        tempoBpm: '70 to 180',
        harmonicComplexity: '0 to 1',
        bassPattern: 'root|octave|walking|pulse',
        chordRhythm: 'sustained|half|quarter|syncopated',
        melodyOctave: '-1|0|1',
        drumPattern: 'none|basic|four_on_floor|breakbeat',
        reason: 'short explanation',
        webResearch: [{ title: 'source title', url: 'source url', takeaway: 'style takeaway' }]
      }
    })
  ].join('\n\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model,
        tools: [{ type: 'web_search' }],
        input: prompt,
        max_output_tokens: 1400
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || 'OpenAI planning request failed');
    }
    const text = data.output_text || (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('');
    const plan = sanitizeStylePlan(parseAIJson(text), fallback);
    return { ...plan, ai: true, model, analysis };
  } catch (error) {
    console.warn('Robloxify AI planner unavailable:', error.message);
    return { ...fallback, ai: false, aiError: error.message, analysis, webResearch: [] };
  }
}
const ROBLOXIFY_LIMITS = { MAX_SECONDS, MAX_BYTES };

module.exports = { transcribeAudioBuffer, createRobloxifyStylePlan, ROBLOXIFY_LIMITS };
