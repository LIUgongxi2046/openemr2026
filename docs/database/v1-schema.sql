--
-- PostgreSQL database dump
--

\restrict fzijY2b1iXK8EDiHmidUA90e3GQirbJgjQKcaIl6GIRgvIcchBjYuwkzsbZO0fA

-- Dumped from database version 18.4 (Homebrew)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    external_subject character varying(256) NOT NULL,
    display_name character varying(256) NOT NULL,
    status character varying(24) NOT NULL,
    CONSTRAINT app_user_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'LOCKED'::character varying, 'DISABLED'::character varying])::text[])))
);


--
-- Name: audit_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_event (
    tenant_id uuid NOT NULL,
    audit_event_id uuid NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    actor_user_id uuid,
    action_code character varying(128) NOT NULL,
    resource_type character varying(96) NOT NULL,
    resource_id uuid NOT NULL,
    patient_ref_hash character(64),
    trace_id character varying(64) NOT NULL,
    previous_hash character(64),
    event_hash character(64) NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: clinical_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_document (
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    document_type_code character varying(96) NOT NULL,
    status character varying(24) NOT NULL,
    current_version_id uuid,
    row_version bigint DEFAULT 1 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinical_document_row_version_check CHECK ((row_version > 0)),
    CONSTRAINT clinical_document_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'READY_TO_SIGN'::character varying, 'SIGNED'::character varying, 'CORRECTED'::character varying, 'VOID'::character varying])::text[])))
);


--
-- Name: clinical_document_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_document_version (
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_version_id uuid NOT NULL,
    version_no integer NOT NULL,
    status character varying(24) NOT NULL,
    sections jsonb NOT NULL,
    content_hash character(64) NOT NULL,
    based_on_version_id uuid,
    author_user_id uuid NOT NULL,
    row_version bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    signed_at timestamp with time zone,
    CONSTRAINT clinical_document_version_check CHECK ((((status)::text = 'SIGNED'::text) = (signed_at IS NOT NULL))),
    CONSTRAINT clinical_document_version_row_version_check CHECK ((row_version > 0)),
    CONSTRAINT clinical_document_version_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'READY_TO_SIGN'::character varying, 'SIGNED'::character varying, 'CORRECTED'::character varying, 'VOID'::character varying])::text[]))),
    CONSTRAINT clinical_document_version_version_no_check CHECK ((version_no > 0))
);


--
-- Name: encounter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounter (
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    encounter_type character varying(24) NOT NULL,
    status character varying(24) NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    source_system character varying(128),
    source_key character varying(256),
    row_version bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT encounter_check CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT encounter_encounter_type_check CHECK (((encounter_type)::text = ANY ((ARRAY['OUTPATIENT'::character varying, 'EMERGENCY'::character varying, 'INPATIENT'::character varying])::text[]))),
    CONSTRAINT encounter_row_version_check CHECK ((row_version > 0)),
    CONSTRAINT encounter_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNED'::character varying, 'IN_PROGRESS'::character varying, 'FINISHED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: facility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facility (
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    facility_code character varying(64) NOT NULL,
    display_name character varying(256) NOT NULL,
    timezone character varying(64) DEFAULT 'Asia/Shanghai'::character varying NOT NULL,
    status character varying(24) NOT NULL,
    CONSTRAINT facility_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: idempotency_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_record (
    tenant_id uuid NOT NULL,
    command_scope character varying(128) NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    request_hash character(64) NOT NULL,
    state character varying(24) NOT NULL,
    response_status integer,
    response_ref jsonb,
    trace_id character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT idempotency_record_check CHECK ((expires_at > created_at)),
    CONSTRAINT idempotency_record_state_check CHECK (((state)::text = ANY ((ARRAY['IN_PROGRESS'::character varying, 'SUCCEEDED'::character varying, 'FAILED_FINAL'::character varying, 'RECONCILING'::character varying])::text[])))
);


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    organization_code character varying(64) NOT NULL,
    display_name character varying(256) NOT NULL,
    status character varying(24) NOT NULL,
    CONSTRAINT organization_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: outbox_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_event (
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    aggregate_type character varying(96) NOT NULL,
    aggregate_id uuid NOT NULL,
    aggregate_version bigint NOT NULL,
    event_type character varying(128) NOT NULL,
    schema_version integer NOT NULL,
    payload jsonb NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    attempt integer DEFAULT 0 NOT NULL,
    last_error_code character varying(128),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT outbox_event_aggregate_version_check CHECK ((aggregate_version > 0)),
    CONSTRAINT outbox_event_attempt_check CHECK ((attempt >= 0)),
    CONSTRAINT outbox_event_schema_version_check CHECK ((schema_version > 0))
);


--
-- Name: patient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient (
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    display_name character varying(256) NOT NULL,
    sex_code character varying(32) NOT NULL,
    birth_date date NOT NULL,
    status character varying(24) NOT NULL,
    merged_into_patient_id uuid,
    row_version bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_check CHECK ((((status)::text = 'MERGED'::text) = (merged_into_patient_id IS NOT NULL))),
    CONSTRAINT patient_row_version_check CHECK ((row_version > 0)),
    CONSTRAINT patient_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'MERGED'::character varying, 'DECEASED'::character varying, 'VOID'::character varying])::text[])))
);


--
-- Name: patient_identifier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_identifier (
    tenant_id uuid NOT NULL,
    patient_identifier_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    assigning_authority character varying(128) NOT NULL,
    identifier_type character varying(64) NOT NULL,
    identifier_hash bytea NOT NULL,
    masked_value character varying(128) NOT NULL,
    source_system character varying(128) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: quality_finding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_finding (
    tenant_id uuid NOT NULL,
    finding_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_version_id uuid NOT NULL,
    rule_code character varying(128) NOT NULL,
    rule_version character varying(64) NOT NULL,
    severity character varying(24) NOT NULL,
    message text NOT NULL,
    field_path character varying(512),
    state character varying(24) NOT NULL,
    resolution_reason text,
    row_version bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quality_finding_check CHECK ((((state)::text <> 'WAIVED'::text) OR (resolution_reason IS NOT NULL))),
    CONSTRAINT quality_finding_row_version_check CHECK ((row_version > 0)),
    CONSTRAINT quality_finding_severity_check CHECK (((severity)::text = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'BLOCKING'::character varying])::text[]))),
    CONSTRAINT quality_finding_state_check CHECK (((state)::text = ANY ((ARRAY['OPEN'::character varying, 'ACKNOWLEDGED'::character varying, 'RESOLVED'::character varying, 'WAIVED'::character varying])::text[])))
);


--
-- Name: role_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_assignment (
    tenant_id uuid NOT NULL,
    role_assignment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    facility_id uuid,
    role_code character varying(96) NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone,
    status character varying(24) NOT NULL,
    row_version bigint DEFAULT 1 NOT NULL,
    CONSTRAINT role_assignment_check CHECK (((valid_until IS NULL) OR (valid_until > valid_from))),
    CONSTRAINT role_assignment_row_version_check CHECK ((row_version > 0)),
    CONSTRAINT role_assignment_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying, 'EXPIRED'::character varying])::text[])))
);


--
-- Name: signature_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signature_evidence (
    tenant_id uuid NOT NULL,
    signature_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_version_id uuid NOT NULL,
    signer_user_id uuid NOT NULL,
    signature_role character varying(64) NOT NULL,
    signature_status character varying(32) NOT NULL,
    content_hash character(64) NOT NULL,
    credential_ref character varying(256),
    signed_at timestamp with time zone NOT NULL,
    CONSTRAINT signature_evidence_signature_status_check CHECK (((signature_status)::text = ANY ((ARRAY['VALID'::character varying, 'PENDING_CA_EVIDENCE'::character varying, 'REVOKED'::character varying])::text[])))
);


--
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    tenant_id uuid NOT NULL,
    tenant_code character varying(64) NOT NULL,
    display_name character varying(256) NOT NULL,
    status character varying(24) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying])::text[])))
);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (tenant_id, user_id);


--
-- Name: app_user app_user_tenant_id_external_subject_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_tenant_id_external_subject_key UNIQUE (tenant_id, external_subject);


--
-- Name: audit_event audit_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_event
    ADD CONSTRAINT audit_event_pkey PRIMARY KEY (tenant_id, audit_event_id);


--
-- Name: audit_event audit_event_tenant_id_event_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_event
    ADD CONSTRAINT audit_event_tenant_id_event_hash_key UNIQUE (tenant_id, event_hash);


--
-- Name: clinical_document clinical_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document
    ADD CONSTRAINT clinical_document_pkey PRIMARY KEY (tenant_id, document_id);


--
-- Name: clinical_document_version clinical_document_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_version
    ADD CONSTRAINT clinical_document_version_pkey PRIMARY KEY (tenant_id, document_id, document_version_id);


--
-- Name: clinical_document_version clinical_document_version_tenant_id_document_id_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_version
    ADD CONSTRAINT clinical_document_version_tenant_id_document_id_version_no_key UNIQUE (tenant_id, document_id, version_no);


--
-- Name: clinical_document_version clinical_document_version_tenant_id_document_version_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_version
    ADD CONSTRAINT clinical_document_version_tenant_id_document_version_id_key UNIQUE (tenant_id, document_version_id);


--
-- Name: encounter encounter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter
    ADD CONSTRAINT encounter_pkey PRIMARY KEY (tenant_id, encounter_id);


--
-- Name: encounter encounter_tenant_id_source_system_source_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter
    ADD CONSTRAINT encounter_tenant_id_source_system_source_key_key UNIQUE (tenant_id, source_system, source_key);


--
-- Name: facility facility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_pkey PRIMARY KEY (tenant_id, facility_id);


--
-- Name: facility facility_tenant_id_organization_id_facility_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_tenant_id_organization_id_facility_code_key UNIQUE (tenant_id, organization_id, facility_code);


--
-- Name: idempotency_record idempotency_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_record
    ADD CONSTRAINT idempotency_record_pkey PRIMARY KEY (tenant_id, command_scope, idempotency_key);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (tenant_id, organization_id);


--
-- Name: organization organization_tenant_id_organization_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_tenant_id_organization_code_key UNIQUE (tenant_id, organization_code);


--
-- Name: outbox_event outbox_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_event
    ADD CONSTRAINT outbox_event_pkey PRIMARY KEY (tenant_id, event_id);


--
-- Name: outbox_event outbox_event_tenant_id_aggregate_type_aggregate_id_aggregat_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_event
    ADD CONSTRAINT outbox_event_tenant_id_aggregate_type_aggregate_id_aggregat_key UNIQUE (tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type);


--
-- Name: patient_identifier patient_identifier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifier
    ADD CONSTRAINT patient_identifier_pkey PRIMARY KEY (tenant_id, patient_identifier_id);


--
-- Name: patient_identifier patient_identifier_tenant_id_assigning_authority_identifier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifier
    ADD CONSTRAINT patient_identifier_tenant_id_assigning_authority_identifier_key UNIQUE (tenant_id, assigning_authority, identifier_type, identifier_hash);


--
-- Name: patient patient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient
    ADD CONSTRAINT patient_pkey PRIMARY KEY (tenant_id, patient_id);


--
-- Name: quality_finding quality_finding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_finding
    ADD CONSTRAINT quality_finding_pkey PRIMARY KEY (tenant_id, finding_id);


--
-- Name: role_assignment role_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignment
    ADD CONSTRAINT role_assignment_pkey PRIMARY KEY (tenant_id, role_assignment_id);


--
-- Name: signature_evidence signature_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_evidence
    ADD CONSTRAINT signature_evidence_pkey PRIMARY KEY (tenant_id, signature_id);


--
-- Name: signature_evidence signature_evidence_tenant_id_document_version_id_signer_use_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_evidence
    ADD CONSTRAINT signature_evidence_tenant_id_document_version_id_signer_use_key UNIQUE (tenant_id, document_version_id, signer_user_id, signature_role);


--
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant tenant_tenant_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_tenant_code_key UNIQUE (tenant_code);


--
-- Name: audit_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_resource_idx ON public.audit_event USING btree (tenant_id, resource_type, resource_id, occurred_at);


--
-- Name: document_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_encounter_idx ON public.clinical_document USING btree (tenant_id, encounter_id, updated_at DESC);


--
-- Name: encounter_patient_timeline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX encounter_patient_timeline_idx ON public.encounter USING btree (tenant_id, patient_id, started_at DESC);


--
-- Name: outbox_event_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_event_pending_idx ON public.outbox_event USING btree (available_at, event_id) WHERE (published_at IS NULL);


--
-- Name: quality_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quality_open_idx ON public.quality_finding USING btree (tenant_id, severity, created_at) WHERE ((state)::text = 'OPEN'::text);


--
-- Name: app_user app_user_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: audit_event audit_event_tenant_id_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_event
    ADD CONSTRAINT audit_event_tenant_id_actor_user_id_fkey FOREIGN KEY (tenant_id, actor_user_id) REFERENCES public.app_user(tenant_id, user_id);


--
-- Name: clinical_document clinical_document_current_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document
    ADD CONSTRAINT clinical_document_current_version_fk FOREIGN KEY (tenant_id, document_id, current_version_id) REFERENCES public.clinical_document_version(tenant_id, document_id, document_version_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: clinical_document clinical_document_tenant_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document
    ADD CONSTRAINT clinical_document_tenant_id_created_by_fkey FOREIGN KEY (tenant_id, created_by) REFERENCES public.app_user(tenant_id, user_id);


--
-- Name: clinical_document clinical_document_tenant_id_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document
    ADD CONSTRAINT clinical_document_tenant_id_encounter_id_fkey FOREIGN KEY (tenant_id, encounter_id) REFERENCES public.encounter(tenant_id, encounter_id);


--
-- Name: clinical_document clinical_document_tenant_id_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document
    ADD CONSTRAINT clinical_document_tenant_id_patient_id_fkey FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patient(tenant_id, patient_id);


--
-- Name: clinical_document_version clinical_document_version_tenant_id_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_version
    ADD CONSTRAINT clinical_document_version_tenant_id_author_user_id_fkey FOREIGN KEY (tenant_id, author_user_id) REFERENCES public.app_user(tenant_id, user_id);


--
-- Name: clinical_document_version clinical_document_version_tenant_id_document_id_based_on_v_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_version
    ADD CONSTRAINT clinical_document_version_tenant_id_document_id_based_on_v_fkey FOREIGN KEY (tenant_id, document_id, based_on_version_id) REFERENCES public.clinical_document_version(tenant_id, document_id, document_version_id);


--
-- Name: clinical_document_version clinical_document_version_tenant_id_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_document_version
    ADD CONSTRAINT clinical_document_version_tenant_id_document_id_fkey FOREIGN KEY (tenant_id, document_id) REFERENCES public.clinical_document(tenant_id, document_id);


--
-- Name: encounter encounter_tenant_id_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter
    ADD CONSTRAINT encounter_tenant_id_facility_id_fkey FOREIGN KEY (tenant_id, facility_id) REFERENCES public.facility(tenant_id, facility_id);


--
-- Name: encounter encounter_tenant_id_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter
    ADD CONSTRAINT encounter_tenant_id_organization_id_fkey FOREIGN KEY (tenant_id, organization_id) REFERENCES public.organization(tenant_id, organization_id);


--
-- Name: encounter encounter_tenant_id_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter
    ADD CONSTRAINT encounter_tenant_id_patient_id_fkey FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patient(tenant_id, patient_id);


--
-- Name: facility facility_tenant_id_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_tenant_id_organization_id_fkey FOREIGN KEY (tenant_id, organization_id) REFERENCES public.organization(tenant_id, organization_id);


--
-- Name: idempotency_record idempotency_record_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_record
    ADD CONSTRAINT idempotency_record_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: organization organization_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: outbox_event outbox_event_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_event
    ADD CONSTRAINT outbox_event_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: patient_identifier patient_identifier_tenant_id_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifier
    ADD CONSTRAINT patient_identifier_tenant_id_patient_id_fkey FOREIGN KEY (tenant_id, patient_id) REFERENCES public.patient(tenant_id, patient_id);


--
-- Name: patient patient_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient
    ADD CONSTRAINT patient_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(tenant_id);


--
-- Name: patient patient_tenant_id_merged_into_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient
    ADD CONSTRAINT patient_tenant_id_merged_into_patient_id_fkey FOREIGN KEY (tenant_id, merged_into_patient_id) REFERENCES public.patient(tenant_id, patient_id);


--
-- Name: quality_finding quality_finding_tenant_id_document_id_document_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_finding
    ADD CONSTRAINT quality_finding_tenant_id_document_id_document_version_id_fkey FOREIGN KEY (tenant_id, document_id, document_version_id) REFERENCES public.clinical_document_version(tenant_id, document_id, document_version_id);


--
-- Name: role_assignment role_assignment_tenant_id_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignment
    ADD CONSTRAINT role_assignment_tenant_id_facility_id_fkey FOREIGN KEY (tenant_id, facility_id) REFERENCES public.facility(tenant_id, facility_id);


--
-- Name: role_assignment role_assignment_tenant_id_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignment
    ADD CONSTRAINT role_assignment_tenant_id_organization_id_fkey FOREIGN KEY (tenant_id, organization_id) REFERENCES public.organization(tenant_id, organization_id);


--
-- Name: role_assignment role_assignment_tenant_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_assignment
    ADD CONSTRAINT role_assignment_tenant_id_user_id_fkey FOREIGN KEY (tenant_id, user_id) REFERENCES public.app_user(tenant_id, user_id);


--
-- Name: signature_evidence signature_evidence_tenant_id_document_id_document_version__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_evidence
    ADD CONSTRAINT signature_evidence_tenant_id_document_id_document_version__fkey FOREIGN KEY (tenant_id, document_id, document_version_id) REFERENCES public.clinical_document_version(tenant_id, document_id, document_version_id);


--
-- Name: signature_evidence signature_evidence_tenant_id_signer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_evidence
    ADD CONSTRAINT signature_evidence_tenant_id_signer_user_id_fkey FOREIGN KEY (tenant_id, signer_user_id) REFERENCES public.app_user(tenant_id, user_id);


--
-- PostgreSQL database dump complete
--

\unrestrict fzijY2b1iXK8EDiHmidUA90e3GQirbJgjQKcaIl6GIRgvIcchBjYuwkzsbZO0fA

