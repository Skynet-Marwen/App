/*!
 * SkyNet Tracker v1.0.0
 * Self-Hosted Visitor & Security Tracking
 * Drop this script on any website to start tracking.
 */
(function (window, document) {
  'use strict';

  var sn = window._skynet || {};
  var API_BASE = sn.api || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.indexOf('skynet.js') > -1) {
        return src.replace('/tracker/skynet.js', '');
      }
    }
    return '';
  })();

  var API_KEY = sn.key || '';
  if (!API_KEY) { console.warn('[SkyNet] No API key configured.'); return; }

  // ─── Fingerprinting ───────────────────────────────────────────────────────

  function canvasFingerprint() {
    try {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = 200; canvas.height = 40;
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60'; ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069'; ctx.fillText('SkyNet', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'; ctx.fillText('SkyNet', 4, 17);
      return canvas.toDataURL().slice(-50);
    } catch (e) { return null; }
  }

  function webglFingerprint() {
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return null;
      var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return null;
      var renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      var vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      return btoa(vendor + '::' + renderer).slice(0, 32);
    } catch (e) { return null; }
  }

  function buildFingerprint() {
    var components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage,
      !!window.indexedDB,
      !!window.openDatabase,
      navigator.cpuClass || '',
      navigator.platform || '',
      navigator.plugins ? navigator.plugins.length : 0,
      canvasFingerprint() || '',
    ];
    // Simple hash
    var str = components.join('###');
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0') + '-' +
      Math.abs(str.length).toString(16).padStart(8, '0');
  }

  // ─── Session ──────────────────────────────────────────────────────────────

  function getSessionId() {
    try {
      var id = sessionStorage.getItem('_sn_sid');
      if (!id) {
        id = 'sn-' + Math.random().toString(36).slice(2);
        sessionStorage.setItem('_sn_sid', id);
      }
      return id;
    } catch (e) { return 'nostorage'; }
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  function post(endpoint, data) {
    var url = API_BASE + '/api/v1/track/' + endpoint;
    var body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url + '?key=' + API_KEY, blob);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-SkyNet-Key', API_KEY);
      xhr.send(body);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  var SkyNet = {
    /**
     * Track current page view. Called automatically on load.
     */
    trackPageview: function (extra) {
      post('pageview', Object.assign({
        page_url: window.location.href,
        referrer: document.referrer || null,
        fingerprint: buildFingerprint(),
        canvas_hash: canvasFingerprint(),
        webgl_hash: webglFingerprint(),
        screen: screen.width + 'x' + screen.height,
        language: navigator.language,
        timezone: Intl && Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        session_id: getSessionId(),
      }, extra || {}));
    },

    /**
     * Track a custom event.
     * @param {string} eventType
     * @param {object} properties
     */
    track: function (eventType, properties) {
      post('event', {
        event_type: eventType,
        page_url: window.location.href,
        fingerprint: buildFingerprint(),
        properties: properties || null,
        session_id: getSessionId(),
      });
    },

    /**
     * Identify the current user (link session/device to a user account).
     * Call this after login.
     * @param {string} userId  — your internal user ID
     * @param {object} traits  — optional extra user traits
     */
    identify: function (userId, traits) {
      post('identify', {
        user_id: userId,
        fingerprint: buildFingerprint(),
        traits: traits || null,
      });
    },

    /**
     * Check if the current visitor's IP is blocked.
     * Calls callback(isBlocked: boolean).
     */
    checkBlocked: function (callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', API_BASE + '/api/v1/track/check/ip?fingerprint=' + buildFingerprint(), true);
      xhr.setRequestHeader('X-SkyNet-Key', API_KEY);
      xhr.onload = function () {
        try {
          var res = JSON.parse(xhr.responseText);
          callback(res.blocked === true);
        } catch (e) { callback(false); }
      };
      xhr.onerror = function () { callback(false); };
      xhr.send();
    },
  };

  // ─── Auto-track ───────────────────────────────────────────────────────────

  if (sn.auto !== false) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { SkyNet.trackPageview(); });
    } else {
      SkyNet.trackPageview();
    }
  }

  // SPA support: re-track on history push
  var _pushState = history.pushState;
  history.pushState = function () {
    _pushState.apply(history, arguments);
    setTimeout(function () { SkyNet.trackPageview(); }, 0);
  };
  window.addEventListener('popstate', function () { SkyNet.trackPageview(); });

  window.SkyNet = SkyNet;
  window._skynet = sn;

})(window, document);
