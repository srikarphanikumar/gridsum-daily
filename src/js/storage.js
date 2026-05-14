/**
 * storage.js — Local persistence for GridSum Daily
 * Vanilla JS, no imports. Exposes window.GameStorage.
 */

(function () {
  'use strict';

  var KEYS = {
    streak:    'gridsum_streak',
    solves:    'gridsum_solves',
    bestTimes: 'gridsum_best_times',
  };

  /** Return today's local date as YYYY-MM-DD */
  function todayString() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  /** Return yesterday's local date as YYYY-MM-DD */
  function yesterdayString() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  // ── Low-level helpers ──────────────────────────────────────────────────────

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage unavailable — silently ignore
    }
  }

  // ── Streak ─────────────────────────────────────────────────────────────────

  /**
   * Returns { current: n, best: n }
   */
  function getStreak() {
    return readJSON(KEYS.streak, { current: 0, best: 0 });
  }

  // ── Solves ─────────────────────────────────────────────────────────────────

  /**
   * Returns the solves map: { "YYYY-MM-DD": { date, timeSeconds, hintsUsed } }
   */
  function getSolvesMap() {
    return readJSON(KEYS.solves, {});
  }

  /**
   * Records a completed solve.
   * Updates the streak if this date hasn't been recorded before.
   * @param {string} date        - YYYY-MM-DD
   * @param {number} timeSeconds - solve duration in seconds
   * @param {number} hintsUsed   - number of hints used
   */
  function recordSolve(date, timeSeconds, hintsUsed) {
    var solves = getSolvesMap();
    var isNewSolve = !solves[date];

    // Save the solve record
    solves[date] = {
      date:        date,
      timeSeconds: timeSeconds,
      hintsUsed:   hintsUsed || 0,
      recordedAt:  new Date().toISOString(),
    };
    writeJSON(KEYS.solves, solves);

    // Update streak only for genuinely new solve dates
    if (isNewSolve) {
      var streak = getStreak();
      var yesterday = yesterdayString();

      if (date === todayString()) {
        // Extend or start streak
        if (solves[yesterday]) {
          streak.current += 1;
        } else {
          // No solve yesterday — streak resets to 1
          streak.current = 1;
        }
        if (streak.current > streak.best) {
          streak.best = streak.current;
        }
        writeJSON(KEYS.streak, streak);
      }
    }
  }

  /**
   * Returns the solve record for today, or null if not yet solved.
   */
  function getTodaySolve() {
    var solves = getSolvesMap();
    return solves[todayString()] || null;
  }

  /**
   * Returns total number of solved puzzles across all time.
   */
  function getTotalSolved() {
    var solves = getSolvesMap();
    return Object.keys(solves).length;
  }

  // ── Best times ─────────────────────────────────────────────────────────────

  /**
   * Returns the best (lowest) time in seconds for a given difficulty, or null.
   * @param {string} difficulty - e.g. 'easy', 'medium', 'hard'
   */
  function getBestTime(difficulty) {
    var bestTimes = readJSON(KEYS.bestTimes, {});
    return bestTimes[difficulty] != null ? bestTimes[difficulty] : null;
  }

  /**
   * Internal helper: update best time for a difficulty if the new time is lower.
   * Called automatically inside recordSolve when a puzzle difficulty is known.
   * Since recordSolve doesn't receive difficulty, expose this as a public helper
   * so game code can call it alongside recordSolve.
   * @param {string} difficulty
   * @param {number} timeSeconds
   */
  function updateBestTime(difficulty, timeSeconds) {
    var bestTimes = readJSON(KEYS.bestTimes, {});
    if (bestTimes[difficulty] == null || timeSeconds < bestTimes[difficulty]) {
      bestTimes[difficulty] = timeSeconds;
      writeJSON(KEYS.bestTimes, bestTimes);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.GameStorage = {
    getStreak:      getStreak,
    recordSolve:    recordSolve,
    getTodaySolve:  getTodaySolve,
    getTotalSolved: getTotalSolved,
    getBestTime:    getBestTime,
    updateBestTime: updateBestTime,
  };

}());
