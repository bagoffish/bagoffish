// Prebaked classic-Roblox orchestra. Basic Pitch supplies the notes that were
// actually in the recording. The violin follows that tune. Bass, cello, and
// the GeneralUser section (strings, horn, flute, oboe, clarinet, harp, piano,
// pizzicato, trumpet, timpani) answer it in phrases, with rests, instead of
// one machine-gun loop. A third is used only when it was heard. The
// arrangement runs to the end of the audio, up to 5 minutes.

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_TRIADS = [
  { degree: 0, minor: false },
  { degree: 2, minor: true },
  { degree: 4, minor: true },
  { degree: 5, minor: false },
  { degree: 7, minor: false },
  { degree: 9, minor: true },
];
const MINOR_TRIADS = [
  { degree: 0, minor: true },
  { degree: 3, minor: false },
  { degree: 5, minor: true },
  { degree: 7, minor: false },
  { degree: 8, minor: false },
  { degree: 10, minor: false },
];

function clampMidi(value) {
  return Math.max(24, Math.min(108, Math.round(value)));
}

function pushNote(target, role, pitchMidi, startTimeSeconds, durationSeconds, amplitude) {
  if (!Number.isFinite(startTimeSeconds) || !Number.isFinite(durationSeconds) || durationSeconds < 0.08) return;
  if (!Number.isFinite(pitchMidi)) return;
  target.push({
    id: 0,
    role,
    pitchMidi: clampMidi(pitchMidi),
    startTimeSeconds: Math.max(0, startTimeSeconds),
    durationSeconds,
    amplitude: Math.max(0.08, Math.min(0.92, amplitude)),
  });
}

function estimateBeatSeconds(notes) {
  const starts = notes.map(note => note.startTimeSeconds).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1];
    if (gap >= 0.18 && gap <= 1.05) gaps.push(gap);
  }
  if (gaps.length < 4) return 0.5;
  gaps.sort((a, b) => a - b);
  let beat = gaps[Math.floor(gaps.length / 2)];
  while (beat < 0.32) beat *= 2;
  while (beat > 0.78) beat *= 0.5;
  return beat;
}

function leadShift(melody) {
  if (!melody.length) return 0;
  const sorted = melody.map(note => note.pitchMidi).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let shift = 0;
  while (median + shift < 60) shift += 12;
  while (median + shift > 79) shift -= 12;
  return shift;
}

function placeBass(pitch) {
  let placed = Math.round(pitch);
  while (placed > 46) placed -= 12;
  while (placed < 33) placed += 12;
  return placed;
}

function pitchClassWeights(notes, start, end) {
  const weights = Array(12).fill(0);
  notes.forEach(note => {
    const noteEnd = note.startTimeSeconds + note.durationSeconds;
    const overlap = Math.min(end, noteEnd) - Math.max(start, note.startTimeSeconds);
    if (overlap <= 0.02) return;
    const pc = ((note.pitchMidi % 12) + 12) % 12;
    weights[pc] += overlap * (note.amplitude || 0.7);
  });
  return weights;
}

function scaleFor(minor) {
  return minor ? MINOR_SCALE : MAJOR_SCALE;
}

function inferKey(notes) {
  const weights = pitchClassWeights(notes, 0, 1e9);
  let best = { rootPc: 0, minor: false, score: -1e9 };
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    [false, true].forEach(minor => {
      const scale = new Set(scaleFor(minor).map(interval => (rootPc + interval) % 12));
      let score = 0;
      for (let pc = 0; pc < 12; pc++) {
        const rel = (pc - rootPc + 12) % 12;
        if (!scale.has(pc)) score -= weights[pc] * 0.85;
        else if (rel === 0) score += weights[pc] * 1.45;
        else if (rel === 7) score += weights[pc] * 1.15;
        else score += weights[pc];
      }
      if (score > best.score) best = { rootPc, minor, score };
    });
  }
  return best;
}

function triadFit(rootPc, minor, weights) {
  const third = minor ? 3 : 4;
  let heard = 0;
  let penalty = 0;
  for (let pc = 0; pc < 12; pc++) {
    const weight = weights[pc];
    if (weight <= 0) continue;
    const rel = (pc - rootPc + 12) % 12;
    if (rel === 0) heard += weight * 1.35;
    else if (rel === third) heard += weight * 1.2;
    else if (rel === 7) heard += weight * 1.05;
    else if (rel === 2 || rel === 5 || rel === 10 || rel === 11) heard += weight * 0.2;
    else penalty += weight * 0.7;
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;
  return (heard - penalty) / total;
}

function nearestPitch(pc, low, high, target) {
  const want = ((pc % 12) + 12) % 12;
  let best = null;
  let bestDist = 1e9;
  for (let pitch = low; pitch <= high; pitch++) {
    if (((pitch % 12) + 12) % 12 !== want) continue;
    const dist = Math.abs(pitch - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = pitch;
    }
  }
  return best;
}

function intervalClass(a, b) {
  const rel = Math.abs(a - b) % 12;
  return Math.min(rel, 12 - rel);
}

function isHarmonicOf(high, low) {
  const diff = Math.round(high.pitchMidi) - Math.round(low.pitchMidi);
  return (diff === 12 || diff === 19 || diff === 24) &&
    Math.abs(high.startTimeSeconds - low.startTimeSeconds) <= 0.05 &&
    (high.amplitude || 0) <= (low.amplitude || 0) * 0.92;
}

function cleanSource(notes) {
  const sorted = notes.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const kept = [];
  sorted.forEach(note => {
    if (note.durationSeconds < 0.06) return;
    if ((note.amplitude || 0) < 0.16 && note.durationSeconds < 0.14) return;
    if (note.pitchMidi >= 96 && (note.amplitude || 0) < 0.55) return;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (isHarmonicOf(note, kept[i])) return;
      if (isHarmonicOf(kept[i], note)) kept.splice(i, 1);
    }
    kept.push(note);
  });
  return kept;
}

function clusterNotes(notes, windowSeconds) {
  const sorted = notes.slice().sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const clusters = [];
  sorted.forEach(note => {
    const last = clusters[clusters.length - 1];
    if (!last || note.startTimeSeconds - last.time > windowSeconds) clusters.push({ time: note.startTimeSeconds, notes: [note] });
    else last.notes.push(note);
  });
  return clusters;
}

function smoothMelody(melody) {
  return melody.filter((note, index) => {
    if (note.durationSeconds >= 0.18) return true;
    const prev = melody[index - 1];
    const next = melody[index + 1];
    if (!prev || !next) return true;
    const leapIn = Math.abs(note.pitchMidi - prev.pitchMidi);
    const leapOut = Math.abs(next.pitchMidi - note.pitchMidi);
    const direct = Math.abs(next.pitchMidi - prev.pitchMidi);
    return !(leapIn >= 7 && leapOut >= 7 && direct <= 2);
  });
}

function scoreMelodyNote(note, cluster, prevPitch, prevTime) {
  let score = (note.amplitude || 0.5) * 2.4 + Math.min(note.durationSeconds, 0.9) * 0.75;
  const pitch = note.pitchMidi;
  if (pitch >= 62 && pitch <= 81) score += 0.75;
  else if (pitch >= 57 && pitch <= 88) score += 0.25;
  else if (pitch > 88) score -= 0.9;
  if (prevPitch != null) {
    const leap = Math.abs(pitch - prevPitch);
    const gap = note.startTimeSeconds - prevTime;
    const phraseBreak = gap > 1.05;
    if (!phraseBreak) {
      if (leap === 0) score += 0.5;
      else if (leap <= 2) score += 0.6;
      else if (leap <= 5) score += 0.22;
      else if (leap <= 7) score -= 0.05;
      else if (leap === 12) score -= 0.4;
      else score -= 0.3 * (leap - 7);
    } else if (leap <= 9) score += 0.15;
  }
  const strongerBelow = cluster.notes.some(other =>
    other !== note &&
    other.pitchMidi <= pitch - 3 &&
    other.pitchMidi >= 52 &&
    (other.amplitude || 0) >= (note.amplitude || 0) * 0.8 &&
    other.durationSeconds + 0.02 >= note.durationSeconds
  );
  if (strongerBelow && note.durationSeconds < 0.24) score -= 1.15;
  return score;
}

function extractMelody(notes) {
  const clusters = clusterNotes(notes, 0.06);
  const pick = floor => {
    const melody = [];
    let prevPitch = null;
    let prevTime = null;
    clusters.forEach(cluster => {
      const options = cluster.notes.filter(note => note.pitchMidi >= floor && note.pitchMidi <= 93 && note.durationSeconds >= 0.07);
      if (!options.length) return;
      let best = null;
      let bestScore = -1e9;
      options.forEach(note => {
        const score = scoreMelodyNote(note, cluster, prevPitch, prevTime);
        if (score > bestScore) {
          bestScore = score;
          best = note;
        }
      });
      if (!best) return;
      if (prevPitch != null && prevTime != null && Math.abs(best.pitchMidi - prevPitch) > 12 && best.durationSeconds < 0.1 && (best.amplitude || 0) < 0.4 && best.startTimeSeconds - prevTime < 0.35) return;
      melody.push(best);
      prevPitch = best.pitchMidi;
      prevTime = best.startTimeSeconds;
    });
    return smoothMelody(melody);
  };
  const sung = pick(57);
  if (sung.length >= 4 || sung.length >= clusters.length) return sung;
  const wider = pick(48);
  return wider.length > sung.length ? wider : sung;
}

function findDownbeat(notes, beat) {
  const bar = beat * 4;
  if (!notes.length) return 0;
  let bestPhase = 0;
  let bestScore = -1;
  const steps = 16;
  for (let step = 0; step < steps; step++) {
    const phase = (step / steps) * bar;
    let score = 0;
    notes.forEach(note => {
      const pos = ((note.startTimeSeconds - phase) % bar + bar) % bar;
      const weight = (note.amplitude || 0.5) * Math.min(1.3, 0.35 + note.durationSeconds);
      const dist = Math.min(pos, bar - pos);
      if (dist <= beat * 0.28) score += weight * (1.15 - dist / Math.max(0.05, beat * 0.28));
      else if (Math.abs(pos - beat * 2) <= beat * 0.2) score += weight * 0.22;
    });
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}

function heardClasses(weights) {
  const ranked = [];
  for (let pc = 0; pc < 12; pc++) if (weights[pc] > 0) ranked.push({ pc, w: weights[pc] });
  ranked.sort((a, b) => b.w - a.w);
  if (!ranked.length) return [];
  const cutoff = ranked[0].w * 0.42;
  const pool = ranked.filter(item => item.w >= cutoff).slice(0, 6);
  const chosen = [];
  pool.forEach(item => {
    const ok = chosen.every(pc => {
      const rel = intervalClass(item.pc, pc);
      return rel === 0 || rel === 3 || rel === 4 || rel === 5 || rel === 7;
    });
    if (ok && chosen.length < 3) chosen.push(item.pc);
  });
  return addSafeFifth(chosen);
}

function addSafeFifth(pcs) {
  if (!pcs.length || pcs.length >= 3) return pcs.slice(0, 3);
  const fifth = (pcs[0] + 7) % 12;
  if (pcs.indexOf(fifth) !== -1) return pcs;
  const safe = pcs.every(pc => {
    const rel = intervalClass(fifth, pc);
    return rel === 0 || rel >= 3;
  });
  return safe ? pcs.concat(fifth) : pcs;
}

function fallbackClasses(melody, start, stop, key) {
  const weights = pitchClassWeights(melody, start, stop);
  const triads = key.minor ? MINOR_TRIADS : MAJOR_TRIADS;
  let best = null;
  triads.forEach(triad => {
    const rootPc = (key.rootPc + triad.degree) % 12;
    const score = triadFit(rootPc, triad.minor, weights);
    if (!best || score > best.score) best = { rootPc, minor: triad.minor, score };
  });
  if (!best) return addSafeFifth([key.rootPc]);
  const pcs = [best.rootPc];
  const third = (best.rootPc + (best.minor ? 3 : 4)) % 12;
  if (weights[third] > 0) pcs.push(third);
  return addSafeFifth(pcs);
}

function sameChord(a, b) {
  if (!a || !b || !a.length || !b.length || a.length !== b.length) return false;
  const other = new Set(b);
  return a.every(pc => other.has(pc));
}

function voiceChord(pcs, low, high, previous) {
  const target = previous && previous.length ? previous : [Math.round((low + high) / 2)];
  const voices = [];
  pcs.forEach((pc, index) => {
    const aim = target[Math.min(index, target.length - 1)];
    const pitch = nearestPitch(pc, low, high, aim);
    if (pitch == null || voices.indexOf(pitch) !== -1) return;
    voices.push(pitch);
  });
  const sorted = voices.sort((a, b) => a - b);
  const spaced = [];
  sorted.forEach(pitch => {
    if (spaced.some(other => Math.abs(other - pitch) > 0 && Math.abs(other - pitch) < 3)) return;
    spaced.push(pitch);
  });
  return spaced;
}

function buildHarmonySegments(melody, harmonyNotes, gridOrigin, end, beat, key) {
  const bar = beat * 4;
  let cursor = gridOrigin;
  while (cursor > 0.03) cursor -= bar;
  const bars = [];
  for (let start = cursor; start < end - beat * 0.4; start += bar) {
    const from = Math.max(0, start);
    const to = Math.min(end, start + bar);
    if (to - from < beat * 0.35) continue;
    const weights = pitchClassWeights(harmonyNotes, from, to);
    const heard = heardClasses(weights);
    const pcs = heard.length >= 2 ? heard : fallbackClasses(melody, from, to, key);
    bars.push({ start: from, end: to, pcs });
  }
  const segments = [];
  for (let index = 0; index < bars.length; index += 2) {
    const left = bars[index];
    const right = bars[index + 1];
    if (!right || sameChord(left.pcs, right.pcs)) {
      segments.push({
        start: left.start,
        end: right ? right.end : left.end,
        pcs: left.pcs,
      });
    } else {
      segments.push(left);
      segments.push(right);
    }
  }
  if (!segments.length) {
    segments.push({ start: 0, end, pcs: addSafeFifth([key.rootPc]) });
  }
  segments[0].start = 0;
  segments[segments.length - 1].end = end;
  return segments;
}

function gameBeat(notes) {
  let beat = estimateBeatSeconds(notes);
  const target = 0.47;
  if (beat > 0.55) {
    const doubled = beat / 2;
    if (doubled >= 0.34 && Math.abs(doubled - target) < Math.abs(beat - target)) beat = doubled;
  }
  return Math.max(0.34, Math.min(0.62, beat));
}

function lockToGrid(time, origin, step) {
  const snapped = origin + Math.round((time - origin) / step) * step;
  return Math.max(0, snapped);
}

function scalePitch(pitch, key, low, high) {
  const scale = new Set(scaleFor(key.minor).map(interval => (key.rootPc + interval) % 12));
  let best = null;
  let bestDist = 99;
  const floor = Math.max(0, low);
  const ceil = Math.min(108, high);
  for (let candidate = floor; candidate <= ceil; candidate++) {
    if (!scale.has(((candidate % 12) + 12) % 12)) continue;
    const dist = Math.abs(candidate - pitch);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best == null ? clampMidi(pitch) : best;
}

function feel(base, phrase, slot) {
  // Deterministic, phrase-aware velocity shaping: stable across re-renders,
  // but not every note lands at the same intensity like a quantized demo MIDI.
  const seed = (phrase * 17 + slot * 11 + (phrase % 3) * 7) % 13;
  const variation = (seed - 6) * 0.012;
  const downbeat = slot % 4 === 0 ? 0.045 : 0;
  const phraseLift = phrase === 0 || phrase === 4 ? 0.025 : 0;
  const breath = phrase === 3 ? -0.08 : 0;
  return Math.max(0.1, Math.min(0.82, base + variation + downbeat + phraseLift + breath));
}

export function buildRobloxArrangement(rawNotes, duration) {
  // Keep the transcription recognizable: use detected notes and timing, not
  // guessed chord progressions, transposed melody notes, or a fixed drum loop.
  const source = (rawNotes || []).filter(note =>
    Number.isFinite(note.startTimeSeconds) &&
    Number.isFinite(note.durationSeconds) &&
    Number.isFinite(note.pitchMidi) &&
    note.durationSeconds >= 0.055 &&
    note.pitchMidi >= 0 && note.pitchMidi <= 127 &&
    note.startTimeSeconds >= 0 &&
    note.startTimeSeconds < Math.min(300, Number(duration) || 300)
  );
  if (!source.length) return [];
  const cleaned = cleanSource(source);
  const notes = (cleaned.length ? cleaned : source).slice()
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
  const end = Math.min(300, Number(duration) > 0 ? Number(duration) : notes.reduce((m, n) => Math.max(m, n.startTimeSeconds + n.durationSeconds), 0));
  const clusters = [];
  notes.forEach(note => {
    let cluster = clusters[clusters.length - 1];
    if (!cluster || note.startTimeSeconds - cluster.start > 0.045) {
      cluster = { start: note.startTimeSeconds, notes: [] };
      clusters.push(cluster);
    }
    cluster.notes.push(note);
  });
  const out = [];
  clusters.forEach(cluster => {
    const sorted = cluster.notes.slice().sort((a, b) =>
      (Number(b.amplitude) || 0) - (Number(a.amplitude) || 0) || b.pitchMidi - a.pitchMidi
    );
    sorted.forEach((note, index) => {
      const startTime = Math.max(0, note.startTimeSeconds);
      if (startTime >= end) return;
      const length = Math.max(0.045, Math.min(note.durationSeconds, end - startTime));
      let role = 'vocals';
      let velocityScale = 1;
      if (index > 0) {
        if (note.pitchMidi < 48) { role = 'bass'; velocityScale = 0.78; }
        else if (note.pitchMidi < 64) { role = 'cello'; velocityScale = 0.62; }
        else { role = 'strings'; velocityScale = 0.56; }
      }
      const amplitude = Math.max(0.12, Math.min(0.88, (Number(note.amplitude) || 0.62) * velocityScale));
      pushNote(out, role, note.pitchMidi, startTime, length, amplitude);
    });
  });
  const result = [];
  const lastByPitchRole = new Map();
  out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi).forEach(note => {
    const key = note.role + ':' + note.pitchMidi;
    const previous = lastByPitchRole.get(key);
    if (previous && Math.abs(previous.startTimeSeconds - note.startTimeSeconds) < 0.025 &&
        Math.abs(previous.durationSeconds - note.durationSeconds) < 0.06) return;
    result.push(note);
    lastByPitchRole.set(key, note);
  });
  return result;
}

export function orchestraProgramsFor(notes) {
  const leads = (notes || []).filter(note => note.role === 'vocals');
  const beat = estimateBeatSeconds(leads.length > 3 ? leads : (notes || []).filter(note => note.role !== 'drums' && note.role !== 'timpani'));
  return {
    drums: 0,
    bass: 43,
    guitar: 42,
    vocals: 40,
    keys: 0,
    pad: 60,
    strings: beat < 0.4 ? 49 : 48,
    arp: 46,
    cello: 42,
    horn: 60,
    flute: 73,
    oboe: 68,
    clarinet: 71,
    timpani: 47,
    pizz: 45,
    trumpet: 56,
  };
}
