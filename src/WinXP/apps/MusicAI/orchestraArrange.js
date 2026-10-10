// Accuracy-first Roblox-era arrangement.
// All notes come from transcription. This file may classify notes for a coherent
// SoundFont palette, but must never invent notes, quantize timing, or guess chords.

function cleanSource(notes) {
  const sorted = (notes || []).slice().sort((a, b) =>
    a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi
  );
  const kept = [];
  sorted.forEach(note => {
    if (!note || !Number.isFinite(note.startTimeSeconds) ||
        !Number.isFinite(note.durationSeconds) || !Number.isFinite(note.pitchMidi) ||
        note.durationSeconds < 0.035 || note.pitchMidi < 0 || note.pitchMidi > 127 ||
        note.startTimeSeconds < 0) return;
    const duplicate = kept.some(previous =>
      previous.pitchMidi === note.pitchMidi &&
      Math.abs(previous.startTimeSeconds - note.startTimeSeconds) < 0.012 &&
      Math.abs(previous.durationSeconds - note.durationSeconds) < 0.025
    );
    if (!duplicate) kept.push(note);
  });
  return kept;
}

function clusterNotes(notes, windowSeconds = 0.06) {
  const clusters = [];
  notes.forEach(note => {
    const last = clusters[clusters.length - 1];
    if (!last || note.startTimeSeconds - last.time > windowSeconds) {
      clusters.push({ time: note.startTimeSeconds, notes: [note] });
    } else {
      last.notes.push(note);
    }
  });
  return clusters;
}

function scoreMelodyNote(note, prevPitch, prevTime) {
  let score = (Number(note.amplitude) || 0.5) * 2.4 +
    Math.min(note.durationSeconds, 0.9) * 0.75;
  const pitch = note.pitchMidi;
  if (pitch >= 62 && pitch <= 81) score += 0.75;
  else if (pitch >= 57 && pitch <= 88) score += 0.25;
  else if (pitch > 88) score -= 0.9;

  if (prevPitch != null && prevTime != null) {
    const leap = Math.abs(pitch - prevPitch);
    const gap = note.startTimeSeconds - prevTime;
    if (gap <= 1.05) {
      if (leap === 0) score += 0.5;
      else if (leap <= 2) score += 0.6;
      else if (leap <= 5) score += 0.22;
      else if (leap > 7 && leap !== 12) score -= 0.3 * (leap - 7);
      else if (leap === 12) score -= 0.4;
    }
  }
  return score;
}

function extractMelody(notes) {
  const clusters = clusterNotes(notes);
  const melody = [];
  let previousPitch = null;
  let previousTime = null;
  clusters.forEach(cluster => {
    const candidates = cluster.notes.filter(note =>
      note.pitchMidi >= 48 && note.pitchMidi <= 93 && note.durationSeconds >= 0.055
    );
    if (!candidates.length) return;
    let best = null;
    let bestScore = -Infinity;
    candidates.forEach(note => {
      const score = scoreMelodyNote(note, previousPitch, previousTime);
      if (score > bestScore) {
        best = note;
        bestScore = score;
      }
    });
    if (!best) return;
    melody.push(best);
    previousPitch = best.pitchMidi;
    previousTime = best.startTimeSeconds;
  });
  return new Set(melody);
}

export function buildRobloxArrangement(rawNotes, duration) {
  // Transcription-only: preserve the source song's detected pitch, onset,
  // duration, and relative dynamics. Do not generate backing music.
  const limit = Math.min(300, Number(duration) > 0 ? Number(duration) : 300);
  const source = cleanSource(rawNotes).filter(note => note.startTimeSeconds < limit);
  if (!source.length) return [];

  const melody = extractMelody(source);
  return source.map((note, index) => {
    let role;
    if (melody.has(note)) role = 'vocals';
    else if (note.pitchMidi < 48) role = 'cello';
    else if (note.pitchMidi < 64) role = 'keys';
    else role = 'strings';

    const startTimeSeconds = note.startTimeSeconds;
    const durationSeconds = Math.max(0.035, Math.min(note.durationSeconds, limit - startTimeSeconds));
    const rawAmplitude = Number(note.amplitude);
    const amplitude = Number.isFinite(rawAmplitude)
      ? Math.max(0.02, Math.min(0.95, rawAmplitude))
      : 0.62;

    return {
      id: index + 1,
      role,
      // These roles all have matching presets in the same real SoundFont.
      // Keeping one bank avoids a collage of unrelated timbres.
      bankId: 'strategy',
      pitchMidi: Math.round(note.pitchMidi),
      startTimeSeconds,
      durationSeconds,
      amplitude,
    };
  }).sort((a, b) =>
    a.startTimeSeconds - b.startTimeSeconds || a.pitchMidi - b.pitchMidi
  );
}

export function orchestraProgramsFor(notes) {
  return {
    drums: 0,
    bass: 43,
    guitar: 42,
    vocals: 3,
    keys: 0,
    pad: 60,
    strings: 4,
    arp: 46,
    cello: 4,
    horn: 1,
    flute: 73,
    oboe: 68,
    clarinet: 71,
    timpani: 5,
    pizz: 45,
    trumpet: 2,
  };
}
