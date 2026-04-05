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
  var PATHS = sn.paths || {};

  function resolvePath(name, fallback) {
    var path = PATHS[name];
    return path || fallback;
  }

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

  function simpleHash(input) {
    var text = String(input || '');
    var hash = 0;
    for (var i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  function browserBrandSignature() {
    try {
      if (!navigator.userAgentData || !navigator.userAgentData.brands) return null;
      var brands = navigator.userAgentData.brands.slice().map(function (item) {
        return String(item.brand || '') + ':' + String(item.version || '');
      });
      brands.sort();
      return brands.join('|');
    } catch (e) { return null; }
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

  function readStoredDeviceCookie() {
    try {
      var raw = localStorage.getItem('_sn_device_context::' + API_BASE + '::' + API_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.device_cookie ? parsed.device_cookie : null;
    } catch (e) { return null; }
  }

  function getDeviceCookie() {
    return readCookie('_skynet_did') || readStoredDeviceCookie();
  }

  var runtimeProbeState = {
    js_active: true,
    adblock_dom_bait_blocked: false,
    adblock_same_origin_probe_blocked: null,
    remote_ad_probe_blocked: null,
    adblocker_detected: false,
    dns_filter_suspected: false,
    blocker_family: null,
  };
  var runtimeProbePromise = null;

  // WebRTC leak probe state — populated by detectWebRTCLeak()
  var webrtcProbeState = {
    webrtc_available: null,
    webrtc_local_ip_count: null,
    webrtc_vpn_suspected: null,
    webrtc_leak_detected: null,
    webrtc_stun_reachable: null,
  };

  // Detect VPN/proxy leaks via WebRTC ICE candidates.
  // Returns a Promise that resolves with webrtcProbeState.
  // Privacy: no raw IP strings are stored or sent — only derived booleans/counts.
  function detectWebRTCLeak() {
    if (typeof Promise === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      webrtcProbeState.webrtc_available = false;
      return Promise.resolve(webrtcProbeState);
    }
    webrtcProbeState.webrtc_available = true;
    return new Promise(function (resolve) {
      var settled = false;
      var localIPs = {};
      var stunReachable = false;

      function finish() {
        if (settled) return;
        settled = true;
        var privateCount = 0;
        for (var ip in localIPs) {
          if (localIPs[ip] === 'private') privateCount += 1;
        }
        webrtcProbeState.webrtc_local_ip_count = privateCount;
        webrtcProbeState.webrtc_stun_reachable = stunReachable;
        webrtcProbeState.webrtc_vpn_suspected = privateCount > 0;
        // webrtc_leak_detected is resolved server-side by comparing to HTTP request IP
        webrtcProbeState.webrtc_leak_detected = null;
        try { pc.close(); } catch (e) {}
        resolve(webrtcProbeState);
      }

      var timer = setTimeout(finish, 2000);
      var pc;
      try {
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      } catch (e) {
        webrtcProbeState.webrtc_available = false;
        clearTimeout(timer);
        resolve(webrtcProbeState);
        return;
      }

      pc.createDataChannel('');
      pc.onicecandidate = function (e) {
        if (!e || !e.candidate || !e.candidate.candidate) {
          // null candidate = ICE gathering complete
          stunReachable = true;
          clearTimeout(timer);
          finish();
          return;
        }
        var candidate = e.candidate.candidate;
        var matches = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/g) || [];
        for (var i = 0; i < matches.length; i++) {
          var ip = matches[i];
          var isPrivate = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(ip);
          localIPs[ip] = isPrivate ? 'private' : 'public';
          if (!isPrivate) stunReachable = true;
        }
      };
      pc.createOffer()
        .then(function (offer) { return pc.setLocalDescription(offer); })
        .catch(function () { clearTimeout(timer); finish(); });
    });
  }

  function finalizeRuntimeProbeState() {
    var brave = detectBraveOrBuiltinShields();
    runtimeProbeState.adblocker_detected = !!(
      runtimeProbeState.adblock_dom_bait_blocked ||
      runtimeProbeState.adblock_same_origin_probe_blocked ||
      brave
    );
    runtimeProbeState.dns_filter_suspected = !!(runtimeProbeState.remote_ad_probe_blocked && !runtimeProbeState.adblocker_detected);
    if (brave) {
      runtimeProbeState.blocker_family = 'brave_shields';
    } else if (runtimeProbeState.adblocker_detected) {
      runtimeProbeState.blocker_family = 'extension_like';
    } else if (runtimeProbeState.dns_filter_suspected) {
      runtimeProbeState.blocker_family = 'dns_or_network_filter';
    } else {
      runtimeProbeState.blocker_family = null;
    }
    return runtimeProbeState;
  }

  function probeDomAdblock() {
    try {
      var container = document.body || document.documentElement;
      if (!container) return false;
      var bait = document.createElement('div');
      // Class names targeted by EasyList cosmetic filters and uBlock Origin
      bait.className = 'adsbox pub_300x250 pub_300x250m text-ad banner-ad ad-placement ad-zone ad-banner advertisement';
      bait.setAttribute('data-ad', 'true');
      bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;';
      container.appendChild(bait);
      var style = window.getComputedStyle ? window.getComputedStyle(bait) : null;
      var blocked = !!style && (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0 ||
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0 ||
        bait.clientHeight === 0
      );
      bait.remove();
      return blocked;
    } catch (e) { return false; }
  }

  function detectBraveOrBuiltinShields() {
    // Brave exposes navigator.brave; also catches fingerprinting resistance
    try {
      if (navigator.brave && typeof navigator.brave.isBrave === 'function') return true;
    } catch (e) {}
    return false;
  }

  function probeSameOriginFilter() {
    if (typeof Promise === 'undefined') return null;
    return new Promise(function (resolve) {
      var token = 'sn-probe-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      var url = API_BASE + '/ads.js?skynet_probe=' + encodeURIComponent(token) + '&k=' + encodeURIComponent(API_KEY);
      var target = document.head || document.body || document.documentElement;
      var registry = window.__skynetAdProbeHits = window.__skynetAdProbeHits || {};
      var script = document.createElement('script');
      var done = false;

      if (!target) {
        resolve(false);
        return;
      }

      registry[token] = false;

      function cleanup() {
        script.onload = null;
        script.onerror = null;
        if (script.parentNode) script.parentNode.removeChild(script);
        delete registry[token];
      }

      function finish(blocked) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        var executed = !!registry[token];
        cleanup();
        resolve(Boolean(blocked || !executed));
      }

      var timer = setTimeout(function () { finish(true); }, 1200);
      script.async = true;
      script.src = url;
      script.onload = function () { finish(false); };
      script.onerror = function () { finish(true); };
      target.appendChild(script);
    });
  }

  function probeRemoteAdFilter() {
    if (typeof Promise === 'undefined') return null;
    var url = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?skynet_probe=' + Date.now();
    if (typeof fetch === 'function') {
      return fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
        .then(function () { return false; })
        .catch(function () { return true; });
    }
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(true);
      }, 1200);
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(false);
      };
      img.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(true);
      };
      img.src = url;
    });
  }

  function startRuntimeProbes() {
    if (runtimeProbePromise || typeof Promise === 'undefined') return runtimeProbePromise;

    // Brave/built-in shield detection is synchronous — safe to do immediately
    if (detectBraveOrBuiltinShields()) {
      runtimeProbeState.adblock_dom_bait_blocked = true;
    }

    runtimeProbePromise = new Promise(function (resolve) {
      var settled = false;
      var pending = 0;

      function finish() {
        if (settled) return;
        settled = true;
        resolve(finalizeRuntimeProbeState());
      }

      function markDone() {
        pending -= 1;
        if (pending <= 0) finish();
      }

      // Hard deadline: all probes must finish within 1200ms
      setTimeout(finish, 1200);

      // DOM bait: run after 150ms so ad blocker extensions have time
      // to inject their CSS cosmetic filter rules into the page
      pending += 1;
      setTimeout(function () {
        if (!runtimeProbeState.adblock_dom_bait_blocked) {
          runtimeProbeState.adblock_dom_bait_blocked = probeDomAdblock();
        }
        markDone();
      }, 150);

      var sameOrigin = probeSameOriginFilter();
      if (sameOrigin && typeof sameOrigin.then === 'function') {
        pending += 1;
        sameOrigin.then(function (blocked) {
          runtimeProbeState.adblock_same_origin_probe_blocked = blocked;
        }).finally(markDone);
      }

      var remote = probeRemoteAdFilter();
      if (remote && typeof remote.then === 'function') {
        pending += 1;
        remote.then(function (blocked) {
          runtimeProbeState.remote_ad_probe_blocked = blocked;
        }).finally(markDone);
      }

      var webrtcProbe = detectWebRTCLeak();
      if (webrtcProbe && typeof webrtcProbe.then === 'function') {
        pending += 1;
        webrtcProbe.finally(markDone);
      }

      if (pending === 0) finish();
    });

    return runtimeProbePromise;
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
    finalizeRuntimeProbeState();
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
      js_active: true,
      adblock_dom_bait_blocked: runtimeProbeState.adblock_dom_bait_blocked,
      adblock_same_origin_probe_blocked: runtimeProbeState.adblock_same_origin_probe_blocked,
      remote_ad_probe_blocked: runtimeProbeState.remote_ad_probe_blocked,
      adblocker_detected: runtimeProbeState.adblocker_detected,
      dns_filter_suspected: runtimeProbeState.dns_filter_suspected,
      blocker_family: runtimeProbeState.blocker_family,
      webrtc_available: webrtcProbeState.webrtc_available,
      webrtc_local_ip_count: webrtcProbeState.webrtc_local_ip_count,
      webrtc_vpn_suspected: webrtcProbeState.webrtc_vpn_suspected,
      webrtc_leak_detected: webrtcProbeState.webrtc_leak_detected,
      webrtc_stun_reachable: webrtcProbeState.webrtc_stun_reachable,
    };
  }

  function collectFingerprintInputs() {
    return {
      canvas_hash: canvasFingerprint(),
      webgl_hash: webglFingerprint(),
      fingerprint_traits: readFingerprintTraits(),
    };
  }

  function buildFingerprintFromInputs(inputs) {
    var traits = (inputs && inputs.fingerprint_traits) || {};
    var timezone = null;
    try {
      timezone = Intl && Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {}
    var components = {
      user_agent: navigator.userAgent || null,
      user_agent_brands: browserBrandSignature(),
      language: navigator.language || null,
      languages: navigator.languages ? navigator.languages.slice(0, 3) : null,
      screen: screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      avail_screen: screen.availWidth + 'x' + screen.availHeight,
      pixel_ratio: typeof window.devicePixelRatio === 'number' ? Number(window.devicePixelRatio.toFixed(4)) : null,
      timezone: timezone,
      timezone_offset_minutes: traits.timezone_offset_minutes || null,
      platform: navigator.platform || traits.platform || null,
      hardware_concurrency: traits.hardware_concurrency || null,
      device_memory: traits.device_memory || null,
      plugin_count: traits.plugin_count || null,
      touch_points: traits.touch_points || null,
      webdriver: typeof traits.webdriver === 'boolean' ? traits.webdriver : null,
      storage: {
        session: !!window.sessionStorage,
        local: !!window.localStorage,
        indexeddb: !!window.indexedDB,
        open_database: !!window.openDatabase,
      },
      canvas_hash: (inputs && inputs.canvas_hash) || null,
      webgl_hash: (inputs && inputs.webgl_hash) || null,
    };
    var canonical = JSON.stringify(components);
    var head = simpleHash(canonical).padStart(8, '0').slice(-8);
    var tail = simpleHash(canonical.split('').reverse().join('')).padStart(8, '0').slice(-8);
    return head + '-' + tail;
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
    var fingerprintInputs = collectFingerprintInputs();
    var timezone = null;
    try {
      timezone = Intl && Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {}
    return Object.assign({
      page_url: window.location.href,
      referrer: document.referrer || null,
      fingerprint: buildFingerprintFromInputs(fingerprintInputs),
      canvas_hash: fingerprintInputs.canvas_hash,
      webgl_hash: fingerprintInputs.webgl_hash,
      screen: screen.width + 'x' + screen.height,
      language: navigator.language,
      timezone: timezone,
      session_id: getSessionId(),
      device_cookie: getDeviceCookie(),
      fingerprint_traits: fingerprintInputs.fingerprint_traits,
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
    var routeMap = {
      pageview: resolvePath('pageview', '/api/v1/track/pageview'),
      event: resolvePath('event', '/api/v1/track/event'),
      identify: resolvePath('identify', '/api/v1/track/identify')
    };
    var url = API_BASE + (routeMap[endpoint] || ('/api/v1/track/' + endpoint));
    var body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: 'application/json' });
      var sendUrl = url;
      if (sendUrl.indexOf('/api/v1/track/') !== -1) {
        sendUrl += '?key=' + API_KEY;
      }
      navigator.sendBeacon(sendUrl, blob);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (url.indexOf('/api/v1/track/') !== -1) {
        xhr.setRequestHeader('X-SkyNet-Key', API_KEY);
      }
      xhr.send(body);
    }
  }

  function requestJson(method, path, data, extraHeaders) {
    var url = API_BASE + path;
    var body = data ? JSON.stringify(data) : null;
    var headers = extraHeaders || {};
    var headerSiteKey = headers['X-SkyNet-Key'] || headers['x-skynet-key'] || '';
    if (headerSiteKey) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + 'site_key=' + encodeURIComponent(headerSiteKey);
    }

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
    var accessPath = resolvePath('check_access', '/api/v1/track/check-access');
    var url = API_BASE + accessPath;
    if (accessPath.indexOf('/api/v1/track/') !== -1) {
      url += '?key=' + encodeURIComponent(API_KEY) + '&fp=' + encodeURIComponent(fp);
    } else {
      url += '?fp=' + encodeURIComponent(fp);
    }
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

    deviceContextPromise = requestJson('POST', resolvePath('device_context', '/api/v1/track/device-context'), {
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
      var accessPath = resolvePath('check_access', '/api/v1/track/check-access');
      var url = API_BASE + accessPath;
      if (accessPath.indexOf('/api/v1/track/') !== -1) {
        url += '?key=' + encodeURIComponent(API_KEY) + '&fp=' + encodeURIComponent(SkyNet.getFingerprint());
      } else {
        url += '?fp=' + encodeURIComponent(SkyNet.getFingerprint());
      }
      xhr.open('GET', url, true);
      if (accessPath.indexOf('/api/v1/track/') !== -1) {
        xhr.setRequestHeader('X-SkyNet-Key', API_KEY);
      }
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
    function proceed() {
      var payload = buildTrackingPayload();
      latestTrackingPayload = payload;
      checkAccess(payload.fingerprint, function () {
        // Not blocked — proceed with normal tracking
        resolveDeviceContext(payload).catch(function () {});
        if (sn.auto !== false) { post('pageview', payload); }
      });
    }

    if (runtimeProbePromise && typeof runtimeProbePromise.then === 'function') {
      runtimeProbePromise.finally(proceed);
      return;
    }
    proceed();
  }

  startRuntimeProbes();
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
  window.__skynetTrackerReady = true;
  window._skynet = sn;

})(window, document);
