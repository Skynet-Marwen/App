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

  function simpleHash(input) {
    var text = String(input || '');
    var hash = 0;
    for (var i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  function readCookie(name) {
    var needle = name + '=';
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(needle) === 0) return decodeURIComponent(part.slice(needle.length));
    }
    return null;
  }

  function writeCookie(name, value, maxAgeSeconds) {
    if (!value) return;
    var secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAgeSeconds + '; SameSite=Lax' + secure;
  }

  function getDeviceCookie() {
    return readCookie('_skynet_did');
  }

  var timingState = {
    lastNow: null,
    deltas: [],
    resolutionFloor: null,
  };

  function sampleTimingProfile() {
    if (!window.performance || typeof window.performance.now !== 'function' || typeof window.requestAnimationFrame !== 'function') return;
    window.requestAnimationFrame(function () {
      var now = window.performance.now();
      if (timingState.lastNow !== null) {
        var delta = now - timingState.lastNow;
        if (delta > 0) {
          timingState.deltas.push(delta);
          if (timingState.deltas.length > 18) timingState.deltas.shift();
          var fractional = Math.abs(delta - Math.round(delta));
          if (timingState.resolutionFloor === null || fractional < timingState.resolutionFloor) {
            timingState.resolutionFloor = fractional;
          }
        }
      }
      timingState.lastNow = now;
      sampleTimingProfile();
    });
  }

  function readTimingProfile() {
    if (!timingState.deltas.length) return null;
    var sum = 0;
    var min = timingState.deltas[0];
    var max = timingState.deltas[0];
    for (var i = 0; i < timingState.deltas.length; i++) {
      var delta = timingState.deltas[i];
      sum += delta;
      if (delta < min) min = delta;
      if (delta > max) max = delta;
    }
    return {
      clock_resolution_ms: timingState.resolutionFloor === null ? null : Number(timingState.resolutionFloor.toFixed(4)),
      raf_mean_ms: Number((sum / timingState.deltas.length).toFixed(4)),
      raf_jitter_score: Number((max - min).toFixed(4)),
    };
  }

  function readFingerprintTraits() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var timing = readTimingProfile() || {};
    return {
      hardware_concurrency: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
      device_memory: typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null,
      platform: navigator.platform || null,
      connection_type: connection && connection.effectiveType ? connection.effectiveType : null,
      plugin_count: navigator.plugins ? navigator.plugins.length : null,
      touch_points: typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : null,
      webdriver: typeof navigator.webdriver === 'boolean' ? navigator.webdriver : null,
      timezone_offset_minutes: typeof Date === 'function' ? new Date().getTimezoneOffset() * -1 : null,
      clock_resolution_ms: timing.clock_resolution_ms || null,
      raf_mean_ms: timing.raf_mean_ms || null,
      raf_jitter_score: timing.raf_jitter_score || null,
    };
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

  function buildTrackingPayload(extra) {
    return Object.assign({
      page_url: window.location.href,
      referrer: document.referrer || null,
      fingerprint: buildFingerprint(),
      canvas_hash: canvasFingerprint(),
      webgl_hash: webglFingerprint(),
      screen: screen.width + 'x' + screen.height,
      language: navigator.language,
      timezone: Intl && Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      session_id: getSessionId(),
      device_cookie: getDeviceCookie(),
      fingerprint_traits: readFingerprintTraits(),
    }, extra || {});
  }

  function scopedStorageKey(name) {
    return '_sn_' + name + '::' + API_BASE + '::' + API_KEY;
  }

  function readDeviceContext(fingerprint) {
    try {
      var raw = localStorage.getItem(scopedStorageKey('device_context'));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var cookie = getDeviceCookie();
      if (!parsed) return null;
      if (cookie && parsed.device_cookie === cookie) return parsed;
      if (parsed.fingerprint !== fingerprint) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function readChallengeTokenFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return params.get('skynet_challenge');
    } catch (e) { return null; }
  }

  function readChallengeToken() {
    try {
      var fromUrl = readChallengeTokenFromUrl();
      if (fromUrl) {
        localStorage.setItem(scopedStorageKey('challenge_token'), fromUrl);
        return fromUrl;
      }
      return localStorage.getItem(scopedStorageKey('challenge_token'));
    } catch (e) { return readChallengeTokenFromUrl(); }
  }

  function writeDeviceContext(context) {
    if (!context || !context.device_id) return;
    try {
      if (context.device_cookie) writeCookie('_skynet_did', context.device_cookie, 31536000);
      localStorage.setItem(scopedStorageKey('device_context'), JSON.stringify(context));
    } catch (e) {}
  }

  // ─── Behavior Metrics ────────────────────────────────────────────────────

  var behaviorState = {
    startedAt: Date.now(),
    sentInteractions: 0,
    counts: { click: 0, scroll: 0, pointer: 0, keydown: 0 },
    lastSeenAt: { click: 0, scroll: 0, pointer: 0, keydown: 0 },
    intervals: { click: [], scroll: [], pointer: [], keydown: [] },
  };

  function pushBehaviorInterval(kind, now) {
    var previous = behaviorState.lastSeenAt[kind];
    behaviorState.lastSeenAt[kind] = now;
    if (!previous) return;
    var delta = now - previous;
    if (delta <= 0) return;
    var target = behaviorState.intervals[kind];
    target.push(delta);
    if (target.length > 12) target.shift();
  }

  function recordBehavior(kind, throttleMs) {
    var now = Date.now();
    if (throttleMs && behaviorState.lastSeenAt[kind] && (now - behaviorState.lastSeenAt[kind]) < throttleMs) return;
    behaviorState.counts[kind] += 1;
    pushBehaviorInterval(kind, now);
  }

  function readBehaviorMetrics() {
    var total = behaviorState.counts.click + behaviorState.counts.scroll + behaviorState.counts.pointer + behaviorState.counts.keydown;
    if (!total) return null;
    return {
      total_interactions: total,
      session_duration_ms: Date.now() - behaviorState.startedAt,
      click_count: behaviorState.counts.click,
      scroll_count: behaviorState.counts.scroll,
      pointer_count: behaviorState.counts.pointer,
      keydown_count: behaviorState.counts.keydown,
      click_intervals_ms: behaviorState.intervals.click.slice(),
      scroll_intervals_ms: behaviorState.intervals.scroll.slice(),
      pointer_intervals_ms: behaviorState.intervals.pointer.slice(),
      keydown_intervals_ms: behaviorState.intervals.keydown.slice(),
    };
  }

  function postBehaviorSnapshot() {
    var behavior = readBehaviorMetrics();
    if (!behavior || behavior.total_interactions <= behaviorState.sentInteractions) return;
    behaviorState.sentInteractions = behavior.total_interactions;
    SkyNet.track('behavior_snapshot', { behavior: behavior });
  }

  // ─── Form Signals ────────────────────────────────────────────────────────

  function isPotentialHoneypotField(field) {
    if (!field || !field.name) return false;
    var name = String(field.name || '').toLowerCase();
    var type = String(field.type || '').toLowerCase();
    var hiddenType = type === 'hidden';
    var style = window.getComputedStyle ? window.getComputedStyle(field) : null;
    var visuallyHidden = !!style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0);
    return hiddenType || visuallyHidden || /website|homepage|company|url|fax/.test(name);
  }

  function formSignature(form) {
    if (!form || !form.elements) return null;
    var chunks = [];
    for (var i = 0; i < form.elements.length; i++) {
      var field = form.elements[i];
      if (!field || !field.name || field.disabled) continue;
      var tag = (field.tagName || '').toLowerCase();
      var type = String(field.type || '').toLowerCase();
      if (type === 'password' || type === 'file' || type === 'submit' || type === 'button') continue;
      if (tag !== 'textarea' && tag !== 'input' && tag !== 'select') continue;
      var value = '';
      if (type === 'checkbox' || type === 'radio') {
        value = field.checked ? '1' : '0';
      } else {
        value = String(field.value || '').trim().toLowerCase();
      }
      if (!value) continue;
      chunks.push(field.name.toLowerCase() + ':' + value);
    }
    return chunks.length ? simpleHash(chunks.join('|')) : null;
  }

  function readFormMetadata(form) {
    if (!form || !form.elements) return null;
    var fieldCount = 0;
    var visibleFieldCount = 0;
    var honeypotField = null;
    var honeypotTriggered = false;

    for (var i = 0; i < form.elements.length; i++) {
      var field = form.elements[i];
      if (!field || !field.name || field.disabled) continue;
      fieldCount += 1;
      if (!isPotentialHoneypotField(field)) visibleFieldCount += 1;
      if (!honeypotField && isPotentialHoneypotField(field)) honeypotField = field.name;
      if (isPotentialHoneypotField(field) && String(field.value || '').trim()) honeypotTriggered = true;
    }

    return {
      action: form.getAttribute('action') || window.location.pathname,
      method: (form.getAttribute('method') || 'get').toLowerCase(),
      field_count: fieldCount,
      visible_field_count: visibleFieldCount,
      honeypot_field: honeypotField,
      honeypot_triggered: honeypotTriggered,
      content_signature: formSignature(form),
    };
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

  function requestJson(method, path, data, extraHeaders) {
    var url = API_BASE + path;
    var body = data ? JSON.stringify(data) : null;
    var headers = extraHeaders || {};

    if (typeof fetch !== 'undefined' && typeof Promise !== 'undefined') {
      var fetchHeaders = { 'Content-Type': 'application/json' };
      for (var key in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
          fetchHeaders[key] = headers[key];
        }
      }
      return fetch(url, {
        method: method,
        headers: fetchHeaders,
        body: body,
      }).then(function (response) {
        if (!response.ok) throw new Error('http_' + response.status);
        return response.json();
      });
    }

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      for (var headerName in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, headerName)) {
          xhr.setRequestHeader(headerName, headers[headerName]);
        }
      }
      xhr.onload = function () {
        try {
          if (xhr.status < 200 || xhr.status >= 300) throw new Error('http_' + xhr.status);
          resolve(JSON.parse(xhr.responseText || '{}'));
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = function () { reject(new Error('network_error')); };
      xhr.send(body);
    });
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
    var deviceCookie = getDeviceCookie();
    if (deviceCookie) url += '&dc=' + encodeURIComponent(deviceCookie);
    var challengeToken = readChallengeToken();
    if (challengeToken) url += '&ct=' + encodeURIComponent(challengeToken);

    // Fail open: if check hangs or errors, always proceed with tracking
    function handle(data) {
      if (data && data.blocked) {
        injectBlockPage(data.config || {}, data.request_id || '');
      } else if (data && data.challenge && data.challenge_url) {
        var target = data.challenge_url;
        if (target.indexOf('http://') !== 0 && target.indexOf('https://') !== 0) {
          target = API_BASE + target;
        }
        window.location.href = target;
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

  var deviceContextPromise = null;
  var latestTrackingPayload = null;
  var latestDeviceContext = null;
  var readyCallbacks = [];

  function notifyReady(context) {
    if (!context || !context.device_id) return;
    latestDeviceContext = context;
    while (readyCallbacks.length) {
      try { readyCallbacks.shift()(context); } catch (e) {}
    }
  }

  function resolveDeviceContext(extra) {
    var payload = buildTrackingPayload(extra);
    latestTrackingPayload = payload;

    var cached = readDeviceContext(payload.fingerprint);
    if (cached) {
      notifyReady(cached);
      if (typeof Promise !== 'undefined') return Promise.resolve(cached);
      return cached;
    }

    if (deviceContextPromise) return deviceContextPromise;

    deviceContextPromise = requestJson('POST', '/api/v1/track/device-context', {
      fingerprint: payload.fingerprint,
      canvas_hash: payload.canvas_hash,
      webgl_hash: payload.webgl_hash,
      screen: payload.screen,
      language: payload.language,
      timezone: payload.timezone,
      session_id: payload.session_id,
      device_cookie: payload.device_cookie,
      fingerprint_traits: payload.fingerprint_traits,
      page_url: payload.page_url,
    }, {
      'X-SkyNet-Key': API_KEY,
    }).then(function (context) {
      deviceContextPromise = null;
      if (context && context.device_id) {
        writeDeviceContext(context);
        notifyReady(context);
      }
      return context;
    }).catch(function (error) {
      deviceContextPromise = null;
      throw error;
    });

    return deviceContextPromise;
  }

  var SkyNet = {
    /**
     * Track current page view. Called automatically on load.
     */
    trackPageview: function (extra) {
      var payload = buildTrackingPayload(extra);
      latestTrackingPayload = payload;
      post('pageview', payload);
      return payload;
    },

    /**
     * Track a custom event.
     * @param {string} eventType
     * @param {object} properties
     */
    track: function (eventType, properties) {
      var payload = latestTrackingPayload || buildTrackingPayload();
      var merged = properties || null;
      if (!merged || typeof merged !== 'object') merged = {};
      if (!merged.behavior) {
        var behavior = readBehaviorMetrics();
        if (behavior) merged.behavior = behavior;
      }
      post('event', {
        event_type: eventType,
        page_url: payload.page_url,
        fingerprint: payload.fingerprint,
        properties: Object.keys(merged).length ? merged : null,
        session_id: payload.session_id,
        device_cookie: payload.device_cookie,
      });
    },

    /**
     * Identify the current user (link session/device to a user account).
     * Call this after login.
     * @param {string} userId  — your internal user ID
     * @param {object} traits  — optional extra user traits
     */
    identify: function (userId, traits) {
      var payload = latestTrackingPayload || buildTrackingPayload();
      post('identify', {
        user_id: userId,
        fingerprint: payload.fingerprint,
        traits: traits || null,
        device_cookie: payload.device_cookie,
      });
    },

    /**
     * Resolve the SKYNET device context for the current browser.
     * Returns a Promise when supported by the browser.
     */
    getDeviceContext: function (callback) {
      var payload = latestTrackingPayload || buildTrackingPayload();
      var cached = latestDeviceContext || readDeviceContext(payload.fingerprint);
      if (cached && cached.device_id) {
        latestDeviceContext = cached;
        if (typeof callback === 'function') callback(cached);
        if (typeof Promise !== 'undefined') return Promise.resolve(cached);
        return cached;
      }
      if (typeof callback === 'function') readyCallbacks.push(callback);
      return resolveDeviceContext(payload);
    },

    /**
     * Resolve and return only the SKYNET device UUID (`devices.id`).
     */
    getDeviceId: function (callback) {
      var promise = SkyNet.getDeviceContext();
      if (typeof callback === 'function') {
        if (promise && typeof promise.then === 'function') {
          promise.then(function (context) {
            callback(context ? context.device_id : null);
          }).catch(function () {
            callback(null);
          });
        } else {
          callback(promise ? promise.device_id : null);
        }
      }
      if (promise && typeof promise.then === 'function') {
        return promise.then(function (context) {
          return context ? context.device_id : null;
        });
      }
      return promise ? promise.device_id : null;
    },

    /**
     * Run callback once device context has been resolved.
     */
    onReady: function (callback) {
      if (typeof callback !== 'function') return;
      if (latestDeviceContext && latestDeviceContext.device_id) {
        callback(latestDeviceContext);
        return;
      }
      readyCallbacks.push(callback);
      resolveDeviceContext();
    },

    /**
     * Expose the raw tracker fingerprint for debugging or server-side exchange.
     */
    getFingerprint: function () {
      var payload = latestTrackingPayload || buildTrackingPayload();
      latestTrackingPayload = payload;
      return payload.fingerprint;
    },

    getBehaviorMetrics: function () {
      return readBehaviorMetrics();
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
    var payload = buildTrackingPayload();
    latestTrackingPayload = payload;
    checkAccess(payload.fingerprint, function () {
      // Not blocked — proceed with normal tracking
      resolveDeviceContext(payload).catch(function () {});
      if (sn.auto !== false) { post('pageview', payload); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoTrack);
  } else {
    autoTrack();
  }
  sampleTimingProfile();

  document.addEventListener('click', function () { recordBehavior('click'); }, true);
  document.addEventListener('keydown', function () { recordBehavior('keydown'); }, true);
  document.addEventListener('mousemove', function () { recordBehavior('pointer', 700); }, true);
  document.addEventListener('scroll', function () { recordBehavior('scroll', 900); }, true);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') postBehaviorSnapshot();
  });
  window.addEventListener('pagehide', postBehaviorSnapshot);
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return;
    SkyNet.track('form_submit', { form: readFormMetadata(form) });
  }, true);

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
