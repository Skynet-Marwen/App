# SkyNet — Development Plan

> Update this file at the start and end of every work session.
> This is the single source of truth for project state.

---

## Current Version: `1.7.4`
## Phase: Identity model fixes (retroactive attribution, tor_vpn heuristic, dual-model link, anti-evasion coverage)

---

## In Progress

- [ ] Run migrations 0005–0011 in all deployment environments
- [ ] Tune and validate `group_escalation_*` thresholds on real traffic before enabling the feature in production runtime settings
- [ ] Tune adblock / DNS-filter / ISP-unresolved actions on real traffic before moving them above `flag` for protected applications
- [ ] Tune `language_mismatch_allowed_languages_by_country` for multilingual markets before using `LANGUAGE_MISMATCH` as more than a low-noise supporting signal

## Blocked / Deferred

- [ ] **Adblocker browser detection — DEFERRED** (prod: `skynet.tn` / `10.0.0.9`)
  - DNS-filter detection works correctly (remote ad-domain probe).
  - Browser-side adblocker detection (DOM bait + same-origin probe) was previously **not reliably detecting** extensions (uBlock Origin, AdBlock Plus, Brave Shields, Firefox ETP) because the same-origin probe used `fetch`, which many blockers do not treat like a blocked page resource.
  - Root causes investigated: CSS injection timing, nginx `/ads.js` routing, Brave `navigator.brave` API, `blocker_family` propagation.
  - 2026-04-05 patch: same-origin probe now loads `/ads.js` as a real `<script>` and confirms execution via a probe token on `window`, which should better separate browser-side blocking from DNS/network filtering.
  - **Decision:** keep `adblocker_detection` opt-in in production settings until the new script-tag probe is revalidated on real browsers; keep `dns_filter_detection` enabled.
  - **To revisit:** if this is still noisy, move to a server-observed bait request model (HTML-injected bait resource with fetch confirmation logged server-side) instead of relying entirely on client-side inference.

---

## Done (Unreleased Branch)

- [x] 2026-04-06 — feat(ui): Overview → Security Command Center + Portal User Intelligence decision engine
  - **Added:** `frontend/src/utils/securityIntelligence.js` — 5 intelligence engine functions: `computeGlobalTrend`, `generateAIInsights`, `rankEntitiesForInvestigation`, `generateRecommendedActions`, `generateGlobalSecurityState`
  - **Added:** `frontend/src/components/overview/CommandHeader.jsx` — dominant global risk header with trend, spike badge, threat counts, recommended actions
  - **Added:** `frontend/src/components/overview/AIInsightsPanel.jsx` — AI pattern insight cards (max 5)
  - **Added:** `frontend/src/components/overview/SignalIntelligenceCard.jsx` — aggregated signal intelligence from all overview data sources
  - **Added:** `frontend/src/components/ui/PortalUserIntelAudit.jsx` — AuditTab + RawDataTab (split from Sections to respect 300-line rule)
  - **Added:** `PATCH /api/v1/identity/{external_user_id}/trust-level` — admin-only trust level mutation with audit log
  - **Changed:** `riskNarrative.js` — full decision engine rewrite (`computeTrendInfo`, `aggregateSignalsForDecision`, `rankLinkedDevices`, `computeConfidenceLevel`, `generateRecommendedAction`, `generateDecisionSummary`); `generateRiskNarrative` backward-compatible
  - **Changed:** `PortalUserIntelModal.jsx` → 5-tab layout with persistent Decision Header and Trust/Flag/Block buttons
  - **Changed:** `PriorityInvestigationsCard`, `RiskLeaderboardCard`, `ThreatHotspotsCard` — enhanced with action labels, trend badges, delta indicators
  - **Changed:** `OverviewPage` — title "Security Command Center", new layout order, `useMemo` intelligence synthesis

- [x] 2026-04-05 — fix(identity): retroactive visitor attribution + tor_vpn heuristic + dual-model link + anti-evasion blind spot — v1.7.4
  - **Fixed:** `identity_service._sync_external_user_visitors` — `should_claim_all` now restricted to visitors created at or after `linked_at`; historical anonymous sessions no longer retroactively attributed
  - **Fixed:** `risk_engine.recompute` — `tor_vpn` modifier replaced: queries `Incident` table for `VPN_DETECTED`/`PROXY_DETECTED`/`WEBRTC_VPN_BYPASS` instead of `risk_score >= 100` heuristic
  - **Fixed:** `devices.py POST /{device_id}/link` — now also writes `IdentityLink` when `external_user_id` provided; legacy `Device.linked_user` write retained for backward compat
  - **Fixed:** `anti_evasion._apply_multi_account_risk` — multi-account count uses `COALESCE(external_user_id, linked_user)` covering both legacy and IdP-linked visitors
  - **Bumped:** `APP_VERSION` → `1.7.4`
- [x] 2026-04-05 — fix(functional): NameError crash + missing profile creation + silent detection failures + user count dedup — v1.7.3
  - **Fixed:** `track.py` `NameError: identity_service` on every `POST /track/activity` with device payload — import added
  - **Fixed:** `risk_engine.py` `UserProfile` never created on first `recompute()` call — row now created in the `else` branch
  - **Fixed:** `anti_evasion.py` `_safe_run` silently swallowed all detection failures — now logs at ERROR with full traceback
  - **Fixed:** `anti_evasion.py` ML scoring block silently discarded all inference errors — now logs at WARNING
  - **Fixed:** `stats.py` `unique_users` double-counted users present in both `Visitor.linked_user` and `UserProfile` — now uses set union deduplication; same fix applied to previous-period comparison
  - **Bumped:** `APP_VERSION` → `1.7.3`

- [x] 2026-04-05 — fix(audit): silent exception + debug leak fixes — v1.7.2
  - **Fixed:** `track.py` `parse_user_agent()` silent `except: pass` → `_log.debug()` (logger added)
  - **Fixed:** `stats.py` 3 silent `except Exception:` in overview endpoint → `_log.warning(..., exc_info=True)` (logger added)
  - **Fixed:** `main.py` asyncio shutdown swallowed errors → `_log.debug()` on `BaseException` (logger added)
  - **Fixed:** `snippets.jsx` live `console.log` in integration snippet → commented out
  - **Bumped:** `APP_VERSION` → `1.7.2`

- [x] 2026-04-04 — security(rbac+webhook): RBAC hardening + webhook secret encryption — v1.7.1
  - **Security:** 12 route files patched — settings, settings_smtp, settings_https, settings_geoip, settings_notifications, settings_integrations, settings_storage, integration, blocking, anti_evasion, system, audit — all critical endpoints now enforce `require_admin_user` or `require_superadmin_user`
  - **Security:** `GET /api/v1/system/info` now requires authentication (was public)
  - **Security:** `webhook_secret` → `webhook_secret_enc` in `DEFAULT_RUNTIME_SETTINGS`; `settings.py` GET masks + PUT encrypts; `incident_notifications.py` decrypts at delivery time via `decrypt_password()`
  - **Fixed:** `init_db()` in `database.py` now has an explanatory docstring (intentional no-op — Alembic manages schema)
  - **Fixed:** Stale RBAC TODO comment removed from `settings_smtp.py`
  - **Bumped:** `APP_VERSION` → `1.7.1` in `config.py` and `frontend/package.json`
  - **Docs:** CHANGELOG, SECURITY, DEV_PLAN updated; all hardening gaps closed

- [x] 2026-04-04 — feat(ml+webrtc): ML anomaly detection + WebRTC leak detection — v1.7.0
  - **Added:** `backend/app/services/ml/` package: `feature_extractor.py` (27-feature vector from Device ORM), `anomaly_detector.py` (IsolationForest, atomic .pkl persistence), `ml_task.py` (asyncio 24h retraining loop on healthy devices)
  - **Added:** ML retraining task started in FastAPI lifespan (`start_ml_runtime()`), feature-flagged `ml_anomaly_detection=false` in runtime settings
  - **Added:** `detectWebRTCLeak()` probe in `skynet.js` — ICE candidate analysis, 2s timeout, RGPD-safe (no raw IPs), 5 boolean/count signals in `fingerprint_traits`
  - **Added:** `_check_webrtc_leak()` in `anti_evasion.py` → `WEBRTC_VPN_BYPASS` incident +35 risk; `webrtc_leak_detection=true` anti-evasion config
  - **Added:** `numpy==1.26.4`, `scikit-learn==1.4.2`, `joblib==1.4.2` to `requirements.txt`
  - **Added:** `RISK_POINTS["webrtc_vpn_bypass"]=35`, `RISK_POINTS["ml_anomaly"]=15`
  - **Added:** Tests: `test_ml_feature_extractor.py`, `test_webrtc_leak.py`
  - **Bumped:** `APP_VERSION` → `1.7.0` in `config.py` and `frontend/package.json`
  - **Docs:** CHANGELOG, ARCHITECTURE, SECURITY, DEV_PLAN updated

- [x] 2026-04-04 — feat(overview-density+docs): compacted the overview dashboard and synced project markdown
  - **Changed:** Overview stat cards now use a denser low-profile layout with tighter row spacing for better screen efficiency
  - **Changed:** Traffic Intensity and Threat Hotspots now use much shorter fixed heights on desktop, and Threat Hotspots replaced the resource-heavy animated globe with lightweight ranked bars and compact summary metrics
  - **Changed:** Risk Leaderboard and Priority Investigations now keep fixed same-row heights with internal scrolling so long analyst content stays visible without breaking symmetry
  - **Changed:** README, frontend README, and CHANGELOG now describe the compact overview layout and the lightweight hotspot rendering accurately
  - **Verified:** `npm run build` passed in `frontend/`

- [x] 2026-04-03 — feat(tracker-relay+attribution): hardened browser tracking for blocker-heavy and shared-network environments
  - **Added:** blocker-resistant public tracker aliases `/s/{site_key}.js` and `/w/{site_key}/*` for less obvious browser collection paths
  - **Added:** first-party relay pattern for protected apps so tracker load, challenge pages, identity linking, and authenticated activity can stay on the app origin
  - **Changed:** visitor attribution now prefers exact device continuity over broad shared-IP reuse, reducing cross-visitor mixing on shared networks
  - **Changed:** browser/device heuristics now classify desktop-vs-mobile more conservatively to avoid touch-capable desktop browsers being mislabeled as mobile

- [x] 2026-04-03 — feat(tracker-probes+strict-tracking): added blocker heuristics, ISP anomalies, and strict protected-app tracker enforcement
  - **Added:** tracker runtime probes for DOM bait blocking, same-origin ad-path blocking, remote ad-domain blocking, and JS-runtime integrity hints
  - **Added:** anti-evasion runtime controls for `adblocker_detection`, `dns_filter_detection`, and `isp_resolution_detection` with per-signal actions
  - **Changed:** Devices grouping and detail payloads now infer probable model/vendor names from linked visitor user-agent evidence instead of summarizing grouped browsers only
  - **Changed:** Mouwaten now treats SkyNet tracker readiness as mandatory when enforcement is active and blocks protected-app use if the same-origin tracker relay never becomes ready
  - **Verified:** `node --check tracker/skynet.js` passed, `python3 -m py_compile` passed for the backend changes, targeted frontend ESLint passed, and `npm run build` passed for the SkyNet frontend

- [x] 2026-04-04 — feat(signal-visibility): surfaced blocker and DNS evidence in entity detail views
  - **Changed:** Visitor details now fetch the exact backend payload and show tracking-signal summaries for adblocker, DNS-filter, and ISP-resolution incidents
  - **Changed:** Device details, linked device visitors, and Portal User Intelligence profile/device/visitor cards now show compact tracking-evidence summaries instead of requiring operators to pivot into Anti-Evasion incidents
  - **Verified:** backend `py_compile`, targeted frontend ESLint, and frontend production build passed

- [x] 2026-04-03 — feat(portal-intelligence-linking): tightened visitor/device/user ownership reconciliation
  - **Added:** `/api/v1/identity/{external_user_id}/visitors` for Portal User Intelligence tracked-visitor visibility
  - **Changed:** identity linking now propagates across strict sibling-device groups and backfills linked visitors to the owning external user more consistently
  - **Changed:** Portal User Intelligence export and detail views now include linked visitors alongside device links, risk history, flags, and activity

- [x] 2026-04-03 — fix(intelligence-delete+docs): completed bidirectional intelligence cleanup for visitor/device/user deletion
  - **Added:** `DELETE /api/v1/identity/{external_user_id}` for admin-side removal of external-user intelligence profiles from Portal User Intelligence
  - **Changed:** visitor and device deletion now clean related anomaly flags, device-bound incidents, orphaned identity links, and affected Portal User Intelligence counters instead of leaving stale indicators behind
  - **Changed:** Portal User Intelligence now filters out null-device identity links and exposes tracked visitors plus an explicit external-user delete action in the UI
  - **Verified:** `python3 -m compileall backend/app` passed, and targeted ESLint passed for `useDevices`, `DevicesPage`, `usePortalUsers`, `PortalUsersPage`, and `services/api`

- [x] 2026-04-03 — fix(orphaned-overview-intelligence): removed stale dashboard investigations after entity deletion
  - **Added:** shared backend intelligence filters for active incidents and active anomaly flags, with matching orphan-purge helpers for delete/reconcile flows
  - **Changed:** `GET /api/v1/stats/overview` and `GET /api/v1/risk/users` now ignore incidents/flags whose linked device, visitor, or external-user profile was already deleted
  - **Changed:** intelligence cleanup now purges orphaned incidents and anomaly flags during external-profile reconciliation so old stale rows stop resurfacing in overview widgets
  - **Verified:** `python3 -m compileall backend/app backend/tests` passed; direct local unittest execution remains blocked in this shell because backend Python deps like `sqlalchemy` are not installed

- [x] 2026-04-03 — feat(priority-investigation-detail): added drill-down inspection for overview investigations
  - **Added:** `GET /api/v1/anti-evasion/incidents/{incident_id}` to resolve incident evidence together with the best available related portal user, device, and visitor context
  - **Changed:** Overview -> Priority Investigations items are now clickable and open a detail modal instead of only redirecting to a visitor search
  - **Verified:** `python3 -m compileall backend/app backend/tests` passed, targeted frontend ESLint passed for the overview files, and the frontend production build passed

- [x] 2026-04-03 — docs(sync+integration): aligned markdown with the live Mouwaten relay flow, DNSBL soft-fail posture, and current audit semantics
  - **Changed:** README, API, architecture, install, logic, security, changelog, and Mouwaten integration docs now describe the stealth tracker path, same-origin relay pattern, and challenge proxy flow consistently
  - **Changed:** docs now clarify that site API keys are public integration identifiers, while protected apps can still hide them behind a first-party relay when needed
  - **Changed:** docs now describe `enhanced_audit` as targeted extra activity metadata instead of a guaranteed full raw device snapshot, matching the current implementation
  - **Changed:** docs now record the DNSBL soft-fail runtime behavior for noisy dynamic-IP regions such as Tunisia

- [x] 2026-04-03 — feat(group-escalation+docs): shipped visitor → device → user parent escalation as a backend-only, disabled-by-default engine
  - **Added:** `services/group_escalation/*` orchestration for exact-device, strict sibling-device, and external-user parent posture recompute
  - **Added:** runtime settings for `group_escalation_enabled`, window sizes, similarity thresholds, and additive weight tuning
  - **Added:** group anomaly vocabulary `group_device_risk`, `group_user_risk`, `coordinated_group_behavior`, and `repeated_group_spike`
  - **Changed:** `/track/pageview`, `/track/event`, `/track/device-context`, `/track/activity`, `/identity/link`, `/risk/{external_user_id}/recompute`, and anti-evasion user recomputes now flow through the parent-escalation orchestrator
  - **Verified:** `python3 -m compileall backend/app backend/tests` passed locally, backend container rebuild succeeded, and container-side unit suite passed for `tests.test_risk_engine`, `tests.test_settings_persistence`, and `tests.test_group_parent_escalation`

- [x] 2026-04-03 — feat(tenants+notifications+deploy): added tenant management, notification delivery, and deployment tooling
  - **Added:** tenant account management with host mapping, theme defaults, and operator assignment via `/api/v1/tenants`
  - **Added:** notification delivery system with SMTP integration, webhook testing, and delivery logging via `/api/v1/settings/notifications`
  - **Added:** lightweight deployment tool (`skynet deploy`) supporting Docker and Python targets with rsync/SMB sync and registry/prebuilt image handling
  - **Added:** Mouwaten integration documentation and external JWT validation for end-user authentication
  - **Added:** UI visibility controls and theme widget curation for dashboard customization
  - **Changed:** new API routes for tenants, notifications, integrations, and storage operations

- [x] 2026-04-03 — fix(frontend+docs): restored a lint-clean frontend branch and simplified the Settings UX for non-developer operators
  - **Changed:** Settings navigation now behaves like a compact sticky sub-navigation bar inside the Settings surface instead of a stack of section cards
  - **Changed:** feature-status summary cards, coverage cards, capability chips, and roadmap/planning cards are now consistently hidden behind Developer Mode for a cleaner operator-facing settings experience
  - **Changed:** glow-heavy card and modal styling was flattened so the frontend reads more like a professional operator console
  - **Fixed:** `npm run lint` now passes again after cleaning up empty catch blocks, unused render variables, hook dependencies, and Vite config linting
  - **Verified:** `npm run lint` and `npm run build` both pass in `frontend/`

- [x] 2026-04-03 — chore(docs+review): documented branch-review hardening gaps and current verification state
  - **Added:** explicit follow-up work for RBAC hardening, webhook-secret handling, and frontend lint cleanup in the active development plan
  - **Changed:** security and API docs now call out the current branch gaps instead of implying those hardening items are already complete
  - **Verified:** frontend build passes, and backend pytest execution remains unavailable in the current shell because `pytest` is not installed

- [x] 2026-04-03 — feat(storage+integrations-settings): completed the Data & Storage and Integrations settings surfaces
  - **Added:** storage status, retention archive export, and on-demand retention cleanup endpoints for events, activity, incidents, and stale visitors
  - **Added:** integration runtime controls for API access governance, API-key prefixing, integration-specific rate limits, threat-intel refresh, and SIEM/monitoring connector testing
  - **Changed:** Settings -> Data & Storage and Settings -> Integrations now mark all currently shipped capabilities as live in both the detailed roadmap cards and the coordinated summary
  - **Changed:** tracker/API key validation now honors the runtime integration access toggle, and event-notification flows can fan out to SIEM/monitoring webhooks

- [x] 2026-04-03 — feat(storage-reset-actions): added destructive data-reset controls for tracker cleanup and fresh-install reinitialization
  - **Added:** `POST /api/v1/settings/storage/tracker-purge` for admin-side deletion of one tracker/site's collected visitors, activity, device links, orphaned user intelligence, and scan artifacts while keeping the tracker registration
  - **Added:** `POST /api/v1/settings/storage/reset-install` for superadmin-only fresh-install reinitialization of operational data while preserving operator accounts, runtime settings, themes, and tenant configuration
  - **Changed:** Settings -> Data & Storage now includes a tracker selector for data wipes plus a typed-confirmation reset action for clean reinstall flows
  - **Verified:** `python3 -m compileall backend/app backend/tests` passed, targeted frontend ESLint passed for `DataStorageTab` and `services/api`, and container-side unit coverage passed for the new storage action contracts

- [x] 2026-04-02 — feat(auth+theme-settings): completed the Authentication & Identity and UI / Theme Engine settings surfaces
  - **Added:** `superadmin` role, tenant account registry, operator tenant assignment, and tenant default-theme linkage with migration `0018`
  - **Added:** `/api/v1/tenants` CRUD plus tenant-aware operator serialization on `/users` and `/auth/me`
  - **Added:** theme shell controls for fixed/document layout mode, content width, sidebar width, sticky header, topbar density, and curated dashboard widget sets
  - **Changed:** Settings -> Authentication & Identity and Settings -> UI / Theme Engine now mark all currently shipped capabilities as live in both the detailed roadmap cards and the coordinated summary

- [x] 2026-04-02 — feat(access-network): completed the Access & Network settings surface and aligned runtime enforcement
  - **Added:** runtime settings for allowed domains, CORS origin/method/header policy, IP allow/deny lists, and per-route-class request limits
  - **Added:** `AccessNetworkMiddleware` to enforce host allowlists, dynamic CORS, runtime rate limits, and pre-routing IP policy on every HTTP request
  - **Fixed:** client IP extraction now respects `trust_proxy_headers`; forwarded IP headers are ignored unless the trusted-edge toggle is enabled
  - **Changed:** Settings -> Access & Network and the coordinated settings summary now mark Domains & Routing, IP Control, and Rate Limiting as live

- [x] 2026-04-02 — chore(settings-summary): aligned the coordinated feature-status card with the real settings roadmap surface
  - **Changed:** shared settings capability metadata now reflects session policy, dynamic themes, widget coverage, storage granularity, blocking strategy, and system monitoring more faithfully
  - **Changed:** the top “Coordinated product state for the current settings surface” card now derives from a finer-grained capability map instead of several overly broad buckets

- [x] 2026-04-02 — fix(security-center): hardened STIE scan refresh against malformed threat-intel feed rows
  - **Fixed:** GitHub/NVD/local threat-intel parsing now skips malformed non-object entries instead of throwing `'str' object has no attribute 'get'`
  - **Fixed:** Security Center status payload now carries profile scan notes explicitly, so target-level failures remain visible after refresh
  - **Changed:** Security Center UI now distinguishes "scan succeeded but refresh failed" from a real scan failure
  - **Verified:** local threat-intel bundle refresh completed with NVD + GitHub + local fallback rows after the parser hardening

- [x] 2026-04-02 — fix(metrics+docs): verified operator data lineage and removed decorative dashboard fallback signals
  - **Fixed:** `GET /api/v1/integration/sites` now returns real per-site visitor, event, and blocked-visitor aggregates instead of placeholder zeroes
  - **Fixed:** Overview hotspot, enforcement, and investigation cards now render backend-derived payloads only and fall back to explicit empty states when data is absent
  - **Fixed:** Overview now computes real visitor and unique-user trend deltas while leaving blocked trend empty until a comparable historical metric exists
  - **Changed:** operator user list now surfaces active-device counts from live sessions rather than a hardcoded zero
  - **Changed:** README, API, architecture, logic, install, deploy, workflow, and frontend docs now document the real data-path rules and verification checklist

- [x] 2026-04-02 — feat(security-settings): completed the Security & Detection settings surface and aligned the coordinated summary
  - **Added:** runtime controls for risk modifier weights, fingerprint signal weights, proxy/VPN/datacenter edge actions, country watchlists, and provider / ASN keyword watchlists
  - **Added:** pageview network-intelligence incidents for proxy, VPN, datacenter, timezone mismatch, language mismatch, country-rule, and provider-rule matches
  - **Changed:** Settings -> Security & Detection now saves runtime and anti-evasion posture together, and the coordinated settings summary now treats Network Intelligence and Device Identity as fully live
  - **Changed:** gateway and tracker access checks now honor configured network-intelligence challenge/block actions before origin forwarding

- [x] 2026-04-02 — feat(notifications): escalation rules plus webhook test and delivery log landed after the v1.6.0 cut
  - **Added:** `notification_deliveries` persistence with migration `0017` for SMTP/webhook send history, including failure state and escalation attempt metadata
  - **Added:** `POST /api/v1/settings/webhooks/test` and `GET /api/v1/settings/notifications/deliveries` for operator verification and troubleshooting
  - **Added:** custom event matrix routing across `high_severity_incident`, `evasion_detected`, `spam_detected`, `block_triggered`, and `new_user`
  - **Changed:** Settings -> Notifications & Messaging now exposes matrix-based routing, escalation policy controls, webhook test sends, and a live delivery log beside SMTP config

- [x] 2026-04-02 — feat(gateway-dashboard): shipped proxy analytics on the Overview dashboard and closed the last v1.6.0 item before release prep
  - **Added:** structured `gateway_allow`, `gateway_challenge`, `gateway_block`, and `gateway_challenge_result` events for proxy analytics
  - **Added:** gateway dashboard metrics on `GET /api/v1/stats/overview` covering request volume, bot pressure, challenge rate, latency, top reasons, and challenge outcomes
  - **Changed:** Overview now surfaces gateway operations as a first-class analyst widget instead of leaving gateway status buried in settings only
  - **Changed:** docs, roadmap state, and release prep notes now reflect the completed active-gateway analytics slice

- [x] 2026-04-02 — feat(gateway+antiabuse): challenge pages, bot pipeline, form-spam heuristics, DNSBL checks, and tenant-aware dynamic themes shipped together
  - **Added:** gateway challenge modes for JavaScript proof-of-work, redirect handoff, and honeypot continue flows with short-lived bypass cookies
  - **Added:** crawler-signature, headless-signal, click-farm, honeypot-form, submission-velocity, and content-deduplication detections in the anti-evasion pipeline
  - **Added:** public DNSBL lookups with cached provider hits and operator-selectable challenge vs block behavior
  - **Changed:** `tracker/skynet.js` now captures `navigator.webdriver`, auto-reports form submission metadata, and follows challenge redirects from `/track/check-access`
  - **Changed:** dynamic theme policy now supports host-based tenant maps in addition to risk-band overrides, and the Settings / Anti-Evasion UX reflects the new live roadmap status

- [x] 2026-04-02 — feat(gateway+experience): Keycloak realm sync, deep fingerprint scoring, onboarding, starter packs, and gateway MVP shipped together
  - **Added:** composite fingerprint hash/score, timezone-offset clock-skew detection, and device-level assessment fields via migration `0016`
  - **Added:** explicit user-risk enforcement thresholds for auto-flag, auto-challenge, and auto-block with threshold anomaly flags
  - **Added:** Keycloak Admin API realm sync controls plus `/api/v1/identity/sync/keycloak` for pre-loading external users like `mouwaten`
  - **Added:** dashboard onboarding wizard, curated theme starter-pack installs, and risk-aware dynamic theme resolution for default-theme operators
  - **Added:** `/api/v1/gateway/proxy/*` and `/api/v1/gateway/status` as the first reverse-proxy / decision-engine slice
  - **Changed:** tracker payloads now include raw timezone offset, and devices surface composite fingerprint + clock-skew metadata in the dashboard

- [x] 2026-04-02 — feat(device-identity): signed continuity cookie and fingerprint stability foundation landed on the active branch
  - **Added:** signed `_skynet_did` device continuity cookie with backend issuance/verification and tracker reuse
  - **Added:** tracker navigator/timing entropy capture (`hardware_concurrency`, `device_memory`, `connection_type`, `touch_points`, plugin count, clock resolution, rAF jitter)
  - **Added:** per-device `fingerprint_confidence`, `stability_score`, and persisted fingerprint snapshots
  - **Added:** migration `0015_device_identity_foundation` plus focused backend unit coverage in `backend/tests/test_device_fingerprint.py`
  - **Changed:** tracker device-context/pageview flows now resolve devices by signed cookie continuity before falling back to raw fingerprint only

---

## Done (Operator UX + Theme Engine Foundations — v1.2.0, 2026-04-02)

- [x] 2026-04-02 — feat(identity+alerts): multi-IdP auth, entropy scoring, anti-spam window, and high-severity incident alerts shipped together
  - **Added:** multi-provider JWKS validation via runtime `idp_providers`, issuer-based provider selection, and persisted `identity_links.id_provider`
  - **Added:** tracker behavior snapshots plus low-entropy interaction detection with `behavior_drift` anomaly flags
  - **Added:** Redis sliding-window spam detection keyed by device/fingerprint context instead of the older fixed counter
  - **Added:** high-severity incident email + webhook notifications, plus coordinated Auth / Notifications feature-state in Settings
  - **Changed:** deployment rollout remains pending for real environments; code and docs are ready, but migrations still must be applied on deployed targets

- [x] 2026-04-02 — feat(portal-users): external-user intelligence UI shipped on top of `/identity/*` and `/risk/*`
  - **Added:** real Portal Users table with search, trust/risk filters, and recompute actions
  - **Added:** full-height intelligence drawer with risk history chart, linked devices, activity timeline, and anomaly flag actions
  - **Changed:** `/users` is now an analyst-facing intelligence surface instead of a placeholder marketing page
- [x] 2026-04-02 — feat(overview): risk leaderboard widget shipped on dashboard overview
  - **Added:** `risk_leaderboard` summary payload on `GET /api/v1/stats/overview`
  - **Added:** Overview risk card surfacing highest-risk external identities with open-flag context and direct jump to Portal Users
  - **Changed:** `v1.3.0` analyst workflow now starts from Overview instead of requiring the Portal Users page first
- [x] 2026-04-02 — feat(theme): backend-backed theme registry and per-user theme resolution
  - **Added:** `themes` CRUD, default theme promotion, per-user theme selection, safe fallback resolution
  - **Added:** theme branding/logo upload and API-served logo delivery
  - **Added:** theme shell controls for body, header, nav, footer, panel surfaces, and widget metadata
- [x] 2026-04-02 — feat(settings): new domain-based settings IA
  - **Added:** 9 grouped settings domains with sticky left navigation and roadmap cards
  - **Changed:** settings moved away from the previous flat tab strip
- [x] 2026-04-02 — fix(frontend): desktop shell and content ergonomics
  - **Changed:** fixed shell layout (header/nav/footer pinned, `main` scrollable)
  - **Changed:** centered desktop content frame and improved card/table/action spacing
  - **Fixed:** oversized modal/settings overflow and viewport clipping
- [x] 2026-04-02 — feat(integration): shipped device UUID handoff helper for protected apps
  - **Added:** `POST /api/v1/track/device-context` — public helper to resolve/create SKYNET `devices.id` from tracker signals
  - **Added:** tracker browser helpers `SkyNet.getDeviceId()`, `SkyNet.getDeviceContext()`, and `SkyNet.getFingerprint()`
  - **Changed:** Integration snippets, install docs, and identity examples now use the built-in helper instead of app-specific glue
- [x] 2026-04-02 — test(identity): backend coverage added for identity linking, risk scoring, and JWKS validation
  - **Added:** `backend/tests/test_identity_service.py` covering profile upsert, device linking, and multi-account flagging
  - **Added:** `backend/tests/test_risk_engine.py` covering trust thresholds, weighted risk recompute, and spike flag creation
  - **Added:** `backend/tests/test_jwks_validator.py` covering cache hits, grace-period fallback, and token validation failure modes
- [x] 2026-04-02 — feat(settings): runtime settings and anti-evasion config are now persisted in the database
  - **Added:** `runtime_config` single-row persistence store plus migration `0014`
  - **Changed:** `/settings`, `/anti-evasion/config`, SMTP/HTTPS settings flows, startup env seeding, and backup/restore now read/write durable config instead of memory-only state
  - **Fixed:** general settings and anti-evasion configuration now survive backend restarts
- [x] 2026-04-02 — fix(frontend): completed desktop UX pass for remaining route pages
  - **Changed:** `Audit` now includes summary cards, clearer filtering, and better operator hierarchy
  - **Changed:** `Anti-Evasion` now surfaces incident posture, grouped controls, and a clearer save workflow
  - **Changed:** `Integration` now includes rollout metrics, cleaner site cards, and a structured snippet modal
- [x] 2026-04-02 — feat(identity): impossible-travel detection now flags risky authenticated geo jumps
  - **Added:** activity-intelligence heuristics on `POST /track/activity` comparing consecutive country/IP changes inside a short time window
  - **Added:** automatic `impossible_travel` anomaly flags and immediate risk recompute when the heuristic triggers
  - **Changed:** authenticated activity tracking now refreshes the external user profile alongside the event write
- [x] 2026-04-02 — feat(portal-users): export flows shipped for analyst intelligence work
  - **Added:** Portal Users CSV/JSON export for the full filtered table, not just the current visible page
  - **Added:** selected-user intelligence bundle export covering profile, devices, risk history, activity, and flags
- [x] 2026-04-02 — feat(overview): live websocket realtime feed wired into the dashboard HUD
  - **Added:** `GET /api/v1/stats/realtime` snapshot extraction now also powers `WS /api/v1/stats/realtime/ws`
  - **Changed:** Overview prefers a live socket and falls back to polling if the websocket is unavailable
- [x] 2026-04-02 — chore(infra): backend container health check added to Compose
  - **Added:** Docker health check for `backend` hitting `/api/health` from inside the container
  - **Changed:** compose status now exposes backend liveness alongside Postgres, Redis, and optional Keycloak
- [x] 2026-04-02 — feat(theme): theme packaging, role-aware shell surfaces, and activity retention shipped
  - **Added:** runtime pruning for `activity_events` using the live `event_retention_days` setting
  - **Added:** `GET /api/v1/themes/{id}/export` and `POST /api/v1/themes/import` for marketplace-ready single-theme JSON packages with optional embedded logo assets
  - **Added:** theme admin registry package import/export UX plus theme-editor presets for `layout.role_surfaces`
  - **Changed:** the sidebar now honors theme-defined role surface rules to hide or relabel navigation entries per operator role
- [x] 2026-04-02 — feat(experience): search, drill-downs, presets, and bulk visitor workflows shipped together
  - **Added:** `GET /api/v1/search` powering a topbar global search across visitors, devices, and portal users
  - **Added:** Overview hotspot / investigation drill-down into Visitors using URL-driven filters
  - **Added:** Visitors saved filter presets and bulk selection actions for block/export on the current visible slice
  - **Changed:** Settings now show coordinated feature-status summary stats derived from the same capability map used across the page

---

## Done (Identity Platform Backend — v1.2.0, 2026-03-31)

- [x] 2026-03-31 — feat(infra): unified multi-target deployment CLI
  - **Added:** `./skynet` launcher with `deploy`, `restart`, `status`, `rollback`, and `list-targets`
  - **Added:** release-based deploy engine with `current`/`previous` symlinks and incremental `rsync --link-dest`
  - **Added:** `infra/targets.example.json` for local, Synology, and future VPS targets
  - **Added:** `/api/health` alias for deploy health checks
  - **Changed:** install/workflow docs now point to the unified deployment system
- [x] 2026-03-31 — feat(deployment): HTTPS deployment modes and settings foundation
  - **Added:** Settings → HTTPS & Access tab for public URL, HTTPS mode, edge provider, proxy trust, and HSTS
  - **Added:** `docker-compose.https.yml` + `infra/caddy/Caddyfile` for public edge TLS with Caddy
  - **Added:** `docker-compose.tunnel.yml` for Cloudflare Tunnel deployments with no inbound ports
  - **Added:** `docker-compose.dev-https.yml` + `infra/caddy/Caddyfile.dev` for secure-context local development
  - **Changed:** Integration snippets now prefer the configured public base URL instead of the current dashboard origin
  - **Changed:** HSTS is now conditional on HTTPS host matching instead of being sent on every response
- [x] 2026-03-31 — feat(identity): complete identity platform redesign
  - **Removed:** Keycloak SSO for SKYNET operators (`users.keycloak_id`, SSO settings, AuthTab card, AuthOperatorsPanel badge)
  - **Added:** `identity_links` — persistent user ↔ device mapping table (migration 0006)
  - **Added:** `user_profiles` — aggregated intelligence profile per external user (migration 0007)
  - **Added:** `risk_events` — time-series risk score history (migration 0008)
  - **Added:** `activity_events` — structured authenticated-user activity timeline (migration 0009)
  - **Added:** `anomaly_flags` — security anomaly records per user (migration 0010)
  - **Added:** devices extended with `owner_user_id`, `shared_user_count`, `last_known_platform` (migration 0011)
  - **Added:** `services/jwks_validator.py` — async JWKS fetch, in-process cache, 10-min grace period
  - **Added:** `services/identity_service.py` — link upsert, multi-account detection, device ownership
  - **Added:** `services/risk_engine.py` — composite scoring (device scores + modifiers), spike flagging, trust levels
  - **Added:** `routes/identity.py` — 8 endpoints: link, profile, devices, risk-history, activity, flags, enhanced-audit
  - **Added:** `routes/risk.py` — list risky users, manual recompute
  - **Added:** `POST /track/activity` — authenticated activity tracking via external IdP JWT
  - **Added:** `KEYCLOAK_JWKS_URL/ISSUER/AUDIENCE/CACHE_TTL_SEC` env vars + startup seeding
  - **Changed:** Settings Auth card now configures JWT validation for end-users (not operator SSO)
  - **Changed:** Documentation now reflects the shipped `1.2.0` identity-platform release

---

## Done (Release 1.1.0 — 2026-03-30)

- [x] 2026-03-30 — feat(devices): strict same-machine grouping (match_key via migration 0004)
- [x] 2026-03-30 — feat(auth): Redis-backed session enforcement (JWT sid + Redis session store)
- [x] 2026-03-30 — feat(audit): write-only audit log backend + dashboard page
- [x] 2026-03-30 — feat(geoip): MaxMind GeoLite2 enrichment on visitor upsert
- [x] 2026-03-30 — feat(geoip+smtp): GeoIP provider switching + SMTP email service
- [x] 2026-03-30 — security(middleware): HTTP security headers (CSP, HSTS, X-Frame-Options DENY)
- [x] 2026-03-30 — feat(rate-limit): slowapi rate limiter with typed 429 responses
- [x] 2026-03-30 — refactor(frontend): hooks layer extracted from pages
- [x] 2026-03-30 — security(input): bleach-backed HTML stripping on all stored user input
- [x] 2026-03-30 — feat(anti-evasion): async in-process checks after tracking writes
- [x] 2026-03-30 — feat(delete): DELETE /devices/{id} and DELETE /visitors/{id}

---

## Done (v1.0.0 Foundation — 2026-03-29)

- [x] Full-stack scaffold (React + FastAPI + PostgreSQL + Redis)
- [x] Embeddable tracker script (skynet.js)
- [x] Docker Compose full-stack deployment
- [x] JWT authentication + auto-created default admin
- [x] All 8 dashboard pages
- [x] CLAUDE.md behavioral contract
- [x] docs/ directory (all 11 documents)
- [x] shared/ contracts (error_codes.json, event_types.json)

---

## Backlog — Priority Order

### P0 — Critical (needed for identity platform to be usable)

### P1 — High
- [x] Activity event retention policy — prune activity_events older than retention setting
- [x] Theme import/export and marketplace-ready theme packaging
- [x] Role-based UI surface differences layered on top of the theme engine

### P2 — Medium
- [x] Chart drill-downs — click country → filter visitors
- [x] Anti-spam sliding window (Redis per device)
- [x] Behavioral entropy scoring (scroll/click timing)
- [x] Multi-IdP support — `id_provider` field already in identity_links; add Google/GitHub resolvers
- [x] Dynamic themes by risk / tenant
- [x] Challenge types and gateway friction flows
- [x] Form spam and DNSBL enforcement hooks

### P3 — Low
- [ ] Dashboard onboarding wizard (first-run flow)
- [ ] Theme import/export UX and curated starter packs
- [ ] `skynet.dev.js` — unminified tracker for dev debugging
- [ ] `shared/error_codes.json` usage in frontend

---

## Blocked

*(none currently)*

---

## Technical Debt Log

| Debt | Introduced | Impact | Resolution Target |
|------|-----------|--------|------------------|
| VITE_HMR_HOST hardcoded in dev compose | v1.0.0 | Must change per deployment | v1.3.0 |
| activity_events no partitioning | unreleased identity branch | Slow queries at scale | v1.4.0 |
