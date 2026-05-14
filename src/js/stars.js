/**
 * stars.js — Telegram Stars payment integration for GridSum Daily
 * Vanilla JS, no imports. Exposes window.Stars.
 *
 * Requires a backend URL injected at runtime via window.GRIDSUM_BACKEND_URL.
 * Falls back to dev/stub mode (confirm dialogs) when BACKEND_URL is empty.
 *
 * Depends on: telegram.js (window.TG must be loaded first)
 */

(function () {
  'use strict';

  var BACKEND_URL = window.GRIDSUM_BACKEND_URL || '';

  window.Stars = {
    FREE_HINTS_PER_SESSION: 2,

    isAvailable: function () {
      return window.TG && TG.isAvailable() && BACKEND_URL !== '';
    },

    // Fetch an invoice link from backend, open it via Telegram WebApp
    // onSuccess(hintsGranted) called if payment succeeds
    buyHints: function (count, onSuccess) {
      var product = count <= 3 ? 'hints_3' : 'hints_5';
      var hintsGranted = count <= 3 ? 3 : 5;

      if (!BACKEND_URL) {
        // No backend configured — grant freely (dev/stub mode)
        if (confirm('💡 Buy ' + hintsGranted + ' hints? (Dev mode: free)')) {
          onSuccess(hintsGranted);
        }
        return;
      }

      fetch(BACKEND_URL + '/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: product })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var link = data.link;
        var error = data.error;
        if (error || !link) throw new Error(error || 'No link returned');
        Telegram.WebApp.openInvoice(link, function (status) {
          if (status === 'paid') onSuccess(hintsGranted);
        });
      })
      .catch(function (err) {
        console.error('Stars.buyHints failed:', err);
        alert('Payment unavailable. Please try again.');
      });
    },

    buyStreakRestore: function (onSuccess) {
      if (!BACKEND_URL) {
        if (confirm('🔥 Restore streak? (Dev mode: free)')) onSuccess();
        return;
      }

      fetch(BACKEND_URL + '/api/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'streak_restore' })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var link = data.link;
        var error = data.error;
        if (error || !link) throw new Error(error || 'No link');
        Telegram.WebApp.openInvoice(link, function (status) {
          if (status === 'paid') onSuccess();
        });
      })
      .catch(function (err) {
        console.error('Stars.buyStreakRestore failed:', err);
        alert('Payment unavailable. Please try again.');
      });
    }
  };

}());
