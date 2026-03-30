--
-- PostgreSQL database dump
--

\restrict Dp9PwloEEmEHJx60r7ZCTjWcCjlU5QLucX3qAvSRyLDwGJ3L8u7do9OVqlg2VdD

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
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO skynet;

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
    last_seen timestamp with time zone NOT NULL
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
-- Name: users; Type: TABLE; Schema: public; Owner: skynet
--

CREATE TABLE public.users (
    id character varying(36) NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    hashed_password character varying(255),
    role public.user_role NOT NULL,
    status public.user_status NOT NULL,
    keycloak_id character varying(100),
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
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.alembic_version (version_num) FROM stdin;
0002
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

COPY public.devices (id, fingerprint, type, browser, os, screen_resolution, language, timezone, canvas_hash, webgl_hash, audio_hash, font_list, risk_score, status, linked_user, first_seen, last_seen) FROM stdin;
fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	5737bac4-000000c8	\N	\N	\N	456x1013	fr-FR	Africa/Tunis	sJNN2mfQ4QIPb5RqXaiAP/A3jeklavtrKDAAAAAElFTkSuQmCC	QVJNOjpNYWxpLUc1MSwgb3Igc2ltaWxh	\N	\N	0	active	\N	2026-03-30 00:19:33.457701+00	2026-03-30 00:19:33.457704+00
39168861-489a-4be1-9eef-d4c959ae034e	68af318a-000000ed	\N	\N	\N	1920x1080	fr-FR	Africa/Lagos	D//zAovAoAAAAGSURBVAMATZB/fj0VanwAAAAASUVORK5CYII=	R29vZ2xlIEluYy4gKE5WSURJQSk6OkFO	\N	\N	0	active	\N	2026-03-30 05:06:57.148294+00	2026-03-30 05:06:59.942319+00
ed0f354e-1c89-43b0-b889-5770448a0080	0cf987df-000000f2	\N	\N	\N	412x846	fr-FR	Africa/Tunis	//s0b7ZQAAAAZJREFUAwCn9nF+Vg5RPAAAAABJRU5ErkJggg==	QVJNOjpNYWxpLUc3Mg==	\N	\N	0	active	\N	2026-03-30 05:07:17.232496+00	2026-03-30 05:07:17.232499+00
9fc8322a-4a15-4f15-86f5-11e66ea957b6	5f059400-000000ed	\N	\N	\N	2048x1152	fr-FR	Etc/GMT-1	D//zAovAoAAAAGSURBVAMATZB/fj0VanwAAAAASUVORK5CYII=	R29vZ2xlIEluYy4gKE5WSURJQSk6OkFO	\N	\N	0	active	\N	2026-03-30 01:30:11.145393+00	2026-03-30 05:36:48.293767+00
69fb97ab-8210-49dc-8bfa-95e6d19764da	26e1b036-000000cb	\N	\N	\N	2048x1152	fr	Etc/GMT-1	RvhdG/TyuAgPh0+HDyeivwL8sa00etDXvpAAAAAElFTkSuQmCC	R29vZ2xlIEluYy4gKE5WSURJQSk6OkFO	\N	\N	0	active	\N	2026-03-30 00:18:33.244028+00	2026-03-30 05:47:13.274442+00
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
\.


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.incidents (id, type, description, ip, device_id, user_id, severity, status, metadata, detected_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: sites; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.sites (id, name, url, description, api_key, active, created_at) FROM stdin;
ccc2be3a-e01a-4eac-b167-4054f575c464	Mouwaten-TEST	http://10.0.0.39:8000/tracker/test-site.html		8427e15910ab35aa70075bb2a82d1a7d81dada595f779ae9d68104a55bce6355	t	2026-03-30 00:09:59.976981+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.users (id, email, username, hashed_password, role, status, keycloak_id, last_login, created_at) FROM stdin;
1462da9a-dee3-42b7-a952-f419547d339b	admin@skynet.local	admin	$2b$12$Z7jlF.CchIjon//AuK1BaOjUQirDFXIUNgP7mvi2QSXDVufofV4ai	admin	active	\N	2026-03-30 13:27:58.728488+00	2026-03-29 22:41:13.755193+00
\.


--
-- Data for Name: visitors; Type: TABLE DATA; Schema: public; Owner: skynet
--

COPY public.visitors (id, ip, country, country_code, country_flag, city, isp, device_type, browser, os, user_agent, status, page_views, site_id, linked_user, device_id, first_seen, last_seen) FROM stdin;
6b8aaffd-e88a-4758-9887-72850a9c6941	10.0.0.21	\N	\N	\N	\N	\N	desktop	Firefox 148.0	Windows 10	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0	active	11	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	69fb97ab-8210-49dc-8bfa-95e6d19764da	2026-03-30 00:18:33.238395+00	2026-03-30 05:47:13.275551+00
edca64ab-4dd4-4485-a893-0129cbe4195c	10.0.0.30	\N	\N	\N	\N	\N	mobile	Firefox Mobile 149.0	Android 15	Mozilla/5.0 (Android 15; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0	active	1	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	fde766d6-8ec6-4c92-aad4-5a2a52ff46a3	2026-03-30 00:19:33.454916+00	2026-03-30 05:46:35.277494+00
c6e44c5a-000f-458a-b4ba-ff9971a5ad43	10.0.0.20	\N	\N	\N	\N	\N	desktop	Chrome 146.0.0	Windows 10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	active	3	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	39168861-489a-4be1-9eef-d4c959ae034e	2026-03-30 05:06:57.144947+00	2026-03-30 05:46:35.922069+00
f8748a75-055d-40b0-a052-22ccce5fe015	10.0.0.34	\N	\N	\N	\N	\N	mobile	Chrome Mobile 146.0.0	Android 10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	active	1	ccc2be3a-e01a-4eac-b167-4054f575c464	\N	ed0f354e-1c89-43b0-b889-5770448a0080	2026-03-30 05:07:17.231048+00	2026-03-30 05:46:36.503116+00
\.


--
-- Name: block_page_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: skynet
--

SELECT pg_catalog.setval('public.block_page_config_id_seq', 1, false);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


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
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: skynet
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


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
-- Name: ix_devices_fingerprint; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_devices_fingerprint ON public.devices USING btree (fingerprint);


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
-- Name: ix_sites_api_key; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_sites_api_key ON public.sites USING btree (api_key);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_keycloak_id; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_users_keycloak_id ON public.users USING btree (keycloak_id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: skynet
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: ix_visitors_ip; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_visitors_ip ON public.visitors USING btree (ip);


--
-- Name: ix_visitors_status; Type: INDEX; Schema: public; Owner: skynet
--

CREATE INDEX ix_visitors_status ON public.visitors USING btree (status);


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

\unrestrict Dp9PwloEEmEHJx60r7ZCTjWcCjlU5QLucX3qAvSRyLDwGJ3L8u7do9OVqlg2VdD

