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

  // ─── Block Page Enforcement ───────────────────────────────────────────────

  function injectBlockPage(cfg, requestId) {
    var bg      = cfg.bg_color     || '#050505';
    var accent  = cfg.accent_color || '#ef4444';
    var title   = cfg.title        || 'ACCESS RESTRICTED';
    var sub     = cfg.subtitle     || 'Your access has been blocked.';
    var msg     = cfg.message      || '';

    document.documentElement.style.overflow = 'hidden';

    var el = document.createElement('div');
    el.id = '_sn_block_overlay';
    el.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
      'background:' + bg,
    ].join(';');

    var parts = [
      '<div style="text-align:center;max-width:460px;padding:40px 32px;',
        'border:1px solid ' + accent + '33;',
        'background:rgba(255,255,255,0.02);',
        'box-shadow:0 0 40px ' + accent + '18,inset 0 0 40px rgba(0,0,0,0.3)">',
      cfg.logo_url
        ? '<img src="' + cfg.logo_url + '" style="height:44px;margin-bottom:24px;display:block;margin-left:auto;margin-right:auto" />'
        : '',
      '<div style="width:52px;height:52px;border:1.5px solid ' + accent + ';border-radius:50%;',
        'display:flex;align-items:center;justify-content:center;',
        'margin:0 auto 20px;color:' + accent + ';font-size:22px;',
        'box-shadow:0 0 16px ' + accent + '55">&#10005;</div>',
      '<h1 style="color:' + accent + ';font-size:16px;margin:0 0 10px;letter-spacing:0.15em;font-weight:700">',
        title, '</h1>',
      '<p style="color:#9ca3af;font-size:13px;margin:0 0 14px;line-height:1.5">', sub, '</p>',
      msg ? '<p style="color:#6b7280;font-size:11px;margin:0 0 20px;line-height:1.6">' + msg + '</p>' : '',
      cfg.show_request_id && requestId
        ? '<code style="color:#374151;font-size:10px;display:block;margin-bottom:16px;letter-spacing:0.08em">REQ#' + requestId + '</code>'
        : '',
      cfg.show_contact && cfg.contact_email
        ? '<a href="mailto:' + cfg.contact_email + '" style="color:' + accent + ';font-size:12px;text-decoration:none">'
          + cfg.contact_email + '</a>'
        : '',
      '</div>',
    ];

    el.innerHTML = parts.join('');
    document.documentElement.appendChild(el);
  }

  function checkAccess(fp, onClear) {
    var url = API_BASE + '/api/v1/track/check-access?key=' + encodeURIComponent(API_KEY) + '&fp=' + encodeURIComponent(fp);

    // Fail open: if check hangs or errors, always proceed with tracking
    function handle(data) {
      if (data && data.blocked) {
        injectBlockPage(data.config || {}, data.request_id || '');
      } else {
        onClear();
      }
    }

    if (typeof fetch !== 'undefined' && typeof AbortController !== 'undefined') {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 3000);
      fetch(url, { method: 'GET', signal: ctrl.signal })
        .then(function (r) { clearTimeout(timer); return r.json(); })
        .then(handle)
        .catch(function () { clearTimeout(timer); onClear(); });
    } else {
      // Fallback: XHR with timeout
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 3000;
      xhr.onload = function () {
        try { handle(JSON.parse(xhr.responseText)); }
        catch (e) { onClear(); }
      };
      xhr.onerror = function () { onClear(); };
      xhr.ontimeout = function () { onClear(); };
      xhr.send();
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

  // ─── Auto-track (with block check first) ─────────────────────────────────

  function autoTrack() {
    var fp = buildFingerprint();
    checkAccess(fp, function () {
      // Not blocked — proceed with normal tracking
      if (sn.auto !== false) { SkyNet.trackPageview(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoTrack);
  } else {
    autoTrack();
  }

  // SPA support: re-check and re-track on navigation
  var _pushState = history.pushState;
  history.pushState = function () {
    _pushState.apply(history, arguments);
    setTimeout(autoTrack, 0);
  };
  window.addEventListener('popstate', autoTrack);

  window.SkyNet = SkyNet;
  window._skynet = sn;

})(window, document);
