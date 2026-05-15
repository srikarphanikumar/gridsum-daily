/**
 * puzzles.js — Puzzle loader for GridSum Daily
 * Vanilla JS, no imports. Sets window.PUZZLE and dispatches 'puzzleReady'.
 */

(function () {
  'use strict';

  var CACHE_KEY = 'gridsum_puzzles_cache';
  var PUZZLES_URL = 'data/puzzles.json';

  /** Return today's local date as YYYY-MM-DD */
  function todayString() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  /** Days elapsed since Unix epoch in local time */
  function daysSinceEpoch() {
    var now = new Date();
    var localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor(localMidnight.getTime() / 86400000);
  }

  /** Select a puzzle from the list using today's date or fallback index */
  function selectPuzzle(puzzles) {
    var today = todayString();

    // Try exact date match first
    for (var i = 0; i < puzzles.length; i++) {
      if (puzzles[i].date === today) {
        return puzzles[i];
      }
    }

    // Fallback: wrap index based on days since epoch
    var idx = daysSinceEpoch() % puzzles.length;
    return puzzles[idx];
  }

  /** Persist puzzles array to localStorage for offline use */
  function cacheToStorage(puzzles) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(puzzles));
    } catch (e) {
      // Storage quota exceeded or unavailable — silently ignore
    }
  }

  /** Read cached puzzles from localStorage */
  function readFromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // Corrupt data — ignore
    }
    return null;
  }

  /** Dispatch 'puzzleReady' on document once window.PUZZLE is set */
  function dispatchReady() {
    var evt;
    try {
      evt = new CustomEvent('puzzleReady', { detail: window.PUZZLE });
    } catch (e) {
      // IE fallback
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('puzzleReady', true, false, window.PUZZLE);
    }
    document.dispatchEvent(evt);
  }

  /** Initialise from a resolved puzzles array */
  function initFromPuzzles(puzzles) {
    window.PUZZLE_BANK = puzzles;
    window.PUZZLE = selectPuzzle(puzzles);
    dispatchReady();
  }

  /** Public: get puzzle by zero-based index (wraps around) */
  window.getPuzzleByIndex = function (n) {
    var puzzles = readFromCache();
    if (!puzzles || puzzles.length === 0) {
      console.warn('getPuzzleByIndex: puzzle cache not available yet.');
      return null;
    }
    return puzzles[((n % puzzles.length) + puzzles.length) % puzzles.length];
  };

  /**
   * Public: get a puzzle for the given mode and sessionIndex.
   * mode = 'daily' | 'easy' | 'medium' | 'hard'
   * sessionIndex = 0-based integer, defaults to 0
   */
  window.getPuzzleForMode = function (mode, sessionIndex) {
    var idx = (typeof sessionIndex === 'number') ? sessionIndex : 0;
    var bank = window.PUZZLE_BANK;
    if (!bank || bank.length === 0) {
      // Try reading from cache as fallback
      bank = readFromCache();
      if (!bank || bank.length === 0) return null;
    }

    if (mode === 'daily') {
      return selectPuzzle(bank);
    }

    // Filter by difficulty
    var filtered = bank.filter(function (p) {
      return p.difficulty === mode;
    });

    if (filtered.length === 0) {
      // No puzzles of that difficulty — fall back to full bank
      filtered = bank;
    }

    return filtered[((idx % filtered.length) + filtered.length) % filtered.length];
  };

  // Expose empty bank array immediately so callers can check readiness
  window.PUZZLE_BANK = [];

  /** Fetch puzzles.json, fall back to cache on failure */
  function loadPuzzles() {
    fetch(PUZZLES_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (puzzles) {
        cacheToStorage(puzzles);
        initFromPuzzles(puzzles);
      })
      .catch(function (err) {
        console.warn('puzzles.js: fetch failed (' + err.message + '), trying cache.');
        var cached = readFromCache();
        if (cached && cached.length > 0) {
          initFromPuzzles(cached);
        } else {
          console.error('puzzles.js: no cache available and fetch failed.');
          // Dispatch event with null so consumers can show an error state
          window.PUZZLE = null;
          dispatchReady();
        }
      });
  }

  // Kick off on DOM ready (or immediately if already ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPuzzles);
  } else {
    loadPuzzles();
  }
}());
