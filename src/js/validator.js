function validatePuzzle(puzzle, playerGrid) {
  const grid = puzzle.grid.map((val, i) =>
    puzzle.hidden.includes(i) ? playerGrid[i] : val
  );

  for (let r = 0; r < 4; r++) {
    const filled = grid.slice(r * 4, r * 4 + 4);
    if (filled.some((v) => v === null || v === undefined)) continue;
    if (filled.reduce((a, b) => a + b, 0) !== puzzle.rowSums[r]) return false;
  }

  for (let c = 0; c < 4; c++) {
    const filled = [0, 1, 2, 3].map((r) => grid[r * 4 + c]);
    if (filled.some((v) => v === null || v === undefined)) continue;
    if (filled.reduce((a, b) => a + b, 0) !== puzzle.colSums[c]) return false;
  }

  return true;
}

function validateCell(puzzle, playerGrid, index) {
  const grid = puzzle.grid.map((val, i) =>
    puzzle.hidden.includes(i) ? playerGrid[i] : val
  );

  const r = Math.floor(index / 4);
  const c = index % 4;

  const rowCells = grid.slice(r * 4, r * 4 + 4);
  if (rowCells.every((v) => v !== null && v !== undefined)) {
    if (rowCells.reduce((a, b) => a + b, 0) !== puzzle.rowSums[r]) return false;
  }

  const colCells = [0, 1, 2, 3].map((row) => grid[row * 4 + c]);
  if (colCells.every((v) => v !== null && v !== undefined)) {
    if (colCells.reduce((a, b) => a + b, 0) !== puzzle.colSums[c]) return false;
  }

  return true;
}

function isSolved(puzzle, playerGrid) {
  if (puzzle.hidden.some((i) => playerGrid[i] === null || playerGrid[i] === undefined)) {
    return false;
  }

  const grid = puzzle.grid.map((val, i) =>
    puzzle.hidden.includes(i) ? playerGrid[i] : val
  );

  for (let r = 0; r < 4; r++) {
    if (grid.slice(r * 4, r * 4 + 4).reduce((a, b) => a + b, 0) !== puzzle.rowSums[r]) {
      return false;
    }
  }

  for (let c = 0; c < 4; c++) {
    if ([0, 1, 2, 3].map((r) => grid[r * 4 + c]).reduce((a, b) => a + b, 0) !== puzzle.colSums[c]) {
      return false;
    }
  }

  return true;
}

// Expose as globals for non-module script loading
window.validatePuzzle = validatePuzzle;
window.validateCell   = validateCell;
window.isSolved       = isSolved;
