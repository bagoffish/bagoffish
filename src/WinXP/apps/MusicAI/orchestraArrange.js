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
  const wobble = ((phrase * 5 + slot * 3) % 5) * 0.012;
  return Math.max(0.12, base + wobble - 0.015);
}

export function buildRobloxArrangement(rawNotes, duration) {
  const source = (rawNotes || []).filter(note =>
    Number.isFinite(note.startTimeSeconds) &&
    Number.isFinite(note.durationSeconds) &&
    Number.isFinite(note.pitchMidi) &&
    note.durationSeconds >= 0.04 &&
    note.pitchMidi >= 0 &&
    note.pitchMidi <= 127
  );
  if (!source.length) return [];
  const cleaned = cleanSource(source);
  if (!cleaned.length) return [];
  const melody = extractMelody(cleaned);
  const harmonyNotes = cleaned.filter(note => note.pitchMidi >= 40 && note.pitchMidi <= 86);
  const beat = gameBeat(melody.length > 3 ? melody : cleaned);
  const detectedEnd = cleaned.reduce((max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds), 0);
  const fileEnd = Number(duration) || 0;
  // 5 minutes is 300 seconds. The band plays through the whole file, not
  // only up to the last pitched note.
  const end = Math.min(300, Math.max(detectedEnd, fileEnd > 0 ? fileEnd : detectedEnd));
  const accentNotes = melody.length ? melody : cleaned;
  const phase = findDownbeat(accentNotes, beat);
  const bar = beat * 4;
  const key = inferKey(melody.length ? melody : cleaned);
  const segments = buildHarmonySegments(melody, harmonyNotes, phase, end, beat, key);
  const eighth = beat / 2;
  const sixteenth = beat / 4;
  const out = [];
  const gridLead = [];
  const shift = leadShift(melody);

  melody.forEach(note => {
    if (note.startTimeSeconds >= end - 0.05) return;
    const start = lockToGrid(note.startTimeSeconds, phase, sixteenth);
    const prev = gridLead[gridLead.length - 1];
    const pitch = clampMidi(note.pitchMidi + shift);
    if (prev && Math.abs(prev.start - start) < sixteenth * 0.45) {
      if ((note.amplitude || 0) >= (prev.amplitude || 0)) {
        prev.pitch = pitch;
        prev.amplitude = note.amplitude || prev.amplitude;
      }
      return;
    }
    gridLead.push({
      start,
      pitch,
      amplitude: note.amplitude || 0.7,
    });
  });
  gridLead.forEach((note, index) => {
    const next = gridLead[index + 1];
    let length = beat * 1.5;
    if (next && next.start > note.start) length = Math.min(beat * 2, Math.max(sixteenth, next.start - note.start - 0.02));
    else length = Math.min(length, Math.max(sixteenth, end - note.start));
    pushNote(out, 'vocals', note.pitch, note.start, length, Math.max(0.78, Math.min(0.92, 0.72 + (note.amplitude || 0.7) * 0.16)));
  });

  function pcsAt(time) {
    const segment = segments.find(item => time >= item.start - 0.02 && time < item.end - 0.01);
    const pcs = segment && segment.pcs.length ? segment.pcs : [key.rootPc];
    return pcs.slice(0, 3);
  }

  function leadIn(at) {
    return gridLead.filter(note => note.start >= at - 0.02 && note.start < at + bar - 0.01);
  }

  function doublesLead(pitch, at) {
    return gridLead.some(note => note.pitch === pitch && Math.abs(note.start - at) < beat * 0.4);
  }

  function hold(role, pitch, at, length, amplitude) {
    if (pitch == null || at >= end - 0.05) return;
    const dur = Math.min(length, end - at);
    if (dur < 0.08) return;
    pushNote(out, role, pitch, at, dur, amplitude);
  }

  function sectionColor(phrase, leadCount) {
    if (phrase === 3) return 'none';
    if (leadCount <= 0) return phrase === 0 || phrase === 4 ? 'horn' : 'none';
    if (phrase === 7) return 'trumpet';
    if (phrase === 0) return 'horn';
    if (phrase === 4) return 'flute';
    if (phrase === 1) return 'oboe';
    if (phrase === 5) return 'clarinet';
    if (phrase === 2) return 'harp';
    if (phrase === 6) return 'piano';
    return 'none';
  }

  let barStart = phase;
  while (barStart - bar > -0.03) barStart -= bar;
  for (let start = barStart; start < end - beat * 0.35; start += bar) {
    if (start + bar <= phase + beat * 0.2) continue;
    const at = Math.max(0, start);
    if (at >= end - beat * 0.35) break;
    const drumBar = Math.floor((at - phase + 0.001) / bar);
    const phrase = ((drumBar % 8) + 8) % 8;
    const pcs = pcsAt(at + eighth);
    const root = pcs[0];
    const shape = pcs.length >= 2 ? pcs : pcs.concat([(root + 7) % 12]);
    const here = leadIn(at);
    const leadCount = here.length;
    const color = sectionColor(phrase, leadCount);
    const sparse = leadCount <= 1;
    const rootPitch = scalePitch(placeBass(36 + (((root % 12) + 12) % 12)), key, 33, 43);
    const fifthPitch = scalePitch(rootPitch + 7, key, 33, 48);
    const nextRoot = scalePitch(placeBass(36 + pcsAt(at + bar + eighth)[0]), key, 33, 43);

    if (phrase === 3 || sparse) {
      hold('bass', rootPitch, at + 0.02, bar * 0.9, feel(0.5, phrase, 0));
    } else if (phrase === 0 || phrase === 4) {
      hold('bass', rootPitch, at, beat * 2.7, feel(0.62, phrase, 0));
      hold('bass', fifthPitch, at + beat * 3, beat * 0.85, feel(0.4, phrase, 1));
    } else if (phrase === 7) {
      hold('bass', rootPitch, at, beat * 1.85, feel(0.6, phrase, 0));
      hold('bass', nextRoot, at + beat * 2, beat * 1.8, feel(0.52, phrase, 1));
    } else {
      hold('bass', rootPitch, at, beat * 1.85, feel(0.56, phrase, 0));
      const passing = nextRoot !== rootPitch ? scalePitch(nextRoot + (nextRoot > rootPitch ? -2 : 2), key, 33, 46) : fifthPitch;
      hold('bass', passing, at + beat * 2, beat * 1.75, feel(0.42, phrase, 1));
    }

    if (phrase === 2 || phrase === 6) {
      const celloStart = nearestPitch(root, 48, 58, 52);
      const step = phrase === 2 ? 2 : -2;
      const celloNext = celloStart == null ? null : scalePitch(celloStart + step, key, 48, 62);
      hold('cello', celloStart, at + 0.012, beat * 1.75, feel(0.5, phrase, 2));
      if (celloNext != null && celloNext !== celloStart) hold('cello', celloNext, at + beat * 2 + 0.02, beat * 1.6, feel(0.42, phrase, 3));
    } else if (!sparse || phrase === 0) {
      const cello = nearestPitch(shape[Math.min(1, shape.length - 1)], 48, 60, phrase % 2 === 0 ? 52 : 55);
      hold('cello', cello, at + (phrase % 2 === 0 ? 0 : 0.018), phrase === 3 ? bar * 0.82 : beat * 3.2, feel(phrase === 3 ? 0.36 : 0.48, phrase, 2));
    }

    const stringVoices = phrase === 3 || leadCount === 0 || color === 'none' ? 0 : 1;
    if (stringVoices > 0) {
      const voiced = voiceChord(shape, 55, 72, null).filter(pitch => !doublesLead(pitch, at)).slice(0, stringVoices);
      voiced.forEach((pitch, index) => {
        hold('strings', pitch, at + 0.032 + index * 0.012, bar * 0.78, feel(index === 0 ? 0.34 : 0.28, phrase, 4 + index));
      });
    }

    if (color === 'horn') {
      const hornRoot = nearestPitch(root, 52, 70, 60);
      const hornFifth = nearestPitch((root + 7) % 12, 55, 74, 67);
      if (hornRoot != null && !doublesLead(hornRoot, at)) hold('horn', hornRoot, at + 0.046, bar * 0.86, feel(0.4, phrase, 6));
      if (phrase !== 0 && !sparse && hornFifth != null && hornFifth !== hornRoot && !doublesLead(hornFifth, at + beat * 2)) {
        hold('horn', hornFifth, at + beat * 2 + 0.04, beat * 1.7, feel(0.32, phrase, 7));
      }
    } else if (color === 'oboe') {
      const pitch = nearestPitch(shape[Math.min(1, shape.length - 1)], 64, 79, 70);
      if (pitch != null && !doublesLead(pitch, at)) hold('oboe', pitch, at + 0.028, beat * 1.9, feel(0.38, phrase, 6));
      if (leadCount >= 2) {
        [1, 3].forEach((beatIn, index) => {
          const pc = shape[index % shape.length];
          const plucked = nearestPitch(pc, 48, 67, index === 0 ? 55 : 60);
          hold('pizz', plucked, at + beatIn * beat, 0.15, feel(index === 0 ? 0.44 : 0.34, phrase, 8 + index));
        });
      }
    } else if (color === 'clarinet') {
      let pitch = nearestPitch(root, 58, 72, 64);
      if (pitch != null && doublesLead(pitch, at)) pitch = nearestPitch(root, 48, 57, 52);
      if (pitch != null && !doublesLead(pitch, at)) hold('clarinet', pitch, at + 0.04, beat * 1.7, feel(0.34, phrase, 6));
    } else if (color === 'flute') {
      const peak = here.slice().sort((a, b) => (b.amplitude || 0) - (a.amplitude || 0) || b.pitch - a.pitch)[0];
      if (peak) {
        const echoed = scalePitch(peak.pitch < 72 ? peak.pitch + 12 : peak.pitch, key, 72, 88);
        const echoAt = peak.start + beat * 0.5 + 0.02;
        if (!doublesLead(echoed, echoAt)) hold('flute', echoed, echoAt, beat * 0.85, feel(0.34, phrase, 6));
      }
    } else if (color === 'harp') {
      const used = [];
      for (let index = 0; index < 4; index++) {
        const pc = shape[index % shape.length];
        let pitch = nearestPitch(pc, index < 2 ? 60 : 72, index < 2 ? 76 : 88, index < 2 ? 67 : 79);
        if (pitch != null && used.indexOf(pitch) !== -1) pitch = nearestPitch(pc, pitch + 1, 90, pitch + 12);
        if (pitch == null || used.indexOf(pitch) !== -1) continue;
        used.push(pitch);
        hold('arp', pitch, at + index * beat + 0.012, beat * 0.72, feel(0.3 + index * 0.025, phrase, 9 + index));
      }
    } else if (color === 'piano') {
      let stabs = voiceChord(shape, 60, 76, null).filter(pitch => !doublesLead(pitch, at)).slice(0, 2);
      if (!stabs.length) {
        const lower = nearestPitch(root, 48, 59, 53);
        if (lower != null) stabs = [lower];
      }
      stabs.forEach((pitch, index) => {
        hold('keys', pitch, at + 0.01 + index * 0.008, beat * 0.55, feel(0.32, phrase, 6 + index));
      });
    } else if (color === 'trumpet') {
      const last = here.length ? here[here.length - 1].pitch : 67;
      const first = scalePitch(last - 2, key, 60, 76);
      const second = scalePitch(last, key, 62, 79);
      hold('trumpet', first, at + beat, beat * 0.9, feel(0.5, phrase, 6));
      if (second !== first) hold('trumpet', second, at + beat * 2, beat * 1.55, feel(0.58, phrase, 7));
    }

    if (phrase === 0 || phrase === 4) {
      const timp = nearestPitch(root, 36, 47, 41);
      hold('timpani', timp, at, beat * 0.85, feel(phrase === 0 ? 0.66 : 0.52, phrase, 11));
    } else if (phrase === 7) {
      const timp = nearestPitch(root, 36, 47, 41);
      for (let index = 0; index < 4; index++) {
        hold('timpani', timp, at + beat * 3 + index * Math.max(0.09, sixteenth), Math.max(0.09, sixteenth * 0.85), feel(0.34 + index * 0.06, phrase, 12 + index));
      }
    }
  }

  let time = phase;
  while (time - beat >= -0.001) time -= beat;
  if (time < -0.001) time += beat;
  for (; time < end - 0.04; time += beat) {
    const hit = time < 0.02 ? 0 : time;
    const pos = ((hit - phase) % bar + bar) % bar;
    const beatIndex = ((Math.round(pos / beat) % 4) + 4) % 4;
    const drumBar = Math.floor((hit - phase + 0.001) / bar);
    const phrase = ((drumBar % 8) + 8) % 8;
    const breathe = phrase === 3;
    const cadence = phrase === 7;
    if (beatIndex === 0) pushNote(out, 'drums', 36, hit, 0.16, phrase === 0 ? 0.7 : 0.58);
    if (!breathe && beatIndex === 2) pushNote(out, 'drums', 36, hit, 0.12, 0.4);
    if (breathe && beatIndex === 2) pushNote(out, 'drums', 38, hit, 0.12, 0.38);
    if (!breathe && (beatIndex === 1 || beatIndex === 3) && !(cadence && beatIndex === 3)) {
      pushNote(out, 'drums', 38, hit, 0.11, beatIndex === 1 ? 0.52 : 0.44);
      if (phrase === 2 || phrase === 5 || phrase === 6) pushNote(out, 'drums', 42, hit + 0.02, 0.08, 0.2);
    }
    if (cadence && beatIndex === 3) {
      pushNote(out, 'drums', 38, hit, 0.09, 0.4);
      pushNote(out, 'drums', 38, hit + Math.max(0.09, sixteenth), 0.09, 0.5);
      pushNote(out, 'drums', 47, hit + Math.max(0.09, sixteenth) * 2, 0.1, 0.4);
    }
    if (beatIndex === 0 && drumBar > 0 && phrase === 0) pushNote(out, 'drums', 49, hit, Math.min(0.4, beat), 0.3);
  }

  return out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
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
