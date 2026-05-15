'use strict';

// ── Mini test harness ──────────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✅ ' + name);
    passed++;
  } catch (e) {
    console.log('  ❌ ' + name);
    console.log('     → ' + e.message);
    failed++;
  }
}

function assert(val, msg) {
  if (!val) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' | expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

function assertDeepEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((msg || '') + ' | expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

// ── Minimal browser stubs ──────────────────────────────────────────────────

global.window = global;

const _store = {};
global.localStorage = {
  getItem:    k => _store[k] !== undefined ? _store[k] : null,
  setItem:    (k, v) => { _store[k] = v; },
  removeItem: k => { delete _store[k]; },
  clear:      () => { Object.keys(_store).forEach(k => delete _store[k]); },
};

require('../src/js/validator.js');
require('../src/js/storage.js');

const puzzles = require('../src/data/puzzles.json');

// ── Helpers ────────────────────────────────────────────────────────────────

function makePuzzle(overrides) {
  const base = JSON.parse(JSON.stringify(puzzles[0]));
  return Object.assign(base, overrides || {});
}

function fullPlayerGrid(puzzle) {
  return [...puzzle.grid];
}

function emptyPlayerGrid(puzzle) {
  return puzzle.grid.map((v, i) => puzzle.hidden.includes(i) ? null : v);
}

// ══════════════════════════════════════════════════════════════════════════
// 1. PUZZLE BANK
// ══════════════════════════════════════════════════════════════════════════

console.log('\n── Puzzle bank ──────────────────────────────────────────────');

test('90 puzzles generated', () => {
  assertEqual(puzzles.length, 90);
});

test('Dates are unique', () => {
  const dates = puzzles.map(p => p.date);
  const unique = new Set(dates);
  assertEqual(unique.size, puzzles.length, 'duplicate dates found');
});

test('First puzzle date is 2026-05-14', () => {
  assertEqual(puzzles[0].date, '2026-05-14');
});

test('Difficulty spread: 30 easy / 30 medium / 30 hard', () => {
  const counts = puzzles.reduce((a, p) => { a[p.difficulty] = (a[p.difficulty]||0)+1; return a; }, {});
  assertEqual(counts.easy,   30, 'easy count');
  assertEqual(counts.medium, 30, 'medium count');
  assertEqual(counts.hard,   30, 'hard count');
});

test('Hidden cell counts match difficulty', () => {
  const expected = { easy: 4, medium: 6, hard: 9 };
  puzzles.forEach(p => {
    const exp = expected[p.difficulty];
    if (p.hidden.length !== exp)
      throw new Error('Puzzle ' + p.id + ' (' + p.difficulty + ') has ' + p.hidden.length + ' hidden, expected ' + exp);
  });
});

test('All row sums correct across all 90 puzzles', () => {
  puzzles.forEach(p => {
    for (let r = 0; r < 4; r++) {
      const sum = p.grid.slice(r*4, r*4+4).reduce((a,b) => a+b, 0);
      if (sum !== p.rowSums[r])
        throw new Error('Puzzle ' + p.id + ' row ' + r + ': ' + sum + ' !== ' + p.rowSums[r]);
    }
  });
});

test('All col sums correct across all 90 puzzles', () => {
  puzzles.forEach(p => {
    for (let c = 0; c < 4; c++) {
      const sum = [0,1,2,3].map(r => p.grid[r*4+c]).reduce((a,b) => a+b, 0);
      if (sum !== p.colSums[c])
        throw new Error('Puzzle ' + p.id + ' col ' + c + ': ' + sum + ' !== ' + p.colSums[c]);
    }
  });
});

test('All grid values are digits 1-9', () => {
  puzzles.forEach(p => {
    p.grid.forEach((v, i) => {
      if (v < 1 || v > 9 || !Number.isInteger(v))
        throw new Error('Puzzle ' + p.id + ' cell ' + i + ': invalid value ' + v);
    });
  });
});

test('Hidden indices valid (0-15) and sorted ascending', () => {
  puzzles.forEach(p => {
    p.hidden.forEach(idx => {
      if (idx < 0 || idx > 15)
        throw new Error('Puzzle ' + p.id + ': invalid hidden index ' + idx);
    });
    for (let i = 1; i < p.hidden.length; i++) {
      if (p.hidden[i] <= p.hidden[i-1])
        throw new Error('Puzzle ' + p.id + ': hidden indices not sorted');
    }
  });
});

test('No puzzle has duplicate hidden indices', () => {
  puzzles.forEach(p => {
    const s = new Set(p.hidden);
    if (s.size !== p.hidden.length)
      throw new Error('Puzzle ' + p.id + ': duplicate hidden indices');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. VALIDATOR
// ══════════════════════════════════════════════════════════════════════════

console.log('\n── Validator ────────────────────────────────────────────────');

test('isSolved: fully correct grid → true', () => {
  const p = makePuzzle();
  assert(isSolved(p, fullPlayerGrid(p)), 'should be solved');
});

test('isSolved: empty hidden cells → false', () => {
  const p = makePuzzle();
  assert(!isSolved(p, emptyPlayerGrid(p)), 'should not be solved');
});

test('isSolved: null in one hidden cell → false', () => {
  const p = makePuzzle();
  const grid = fullPlayerGrid(p);
  grid[p.hidden[0]] = null;
  assert(!isSolved(p, grid));
});

test('isSolved: all hidden filled but one wrong → false (single-hidden-row puzzle)', () => {
  // Find a puzzle where one hidden cell is alone in its row
  let found = false;
  for (const p of puzzles) {
    for (const idx of p.hidden) {
      const r = Math.floor(idx / 4);
      const hiddenInRow = p.hidden.filter(h => Math.floor(h/4) === r);
      if (hiddenInRow.length === 1) {
        const grid = fullPlayerGrid(p);
        // Set wrong value: change it enough to break row sum
        const orig = grid[idx];
        grid[idx] = orig === 9 ? 1 : orig + 1;
        // Verify it's actually wrong (row sum must differ)
        const rowSum = grid.slice(r*4, r*4+4).reduce((a,b)=>a+b,0);
        if (rowSum !== p.rowSums[r]) {
          assert(!isSolved(p, grid), 'should not be solved with wrong value');
          found = true;
          break;
        }
      }
    }
    if (found) break;
  }
  if (!found) throw new Error('Could not find suitable test puzzle — check puzzle bank');
});

test('validatePuzzle: correct full grid → true', () => {
  const p = makePuzzle();
  assert(validatePuzzle(p, fullPlayerGrid(p)));
});

test('validatePuzzle: partial grid (nulls in hidden) → true (skips)', () => {
  const p = makePuzzle();
  assert(validatePuzzle(p, emptyPlayerGrid(p)));
});

test('validateCell: correct value when row/col fully filled → true', () => {
  const p = makePuzzle();
  const grid = fullPlayerGrid(p);
  assert(validateCell(p, grid, p.hidden[0]));
});

test('validateCell: partially filled row → true (deferred validation)', () => {
  const p = makePuzzle();
  const grid = emptyPlayerGrid(p);
  // Fill just one hidden cell
  grid[p.hidden[0]] = p.grid[p.hidden[0]];
  assert(validateCell(p, grid, p.hidden[0]));
});

test('validateCell: given cell index works without error', () => {
  const p = makePuzzle();
  const grid = fullPlayerGrid(p);
  // Find a given (non-hidden) cell
  const givenIdx = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].find(i => !p.hidden.includes(i));
  const result = validateCell(p, grid, givenIdx);
  assert(typeof result === 'boolean');
});

// ══════════════════════════════════════════════════════════════════════════
// 3. STORAGE
// ══════════════════════════════════════════════════════════════════════════

console.log('\n── Storage ──────────────────────────────────────────────────');

test('getStreak: fresh → { current:0, best:0 }', () => {
  localStorage.clear();
  assertDeepEqual(GameStorage.getStreak(), { current: 0, best: 0 });
});

test('getTodaySolve: no solve → null', () => {
  localStorage.clear();
  assertEqual(GameStorage.getTodaySolve(), null);
});

test('getTotalSolved: fresh → 0', () => {
  localStorage.clear();
  assertEqual(GameStorage.getTotalSolved(), 0);
});

test('recordSolve: today → total becomes 1', () => {
  localStorage.clear();
  const _d = new Date(); const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
  GameStorage.recordSolve(today, 90, 1);
  assertEqual(GameStorage.getTotalSolved(), 1);
});

test('recordSolve: same day twice → still 1 total', () => {
  localStorage.clear();
  const _d = new Date(); const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
  GameStorage.recordSolve(today, 90, 1);
  GameStorage.recordSolve(today, 60, 0);
  assertEqual(GameStorage.getTotalSolved(), 1);
});

test('recordSolve: today → streak.current === 1', () => {
  localStorage.clear();
  const _d = new Date(); const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
  GameStorage.recordSolve(today, 90, 0);
  assertEqual(GameStorage.getStreak().current, 1);
});

test('recordSolve: today → streak.best === 1', () => {
  localStorage.clear();
  const _d = new Date(); const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
  GameStorage.recordSolve(today, 90, 0);
  assertEqual(GameStorage.getStreak().best, 1);
});

test('getTodaySolve: after solve → correct data', () => {
  localStorage.clear();
  const _d = new Date(); const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
  GameStorage.recordSolve(today, 120, 2);
  const s = GameStorage.getTodaySolve();
  assert(s !== null, 'should not be null');
  assertEqual(s.timeSeconds, 120);
  assertEqual(s.hintsUsed, 2);
  assertEqual(s.date, today);
});

test('getBestTime: no data → null', () => {
  localStorage.clear();
  assertEqual(GameStorage.getBestTime('easy'), null);
});

test('updateBestTime: stores first time', () => {
  localStorage.clear();
  GameStorage.updateBestTime('easy', 90);
  assertEqual(GameStorage.getBestTime('easy'), 90);
});

test('updateBestTime: lower time replaces', () => {
  localStorage.clear();
  GameStorage.updateBestTime('easy', 90);
  GameStorage.updateBestTime('easy', 60);
  assertEqual(GameStorage.getBestTime('easy'), 60);
});

test('updateBestTime: higher time does NOT replace', () => {
  localStorage.clear();
  GameStorage.updateBestTime('easy', 60);
  GameStorage.updateBestTime('easy', 120);
  assertEqual(GameStorage.getBestTime('easy'), 60);
});

test('updateBestTime: three difficulties stored independently', () => {
  localStorage.clear();
  GameStorage.updateBestTime('easy',   60);
  GameStorage.updateBestTime('medium', 90);
  GameStorage.updateBestTime('hard',  180);
  assertEqual(GameStorage.getBestTime('easy'),   60);
  assertEqual(GameStorage.getBestTime('medium'), 90);
  assertEqual(GameStorage.getBestTime('hard'),  180);
});

test('recordSolve: hintsUsed defaults to 0 when undefined', () => {
  localStorage.clear();
  const _d = new Date(); const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
  GameStorage.recordSolve(today, 60, undefined);
  const s = GameStorage.getTodaySolve();
  assertEqual(s.hintsUsed, 0);
});

// ══════════════════════════════════════════════════════════════════════════
// 4. BUG CHECKS
// ══════════════════════════════════════════════════════════════════════════

console.log('\n── Bug checks ───────────────────────────────────────────────');

test('puzzle.hidden already sorted → buildShareText sort mutation is benign', () => {
  puzzles.forEach(p => {
    for (let i = 1; i < p.hidden.length; i++) {
      if (p.hidden[i] < p.hidden[i-1])
        throw new Error('Puzzle ' + p.id + ': hidden not sorted — mutation in buildShareText will cause incorrect emoji grid');
    }
  });
});

test('Puzzle IDs are sequential 1-90', () => {
  puzzles.forEach((p, i) => {
    if (p.id !== i + 1)
      throw new Error('Puzzle at index ' + i + ' has id ' + p.id + ', expected ' + (i+1));
  });
});

test('Every puzzle has exactly 16 grid cells', () => {
  puzzles.forEach(p => {
    if (p.grid.length !== 16)
      throw new Error('Puzzle ' + p.id + ' has ' + p.grid.length + ' cells');
  });
});

test('No puzzle has a hidden index that is the same as a given cell after solving', () => {
  // All hidden indices should be valid cells that exist in the grid
  puzzles.forEach(p => {
    p.hidden.forEach(idx => {
      if (typeof p.grid[idx] !== 'number')
        throw new Error('Puzzle ' + p.id + ': hidden cell ' + idx + ' has no grid value');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════

console.log('\n─────────────────────────────────────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
