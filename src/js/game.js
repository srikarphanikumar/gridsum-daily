/**
 * game.js — Core game logic for GridSum Daily
 * Vanilla JS, no imports/exports. Reads window.PUZZLE (set by puzzles.js).
 * Depends on: validateCell, isSolved (validator.js), GameStorage (storage.js),
 *             TG (telegram.js — optional).
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────

  var puzzle      = null;   // window.PUZZLE
  var playerGrid  = [];     // parallel to puzzle.grid; null = unfilled
  var selectedIdx = null;   // index of currently selected hidden cell
  var hintsUsed   = 0;
  var hintedCells = [];     // indices revealed by hint
  var timerSecs   = 0;
  var timerHandle = null;
  var gameOver    = false;

  // ── DOM refs ───────────────────────────────────────────────────────────────

  var gridEl        = document.getElementById('grid');
  var timerEl       = document.getElementById('timer-display');
  var hintBtn       = document.getElementById('hint-btn');
  var resultOverlay = document.getElementById('result-overlay');
  var resultEmoji   = document.getElementById('result-emoji');
  var resultTitle   = document.getElementById('result-title');
  var resultStats   = document.getElementById('result-stats');
  var sharePreview  = document.getElementById('share-text-preview');
  var shareBtn      = document.getElementById('share-btn');
  var playAgainBtn  = document.getElementById('play-again-btn');
  var streakCount   = document.getElementById('streak-count');
  var diffLabel     = document.getElementById('difficulty-label');

  // ── Utilities ──────────────────────────────────────────────────────────────

  function formatTime(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function cellEl(idx) {
    return gridEl.querySelector('[data-index="' + idx + '"]');
  }

  function isHidden(idx) {
    return puzzle.hidden.indexOf(idx) !== -1;
  }

  function isHinted(idx) {
    return hintedCells.indexOf(idx) !== -1;
  }

  // ── Timer ──────────────────────────────────────────────────────────────────

  function startTimer() {
    if (timerHandle) return;
    timerHandle = setInterval(function () {
      timerSecs++;
      timerEl.textContent = formatTime(timerSecs);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
  }

  // ── Grid rendering ─────────────────────────────────────────────────────────

  function initGame(p) {
    puzzle     = p;
    playerGrid = puzzle.grid.map(function (val, i) {
      return isHidden(i) ? null : val;
    });
    selectedIdx = null;
    hintsUsed   = 0;
    hintedCells = [];
    timerSecs   = 0;
    gameOver    = false;

    timerEl.textContent = '0:00';
    resultOverlay.classList.add('hidden');

    // Difficulty label
    if (diffLabel && puzzle.difficulty) {
      diffLabel.textContent = puzzle.difficulty.toUpperCase();
    }

    // Streak
    if (streakCount && window.GameStorage) {
      var streak = GameStorage.getStreak();
      streakCount.textContent = streak.current;
    }

    renderGrid();
    renderNumpad();
    stopTimer();
    startTimer();
  }

  function renderGrid() {
    gridEl.innerHTML = '';

    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        var idx = row * 4 + col;
        var div = document.createElement('div');
        div.className = 'cell';
        div.dataset.index = idx;

        if (isHidden(idx)) {
          div.classList.add('hidden-cell');
          if (playerGrid[idx] !== null) {
            div.textContent = playerGrid[idx];
          }
          div.addEventListener('click', onCellClick);
        } else {
          div.classList.add('given');
          div.textContent = puzzle.grid[idx];
        }

        gridEl.appendChild(div);
      }

      // Row sum label (5th column)
      var rowSum = document.createElement('div');
      rowSum.className = 'sum-label';
      rowSum.textContent = puzzle.rowSums[row];
      gridEl.appendChild(rowSum);
    }

    // 5th row: column sums + corner
    for (var c = 0; c < 4; c++) {
      var colSum = document.createElement('div');
      colSum.className = 'sum-label';
      colSum.textContent = puzzle.colSums[c];
      gridEl.appendChild(colSum);
    }
    var corner = document.createElement('div');
    corner.className = 'sum-label sum-corner';
    gridEl.appendChild(corner);
  }

  // ── Cell color updates ─────────────────────────────────────────────────────

  function updateCellVisual(idx) {
    var el = cellEl(idx);
    if (!el || !isHidden(idx)) return;

    // Remove all state classes
    el.classList.remove('selected', 'correct', 'wrong', 'hinted');

    var val = playerGrid[idx];

    if (isHinted(idx)) {
      el.classList.add('hinted');
      el.textContent = puzzle.grid[idx];
      return;
    }

    if (idx === selectedIdx) {
      el.classList.add('selected');
    }

    if (val === null) {
      el.textContent = '';
      return;
    }

    el.textContent = val;

    // Validate this cell in context
    var valid = window.validateCell(puzzle, playerGrid, idx);
    if (valid) {
      el.classList.add('correct');
    } else {
      el.classList.add('wrong');
    }
  }

  function refreshAllCellVisuals() {
    puzzle.hidden.forEach(function (idx) {
      updateCellVisual(idx);
    });
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  function selectCell(idx) {
    if (gameOver) return;
    if (!isHidden(idx)) return;
    if (isHinted(idx)) return;

    var prev = selectedIdx;
    selectedIdx = idx;

    if (prev !== null) updateCellVisual(prev);
    updateCellVisual(idx);

    if (window.TG) TG.haptic('light');
  }

  function deselectAll() {
    var prev = selectedIdx;
    selectedIdx = null;
    if (prev !== null) updateCellVisual(prev);
  }

  // ── Cell click ─────────────────────────────────────────────────────────────

  function onCellClick(e) {
    var idx = parseInt(e.currentTarget.dataset.index, 10);
    if (selectedIdx === idx) {
      deselectAll();
    } else {
      selectCell(idx);
    }
  }

  // ── Number pad ─────────────────────────────────────────────────────────────

  function renderNumpad() {
    var btns = document.querySelectorAll('.num-btn');
    btns.forEach(function (btn) {
      // Remove old listeners by cloning
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
    });

    document.querySelectorAll('.num-btn').forEach(function (btn) {
      btn.addEventListener('click', onNumpadClick);
    });
  }

  function onNumpadClick(e) {
    if (gameOver) return;
    if (selectedIdx === null) return;

    var num = e.currentTarget.dataset.num;

    if (num === 'erase') {
      playerGrid[selectedIdx] = null;
      updateCellVisual(selectedIdx);
      // After erasing, re-validate all other filled cells since sums change
      refreshAllCellVisuals();
      return;
    }

    var digit = parseInt(num, 10);
    if (isNaN(digit) || digit < 1 || digit > 9) return;

    playerGrid[selectedIdx] = digit;

    // Re-validate all hidden cells because row/col sums are interdependent
    refreshAllCellVisuals();

    if (window.TG) TG.haptic('medium');

    // Check win
    if (window.isSolved(puzzle, playerGrid)) {
      onSolved();
    }
  }

  // ── Hint ───────────────────────────────────────────────────────────────────

  hintBtn.addEventListener('click', function () {
    if (gameOver) return;

    // Find unfilled, non-hinted hidden cells
    var candidates = puzzle.hidden.filter(function (idx) {
      return playerGrid[idx] === null && !isHinted(idx);
    });

    if (candidates.length === 0) {
      hintBtn.disabled = true;
      return;
    }

    // Pick a random candidate
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    hintedCells.push(pick);
    playerGrid[pick] = puzzle.grid[pick];
    hintsUsed++;

    // Deselect if we hinted the selected cell
    if (selectedIdx === pick) selectedIdx = null;

    updateCellVisual(pick);
    refreshAllCellVisuals();

    if (window.TG) TG.haptic('medium');

    // Disable hint button if no candidates remain
    var remaining = puzzle.hidden.filter(function (idx) {
      return playerGrid[idx] === null && !isHinted(idx);
    });
    if (remaining.length === 0) {
      hintBtn.disabled = true;
    }

    // Check win (hint might complete the puzzle)
    if (window.isSolved(puzzle, playerGrid)) {
      onSolved();
    }
  });

  // ── Win ────────────────────────────────────────────────────────────────────

  function onSolved() {
    gameOver = true;
    stopTimer();
    selectedIdx = null;
    refreshAllCellVisuals();

    // Persist solve
    if (window.GameStorage) {
      var today = new Date().toISOString().slice(0, 10);
      GameStorage.recordSolve(today, timerSecs, hintsUsed);
      if (puzzle.difficulty) {
        GameStorage.updateBestTime(puzzle.difficulty, timerSecs);
      }
      // Refresh streak display
      var streak = GameStorage.getStreak();
      if (streakCount) streakCount.textContent = streak.current;
    }

    if (window.TG) TG.haptic('heavy');

    showResult();
  }

  // ── Result overlay ─────────────────────────────────────────────────────────

  function buildShareText() {
    var puzzleNum = puzzle._number || puzzle.id || '?';
    var lines = ['GridSum #' + puzzleNum + ' 🔢'];

    puzzle.hidden.sort(function (a, b) { return a - b; });
    var hiddenSet = {};
    puzzle.hidden.forEach(function (i) { hiddenSet[i] = true; });

    for (var row = 0; row < 4; row++) {
      var line = '';
      for (var col = 0; col < 4; col++) {
        var idx = row * 4 + col;
        if (!hiddenSet[idx]) {
          // Given cell — always correct
          line += '⬜'; // ⬜
        } else if (isHinted(idx)) {
          // Revealed by hint — treat as hidden (don't reveal value)
          line += '❓'; // ❓
        } else {
          // Player-filled hidden cell
          line += '🟩'; // 🟩
        }
      }
      lines.push(line);
    }

    lines.push('⏱ ' + formatTime(timerSecs) + ' | 💡 ' + hintsUsed + ' hint' + (hintsUsed === 1 ? '' : 's'));
    return lines.join('\n');
  }

  function showResult() {
    var shareText = buildShareText();

    resultEmoji.textContent = '🎉'; // 🎉
    resultTitle.textContent = 'Puzzle Solved!';

    var statsLines = [
      '⏱ ' + formatTime(timerSecs),
      '💡 ' + hintsUsed + ' hint' + (hintsUsed === 1 ? '' : 's') + ' used',
    ];
    if (window.GameStorage && puzzle.difficulty) {
      var best = GameStorage.getBestTime(puzzle.difficulty);
      if (best !== null) {
        statsLines.push('🏆 Best (' + puzzle.difficulty + '): ' + formatTime(best));
      }
    }
    resultStats.innerHTML = statsLines.join('<br>');

    sharePreview.textContent = shareText;

    shareBtn.onclick = function () {
      if (window.TG && TG.isAvailable()) {
        TG.share(shareText);
        showToast('Shared!');
      } else {
        copyToClipboard(shareText);
        showToast('Copied to clipboard!');
      }
    };

    playAgainBtn.onclick = function () {
      resultOverlay.classList.add('hidden');
      // Reload page to get next puzzle (or same one in dev)
      window.location.reload();
    };

    resultOverlay.classList.remove('hidden');
  }

  // ── Clipboard ──────────────────────────────────────────────────────────────

  function copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).catch(function () {
        legacyCopy(text);
      });
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {
      console.warn('game.js: clipboard copy failed');
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg) {
    var toast = document.getElementById('copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 2000);
  }

  // ── Error state ────────────────────────────────────────────────────────────

  function showError(msg) {
    gridEl.innerHTML = '<div style="grid-column:1/-1;grid-row:1/-1;display:flex;align-items:center;justify-content:center;color:#888;font-size:0.9rem;text-align:center;padding:20px;">' + msg + '</div>';
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  function onPuzzleReady() {
    if (!window.PUZZLE) {
      showError('Could not load puzzle. Please refresh.');
      return;
    }
    initGame(window.PUZZLE);
  }

  document.addEventListener('puzzleReady', onPuzzleReady);

  // If puzzleReady already fired before this script ran (edge case with non-defer)
  if (window.PUZZLE) {
    onPuzzleReady();
  }

}());
