--
-- PostgreSQL database dump
--

\restrict cuhZBgKzs187wvGbs2L16eJpxXygfjd1FwRYdo0pNN51anFj5JcSeplaHC5gfkO

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
    'user'
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
    last_known_platform character varying(20)
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
    created_at timestamp with time zone NOT NULL
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
    last_seen timestamp with time zone NOT NULL
);


ALTER TABLE public.visitors OWNER TO skynet;

--
-- Name: block_page_config id; Type: DEFAULT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.block_page_config ALTER COLUMN id SET DEFAULT nextval('public.block_page_config_id_seq'::regclass);


--
-- Data for Name: activity_events; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.activity_events (id, external_user_id, event_type, platform, site_id, fingerprint_id, ip, country, page_url, properties, session_id, created_at) FROM stdin;
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.alembic_version (version_num) FROM stdin;
0011
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
7abc4687-f08c-4835-ba49-fb628165fbbd	1462da9a-dee3-42b7-a952-f419547d339b	LOGIN	\N	\N	10.0.0.21	\N	2026-03-30 15:27:36.945484+00
b1135e45-2bec-45b1-978c-929b99e1a636	1462da9a-dee3-42b7-a952-f419547d339b	DELETE_DEVICE	device	9fc8322a-4a15-4f15-86f5-11e66ea957b6	10.0.0.21	\N	2026-03-30 15:28:46.0758+00
1fbc0b67-ec36-4cca-8282-58b96598678e	1462da9a-dee3-42b7-a952-f419547d339b	BLOCK_DEVICE	device	d6d8c4ee-e33b-4c38-a484-a0813cd0077b	10.0.0.21	\N	2026-03-30 15:32:30.467063+00
aaa63234-2dce-46b0-a0c6-50bdf99dd067	1462da9a-dee3-42b7-a952-f419547d339b	UNBLOCK_DEVICE	device	d6d8c4ee-e33b-4c38-a484-a0813cd0077b	10.0.0.21	\N	2026-03-30 15:48:13.839137+00
1d6b6906-815f-4ed9-81c5-aa2657513240	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	smtp	10.0.0.21	\N	2026-03-30 21:29:59.561825+00
446becff-b573-4887-a776-7c23d9094103	1462da9a-dee3-42b7-a952-f419547d339b	RESET_PASSWORD	user	1462da9a-dee3-42b7-a952-f419547d339b	10.0.0.21	\N	2026-03-30 21:31:00.096894+00
1653d1ea-5858-410c-968f-0827cf945ce8	1462da9a-dee3-42b7-a952-f419547d339b	GEOIP_UPLOAD	settings	geoip	10.0.0.21	\N	2026-03-30 21:42:33.992921+00
ab96cdf9-2baf-43d5-95a6-e34f6ed5b6f2	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	general	10.0.0.21	{"updated_keys": ["anonymize_ips", "auto_block_tor_vpn", "base_url", "event_retention_days", "geoip_provider", "incident_retention_days", "instance_name", "realtime_enabled", "require_auth", "smtp_enabled", "smtp_from_email", "smtp_from_name", "smtp_host", "smtp_password", "smtp_port", "smtp_ssl", "smtp_tls", "smtp_user", "timezone", "visitor_retention_days", "webhook_events", "webhook_secret", "webhook_url"]}	2026-03-30 21:42:40.378182+00
aaf1b96a-9111-41c0-bde6-ae92f1a0347b	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	smtp	10.0.0.21	\N	2026-03-30 21:44:00.665132+00
ab39c7bb-3b6c-4378-a0d6-7d8cca5c4ab1	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	smtp	10.0.0.21	\N	2026-03-30 21:44:32.136134+00
883374df-95b2-42c4-8c2f-b1b340d05c29	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	smtp	10.0.0.21	\N	2026-03-30 21:44:57.257973+00
3424fe61-fcd1-4fcb-9320-638cbf92a0ab	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	smtp	10.0.0.21	\N	2026-03-30 21:48:18.59534+00
a6c7e2ec-57e9-487d-97dc-f971a6b68e5d	1462da9a-dee3-42b7-a952-f419547d339b	GEOIP_UPLOAD	settings	geoip	10.0.0.21	\N	2026-03-30 22:33:37.225336+00
c7c2ba50-cd9a-49fd-83c4-c556e73797fd	1462da9a-dee3-42b7-a952-f419547d339b	GEOIP_UPLOAD	settings	geoip	10.0.0.21	\N	2026-03-30 22:33:51.054017+00
b13d4f07-a717-4289-a83f-4dc9735530a8	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	smtp	10.0.0.21	\N	2026-03-30 22:35:26.860858+00
bbb94bfa-3279-4600-82c8-f1ecd234e6e7	1462da9a-dee3-42b7-a952-f419547d339b	CONFIG_CHANGE	settings	smtp	10.0.0.21	\N	2026-03-30 22:35:36.061265+00
fd604f24-3246-4b8f-8ff8-f1dda25caace	1462da9a-dee3-42b7-a952-f419547d339b	BLOCK_DEVICE	device	ff0a3844-61f8-4afe-8cc3-a38627f9c791	10.0.0.21	\N	2026-03-30 23:25:41.887156+00
664b7485-ad48-4ec1-a962-a27c8f6d8931	1462da9a-dee3-42b7-a952-f419547d339b	UNBLOCK_DEVICE	device	ff0a3844-61f8-4afe-8cc3-a38627f9c791	10.0.0.21	\N	2026-03-30 23:25:50.012635+00
059f528b-96d0-4179-8ed2-5c9ca18a6a3c	1462da9a-dee3-42b7-a952-f419547d339b	RESET_PASSWORD	user	1462da9a-dee3-42b7-a952-f419547d339b	10.0.0.21	\N	2026-03-31 00:30:54.201696+00
e38bbe94-9530-4274-b378-c6be44fbe07b	1462da9a-dee3-42b7-a952-f419547d339b	RESET_PASSWORD	user	1462da9a-dee3-42b7-a952-f419547d339b	10.0.0.21	\N	2026-03-31 00:41:24.229784+00
d26b5c3d-b167-45f2-ab8f-1d4bce03fb7b	1462da9a-dee3-42b7-a952-f419547d339b	UPDATE_USER	user	1462da9a-dee3-42b7-a952-f419547d339b	10.0.0.21	{"email": "marwen.sadkaoui@gmail.com", "role": "admin"}	2026-03-31 00:42:05.95003+00
341b2a56-0f98-4e84-8018-e6f0c428302e	1462da9a-dee3-42b7-a952-f419547d339b	REVOKE_SESSION	session	9cb5627e-730d-480f-99db-20eb15310553	10.0.0.21	{"user_id": "1462da9a-dee3-42b7-a952-f419547d339b"}	2026-03-31 00:42:39.029776+00
8f839f7a-41dd-4e51-b422-85ada12b0820	\N	LOGIN_FAILED	\N	\N	10.0.0.21	{"attempted_username": "marwen.sadkaoui@gmail.com"}	2026-03-31 00:43:03.140974+00
8bd0c553-c884-4cd6-bb8d-810656028493	1462da9a-dee3-42b7-a952-f419547d339b	LOGIN	\N	\N	10.0.0.21	\N	2026-03-31 00:43:18.231616+00
7003f4c4-ec50-4cc8-be60-1ae3863cdeaf	1462da9a-dee3-42b7-a952-f419547d339b	LOGOUT	\N	\N	10.0.0.21	\N	2026-03-31 00:43:51.212186+00
6941f530-07ed-4d6e-8be2-86beb47f6137	1462da9a-dee3-42b7-a952-f419547d339b	LOGIN	\N	\N	10.0.0.21	\N	2026-03-31 00:44:04.999821+00
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

COPY public.devices (id, fingerprint, type, browser, os, screen_resolution, language, timezone, canvas_hash, webgl_hash, audio_hash, font_list, risk_score, status, linked_user, first_seen, last_seen, match_key, match_version, owner_user_id, shared_user_count, last_known_platform) FROM stdin;
39168861-489a-4be1-9eef-d4c959ae034e	68af318a-000000ed	\N	\N	\N	1920x1080	fr-FR	Africa/Lagos	D//zAovAoAAAAGSURBVAMATZB/fj0VanwAAAAASUVORK5CYII=	R29vZ2xlIEluYy4gKE5WSURJQSk6OkFO	\N	\N	0	active	\N	2026-03-30 05:06:57.148294+00	2026-03-30 05:06:59.942319+00	strict:v1:2ce5c032744d7dfea7f7834a	1	\N	0	\N
ed0f354e-1c89-43b0-b889-5770448a0080	0cf987df-000000f2	\N	\N	\N	412x846	fr-FR	Africa/Tunis	//s0b7ZQAAAAZJREFUAwCn9nF+Vg5RPAAAAABJRU5ErkJggg==	QVJNOjpNYWxpLUc3Mg==	\N	\N	0	active	\N	2026-03-30 05:07:17.232496+00	2026-03-30 05:07:17.232499+00	strict:v1:c2e34864232c08e329a1de74	1	\N	0	\N
d6d8c4ee-e33b-4c38-a484-a0813cd0077b	5f059400-000000ed	\N	\N	\N	2048x1152	fr-FR	Etc/GMT-1	D//zAovAoAAAAGSURBVAMATZB/fj0VanwAAAAASUVORK5CYII=	R29vZ2xlIEluYy4gKE5WSURJQSk6OkFO	\N	\N	0	active	\N	2026-03-30 15:31:30.455563+00	2026-03-30 15:31:32.930851+00	strict:v1:0396b351ba54d49decffdf8e	1	\N	0	\N
fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	5737bac4-000000c8	mobile	Firefox Mobile 149.0	Android 15	456x1013	fr-FR	Africa/Tunis	sJNN2mfQ4QIPb5RqXaiAP/A3jeklavtrKDAAAAAElFTkSuQmCC	QVJNOjpNYWxpLUc1MSwgb3Igc2ltaWxh	\N	\N	0	active	\N	2026-03-30 00:19:33.457701+00	2026-03-30 21:38:58.108122+00	strict:v1:9665995d17edd0d1765156be	1	\N	0	\N
ff0a3844-61f8-4afe-8cc3-a38627f9c791	0f5a4302-000000f2	mobile	Chrome Mobile 146.0.0	Android 10	412x915	fr-FR	Africa/Tunis	D//1ayDLMAAAAGSURBVAMAH0J+fssHfUoAAAAASUVORK5CYII=	QVJNOjpNYWxpLUc3OA==	\N	\N	0	active	\N	2026-03-30 16:15:39.012183+00	2026-03-30 21:39:08.786233+00	strict:v1:0e90f3e14e836ceacb694beb	1	\N	0	\N
0dcffe13-f0ca-4d62-80f1-e63f89d3e498	5f71a721-00000146	mobile	Facebook 554.0.0	Android 15	360x800	fr-TN	Africa/Tunis	D//7iGYmMAAAAGSURBVAMAN6B7fnmQChAAAAAASUVORK5CYII=	UXVhbGNvbW06OkFkcmVubyAoVE0pIDYx	\N	\N	0	active	\N	2026-03-30 17:36:11.860859+00	2026-03-30 17:36:11.859478+00	strict:v1:be09d975253b5ea22ab0282e	1	\N	0	\N
63365840-e9e9-46b7-b700-bc560d08cf9f	5e682e07-00000135	mobile	HeyTap Browser 45.14.0	Android 15	360x800	fr-TN	Africa/Tunis	SMLkuACtJlU0cnbg4C/wf9xoBW57ilOwAAAABJRU5ErkJggg==	UXVhbGNvbW06OkFkcmVubyAoVE0pIDYx	\N	\N	0	active	\N	2026-03-30 17:37:07.631062+00	2026-03-30 17:37:07.630861+00	strict:v1:be09d975253b5ea22ab0282e	1	\N	0	\N
69fb97ab-8210-49dc-8bfa-95e6d19764da	26e1b036-000000cb	desktop	Firefox 148.0	Windows 10	2048x1152	fr	Etc/GMT-1	RvhdG/TyuAgPh0+HDyeivwL8sa00etDXvpAAAAAElFTkSuQmCC	R29vZ2xlIEluYy4gKE5WSURJQSk6OkFO	\N	\N	0	active	\N	2026-03-30 00:18:33.244028+00	2026-03-30 21:35:07.886549+00	strict:v1:0396b351ba54d49decffdf8e	1	\N	0	\N
9ef0b519-4573-4fd3-a469-3e9e1c9358c8	2f0c62a1-000000f2	mobile	Chrome Mobile 146.0.0	Android 10	846x412	fr-FR	Africa/Tunis	//s0b7ZQAAAAZJREFUAwCn9nF+Vg5RPAAAAABJRU5ErkJggg==	QVJNOjpNYWxpLUc3Mg==	\N	\N	0	active	\N	2026-03-30 21:36:16.322577+00	2026-03-30 21:36:46.031496+00	strict:v1:d6cfe78401f12e810130055c	1	\N	0	\N
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.events (id, site_id, visitor_id, user_id, device_id, event_type, page_url, referrer, properties, ip, created_at) FROM stdin;
0ff3892a-0699-4c06-b0ae-3ee5c0b49d16	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 00:18:33.245295+00
a036b933-5c16-43be-89eb-1e77906c74c2	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html	\N	\N	10.0.0.30	2026-03-30 00:19:33.458269+00
1dd6d826-f447-4af8-a555-41e63431cd31	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 00:45:04.38056+00
b9e94abe-0137-4018-9eca-431fb0a4cb80	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 00:49:30.337984+00
316bcbec-bd50-4495-b21a-65e37b1f2035	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 01:30:11.14841+00
1786d07e-ad77-426c-9b57-6afb3d0aa08c	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 02:29:57.49184+00
8361efdc-cad5-44a2-bc20-bcbe8e3bd526	ccc2be3a-e01a-4eac-b167-4054f575c464	c6e44c5a-000f-458a-b4ba-ff9971a5ad43	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html	\N	\N	10.0.0.20	2026-03-30 05:06:57.149492+00
d1e142f1-3791-4929-bb94-d85b51379875	ccc2be3a-e01a-4eac-b167-4054f575c464	c6e44c5a-000f-458a-b4ba-ff9971a5ad43	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html	\N	\N	10.0.0.20	2026-03-30 05:06:58.224636+00
436ad566-ac41-4856-89ef-c8c0ffc18f3b	ccc2be3a-e01a-4eac-b167-4054f575c464	c6e44c5a-000f-458a-b4ba-ff9971a5ad43	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html	\N	\N	10.0.0.20	2026-03-30 05:06:59.942899+00
c4532ba8-726d-439b-865e-c1bda41b33b1	ccc2be3a-e01a-4eac-b167-4054f575c464	f8748a75-055d-40b0-a052-22ccce5fe015	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html	\N	\N	10.0.0.34	2026-03-30 05:07:17.233014+00
16103dd5-aefc-44a8-aedd-ccc7f92d5ca6	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 05:08:04.425851+00
cd4a6ff4-9f7c-4c23-b050-1b365a076b5c	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 05:08:15.231241+00
ef8100b0-ddbd-4afa-91f8-e36ad7317e26	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 05:26:38.224661+00
7635b67c-048a-457e-89dc-5b6a71c22dce	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 05:27:01.644774+00
6db92f76-7681-409f-9e1c-3f5875ec77d2	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 05:36:48.294548+00
8b71d73a-420b-4dd6-9b8d-aa632a0e8ef8	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 05:47:13.275083+00
6fbe3e04-2c31-4cc7-bbb7-303009809066	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 15:18:42.679248+00
acb6120b-f8fa-4bb9-9884-649a1b6ae349	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 15:18:42.845709+00
54a02595-8b03-44f5-a8c1-7863155bc001	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 15:18:43.304618+00
3dfbd1d2-6aaf-4262-9921-cc95300038be	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 15:18:43.84615+00
af4e59f8-be2a-48a8-89ef-4f918eea4e4d	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 15:18:44.303201+00
ce684fbe-81e1-4d58-8452-ab13660bc0f8	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	\N	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 15:19:20.071547+00
e8a88bc6-022a-43c8-9e2a-82153281fa3a	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	d6d8c4ee-e33b-4c38-a484-a0813cd0077b	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 15:31:30.457012+00
08188602-1450-4780-a331-03a28b86a1bb	ccc2be3a-e01a-4eac-b167-4054f575c464	6b8aaffd-e88a-4758-9887-72850a9c6941	\N	d6d8c4ee-e33b-4c38-a484-a0813cd0077b	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 15:31:32.931972+00
884afeec-7ae5-4625-9a88-7d5fc206f89a	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:20.708296+00
700d8e64-6465-4fa6-a616-333c5b9e9864	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:21.416476+00
656ade87-a7b7-406f-b86e-00be2a890366	ccc2be3a-e01a-4eac-b167-4054f575c464	ae61f567-9187-4699-ab6c-3c1573f5171d	\N	ff0a3844-61f8-4afe-8cc3-a38627f9c791	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:39.014021+00
6ccac0f7-6f45-4b87-931d-0deea2c0f7e1	ccc2be3a-e01a-4eac-b167-4054f575c464	ae61f567-9187-4699-ab6c-3c1573f5171d	\N	ff0a3844-61f8-4afe-8cc3-a38627f9c791	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:40.534405+00
a183d153-fc0d-45e9-9205-eaa3d8acdcc5	ccc2be3a-e01a-4eac-b167-4054f575c464	ae61f567-9187-4699-ab6c-3c1573f5171d	\N	ff0a3844-61f8-4afe-8cc3-a38627f9c791	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:41.645557+00
c3dbaf35-4d69-4d12-afe0-7703dabf38c9	ccc2be3a-e01a-4eac-b167-4054f575c464	ae61f567-9187-4699-ab6c-3c1573f5171d	\N	ff0a3844-61f8-4afe-8cc3-a38627f9c791	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:42.194028+00
7dfb0604-c82e-4f42-b98c-944ecf5adf51	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:55.294627+00
54b4fa7c-ce5f-4322-9197-8dcff4057027	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:56.154013+00
d96b17f5-a575-47b4-946e-37ac642a3a8e	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 16:15:56.595117+00
f975e46e-bd01-4963-99cd-1a09c5d533a9	ccc2be3a-e01a-4eac-b167-4054f575c464	d36467ee-3e6d-4133-8efe-0366559a0e04	\N	0dcffe13-f0ca-4d62-80f1-e63f89d3e498	pageview	http://10.0.0.39:8000/tracker/test-site.html#	http://m.facebook.com/	\N	10.0.0.101	2026-03-30 17:36:11.866422+00
49425ae0-e730-4343-b730-3241d28284ba	ccc2be3a-e01a-4eac-b167-4054f575c464	318f5939-cd4e-4b86-9816-10516a352a45	\N	63365840-e9e9-46b7-b700-bc560d08cf9f	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.101	2026-03-30 17:37:07.632323+00
df22a70c-6caa-4083-a8ac-acbc51a5b337	ccc2be3a-e01a-4eac-b167-4054f575c464	f75b5b17-f263-4f2e-87dc-1ef5da229cab	\N	69fb97ab-8210-49dc-8bfa-95e6d19764da	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 19:20:07.06749+00
010553e4-01fd-4fd1-b9ce-0757d6a91953	ccc2be3a-e01a-4eac-b167-4054f575c464	f75b5b17-f263-4f2e-87dc-1ef5da229cab	\N	69fb97ab-8210-49dc-8bfa-95e6d19764da	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.21	2026-03-30 21:35:07.894159+00
022a665f-4555-48e7-86f9-eafc95a56b66	ccc2be3a-e01a-4eac-b167-4054f575c464	0bcb3ed4-9b3a-4955-b794-a02ed45dc7e2	\N	9ef0b519-4573-4fd3-a469-3e9e1c9358c8	pageview	http://10.0.0.39:8000/tracker/test-site.html	\N	\N	10.0.0.34	2026-03-30 21:36:16.536629+00
9cc0af0b-59a3-45f5-8a92-a953c7479d23	ccc2be3a-e01a-4eac-b167-4054f575c464	0bcb3ed4-9b3a-4955-b794-a02ed45dc7e2	\N	9ef0b519-4573-4fd3-a469-3e9e1c9358c8	pageview	http://10.0.0.39:8000/tracker/test-site.html	\N	\N	10.0.0.34	2026-03-30 21:36:46.032888+00
1e711647-7844-4e1b-9185-f532e634d7b5	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 21:38:57.700666+00
475680a4-4a79-4411-849a-cea27fb668af	ccc2be3a-e01a-4eac-b167-4054f575c464	edca64ab-4dd4-4485-a893-0129cbe4195c	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 21:38:58.110184+00
acba76f7-c214-4878-a468-c75d8dc1757c	ccc2be3a-e01a-4eac-b167-4054f575c464	ae61f567-9187-4699-ab6c-3c1573f5171d	\N	ff0a3844-61f8-4afe-8cc3-a38627f9c791	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 21:39:07.433884+00
8c0d86b5-b5d7-4f3b-84d0-fadcc3bf70a1	ccc2be3a-e01a-4eac-b167-4054f575c464	ae61f567-9187-4699-ab6c-3c1573f5171d	\N	ff0a3844-61f8-4afe-8cc3-a38627f9c791	pageview	http://10.0.0.39:8000/tracker/test-site.html#	\N	\N	10.0.0.30	2026-03-30 21:39:08.787554+00
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
-- Data for Name: risk_events; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.risk_events (id, external_user_id, score, delta, trigger_type, trigger_detail, created_at) FROM stdin;
\.


--
-- Data for Name: sites; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.sites (id, name, url, description, api_key, active, created_at) FROM stdin;
ccc2be3a-e01a-4eac-b167-4054f575c464	Mouwaten-TEST	http://10.0.0.39:8000/tracker/test-site.html		8427e15910ab35aa70075bb2a82d1a7d81dada595f779ae9d68104a55bce6355	t	2026-03-30 00:09:59.976981+00
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.user_profiles (id, external_user_id, email, display_name, current_risk_score, trust_level, total_devices, total_sessions, first_seen, last_seen, last_ip, last_country, enhanced_audit, profile_data) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.users (id, email, username, hashed_password, role, status, last_login, created_at) FROM stdin;
1462da9a-dee3-42b7-a952-f419547d339b	marwen.sadkaoui@gmail.com	admin	$2b$12$Qol/RIqvA7gofHGh29eGCu0u6uf9NNzVIVFepbCsIwHgj2ZrsneHe	admin	active	2026-03-31 00:44:04.998557+00	2026-03-29 22:41:13.755193+00
\.


--
-- Data for Name: visitors; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.visitors (id, ip, country, country_code, country_flag, city, isp, device_type, browser, os, user_agent, status, page_views, site_id, linked_user, device_id, first_seen, last_seen) FROM stdin;
6b8aaffd-e88a-4758-9887-72850a9c6941	10.0.0.21	\N	\N	\N	\N	\N	desktop	Chrome 146.0.0	Windows 10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	active	18	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	d6d8c4ee-e33b-4c38-a484-a0813cd0077b	2026-03-30 00:18:33.238395+00	2026-03-30 15:48:13.839756+00
ae61f567-9187-4699-ab6c-3c1573f5171d	10.0.0.30	\N	\N	\N	\N	\N	mobile	Chrome Mobile 146.0.0	Android 10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	active	6	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	ff0a3844-61f8-4afe-8cc3-a38627f9c791	2026-03-30 16:15:39.01528+00	2026-03-30 23:25:50.013034+00
d36467ee-3e6d-4133-8efe-0366559a0e04	10.0.0.101	\N	\N	\N	\N	\N	mobile	Facebook 554.0.0	Android 15	Mozilla/5.0 (Linux; Android 15; CPH2565 Build/AP3A.240617.008; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/554.0.0.59.70;]	active	1	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	0dcffe13-f0ca-4d62-80f1-e63f89d3e498	2026-03-30 17:36:11.868304+00	2026-03-30 17:36:11.865427+00
318f5939-cd4e-4b86-9816-10516a352a45	10.0.0.101	\N	\N	\N	\N	\N	mobile	HeyTap Browser 45.14.0	Android 15	Mozilla/5.0 (Linux; U; Android 15; fr-tn; CPH2565 Build/AP3A.240617.008) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.5970.168 Mobile Safari/537.36 HeyTapBrowser/45.14.0.1	active	1	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	63365840-e9e9-46b7-b700-bc560d08cf9f	2026-03-30 17:37:07.634525+00	2026-03-30 17:37:07.632105+00
f75b5b17-f263-4f2e-87dc-1ef5da229cab	10.0.0.21	\N	\N	\N	\N	\N	desktop	Firefox 148.0	Windows 10	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	active	2	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	69fb97ab-8210-49dc-8bfa-95e6d19764da	2026-03-30 19:20:07.06899+00	2026-03-30 21:35:07.89274+00
0bcb3ed4-9b3a-4955-b794-a02ed45dc7e2	10.0.0.34	\N	\N	\N	\N	\N	mobile	Chrome Mobile 146.0.0	Android 10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	active	2	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	9ef0b519-4573-4fd3-a469-3e9e1c9358c8	2026-03-30 21:36:16.53916+00	2026-03-30 21:36:46.032653+00
edca64ab-4dd4-4485-a893-0129cbe4195c	10.0.0.30	\N	\N	\N	\N	\N	mobile	Firefox Mobile 149.0	Android 15	Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0	active	9	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	2026-03-30 00:19:33.454916+00	2026-03-30 21:38:58.109921+00
c6e44c5a-000f-458a-b4ba-ff9971a5ad43	10.0.0.20	\N	\N	\N	\N	\N	desktop	Chrome 146.0.0	Windows 10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	active	3	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	39168861-489a-4be1-9eef-d4c959ae034e	2026-03-30 05:06:57.144947+00	2026-03-30 05:46:35.922069+00
f8748a75-055d-40b0-a052-22ccce5fe015	10.0.0.34	\N	\N	\N	\N	\N	mobile	Chrome Mobile 146.0.0	Android 10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	active	1	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	ed0f354e-1c89-43b0-b889-5770448a0080	2026-03-30 05:07:17.231048+00	2026-03-30 05:46:36.503116+00
\.


--
-- Name: block_page_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: skynet
--

SELECT pg_catalog.setval('public.block_page_config_id_seq', 1, false);


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
-- Name: risk_events risk_events_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.risk_events
    ADD CONSTRAINT risk_events_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


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
-- Name: ix_risk_events_user_created; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_risk_events_user_created ON public.risk_events USING btree (external_user_id, created_at);


--
-- Name: ix_sites_api_key; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_sites_api_key ON public.sites USING btree (api_key);


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
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


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

\unrestrict cuhZBgKzs187wvGbs2L16eJpxXygfjd1FwRYdo0pNN51anFj5JcSeplaHC5gfkO

