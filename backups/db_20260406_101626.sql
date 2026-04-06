--
-- PostgreSQL database dump
--

\restrict ct5DRXFYzgaLb3RJfZcSL1qU36gkWcoCZsWonnidQZU32bQ07w6L7ib0MrLUjPf

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: skynet
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'moderator',
    'user',
    'superadmin'
);


ALTER TYPE public.user_role OWNER TO skynet;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: skynet
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'blocked',
    'pending'
);


ALTER TYPE public.user_status OWNER TO skynet;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_events; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.activity_events (
    id character varying(36) NOT NULL,
    external_user_id character varying(255) NOT NULL,
    event_type character varying(50) NOT NULL,
    platform character varying(20),
    site_id character varying(36),
    fingerprint_id character varying(36),
    ip character varying(45),
    country character varying(2),
    page_url character varying(2048),
    properties text,
    session_id character varying(255),
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.activity_events OWNER TO skynet;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO skynet;

--
-- Name: anomaly_flags; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.anomaly_flags (
    id character varying(36) NOT NULL,
    external_user_id character varying(255) NOT NULL,
    flag_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    related_device_id character varying(36),
    related_visitor_id character varying(36),
    evidence text,
    detected_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone
);


ALTER TABLE public.anomaly_flags OWNER TO skynet;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.audit_logs (
    id character varying(36) NOT NULL,
    actor_id character varying(36),
    action character varying(60) NOT NULL,
    target_type character varying(40),
    target_id character varying(100),
    ip character varying(45),
    extra text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO skynet;

--
-- Name: block_page_config; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.block_page_config (
    id integer NOT NULL,
    title character varying(120) DEFAULT 'ACCESS RESTRICTED'::character varying NOT NULL,
    subtitle character varying(240) DEFAULT 'Your access to this site has been blocked.'::character varying NOT NULL,
    message text DEFAULT 'This action was taken automatically for security reasons.'::text NOT NULL,
    bg_color character varying(20) DEFAULT '#050505'::character varying NOT NULL,
    accent_color character varying(20) DEFAULT '#ef4444'::character varying NOT NULL,
    logo_url character varying(512),
    contact_email character varying(255),
    show_request_id boolean DEFAULT true NOT NULL,
    show_contact boolean DEFAULT true NOT NULL
);


ALTER TABLE public.block_page_config OWNER TO skynet;

--
-- Name: block_page_config_id_seq; Type: SEQUENCE; Schema: public; Owner: skynet
--

CREATE SEQUENCE public.block_page_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.block_page_config_id_seq OWNER TO skynet;

--
-- Name: block_page_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: skynet
--

ALTER SEQUENCE public.block_page_config_id_seq OWNED BY public.block_page_config.id;


--
-- Name: blocked_ips; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.blocked_ips (
    ip character varying(50) NOT NULL,
    country character varying(100),
    country_flag character varying(10),
    reason character varying(500),
    hits integer NOT NULL,
    blocked_at timestamp with time zone NOT NULL
);


ALTER TABLE public.blocked_ips OWNER TO skynet;

--
-- Name: blocking_rules; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.blocking_rules (
    id character varying(36) NOT NULL,
    type character varying(30) NOT NULL,
    value character varying(500) NOT NULL,
    reason character varying(500),
    action character varying(20) NOT NULL,
    hits integer NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.blocking_rules OWNER TO skynet;

--
-- Name: devices; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.devices (
    id character varying(36) NOT NULL,
    fingerprint character varying(128) NOT NULL,
    type character varying(50),
    browser character varying(100),
    os character varying(100),
    screen_resolution character varying(20),
    language character varying(20),
    timezone character varying(50),
    canvas_hash character varying(64),
    webgl_hash character varying(64),
    audio_hash character varying(64),
    font_list text,
    risk_score integer NOT NULL,
    status character varying(20) NOT NULL,
    linked_user character varying(36),
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    match_key character varying(80),
    match_version integer,
    owner_user_id character varying(255),
    shared_user_count integer DEFAULT 0 NOT NULL,
    last_known_platform character varying(20),
    device_cookie_id character varying(64),
    fingerprint_version integer NOT NULL,
    fingerprint_confidence double precision NOT NULL,
    stability_score double precision NOT NULL,
    fingerprint_snapshot text,
    composite_fingerprint character varying(64),
    composite_score double precision NOT NULL,
    timezone_offset_minutes integer,
    clock_skew_minutes integer
);


ALTER TABLE public.devices OWNER TO skynet;

--
-- Name: events; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.events (
    id character varying(36) NOT NULL,
    site_id character varying(36),
    visitor_id character varying(36),
    user_id character varying(36),
    device_id character varying(36),
    event_type character varying(100) NOT NULL,
    page_url character varying(2048),
    referrer character varying(2048),
    properties text,
    ip character varying(45),
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.events OWNER TO skynet;

--
-- Name: identity_links; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.identity_links (
    id character varying(36) NOT NULL,
    external_user_id character varying(255) NOT NULL,
    id_provider character varying(50) DEFAULT 'keycloak'::character varying NOT NULL,
    fingerprint_id character varying(36),
    visitor_id character varying(36),
    platform character varying(20) DEFAULT 'web'::character varying NOT NULL,
    ip character varying(45),
    linked_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone NOT NULL
);


ALTER TABLE public.identity_links OWNER TO skynet;

--
-- Name: incidents; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.incidents (
    id character varying(36) NOT NULL,
    type character varying(100) NOT NULL,
    description text,
    ip character varying(45),
    device_id character varying(36),
    user_id character varying(36),
    severity character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    metadata text,
    detected_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone
);


ALTER TABLE public.incidents OWNER TO skynet;

--
-- Name: notification_deliveries; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.notification_deliveries (
    id character varying(36) NOT NULL,
    channel character varying(20) NOT NULL,
    event_type character varying(80) NOT NULL,
    status character varying(20) NOT NULL,
    target character varying(255) NOT NULL,
    subject character varying(200),
    response_status integer,
    error_message text,
    payload_excerpt text,
    incident_id character varying(36),
    escalation_level integer NOT NULL,
    attempt_count integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    delivered_at timestamp with time zone
);


ALTER TABLE public.notification_deliveries OWNER TO skynet;

--
-- Name: risk_events; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.risk_events (
    id character varying(36) NOT NULL,
    external_user_id character varying(255) NOT NULL,
    score double precision NOT NULL,
    delta double precision NOT NULL,
    trigger_type character varying(50) NOT NULL,
    trigger_detail text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.risk_events OWNER TO skynet;

--
-- Name: runtime_config; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.runtime_config (
    id integer NOT NULL,
    runtime_settings json NOT NULL,
    anti_evasion_config json NOT NULL
);


ALTER TABLE public.runtime_config OWNER TO skynet;

--
-- Name: runtime_config_id_seq; Type: SEQUENCE; Schema: public; Owner: skynet
--

CREATE SEQUENCE public.runtime_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.runtime_config_id_seq OWNER TO skynet;

--
-- Name: runtime_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: skynet
--

ALTER SEQUENCE public.runtime_config_id_seq OWNED BY public.runtime_config.id;


--
-- Name: security_findings; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.security_findings (
    id character varying(36) NOT NULL,
    site_id character varying(36),
    profile_id character varying(36),
    finding_type character varying(60) NOT NULL,
    title character varying(255) NOT NULL,
    severity character varying(20) NOT NULL,
    endpoint character varying(1000) NOT NULL,
    evidence text DEFAULT '{}'::text NOT NULL,
    correlated_risk_score double precision DEFAULT '0'::double precision NOT NULL,
    active_exploitation_suspected boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.security_findings OWNER TO skynet;

--
-- Name: security_recommendations; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.security_recommendations (
    id character varying(36) NOT NULL,
    finding_id character varying(36) NOT NULL,
    recommendation_text text NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    auto_applicable boolean DEFAULT false NOT NULL,
    action_key character varying(80),
    action_payload text DEFAULT '{}'::text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.security_recommendations OWNER TO skynet;

--
-- Name: sites; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.sites (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    url character varying(500) NOT NULL,
    description text,
    api_key character varying(64) NOT NULL,
    active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sites OWNER TO skynet;

--
-- Name: target_profile; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.target_profile (
    id character varying(36) NOT NULL,
    site_id character varying(36),
    base_url character varying(500) NOT NULL,
    detected_server character varying(255),
    powered_by character varying(255),
    frameworks text DEFAULT '[]'::text NOT NULL,
    technologies text DEFAULT '[]'::text NOT NULL,
    response_headers text DEFAULT '{}'::text NOT NULL,
    observed_endpoints text DEFAULT '[]'::text NOT NULL,
    notes text,
    scan_status character varying(20) DEFAULT 'idle'::character varying NOT NULL,
    last_scanned_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.target_profile OWNER TO skynet;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.tenants (
    id character varying(36) NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(80) NOT NULL,
    primary_host character varying(255),
    description text,
    default_theme_id character varying(100),
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.tenants OWNER TO skynet;

--
-- Name: themes; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.themes (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    colors json NOT NULL,
    layout json NOT NULL,
    widgets json NOT NULL,
    branding json,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.themes OWNER TO skynet;

--
-- Name: threat_intel; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.threat_intel (
    id character varying(120) NOT NULL,
    source character varying(40) NOT NULL,
    severity double precision DEFAULT '0'::double precision NOT NULL,
    severity_label character varying(20) DEFAULT 'low'::character varying NOT NULL,
    affected_software text DEFAULT '[]'::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    "references" text DEFAULT '[]'::text NOT NULL,
    published_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.threat_intel OWNER TO skynet;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.user_profiles (
    id character varying(36) NOT NULL,
    external_user_id character varying(255) NOT NULL,
    email character varying(255),
    display_name character varying(255),
    current_risk_score double precision DEFAULT '0'::double precision NOT NULL,
    trust_level character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    total_devices integer DEFAULT 0 NOT NULL,
    total_sessions integer DEFAULT 0 NOT NULL,
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    last_ip character varying(45),
    last_country character varying(2),
    enhanced_audit boolean DEFAULT false NOT NULL,
    profile_data text
);


ALTER TABLE public.user_profiles OWNER TO skynet;

--
-- Name: users; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.users (
    id character varying(36) NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    hashed_password character varying(255),
    role public.user_role NOT NULL,
    status public.user_status NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    theme_id character varying(100),
    theme_source character varying(20),
    tenant_id character varying(36)
);


ALTER TABLE public.users OWNER TO skynet;

--
-- Name: visitors; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.visitors (
    id character varying(36) NOT NULL,
    ip character varying(45) NOT NULL,
    country character varying(100),
    country_code character varying(2),
    country_flag character varying(10),
    city character varying(100),
    isp character varying(200),
    device_type character varying(50),
    browser character varying(100),
    os character varying(100),
    user_agent text,
    status character varying(20) NOT NULL,
    page_views integer NOT NULL,
    site_id character varying(36),
    linked_user character varying(36),
    device_id character varying(36),
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    external_user_id character varying(255)
);


ALTER TABLE public.visitors OWNER TO skynet;

--
-- Name: block_page_config id; Type: DEFAULT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.block_page_config ALTER COLUMN id SET DEFAULT nextval('public.block_page_config_id_seq'::regclass);


--
-- Name: runtime_config id; Type: DEFAULT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.runtime_config ALTER COLUMN id SET DEFAULT nextval('public.runtime_config_id_seq'::regclass);


--
-- Data for Name: activity_events; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.activity_events (id, external_user_id, event_type, platform, site_id, fingerprint_id, ip, country, page_url, properties, session_id, created_at) FROM stdin;
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.alembic_version (version_num) FROM stdin;
0019
\.


--
-- Data for Name: anomaly_flags; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.anomaly_flags (id, external_user_id, flag_type, severity, status, related_device_id, related_visitor_id, evidence, detected_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.audit_logs (id, actor_id, action, target_type, target_id, ip, extra, created_at) FROM stdin;
3fb9a17e-d7d7-4001-9913-e661c84b84cb	\N	LOGIN_FAILED	\N	\N	172.18.0.1	{"attempted_username": "admin@skynet.local"}	2026-03-31 22:18:16.574315+00
d89a7633-3cb8-40e8-846b-cace753ffe23	\N	LOGIN_FAILED	\N	\N	196.178.42.221	{"attempted_username": "marwen.sadkaoui@gmail.com"}	2026-03-31 22:19:33.1625+00
f6c01294-fa94-492d-9bee-c9552f37adf4	001789a6-808f-4c81-b255-c527c4b72771	LOGIN	\N	\N	196.178.42.221	\N	2026-03-31 22:20:05.237449+00
ac9e44a9-a753-4212-8970-d5cb5ddf7522	001789a6-808f-4c81-b255-c527c4b72771	CONFIG_CHANGE	settings	general	196.178.42.221	{"updated_keys": ["anonymize_ips", "auth_jwt_expire_minutes", "auth_max_sessions", "auth_password_min_length", "auth_password_require_numbers", "auth_password_require_symbols", "auth_password_require_uppercase", "auto_block_tor_vpn", "base_url", "event_retention_days", "geoip_provider", "hsts_enabled", "https_certificate_strategy", "https_letsencrypt_challenge", "https_letsencrypt_dns_api_token_enc", "https_letsencrypt_dns_provider", "https_letsencrypt_domain", "https_letsencrypt_email", "https_mode", "https_provider", "https_self_signed_common_name", "https_self_signed_valid_days", "https_uploaded_cert_path", "https_uploaded_key_path", "incident_retention_days", "instance_name", "keycloak_audience", "keycloak_cache_ttl_sec", "keycloak_enabled", "keycloak_issuer", "keycloak_jwks_url", "realtime_enabled", "require_auth", "smtp_enabled", "smtp_from_email", "smtp_from_name", "smtp_host", "smtp_password", "smtp_port", "smtp_ssl", "smtp_tls", "smtp_user", "timezone", "trust_proxy_headers", "visitor_retention_days", "webhook_events", "webhook_secret", "webhook_url"]}	2026-03-31 22:21:04.837058+00
79d83441-f1fe-4b32-a476-cd58ef36cbd7	001789a6-808f-4c81-b255-c527c4b72771	CONFIG_CHANGE	settings	general	196.178.42.221	{"updated_keys": ["anonymize_ips", "auth_jwt_expire_minutes", "auth_max_sessions", "auth_password_min_length", "auth_password_require_numbers", "auth_password_require_symbols", "auth_password_require_uppercase", "auto_block_tor_vpn", "base_url", "event_retention_days", "geoip_provider", "hsts_enabled", "https_certificate_strategy", "https_letsencrypt_challenge", "https_letsencrypt_dns_api_token_enc", "https_letsencrypt_dns_provider", "https_letsencrypt_domain", "https_letsencrypt_email", "https_mode", "https_provider", "https_self_signed_common_name", "https_self_signed_valid_days", "https_uploaded_cert_path", "https_uploaded_key_path", "incident_retention_days", "instance_name", "keycloak_audience", "keycloak_cache_ttl_sec", "keycloak_enabled", "keycloak_issuer", "keycloak_jwks_url", "realtime_enabled", "require_auth", "smtp_enabled", "smtp_from_email", "smtp_from_name", "smtp_host", "smtp_password", "smtp_port", "smtp_ssl", "smtp_tls", "smtp_user", "timezone", "trust_proxy_headers", "visitor_retention_days", "webhook_events", "webhook_secret", "webhook_url"]}	2026-03-31 22:22:25.666159+00
5d1658e1-6275-4623-a972-fc23031ce49b	001789a6-808f-4c81-b255-c527c4b72771	CONFIG_CHANGE	settings	general	196.178.42.221	{"updated_keys": ["anonymize_ips", "auth_jwt_expire_minutes", "auth_max_sessions", "auth_password_min_length", "auth_password_require_numbers", "auth_password_require_symbols", "auth_password_require_uppercase", "auto_block_tor_vpn", "base_url", "event_retention_days", "geoip_provider", "hsts_enabled", "https_certificate_strategy", "https_letsencrypt_challenge", "https_letsencrypt_dns_api_token_enc", "https_letsencrypt_dns_provider", "https_letsencrypt_domain", "https_letsencrypt_email", "https_mode", "https_provider", "https_self_signed_common_name", "https_self_signed_valid_days", "https_uploaded_cert_path", "https_uploaded_key_path", "incident_retention_days", "instance_name", "keycloak_audience", "keycloak_cache_ttl_sec", "keycloak_enabled", "keycloak_issuer", "keycloak_jwks_url", "realtime_enabled", "require_auth", "smtp_enabled", "smtp_from_email", "smtp_from_name", "smtp_host", "smtp_password", "smtp_port", "smtp_ssl", "smtp_tls", "smtp_user", "timezone", "trust_proxy_headers", "visitor_retention_days", "webhook_events", "webhook_secret", "webhook_url"]}	2026-03-31 22:22:34.944092+00
c80b5852-29a2-4ad0-b502-37b7a4d58d57	001789a6-808f-4c81-b255-c527c4b72771	CONFIG_CHANGE	settings	general	196.178.42.221	{"updated_keys": ["anonymize_ips", "auth_jwt_expire_minutes", "auth_max_sessions", "auth_password_min_length", "auth_password_require_numbers", "auth_password_require_symbols", "auth_password_require_uppercase", "auto_block_tor_vpn", "base_url", "event_retention_days", "geoip_provider", "hsts_enabled", "https_certificate_strategy", "https_letsencrypt_challenge", "https_letsencrypt_dns_api_token_enc", "https_letsencrypt_dns_provider", "https_letsencrypt_domain", "https_letsencrypt_email", "https_mode", "https_provider", "https_self_signed_common_name", "https_self_signed_valid_days", "https_uploaded_cert_path", "https_uploaded_key_path", "incident_retention_days", "instance_name", "keycloak_audience", "keycloak_cache_ttl_sec", "keycloak_enabled", "keycloak_issuer", "keycloak_jwks_url", "realtime_enabled", "require_auth", "smtp_enabled", "smtp_from_email", "smtp_from_name", "smtp_host", "smtp_password", "smtp_port", "smtp_ssl", "smtp_tls", "smtp_user", "timezone", "trust_proxy_headers", "visitor_retention_days", "webhook_events", "webhook_secret", "webhook_url"]}	2026-03-31 22:56:30.657903+00
6b2f2b32-e90c-4ffd-8935-0844b5f4d795	001789a6-808f-4c81-b255-c527c4b72771	CONFIG_CHANGE	settings	general	196.178.42.221	{"updated_keys": ["anonymize_ips", "auth_jwt_expire_minutes", "auth_max_sessions", "auth_password_min_length", "auth_password_require_numbers", "auth_password_require_symbols", "auth_password_require_uppercase", "auto_block_tor_vpn", "base_url", "event_retention_days", "geoip_provider", "hsts_enabled", "https_certificate_strategy", "https_letsencrypt_challenge", "https_letsencrypt_dns_api_token_enc", "https_letsencrypt_dns_provider", "https_letsencrypt_domain", "https_letsencrypt_email", "https_mode", "https_provider", "https_self_signed_common_name", "https_self_signed_valid_days", "https_uploaded_cert_path", "https_uploaded_key_path", "incident_retention_days", "instance_name", "keycloak_audience", "keycloak_cache_ttl_sec", "keycloak_enabled", "keycloak_issuer", "keycloak_jwks_url", "realtime_enabled", "require_auth", "smtp_enabled", "smtp_from_email", "smtp_from_name", "smtp_host", "smtp_password", "smtp_port", "smtp_ssl", "smtp_tls", "smtp_user", "timezone", "trust_proxy_headers", "visitor_retention_days", "webhook_events", "webhook_secret", "webhook_url"]}	2026-03-31 22:56:45.896048+00
13550c6d-dc8c-4d66-9125-dfd51ac72e4d	001789a6-808f-4c81-b255-c527c4b72771	CREATE_SITE	site	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	196.178.42.221	\N	2026-03-31 23:39:13.472964+00
e3d4da0c-ead8-475e-a02b-29c90e92bb2b	1462da9a-dee3-42b7-a952-f419547d339b	BACKUP_RESTORE_UPLOAD	settings	skynet_20260401_003351_database.skynetbak	10.0.0.21	{"mode": "selective", "services": ["database"]}	2026-04-01 00:35:19.922105+00
da9fff7b-56c8-4817-a848-6169b3650a23	001789a6-808f-4c81-b255-c527c4b72771	LOGIN	\N	\N	10.0.0.21	\N	2026-04-01 00:35:27.355472+00
f8227726-d756-4cf6-8758-8ca1b52b3b55	001789a6-808f-4c81-b255-c527c4b72771	LOGIN	\N	\N	10.0.0.21	\N	2026-04-03 00:37:25.165625+00
09509d6f-62e1-4c3e-8be2-5a69713c3d7a	001789a6-808f-4c81-b255-c527c4b72771	LOGIN	\N	\N	10.0.0.20	\N	2026-04-03 02:20:31.230716+00
\.


--
-- Data for Name: block_page_config; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.block_page_config (id, title, subtitle, message, bg_color, accent_color, logo_url, contact_email, show_request_id, show_contact) FROM stdin;
1	ACCESS RESTRICTED	Bara al3ib b3id 	This action was taken automatically for security reasons. If you believe this is a mistake, contact the site administrator.	#050505	#ef4444	https://static.vecteezy.com/system/resources/previews/044/778/417/non_2x/logo-e-sport-variation-character-and-creatures-transparent-free-png.png	\N	t	t
\.


--
-- Data for Name: blocked_ips; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.blocked_ips (ip, country, country_flag, reason, hits, blocked_at) FROM stdin;
\.


--
-- Data for Name: blocking_rules; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.blocking_rules (id, type, value, reason, action, hits, created_at) FROM stdin;
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.devices (id, fingerprint, type, browser, os, screen_resolution, language, timezone, canvas_hash, webgl_hash, audio_hash, font_list, risk_score, status, linked_user, first_seen, last_seen, match_key, match_version, owner_user_id, shared_user_count, last_known_platform, device_cookie_id, fingerprint_version, fingerprint_confidence, stability_score, fingerprint_snapshot, composite_fingerprint, composite_score, timezone_offset_minutes, clock_skew_minutes) FROM stdin;
1dc839a9-deb9-435d-89b9-234a30052c67	26e1b036-000000cb	desktop	Firefox 148.0	Windows 10	2048x1152	fr	Etc/GMT-1	RvhdG/TyuAgPh0+HDyeivwL8sa00etDXvpAAAAAElFTkSuQmCC	R29vZ2xlIEluYy4gKE5WSURJQSk6OkFO	\N	\N	0	active	\N	2026-04-01 00:07:08.580864+00	2026-04-01 00:24:56.308474+00	strict:v1:0396b351ba54d49decffdf8e	1	\N	0	\N	\N	1	0	1	\N	\N	0	\N	\N
2e6e3f8d-c78b-46a7-ad1d-792b64bd0fa4	41ce217b-000000e8	desktop	Chrome 146.0.0	Linux	412x915	fr-FR	Africa/Tunis	D//1ayDLMAAAAGSURBVAMAH0J+fssHfUoAAAAASUVORK5CYII=	QVJNOjpNYWxpLUc3OA==	\N	\N	0	active	\N	2026-04-01 00:25:50.188975+00	2026-04-01 00:27:58.44125+00	strict:v1:0e90f3e14e836ceacb694beb	1	\N	0	\N	\N	1	0	1	\N	\N	0	\N	\N
a632ed74-9c55-4cf6-aaf0-002ea91204dd	5737bac4-000000c8	mobile	Firefox Mobile 149.0	Android 15	456x1013	fr-FR	Africa/Tunis	sJNN2mfQ4QIPb5RqXaiAP/A3jeklavtrKDAAAAAElFTkSuQmCC	QVJNOjpNYWxpLUc1MSwgb3Igc2ltaWxh	\N	\N	0	active	\N	2026-04-01 00:08:25.358619+00	2026-04-01 00:29:36.1926+00	strict:v1:9665995d17edd0d1765156be	1	\N	0	\N	\N	1	0	1	\N	\N	0	\N	\N
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.events (id, site_id, visitor_id, user_id, device_id, event_type, page_url, referrer, properties, ip, created_at) FROM stdin;
cd130824-3204-4c55-a0e6-826f1339bb14	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	4e27a193-73e1-43af-9a18-acbbd527c434	\N	1dc839a9-deb9-435d-89b9-234a30052c67	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	172.18.0.5	2026-04-01 00:07:08.814823+00
cde17a3f-2cc2-42ff-81d4-937a32a435fc	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	571cab5e-345e-4b27-bc92-8a75f4124970	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	172.18.0.5	2026-04-01 00:08:25.597505+00
218b86ed-d22b-49bb-b573-7bf08939e913	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	571cab5e-345e-4b27-bc92-8a75f4124970	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	172.18.0.5	2026-04-01 00:09:00.936417+00
f3fc9604-cc59-4cd1-904b-0c0b5e9e2027	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	571cab5e-345e-4b27-bc92-8a75f4124970	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	172.18.0.5	2026-04-01 00:09:13.734293+00
be3f09af-a169-4e6e-8b2c-35753bf93e52	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	571cab5e-345e-4b27-bc92-8a75f4124970	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	172.18.0.5	2026-04-01 00:09:20.258597+00
98c8e3b7-b035-41be-b56f-10059f178e02	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	5c520609-ff41-4d8e-a646-9dd297a711e0	\N	1dc839a9-deb9-435d-89b9-234a30052c67	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	196.178.42.221	2026-04-01 00:24:56.508608+00
8773523a-79a2-44f4-9c23-c3c086c53a11	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	5454eb60-99ca-421a-b5eb-f982b600909f	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:25:13.17821+00
1071b835-7d67-4a1a-ac49-52c6b8389dde	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	5454eb60-99ca-421a-b5eb-f982b600909f	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:25:20.948625+00
0a58efcd-c7da-4743-9a56-ee751ab480af	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	8b9426b6-d76d-4119-b92e-c3a4dfd14a6c	\N	2e6e3f8d-c78b-46a7-ad1d-792b64bd0fa4	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:25:50.191053+00
62674707-679e-4464-a7f6-85606ed82687	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	8b9426b6-d76d-4119-b92e-c3a4dfd14a6c	\N	2e6e3f8d-c78b-46a7-ad1d-792b64bd0fa4	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:26:06.634843+00
8db838a6-31c3-433c-b649-28d0b68c3a46	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	8b9426b6-d76d-4119-b92e-c3a4dfd14a6c	\N	2e6e3f8d-c78b-46a7-ad1d-792b64bd0fa4	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:27:52.073784+00
02c3fce0-4997-413f-86e2-f519c23d83fc	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	8b9426b6-d76d-4119-b92e-c3a4dfd14a6c	\N	2e6e3f8d-c78b-46a7-ad1d-792b64bd0fa4	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:27:55.226313+00
a2d1f0e0-6107-4069-b1a5-2aa75f52ca82	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	8b9426b6-d76d-4119-b92e-c3a4dfd14a6c	\N	2e6e3f8d-c78b-46a7-ad1d-792b64bd0fa4	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:27:58.442644+00
41269603-4f3f-4337-b471-2d025495566f	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	5454eb60-99ca-421a-b5eb-f982b600909f	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:28:08.502075+00
914489f2-ae80-45f3-b0fe-44ca9c887518	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	5454eb60-99ca-421a-b5eb-f982b600909f	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:28:32.340845+00
bbd70e7b-1470-4ffc-b694-4b36d88246c2	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	5454eb60-99ca-421a-b5eb-f982b600909f	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	2026-04-01 00:28:42.261383+00
c89b07ee-ceab-4670-a84c-712528006181	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	db906213-dfae-44ba-87b4-5e37558d8749	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	196.178.42.221	2026-04-01 00:29:09.450437+00
b0d0de7a-498d-448b-bc78-5351897875a2	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	db906213-dfae-44ba-87b4-5e37558d8749	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	196.178.42.221	2026-04-01 00:29:17.47529+00
dfa33169-7199-4cb9-8786-e4f7f074c09a	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	db906213-dfae-44ba-87b4-5e37558d8749	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	pageview	https://skynet.tn/tracker/test-site.html#	\N	\N	196.178.42.221	2026-04-01 00:29:36.193896+00
\.


--
-- Data for Name: identity_links; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.identity_links (id, external_user_id, id_provider, fingerprint_id, visitor_id, platform, ip, linked_at, last_seen_at) FROM stdin;
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.incidents (id, type, description, ip, device_id, user_id, severity, status, metadata, detected_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: notification_deliveries; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.notification_deliveries (id, channel, event_type, status, target, subject, response_status, error_message, payload_excerpt, incident_id, escalation_level, attempt_count, created_at, updated_at, delivered_at) FROM stdin;
\.


--
-- Data for Name: risk_events; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.risk_events (id, external_user_id, score, delta, trigger_type, trigger_detail, created_at) FROM stdin;
\.


--
-- Data for Name: runtime_config; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.runtime_config (id, runtime_settings, anti_evasion_config) FROM stdin;
1	{"instance_name": "SkyNet", "base_url": "http://localhost:8000", "https_mode": "off", "https_provider": "reverse_proxy", "https_certificate_strategy": "edge_managed", "https_self_signed_common_name": "localhost", "https_self_signed_valid_days": 30, "https_letsencrypt_domain": "", "https_letsencrypt_email": "", "https_letsencrypt_challenge": "http", "https_letsencrypt_dns_provider": "", "https_letsencrypt_dns_api_token_enc": "", "https_uploaded_cert_path": "", "https_uploaded_key_path": "", "trust_proxy_headers": false, "hsts_enabled": false, "allowed_domains": [], "cors_allowed_origins": ["http://localhost:5173", "http://localhost:3000"], "cors_allowed_methods": ["*"], "cors_allowed_headers": ["*"], "cors_allow_credentials": true, "timezone": "UTC", "realtime_enabled": true, "developer_mode_enabled": false, "feature_flags": {"advanced_diagnostics": false, "maintenance_console": false, "response_ladder": true, "ml_anomaly_detection": false}, "ui_visibility": {"settings": {"feature_status_summary": true, "feature_status_details": true}, "overview": {"realtime_banner": true, "stat_cards": true, "traffic_heatmap": true, "threat_hotspots": true, "enforcement_pressure": true, "gateway_operations": true, "risk_leaderboard": true, "priority_investigations": true}, "navigation": {"overview": true, "visitors": true, "users": true, "devices": true, "blocking": true, "anti-evasion": true, "audit": true, "integration": true, "settings": true}}, "auto_block_tor_vpn": false, "require_auth": false, "intel_refresh_interval_hours": 24, "scan_interval_hours": 12, "enable_auto_defense": false, "max_scan_depth": 8, "correlation_sensitivity": 0.7, "visitor_retention_days": 90, "event_retention_days": 90, "incident_retention_days": 365, "anonymize_ips": false, "integration_api_access_enabled": true, "integration_api_key_prefix": "sk_", "rate_limit_integration_per_minute": 120, "integration_siem_enabled": false, "integration_siem_url": "", "integration_siem_secret_enc": "", "integration_siem_events": ["high_severity_incident", "evasion_detected", "spam_detected", "block_triggered"], "integration_monitoring_enabled": false, "integration_monitoring_url": "", "integration_monitoring_secret_enc": "", "integration_monitoring_events": ["high_severity_incident", "spam_detected", "block_triggered"], "webhook_url": "", "webhook_secret_enc": "", "webhook_events": {}, "notification_event_matrix": {"high_severity_incident": {"label": "High Severity Incident", "webhook": true, "smtp": true, "escalate": true}, "evasion_detected": {"label": "Evasion Detected", "webhook": true, "smtp": false, "escalate": false}, "spam_detected": {"label": "Spam Detected", "webhook": true, "smtp": false, "escalate": false}, "block_triggered": {"label": "Block Triggered", "webhook": true, "smtp": false, "escalate": false}, "new_user": {"label": "New User", "webhook": true, "smtp": false, "escalate": false}}, "notification_escalation_enabled": false, "notification_escalation_min_severity": "critical", "notification_escalation_delay_minutes": 15, "notification_escalation_repeat_limit": 2, "notification_escalation_channels": {"smtp": true, "webhook": true}, "geoip_provider": "ip-api", "smtp_enabled": false, "smtp_host": "", "smtp_port": 587, "smtp_user": "", "smtp_password_enc": "", "smtp_from_name": "SkyNet", "smtp_from_email": "", "smtp_tls": true, "smtp_ssl": false, "keycloak_sync_enabled": false, "keycloak_sync_base_url": "", "keycloak_sync_auth_realm": "", "keycloak_sync_realm": "", "keycloak_sync_client_id": "admin-cli", "keycloak_sync_client_secret_enc": "", "keycloak_sync_username": "", "keycloak_sync_password_enc": "", "keycloak_sync_user_limit": 500, "keycloak_sync_last_run_at": "", "keycloak_sync_last_summary": {}, "idp_default_provider": "", "idp_providers": [], "auth_jwt_expire_minutes": 1440, "auth_max_sessions": 5, "auth_password_min_length": 8, "auth_password_require_uppercase": false, "auth_password_require_numbers": false, "auth_password_require_symbols": false, "keycloak_enabled": true, "keycloak_jwks_url": "http://keycloak:8080/realms/Mouwaten/protocol/openid-connect/certs", "keycloak_issuer": "http://10.0.0.39:8080/realms/Mouwaten", "keycloak_audience": "", "keycloak_cache_ttl_sec": 300, "risk_auto_flag_threshold": 0.6, "risk_auto_challenge_threshold": 0.8, "risk_auto_block_threshold": 0.95, "risk_auto_block_enforced": true, "response_slowdown_enabled": true, "response_slowdown_retry_after_sec": 30, "risk_modifier_weights": {"shared_device": 0.2, "new_device": 0.1, "geo_jump": 0.3, "tor_vpn": 0.4, "headless": 0.3, "multi_account": 0.25, "behavior_drift": 0.15}, "group_escalation_enabled": false, "group_recent_window_hours": 24, "group_history_window_days": 30, "group_behavior_burst_window_minutes": 30, "group_behavior_similarity_threshold": 1.75, "group_escalation_weights": {"same_device_risky_visitors": 0.22, "strict_group_risky_siblings": 0.18, "coordinated_behavior": 0.2, "repeated_group_spike": 0.12, "multi_device_suspicious_parent": 0.16}, "fingerprint_clock_skew_tolerance_minutes": 90, "fingerprint_signal_weights": {"canvas_hash": 0.16, "webgl_hash": 0.18, "screen": 0.12, "language": 0.07, "timezone": 0.07, "hardware_concurrency": 0.1, "device_memory": 0.08, "platform": 0.08, "connection_type": 0.04, "plugin_count": 0.04, "touch_points": 0.04, "timezone_offset_minutes": 0.06, "clock_resolution_ms": 0.05, "raf_jitter_score": 0.05}, "network_proxy_action": "observe", "network_vpn_action": "observe", "network_datacenter_action": "observe", "network_country_watchlist": [], "network_country_action": "observe", "network_provider_watchlist": [], "network_provider_action": "observe", "network_ip_allowlist": [], "network_ip_denylist": [], "rate_limit_default_per_minute": 300, "rate_limit_track_per_minute": 200, "rate_limit_auth_per_minute": 30, "rate_limit_auth_login_per_minute": 10, "theme_dynamic_enabled": false, "theme_dynamic_strategy": "risk", "theme_dynamic_risk_map": {}, "theme_dynamic_tenant_map": {}, "gateway_enabled": false, "gateway_target_origin": "", "gateway_site_id": "", "gateway_timeout_ms": 10000, "gateway_forward_ip_headers": true, "gateway_proxy_strip_prefix": "", "onboarding_enabled": true, "onboarding_completed": false, "onboarding_last_completed_at": ""}	{"vpn_detection": true, "tor_detection": true, "proxy_detection": true, "datacenter_detection": true, "headless_browser_detection": true, "bot_detection": true, "crawler_signature_detection": true, "click_farm_detection": true, "canvas_fingerprint": true, "webgl_fingerprint": true, "font_fingerprint": true, "audio_fingerprint": true, "timezone_mismatch": true, "language_mismatch": true, "cookie_evasion": true, "ip_rotation_detection": true, "challenge_enabled": true, "challenge_type": "js_pow", "challenge_redirect_url": "", "challenge_pow_difficulty": 4, "challenge_bypass_ttl_sec": 900, "challenge_honeypot_field": "website", "spam_rate_threshold": 10, "form_honeypot_detection": true, "form_submission_velocity_threshold": 3, "form_submission_velocity_window_sec": 300, "form_content_dedupe_threshold": 3, "form_content_dedupe_window_sec": 1800, "dnsbl_enabled": false, "dnsbl_providers": ["zen.spamhaus.org", "bl.spamcop.net"], "dnsbl_action": "challenge", "dnsbl_cache_ttl_sec": 900, "max_accounts_per_device": 3, "max_accounts_per_ip": 5}
\.


--
-- Data for Name: security_findings; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.security_findings (id, site_id, profile_id, finding_type, title, severity, endpoint, evidence, correlated_risk_score, active_exploitation_suspected, status, created_at, updated_at) FROM stdin;
83204466-d3c7-4193-a85b-58b01f73cb0b	0235c556-93ee-4e06-9467-4d7b1f114867	713f40a4-dc36-4c4a-86cc-50ca5288b063	missing_security_headers	Missing security headers	high	http://10.0.0.39:8081	{"missing_headers": ["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options"], "response_headers": {"server": "nginx/1.29.7", "date": "Mon, 06 Apr 2026 08:17:16 GMT", "content-type": "text/html; charset=utf-8", "content-length": "6377", "connection": "close", "x-powered-by": "Next.js", "etag": "\\"14mjyx14h464w9\\"", "vary": "Accept-Encoding"}, "matched_cves": [], "matched_payloads": [], "suspicious_ips": [], "blocked_visitors": 0}	0.55	f	open	2026-04-06 08:17:16.476092+00	2026-04-06 08:17:16.464141+00
804a5c0f-c50a-4d5f-bf17-c6f59d79a538	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	e67d5e36-f4d1-4f02-bf5e-1886305d785d	missing_security_headers	Missing security headers	high	https://skynet.tn	{"missing_headers": ["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options"], "response_headers": {"date": "Mon, 06 Apr 2026 08:17:16 GMT", "content-type": "text/html", "transfer-encoding": "chunked", "connection": "close", "report-to": "{\\"group\\":\\"cf-nel\\",\\"max_age\\":604800,\\"endpoints\\":[{\\"url\\":\\"https://a.nel.cloudflare.com/report/v4?s=%2Fa%2B9WmnOuL2Jr1TPSICESs01s1pRR%2FgPLFoq1dB9F59ORiI8JA7CrfQxy%2Bit6x7eBzhETQvNFq85UjJIhgoNG7wlSaPAQOySuUsOR5dWaq2RyMxd98FKVBhaIpc%3D\\"}]}", "server-timing": "cfEdge;dur=22,cfOrigin;dur=39", "last-modified": "Mon, 06 Apr 2026 01:30:11 GMT", "server": "cloudflare", "cf-cache-status": "DYNAMIC", "vary": "accept-encoding", "nel": "{\\"report_to\\":\\"cf-nel\\",\\"success_fraction\\":0.0,\\"max_age\\":604800}", "cf-ray": "9e7f5aef0b735bcd-TUN", "alt-svc": "h3=\\":443\\"; ma=86400"}, "matched_cves": [], "matched_payloads": [], "suspicious_ips": [], "blocked_visitors": 0}	0.55	f	open	2026-04-06 08:17:20.612715+00	2026-04-06 08:17:20.609528+00
\.


--
-- Data for Name: security_recommendations; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.security_recommendations (id, finding_id, recommendation_text, priority, auto_applicable, action_key, action_payload, status, created_at, updated_at) FROM stdin;
3e53e1ca-8ac7-43ba-b3cb-1b73cc0fc10e	83204466-d3c7-4193-a85b-58b01f73cb0b	Add the missing headers on http://10.0.0.39:8081: content-security-policy, strict-transport-security, x-frame-options, x-content-type-options.	high	f	\N	{}	open	2026-04-06 08:17:16.477683+00	2026-04-06 08:17:16.464141+00
29c64f31-8b71-475b-901e-1f8ac978b240	804a5c0f-c50a-4d5f-bf17-c6f59d79a538	Add the missing headers on https://skynet.tn: content-security-policy, strict-transport-security, x-frame-options, x-content-type-options.	high	f	\N	{}	open	2026-04-06 08:17:20.61345+00	2026-04-06 08:17:20.609528+00
\.


--
-- Data for Name: sites; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.sites (id, name, url, description, api_key, active, created_at) FROM stdin;
0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	Live Test	https://skynet.tn/tracker/test-site.html	\N	9b472ad257457bbe82ab8131e6be89fdc23bdcf15ba8a96bc984f6af475c143a	t	2026-03-31 23:39:13.474744+00
0235c556-93ee-4e06-9467-4d7b1f114867	Mouwaten	http://10.0.0.39:8081	Mouwaten citizen reporting frontend	f063914dd67adf18ca3b8da7664eb81ab840e8a7f2eed71fe03414d29abe0d59	t	2026-04-02 10:17:09.204475+00
\.


--
-- Data for Name: target_profile; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.target_profile (id, site_id, base_url, detected_server, powered_by, frameworks, technologies, response_headers, observed_endpoints, notes, scan_status, last_scanned_at, updated_at) FROM stdin;
713f40a4-dc36-4c4a-86cc-50ca5288b063	0235c556-93ee-4e06-9467-4d7b1f114867	http://10.0.0.39:8081	nginx/1.29.7	Next.js	["next.js"]	["next.js", "nginx"]	{"server": "nginx/1.29.7", "date": "Mon, 06 Apr 2026 08:17:16 GMT", "content-type": "text/html; charset=utf-8", "content-length": "6377", "connection": "close", "x-powered-by": "Next.js", "etag": "\\"14mjyx14h464w9\\"", "vary": "Accept-Encoding"}	["/"]	\N	ok	2026-04-06 08:17:16.464141+00	2026-04-06 08:17:16.464141+00
e67d5e36-f4d1-4f02-bf5e-1886305d785d	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	https://skynet.tn	cloudflare	\N	[]	["cloudflare"]	{"date": "Mon, 06 Apr 2026 08:17:16 GMT", "content-type": "text/html", "transfer-encoding": "chunked", "connection": "close", "report-to": "{\\"group\\":\\"cf-nel\\",\\"max_age\\":604800,\\"endpoints\\":[{\\"url\\":\\"https://a.nel.cloudflare.com/report/v4?s=%2Fa%2B9WmnOuL2Jr1TPSICESs01s1pRR%2FgPLFoq1dB9F59ORiI8JA7CrfQxy%2Bit6x7eBzhETQvNFq85UjJIhgoNG7wlSaPAQOySuUsOR5dWaq2RyMxd98FKVBhaIpc%3D\\"}]}", "server-timing": "cfEdge;dur=22,cfOrigin;dur=39", "last-modified": "Mon, 06 Apr 2026 01:30:11 GMT", "server": "cloudflare", "cf-cache-status": "DYNAMIC", "vary": "accept-encoding", "nel": "{\\"report_to\\":\\"cf-nel\\",\\"success_fraction\\":0.0,\\"max_age\\":604800}", "cf-ray": "9e7f5aef0b735bcd-TUN", "alt-svc": "h3=\\":443\\"; ma=86400"}	["/", "/tracker/test-site.html"]	\N	ok	2026-04-06 08:17:20.609528+00	2026-04-06 08:17:20.609528+00
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.tenants (id, name, slug, primary_host, description, default_theme_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: themes; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.themes (id, name, colors, layout, widgets, branding, is_default, is_active, created_at, updated_at) FROM stdin;
skynet-default	SkyNet Default	{"primary": "#22d3ee", "secondary": "#0f172a", "accent": "#06b6d4", "background": "#030712", "surface": "#111827", "text": "#e5e7eb", "muted": "#94a3b8", "success": "#10b981", "warning": "#f59e0b", "danger": "#ef4444"}	{"density": "comfortable", "sidebar": "expanded", "panel_style": "glass"}	[]	{"logo_text": "SkyNet", "tagline": "Security Dashboard"}	t	t	2026-04-03 14:56:49.259773+00	2026-04-03 14:56:49.259773+00
\.


--
-- Data for Name: threat_intel; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.threat_intel (id, source, severity, severity_label, affected_software, description, "references", published_at, updated_at) FROM stdin;
CVE-2026-35393	github	9.8	critical	["github.com/patrickhener/goshs", "go"]	goshs: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal') in goshs POST multipart upload	[]	2026-04-03 04:08:20+00	2026-04-03 14:56:53.162437+00
CVE-2026-35392	github	9.8	critical	["github.com/patrickhener/goshs", "go"]	goshs: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal') in goshs PUT Upload	[]	2026-04-03 04:07:55+00	2026-04-03 14:56:53.162437+00
CVE-2026-35039	github	9.8	critical	["fast-jwt", "npm"]	fast-jwt: Cache Confusion via cacheKeyBuilder Collisions Can Return Claims From a Different Token (Identity/Authorization Mixup)	[]	2026-04-03 04:07:09+00	2026-04-03 14:56:53.162437+00
CVE-2026-35038	github	3.1	low	["npm", "signalk-server"]	Signal K Server: Arbitrary Prototype Read via `from` Field Bypass	[]	2026-04-03 04:04:22+00	2026-04-03 14:56:53.162437+00
CVE-2026-34992	github	8.1	high	["antrea.io/antrea", "go"]	Antrea has Missing Encryption of Sensitive Data	[]	2026-04-03 04:02:47+00	2026-04-03 14:56:53.162437+00
CVE-2026-34989	github	9.8	critical	["ci4-cms-erp/ci4ms", "composer"]	CI4MS: Profile & User Management Full Account Takeover for All-Roles & Privilege-Escalation via Stored DOM XSS	[]	2026-04-03 04:00:57+00	2026-04-03 14:56:53.162437+00
CVE-2026-35175	github	8.1	high	["ajenti-panel", "pip"]	Ajenti has an authorization bypass during custom package installation	[]	2026-04-03 03:57:43+00	2026-04-03 14:56:53.162437+00
CVE-2026-35171	github	9.8	critical	["kedro", "pip"]	Kedro has Arbitrary Code Execution via Malicious Logging Configuration	[]	2026-04-03 03:48:48+00	2026-04-03 14:56:53.162437+00
CVE-2026-35168	github	8.1	high	["composer", "devcode-it/openstamanager"]	OpenSTAManager: SQL Injection via Aggiornamenti Module	[]	2026-04-03 03:47:37+00	2026-04-03 14:56:53.162437+00
CVE-2026-35167	github	8.1	high	["kedro", "pip"]	Kedro: Path Traversal in versioned dataset loading via unsanitized version string	[]	2026-04-03 03:46:48+00	2026-04-03 14:56:53.162437+00
GHSA-cjmm-f4jc-qw8r	github	5.6	medium	["dompurify", "npm"]	DOMPurify ADD_ATTR predicate skips URI validation	[]	2026-04-03 03:46:07+00	2026-04-03 14:56:53.162437+00
GHSA-cj63-jhhr-wcxv	github	5.6	medium	["dompurify", "npm"]	DOMPurify USE_PROFILES prototype pollution allows event handlers	[]	2026-04-03 03:45:08+00	2026-04-03 14:56:53.162437+00
CVE-2026-35052	github	5.6	medium	["dtale", "pip"]	D-Tale: Remote Code Execution through redis/shelf storage	[]	2026-04-03 03:44:39+00	2026-04-03 14:56:53.162437+00
GHSA-ghc5-95c2-vwcv	github	8.1	high	["auth0/symfony", "composer"]	Auth0 Symfony SDK has Insufficient Entropy in Cookie Encryption	[]	2026-04-03 03:44:13+00	2026-04-03 14:56:53.162437+00
GHSA-vfpx-q664-h93m	github	8.1	high	["auth0/wordpress", "composer"]	Auth0 WordPress Plugin has Insufficient Entropy in Cookie Encryption	[]	2026-04-03 03:43:13+00	2026-04-03 14:56:53.162437+00
GHSA-fmg6-246m-9g2v	github	8.1	high	["auth0/login", "composer"]	Auth0 laravel-auth0 SDK has Insufficient Entropy in Cookie Encryption	[]	2026-04-03 03:41:04+00	2026-04-03 14:56:53.162437+00
CVE-2026-32145	github	8.1	high	["erlang", "wisp"]	wisp has Allocation of Resources Without Limits or Throttling	[]	2026-04-03 03:40:30+00	2026-04-03 14:56:53.162437+00
CVE-2026-28815	github	8.1	high	["swift", "swift-crypto"]	Swift Crypto: X-Wing HPKE Decapsulation Accepts Malformed Ciphertext Length	[]	2026-04-03 03:39:38+00	2026-04-03 14:56:53.162437+00
CVE-2026-35037	github	8.1	high	["github.com/lin-snow/ech0", "go"]	Ech0: Unauthenticated SSRF in GetWebsiteTitle allows access to internal services and cloud metadata	[]	2026-04-03 03:33:00+00	2026-04-03 14:56:53.162437+00
CVE-2026-35036	github	8.1	high	["github.com/lin-snow/ech0", "go"]	Ech0 has Unauthenticated Server-Side Request Forgery in Website Preview Feature	[]	2026-04-03 03:30:53+00	2026-04-03 14:56:53.162437+00
CVE-1999-0095	nvd	10	critical	["eric allman", "eric allman sendmail", "sendmail"]	The debug command in Sendmail is enabled, allowing attackers to execute commands as root.	["http://seclists.org/fulldisclosure/2019/Jun/16", "http://www.openwall.com/lists/oss-security/2019/06/05/4", "http://www.openwall.com/lists/oss-security/2019/06/06/1", "http://www.osvdb.org/195", "http://www.securityfocus.com/bid/1", "http://seclists.org/fulldisclosure/2019/Jun/16", "http://www.openwall.com/lists/oss-security/2019/06/05/4", "http://www.openwall.com/lists/oss-security/2019/06/06/1", "http://www.osvdb.org/195", "http://www.securityfocus.com/bid/1"]	1988-10-01 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-0082	nvd	10	critical	["ftp", "ftp ftp", "ftpcd", "ftpcd ftpcd"]	CWD ~root command in ftpd allows root access.	["http://www.alw.nih.gov/Security/Docs/admin-guide-to-cracking.101.html", "http://www.alw.nih.gov/Security/Docs/admin-guide-to-cracking.101.html"]	1988-11-11 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-0209	nvd	5	medium	["sun", "sun sunos", "sunos"]	The SunView (SunTools) selection_svc facility allows remote users to read files.	["http://www.securityfocus.com/bid/8", "http://www.securityfocus.com/bid/8"]	1990-08-14 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1506	nvd	7.5	high	["sun", "sun sunos", "sunos"]	Vulnerability in SMI Sendmail 4.0 and earlier, on SunOS up to 4.0.3, allows remote attackers to access user bin.	["http://www.cert.org/advisories/CA-90.01.sun.sendmail.vulnerability", "http://www.securityfocus.com/bid/6", "http://www.cert.org/advisories/CA-90.01.sun.sendmail.vulnerability", "http://www.securityfocus.com/bid/6"]	1990-01-29 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1471	nvd	7.2	high	["bsd", "bsd bsd"]	Buffer overflow in passwd in BSD based operating systems 4.3 and earlier allows local users to gain root privileges by specifying a long shell or GECOS field.	["http://www.cert.org/advisories/CA-1989-01.html", "http://www.iss.net/security_center/static/7152.php", "http://www.securityfocus.com/bid/4", "http://www.cert.org/advisories/CA-1989-01.html", "http://www.iss.net/security_center/static/7152.php", "http://www.securityfocus.com/bid/4"]	1989-01-01 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1122	nvd	4.6	medium	["sun", "sun sunos", "sunos"]	Vulnerability in restore in SunOS 4.0.3 and earlier allows local users to gain privileges.	["http://www.cert.org/advisories/CA-1989-02.html", "http://www.ciac.org/ciac/bulletins/ciac-08.shtml", "http://www.securityfocus.com/bid/3", "https://exchange.xforce.ibmcloud.com/vulnerabilities/6695", "http://www.cert.org/advisories/CA-1989-02.html", "http://www.ciac.org/ciac/bulletins/ciac-08.shtml", "http://www.securityfocus.com/bid/3", "https://exchange.xforce.ibmcloud.com/vulnerabilities/6695"]	1989-07-26 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1467	nvd	10	critical	["sun", "sun sunos", "sunos"]	Vulnerability in rcp on SunOS 4.0.x allows remote attackers from trusted hosts to execute arbitrary commands as root, possibly related to the configuration of the nobody user.	["http://www.cert.org/advisories/CA-1989-07.html", "http://www.securityfocus.com/bid/5", "https://exchange.xforce.ibmcloud.com/vulnerabilities/3165", "http://www.cert.org/advisories/CA-1989-07.html", "http://www.securityfocus.com/bid/5", "https://exchange.xforce.ibmcloud.com/vulnerabilities/3165"]	1989-10-26 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-0084	nvd	8.4	high	["nfs", "sun", "sun nfs"]	Certain NFS servers allow users to use mknod to gain privileges by creating a writable kmem device and setting the UID to 0.	["https://exchange.xforce.ibmcloud.com/vulnerabilities/78", "https://exchange.xforce.ibmcloud.com/vulnerabilities/78"]	1990-05-01 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-2000-0388	nvd	7.5	high	["freebsd", "freebsd freebsd"]	Buffer overflow in FreeBSD libmytinfo library allows local users to execute commands via a long TERMCAP environmental variable.	["ftp://ftp.freebsd.org/pub/FreeBSD/CERT/advisories/FreeBSD-SA-00%3A17.libmytinfo.asc", "http://www.securityfocus.com/bid/1185", "ftp://ftp.freebsd.org/pub/FreeBSD/CERT/advisories/FreeBSD-SA-00%3A17.libmytinfo.asc", "http://www.securityfocus.com/bid/1185"]	1990-05-09 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1198	nvd	7.2	high	["next", "next next"]	BuildDisk program on NeXT systems before 2.0 does not prompt users for the root password, which allows local users to gain root privileges.	["http://ciac.llnl.gov/ciac/bulletins/b-01.shtml", "http://www.cert.org/advisories/CA-1990-06.html", "http://www.iss.net/security_center/static/7141.php", "http://www.securityfocus.com/bid/11", "http://ciac.llnl.gov/ciac/bulletins/b-01.shtml", "http://www.cert.org/advisories/CA-1990-06.html", "http://www.iss.net/security_center/static/7141.php", "http://www.securityfocus.com/bid/11"]	1990-10-03 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1391	nvd	7.2	high	["next", "next next"]	Vulnerability in NeXT 1.0a and 1.0 with publicly accessible printers allows local users to gain privileges via a combination of the npd program and weak directory permissions.	["http://ciac.llnl.gov/ciac/bulletins/b-01.shtml", "http://www.cert.org/advisories/CA-1990-06.html", "http://www.iss.net/security_center/static/7143.php", "http://www.securityfocus.com/bid/10", "http://ciac.llnl.gov/ciac/bulletins/b-01.shtml", "http://www.cert.org/advisories/CA-1990-06.html", "http://www.iss.net/security_center/static/7143.php", "http://www.securityfocus.com/bid/10"]	1990-10-03 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1392	nvd	7.2	high	["nex", "next", "next nex", "next next"]	Vulnerability in restore0.9 installation script in NeXT 1.0a and 1.0 allows local users to gain root privileges.	["http://ciac.llnl.gov/ciac/bulletins/b-01.shtml", "http://www.cert.org/advisories/CA-1990-06.html", "http://www.iss.net/security_center/static/7144.php", "http://www.securityfocus.com/bid/9", "http://ciac.llnl.gov/ciac/bulletins/b-01.shtml", "http://www.cert.org/advisories/CA-1990-06.html", "http://www.iss.net/security_center/static/7144.php", "http://www.securityfocus.com/bid/9"]	1990-10-03 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1057	nvd	4.6	medium	["digital", "digital vms", "vms"]	VMS 4.0 through 5.3 allows local users to gain privileges via the ANALYZE/PROCESS_DUMP dcl command.	["http://ciac.llnl.gov/ciac/bulletins/b-04.shtml", "http://www.cert.org/advisories/CA-1990-07.html", "http://www.iss.net/security_center/static/7137.php", "http://www.securityfocus.com/bid/12", "http://ciac.llnl.gov/ciac/bulletins/b-04.shtml", "http://www.cert.org/advisories/CA-1990-07.html", "http://www.iss.net/security_center/static/7137.php", "http://www.securityfocus.com/bid/12"]	1990-10-25 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1554	nvd	2.1	low	["irix", "sgi", "sgi irix"]	/usr/sbin/Mail on SGI IRIX 3.3 and 3.3.1 does not properly set the group ID to the group ID of the user who started Mail, which allows local users to read the mail of other users.	["http://www.cert.org/advisories/CA-1990-08.html", "http://www.iss.net/security_center/static/3164.php", "http://www.securityfocus.com/bid/13", "http://www.cert.org/advisories/CA-1990-08.html", "http://www.iss.net/security_center/static/3164.php", "http://www.securityfocus.com/bid/13"]	1990-10-31 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1197	nvd	7.2	high	["sun", "sun sunos", "sunos"]	TIOCCONS in SunOS 4.1.1 does not properly check the permissions of a user who tries to redirect console output and input, which could allow a local user to gain privileges.	["http://www.cert.org/advisories/CA-1990-12.html", "http://www.iss.net/security_center/static/7140.php", "http://www.securityfocus.com/bid/14", "http://www.cert.org/advisories/CA-1990-12.html", "http://www.iss.net/security_center/static/7140.php", "http://www.securityfocus.com/bid/14"]	1990-12-20 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1115	nvd	7.2	high	["apollo domain os", "hp", "hp apollo domain os"]	Vulnerability in the /etc/suid_exec program in HP Apollo Domain/OS sr10.2 and sr10.3 beta, related to the Korn Shell (ksh).	["http://www.cert.org/advisories/CA-1990-04.html", "http://www.ciac.org/ciac/bulletins/a-30.shtml", "http://www.iss.net/security_center/static/6721.php", "http://www.securityfocus.com/bid/7", "http://www.cert.org/advisories/CA-1990-04.html", "http://www.ciac.org/ciac/bulletins/a-30.shtml", "http://www.iss.net/security_center/static/6721.php", "http://www.securityfocus.com/bid/7"]	1990-12-31 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1258	nvd	5	medium	["sun", "sun sunos", "sunos"]	rpc.pwdauthd in SunOS 4.1.1 and earlier does not properly prevent remote access to the daemon, which allows remote attackers to obtain sensitive system information.	["http://sunsolve.sun.com/pub-cgi/retrieve.pl?doctype=coll&doc=secbull/102", "https://exchange.xforce.ibmcloud.com/vulnerabilities/1782", "http://sunsolve.sun.com/pub-cgi/retrieve.pl?doctype=coll&doc=secbull/102", "https://exchange.xforce.ibmcloud.com/vulnerabilities/1782"]	1991-01-15 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1438	nvd	7.2	high	["sun", "sun sunos", "sunos"]	Vulnerability in /bin/mail in SunOS 4.1.1 and earlier allows local users to gain root privileges via certain command line arguments.	["http://sunsolve.sun.com/pub-cgi/retrieve.pl?doctype=coll&doc=secbull/105", "http://www.cert.org/advisories/CA-91.01a.SunOS.mail.vulnerability", "http://www.securityfocus.com/bid/15", "http://sunsolve.sun.com/pub-cgi/retrieve.pl?doctype=coll&doc=secbull/105", "http://www.cert.org/advisories/CA-91.01a.SunOS.mail.vulnerability", "http://www.securityfocus.com/bid/15"]	1991-02-22 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1211	nvd	7.2	high	["sun", "sun sunos", "sunos"]	Vulnerability in in.telnetd in SunOS 4.1.1 and earlier allows local users to gain root privileges.	["http://www.cert.org/advisories/CA-1991-02.html", "https://exchange.xforce.ibmcloud.com/vulnerabilities/574", "http://www.cert.org/advisories/CA-1991-02.html", "https://exchange.xforce.ibmcloud.com/vulnerabilities/574"]	1991-03-27 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1212	nvd	7.2	high	["sun", "sun sunos", "sunos"]	Vulnerability in in.rlogind in SunOS 4.0.3 and 4.0.3c allows local users to gain root privileges.	["http://www.cert.org/advisories/CA-1991-02.html", "https://exchange.xforce.ibmcloud.com/vulnerabilities/574", "http://www.cert.org/advisories/CA-1991-02.html", "https://exchange.xforce.ibmcloud.com/vulnerabilities/574"]	1991-03-27 05:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1194	nvd	7.2	high	["digital", "digital ultrix", "ultrix"]	chroot in Digital Ultrix 4.1 and 4.0 is insecurely installed, which allows local users to gain privileges.	["http://www.cert.org/advisories/CA-1991-05.html", "http://www.securityfocus.com/bid/17", "https://exchange.xforce.ibmcloud.com/vulnerabilities/577", "http://www.cert.org/advisories/CA-1991-05.html", "http://www.securityfocus.com/bid/17", "https://exchange.xforce.ibmcloud.com/vulnerabilities/577"]	1991-05-01 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1193	nvd	10	critical	["next", "next next"]	The "me" user in NeXT NeXTstep 2.1 and earlier has wheel group privileges, which could allow the me user to use the su command to become root.	["http://www.cert.org/advisories/CA-1991-06.html", "http://www.securityfocus.com/bid/20", "https://exchange.xforce.ibmcloud.com/vulnerabilities/581", "http://www.cert.org/advisories/CA-1991-06.html", "http://www.securityfocus.com/bid/20", "https://exchange.xforce.ibmcloud.com/vulnerabilities/581"]	1991-05-14 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1123	nvd	7.2	high	["sun", "sun sunos", "sunos"]	The installation of Sun Source (sunsrc) tapes allows local users to gain root privileges via setuid root programs (1) makeinstall or (2) winstall.	["http://sunsolve.sun.com/pub-cgi/retrieve.pl?doctype=coll&doc=secbull/107&type=0&nav=sec.sba", "http://www.cert.org/advisories/CA-1991-07.html", "http://www.securityfocus.com/bid/21", "http://www.securityfocus.com/bid/22", "https://exchange.xforce.ibmcloud.com/vulnerabilities/582", "http://sunsolve.sun.com/pub-cgi/retrieve.pl?doctype=coll&doc=secbull/107&type=0&nav=sec.sba", "http://www.cert.org/advisories/CA-1991-07.html", "http://www.securityfocus.com/bid/21", "http://www.securityfocus.com/bid/22", "https://exchange.xforce.ibmcloud.com/vulnerabilities/582"]	1991-05-20 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1034	nvd	7.2	high	["att", "att svr4", "svr4"]	Vulnerability in login in AT&T System V Release 4 allows local users to gain privileges.	["http://www.cert.org/advisories/CA-1991-08.html", "http://www.ciac.org/ciac/bulletins/b-28.shtml", "http://www.securityfocus.com/bid/23", "https://exchange.xforce.ibmcloud.com/vulnerabilities/583", "http://www.cert.org/advisories/CA-1991-08.html", "http://www.ciac.org/ciac/bulletins/b-28.shtml", "http://www.securityfocus.com/bid/23", "https://exchange.xforce.ibmcloud.com/vulnerabilities/583"]	1991-05-23 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-1999-1415	nvd	4.6	medium	["digital", "digital ultrix", "ultrix"]	Vulnerability in /usr/bin/mail in DEC ULTRIX before 4.2 allows local users to gain privileges.	["http://www.cert.org/advisories/CA-91.13.Ultrix.mail.vulnerability", "http://www.securityfocus.com/bid/27", "http://www.cert.org/advisories/CA-91.13.Ultrix.mail.vulnerability", "http://www.securityfocus.com/bid/27"]	1991-08-23 04:00:00+00	2026-04-05 15:06:04.370855+00
CVE-2026-35464	github	8.1	high	["pip", "pyload-ng"]	pyLoad: Unprotected storage_folder enables arbitrary file write to Flask session store and code execution (Incomplete fix for CVE-2026-33509)	[]	2026-04-04 06:43:37+00	2026-04-05 15:06:04.370855+00
CVE-2026-35463	github	8.1	high	["pip", "pyload-ng"]	pyLoad: Improper Neutralization of Special Elements used in an OS Command	[]	2026-04-04 06:41:59+00	2026-04-05 15:06:04.370855+00
CVE-2026-35459	github	9.8	critical	["pip", "pyload-ng"]	pyLoad: SSRF filter bypass via HTTP redirect in BaseDownloader (Incomplete fix for CVE-2026-33992)	[]	2026-04-04 06:41:08+00	2026-04-05 15:06:04.370855+00
GHSA-5hr4-253g-cpx2	github	5.6	medium	["pip", "web3"]	web3.py: SSRF via CCIP Read (EIP-3668) OffchainLookup URL handling	[]	2026-04-04 06:38:11+00	2026-04-05 15:06:04.370855+00
CVE-2026-35457	github	8.1	high	["libp2p-rendezvous", "rust"]	libp2p-rendezvous: Unbounded rendezvous DISCOVER cookies enable remote memory exhaustion	[]	2026-04-04 06:34:29+00	2026-04-05 15:06:04.370855+00
CVE-2026-35405	github	8.1	high	["libp2p-rendezvous", "rust"]	libp2p-rendezvous: Unlimited namespace registrations per peer enables OOM DoS on rendezvous servers	[]	2026-04-04 06:33:46+00	2026-04-05 15:06:04.370855+00
GHSA-9jpj-g8vv-j5mf	github	8.1	high	["npm", "openclaw"]	OpenClaw: Gemini OAuth exposed the PKCE verifier through the OAuth state parameter	[]	2026-04-04 06:26:55+00	2026-04-05 15:06:04.370855+00
CVE-2026-35454	github	8.1	high	["github.com/coder/code-marketplace", "go"]	Code Extension Marketplace: Zip Slip Path Traversal	[]	2026-04-04 06:26:02+00	2026-04-05 15:06:04.370855+00
CVE-2026-35209	github	8.1	high	["defu", "npm"]	defu: Prototype pollution via `__proto__` key in defaults argument	[]	2026-04-04 06:17:53+00	2026-04-05 15:06:04.370855+00
CVE-2026-35452	github	5.6	medium	["composer", "wwbn/avideo"]	AVideo: Unauthenticated Information Disclosure via Missing Auth on CloneSite client.log.php	[]	2026-04-04 06:17:17+00	2026-04-05 15:06:04.370855+00
CVE-2026-35450	github	5.6	medium	["composer", "wwbn/avideo"]	AVideo: Unauthenticated FFmpeg Remote Server Status Disclosure via check.ffmpeg.json.php	[]	2026-04-04 06:16:49+00	2026-04-05 15:06:04.370855+00
CVE-2026-35449	github	5.6	medium	["composer", "wwbn/avideo"]	AVideo: Unauthenticated Information Disclosure via Disabled CLI Guard in install/test.php	[]	2026-04-04 06:16:18+00	2026-04-05 15:06:04.370855+00
CVE-2026-35448	github	3.1	low	["composer", "wwbn/avideo"]	AVideo: Unauthenticated Access to Payment Order Data via BlockonomicsYPT check.php	[]	2026-04-04 06:15:37+00	2026-04-05 15:06:04.370855+00
CVE-2026-30762	github	8.1	high	["lightrag-hku", "pip"]	LightRAG: Hardcoded JWT Signing Secret Allows Authentication Bypass	[]	2026-04-04 06:14:41+00	2026-04-05 15:06:04.370855+00
CVE-2026-35442	github	8.1	high	["directus", "npm"]	Directus: Authenticated Users Can Extract Concealed Fields via Aggregate Queries	[]	2026-04-04 06:13:57+00	2026-04-05 15:06:04.370855+00
GHSA-6q22-g298-grjh	github	8.1	high	["directus", "npm"]	Directus: Unauthenticated Denial of Service via GraphQL Alias Amplification of Expensive Health Check Resolver	[]	2026-04-04 06:13:25+00	2026-04-05 15:06:04.370855+00
CVE-2026-35441	github	5.6	medium	["directus", "npm"]	Directus: GraphQL Alias Amplification Denial of Service Due to Missing Query Cost/Complexity Limits	[]	2026-04-04 06:12:52+00	2026-04-05 15:06:04.370855+00
GHSA-mvv8-v4jj-g47j	github	5.6	medium	["directus", "npm"]	Directus: Sensitive fields exposed in revision history	[]	2026-04-04 06:12:07+00	2026-04-05 15:06:04.370855+00
CVE-2026-35412	github	8.1	high	["directus", "npm"]	Directus: TUS Upload Authorization Bypass Allows Arbitrary File Overwrite	[]	2026-04-04 06:11:18+00	2026-04-05 15:06:04.370855+00
CVE-2026-35409	github	8.1	high	["directus", "npm"]	Directus: SSRF Protection Bypass via IPv4-Mapped IPv6 Addresses in File Import	[]	2026-04-04 06:10:53+00	2026-04-05 15:06:04.370855+00
CVE-2024-6387	local	8.1	high	["openssh", "ssh"]	OpenSSH regreSSHion race condition that can permit remote code execution on affected sshd builds.	["https://nvd.nist.gov/vuln/detail/CVE-2024-6387"]	\N	2026-04-05 15:06:04.370855+00
CVE-2024-3400	local	10	critical	["pan-os", "globalprotect"]	Command injection in PAN-OS GlobalProtect gateway and portal handling.	["https://nvd.nist.gov/vuln/detail/CVE-2024-3400"]	\N	2026-04-05 15:06:04.370855+00
CVE-2023-50164	local	9.8	critical	["apache struts", "struts"]	Path traversal and file upload issue in Apache Struts enabling remote code execution in vulnerable deployments.	["https://nvd.nist.gov/vuln/detail/CVE-2023-50164"]	\N	2026-04-05 15:06:04.370855+00
CVE-2024-4577	local	9.8	critical	["php", "php-cgi"]	Argument injection in PHP-CGI on Windows that can lead to remote code execution.	["https://nvd.nist.gov/vuln/detail/CVE-2024-4577"]	\N	2026-04-05 15:06:04.370855+00
CVE-2023-46604	local	10	critical	["apache activemq", "activemq"]	Deserialization vulnerability in Apache ActiveMQ OpenWire protocol handling.	["https://nvd.nist.gov/vuln/detail/CVE-2023-46604"]	\N	2026-04-05 15:06:04.370855+00
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.user_profiles (id, external_user_id, email, display_name, current_risk_score, trust_level, total_devices, total_sessions, first_seen, last_seen, last_ip, last_country, enhanced_audit, profile_data) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.users (id, email, username, hashed_password, role, status, last_login, created_at, theme_id, theme_source, tenant_id) FROM stdin;
001789a6-808f-4c81-b255-c527c4b72771	admin@skynet.local	admin	$2b$12$QrI4/Bli8uc1HTGZmLVpiuouT9ne61246scItQJOvY4l6CokFJOyS	superadmin	active	2026-04-03 02:20:31.219037+00	2026-03-31 22:02:57.343503+00	skynet-default	default	\N
\.


--
-- Data for Name: visitors; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.visitors (id, ip, country, country_code, country_flag, city, isp, device_type, browser, os, user_agent, status, page_views, site_id, linked_user, device_id, first_seen, last_seen, external_user_id) FROM stdin;
4e27a193-73e1-43af-9a18-acbbd527c434	172.18.0.5	\N	\N	\N	\N	\N	desktop	Firefox 148.0	Windows 10	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	active	1	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	\N	1dc839a9-deb9-435d-89b9-234a30052c67	2026-04-01 00:07:08.817029+00	2026-04-01 00:07:08.813661+00	\N
571cab5e-345e-4b27-bc92-8a75f4124970	172.18.0.5	\N	\N	\N	\N	\N	mobile	Firefox Mobile 149.0	Android 15	Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0	active	4	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	2026-04-01 00:08:25.598127+00	2026-04-01 00:09:20.258285+00	\N
5c520609-ff41-4d8e-a646-9dd297a711e0	196.178.42.221	Tunisia	TN	🇹🇳	Tunis	\N	desktop	Firefox 148.0	Windows 10	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	active	1	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	\N	1dc839a9-deb9-435d-89b9-234a30052c67	2026-04-01 00:24:56.511509+00	2026-04-01 00:24:56.507009+00	\N
8b9426b6-d76d-4119-b92e-c3a4dfd14a6c	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	Tunisia	TN	🇹🇳	Tunis	\N	desktop	Chrome 146.0.0	Linux	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	active	5	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	\N	2e6e3f8d-c78b-46a7-ad1d-792b64bd0fa4	2026-04-01 00:25:50.191468+00	2026-04-01 00:27:58.442341+00	\N
5454eb60-99ca-421a-b5eb-f982b600909f	2c0f:f698:c13c:a1fd:18a1:d1be:54e4:81be	Tunisia	TN	🇹🇳	Tunis	\N	mobile	Firefox Mobile 149.0	Android 15	Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0	active	5	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	2026-04-01 00:25:13.178846+00	2026-04-01 00:28:42.261076+00	\N
db906213-dfae-44ba-87b4-5e37558d8749	196.178.42.221	Tunisia	TN	🇹🇳	Tunis	\N	mobile	Firefox Mobile 149.0	Android 15	Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0	active	3	0738bfc4-d07a-48fd-9c96-c6f36cba5cf5	\N	a632ed74-9c55-4cf6-aaf0-002ea91204dd	2026-04-01 00:29:09.450763+00	2026-04-01 00:29:36.193654+00	\N
\.


--
-- Name: block_page_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: skynet
--

SELECT pg_catalog.setval('public.block_page_config_id_seq', 1, false);


--
-- Name: runtime_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: skynet
--

SELECT pg_catalog.setval('public.runtime_config_id_seq', 1, false);


--
-- Name: activity_events activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: anomaly_flags anomaly_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: block_page_config block_page_config_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.block_page_config
    ADD CONSTRAINT block_page_config_pkey PRIMARY KEY (id);


--
-- Name: blocked_ips blocked_ips_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.blocked_ips
    ADD CONSTRAINT blocked_ips_pkey PRIMARY KEY (ip);


--
-- Name: blocking_rules blocking_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.blocking_rules
    ADD CONSTRAINT blocking_rules_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: identity_links identity_links_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);


--
-- Name: risk_events risk_events_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.risk_events
    ADD CONSTRAINT risk_events_pkey PRIMARY KEY (id);


--
-- Name: runtime_config runtime_config_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.runtime_config
    ADD CONSTRAINT runtime_config_pkey PRIMARY KEY (id);


--
-- Name: security_findings security_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.security_findings
    ADD CONSTRAINT security_findings_pkey PRIMARY KEY (id);


--
-- Name: security_recommendations security_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.security_recommendations
    ADD CONSTRAINT security_recommendations_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: target_profile target_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.target_profile
    ADD CONSTRAINT target_profile_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: themes themes_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_pkey PRIMARY KEY (id);


--
-- Name: threat_intel threat_intel_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.threat_intel
    ADD CONSTRAINT threat_intel_pkey PRIMARY KEY (id);


--
-- Name: identity_links uq_identity_link_user_device; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT uq_identity_link_user_device UNIQUE (external_user_id, fingerprint_id);


--
-- Name: user_profiles user_profiles_external_user_id_key; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_external_user_id_key UNIQUE (external_user_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visitors visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_pkey PRIMARY KEY (id);


--
-- Name: ix_activity_events_event_type; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_activity_events_event_type ON public.activity_events USING btree (event_type);


--
-- Name: ix_activity_events_session_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_activity_events_session_id ON public.activity_events USING btree (session_id);


--
-- Name: ix_activity_events_user_created; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_activity_events_user_created ON public.activity_events USING btree (external_user_id, created_at);


--
-- Name: ix_anomaly_flags_detected_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_anomaly_flags_detected_at ON public.anomaly_flags USING btree (detected_at);


--
-- Name: ix_anomaly_flags_external_user_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_anomaly_flags_external_user_id ON public.anomaly_flags USING btree (external_user_id);


--
-- Name: ix_anomaly_flags_status_severity; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_anomaly_flags_status_severity ON public.anomaly_flags USING btree (status, severity);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);


--
-- Name: ix_audit_logs_created_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: ix_audit_logs_ip; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_audit_logs_ip ON public.audit_logs USING btree (ip);


--
-- Name: ix_audit_logs_target_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_audit_logs_target_id ON public.audit_logs USING btree (target_id);


--
-- Name: ix_audit_logs_target_type; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_audit_logs_target_type ON public.audit_logs USING btree (target_type);


--
-- Name: ix_devices_composite_fingerprint; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_devices_composite_fingerprint ON public.devices USING btree (composite_fingerprint);


--
-- Name: ix_devices_device_cookie_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_devices_device_cookie_id ON public.devices USING btree (device_cookie_id);


--
-- Name: ix_devices_fingerprint; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_devices_fingerprint ON public.devices USING btree (fingerprint);


--
-- Name: ix_devices_match_key; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_devices_match_key ON public.devices USING btree (match_key);


--
-- Name: ix_devices_status; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_devices_status ON public.devices USING btree (status);


--
-- Name: ix_events_created_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_events_created_at ON public.events USING btree (created_at);


--
-- Name: ix_events_event_type; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_events_event_type ON public.events USING btree (event_type);


--
-- Name: ix_events_site_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_events_site_id ON public.events USING btree (site_id);


--
-- Name: ix_events_visitor_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_events_visitor_id ON public.events USING btree (visitor_id);


--
-- Name: ix_identity_links_external_user_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_identity_links_external_user_id ON public.identity_links USING btree (external_user_id);


--
-- Name: ix_identity_links_fingerprint_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_identity_links_fingerprint_id ON public.identity_links USING btree (fingerprint_id);


--
-- Name: ix_notification_deliveries_channel; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_notification_deliveries_channel ON public.notification_deliveries USING btree (channel);


--
-- Name: ix_notification_deliveries_created_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_notification_deliveries_created_at ON public.notification_deliveries USING btree (created_at);


--
-- Name: ix_notification_deliveries_event_type; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_notification_deliveries_event_type ON public.notification_deliveries USING btree (event_type);


--
-- Name: ix_notification_deliveries_incident_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_notification_deliveries_incident_id ON public.notification_deliveries USING btree (incident_id);


--
-- Name: ix_notification_deliveries_status; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_notification_deliveries_status ON public.notification_deliveries USING btree (status);


--
-- Name: ix_risk_events_user_created; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_risk_events_user_created ON public.risk_events USING btree (external_user_id, created_at);


--
-- Name: ix_security_findings_active_exploitation_suspected; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_active_exploitation_suspected ON public.security_findings USING btree (active_exploitation_suspected);


--
-- Name: ix_security_findings_correlated_risk_score; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_correlated_risk_score ON public.security_findings USING btree (correlated_risk_score);


--
-- Name: ix_security_findings_created_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_created_at ON public.security_findings USING btree (created_at);


--
-- Name: ix_security_findings_finding_type; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_finding_type ON public.security_findings USING btree (finding_type);


--
-- Name: ix_security_findings_profile_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_profile_id ON public.security_findings USING btree (profile_id);


--
-- Name: ix_security_findings_severity; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_severity ON public.security_findings USING btree (severity);


--
-- Name: ix_security_findings_site_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_site_id ON public.security_findings USING btree (site_id);


--
-- Name: ix_security_findings_status; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_findings_status ON public.security_findings USING btree (status);


--
-- Name: ix_security_recommendations_created_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_recommendations_created_at ON public.security_recommendations USING btree (created_at);


--
-- Name: ix_security_recommendations_finding_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_recommendations_finding_id ON public.security_recommendations USING btree (finding_id);


--
-- Name: ix_security_recommendations_priority; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_recommendations_priority ON public.security_recommendations USING btree (priority);


--
-- Name: ix_security_recommendations_status; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_security_recommendations_status ON public.security_recommendations USING btree (status);


--
-- Name: ix_sites_api_key; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_sites_api_key ON public.sites USING btree (api_key);


--
-- Name: ix_target_profile_base_url; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_target_profile_base_url ON public.target_profile USING btree (base_url);


--
-- Name: ix_target_profile_last_scanned_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_target_profile_last_scanned_at ON public.target_profile USING btree (last_scanned_at);


--
-- Name: ix_target_profile_site_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_target_profile_site_id ON public.target_profile USING btree (site_id);


--
-- Name: ix_tenants_default_theme_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_tenants_default_theme_id ON public.tenants USING btree (default_theme_id);


--
-- Name: ix_tenants_name; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_tenants_name ON public.tenants USING btree (name);


--
-- Name: ix_tenants_primary_host; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_tenants_primary_host ON public.tenants USING btree (primary_host);


--
-- Name: ix_tenants_slug; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_tenants_slug ON public.tenants USING btree (slug);


--
-- Name: ix_themes_name; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_themes_name ON public.themes USING btree (name);


--
-- Name: ix_threat_intel_severity; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_threat_intel_severity ON public.threat_intel USING btree (severity);


--
-- Name: ix_threat_intel_source; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_threat_intel_source ON public.threat_intel USING btree (source);


--
-- Name: ix_threat_intel_updated_at; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_threat_intel_updated_at ON public.threat_intel USING btree (updated_at);


--
-- Name: ix_user_profiles_external_user_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_user_profiles_external_user_id ON public.user_profiles USING btree (external_user_id);


--
-- Name: ix_user_profiles_risk_score; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_user_profiles_risk_score ON public.user_profiles USING btree (current_risk_score);


--
-- Name: ix_user_profiles_trust_level; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_user_profiles_trust_level ON public.user_profiles USING btree (trust_level);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_tenant_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_users_tenant_id ON public.users USING btree (tenant_id);


--
-- Name: ix_users_theme_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_users_theme_id ON public.users USING btree (theme_id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: ix_visitors_external_user_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_visitors_external_user_id ON public.visitors USING btree (external_user_id);


--
-- Name: ix_visitors_ip; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_visitors_ip ON public.visitors USING btree (ip);


--
-- Name: ix_visitors_site_device_ip; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_visitors_site_device_ip ON public.visitors USING btree (site_id, device_id, ip);


--
-- Name: ix_visitors_status; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_visitors_status ON public.visitors USING btree (status);


--
-- Name: activity_events activity_events_fingerprint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_fingerprint_id_fkey FOREIGN KEY (fingerprint_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: activity_events activity_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: devices devices_linked_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_linked_user_fkey FOREIGN KEY (linked_user) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: events events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: tenants fk_tenants_default_theme_id_themes; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT fk_tenants_default_theme_id_themes FOREIGN KEY (default_theme_id) REFERENCES public.themes(id) ON DELETE SET NULL;


--
-- Name: users fk_users_tenant_id_tenants; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


--
-- Name: users fk_users_theme_id_themes; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_theme_id_themes FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE SET NULL;


--
-- Name: identity_links identity_links_fingerprint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_fingerprint_id_fkey FOREIGN KEY (fingerprint_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: identity_links identity_links_visitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.identity_links
    ADD CONSTRAINT identity_links_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.visitors(id) ON DELETE SET NULL;


--
-- Name: security_findings security_findings_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.security_findings
    ADD CONSTRAINT security_findings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.target_profile(id) ON DELETE SET NULL;


--
-- Name: security_findings security_findings_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.security_findings
    ADD CONSTRAINT security_findings_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: security_recommendations security_recommendations_finding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.security_recommendations
    ADD CONSTRAINT security_recommendations_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.security_findings(id) ON DELETE CASCADE;


--
-- Name: target_profile target_profile_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.target_profile
    ADD CONSTRAINT target_profile_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: visitors visitors_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE SET NULL;


--
-- Name: visitors visitors_linked_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_linked_user_fkey FOREIGN KEY (linked_user) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: visitors visitors_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict ct5DRXFYzgaLb3RJfZcSL1qU36gkWcoCZsWonnidQZU32bQ07w6L7ib0MrLUjPf

