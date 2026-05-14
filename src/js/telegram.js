/**
 * telegram.js — Telegram WebApp SDK integration for GridSum Daily
 * Vanilla JS, no imports. Exposes window.TG.
 * Assumes telegram-web-app.js is already loaded in index.html.
 */

(function () {
  'use strict';

  /** Safely get the Telegram WebApp object (may not exist in browser) */
  function twa() {
    return (window.Telegram && window.Telegram.WebApp) || null;
  }

  /**
   * Returns true when the app is running inside a Telegram client.
   */
  function isAvailable() {
    var wa = twa();
    // initData is populated only when launched from Telegram
    return !!(wa && wa.initData);
  }

  /**
   * Initialise the Telegram WebApp: signal readiness and expand to full height.
   * Safe to call even outside Telegram.
   */
  function init() {
    var wa = twa();
    if (!wa) return;

    try { wa.ready(); }   catch (e) { /* ignore */ }
    try { wa.expand(); }  catch (e) { /* ignore */ }
  }

  /**
   * Share text via Telegram inline query, falling back to clipboard copy.
   * @param {string} text - text to share
   */
  function share(text) {
    var wa = twa();

    if (wa && typeof wa.switchInlineQuery === 'function') {
      try {
        wa.switchInlineQuery(text, ['users', 'groups', 'channels']);
        return;
      } catch (e) {
        // switchInlineQuery failed — fall through to clipboard
      }
    }

    // Clipboard fallback
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).catch(function () {
        // Silent failure — clipboard write not permitted
      });
    } else {
      // Legacy execCommand fallback
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
        console.warn('telegram.js: share() — clipboard not available');
      }
    }
  }

  /**
   * Trigger haptic feedback.
   * @param {string} type - 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
   */
  function haptic(type) {
    try {
      var wa = twa();
      if (wa && wa.HapticFeedback && typeof wa.HapticFeedback.impactOccurred === 'function') {
        wa.HapticFeedback.impactOccurred(type || 'medium');
      }
    } catch (e) {
      // HapticFeedback not available on this client — silently ignore
    }
  }

  /**
   * Returns 'dark' or 'light' based on the Telegram theme.
   * Falls back to system preference, then 'light'.
   */
  function getTheme() {
    var wa = twa();
    if (wa && wa.colorScheme) {
      return wa.colorScheme === 'dark' ? 'dark' : 'light';
    }

    // System preference fallback
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  // ── Initialise on load ─────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.TG = {
    isAvailable: isAvailable,
    share:       share,
    haptic:      haptic,
    getTheme:    getTheme,
  };

}());
