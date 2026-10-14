import React, { useEffect, useState } from 'react';

const LEVELS = {
  Beginner: { rows: 9, cols: 9, mines: 10 },
  Intermediate: { rows: 16, cols: 16, mines: 40 },
  Expert: { rows: 16, cols: 30, mines: 99 },
};
const COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080'];

function makeBoard(level, safeIndex = -1) {
  const { rows, cols, mines } = LEVELS[level];
  const safe = new Set([safeIndex]);
  const candidates = Array.from({ length: rows * cols }, (_, i) => i).filter(i => !safe.has(i));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const mineSet = new Set(candidates.slice(0, mines));
  return Array.from({ length: rows * cols }, (_, index) => {
    const neighbors = getNeighbors(index, rows, cols);
    return { mine: mineSet.has(index), count: neighbors.filter(n => mineSet.has(n)).length, open: false, flag: false };
  });
}

function getNeighbors(index, rows, cols) {
  const r = Math.floor(index / cols), c = index % cols, result = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push(nr * cols + nc);
  }
  return result;
}

function reveal(board, index, rows, cols) {
  const next = board.map(cell => ({ ...cell }));
  const queue = [index], visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const cell = next[current];
    if (!cell || cell.open || cell.flag) continue;
    cell.open = true;
    if (!cell.mine && cell.count === 0) {
      getNeighbors(current, rows, cols).forEach(n => {
        if (!visited.has(n) && !next[n].mine) queue.push(n);
      });
    }
  }
  return next;
}

export default function Minesweeper() {
  const [level, setLevel] = useState('Beginner');
  const [board, setBoard] = useState(() => makeBoard('Beginner'));
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState('playing');
  const [seconds, setSeconds] = useState(0);
  const { rows, cols, mines } = LEVELS[level];
  const flags = board.filter(cell => cell.flag).length;

  useEffect(() => {
    if (!started || status !== 'playing') return undefined;
    const timer = window.setInterval(() => setSeconds(s => Math.min(999, s + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [started, status]);

  function restart(nextLevel = level) {
    setLevel(nextLevel);
    setBoard(makeBoard(nextLevel));
    setStarted(false);
    setStatus('playing');
    setSeconds(0);
  }

  function openCell(index) {
    if (status !== 'playing' || board[index].open || board[index].flag) return;
    let next = board;
    if (!started) {
      next = makeBoard(level, index);
      setStarted(true);
    }
    if (next[index].mine) {
      setBoard(next.map((cell, i) => ({ ...cell, open: cell.open || cell.mine || i === index })));
      setStatus('lost');
      return;
    }
    next = reveal(next, index, rows, cols);
    const opened = next.filter(cell => cell.open && !cell.mine).length;
    setBoard(next);
    if (opened === rows * cols - mines) setStatus('won');
  }

  function toggleFlag(event, index) {
    event.preventDefault();
    if (status !== 'playing' || board[index].open) return;
    const next = board.map((cell, i) => i === index ? { ...cell, flag: !cell.flag } : cell);
    setBoard(next);
    if (!started) setStarted(true);
  }

  const face = status === 'lost' ? '☹' : status === 'won' ? '😎' : '☺';
  const displayNumber = n => String(Math.max(0, Math.min(999, n))).padStart(3, '0');

  return (
    <div style={{ boxSizing: 'border-box', width: '100%', height: '100%', padding: 8, overflow: 'auto', background: '#c0c0c0', color: '#111', fontFamily: 'Tahoma, Arial, sans-serif', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <label>Difficulty{' '}
          <select value={level} onChange={e => restart(e.target.value)} style={{ font: '12px Tahoma, sans-serif' }}>
            {Object.keys(LEVELS).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => restart()} aria-label="Restart game" style={{ marginLeft: 'auto', fontSize: 22, lineHeight: '26px', width: 34, height: 32, padding: 0, border: '2px outset #fff', background: '#c0c0c0' }}>{face}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 6, border: '3px inset #eee', marginBottom: 8, background: '#c0c0c0' }}>
        <span aria-label="Mines remaining" style={{ background: '#111', color: '#f00', fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold', padding: '1px 4px', letterSpacing: 1 }}>{displayNumber(mines - flags)}</span>
        <span aria-label="Elapsed time" style={{ background: '#111', color: '#f00', fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold', padding: '1px 4px', letterSpacing: 1 }}>{displayNumber(seconds)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 24px)`, width: 'max-content', border: '3px inset #eee', background: '#c0c0c0', margin: '0 auto' }}>
        {board.map((cell, index) => {
          const shown = cell.open;
          const exploded = status === 'lost' && cell.mine && !cell.flag;
          return <button
            key={index}
            type="button"
            onClick={() => openCell(index)}
            onContextMenu={event => toggleFlag(event, index)}
            aria-label={cell.flag ? 'Flagged cell' : shown ? (cell.mine ? 'Mine' : cell.count ? String(cell.count) : 'Empty') : 'Covered cell'}
            style={{
              width: 24, height: 24, padding: 0, margin: 0, boxSizing: 'border-box',
              border: shown ? '1px solid #888' : '3px outset #fff',
              background: shown ? (exploded ? '#f00' : '#c0c0c0') : '#c0c0c0',
              color: cell.mine ? '#111' : COLORS[cell.count],
              font: 'bold 15px Arial, sans-serif', textAlign: 'center', lineHeight: '19px',
            }}
          >{cell.flag ? '🚩' : shown ? (cell.mine ? '●' : cell.count || '') : ''}</button>;
        })}
      </div>
      <div style={{ marginTop: 8, textAlign: 'center', minHeight: 18 }} role="status">
        {status === 'won' ? 'You win! All safe squares are open.' : status === 'lost' ? 'Game over! Try again.' : 'Left-click to reveal · Right-click to flag'}
      </div>
    </div>
  );
}
