// Prebaked orchestra. Basic Pitch supplies the notes that were actually in the
// recording. This file assigns them to parts: the violin follows one tune,
// the bass follows the low line, and the strings hold the chords that were
// heard. Missing parts are filled with root and fifth only, so a guessed
// third cannot fight the song. Programs are GeneralUser GS General MIDI
// numbers. Drums are the standard kit (program 0), not the orchestra kit.

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

function placeMelody(pitch) {
  let placed = Math.round(pitch);
  while (placed < 55) placed += 12;
  while (placed > 91) placed -= 12;
  return clampMidi(placed);
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
      if (prevPitch != null && prevTime != null && Math.abs(best.pitchMidi - prevPitch) > 9 && best.durationSeconds < 0.13 && best.startTimeSeconds - prevTime < 0.45) return;
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

function extractBass(notes, melodySet) {
  const low = notes.filter(note => {
    if (melodySet.has(note)) return false;
    if (note.pitchMidi > 53 || note.durationSeconds < 0.1) return false;
    if (note.pitchMidi < 40 && note.durationSeconds < 0.16) return false;
    return true;
  });
  const thinned = [];
  let cluster = [];
  const flush = () => {
    if (!cluster.length) return;
    cluster.sort((a, b) => a.pitchMidi - b.pitchMidi || b.durationSeconds - a.durationSeconds);
    thinned.push(cluster[0]);
    cluster = [];
  };
  low.forEach(note => {
    if (cluster.length && note.startTimeSeconds - cluster[0].startTimeSeconds > 0.06) flush();
    cluster.push(note);
  });
  flush();
  const out = [];
  thinned.forEach(note => {
    const prev = out[out.length - 1];
    if (prev && Math.abs(note.pitchMidi - prev.pitchMidi) > 14 && note.durationSeconds < 0.16) return;
    out.push(note);
  });
  return out;
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

function sectionAt(time, origin, bar, phraseBars, barCount) {
  if (barCount < 8) return 'full';
  const index = Math.floor((time - origin) / (bar * phraseBars));
  if (index <= 0) return 'intro';
  if (index % 2 === 1) return 'chorus';
  return 'verse';
}

function swell(time, origin, bar, phraseBars) {
  const phraseLen = bar * phraseBars;
  const pos = ((time - origin) % phraseLen) / phraseLen;
  return 0.86 + 0.14 * Math.sin(Math.PI * Math.min(1, pos / 0.85));
}

function sectionGain(section) {
  if (section === 'intro') return 0.7;
  if (section === 'verse') return 0.86;
  if (section === 'chorus') return 1;
  return 0.92;
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

function melodyTooClose(melody, start, end, pitch) {
  return melody.some(note => {
    const noteEnd = note.startTimeSeconds + Math.max(note.durationSeconds, 0.2);
    if (note.startTimeSeconds >= end - 0.02 || noteEnd <= start + 0.02) return false;
    const placed = placeMelody(note.pitchMidi);
    const diff = Math.abs(placed - pitch);
    if (diff <= 2) return true;
    return intervalClass(placed, pitch) === 1 && diff < 12;
  });
}

function writeHeld(out, role, pitches, start, stop, amplitude) {
  const span = stop - start;
  if (span < 0.2 || !pitches.length) return;
  if (span <= 5.5) {
    pitches.forEach(pitch => pushNote(out, role, pitch, start, span - 0.04, amplitude));
    return;
  }
  const cut = start + span / 2;
  pitches.forEach(pitch => {
    pushNote(out, role, pitch, start, cut - start - 0.05, amplitude);
    pushNote(out, role, pitch, cut, stop - cut - 0.04, amplitude);
  });
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
    if (!right || sameChord(left.pcs, right.pcs) || left.pcs[0] === right.pcs[0]) {
      const pcs = heardClasses(pitchClassWeights(harmonyNotes, left.start, right ? right.end : left.end));
      segments.push({
        start: left.start,
        end: right ? right.end : left.end,
        pcs: pcs.length >= 2 ? pcs : left.pcs,
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

export function buildOrchestralArrangement(rawNotes, duration, stylePlan) {
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
  const plan = stylePlan || {};
  const fourOnFloor = plan.drumPattern === 'four_on_floor';
  const melody = extractMelody(cleaned);
  const melodySet = new Set(melody);
  const bassLine = extractBass(cleaned, melodySet);
  const bassSet = new Set(bassLine);
  const harmonyNotes = cleaned.filter(note => !melodySet.has(note) && !bassSet.has(note) && note.pitchMidi >= 48 && note.pitchMidi <= 79 && note.durationSeconds >= 0.16);
  const beat = estimateBeatSeconds(melody.length > 3 ? melody : cleaned);
  const detectedEnd = cleaned.reduce((max, note) => Math.max(max, note.startTimeSeconds + note.durationSeconds), 0);
  const fileEnd = Number(duration) || 0;
  const end = Math.max(detectedEnd, Math.min(fileEnd || detectedEnd, detectedEnd + 1.2));
  const accentNotes = melody.length ? melody : cleaned;
  const phase = findDownbeat(accentNotes, beat);
  const bar = beat * 4;
  const key = inferKey(melody.length ? melody : cleaned);
  const segments = buildHarmonySegments(melody, harmonyNotes, phase, end, beat, key);
  const barCount = Math.max(1, Math.round((end - 0) / bar));
  const phraseBars = barCount >= 16 ? 8 : 4;
  const out = [];

  melody.forEach((note, index) => {
    const next = melody[index + 1];
    const pitch = placeMelody(note.pitchMidi);
    let length = Math.max(0.1, note.durationSeconds);
    if (next) {
      const gap = next.startTimeSeconds - note.startTimeSeconds;
      if (gap > 0.06) {
        if (gap - length < 0.09) length = Math.max(0.1, gap - 0.045);
        else if (length < beat * 0.35) length = Math.min(gap - 0.05, Math.max(length, Math.min(beat * 0.55, gap * 0.7)));
      }
    } else {
      length = Math.min(Math.max(length, Math.min(beat, 0.85)), Math.max(0.2, end - note.startTimeSeconds));
    }
    const amplitude = Math.max(0.74, Math.min(0.88, 0.58 + (note.amplitude || 0.7) * 0.3));
    pushNote(out, 'vocals', pitch, note.startTimeSeconds, length, amplitude);
  });

  const bassCoverage = bassLine.reduce((sum, note) => sum + note.durationSeconds, 0) / Math.max(0.5, end);
  const useHeardBass = bassLine.length >= 4 && bassCoverage >= 0.18;
  if (useHeardBass) {
    bassLine.forEach((note, index) => {
      const next = bassLine[index + 1];
      let length = note.durationSeconds;
      if (next) length = Math.min(length, Math.max(0.12, next.startTimeSeconds - note.startTimeSeconds - 0.04));
      pushNote(out, 'bass', placeBass(note.pitchMidi), note.startTimeSeconds, Math.max(0.12, length), Math.max(0.5, Math.min(0.72, 0.42 + (note.amplitude || 0.6) * 0.3)));
    });
  }

  let stringVoices = [];
  segments.forEach((segment, segmentIndex) => {
    const section = sectionAt(segment.start, 0, bar, phraseBars, barCount);
    const gain = swell(segment.start, 0, bar, phraseBars) * sectionGain(section);
    const melodyPcs = [];
    melody.forEach(note => {
      if (note.startTimeSeconds >= segment.start - 0.05 && note.startTimeSeconds < segment.end) {
        melodyPcs.push(placeMelody(note.pitchMidi) % 12);
      }
    });
    const leadPc = melodyPcs.length ? melodyPcs.sort((a, b) => melodyPcs.filter(pc => pc === b).length - melodyPcs.filter(pc => pc === a).length)[0] : null;
    let pcs = segment.pcs.slice();
    if (leadPc != null && pcs.length > 2) pcs = pcs.filter(pc => pc !== leadPc);
    if (pcs.length < 2) pcs = addSafeFifth(segment.pcs.slice(0, 1));
    stringVoices = voiceChord(pcs, 52, 67, stringVoices);
    stringVoices = stringVoices.filter(pitch => {
      if (leadPc == null) return true;
      return intervalClass(pitch, leadPc) > 1 || stringVoices.length <= 2;
    });
    writeHeld(out, 'strings', stringVoices, segment.start, segment.end, 0.3 * gain);

    if (!useHeardBass) {
      const low = voiceChord(pcs.slice(0, 1), 43, 55, null);
      if (low.length) writeHeld(out, 'guitar', low, segment.start, segment.end, 0.28 * gain);
      let bassIndex = 0;
      for (let time = segment.start; time < segment.end - beat * 0.3; time += beat * 2, bassIndex++) {
        const root = placeBass(48 + pcs[0]);
        const fifthPc = pcs.indexOf((pcs[0] + 7) % 12) !== -1;
        const pitch = bassIndex % 2 === 1 && fifthPc ? placeBass(root + 7) : root;
        const noteEnd = Math.min(segment.end - 0.04, time + beat * 2 - 0.04);
        pushNote(out, 'bass', pitch, time, Math.max(0.16, noteEnd - time), (bassIndex % 2 === 0 ? 0.62 : 0.52) * gain);
      }
    } else {
      const low = voiceChord(pcs.slice(0, 1), 48, 60, null);
      const bassPitches = bassLine.filter(note => note.startTimeSeconds < segment.end && note.startTimeSeconds + note.durationSeconds > segment.start).map(note => placeBass(note.pitchMidi));
      const cello = low.find(pitch => bassPitches.every(bassPitch => Math.abs(bassPitch - pitch) > 7));
      if (cello != null && section !== 'intro') writeHeld(out, 'guitar', [cello], segment.start, segment.end, 0.16 * gain);
    }

    if (section !== 'intro' && segment.end - segment.start >= beat * 2) {
      const rootPitch = nearestPitch(pcs[0], 47, 58, 52);
      if (rootPitch != null && !melodyTooClose(melody, segment.start, segment.end, rootPitch)) {
        writeHeld(out, 'pad', [rootPitch], segment.start + 0.03, segment.end, 0.14 * gain);
      }
    }

    const pianoSource = harmonyNotes.filter(note =>
      note.startTimeSeconds >= segment.start &&
      note.startTimeSeconds < segment.end &&
      note.durationSeconds <= 0.62 &&
      note.pitchMidi >= 52 &&
      note.pitchMidi <= 79
    );
    if (pianoSource.length >= 3) {
      const buckets = new Map();
      pianoSource.forEach(note => {
        const keyTime = Math.round(note.startTimeSeconds / beat);
        const list = buckets.get(keyTime) || [];
        list.push(note);
        buckets.set(keyTime, list);
      });
      buckets.forEach(list => {
        list.sort((a, b) => (b.amplitude || 0) - (a.amplitude || 0));
        list.slice(0, 2).forEach(note => {
          if (melodyTooClose(melody, note.startTimeSeconds, note.startTimeSeconds + note.durationSeconds, note.pitchMidi)) return;
          pushNote(out, 'keys', note.pitchMidi, note.startTimeSeconds, Math.min(note.durationSeconds, beat * 0.8), 0.28 * gain);
        });
      });
    } else if (section !== 'intro') {
      const piano = voiceChord(pcs, 60, 76, null).slice(0, 3);
      if (piano.length) {
        for (let barTime = segment.start; barTime < segment.end - beat * 0.4; barTime += bar) {
          piano.forEach(pitch => pushNote(out, 'keys', pitch, barTime, Math.max(0.16, Math.min(beat * 0.9, 0.55)), 0.18 * gain));
        }
      }
    }

    if (segmentIndex > 0 && segmentIndex % 2 === 0) {
      const harp = pcs
        .map(pc => nearestPitch(pc, 64, 88, 76))
        .filter(pitch => pitch != null)
        .filter((pitch, index, list) => list.indexOf(pitch) === index)
        .sort((a, b) => a - b)
        .slice(0, 3);
      harp.forEach((pitch, index) => {
        pushNote(out, 'arp', pitch, segment.start + index * 0.07, Math.max(0.35, beat * 0.9), 0.2 * gain);
      });
    }
  });

  let time = phase;
  while (time - beat >= -0.001) time -= beat;
  if (time < -0.001) time += beat;
  const hats = beat < 0.55;
  for (; time < end - 0.04; time += beat) {
    const pos = ((time - phase) % bar + bar) % bar;
    const beatInBar = Math.round(pos / beat) % 4;
    const barIndex = Math.floor((time - phase) / bar);
    const section = sectionAt(Math.max(0, time), 0, bar, phraseBars, barCount);
    const gain = swell(Math.max(0, time), 0, bar, phraseBars);
    const phraseDown = barIndex % phraseBars === 0 && beatInBar === 0;
    if (section === 'intro') {
      if (beatInBar === 0) pushNote(out, 'drums', 36, time, Math.min(beat * 0.8, end - time), 0.34 * gain);
      continue;
    }
    if (beatInBar === 0 || fourOnFloor || beatInBar === 2) {
      pushNote(out, 'drums', 36, time, Math.min(beat * 0.7, end - time), (beatInBar === 0 ? 0.48 : 0.32) * gain);
    }
    if (beatInBar === 1 || beatInBar === 3) {
      pushNote(out, 'drums', 38, time, Math.min(beat * 0.28, end - time), 0.26 * gain);
    }
    if (hats) {
      const hatTime = time + beat * 0.5;
      if (hatTime < end - 0.05) pushNote(out, 'drums', 42, hatTime, Math.min(0.12, beat * 0.22), 0.09 * gain);
    }
    if (phraseDown && section === 'chorus') {
      pushNote(out, 'drums', 49, time, Math.min(beat * 1.2, end - time), 0.16);
    }
  }

  return out.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi);
}

export function orchestraProgramsFor(notes) {
  const leads = (notes || []).filter(note => note.role === 'vocals');
  const durations = leads.map(note => note.durationSeconds).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0.4;
  const beat = estimateBeatSeconds(leads.length > 3 ? leads : (notes || []).filter(note => note.role !== 'drums'));
  const flute = median < 0.16 && beat < 0.38;
  return {
    drums: 0,
    bass: 43,
    guitar: 42,
    vocals: flute ? 73 : 40,
    keys: 0,
    pad: 60,
    strings: beat < 0.36 ? 48 : 49,
    arp: 46,
  };
}
