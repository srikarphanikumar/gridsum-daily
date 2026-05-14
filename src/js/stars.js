/**
 * stars.js — Telegram Stars payment stub for GridSum Daily (V1)
 * Vanilla JS, no imports. Exposes window.Stars.
 *
 * V1 NOTE: Telegram Stars payments require a bot backend to create invoices.
 * This module uses confirm() dialogs as placeholders.
 * When the bot backend is ready, replace the confirm() calls with
 * Telegram.WebApp.openInvoice(invoiceLink, callback).
 *
 * Depends on: telegram.js (window.TG must be loaded first)
 */

(function () {
  'use strict';

  /**
   * Show a Stars purchase confirmation dialog and call onSuccess if accepted.
   * @param {string}   message   - dialog message shown to user
   * @param {function} onSuccess - called with no arguments when confirmed
   */
  function confirmPurchase(message, onSuccess) {
    // In V1 we use the browser confirm dialog as a placeholder.
    // When the bot backend is available, replace this with:
    //   Telegram.WebApp.openInvoice(invoiceLink, function(status) {
    //     if (status === 'paid') onSuccess();
    //   });
    var confirmed = window.confirm(message);
    if (confirmed && typeof onSuccess === 'function') {
      onSuccess();
    }
  }

  /**
   * Purchase hint pack.
   * V1 stub: shows confirmation dialog, then calls onSuccess immediately.
   * @param {number}   count     - number of hints (currently fixed at 3 for 30 Stars)
   * @param {function} onSuccess - called when purchase is confirmed
   */
  function buyHints(count, onSuccess) {
    var starCost = 30;
    var hintCount = count || 3;
    confirmPurchase(
      'Spend ' + starCost + ' Stars for ' + hintCount + ' hints?',
      onSuccess
    );
  }

  /**
   * Purchase streak restore.
   * V1 stub: shows confirmation dialog, then calls onSuccess immediately.
   * @param {function} onSuccess - called when purchase is confirmed
   */
  function buyStreakRestore(onSuccess) {
    confirmPurchase(
      'Spend 50 Stars to restore streak?',
      onSuccess
    );
  }

  /**
   * Returns true if Stars purchases are available (i.e. running inside Telegram).
   */
  function isAvailable() {
    return window.TG ? window.TG.isAvailable() : false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.Stars = {
    buyHints:          buyHints,
    buyStreakRestore:  buyStreakRestore,
    isAvailable:       isAvailable,
  };

}());
