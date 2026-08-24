// Generated from contracts/openapi.json. Do not edit.
import { z } from 'zod';

export const auditEventWireSchema = z.object({
  "audit_event_id": z.string().uuid(),
  "occurred_at": z.string(),
  "actor_user_id": z.string().uuid().nullable().optional(),
  "action_code": z.string(),
  "resource_type": z.string(),
  "resource_id": z.string().uuid(),
  "patient_ref_hash": z.string().nullable().optional(),
  "trace_id": z.string(),
  "previous_hash": z.string().nullable().optional(),
  "event_hash": z.string(),
  "details": z.record(z.string(), z.unknown()).optional(),
}).strict();
export type AuditEventWire = z.infer<typeof auditEventWireSchema>;

export const mockInterfaceWireSchema = z.object({
  "code": z.string(),
  "display_name": z.string(),
  "system_type": z.string(),
  "description": z.string(),
  "standard_interface": z.string().optional(),
  "request_schema": z.record(z.string(), z.unknown()).optional(),
  "response_schema": z.record(z.string(), z.unknown()).optional(),
  "integration_doc": z.string().optional(),
}).strict();
export type MockInterfaceWire = z.infer<typeof mockInterfaceWireSchema>;

export const mockInvocationResultWireSchema = z.object({
  "mock_interface_code": z.string(),
  "request_id": z.string().uuid(),
  "produced_at": z.string(),
  "scenario": z.enum(["SUCCESS","DEGRADED"]),
  "deterministic_key": z.string(),
  "payload": z.record(z.string(), z.unknown()),
  "notice": z.string(),
}).strict();
export type MockInvocationResultWire = z.infer<typeof mockInvocationResultWireSchema>;

export const configurationItemWireSchema = z.object({
  "config_id": z.string().uuid(),
  "config_type": z.string(),
  "config_key": z.string(),
  "display_name": z.string(),
  "payload": z.record(z.string(), z.unknown()).optional(),
  "status": z.enum(["DRAFT","PENDING_APPROVAL","APPROVED","ACTIVE","ARCHIVED"]),
  "schema_version": z.number().int(),
  "validation_state": z.enum(["NOT_VALIDATED","VALID","INVALID"]),
  "validation_errors": z.array(z.string()),
  "approval_state": z.enum(["DRAFT","PENDING","APPROVED","REJECTED"]),
  "approved_by": z.string().uuid().nullable().optional(),
  "published_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
  "created_at": z.string().optional(),
  "updated_at": z.string().optional(),
}).strict();
export type ConfigurationItemWire = z.infer<typeof configurationItemWireSchema>;

export const configurationItemDefineRequestWireSchema = z.object({
  "config_type": z.string(),
  "config_key": z.string(),
  "display_name": z.string(),
  "payload": z.record(z.string(), z.unknown()),
}).strict();
export type ConfigurationItemDefineRequestWire = z.infer<typeof configurationItemDefineRequestWireSchema>;

export const configurationItemUpdateRequestWireSchema = z.object({
  "display_name": z.string(),
  "payload": z.record(z.string(), z.unknown()),
  "expected_version": z.number().int(),
}).strict();
export type ConfigurationItemUpdateRequestWire = z.infer<typeof configurationItemUpdateRequestWireSchema>;

export const configurationLifecycleRequestWireSchema = z.object({
  "action": z.enum(["VALIDATE","SUBMIT","APPROVE","PUBLISH","ROLLBACK"]),
  "expected_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type ConfigurationLifecycleRequestWire = z.infer<typeof configurationLifecycleRequestWireSchema>;

export const outpatientFollowupWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_type": z.enum(["EDUCATION","REVISIT","FOLLOWUP"]),
  "content": z.string().optional(),
  "outcome": z.string().optional(),
  "status": z.enum(["PENDING","COMPLETED"]),
  "due_at": z.string().optional(),
  "completed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
  "created_at": z.string().optional(),
}).strict();
export type OutpatientFollowupWire = z.infer<typeof outpatientFollowupWireSchema>;

export const outpatientFollowupCreateRequestWireSchema = z.object({
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_type": z.enum(["EDUCATION","REVISIT","FOLLOWUP"]),
  "content": z.string(),
  "due_at": z.string().optional(),
}).strict();
export type OutpatientFollowupCreateRequestWire = z.infer<typeof outpatientFollowupCreateRequestWireSchema>;

export const outpatientFollowupCompleteRequestWireSchema = z.object({
  "outcome": z.string(),
  "expected_row_version": z.number().int(),
}).strict();
export type OutpatientFollowupCompleteRequestWire = z.infer<typeof outpatientFollowupCompleteRequestWireSchema>;

export const metricSnapshotWireSchema = z.object({
  "snapshot_id": z.string().uuid(),
  "metric_type": z.string(),
  "metric_name": z.string(),
  "metric_value": z.number(),
  "unit": z.string().nullable().optional(),
  "dimension": z.record(z.string(), z.unknown()).optional(),
  "period": z.string().nullable().optional(),
  "status": z.enum(["DRAFT","FINAL"]),
  "row_version": z.number().int(),
  "computed_at": z.string().optional(),
  "created_at": z.string().optional(),
}).strict();
export type MetricSnapshotWire = z.infer<typeof metricSnapshotWireSchema>;

export const metricSnapshotRecordRequestWireSchema = z.object({
  "metric_type": z.string(),
  "metric_name": z.string(),
  "metric_value": z.number(),
  "unit": z.string().nullable().optional(),
  "dimension": z.record(z.string(), z.unknown()).optional(),
  "period": z.string().nullable().optional(),
}).strict();
export type MetricSnapshotRecordRequestWire = z.infer<typeof metricSnapshotRecordRequestWireSchema>;

export const apiViolationWireSchema = z.object({
  "field": z.string(),
  "rule": z.string(),
  "severity": z.enum(["INFO","WARNING","BLOCKING"]),
}).strict();
export type ApiViolationWire = z.infer<typeof apiViolationWireSchema>;

export const apiRecoveryWireSchema = z.object({
  "action": z.enum(["RETRY","RECONNECT","OPEN_DIFF","REAUTHENTICATE","RETURN_TO_QUEUE","CONTACT_ADMIN"]),
  "token": z.string().nullable().optional(),
}).strict();
export type ApiRecoveryWire = z.infer<typeof apiRecoveryWireSchema>;

export const apiErrorWireSchema = z.object({
  "code": z.string(),
  "category": z.enum(["VALIDATION","AUTHORIZATION","CONFLICT","DEPENDENCY","INTERNAL"]),
  "message": z.string(),
  "trace_id": z.string(),
  "retryable": z.boolean(),
  "recovery": apiRecoveryWireSchema.optional(),
  "violations": z.array(apiViolationWireSchema),
}).strict();
export type ApiErrorWire = z.infer<typeof apiErrorWireSchema>;

export const apiErrorEnvelopeWireSchema = z.object({
  "error": apiErrorWireSchema,
}).strict();
export type ApiErrorEnvelopeWire = z.infer<typeof apiErrorEnvelopeWireSchema>;

export const contextLeaseWireSchema = z.object({
  "lease_id": z.string().uuid(),
  "tenant_id": z.string().uuid(),
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "user_id": z.string().uuid(),
  "role_assignment_ids": z.array(z.string().uuid()).min(1),
  "patient_id": z.string().uuid().nullable(),
  "encounter_id": z.string().uuid().nullable(),
  "task_id": z.string().uuid().nullable(),
  "purpose_code": z.string(),
  "allowed_source_types": z.array(z.enum(["DOCUMENT_VERSION","OBSERVATION","ORDER","GUIDELINE_CHUNK","RULE"])),
  "allowed_time_start": z.string().nullable().optional(),
  "allowed_time_end": z.string().nullable().optional(),
  "authorization_watermark": z.string(),
  "data_classification_ceiling": z.enum(["PUBLIC","INTERNAL","SENSITIVE","RESTRICTED"]),
  "model_residency_policy": z.enum(["ON_PREM_ONLY","CN_REGION_ONLY","APPROVED_EXTERNAL"]),
  "expires_at": z.string(),
}).strict();
export type ContextLeaseWire = z.infer<typeof contextLeaseWireSchema>;

export const contextLeaseCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid().nullable().optional(),
  "encounter_id": z.string().uuid().nullable().optional(),
  "task_id": z.string().uuid().nullable().optional(),
  "purpose_code": z.string(),
}).strict();
export type ContextLeaseCreateRequestWire = z.infer<typeof contextLeaseCreateRequestWireSchema>;

export const patientSearchRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "purpose_code": z.string(),
  "query": z.string(),
  "limit": z.number().int().optional(),
}).strict();
export type PatientSearchRequestWire = z.infer<typeof patientSearchRequestWireSchema>;

export const patientCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "display_name": z.string(),
  "sex_code": z.string(),
  "birth_date": z.string(),
  "assigning_authority": z.string(),
  "identifier_type": z.string(),
  "identifier_value": z.string(),
  "identity_status": z.enum(["ACTIVE","PENDING_VERIFICATION"]).optional(),
  "acknowledged_candidate_patient_ids": z.array(z.string().uuid()).optional(),
}).strict();
export type PatientCreateRequestWire = z.infer<typeof patientCreateRequestWireSchema>;

export const patientMatchCandidateCreateRequestWireSchema = z.object({
  "patient_a_id": z.string().uuid(),
  "patient_b_id": z.string().uuid(),
}).strict();
export type PatientMatchCandidateCreateRequestWire = z.infer<typeof patientMatchCandidateCreateRequestWireSchema>;

export const patientMatchCandidateWireSchema = z.object({
  "candidate_id": z.string().uuid(),
  "patient_a_id": z.string().uuid(),
  "patient_a_name": z.string(),
  "patient_b_id": z.string().uuid(),
  "patient_b_name": z.string(),
  "match_score": z.number(),
  "match_signals": z.record(z.string(), z.unknown()),
  "status": z.enum(["OPEN","DISMISSED","MERGE_REQUESTED","MERGED"]),
  "detected_at": z.string(),
  "resolved_at": z.string().nullable(),
  "resolved_by": z.string().uuid().nullable(),
  "resolution_reason": z.string().nullable(),
  "row_version": z.number().int(),
}).strict();
export type PatientMatchCandidateWire = z.infer<typeof patientMatchCandidateWireSchema>;

export const patientDemographicCorrectionRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "display_name": z.string(),
  "sex_code": z.string(),
  "birth_date": z.string(),
  "status": z.enum(["PENDING_VERIFICATION","ACTIVE","POSSIBLE_DUPLICATE"]).optional(),
  "reason": z.string(),
}).strict();
export type PatientDemographicCorrectionRequestWire = z.infer<typeof patientDemographicCorrectionRequestWireSchema>;

export const patientDemographicVersionWireSchema = z.object({
  "demographic_version_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "version_no": z.number().int(),
  "display_name": z.string(),
  "sex_code": z.string(),
  "birth_date": z.string(),
  "patient_status": z.enum(["PENDING_VERIFICATION","ACTIVE","POSSIBLE_DUPLICATE","MERGED","DECEASED","VOID"]),
  "change_type": z.enum(["INITIAL_IMPORT","IDENTITY_CORRECTION","VERIFICATION"]),
  "change_reason": z.string(),
  "changed_by": z.string().uuid().nullable(),
  "supersedes_version_id": z.string().uuid().nullable(),
  "created_at": z.string(),
  "patient_row_version": z.number().int(),
}).strict();
export type PatientDemographicVersionWire = z.infer<typeof patientDemographicVersionWireSchema>;

export const patientMergeCaseCreateRequestWireSchema = z.object({
  "candidate_id": z.string().uuid().nullable().optional(),
  "source_patient_id": z.string().uuid(),
  "target_patient_id": z.string().uuid(),
  "reason": z.string(),
  "conflict_resolution": z.record(z.string(), z.unknown()),
}).strict();
export type PatientMergeCaseCreateRequestWire = z.infer<typeof patientMergeCaseCreateRequestWireSchema>;

export const patientMergeApprovalRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "confirm_no_clinical_data_loss": z.boolean(),
}).strict();
export type PatientMergeApprovalRequestWire = z.infer<typeof patientMergeApprovalRequestWireSchema>;

export const patientMergeReversalRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type PatientMergeReversalRequestWire = z.infer<typeof patientMergeReversalRequestWireSchema>;

export const patientMergeReversalApprovalRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "confirm_links_remain_traceable": z.boolean(),
}).strict();
export type PatientMergeReversalApprovalRequestWire = z.infer<typeof patientMergeReversalApprovalRequestWireSchema>;

export const patientMergeCaseWireSchema = z.object({
  "merge_case_id": z.string().uuid(),
  "candidate_id": z.string().uuid().nullable(),
  "source_patient_id": z.string().uuid(),
  "source_patient_name": z.string(),
  "target_patient_id": z.string().uuid(),
  "target_patient_name": z.string(),
  "source_status_before_merge": z.enum(["PENDING_VERIFICATION","ACTIVE","POSSIBLE_DUPLICATE"]),
  "status": z.enum(["PENDING_SECOND_REVIEW","MERGED","REVERSAL_PENDING","REVERSED","REJECTED"]),
  "merge_reason": z.string(),
  "conflict_resolution": z.record(z.string(), z.unknown()),
  "requested_by": z.string().uuid(),
  "requested_at": z.string(),
  "approved_by": z.string().uuid().nullable(),
  "approved_at": z.string().nullable(),
  "reversal_reason": z.string().nullable(),
  "reversal_requested_by": z.string().uuid().nullable(),
  "reversal_requested_at": z.string().nullable(),
  "reversed_by": z.string().uuid().nullable(),
  "reversed_at": z.string().nullable(),
  "row_version": z.number().int(),
}).strict();
export type PatientMergeCaseWire = z.infer<typeof patientMergeCaseWireSchema>;

export const patientTimelineSourceStatusWireSchema = z.object({
  "source": z.enum(["ENCOUNTER","DOCUMENT","DIAGNOSIS","ORDER","RESULT","TASK"]),
  "state": z.enum(["AVAILABLE","PARTIAL"]),
  "loaded_count": z.number().int(),
  "error_code": z.string().nullable(),
  "retryable": z.boolean(),
  "as_of": z.string(),
}).strict();
export type PatientTimelineSourceStatusWire = z.infer<typeof patientTimelineSourceStatusWireSchema>;

export const patientTimelineItemWireSchema = z.object({
  "item_type": z.enum(["ENCOUNTER","DOCUMENT","DIAGNOSIS","ORDER","RESULT","TASK"]),
  "resource_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid().nullable(),
  "facility_id": z.string().uuid(),
  "occurred_at": z.string(),
  "status": z.string(),
  "title": z.string(),
  "summary": z.string().nullable(),
  "source_system": z.string().nullable(),
  "source_route": z.string().nullable(),
  "version_no": z.number().int().nullable(),
  "row_version": z.number().int(),
}).strict();
export type PatientTimelineItemWire = z.infer<typeof patientTimelineItemWireSchema>;

export const patientTimelineWireSchema = z.object({
  "patient_id": z.string().uuid(),
  "patient_alias_ids": z.array(z.string().uuid()).min(1),
  "completeness": z.enum(["COMPLETE","PARTIAL"]),
  "data_watermark": z.string(),
  "generated_at": z.string(),
  "source_statuses": z.array(patientTimelineSourceStatusWireSchema),
  "items": z.array(patientTimelineItemWireSchema),
  "next_cursor": z.string().nullable(),
}).strict();
export type PatientTimelineWire = z.infer<typeof patientTimelineWireSchema>;

export const documentTemplateCreateRequestWireSchema = z.object({
  "template_id": z.string().uuid().optional(),
  "template_code": z.string(),
  "display_name": z.string(),
  "document_type_code": z.string(),
  "organization_id": z.string().uuid().nullable().optional(),
  "facility_id": z.string().uuid().nullable().optional(),
  "department_id": z.string().uuid().nullable().optional(),
  "section_schema": z.record(z.string(), z.unknown()),
  "required_fields": z.array(z.string()),
  "display_rules": z.record(z.string(), z.unknown()),
}).strict();
export type DocumentTemplateCreateRequestWire = z.infer<typeof documentTemplateCreateRequestWireSchema>;

export const documentTemplateVersionCreateRequestWireSchema = z.object({
  "expected_template_row_version": z.number().int(),
  "section_schema": z.record(z.string(), z.unknown()),
  "required_fields": z.array(z.string()),
  "display_rules": z.record(z.string(), z.unknown()),
}).strict();
export type DocumentTemplateVersionCreateRequestWire = z.infer<typeof documentTemplateVersionCreateRequestWireSchema>;

export const documentTemplateVersionPublishRequestWireSchema = z.object({
  "expected_version_row_version": z.number().int(),
  "effective_from": z.string(),
}).strict();
export type DocumentTemplateVersionPublishRequestWire = z.infer<typeof documentTemplateVersionPublishRequestWireSchema>;

export const documentTemplateDeactivateRequestWireSchema = z.object({
  "expected_template_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type DocumentTemplateDeactivateRequestWire = z.infer<typeof documentTemplateDeactivateRequestWireSchema>;

export const documentTemplateWireSchema = z.object({
  "template_id": z.string().uuid(),
  "template_code": z.string(),
  "display_name": z.string(),
  "document_type_code": z.string(),
  "organization_id": z.string().uuid().nullable(),
  "facility_id": z.string().uuid().nullable(),
  "department_id": z.string().uuid().nullable(),
  "lifecycle_status": z.enum(["ACTIVE","INACTIVE"]),
  "template_row_version": z.number().int(),
  "template_version_id": z.string().uuid(),
  "version_no": z.number().int(),
  "version_status": z.enum(["DRAFT","PUBLISHED","RETIRED"]),
  "section_schema": z.record(z.string(), z.unknown()),
  "required_fields": z.array(z.string()),
  "display_rules": z.record(z.string(), z.unknown()),
  "effective_from": z.string().nullable(),
  "effective_until": z.string().nullable(),
  "created_by": z.string().uuid(),
  "approved_by": z.string().uuid().nullable(),
  "published_at": z.string().nullable(),
  "version_row_version": z.number().int(),
  "created_at": z.string(),
  "updated_at": z.string(),
}).strict();
export type DocumentTemplateWire = z.infer<typeof documentTemplateWireSchema>;

export const encounterCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_type": z.enum(["OUTPATIENT","EMERGENCY","INPATIENT"]),
  "initial_status": z.enum(["PLANNED","ARRIVED","IN_PROGRESS"]).optional(),
  "department_id": z.string().uuid().nullable().optional(),
  "responsible_user_id": z.string().uuid().nullable().optional(),
  "started_at": z.string(),
  "source_system": z.string(),
  "source_key": z.string(),
}).strict();
export type EncounterCreateRequestWire = z.infer<typeof encounterCreateRequestWireSchema>;

export const encounterStateTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "target_status": z.enum(["PLANNED","ARRIVED","IN_PROGRESS","SUSPENDED","FINISHED","CANCELLED"]),
  "occurred_at": z.string(),
  "reason": z.string().nullable(),
}).strict();
export type EncounterStateTransitionRequestWire = z.infer<typeof encounterStateTransitionRequestWireSchema>;

export const documentCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "document_type_code": z.string(),
  "sections": z.record(z.string(), z.unknown()),
}).strict();
export type DocumentCreateRequestWire = z.infer<typeof documentCreateRequestWireSchema>;

export const documentDraftSaveRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "sections": z.record(z.string(), z.unknown()),
}).strict();
export type DocumentDraftSaveRequestWire = z.infer<typeof documentDraftSaveRequestWireSchema>;

export const documentDiffWireSchema = z.object({
  "document_id": z.string().uuid(),
  "from_version_id": z.string().uuid(),
  "to_version_id": z.string().uuid(),
  "from_sections": z.record(z.string(), z.unknown()),
  "to_sections": z.record(z.string(), z.unknown()),
  "changed_fields": z.array(z.string()),
}).strict();
export type DocumentDiffWire = z.infer<typeof documentDiffWireSchema>;

export const documentQualityCheckRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
}).strict();
export type DocumentQualityCheckRequestWire = z.infer<typeof documentQualityCheckRequestWireSchema>;

export const documentSignRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "signature_role": z.string(),
  "warning_disposition": z.string().nullable().optional(),
}).strict();
export type DocumentSignRequestWire = z.infer<typeof documentSignRequestWireSchema>;

export const documentReviewRejectRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "rejection_level": z.enum(["ATTENDING","CHIEF","MEDICAL_RECORDS"]),
  "reason": z.string(),
}).strict();
export type DocumentReviewRejectRequestWire = z.infer<typeof documentReviewRejectRequestWireSchema>;

export const documentCorrectionCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "source_document_version_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "correction_type": z.enum(["CORRECTION","ADDENDUM"]),
  "reason": z.string(),
  "sections": z.record(z.string(), z.unknown()),
}).strict();
export type DocumentCorrectionCreateRequestWire = z.infer<typeof documentCorrectionCreateRequestWireSchema>;

export const documentSignatureRevokeRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "signature_id": z.string().uuid(),
  "expected_document_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type DocumentSignatureRevokeRequestWire = z.infer<typeof documentSignatureRevokeRequestWireSchema>;

export const documentCorrectionPropagationRetryRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type DocumentCorrectionPropagationRetryRequestWire = z.infer<typeof documentCorrectionPropagationRetryRequestWireSchema>;

export const clinicalOrderItemCreateRequestWireSchema = z.object({
  "item_type": z.enum(["MEDICATION","LAB","IMAGING","TREATMENT","NURSING","DIET","OTHER"]),
  "catalog_code": z.string(),
  "display_name": z.string(),
  "requested_quantity": z.number(),
  "quantity_unit": z.string(),
  "dose_value": z.number().nullable().optional(),
  "dose_unit": z.string().nullable().optional(),
  "route_code": z.string().nullable().optional(),
  "frequency_code": z.string().nullable().optional(),
  "instructions": z.string().nullable().optional(),
}).strict();
export type ClinicalOrderItemCreateRequestWire = z.infer<typeof clinicalOrderItemCreateRequestWireSchema>;

export const clinicalOrderCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "order_scope": z.enum(["LONG_TERM","TEMPORARY"]),
  "clinical_indication": z.string(),
  "items": z.array(clinicalOrderItemCreateRequestWireSchema).min(1).max(100),
}).strict();
export type ClinicalOrderCreateRequestWire = z.infer<typeof clinicalOrderCreateRequestWireSchema>;

export const clinicalOrderSignRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "rule_watermark": z.string(),
}).strict();
export type ClinicalOrderSignRequestWire = z.infer<typeof clinicalOrderSignRequestWireSchema>;

export const clinicalOrderSafetyCheckRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "rule_watermark": z.string(),
}).strict();
export type ClinicalOrderSafetyCheckRequestWire = z.infer<typeof clinicalOrderSafetyCheckRequestWireSchema>;

export const clinicalOrderControlRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type ClinicalOrderControlRequestWire = z.infer<typeof clinicalOrderControlRequestWireSchema>;

export const diagnosisCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "terminology_system": z.string(),
  "terminology_release": z.string(),
  "code": z.string(),
  "diagnosis_text": z.string(),
  "diagnosis_role": z.enum(["PRIMARY","SECONDARY","DIFFERENTIAL"]),
  "certainty": z.enum(["PROVISIONAL","CONFIRMED"]),
  "effective_at": z.string(),
  "evidence_summary": z.string().nullable().optional(),
  "plan_summary": z.string().nullable().optional(),
}).strict();
export type DiagnosisCreateRequestWire = z.infer<typeof diagnosisCreateRequestWireSchema>;

export const diagnosisConfirmRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type DiagnosisConfirmRequestWire = z.infer<typeof diagnosisConfirmRequestWireSchema>;

export const diagnosisCorrectRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "terminology_system": z.string(),
  "terminology_release": z.string(),
  "code": z.string(),
  "diagnosis_text": z.string(),
  "diagnosis_role": z.enum(["PRIMARY","SECONDARY","DIFFERENTIAL"]),
  "certainty": z.enum(["PROVISIONAL","CONFIRMED"]),
  "effective_at": z.string(),
  "evidence_summary": z.string().nullable().optional(),
  "plan_summary": z.string().nullable().optional(),
  "correction_reason": z.string(),
}).strict();
export type DiagnosisCorrectRequestWire = z.infer<typeof diagnosisCorrectRequestWireSchema>;

export const diagnosisControlRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type DiagnosisControlRequestWire = z.infer<typeof diagnosisControlRequestWireSchema>;

export const clinicalDiagnosisWireSchema = z.object({
  "diagnosis_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "status": z.enum(["PROVISIONAL","CONFIRMED","STOPPED"]),
  "diagnosis_role": z.enum(["PRIMARY","SECONDARY","DIFFERENTIAL"]),
  "terminology_system": z.string(),
  "terminology_release": z.string(),
  "code": z.string(),
  "code_display_snapshot": z.string(),
  "diagnosis_text": z.string(),
  "evidence_summary": z.string().nullable().optional(),
  "plan_summary": z.string().nullable().optional(),
  "effective_at": z.string(),
  "version_no": z.number().int(),
  "row_version": z.number().int(),
  "data_watermark": z.string(),
}).strict();
export type ClinicalDiagnosisWire = z.infer<typeof clinicalDiagnosisWireSchema>;

export const resultObservationInputWireSchema = z.object({
  "item_code": z.string(),
  "item_name": z.string(),
  "value_type": z.enum(["NUMERIC","TEXT"]),
  "numeric_value": z.number().nullable().optional(),
  "text_value": z.string().nullable().optional(),
  "unit": z.string().nullable().optional(),
  "reference_low": z.number().nullable().optional(),
  "reference_high": z.number().nullable().optional(),
  "abnormal_flag": z.enum(["NORMAL","HIGH","LOW","CRITICAL_HIGH","CRITICAL_LOW"]),
}).strict();
export type ResultObservationInputWire = z.infer<typeof resultObservationInputWireSchema>;

export const clinicalResultCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "execution_task_id": z.string().uuid(),
  "source_system": z.string(),
  "source_report_key": z.string(),
  "report_type": z.enum(["LAB","IMAGING"]),
  "conclusion": z.string(),
  "reported_at": z.string(),
  "observations": z.array(resultObservationInputWireSchema).min(1).max(500),
}).strict();
export type ClinicalResultCreateRequestWire = z.infer<typeof clinicalResultCreateRequestWireSchema>;

export const clinicalResultCorrectionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "correction_reason": z.string(),
  "conclusion": z.string(),
  "reported_at": z.string(),
  "observations": z.array(resultObservationInputWireSchema).min(1).max(500),
}).strict();
export type ClinicalResultCorrectionRequestWire = z.infer<typeof clinicalResultCorrectionRequestWireSchema>;

export const criticalValueAcknowledgeRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "notification_method": z.string(),
  "recipient_confirmed": z.boolean(),
}).strict();
export type CriticalValueAcknowledgeRequestWire = z.infer<typeof criticalValueAcknowledgeRequestWireSchema>;

export const criticalValueDispositionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "assessment": z.string(),
  "action_taken": z.string(),
  "outcome": z.string(),
  "retest_required": z.boolean(),
}).strict();
export type CriticalValueDispositionRequestWire = z.infer<typeof criticalValueDispositionRequestWireSchema>;

export const clinicalResultObservationWireSchema = z.object({
  "observation_id": z.string().uuid(),
  "item_code": z.string(),
  "item_name": z.string(),
  "value_type": z.enum(["NUMERIC","TEXT"]),
  "numeric_value": z.number().nullable().optional(),
  "text_value": z.string().nullable().optional(),
  "unit": z.string().nullable().optional(),
  "reference_low": z.number().nullable().optional(),
  "reference_high": z.number().nullable().optional(),
  "abnormal_flag": z.enum(["NORMAL","HIGH","LOW","CRITICAL_HIGH","CRITICAL_LOW"]),
}).strict();
export type ClinicalResultObservationWire = z.infer<typeof clinicalResultObservationWireSchema>;

export const criticalValueWireSchema = z.object({
  "critical_value_id": z.string().uuid(),
  "result_id": z.string().uuid(),
  "observation_id": z.string().uuid(),
  "state": z.enum(["OPEN","ACKNOWLEDGED","DISPOSED"]),
  "row_version": z.number().int(),
}).strict();
export type CriticalValueWire = z.infer<typeof criticalValueWireSchema>;

export const clinicalResultWireSchema = z.object({
  "result_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "order_id": z.string().uuid(),
  "execution_task_id": z.string().uuid(),
  "report_type": z.enum(["LAB","IMAGING"]),
  "source_system": z.string(),
  "source_report_key": z.string(),
  "report_status": z.enum(["FINAL","CORRECTED"]),
  "conclusion": z.string(),
  "reported_at": z.string(),
  "observations": z.array(clinicalResultObservationWireSchema),
  "critical_values": z.array(criticalValueWireSchema),
  "version_no": z.number().int(),
  "row_version": z.number().int(),
  "data_watermark": z.string(),
}).strict();
export type ClinicalResultWire = z.infer<typeof clinicalResultWireSchema>;

export const orderExecutionEventCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "event_type": z.enum(["PARTIAL","COMPLETED"]),
  "expected_task_row_version": z.number().int(),
  "performed_quantity": z.number(),
  "quantity_unit": z.string(),
  "note": z.string().nullable().optional(),
}).strict();
export type OrderExecutionEventCreateRequestWire = z.infer<typeof orderExecutionEventCreateRequestWireSchema>;

export const clinicalOrderItemWireSchema = z.object({
  "order_item_id": z.string().uuid(),
  "item_type": z.enum(["MEDICATION","LAB","IMAGING","TREATMENT","NURSING","DIET","OTHER"]),
  "catalog_code": z.string(),
  "display_name": z.string(),
  "requested_quantity": z.number(),
  "quantity_unit": z.string(),
  "medication_catalog_version_id": z.string().uuid().nullable().optional(),
  "drug_code": z.string().nullable().optional(),
  "ingredient_code": z.string().nullable().optional(),
  "dose_value": z.number().nullable().optional(),
  "dose_unit": z.string().nullable().optional(),
  "route_code": z.string().nullable().optional(),
  "frequency_code": z.string().nullable().optional(),
  "instructions": z.string().nullable().optional(),
  "item_state": z.enum(["DRAFT","ACTIVE","IN_PROGRESS","COMPLETED","CANCELLED","STOPPED"]),
  "row_version": z.number().int(),
}).strict();
export type ClinicalOrderItemWire = z.infer<typeof clinicalOrderItemWireSchema>;

export const orderExecutionTaskWireSchema = z.object({
  "execution_task_id": z.string().uuid(),
  "order_id": z.string().uuid(),
  "order_item_id": z.string().uuid(),
  "task_state": z.enum(["PENDING","ACCEPTED","IN_PROGRESS","PARTIAL","COMPLETED","REFUSED","CANCELLED"]),
  "requested_quantity": z.number(),
  "performed_quantity": z.number(),
  "quantity_unit": z.string(),
  "row_version": z.number().int(),
}).strict();
export type OrderExecutionTaskWire = z.infer<typeof orderExecutionTaskWireSchema>;

export const clinicalOrderWireSchema = z.object({
  "order_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "order_scope": z.enum(["LONG_TERM","TEMPORARY"]),
  "status": z.enum(["DRAFT","VALIDATING","SIGNED","ACTIVE","IN_PROGRESS","COMPLETED","CANCELLED","STOPPING","STOPPED","EXCEPTION"]),
  "clinical_indication": z.string(),
  "items": z.array(clinicalOrderItemWireSchema),
  "execution_tasks": z.array(orderExecutionTaskWireSchema),
  "row_version": z.number().int(),
  "data_watermark": z.string(),
}).strict();
export type ClinicalOrderWire = z.infer<typeof clinicalOrderWireSchema>;

export const medicationSafetyFindingWireSchema = z.object({
  "finding_id": z.string().uuid(),
  "order_item_id": z.string().uuid(),
  "code": z.string(),
  "severity": z.enum(["BLOCKING","WARNING","INFO"]),
  "title": z.string(),
  "detail": z.string(),
  "evidence_source": z.string(),
  "override_allowed": z.boolean(),
}).strict();
export type MedicationSafetyFindingWire = z.infer<typeof medicationSafetyFindingWireSchema>;

export const medicationSafetyEvaluationWireSchema = z.object({
  "evaluation_id": z.string().uuid(),
  "order_id": z.string().uuid(),
  "evaluated_order_row_version": z.number().int(),
  "rule_watermark": z.string(),
  "passed": z.boolean(),
  "blocking_count": z.number().int(),
  "evaluated_at": z.string(),
  "findings": z.array(medicationSafetyFindingWireSchema),
}).strict();
export type MedicationSafetyEvaluationWire = z.infer<typeof medicationSafetyEvaluationWireSchema>;

export const clinicalTaskCommandRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ClinicalTaskCommandRequestWire = z.infer<typeof clinicalTaskCommandRequestWireSchema>;

export const clinicalTaskExpirationResultWireSchema = z.object({
  "expired_count": z.number().int(),
  "encounter_id": z.string().uuid(),
  "occurred_at": z.string(),
}).strict();
export type ClinicalTaskExpirationResultWire = z.infer<typeof clinicalTaskExpirationResultWireSchema>;

export const wardTransferTaskMigrationRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "from_ward_id": z.string().uuid(),
  "to_ward_id": z.string().uuid(),
}).strict();
export type WardTransferTaskMigrationRequestWire = z.infer<typeof wardTransferTaskMigrationRequestWireSchema>;

export const wardTransferTaskMigrationResultWireSchema = z.object({
  "migrated_count": z.number().int(),
  "encounter_id": z.string().uuid(),
  "to_ward_id": z.string().uuid(),
}).strict();
export type WardTransferTaskMigrationResultWire = z.infer<typeof wardTransferTaskMigrationResultWireSchema>;

export const clinicalTaskTeamQueueWireSchema = z.object({
  "queue_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "department_id": z.string().uuid(),
  "clinical_task_id": z.string().uuid(),
  "queue_status": z.enum(["ENQUEUED","CLAIMED","COMPLETED","WITHDRAWN"]),
  "enqueued_by": z.string().uuid(),
  "enqueued_at": z.string(),
  "claimed_by": z.string().uuid().nullable().optional(),
  "claimed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ClinicalTaskTeamQueueWire = z.infer<typeof clinicalTaskTeamQueueWireSchema>;

export const clinicalTaskTeamQueueEnqueueRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "department_id": z.string().uuid(),
  "clinical_task_id": z.string().uuid(),
  "enqueued_at": z.string(),
}).strict();
export type ClinicalTaskTeamQueueEnqueueRequestWire = z.infer<typeof clinicalTaskTeamQueueEnqueueRequestWireSchema>;

export const clinicalTaskTeamQueueTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ClinicalTaskTeamQueueTransitionRequestWire = z.infer<typeof clinicalTaskTeamQueueTransitionRequestWireSchema>;

export const clinicalTaskNotificationWireSchema = z.object({
  "notification_id": z.string().uuid(),
  "task_id": z.string().uuid(),
  "recipient_user_id": z.string().uuid(),
  "kind": z.enum(["CREATED","OVERDUE","ESCALATED","EXPIRED"]),
  "channel": z.enum(["IN_APP","OUTBOX"]),
  "status": z.enum(["PENDING","DELIVERED","FAILED"]),
  "attempt_count": z.number().int(),
  "scheduled_at": z.string(),
  "delivered_at": z.string().nullable().optional(),
  "last_error": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ClinicalTaskNotificationWire = z.infer<typeof clinicalTaskNotificationWireSchema>;

export const clinicalTaskNotificationCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "task_id": z.string().uuid(),
  "recipient_user_id": z.string().uuid(),
  "kind": z.enum(["CREATED","OVERDUE","ESCALATED","EXPIRED"]),
  "channel": z.enum(["IN_APP","OUTBOX"]),
  "scheduled_at": z.string().nullable().optional(),
}).strict();
export type ClinicalTaskNotificationCreateRequestWire = z.infer<typeof clinicalTaskNotificationCreateRequestWireSchema>;

export const clinicalTaskNotificationDispatchRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "scheduled_before": z.string(),
  "batch_size": z.number().int().optional(),
}).strict();
export type ClinicalTaskNotificationDispatchRequestWire = z.infer<typeof clinicalTaskNotificationDispatchRequestWireSchema>;

export const clinicalTaskNotificationDispatchResultWireSchema = z.object({
  "dispatched_count": z.number().int(),
  "notification_ids": z.array(z.string().uuid()),
}).strict();
export type ClinicalTaskNotificationDispatchResultWire = z.infer<typeof clinicalTaskNotificationDispatchResultWireSchema>;

export const clinicalTaskNotificationDeliverRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ClinicalTaskNotificationDeliverRequestWire = z.infer<typeof clinicalTaskNotificationDeliverRequestWireSchema>;

export const clinicalTaskNotificationFailRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "error": z.string(),
}).strict();
export type ClinicalTaskNotificationFailRequestWire = z.infer<typeof clinicalTaskNotificationFailRequestWireSchema>;

export const clinicalTaskNotificationRecoverRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "task_id": z.string().uuid(),
}).strict();
export type ClinicalTaskNotificationRecoverRequestWire = z.infer<typeof clinicalTaskNotificationRecoverRequestWireSchema>;

export const clinicalTaskNotificationRecoveryResultWireSchema = z.object({
  "recovered_count": z.number().int(),
  "task_id": z.string().uuid(),
}).strict();
export type ClinicalTaskNotificationRecoveryResultWire = z.infer<typeof clinicalTaskNotificationRecoveryResultWireSchema>;

export const scheduleSlotWireSchema = z.object({
  "schedule_slot_id": z.string().uuid(),
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "department_id": z.string().uuid().nullable().optional(),
  "visit_type": z.enum(["OUTPATIENT","EMERGENCY"]),
  "slot_date": z.string(),
  "start_time": z.string(),
  "end_time": z.string(),
  "total_capacity": z.number().int(),
  "booked_count": z.number().int(),
  "status": z.enum(["OPEN","CLOSED","CANCELLED"]),
  "row_version": z.number().int(),
}).strict();
export type ScheduleSlotWire = z.infer<typeof scheduleSlotWireSchema>;

export const scheduleSlotCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "department_id": z.string().uuid().nullable().optional(),
  "visit_type": z.enum(["OUTPATIENT","EMERGENCY"]),
  "slot_date": z.string(),
  "start_time": z.string(),
  "end_time": z.string(),
  "total_capacity": z.number().int(),
}).strict();
export type ScheduleSlotCreateRequestWire = z.infer<typeof scheduleSlotCreateRequestWireSchema>;

export const appointmentWireSchema = z.object({
  "appointment_id": z.string().uuid(),
  "schedule_slot_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "visit_type": z.enum(["OUTPATIENT","EMERGENCY"]),
  "source": z.enum(["APPOINTMENT","WALK_IN","EMERGENCY"]),
  "status": z.enum(["BOOKED","CHECKED_IN","CANCELLED","NO_SHOW","COMPLETED"]),
  "booked_at": z.string(),
  "cancelled_at": z.string().nullable().optional(),
  "encounter_id": z.string().uuid().nullable().optional(),
  "row_version": z.number().int(),
  "data_watermark": z.string(),
}).strict();
export type AppointmentWire = z.infer<typeof appointmentWireSchema>;

export const appointmentBookRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "schedule_slot_id": z.string().uuid(),
  "source": z.enum(["APPOINTMENT","WALK_IN","EMERGENCY"]),
}).strict();
export type AppointmentBookRequestWire = z.infer<typeof appointmentBookRequestWireSchema>;

export const appointmentCancelRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type AppointmentCancelRequestWire = z.infer<typeof appointmentCancelRequestWireSchema>;

export const waitingQueueEntryWireSchema = z.object({
  "waiting_queue_entry_id": z.string().uuid(),
  "appointment_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "queue_date": z.string(),
  "sequence_no": z.number().int(),
  "status": z.enum(["WAITING","CALLED","IN_CONSULTATION","COMPLETED","SKIPPED"]),
  "called_at": z.string().nullable().optional(),
  "called_by": z.string().uuid().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type WaitingQueueEntryWire = z.infer<typeof waitingQueueEntryWireSchema>;

export const appointmentCheckInRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type AppointmentCheckInRequestWire = z.infer<typeof appointmentCheckInRequestWireSchema>;

export const waitingQueueCallRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type WaitingQueueCallRequestWire = z.infer<typeof waitingQueueCallRequestWireSchema>;

export const appointmentConsultRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type AppointmentConsultRequestWire = z.infer<typeof appointmentConsultRequestWireSchema>;

export const vitalSignRecordWireSchema = z.object({
  "vital_sign_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "admission_id": z.string().uuid().nullable().optional(),
  "recorded_at": z.string(),
  "recorded_by": z.string().uuid(),
  "source": z.enum(["MANUAL","DEVICE"]),
  "temperature": z.number().nullable().optional(),
  "pulse": z.number().int().nullable().optional(),
  "respiration": z.number().int().nullable().optional(),
  "systolic_bp": z.number().int().nullable().optional(),
  "diastolic_bp": z.number().int().nullable().optional(),
  "spo2": z.number().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type VitalSignRecordWire = z.infer<typeof vitalSignRecordWireSchema>;

export const vitalSignRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "admission_id": z.string().uuid().nullable().optional(),
  "recorded_at": z.string(),
  "source": z.enum(["MANUAL","DEVICE"]),
  "temperature": z.number().nullable().optional(),
  "pulse": z.number().int().nullable().optional(),
  "respiration": z.number().int().nullable().optional(),
  "systolic_bp": z.number().int().nullable().optional(),
  "diastolic_bp": z.number().int().nullable().optional(),
  "spo2": z.number().nullable().optional(),
}).strict();
export type VitalSignRecordRequestWire = z.infer<typeof vitalSignRecordRequestWireSchema>;

export const nursingCarePlanWireSchema = z.object({
  "care_plan_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "admission_id": z.string().uuid().nullable().optional(),
  "nursing_problem": z.string(),
  "goal": z.string(),
  "intervention": z.string(),
  "evaluation": z.string().nullable().optional(),
  "priority": z.enum(["HIGH","MEDIUM","LOW"]),
  "status": z.enum(["ACTIVE","COMPLETED","DISCONTINUED"]),
  "created_by": z.string().uuid(),
  "completed_by": z.string().uuid().nullable().optional(),
  "completed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type NursingCarePlanWire = z.infer<typeof nursingCarePlanWireSchema>;

export const nursingCarePlanRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "admission_id": z.string().uuid().nullable().optional(),
  "nursing_problem": z.string(),
  "goal": z.string(),
  "intervention": z.string(),
  "evaluation": z.string().nullable().optional(),
  "priority": z.enum(["HIGH","MEDIUM","LOW"]),
}).strict();
export type NursingCarePlanRequestWire = z.infer<typeof nursingCarePlanRequestWireSchema>;

export const nursingCarePlanCompleteRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "disposition": z.enum(["COMPLETED","DISCONTINUED"]),
  "evaluation": z.string().nullable().optional(),
}).strict();
export type NursingCarePlanCompleteRequestWire = z.infer<typeof nursingCarePlanCompleteRequestWireSchema>;

export const medicationAdministrationWireSchema = z.object({
  "administration_id": z.string().uuid(),
  "execution_task_id": z.string().uuid(),
  "order_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "drug_code": z.string(),
  "dose_value": z.number(),
  "dose_unit": z.string(),
  "route_code": z.string(),
  "administered_at": z.string(),
  "administered_by": z.string().uuid(),
  "verified_by": z.string().uuid(),
  "verification_note": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type MedicationAdministrationWire = z.infer<typeof medicationAdministrationWireSchema>;

export const medicationAdministrationRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "execution_task_id": z.string().uuid(),
  "drug_code": z.string(),
  "dose_value": z.number(),
  "dose_unit": z.string(),
  "route_code": z.string(),
  "administered_at": z.string(),
  "verified_by": z.string().uuid(),
  "verification_note": z.string().nullable().optional(),
}).strict();
export type MedicationAdministrationRequestWire = z.infer<typeof medicationAdministrationRequestWireSchema>;

export const shiftHandoverWireSchema = z.object({
  "handover_id": z.string().uuid(),
  "ward_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "shift_from": z.string(),
  "shift_to": z.string(),
  "outgoing_user_id": z.string().uuid(),
  "incoming_user_id": z.string().uuid(),
  "handover_summary": z.string(),
  "status": z.enum(["DRAFT","COMPLETED"]),
  "completed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ShiftHandoverWire = z.infer<typeof shiftHandoverWireSchema>;

export const shiftHandoverCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "ward_id": z.string().uuid(),
  "shift_from": z.string(),
  "shift_to": z.string(),
  "incoming_user_id": z.string().uuid(),
  "handover_summary": z.string(),
}).strict();
export type ShiftHandoverCreateRequestWire = z.infer<typeof shiftHandoverCreateRequestWireSchema>;

export const shiftHandoverCompleteRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "ward_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ShiftHandoverCompleteRequestWire = z.infer<typeof shiftHandoverCompleteRequestWireSchema>;

export const priceCatalogVersionWireSchema = z.object({
  "price_version_id": z.string().uuid(),
  "catalog_code": z.string(),
  "item_code": z.string(),
  "item_name": z.string(),
  "unit_price": z.number(),
  "unit": z.string(),
  "effective_from": z.string(),
  "effective_to": z.string().nullable().optional(),
  "release_version": z.string(),
  "status": z.enum(["DRAFT","ACTIVE","RETIRED"]),
}).strict();
export type PriceCatalogVersionWire = z.infer<typeof priceCatalogVersionWireSchema>;

export const priceCatalogVersionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "catalog_code": z.string(),
  "item_code": z.string(),
  "item_name": z.string(),
  "unit_price": z.number(),
  "unit": z.string(),
  "effective_from": z.string(),
  "release_version": z.string(),
}).strict();
export type PriceCatalogVersionRequestWire = z.infer<typeof priceCatalogVersionRequestWireSchema>;

export const chargeItemWireSchema = z.object({
  "charge_item_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "item_code": z.string(),
  "item_name": z.string(),
  "quantity": z.number(),
  "unit_price": z.number(),
  "amount": z.number(),
  "unit": z.string(),
  "status": z.enum(["CHARGED","REVERSED"]),
  "charged_at": z.string(),
  "charged_by": z.string().uuid(),
  "reversed_at": z.string().nullable().optional(),
  "reversed_by": z.string().uuid().nullable().optional(),
  "reverse_reason": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ChargeItemWire = z.infer<typeof chargeItemWireSchema>;

export const chargeItemRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "item_code": z.string(),
  "quantity": z.number(),
}).strict();
export type ChargeItemRequestWire = z.infer<typeof chargeItemRequestWireSchema>;

export const chargeItemReverseRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type ChargeItemReverseRequestWire = z.infer<typeof chargeItemReverseRequestWireSchema>;

export const labSpecimenWireSchema = z.object({
  "specimen_id": z.string().uuid(),
  "order_id": z.string().uuid(),
  "order_item_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "specimen_type": z.enum(["BLOOD","URINE","STOOL","TISSUE","SWAB","OTHER"]),
  "collection_status": z.enum(["ORDERED","COLLECTED","RECEIVED","REJECTED"]),
  "collected_at": z.string().nullable().optional(),
  "collected_by": z.string().uuid().nullable().optional(),
  "received_at": z.string().nullable().optional(),
  "received_by": z.string().uuid().nullable().optional(),
  "rejection_reason": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type LabSpecimenWire = z.infer<typeof labSpecimenWireSchema>;

export const labSpecimenCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "order_item_id": z.string().uuid(),
  "specimen_type": z.enum(["BLOOD","URINE","STOOL","TISSUE","SWAB","OTHER"]),
}).strict();
export type LabSpecimenCreateRequestWire = z.infer<typeof labSpecimenCreateRequestWireSchema>;

export const labSpecimenCollectRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type LabSpecimenCollectRequestWire = z.infer<typeof labSpecimenCollectRequestWireSchema>;

export const labSpecimenReceiveRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type LabSpecimenReceiveRequestWire = z.infer<typeof labSpecimenReceiveRequestWireSchema>;

export const adverseEventWireSchema = z.object({
  "adverse_event_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "event_type": z.enum(["MEDICATION_ERROR","FALL","PRESSURE_INJURY","TRANSFUSION_REACTION","SURGICAL_COMPLICATION","INFECTION","OTHER"]),
  "severity": z.enum(["NEAR_MISS","MILD","MODERATE","SEVERE","SENTINEL"]),
  "description": z.string(),
  "status": z.enum(["REPORTED","REVIEWED","CLOSED"]),
  "reported_at": z.string(),
  "reported_by": z.string().uuid(),
  "reviewed_at": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid().nullable().optional(),
  "review_conclusion": z.string().nullable().optional(),
  "closed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type AdverseEventWire = z.infer<typeof adverseEventWireSchema>;

export const adverseEventReportRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "event_type": z.enum(["MEDICATION_ERROR","FALL","PRESSURE_INJURY","TRANSFUSION_REACTION","SURGICAL_COMPLICATION","INFECTION","OTHER"]),
  "severity": z.enum(["NEAR_MISS","MILD","MODERATE","SEVERE","SENTINEL"]),
  "description": z.string(),
}).strict();
export type AdverseEventReportRequestWire = z.infer<typeof adverseEventReportRequestWireSchema>;

export const adverseEventReviewRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "conclusion": z.string(),
  "close": z.boolean().optional(),
}).strict();
export type AdverseEventReviewRequestWire = z.infer<typeof adverseEventReviewRequestWireSchema>;

export const bloodTransfusionWireSchema = z.object({
  "transfusion_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "blood_product": z.enum(["RED_CELLS","PLATELETS","PLASMA","CRYO","WHOLE_BLOOD"]),
  "blood_type": z.enum(["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"]),
  "unit_number": z.string(),
  "volume_ml": z.number().int(),
  "started_at": z.string(),
  "administered_by": z.string().uuid(),
  "verified_by": z.string().uuid(),
  "verification_note": z.string().nullable().optional(),
  "reaction_type": z.enum(["FEBRILE","ALLERGIC","HEMOLYTIC","TRALI","TACO","NONE"]).nullable().optional(),
  "reaction_noted_at": z.string().nullable().optional(),
  "reaction_noted_by": z.string().uuid().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type BloodTransfusionWire = z.infer<typeof bloodTransfusionWireSchema>;

export const bloodTransfusionRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "blood_product": z.enum(["RED_CELLS","PLATELETS","PLASMA","CRYO","WHOLE_BLOOD"]),
  "blood_type": z.enum(["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"]),
  "unit_number": z.string(),
  "volume_ml": z.number().int(),
  "started_at": z.string(),
  "verified_by": z.string().uuid(),
  "verification_note": z.string().nullable().optional(),
}).strict();
export type BloodTransfusionRecordRequestWire = z.infer<typeof bloodTransfusionRecordRequestWireSchema>;

export const bloodTransfusionReactionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "reaction_type": z.enum(["FEBRILE","ALLERGIC","HEMOLYTIC","TRALI","TACO","NONE"]),
}).strict();
export type BloodTransfusionReactionRequestWire = z.infer<typeof bloodTransfusionReactionRequestWireSchema>;

export const dictionaryItemWireSchema = z.object({
  "dictionary_item_id": z.string().uuid(),
  "dictionary_code": z.string(),
  "item_code": z.string(),
  "item_name": z.string(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
  "effective_from": z.string(),
  "effective_to": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type DictionaryItemWire = z.infer<typeof dictionaryItemWireSchema>;

export const dictionaryItemCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "dictionary_code": z.string(),
  "item_code": z.string(),
  "item_name": z.string(),
  "effective_from": z.string(),
}).strict();
export type DictionaryItemCreateRequestWire = z.infer<typeof dictionaryItemCreateRequestWireSchema>;

export const dictionaryItemDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type DictionaryItemDeactivateRequestWire = z.infer<typeof dictionaryItemDeactivateRequestWireSchema>;

export const modelDeploymentWireSchema = z.object({
  "model_deployment_id": z.string().uuid(),
  "model_code": z.string(),
  "provider_code": z.string(),
  "display_name": z.string(),
  "residency_policy": z.enum(["ON_PREM_ONLY","LOCAL_PREFERRED","CLOUD_ALLOWED"]),
  "endpoint_url": z.string().nullable().optional(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
  "evaluation_status": z.enum(["EVALUATING","APPROVED","REJECTED"]),
  "row_version": z.number().int(),
}).strict();
export type ModelDeploymentWire = z.infer<typeof modelDeploymentWireSchema>;

export const modelDeploymentRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "model_code": z.string(),
  "provider_code": z.string(),
  "display_name": z.string(),
  "residency_policy": z.enum(["ON_PREM_ONLY","LOCAL_PREFERRED","CLOUD_ALLOWED"]),
  "endpoint_url": z.string().nullable().optional(),
}).strict();
export type ModelDeploymentRegisterRequestWire = z.infer<typeof modelDeploymentRegisterRequestWireSchema>;

export const modelDeploymentDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ModelDeploymentDeactivateRequestWire = z.infer<typeof modelDeploymentDeactivateRequestWireSchema>;

export const researchDatasetRequestWireSchema = z.object({
  "request_id": z.string().uuid(),
  "requester_id": z.string().uuid(),
  "purpose": z.string(),
  "scope_description": z.string(),
  "status": z.enum(["REQUESTED","APPROVED","EXPORTED","DESTROYED","REJECTED"]),
  "approved_by": z.string().uuid().nullable().optional(),
  "approved_at": z.string().nullable().optional(),
  "rejection_reason": z.string().nullable().optional(),
  "exported_at": z.string().nullable().optional(),
  "exported_by": z.string().uuid().nullable().optional(),
  "export_watermark": z.string().nullable().optional(),
  "destroyed_at": z.string().nullable().optional(),
  "destroyed_by": z.string().uuid().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ResearchDatasetRequestWire = z.infer<typeof researchDatasetRequestWireSchema>;

export const researchDatasetRequestCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "purpose": z.string(),
  "scope_description": z.string(),
}).strict();
export type ResearchDatasetRequestCreateRequestWire = z.infer<typeof researchDatasetRequestCreateRequestWireSchema>;

export const researchDatasetRequestApproveRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ResearchDatasetRequestApproveRequestWire = z.infer<typeof researchDatasetRequestApproveRequestWireSchema>;

export const researchDatasetRequestExportRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "watermark": z.string(),
}).strict();
export type ResearchDatasetRequestExportRequestWire = z.infer<typeof researchDatasetRequestExportRequestWireSchema>;

export const researchDatasetRequestDestroyRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ResearchDatasetRequestDestroyRequestWire = z.infer<typeof researchDatasetRequestDestroyRequestWireSchema>;

export const obstetricRecordWireSchema = z.object({
  "obstetric_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "gravidity": z.number().int(),
  "parity": z.number().int(),
  "gestational_weeks": z.number().int(),
  "estimated_due_date": z.string().nullable().optional(),
  "blood_group": z.enum(["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"]),
  "rh_factor": z.enum(["POSITIVE","NEGATIVE"]),
  "high_risk_factors": z.string(),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type ObstetricRecordWire = z.infer<typeof obstetricRecordWireSchema>;

export const obstetricRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "gravidity": z.number().int(),
  "parity": z.number().int(),
  "gestational_weeks": z.number().int(),
  "estimated_due_date": z.string().nullable().optional(),
  "blood_group": z.enum(["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"]),
  "rh_factor": z.enum(["POSITIVE","NEGATIVE"]),
  "high_risk_factors": z.string(),
}).strict();
export type ObstetricRecordCreateRequestWire = z.infer<typeof obstetricRecordCreateRequestWireSchema>;

export const obstetricDeliveryRecordWireSchema = z.object({
  "delivery_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "neonate_patient_id": z.string().uuid().nullable().optional(),
  "delivery_method": z.enum(["VAGINAL","CESAREAN","FORCEPS","VACUUM"]),
  "delivered_at": z.string(),
  "blood_loss_ml": z.number().int(),
  "labor_duration_minutes": z.number().int().nullable().optional(),
  "postpartum_hemorrhage": z.boolean(),
  "recorded_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type ObstetricDeliveryRecordWire = z.infer<typeof obstetricDeliveryRecordWireSchema>;

export const obstetricDeliveryRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "neonate_patient_id": z.string().uuid().nullable().optional(),
  "delivery_method": z.enum(["VAGINAL","CESAREAN","FORCEPS","VACUUM"]),
  "delivered_at": z.string(),
  "blood_loss_ml": z.number().int(),
  "labor_duration_minutes": z.number().int().nullable().optional(),
  "postpartum_hemorrhage": z.boolean(),
}).strict();
export type ObstetricDeliveryRecordCreateRequestWire = z.infer<typeof obstetricDeliveryRecordCreateRequestWireSchema>;

export const obstetricAntenatalExamWireSchema = z.object({
  "exam_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "gestational_weeks": z.number().int(),
  "fundal_height_cm": z.number().nullable().optional(),
  "fetal_heart_rate": z.number().int().nullable().optional(),
  "systolic_bp": z.number().int(),
  "diastolic_bp": z.number().int(),
  "proteinuria": z.enum(["NEGATIVE","TRACE","POSITIVE"]),
  "preeclampsia_risk": z.boolean(),
  "examined_at": z.string(),
  "recorded_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type ObstetricAntenatalExamWire = z.infer<typeof obstetricAntenatalExamWireSchema>;

export const obstetricAntenatalExamCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "gestational_weeks": z.number().int(),
  "fundal_height_cm": z.number().nullable().optional(),
  "fetal_heart_rate": z.number().int().nullable().optional(),
  "systolic_bp": z.number().int(),
  "diastolic_bp": z.number().int(),
  "proteinuria": z.enum(["NEGATIVE","TRACE","POSITIVE"]),
  "preeclampsia_risk": z.boolean(),
  "examined_at": z.string(),
}).strict();
export type ObstetricAntenatalExamCreateRequestWire = z.infer<typeof obstetricAntenatalExamCreateRequestWireSchema>;

export const obstetricQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["DELIVERY","ANTENATAL_EXAM"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ObstetricQcReviewWire = z.infer<typeof obstetricQcReviewWireSchema>;

export const obstetricQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["DELIVERY","ANTENATAL_EXAM"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type ObstetricQcReviewCreateRequestWire = z.infer<typeof obstetricQcReviewCreateRequestWireSchema>;

export const obstetricPostpartumFollowupWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "followup_date": z.string(),
  "lochia_status": z.enum(["NORMAL","ABNORMAL"]),
  "wound_healing": z.enum(["GOOD","COMPLICATED"]),
  "complications": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ObstetricPostpartumFollowupWire = z.infer<typeof obstetricPostpartumFollowupWireSchema>;

export const obstetricPostpartumFollowupCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_date": z.string(),
  "lochia_status": z.enum(["NORMAL","ABNORMAL"]),
  "wound_healing": z.enum(["GOOD","COMPLICATED"]),
  "complications": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type ObstetricPostpartumFollowupCreateRequestWire = z.infer<typeof obstetricPostpartumFollowupCreateRequestWireSchema>;

export const clinicalReminderConversionWireSchema = z.object({
  "conversion_id": z.string().uuid(),
  "reminder_id": z.string().uuid(),
  "clinical_task_id": z.string().uuid(),
  "converted_by": z.string().uuid(),
  "converted_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ClinicalReminderConversionWire = z.infer<typeof clinicalReminderConversionWireSchema>;

export const clinicalReminderConversionCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reminder_id": z.string().uuid(),
  "converted_at": z.string(),
}).strict();
export type ClinicalReminderConversionCreateRequestWire = z.infer<typeof clinicalReminderConversionCreateRequestWireSchema>;

export const clinicalReminderWireSchema = z.object({
  "reminder_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reminder_type": z.enum(["DRUG_INTERACTION","OVERDUE_TASK","CRITICAL_VALUE","ABNORMAL_VITAL","FOLLOWUP_DUE","OTHER"]),
  "message": z.string(),
  "severity": z.enum(["INFO","WARNING","CRITICAL"]),
  "status": z.enum(["PENDING","ACKNOWLEDGED","SILENCED"]),
  "source_task_id": z.string().uuid().nullable().optional(),
  "acknowledged_at": z.string().nullable().optional(),
  "acknowledged_by": z.string().uuid().nullable().optional(),
  "silenced_at": z.string().nullable().optional(),
  "silenced_by": z.string().uuid().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ClinicalReminderWire = z.infer<typeof clinicalReminderWireSchema>;

export const clinicalReminderCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reminder_type": z.enum(["DRUG_INTERACTION","OVERDUE_TASK","CRITICAL_VALUE","ABNORMAL_VITAL","FOLLOWUP_DUE","OTHER"]),
  "message": z.string(),
  "severity": z.enum(["INFO","WARNING","CRITICAL"]),
  "source_task_id": z.string().uuid().nullable().optional(),
}).strict();
export type ClinicalReminderCreateRequestWire = z.infer<typeof clinicalReminderCreateRequestWireSchema>;

export const clinicalReminderAcknowledgeRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ClinicalReminderAcknowledgeRequestWire = z.infer<typeof clinicalReminderAcknowledgeRequestWireSchema>;

export const clinicalReminderSilenceRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type ClinicalReminderSilenceRequestWire = z.infer<typeof clinicalReminderSilenceRequestWireSchema>;

export const artCycleRecordWireSchema = z.object({
  "cycle_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "partner_patient_id": z.string().uuid().nullable().optional(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "cycle_type": z.enum(["IVF","ICSI","IUI","FET","OTHER"]),
  "cycle_number": z.number().int(),
  "ethics_consent_date": z.string(),
  "consent_document_id": z.string().uuid().nullable().optional(),
  "status": z.enum(["ACTIVE","COMPLETED","CANCELLED"]),
  "row_version": z.number().int(),
}).strict();
export type ArtCycleRecordWire = z.infer<typeof artCycleRecordWireSchema>;

export const artCycleRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "partner_patient_id": z.string().uuid().nullable().optional(),
  "encounter_id": z.string().uuid(),
  "cycle_type": z.enum(["IVF","ICSI","IUI","FET","OTHER"]),
  "cycle_number": z.number().int(),
  "ethics_consent_date": z.string(),
  "consent_document_id": z.string().uuid().nullable().optional(),
}).strict();
export type ArtCycleRecordCreateRequestWire = z.infer<typeof artCycleRecordCreateRequestWireSchema>;

export const artEmbryoTransferRecordWireSchema = z.object({
  "embryo_transfer_id": z.string().uuid(),
  "cycle_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "embryo_count": z.number().int(),
  "transferred_at": z.string(),
  "operator_id": z.string().uuid(),
  "verifier_id": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type ArtEmbryoTransferRecordWire = z.infer<typeof artEmbryoTransferRecordWireSchema>;

export const artEmbryoTransferRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "cycle_id": z.string().uuid(),
  "embryo_count": z.number().int(),
  "verifier_id": z.string().uuid(),
  "transferred_at": z.string(),
}).strict();
export type ArtEmbryoTransferRecordCreateRequestWire = z.infer<typeof artEmbryoTransferRecordCreateRequestWireSchema>;

export const artPregnancyOutcomeWireSchema = z.object({
  "outcome_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "cycle_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "pregnancy_result": z.enum(["PREGNANT","NOT_PREGNANT","BIOCHEMICAL","MISCARRIAGE"]),
  "outcome_date": z.string(),
  "live_birth_count": z.number().int(),
  "complications": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ArtPregnancyOutcomeWire = z.infer<typeof artPregnancyOutcomeWireSchema>;

export const artPregnancyOutcomeCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "cycle_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "pregnancy_result": z.enum(["PREGNANT","NOT_PREGNANT","BIOCHEMICAL","MISCARRIAGE"]),
  "outcome_date": z.string(),
  "live_birth_count": z.number().int(),
  "complications": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type ArtPregnancyOutcomeCreateRequestWire = z.infer<typeof artPregnancyOutcomeCreateRequestWireSchema>;

export const pediatricRecordWireSchema = z.object({
  "pediatric_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "guardian_name": z.string(),
  "guardian_relationship": z.enum(["MOTHER","FATHER","LEGAL_GUARDIAN","OTHER"]),
  "guardian_phone": z.string().nullable().optional(),
  "age_in_months": z.number().int(),
  "weight_kg": z.number(),
  "measured_at": z.string(),
  "critical_flag": z.boolean(),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type PediatricRecordWire = z.infer<typeof pediatricRecordWireSchema>;

export const pediatricRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "guardian_name": z.string(),
  "guardian_relationship": z.enum(["MOTHER","FATHER","LEGAL_GUARDIAN","OTHER"]),
  "guardian_phone": z.string().nullable().optional(),
  "age_in_months": z.number().int(),
  "weight_kg": z.number(),
  "measured_at": z.string(),
  "critical_flag": z.boolean().optional(),
}).strict();
export type PediatricRecordCreateRequestWire = z.infer<typeof pediatricRecordCreateRequestWireSchema>;

export const pediatricGrowthRecordWireSchema = z.object({
  "growth_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "height_cm": z.number(),
  "weight_kg": z.number(),
  "head_circumference_cm": z.number().nullable().optional(),
  "measured_at": z.string(),
  "recorded_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type PediatricGrowthRecordWire = z.infer<typeof pediatricGrowthRecordWireSchema>;

export const pediatricGrowthRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "height_cm": z.number(),
  "weight_kg": z.number(),
  "head_circumference_cm": z.number().nullable().optional(),
  "measured_at": z.string(),
}).strict();
export type PediatricGrowthRecordCreateRequestWire = z.infer<typeof pediatricGrowthRecordCreateRequestWireSchema>;

export const pediatricFollowupRecordWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type PediatricFollowupRecordWire = z.infer<typeof pediatricFollowupRecordWireSchema>;

export const pediatricFollowupRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type PediatricFollowupRecordCreateRequestWire = z.infer<typeof pediatricFollowupRecordCreateRequestWireSchema>;

export const neonatalRecordWireSchema = z.object({
  "neonatal_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "mother_patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "birth_datetime": z.string(),
  "gestational_age_weeks": z.number().int(),
  "apgar_1min": z.number().int(),
  "apgar_5min": z.number().int(),
  "birth_weight_g": z.number().int(),
  "sex_at_birth": z.enum(["MALE","FEMALE","INDETERMINATE"]),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type NeonatalRecordWire = z.infer<typeof neonatalRecordWireSchema>;

export const neonatalRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "mother_patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "birth_datetime": z.string(),
  "gestational_age_weeks": z.number().int(),
  "apgar_1min": z.number().int(),
  "apgar_5min": z.number().int(),
  "birth_weight_g": z.number().int(),
  "sex_at_birth": z.enum(["MALE","FEMALE","INDETERMINATE"]),
}).strict();
export type NeonatalRecordCreateRequestWire = z.infer<typeof neonatalRecordCreateRequestWireSchema>;

export const neonatalWristbandVerificationWireSchema = z.object({
  "verification_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "mother_patient_id": z.string().uuid(),
  "wristband_code": z.string(),
  "specimen_code": z.string(),
  "verified_by": z.string().uuid(),
  "witnessed_by": z.string().uuid(),
  "verified_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type NeonatalWristbandVerificationWire = z.infer<typeof neonatalWristbandVerificationWireSchema>;

export const neonatalWristbandVerificationCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "mother_patient_id": z.string().uuid(),
  "wristband_code": z.string(),
  "specimen_code": z.string(),
  "witnessed_by": z.string().uuid(),
  "verified_at": z.string(),
}).strict();
export type NeonatalWristbandVerificationCreateRequestWire = z.infer<typeof neonatalWristbandVerificationCreateRequestWireSchema>;

export const neonatalScreeningRecordWireSchema = z.object({
  "screening_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "mother_patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "screening_type": z.enum(["HEARING","METABOLIC","CONGENITAL_HEART"]),
  "screening_result": z.enum(["PASS","REFER","PENDING"]),
  "referred_to": z.string().nullable().optional(),
  "screened_at": z.string(),
  "recorded_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type NeonatalScreeningRecordWire = z.infer<typeof neonatalScreeningRecordWireSchema>;

export const neonatalScreeningRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "mother_patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "screening_type": z.enum(["HEARING","METABOLIC","CONGENITAL_HEART"]),
  "screening_result": z.enum(["PASS","REFER","PENDING"]),
  "referred_to": z.string().nullable().optional(),
  "screened_at": z.string(),
}).strict();
export type NeonatalScreeningRecordCreateRequestWire = z.infer<typeof neonatalScreeningRecordCreateRequestWireSchema>;

export const mentalHealthRecordWireSchema = z.object({
  "mental_health_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "data_classification": z.literal("RESTRICTED"),
  "suicide_risk_level": z.enum(["NONE","LOW","MODERATE","HIGH","IMMINENT"]),
  "violence_risk_level": z.enum(["NONE","LOW","MODERATE","HIGH"]),
  "risk_assessed_at": z.string(),
  "protective_measures": z.string().nullable().optional(),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type MentalHealthRecordWire = z.infer<typeof mentalHealthRecordWireSchema>;

export const mentalHealthRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "suicide_risk_level": z.enum(["NONE","LOW","MODERATE","HIGH","IMMINENT"]),
  "violence_risk_level": z.enum(["NONE","LOW","MODERATE","HIGH"]),
  "risk_assessed_at": z.string(),
  "protective_measures": z.string().nullable().optional(),
}).strict();
export type MentalHealthRecordCreateRequestWire = z.infer<typeof mentalHealthRecordCreateRequestWireSchema>;

export const mentalHealthCrisisHandoverWireSchema = z.object({
  "crisis_handover_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "from_provider_id": z.string().uuid(),
  "to_provider_id": z.string().uuid(),
  "crisis_reason": z.string(),
  "risk_level": z.enum(["LOW","MODERATE","HIGH","IMMINENT"]),
  "protective_measures": z.string().nullable().optional(),
  "data_classification": z.literal("RESTRICTED"),
  "handed_over_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type MentalHealthCrisisHandoverWire = z.infer<typeof mentalHealthCrisisHandoverWireSchema>;

export const mentalHealthCrisisHandoverCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "to_provider_id": z.string().uuid(),
  "crisis_reason": z.string(),
  "risk_level": z.enum(["LOW","MODERATE","HIGH","IMMINENT"]),
  "protective_measures": z.string().nullable().optional(),
  "handed_over_at": z.string(),
}).strict();
export type MentalHealthCrisisHandoverCreateRequestWire = z.infer<typeof mentalHealthCrisisHandoverCreateRequestWireSchema>;

export const mentalHealthCrisisFollowupWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "followup_date": z.string(),
  "risk_level": z.enum(["NONE","LOW","MODERATE","HIGH","IMMINENT"]),
  "protective_measures": z.string().nullable().optional(),
  "data_classification": z.literal("RESTRICTED"),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type MentalHealthCrisisFollowupWire = z.infer<typeof mentalHealthCrisisFollowupWireSchema>;

export const mentalHealthCrisisFollowupCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_date": z.string(),
  "risk_level": z.enum(["NONE","LOW","MODERATE","HIGH","IMMINENT"]),
  "protective_measures": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type MentalHealthCrisisFollowupCreateRequestWire = z.infer<typeof mentalHealthCrisisFollowupCreateRequestWireSchema>;

export const ophthalmologyRecordWireSchema = z.object({
  "ophthalmology_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "laterality": z.enum(["OD","OS","OU"]),
  "iop_od_mmhg": z.number().nullable().optional(),
  "iop_os_mmhg": z.number().nullable().optional(),
  "surgical_eye": z.enum(["NONE","OD","OS","OU"]),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type OphthalmologyRecordWire = z.infer<typeof ophthalmologyRecordWireSchema>;

export const ophthalmologyRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "laterality": z.enum(["OD","OS","OU"]),
  "iop_od_mmhg": z.number().nullable().optional(),
  "iop_os_mmhg": z.number().nullable().optional(),
  "surgical_eye": z.enum(["NONE","OD","OS","OU"]),
}).strict();
export type OphthalmologyRecordCreateRequestWire = z.infer<typeof ophthalmologyRecordCreateRequestWireSchema>;

export const ophthalmologyPreopVerificationWireSchema = z.object({
  "verification_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "surgical_eye": z.enum(["OD","OS","OU"]),
  "verified_by": z.string().uuid(),
  "witnessed_by": z.string().uuid(),
  "verified_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type OphthalmologyPreopVerificationWire = z.infer<typeof ophthalmologyPreopVerificationWireSchema>;

export const ophthalmologyPreopVerificationCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "surgical_eye": z.enum(["OD","OS","OU"]),
  "witnessed_by": z.string().uuid(),
  "verified_at": z.string(),
}).strict();
export type OphthalmologyPreopVerificationCreateRequestWire = z.infer<typeof ophthalmologyPreopVerificationCreateRequestWireSchema>;

export const entRecordWireSchema = z.object({
  "ent_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "laterality": z.enum(["LEFT","RIGHT","BILATERAL"]),
  "region": z.enum(["EAR","NOSE","THROAT"]),
  "airway_risk_level": z.enum(["NONE","LOW","MODERATE","HIGH"]),
  "airway_precautions": z.string().nullable().optional(),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type EntRecordWire = z.infer<typeof entRecordWireSchema>;

export const entRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "laterality": z.enum(["LEFT","RIGHT","BILATERAL"]),
  "region": z.enum(["EAR","NOSE","THROAT"]),
  "airway_risk_level": z.enum(["NONE","LOW","MODERATE","HIGH"]),
  "airway_precautions": z.string().nullable().optional(),
}).strict();
export type EntRecordCreateRequestWire = z.infer<typeof entRecordCreateRequestWireSchema>;

export const entAirwayRiskHandoverWireSchema = z.object({
  "handover_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "airway_risk_level": z.enum(["MODERATE","HIGH"]),
  "airway_precautions": z.string(),
  "from_provider_id": z.string().uuid(),
  "to_provider_id": z.string().uuid(),
  "handed_over_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type EntAirwayRiskHandoverWire = z.infer<typeof entAirwayRiskHandoverWireSchema>;

export const entAirwayRiskHandoverCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "airway_risk_level": z.enum(["MODERATE","HIGH"]),
  "airway_precautions": z.string(),
  "to_provider_id": z.string().uuid(),
  "handed_over_at": z.string(),
}).strict();
export type EntAirwayRiskHandoverCreateRequestWire = z.infer<typeof entAirwayRiskHandoverCreateRequestWireSchema>;

export const dentalRecordWireSchema = z.object({
  "dental_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "tooth_notation": z.string(),
  "procedure_tooth": z.string().nullable().optional(),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type DentalRecordWire = z.infer<typeof dentalRecordWireSchema>;

export const dentalRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "tooth_notation": z.string(),
  "procedure_tooth": z.string().nullable().optional(),
}).strict();
export type DentalRecordCreateRequestWire = z.infer<typeof dentalRecordCreateRequestWireSchema>;

export const dentalTreatmentRecordWireSchema = z.object({
  "dental_treatment_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "tooth_notation": z.string(),
  "treatment_type": z.enum(["FILLING","EXTRACTION","ROOT_CANAL","CROWN","CLEANING","OTHER"]),
  "material_batch": z.string().nullable().optional(),
  "treated_at": z.string(),
  "performed_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type DentalTreatmentRecordWire = z.infer<typeof dentalTreatmentRecordWireSchema>;

export const dentalTreatmentRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "tooth_notation": z.string(),
  "treatment_type": z.enum(["FILLING","EXTRACTION","ROOT_CANAL","CROWN","CLEANING","OTHER"]),
  "material_batch": z.string().nullable().optional(),
  "treated_at": z.string(),
}).strict();
export type DentalTreatmentRecordCreateRequestWire = z.infer<typeof dentalTreatmentRecordCreateRequestWireSchema>;

export const dermatologyRecordWireSchema = z.object({
  "dermatology_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "body_site": z.enum(["SCALP","FACE","NECK","TRUNK","UPPER_EXTREMITY","LOWER_EXTREMITY","PALMOPLANTAR","GENITAL","MUCOSAL","OTHER"]),
  "bsa_percent": z.number(),
  "pasi_score": z.number().nullable().optional(),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type DermatologyRecordWire = z.infer<typeof dermatologyRecordWireSchema>;

export const dermatologyRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "body_site": z.enum(["SCALP","FACE","NECK","TRUNK","UPPER_EXTREMITY","LOWER_EXTREMITY","PALMOPLANTAR","GENITAL","MUCOSAL","OTHER"]),
  "bsa_percent": z.number(),
  "pasi_score": z.number().nullable().optional(),
}).strict();
export type DermatologyRecordCreateRequestWire = z.infer<typeof dermatologyRecordCreateRequestWireSchema>;

export const dermatologyBiologicScreeningWireSchema = z.object({
  "screening_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "biologic_name": z.string(),
  "tb_screening_result": z.enum(["NEGATIVE","POSITIVE","PENDING"]),
  "hepatitis_screening_result": z.enum(["NEGATIVE","POSITIVE","PENDING"]),
  "cleared_for_biologic": z.boolean(),
  "screened_at": z.string(),
  "screened_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type DermatologyBiologicScreeningWire = z.infer<typeof dermatologyBiologicScreeningWireSchema>;

export const dermatologyBiologicScreeningCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "biologic_name": z.string(),
  "tb_screening_result": z.enum(["NEGATIVE","POSITIVE","PENDING"]),
  "hepatitis_screening_result": z.enum(["NEGATIVE","POSITIVE","PENDING"]),
  "screened_at": z.string(),
}).strict();
export type DermatologyBiologicScreeningCreateRequestWire = z.infer<typeof dermatologyBiologicScreeningCreateRequestWireSchema>;

export const dermatologyBiologicFollowupWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "biologic_name": z.string(),
  "followup_date": z.string(),
  "pasi_score": z.number(),
  "adverse_event": z.boolean(),
  "adverse_event_description": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DermatologyBiologicFollowupWire = z.infer<typeof dermatologyBiologicFollowupWireSchema>;

export const dermatologyBiologicFollowupCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "biologic_name": z.string(),
  "followup_date": z.string(),
  "pasi_score": z.number(),
  "adverse_event": z.boolean(),
  "adverse_event_description": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type DermatologyBiologicFollowupCreateRequestWire = z.infer<typeof dermatologyBiologicFollowupCreateRequestWireSchema>;

export const ophthalmologyPostopFollowupWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "surgical_eye": z.enum(["OD","OS","OU"]),
  "followup_date": z.string(),
  "iop_mmhg": z.number(),
  "complication_note": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type OphthalmologyPostopFollowupWire = z.infer<typeof ophthalmologyPostopFollowupWireSchema>;

export const ophthalmologyPostopFollowupCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "surgical_eye": z.enum(["OD","OS","OU"]),
  "followup_date": z.string(),
  "iop_mmhg": z.number(),
  "complication_note": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type OphthalmologyPostopFollowupCreateRequestWire = z.infer<typeof ophthalmologyPostopFollowupCreateRequestWireSchema>;

export const tcmRecordWireSchema = z.object({
  "tcm_record_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "syndrome_pattern": z.string(),
  "treatment_principle": z.string(),
  "formula_name": z.string(),
  "contains_toxic_herb": z.boolean(),
  "toxic_herb_precautions": z.string().nullable().optional(),
  "status": z.enum(["ACTIVE","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type TcmRecordWire = z.infer<typeof tcmRecordWireSchema>;

export const tcmRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "syndrome_pattern": z.string(),
  "treatment_principle": z.string(),
  "formula_name": z.string(),
  "contains_toxic_herb": z.boolean(),
  "toxic_herb_precautions": z.string().nullable().optional(),
}).strict();
export type TcmRecordCreateRequestWire = z.infer<typeof tcmRecordCreateRequestWireSchema>;

export const tcmHerbalPrescriptionWireSchema = z.object({
  "prescription_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "formula_name": z.string(),
  "herbs": z.string(),
  "contains_toxic_herb": z.boolean(),
  "toxic_herb_precautions": z.string().nullable().optional(),
  "prescribed_at": z.string(),
  "prescribed_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type TcmHerbalPrescriptionWire = z.infer<typeof tcmHerbalPrescriptionWireSchema>;

export const tcmHerbalPrescriptionCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "formula_name": z.string(),
  "herbs": z.string(),
  "contains_toxic_herb": z.boolean(),
  "toxic_herb_precautions": z.string().nullable().optional(),
  "prescribed_at": z.string(),
}).strict();
export type TcmHerbalPrescriptionCreateRequestWire = z.infer<typeof tcmHerbalPrescriptionCreateRequestWireSchema>;

export const tcmFourExaminationsWireSchema = z.object({
  "exam_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "inspection": z.string(),
  "auscultation": z.string(),
  "inquiry": z.string(),
  "palpation": z.string(),
  "examined_at": z.string(),
  "recorded_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type TcmFourExaminationsWire = z.infer<typeof tcmFourExaminationsWireSchema>;

export const tcmFourExaminationsCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "inspection": z.string(),
  "auscultation": z.string(),
  "inquiry": z.string(),
  "palpation": z.string(),
  "examined_at": z.string(),
}).strict();
export type TcmFourExaminationsCreateRequestWire = z.infer<typeof tcmFourExaminationsCreateRequestWireSchema>;

export const emergencyTriageAssessmentWireSchema = z.object({
  "triage_assessment_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "triage_level": z.enum(["LEVEL_1","LEVEL_2","LEVEL_3","LEVEL_4"]),
  "chief_complaint": z.string(),
  "triaged_at": z.string(),
  "immediate_action_required": z.boolean(),
  "status": z.enum(["ACTIVE","SUPERSEDED"]),
  "row_version": z.number().int(),
}).strict();
export type EmergencyTriageAssessmentWire = z.infer<typeof emergencyTriageAssessmentWireSchema>;

export const emergencyTriageAssessmentCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "triage_level": z.enum(["LEVEL_1","LEVEL_2","LEVEL_3","LEVEL_4"]),
  "chief_complaint": z.string(),
  "triaged_at": z.string(),
  "immediate_action_required": z.boolean(),
}).strict();
export type EmergencyTriageAssessmentCreateRequestWire = z.infer<typeof emergencyTriageAssessmentCreateRequestWireSchema>;

export const shiftHandoverPatientWireSchema = z.object({
  "shift_handover_patient_id": z.string().uuid(),
  "handover_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "summary": z.string(),
  "risk_flag": z.boolean(),
  "row_version": z.number().int(),
}).strict();
export type ShiftHandoverPatientWire = z.infer<typeof shiftHandoverPatientWireSchema>;

export const shiftHandoverPatientCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "ward_id": z.string().uuid(),
  "handover_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "summary": z.string(),
  "risk_flag": z.boolean(),
}).strict();
export type ShiftHandoverPatientCreateRequestWire = z.infer<typeof shiftHandoverPatientCreateRequestWireSchema>;

export const emergencyObservationWireSchema = z.object({
  "observation_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "observation_started_at": z.string(),
  "disposition": z.enum(["PENDING","DISCHARGED","ADMITTED","TRANSFERRED"]),
  "status": z.enum(["OBSERVING","COMPLETED"]),
  "completed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type EmergencyObservationWire = z.infer<typeof emergencyObservationWireSchema>;

export const emergencyObservationStartRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "observation_started_at": z.string(),
}).strict();
export type EmergencyObservationStartRequestWire = z.infer<typeof emergencyObservationStartRequestWireSchema>;

export const emergencyObservationCompleteRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "disposition": z.enum(["DISCHARGED","ADMITTED","TRANSFERRED"]),
}).strict();
export type EmergencyObservationCompleteRequestWire = z.infer<typeof emergencyObservationCompleteRequestWireSchema>;

export const imagingOrderWireSchema = z.object({
  "imaging_order_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "modality": z.enum(["CT","MRI","XRAY","ULTRASOUND"]),
  "body_part": z.enum(["HEAD","NECK","CHEST","ABDOMEN","PELVIS","SPINE","UPPER_EXTREMITY","LOWER_EXTREMITY","OTHER"]),
  "laterality": z.enum(["NONE","LEFT","RIGHT","BILATERAL"]),
  "contrast_required": z.boolean(),
  "status": z.enum(["ORDERED","PERFORMED","REPORTED","CANCELLED"]),
  "ordered_at": z.string(),
  "performed_at": z.string().nullable().optional(),
  "reported_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ImagingOrderWire = z.infer<typeof imagingOrderWireSchema>;

export const imagingOrderCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "modality": z.enum(["CT","MRI","XRAY","ULTRASOUND"]),
  "body_part": z.enum(["HEAD","NECK","CHEST","ABDOMEN","PELVIS","SPINE","UPPER_EXTREMITY","LOWER_EXTREMITY","OTHER"]),
  "laterality": z.enum(["NONE","LEFT","RIGHT","BILATERAL"]),
  "contrast_required": z.boolean(),
  "ordered_at": z.string(),
}).strict();
export type ImagingOrderCreateRequestWire = z.infer<typeof imagingOrderCreateRequestWireSchema>;

export const imagingOrderTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "transition": z.enum(["PERFORM","REPORT","CANCEL"]),
}).strict();
export type ImagingOrderTransitionRequestWire = z.infer<typeof imagingOrderTransitionRequestWireSchema>;

export const pharmacyDispensingWireSchema = z.object({
  "dispensing_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "drug_code": z.string(),
  "batch_number": z.string(),
  "quantity": z.number(),
  "quantity_unit": z.string(),
  "dispensed_by": z.string().uuid(),
  "verified_by": z.string().uuid().nullable().optional(),
  "status": z.enum(["PREPARED","VERIFIED","DISPENSED"]),
  "prepared_at": z.string(),
  "verified_at": z.string().nullable().optional(),
  "dispensed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type PharmacyDispensingWire = z.infer<typeof pharmacyDispensingWireSchema>;

export const pharmacyDispensingPrepareRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "drug_code": z.string(),
  "batch_number": z.string(),
  "quantity": z.number(),
  "quantity_unit": z.string(),
  "prepared_at": z.string(),
}).strict();
export type PharmacyDispensingPrepareRequestWire = z.infer<typeof pharmacyDispensingPrepareRequestWireSchema>;

export const pharmacyDispensingTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "transition": z.enum(["VERIFY","DISPENSE"]),
}).strict();
export type PharmacyDispensingTransitionRequestWire = z.infer<typeof pharmacyDispensingTransitionRequestWireSchema>;

export const surgicalProcedureWireSchema = z.object({
  "surgical_procedure_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "procedure_name": z.string(),
  "body_site": z.enum(["HEAD","NECK","CHEST","ABDOMEN","PELVIS","SPINE","UPPER_EXTREMITY","LOWER_EXTREMITY","OTHER"]),
  "laterality": z.enum(["NONE","LEFT","RIGHT","BILATERAL"]),
  "surgeon_id": z.string().uuid(),
  "anesthesiologist_id": z.string().uuid(),
  "status": z.enum(["SCHEDULED","TIME_OUT_COMPLETED","COMPLETED"]),
  "scheduled_at": z.string(),
  "time_out_at": z.string().nullable().optional(),
  "completed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type SurgicalProcedureWire = z.infer<typeof surgicalProcedureWireSchema>;

export const surgicalProcedureScheduleRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "procedure_name": z.string(),
  "body_site": z.enum(["HEAD","NECK","CHEST","ABDOMEN","PELVIS","SPINE","UPPER_EXTREMITY","LOWER_EXTREMITY","OTHER"]),
  "laterality": z.enum(["NONE","LEFT","RIGHT","BILATERAL"]),
  "surgeon_id": z.string().uuid(),
  "anesthesiologist_id": z.string().uuid(),
  "scheduled_at": z.string(),
}).strict();
export type SurgicalProcedureScheduleRequestWire = z.infer<typeof surgicalProcedureScheduleRequestWireSchema>;

export const surgicalProcedureTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "transition": z.enum(["TIME_OUT","COMPLETE"]),
}).strict();
export type SurgicalProcedureTransitionRequestWire = z.infer<typeof surgicalProcedureTransitionRequestWireSchema>;

export const infectionMonitoringEventWireSchema = z.object({
  "infection_event_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "infection_type": z.enum(["SURGICAL_SITE","URINARY_TRACT","BLOODSTREAM","PNEUMONIA","OTHER"]),
  "organism_code": z.string().nullable().optional(),
  "reported_at": z.string(),
  "status": z.enum(["REPORTED","CONFIRMED","REFUTED"]),
  "conclusion": z.string().nullable().optional(),
  "resolved_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type InfectionMonitoringEventWire = z.infer<typeof infectionMonitoringEventWireSchema>;

export const infectionMonitoringEventReportRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "infection_type": z.enum(["SURGICAL_SITE","URINARY_TRACT","BLOODSTREAM","PNEUMONIA","OTHER"]),
  "organism_code": z.string().nullable().optional(),
  "reported_at": z.string(),
}).strict();
export type InfectionMonitoringEventReportRequestWire = z.infer<typeof infectionMonitoringEventReportRequestWireSchema>;

export const infectionMonitoringEventResolveRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "resolution": z.enum(["CONFIRM","REFUTE"]),
  "conclusion": z.string(),
}).strict();
export type InfectionMonitoringEventResolveRequestWire = z.infer<typeof infectionMonitoringEventResolveRequestWireSchema>;

export const referralWireSchema = z.object({
  "referral_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "referral_type": z.enum(["INTERNAL","EXTERNAL"]),
  "target_department": z.string().nullable().optional(),
  "target_organization": z.string().nullable().optional(),
  "reason": z.string(),
  "clinical_summary": z.string(),
  "status": z.enum(["DRAFT","SENT","ACCEPTED","REJECTED"]),
  "sent_at": z.string().nullable().optional(),
  "resolved_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ReferralWire = z.infer<typeof referralWireSchema>;

export const referralCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "referral_type": z.enum(["INTERNAL","EXTERNAL"]),
  "target_department": z.string().nullable().optional(),
  "target_organization": z.string().nullable().optional(),
  "reason": z.string(),
  "clinical_summary": z.string(),
}).strict();
export type ReferralCreateRequestWire = z.infer<typeof referralCreateRequestWireSchema>;

export const referralTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "transition": z.enum(["SEND","ACCEPT","REJECT"]),
}).strict();
export type ReferralTransitionRequestWire = z.infer<typeof referralTransitionRequestWireSchema>;

export const promptReleaseWireSchema = z.object({
  "prompt_release_id": z.string().uuid(),
  "prompt_code": z.string(),
  "release_version": z.string(),
  "display_name": z.string(),
  "content": z.string(),
  "status": z.enum(["DRAFT","ACTIVE","RETIRED"]),
  "effective_from": z.string(),
  "effective_to": z.string().nullable().optional(),
  "published_by": z.string().uuid(),
  "created_at": z.string(),
}).strict();
export type PromptReleaseWire = z.infer<typeof promptReleaseWireSchema>;

export const promptReleasePublishRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "prompt_code": z.string(),
  "release_version": z.string(),
  "display_name": z.string(),
  "content": z.string(),
  "effective_from": z.string(),
}).strict();
export type PromptReleasePublishRequestWire = z.infer<typeof promptReleasePublishRequestWireSchema>;

export const promptReleaseRetireRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type PromptReleaseRetireRequestWire = z.infer<typeof promptReleaseRetireRequestWireSchema>;

export const dataQualityRuleWireSchema = z.object({
  "data_quality_rule_id": z.string().uuid(),
  "rule_code": z.string(),
  "rule_name": z.string(),
  "dimension": z.enum(["COMPLETENESS","CONSISTENCY","TIMELINESS","UNIQUENESS","VALIDITY"]),
  "target_entity": z.string(),
  "threshold": z.number(),
  "severity": z.enum(["INFO","WARNING","BLOCKING"]),
  "status": z.enum(["ACTIVE","INACTIVE"]),
}).strict();
export type DataQualityRuleWire = z.infer<typeof dataQualityRuleWireSchema>;

export const dataQualityRuleRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "rule_code": z.string(),
  "rule_name": z.string(),
  "dimension": z.enum(["COMPLETENESS","CONSISTENCY","TIMELINESS","UNIQUENESS","VALIDITY"]),
  "target_entity": z.string(),
  "threshold": z.number(),
  "severity": z.enum(["INFO","WARNING","BLOCKING"]),
}).strict();
export type DataQualityRuleRegisterRequestWire = z.infer<typeof dataQualityRuleRegisterRequestWireSchema>;

export const dataQualityRuleDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type DataQualityRuleDeactivateRequestWire = z.infer<typeof dataQualityRuleDeactivateRequestWireSchema>;

export const dataQualityEvaluationWireSchema = z.object({
  "data_quality_evaluation_id": z.string().uuid(),
  "data_quality_rule_id": z.string().uuid(),
  "target_entity_id": z.string().uuid(),
  "measured_value": z.number(),
  "threshold": z.number(),
  "status": z.enum(["PASSED","FAILED"]),
  "evaluated_at": z.string(),
  "evaluated_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type DataQualityEvaluationWire = z.infer<typeof dataQualityEvaluationWireSchema>;

export const dataQualityEvaluationRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "data_quality_rule_id": z.string().uuid(),
  "target_entity_id": z.string().uuid(),
  "measured_value": z.number(),
  "evaluated_at": z.string(),
}).strict();
export type DataQualityEvaluationRecordRequestWire = z.infer<typeof dataQualityEvaluationRecordRequestWireSchema>;

export const dictationNoteWireSchema = z.object({
  "dictation_note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "transcript": z.string(),
  "status": z.enum(["DRAFT","REVIEWED","SIGNED"]),
  "reviewed_at": z.string().nullable().optional(),
  "signed_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type DictationNoteWire = z.infer<typeof dictationNoteWireSchema>;

export const dictationNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "transcript": z.string(),
}).strict();
export type DictationNoteCreateRequestWire = z.infer<typeof dictationNoteCreateRequestWireSchema>;

export const dictationNoteTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "transition": z.enum(["REVIEW","SIGN"]),
}).strict();
export type DictationNoteTransitionRequestWire = z.infer<typeof dictationNoteTransitionRequestWireSchema>;

export const actionExecutionWireSchema = z.object({
  "execution_id": z.string().uuid(),
  "action_approval_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "execution_status": z.enum(["PENDING","SUCCEEDED","FAILED"]),
  "executed_by": z.string().uuid().nullable().optional(),
  "executed_at": z.string().nullable().optional(),
  "result_note": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ActionExecutionWire = z.infer<typeof actionExecutionWireSchema>;

export const actionExecutionCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "action_approval_id": z.string().uuid(),
}).strict();
export type ActionExecutionCreateRequestWire = z.infer<typeof actionExecutionCreateRequestWireSchema>;

export const actionExecutionTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "result_note": z.string().nullable().optional(),
}).strict();
export type ActionExecutionTransitionRequestWire = z.infer<typeof actionExecutionTransitionRequestWireSchema>;

export const actionApprovalWireSchema = z.object({
  "action_approval_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "action_type": z.enum(["ORDER_MEDICATION","ORDER_LAB","ORDER_IMAGING","CREATE_DOCUMENT","OTHER"]),
  "proposed_action_summary": z.string(),
  "proposed_by": z.string().uuid(),
  "proposed_at": z.string(),
  "status": z.enum(["PROPOSED","APPROVED","REJECTED"]),
  "decided_by": z.string().uuid().nullable().optional(),
  "decided_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type ActionApprovalWire = z.infer<typeof actionApprovalWireSchema>;

export const actionApprovalProposeRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "action_type": z.enum(["ORDER_MEDICATION","ORDER_LAB","ORDER_IMAGING","CREATE_DOCUMENT","OTHER"]),
  "proposed_action_summary": z.string(),
  "proposed_at": z.string(),
}).strict();
export type ActionApprovalProposeRequestWire = z.infer<typeof actionApprovalProposeRequestWireSchema>;

export const actionApprovalDecideRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "decision": z.enum(["APPROVE","REJECT"]),
}).strict();
export type ActionApprovalDecideRequestWire = z.infer<typeof actionApprovalDecideRequestWireSchema>;

export const agentRegistryWireSchema = z.object({
  "agent_registry_id": z.string().uuid(),
  "agent_code": z.string(),
  "agent_name": z.string(),
  "agent_version": z.string(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
}).strict();
export type AgentRegistryWire = z.infer<typeof agentRegistryWireSchema>;

export const agentRegistryRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "agent_code": z.string(),
  "agent_name": z.string(),
  "agent_version": z.string(),
}).strict();
export type AgentRegistryRegisterRequestWire = z.infer<typeof agentRegistryRegisterRequestWireSchema>;

export const agentRegistryDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type AgentRegistryDeactivateRequestWire = z.infer<typeof agentRegistryDeactivateRequestWireSchema>;

export const agentDependencyWireSchema = z.object({
  "agent_dependency_id": z.string().uuid(),
  "agent_registry_id": z.string().uuid(),
  "dependency_type": z.enum(["SKILL","TOOL"]),
  "dependency_code": z.string(),
  "resolved": z.boolean(),
  "row_version": z.number().int(),
}).strict();
export type AgentDependencyWire = z.infer<typeof agentDependencyWireSchema>;

export const agentDependencyDeclareRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "agent_registry_id": z.string().uuid(),
  "dependency_type": z.enum(["SKILL","TOOL"]),
  "dependency_code": z.string(),
}).strict();
export type AgentDependencyDeclareRequestWire = z.infer<typeof agentDependencyDeclareRequestWireSchema>;

export const researchCohortMemberWireSchema = z.object({
  "cohort_member_id": z.string().uuid(),
  "research_cohort_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "computed_by": z.string().uuid(),
  "computed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ResearchCohortMemberWire = z.infer<typeof researchCohortMemberWireSchema>;

export const researchCohortMemberComputeRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "research_cohort_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "computed_at": z.string(),
}).strict();
export type ResearchCohortMemberComputeRequestWire = z.infer<typeof researchCohortMemberComputeRequestWireSchema>;

export const researchCohortWireSchema = z.object({
  "research_cohort_id": z.string().uuid(),
  "cohort_code": z.string(),
  "cohort_name": z.string(),
  "inclusion_criteria": z.string(),
  "exclusion_criteria": z.string().nullable().optional(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
}).strict();
export type ResearchCohortWire = z.infer<typeof researchCohortWireSchema>;

export const researchCohortDefineRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "cohort_code": z.string(),
  "cohort_name": z.string(),
  "inclusion_criteria": z.string(),
  "exclusion_criteria": z.string().nullable().optional(),
}).strict();
export type ResearchCohortDefineRequestWire = z.infer<typeof researchCohortDefineRequestWireSchema>;

export const researchCohortDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type ResearchCohortDeactivateRequestWire = z.infer<typeof researchCohortDeactivateRequestWireSchema>;

export const researchCohortSnapshotWireSchema = z.object({
  "research_cohort_snapshot_id": z.string().uuid(),
  "research_cohort_id": z.string().uuid(),
  "member_count": z.number().int(),
  "criteria_hash": z.string(),
  "computed_at": z.string(),
  "computed_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type ResearchCohortSnapshotWire = z.infer<typeof researchCohortSnapshotWireSchema>;

export const researchCohortSnapshotRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "research_cohort_id": z.string().uuid(),
  "member_count": z.number().int(),
  "computed_at": z.string(),
}).strict();
export type ResearchCohortSnapshotRequestWire = z.infer<typeof researchCohortSnapshotRequestWireSchema>;

export const releaseDownloadEventWireSchema = z.object({
  "download_event_id": z.string().uuid(),
  "channel": z.enum(["GITHUB","WEBSITE","PACKAGE_REGISTRY","DOCKER_HUB"]),
  "source_ip": z.string().nullable().optional(),
  "user_agent": z.string().nullable().optional(),
  "fingerprint_hash": z.string(),
  "is_robot": z.boolean(),
  "downloaded_at": z.string(),
}).strict();
export type ReleaseDownloadEventWire = z.infer<typeof releaseDownloadEventWireSchema>;

export const releaseDownloadEventCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "channel": z.enum(["GITHUB","WEBSITE","PACKAGE_REGISTRY","DOCKER_HUB"]),
  "source_ip": z.string().nullable().optional(),
  "user_agent": z.string().nullable().optional(),
  "fingerprint_hash": z.string(),
  "downloaded_at": z.string(),
}).strict();
export type ReleaseDownloadEventCreateRequestWire = z.infer<typeof releaseDownloadEventCreateRequestWireSchema>;

export const releaseDownloadValidCountWireSchema = z.object({
  "channel": z.enum(["GITHUB","WEBSITE","PACKAGE_REGISTRY","DOCKER_HUB"]).nullable(),
  "valid_count": z.number().int(),
}).strict();
export type ReleaseDownloadValidCountWire = z.infer<typeof releaseDownloadValidCountWireSchema>;

export const releaseMetricSnapshotWireSchema = z.object({
  "snapshot_id": z.string().uuid(),
  "metric_type": z.enum(["STARS","DOWNLOADS","ACTIVE_INSTALLS"]),
  "metric_value": z.number().int(),
  "source": z.string(),
  "snapshot_date": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ReleaseMetricSnapshotWire = z.infer<typeof releaseMetricSnapshotWireSchema>;

export const releaseMetricSnapshotCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "metric_type": z.enum(["STARS","DOWNLOADS","ACTIVE_INSTALLS"]),
  "metric_value": z.number().int(),
  "source": z.string(),
  "snapshot_date": z.string(),
}).strict();
export type ReleaseMetricSnapshotCreateRequestWire = z.infer<typeof releaseMetricSnapshotCreateRequestWireSchema>;

export const capabilityPackWireSchema = z.object({
  "capability_pack_id": z.string().uuid(),
  "pack_code": z.string(),
  "pack_name": z.string(),
  "inherits_from": z.string().nullable().optional(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
}).strict();
export type CapabilityPackWire = z.infer<typeof capabilityPackWireSchema>;

export const capabilityPackDefineRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "pack_code": z.string(),
  "pack_name": z.string(),
  "inherits_from": z.string().nullable().optional(),
}).strict();
export type CapabilityPackDefineRequestWire = z.infer<typeof capabilityPackDefineRequestWireSchema>;

export const capabilityPackDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type CapabilityPackDeactivateRequestWire = z.infer<typeof capabilityPackDeactivateRequestWireSchema>;

export const capabilityPackReleaseWireSchema = z.object({
  "release_id": z.string().uuid(),
  "capability_pack_id": z.string().uuid(),
  "release_version": z.string(),
  "lifecycle_status": z.enum(["DRAFT","CANARY","ACTIVE","RETIRED","ROLLED_BACK"]),
  "canary_started_at": z.string().nullable().optional(),
  "promoted_at": z.string().nullable().optional(),
  "retired_at": z.string().nullable().optional(),
  "rollback_reason": z.string().nullable().optional(),
  "released_by": z.string().uuid(),
  "released_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type CapabilityPackReleaseWire = z.infer<typeof capabilityPackReleaseWireSchema>;

export const capabilityPackReleaseCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "capability_pack_id": z.string().uuid(),
  "release_version": z.string(),
  "released_at": z.string(),
}).strict();
export type CapabilityPackReleaseCreateRequestWire = z.infer<typeof capabilityPackReleaseCreateRequestWireSchema>;

export const capabilityPackReleaseTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type CapabilityPackReleaseTransitionRequestWire = z.infer<typeof capabilityPackReleaseTransitionRequestWireSchema>;

export const capabilityPackReleaseRollbackRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "rollback_reason": z.string(),
}).strict();
export type CapabilityPackReleaseRollbackRequestWire = z.infer<typeof capabilityPackReleaseRollbackRequestWireSchema>;

export const emergencyResuscitationWireSchema = z.object({
  "resuscitation_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "started_at": z.string(),
  "ended_at": z.string().nullable().optional(),
  "outcome": z.enum(["PENDING","ROSC","DEATH","TRANSFERRED"]),
  "status": z.enum(["IN_PROGRESS","COMPLETED"]),
  "row_version": z.number().int(),
}).strict();
export type EmergencyResuscitationWire = z.infer<typeof emergencyResuscitationWireSchema>;

export const emergencyResuscitationStartRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "started_at": z.string(),
}).strict();
export type EmergencyResuscitationStartRequestWire = z.infer<typeof emergencyResuscitationStartRequestWireSchema>;

export const emergencyResuscitationCompleteRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "outcome": z.enum(["ROSC","DEATH","TRANSFERRED"]),
}).strict();
export type EmergencyResuscitationCompleteRequestWire = z.infer<typeof emergencyResuscitationCompleteRequestWireSchema>;

export const skillRegistryWireSchema = z.object({
  "skill_registry_id": z.string().uuid(),
  "skill_code": z.string(),
  "skill_name": z.string(),
  "skill_version": z.string(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
}).strict();
export type SkillRegistryWire = z.infer<typeof skillRegistryWireSchema>;

export const skillRegistryRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "skill_code": z.string(),
  "skill_name": z.string(),
  "skill_version": z.string(),
}).strict();
export type SkillRegistryRegisterRequestWire = z.infer<typeof skillRegistryRegisterRequestWireSchema>;

export const skillRegistryDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type SkillRegistryDeactivateRequestWire = z.infer<typeof skillRegistryDeactivateRequestWireSchema>;

export const toolRegistryWireSchema = z.object({
  "tool_registry_id": z.string().uuid(),
  "tool_code": z.string(),
  "tool_name": z.string(),
  "tool_version": z.string(),
  "tool_type": z.enum(["API","FUNCTION","DATABASE_QUERY","OTHER"]),
  "status": z.enum(["ACTIVE","INACTIVE"]),
}).strict();
export type ToolRegistryWire = z.infer<typeof toolRegistryWireSchema>;

export const toolRegistryRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "tool_code": z.string(),
  "tool_name": z.string(),
  "tool_version": z.string(),
  "tool_type": z.enum(["API","FUNCTION","DATABASE_QUERY","OTHER"]),
}).strict();
export type ToolRegistryRegisterRequestWire = z.infer<typeof toolRegistryRegisterRequestWireSchema>;

export const toolRegistryDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type ToolRegistryDeactivateRequestWire = z.infer<typeof toolRegistryDeactivateRequestWireSchema>;

export const nursingDischargeClosureWireSchema = z.object({
  "closure_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "closed_by": z.string().uuid(),
  "closed_at": z.string(),
}).strict();
export type NursingDischargeClosureWire = z.infer<typeof nursingDischargeClosureWireSchema>;

export const nursingDischargeClosureRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
}).strict();
export type NursingDischargeClosureRequestWire = z.infer<typeof nursingDischargeClosureRequestWireSchema>;

export const modelEvaluationWireSchema = z.object({
  "model_evaluation_id": z.string().uuid(),
  "model_deployment_id": z.string().uuid(),
  "eval_name": z.string(),
  "score": z.number(),
  "threshold": z.number(),
  "status": z.enum(["PASSED","FAILED"]),
  "evaluated_at": z.string(),
  "evaluated_by": z.string().uuid(),
}).strict();
export type ModelEvaluationWire = z.infer<typeof modelEvaluationWireSchema>;

export const modelEvaluationRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "model_deployment_id": z.string().uuid(),
  "eval_name": z.string(),
  "score": z.number(),
  "threshold": z.number(),
  "evaluated_at": z.string(),
}).strict();
export type ModelEvaluationRecordRequestWire = z.infer<typeof modelEvaluationRecordRequestWireSchema>;

export const agentRunBudgetConsumptionWireSchema = z.object({
  "consumption_id": z.string().uuid(),
  "budget_id": z.string().uuid(),
  "run_id": z.string().uuid(),
  "tokens_consumed": z.number().int(),
  "duration_seconds": z.number().int(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type AgentRunBudgetConsumptionWire = z.infer<typeof agentRunBudgetConsumptionWireSchema>;

export const agentRunBudgetConsumptionRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "budget_id": z.string().uuid(),
  "run_id": z.string().uuid(),
  "tokens_consumed": z.number().int(),
  "duration_seconds": z.number().int(),
  "recorded_at": z.string(),
}).strict();
export type AgentRunBudgetConsumptionRecordRequestWire = z.infer<typeof agentRunBudgetConsumptionRecordRequestWireSchema>;

export const agentRunBudgetSummaryWireSchema = z.object({
  "budget_id": z.string().uuid(),
  "total_tokens": z.number().int(),
  "total_duration_seconds": z.number().int(),
  "max_tokens": z.number().int(),
  "max_duration_seconds": z.number().int(),
}).strict();
export type AgentRunBudgetSummaryWire = z.infer<typeof agentRunBudgetSummaryWireSchema>;

export const agentRunBudgetWireSchema = z.object({
  "budget_id": z.string().uuid(),
  "budget_code": z.string(),
  "budget_name": z.string(),
  "max_tokens": z.number().int(),
  "max_duration_seconds": z.number().int(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
}).strict();
export type AgentRunBudgetWire = z.infer<typeof agentRunBudgetWireSchema>;

export const agentRunBudgetDefineRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "budget_code": z.string(),
  "budget_name": z.string(),
  "max_tokens": z.number().int(),
  "max_duration_seconds": z.number().int(),
}).strict();
export type AgentRunBudgetDefineRequestWire = z.infer<typeof agentRunBudgetDefineRequestWireSchema>;

export const agentRunBudgetDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
}).strict();
export type AgentRunBudgetDeactivateRequestWire = z.infer<typeof agentRunBudgetDeactivateRequestWireSchema>;

export const emergencyNursingNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type EmergencyNursingNoteWire = z.infer<typeof emergencyNursingNoteWireSchema>;

export const emergencyNursingNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type EmergencyNursingNoteCreateRequestWire = z.infer<typeof emergencyNursingNoteCreateRequestWireSchema>;

export const emergencyPreadmissionWireSchema = z.object({
  "preadmission_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "temporary_identifier": z.string(),
  "reason": z.string(),
  "status": z.enum(["UNREGISTERED","REGISTERED"]),
  "registered_patient_id": z.string().uuid().nullable().optional(),
  "registered_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type EmergencyPreadmissionWire = z.infer<typeof emergencyPreadmissionWireSchema>;

export const emergencyPreadmissionRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "temporary_identifier": z.string(),
  "reason": z.string(),
}).strict();
export type EmergencyPreadmissionRegisterRequestWire = z.infer<typeof emergencyPreadmissionRegisterRequestWireSchema>;

export const emergencyPreadmissionLinkRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "registered_patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type EmergencyPreadmissionLinkRequestWire = z.infer<typeof emergencyPreadmissionLinkRequestWireSchema>;

export const encounterDomainSwitchWireSchema = z.object({
  "domain_switch_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "from_encounter_id": z.string().uuid(),
  "to_encounter_id": z.string().uuid(),
  "from_domain": z.enum(["OUTPATIENT","EMERGENCY"]),
  "to_domain": z.enum(["OUTPATIENT","EMERGENCY"]),
  "reason": z.string(),
  "switched_at": z.string(),
  "switched_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type EncounterDomainSwitchWire = z.infer<typeof encounterDomainSwitchWireSchema>;

export const encounterDomainSwitchRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "from_encounter_id": z.string().uuid(),
  "to_encounter_id": z.string().uuid(),
  "from_domain": z.enum(["OUTPATIENT","EMERGENCY"]),
  "to_domain": z.enum(["OUTPATIENT","EMERGENCY"]),
  "reason": z.string(),
  "switched_at": z.string(),
}).strict();
export type EncounterDomainSwitchRecordRequestWire = z.infer<typeof encounterDomainSwitchRecordRequestWireSchema>;

export const medicalRecordAssetWireSchema = z.object({
  "medical_record_asset_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid().nullable().optional(),
  "asset_type": z.enum(["PAPER","SCAN","DIGITAL"]),
  "location": z.string(),
  "content_hash": z.string(),
  "status": z.enum(["ARCHIVED","BORROWED"]),
  "borrowed_by": z.string().uuid().nullable().optional(),
  "borrowed_at": z.string().nullable().optional(),
  "due_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type MedicalRecordAssetWire = z.infer<typeof medicalRecordAssetWireSchema>;

export const medicalRecordAssetRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid().nullable().optional(),
  "asset_type": z.enum(["PAPER","SCAN","DIGITAL"]),
  "location": z.string(),
  "content_hash": z.string(),
}).strict();
export type MedicalRecordAssetRegisterRequestWire = z.infer<typeof medicalRecordAssetRegisterRequestWireSchema>;

export const medicalRecordAssetBorrowRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "due_at": z.string(),
}).strict();
export type MedicalRecordAssetBorrowRequestWire = z.infer<typeof medicalRecordAssetBorrowRequestWireSchema>;

export const medicalRecordAssetReturnRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type MedicalRecordAssetReturnRequestWire = z.infer<typeof medicalRecordAssetReturnRequestWireSchema>;

export const sourcePatientMatchCandidateWireSchema = z.object({
  "candidate_id": z.string().uuid(),
  "source_system_id": z.string().uuid(),
  "source_patient_identifier": z.string(),
  "display_name": z.string(),
  "sex_code": z.string(),
  "birth_date": z.string(),
  "matched_patient_id": z.string().uuid().nullable().optional(),
  "match_score": z.number(),
  "review_status": z.enum(["PENDING","RESOLVED"]),
  "resolved_by": z.string().uuid().nullable().optional(),
  "resolved_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type SourcePatientMatchCandidateWire = z.infer<typeof sourcePatientMatchCandidateWireSchema>;

export const sourcePatientMatchCandidateRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "source_system_id": z.string().uuid(),
  "source_patient_identifier": z.string(),
  "display_name": z.string(),
  "sex_code": z.string(),
  "birth_date": z.string(),
}).strict();
export type SourcePatientMatchCandidateRecordRequestWire = z.infer<typeof sourcePatientMatchCandidateRecordRequestWireSchema>;

export const sourcePatientMatchCandidateResolveRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "matched_patient_id": z.string().uuid().nullable().optional(),
}).strict();
export type SourcePatientMatchCandidateResolveRequestWire = z.infer<typeof sourcePatientMatchCandidateResolveRequestWireSchema>;

export const sourceFieldMappingWireSchema = z.object({
  "mapping_id": z.string().uuid(),
  "source_system_id": z.string().uuid(),
  "source_field": z.string(),
  "target_entity": z.string(),
  "target_field": z.string(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
  "registered_by": z.string().uuid(),
  "registered_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type SourceFieldMappingWire = z.infer<typeof sourceFieldMappingWireSchema>;

export const sourceFieldMappingRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "source_system_id": z.string().uuid(),
  "source_field": z.string(),
  "target_entity": z.string(),
  "target_field": z.string(),
  "registered_at": z.string(),
}).strict();
export type SourceFieldMappingRegisterRequestWire = z.infer<typeof sourceFieldMappingRegisterRequestWireSchema>;

export const sourceFieldMappingDeactivateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type SourceFieldMappingDeactivateRequestWire = z.infer<typeof sourceFieldMappingDeactivateRequestWireSchema>;

export const sourceSystemInventoryWireSchema = z.object({
  "source_system_id": z.string().uuid(),
  "source_code": z.string(),
  "display_name": z.string(),
  "system_type": z.enum(["EMR","LIS","PACS","PHARMACY","BILLING","OTHER"]),
  "connection_status": z.enum(["REGISTERED","CONFIGURED","ACTIVE","RETIRED"]),
  "registered_by": z.string().uuid(),
  "registered_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type SourceSystemInventoryWire = z.infer<typeof sourceSystemInventoryWireSchema>;

export const sourceSystemInventoryRegisterRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "source_code": z.string(),
  "display_name": z.string(),
  "system_type": z.enum(["EMR","LIS","PACS","PHARMACY","BILLING","OTHER"]),
  "registered_at": z.string(),
}).strict();
export type SourceSystemInventoryRegisterRequestWire = z.infer<typeof sourceSystemInventoryRegisterRequestWireSchema>;

export const sourceSystemInventoryTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type SourceSystemInventoryTransitionRequestWire = z.infer<typeof sourceSystemInventoryTransitionRequestWireSchema>;

export const historicalMigrationCheckpointWireSchema = z.object({
  "checkpoint_id": z.string().uuid(),
  "batch_id": z.string().uuid(),
  "processed_records": z.number().int(),
  "last_source_key": z.string().nullable().optional(),
  "checkpointed_by": z.string().uuid(),
  "checkpointed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type HistoricalMigrationCheckpointWire = z.infer<typeof historicalMigrationCheckpointWireSchema>;

export const historicalMigrationCheckpointRecordRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "batch_id": z.string().uuid(),
  "processed_records": z.number().int(),
  "last_source_key": z.string().nullable().optional(),
  "checkpointed_at": z.string(),
}).strict();
export type HistoricalMigrationCheckpointRecordRequestWire = z.infer<typeof historicalMigrationCheckpointRecordRequestWireSchema>;

export const historicalMigrationBatchWireSchema = z.object({
  "batch_id": z.string().uuid(),
  "source_system": z.string(),
  "batch_status": z.enum(["TRIAL","RECONCILED","SWITCHED","ROLLED_BACK"]),
  "record_count": z.number().int(),
  "mismatch_count": z.number().int(),
  "started_at": z.string(),
  "completed_at": z.string().nullable().optional(),
  "created_by": z.string().uuid(),
  "row_version": z.number().int(),
}).strict();
export type HistoricalMigrationBatchWire = z.infer<typeof historicalMigrationBatchWireSchema>;

export const historicalMigrationBatchStartRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "source_system": z.string(),
  "record_count": z.number().int(),
  "started_at": z.string(),
}).strict();
export type HistoricalMigrationBatchStartRequestWire = z.infer<typeof historicalMigrationBatchStartRequestWireSchema>;

export const historicalMigrationBatchReconcileRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "mismatch_count": z.number().int(),
  "expected_row_version": z.number().int(),
}).strict();
export type HistoricalMigrationBatchReconcileRequestWire = z.infer<typeof historicalMigrationBatchReconcileRequestWireSchema>;

export const historicalMigrationBatchSwitchRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type HistoricalMigrationBatchSwitchRequestWire = z.infer<typeof historicalMigrationBatchSwitchRequestWireSchema>;

export const historicalMigrationBatchRollbackRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type HistoricalMigrationBatchRollbackRequestWire = z.infer<typeof historicalMigrationBatchRollbackRequestWireSchema>;

export const nursingBedsideNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "note_type": z.enum(["VITAL_SIGNS","INTAKE_OUTPUT","NURSING_NOTE"]),
  "recorded_at": z.string(),
  "synced_at": z.string(),
  "device_id": z.string(),
  "content": z.string(),
  "row_version": z.number().int(),
}).strict();
export type NursingBedsideNoteWire = z.infer<typeof nursingBedsideNoteWireSchema>;

export const nursingBedsideNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "note_type": z.enum(["VITAL_SIGNS","INTAKE_OUTPUT","NURSING_NOTE"]),
  "recorded_at": z.string(),
  "synced_at": z.string(),
  "device_id": z.string(),
  "content": z.string(),
}).strict();
export type NursingBedsideNoteCreateRequestWire = z.infer<typeof nursingBedsideNoteCreateRequestWireSchema>;

export const clinicalTaskCollaborationRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "target_user_id": z.string().uuid(),
  "reason": z.string(),
  "valid_until": z.string().nullable().optional(),
}).strict();
export type ClinicalTaskCollaborationRequestWire = z.infer<typeof clinicalTaskCollaborationRequestWireSchema>;

export const clinicalTaskWireSchema = z.object({
  "task_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "source_type": z.enum(["ORDER_EXECUTION","CRITICAL_VALUE","DOCUMENT","CONSULTATION","PATHWAY","DISCHARGE_REMEDIATION","AI_APPROVAL"]),
  "source_id": z.string().uuid(),
  "task_type": z.string(),
  "title": z.string(),
  "risk_level": z.enum(["ROUTINE","HIGH","CRITICAL"]),
  "state": z.enum(["PENDING","ASSIGNED","DELIVERED","VIEWED","CLAIMED","IN_PROGRESS","COMPLETED","WITHDRAWN","EXPIRED","ESCALATED"]),
  "business_state": z.string(),
  "assigned_user_id": z.string().uuid().nullable().optional(),
  "claimed_by": z.string().uuid().nullable().optional(),
  "due_at": z.string().nullable().optional(),
  "source_route": z.string(),
  "row_version": z.number().int(),
  "data_watermark": z.string(),
}).strict();
export type ClinicalTaskWire = z.infer<typeof clinicalTaskWireSchema>;

export const patientSummaryWireSchema = z.object({
  "patient_id": z.string().uuid(),
  "display_name": z.string(),
  "sex_code": z.string(),
  "birth_date": z.string(),
  "row_version": z.number().int(),
}).strict();
export type PatientSummaryWire = z.infer<typeof patientSummaryWireSchema>;

export const encounterWireSchema = z.object({
  "encounter_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "department_id": z.string().uuid().nullable(),
  "responsible_user_id": z.string().uuid().nullable(),
  "encounter_type": z.enum(["OUTPATIENT","EMERGENCY","INPATIENT"]),
  "status": z.enum(["PLANNED","ARRIVED","IN_PROGRESS","SUSPENDED","FINISHED","CANCELLED"]),
  "started_at": z.string(),
  "ended_at": z.string().nullable(),
  "source_system": z.string().nullable(),
  "source_key": z.string().nullable(),
  "row_version": z.number().int(),
}).strict();
export type EncounterWire = z.infer<typeof encounterWireSchema>;

export const encounterStateEventWireSchema = z.object({
  "encounter_state_event_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "version_no": z.number().int(),
  "from_status": z.enum(["PLANNED","ARRIVED","IN_PROGRESS","SUSPENDED","FINISHED","CANCELLED"]).nullable(),
  "to_status": z.enum(["PLANNED","ARRIVED","IN_PROGRESS","SUSPENDED","FINISHED","CANCELLED"]),
  "occurred_at": z.string(),
  "reason": z.string().nullable(),
  "changed_by": z.string().uuid().nullable(),
  "created_at": z.string(),
}).strict();
export type EncounterStateEventWire = z.infer<typeof encounterStateEventWireSchema>;

export const documentVersionWireSchema = z.object({
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "template_version_id": z.string().uuid(),
  "template_version_no": z.number().int(),
  "version_no": z.number().int(),
  "status": z.enum(["DRAFT","READY_TO_SIGN","SIGNED","CORRECTED","VOID"]),
  "document_type_code": z.string().optional(),
  "sections": z.record(z.string(), z.unknown()).optional(),
  "content_hash": z.string(),
  "row_version": z.number().int(),
  "created_at": z.string(),
}).strict();
export type DocumentVersionWire = z.infer<typeof documentVersionWireSchema>;

export const documentCorrectionPropagationWireSchema = z.object({
  "propagation_id": z.string().uuid(),
  "destination_code": z.string(),
  "status": z.enum(["PENDING","SUCCEEDED","FAILED"]),
  "attempt_count": z.number().int(),
  "last_error_code": z.string().nullable().optional(),
  "last_attempt_at": z.string().nullable().optional(),
  "delivered_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
  "created_at": z.string(),
}).strict();
export type DocumentCorrectionPropagationWire = z.infer<typeof documentCorrectionPropagationWireSchema>;

export const documentCorrectionWireSchema = z.object({
  "correction_id": z.string().uuid(),
  "document_id": z.string().uuid(),
  "source_document_version_id": z.string().uuid(),
  "correction_document_version_id": z.string().uuid(),
  "correction_type": z.enum(["CORRECTION","ADDENDUM"]),
  "reason": z.string(),
  "status": z.enum(["DRAFT","SIGNED","VOID"]),
  "requested_by": z.string().uuid(),
  "requested_at": z.string(),
  "signed_at": z.string().nullable().optional(),
  "propagations": z.array(documentCorrectionPropagationWireSchema),
}).strict();
export type DocumentCorrectionWire = z.infer<typeof documentCorrectionWireSchema>;

export const signatureRevocationEvidenceWireSchema = z.object({
  "revocation_id": z.string().uuid(),
  "signature_id": z.string().uuid(),
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "reason": z.string(),
  "revoked_by": z.string().uuid(),
  "revoked_at": z.string(),
}).strict();
export type SignatureRevocationEvidenceWire = z.infer<typeof signatureRevocationEvidenceWireSchema>;

export const qualityFindingWireSchema = z.object({
  "finding_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "rule_code": z.string(),
  "severity": z.enum(["INFO","WARNING","BLOCKING"]),
  "message": z.string(),
  "field_path": z.string().nullable().optional(),
  "state": z.enum(["OPEN","ACKNOWLEDGED","RESOLVED","WAIVED"]),
}).strict();
export type QualityFindingWire = z.infer<typeof qualityFindingWireSchema>;

export const signatureEvidenceWireSchema = z.object({
  "signature_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "signer_user_id": z.string().uuid(),
  "signed_at": z.string(),
  "content_hash": z.string(),
  "signature_status": z.enum(["VALID","PENDING_CA_EVIDENCE","REVOKED"]),
}).strict();
export type SignatureEvidenceWire = z.infer<typeof signatureEvidenceWireSchema>;

export const qualityFindingEvidenceWireSchema = z.object({
  "finding_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "rule_code": z.string(),
  "rule_version": z.string(),
  "severity": z.enum(["INFO","WARNING","BLOCKING"]),
  "message": z.string(),
  "field_path": z.string().nullable().optional(),
  "state": z.enum(["OPEN","ACKNOWLEDGED","RESOLVED","WAIVED"]),
  "resolution_reason": z.string().nullable().optional(),
  "row_version": z.number().int(),
  "created_at": z.string(),
  "updated_at": z.string(),
}).strict();
export type QualityFindingEvidenceWire = z.infer<typeof qualityFindingEvidenceWireSchema>;

export const documentQualityRunEvidenceWireSchema = z.object({
  "quality_run_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "rule_version": z.string(),
  "outcome": z.enum(["PASSED","WARNING","BLOCKED"]),
  "finding_count": z.number().int(),
  "blocking_count": z.number().int(),
  "warning_count": z.number().int(),
  "content_hash": z.string(),
  "source_watermark": z.string(),
  "executed_by": z.string().uuid(),
  "executed_at": z.string(),
}).strict();
export type DocumentQualityRunEvidenceWire = z.infer<typeof documentQualityRunEvidenceWireSchema>;

export const signatureEvidenceDetailWireSchema = z.object({
  "signature_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "signer_user_id": z.string().uuid(),
  "signer_display_name": z.string(),
  "signature_role": z.enum(["AUTHOR","ATTENDING","CHIEF","MEDICAL_RECORDS"]),
  "signed_at": z.string(),
  "content_hash": z.string(),
  "signature_status": z.enum(["VALID","PENDING_CA_EVIDENCE","REVOKED"]),
  "credential_ref": z.string().nullable().optional(),
}).strict();
export type SignatureEvidenceDetailWire = z.infer<typeof signatureEvidenceDetailWireSchema>;

export const signaturePolicyEvidenceWireSchema = z.object({
  "required_signature_level": z.enum(["AUTHOR","ATTENDING","CHIEF","MEDICAL_RECORDS"]),
  "current_signature_level": z.enum(["AUTHOR","ATTENDING","CHIEF","MEDICAL_RECORDS"]).nullable().optional(),
  "review_status": z.enum(["PENDING","IN_REVIEW","COMPLETED","REJECTED"]),
  "requires_distinct_signers": z.boolean(),
  "row_version": z.number().int(),
}).strict();
export type SignaturePolicyEvidenceWire = z.infer<typeof signaturePolicyEvidenceWireSchema>;

export const reviewDecisionEvidenceWireSchema = z.object({
  "review_decision_id": z.string().uuid(),
  "decision": z.literal("REJECTED"),
  "decision_level": z.enum(["ATTENDING","CHIEF","MEDICAL_RECORDS"]),
  "reason": z.string(),
  "actor_user_id": z.string().uuid(),
  "actor_display_name": z.string(),
  "decided_at": z.string(),
}).strict();
export type ReviewDecisionEvidenceWire = z.infer<typeof reviewDecisionEvidenceWireSchema>;

export const documentGovernanceSnapshotWireSchema = z.object({
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "document_status": z.enum(["DRAFT","READY_TO_SIGN","SIGNED","CORRECTED","VOID"]),
  "content_hash": z.string(),
  "quality_run": documentQualityRunEvidenceWireSchema.nullable().optional(),
  "quality_findings": z.array(qualityFindingEvidenceWireSchema),
  "signatures": z.array(signatureEvidenceDetailWireSchema),
  "signature_policy": signaturePolicyEvidenceWireSchema.nullable().optional(),
  "review_decisions": z.array(reviewDecisionEvidenceWireSchema),
  "data_watermark": z.string(),
}).strict();
export type DocumentGovernanceSnapshotWire = z.infer<typeof documentGovernanceSnapshotWireSchema>;

export const inpatientAdmissionCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "ward_id": z.string().uuid(),
  "bed_id": z.string().uuid(),
  "attending_user_id": z.string().uuid(),
  "admitted_at": z.string(),
}).strict();
export type InpatientAdmissionCreateRequestWire = z.infer<typeof inpatientAdmissionCreateRequestWireSchema>;

export const inpatientAdmissionWireSchema = z.object({
  "admission_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "ward_id": z.string().uuid(),
  "bed_id": z.string().uuid(),
  "attending_user_id": z.string().uuid(),
  "status": z.enum(["ADMITTED","TRANSFER_PENDING","DISCHARGE_PENDING","DISCHARGED","CANCELLED"]),
  "admitted_at": z.string(),
  "discharged_at": z.string().nullable().optional(),
  "row_version": z.number().int(),
}).strict();
export type InpatientAdmissionWire = z.infer<typeof inpatientAdmissionWireSchema>;

export const inpatientDocumentTaskWireSchema = z.object({
  "task_id": z.string().uuid(),
  "admission_id": z.string().uuid(),
  "document_type_code": z.string(),
  "task_state": z.enum(["PENDING","IN_PROGRESS","COMPLETED","WAIVED","OVERDUE"]),
  "due_at": z.string(),
  "working_document_id": z.string().uuid().nullable(),
  "completed_document_id": z.string().uuid().nullable().optional(),
  "required_signature_level": z.enum(["AUTHOR","ATTENDING","CHIEF","MEDICAL_RECORDS"]),
  "current_signature_level": z.enum(["AUTHOR","ATTENDING","CHIEF","MEDICAL_RECORDS"]).nullable().optional(),
  "next_signature_level": z.enum(["AUTHOR","ATTENDING","CHIEF","MEDICAL_RECORDS"]).nullable().optional(),
  "review_status": z.enum(["NOT_STARTED","PENDING","IN_REVIEW","COMPLETED","REJECTED"]),
  "row_version": z.number().int(),
}).strict();
export type InpatientDocumentTaskWire = z.infer<typeof inpatientDocumentTaskWireSchema>;

export const inpatientDocumentStartRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "admission_id": z.string().uuid(),
  "expected_task_row_version": z.number().int(),
  "sections": z.record(z.string(), z.unknown()),
}).strict();
export type InpatientDocumentStartRequestWire = z.infer<typeof inpatientDocumentStartRequestWireSchema>;

export const inpatientTransferRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "target_ward_id": z.string().uuid(),
  "target_bed_id": z.string().uuid(),
  "expected_admission_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type InpatientTransferRequestWire = z.infer<typeof inpatientTransferRequestWireSchema>;

export const inpatientDischargeRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_admission_row_version": z.number().int(),
  "discharge_diagnosis": z.string(),
  "disposition_code": z.enum(["HOME","TRANSFER_TO_FACILITY","DEATH","OTHER"]),
  "outstanding_task_waiver_reason": z.string().nullable().optional(),
}).strict();
export type InpatientDischargeRequestWire = z.infer<typeof inpatientDischargeRequestWireSchema>;

export const inpatientDocumentRuleWireSchema = z.object({
  "rule_code": z.string(),
  "document_type_code": z.string(),
  "display_name": z.string(),
  "category_code": z.enum(["ADMISSION","COURSE","ROUND","CONSULTATION","PERIOPERATIVE","EVENT","TERMINAL"]),
  "trigger_type": z.enum(["ADMISSION","DAILY","EVENT","DISCHARGE","MANUAL"]),
  "due_minutes": z.number().int(),
  "required_signature_level": z.enum(["AUTHOR","ATTENDING","CHIEF","MEDICAL_RECORDS"]),
  "template_sections": z.array(z.string()),
  "rule_version": z.number().int(),
}).strict();
export type InpatientDocumentRuleWire = z.infer<typeof inpatientDocumentRuleWireSchema>;

export const inpatientDocumentTaskCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "rule_code": z.string(),
  "event_occurred_at": z.string(),
  "occurrence_key": z.string(),
  "source_event_id": z.string().uuid().nullable().optional(),
}).strict();
export type InpatientDocumentTaskCreateRequestWire = z.infer<typeof inpatientDocumentTaskCreateRequestWireSchema>;

export const inpatientClinicalEventCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "event_type": z.enum(["CONSULTATION_REQUESTED","PREOPERATIVE_DECISION","OPERATION_COMPLETED","RESCUE_COMPLETED","TRANSFUSION_COMPLETED","CRITICAL_ILLNESS_DECLARED","DEATH_CONFIRMED"]),
  "occurred_at": z.string(),
  "summary": z.string(),
  "source_system": z.string(),
  "source_event_key": z.string(),
}).strict();
export type InpatientClinicalEventCreateRequestWire = z.infer<typeof inpatientClinicalEventCreateRequestWireSchema>;

export const inpatientClinicalEventWireSchema = z.object({
  "clinical_event_id": z.string().uuid(),
  "admission_id": z.string().uuid(),
  "event_type": z.enum(["CONSULTATION_REQUESTED","PREOPERATIVE_DECISION","OPERATION_COMPLETED","RESCUE_COMPLETED","TRANSFUSION_COMPLETED","CRITICAL_ILLNESS_DECLARED","DEATH_CONFIRMED"]),
  "occurred_at": z.string(),
  "summary": z.string(),
  "document_task_id": z.string().uuid(),
}).strict();
export type InpatientClinicalEventWire = z.infer<typeof inpatientClinicalEventWireSchema>;

export const inpatientOverviewWireSchema = z.object({
  "admission": inpatientAdmissionWireSchema,
  "patient_display_name": z.string(),
  "ward_display_name": z.string(),
  "bed_label": z.string(),
  "document_tasks": z.array(inpatientDocumentTaskWireSchema),
  "data_watermark": z.string(),
}).strict();
export type InpatientOverviewWire = z.infer<typeof inpatientOverviewWireSchema>;

export const inpatientWorklistItemWireSchema = z.object({
  "admission_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "patient_display_name": z.string(),
  "bed_label": z.string(),
  "attending_user_id": z.string().uuid(),
  "admitted_at": z.string(),
  "overdue_task_count": z.number().int(),
  "pending_task_count": z.number().int(),
  "row_version": z.number().int(),
}).strict();
export type InpatientWorklistItemWire = z.infer<typeof inpatientWorklistItemWireSchema>;

export const inpatientBedBoardItemWireSchema = z.object({
  "bed_id": z.string().uuid(),
  "ward_id": z.string().uuid(),
  "bed_label": z.string(),
  "bed_status": z.enum(["ACTIVE","INACTIVE"]),
  "occupancy_status": z.enum(["AVAILABLE","OCCUPIED"]),
  "admission_id": z.string().uuid().nullable().optional(),
  "encounter_id": z.string().uuid().nullable().optional(),
  "patient_id": z.string().uuid().nullable().optional(),
  "patient_display_name": z.string().nullable().optional(),
  "attending_user_id": z.string().uuid().nullable().optional(),
  "admitted_at": z.string().nullable().optional(),
  "admission_row_version": z.number().int().nullable().optional(),
}).strict();
export type InpatientBedBoardItemWire = z.infer<typeof inpatientBedBoardItemWireSchema>;

export const specialtyPackReleaseWireSchema = z.object({
  "specialty_pack_release_id": z.string().uuid(),
  "pack_code": z.string(),
  "semantic_version": z.string(),
  "content_hash": z.string(),
  "lifecycle_status": z.enum(["DRAFT","VALIDATED","APPROVED","CANARY","ACTIVE","RETIRED","ROLLED_BACK"]),
  "compatibility_range": z.record(z.string(), z.unknown()),
  "created_at": z.string(),
}).strict();
export type SpecialtyPackReleaseWire = z.infer<typeof specialtyPackReleaseWireSchema>;

export const departmentSupportAssessmentPutRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "support_level": z.enum(["GENERAL_AVAILABLE","BASIC_CLOSED_LOOP","PACK_PENDING","UNSUPPORTED"]),
  "pack_release_id": z.string().uuid().nullable().optional(),
  "evidence_bundle_hash": z.string().nullable().optional(),
  "missing_safety_gates": z.array(z.string()),
  "expires_at": z.string().nullable().optional(),
  "expected_row_version": z.number().int(),
}).strict();
export type DepartmentSupportAssessmentPutRequestWire = z.infer<typeof departmentSupportAssessmentPutRequestWireSchema>;

export const departmentSupportAssessmentWireSchema = z.object({
  "department_support_assessment_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "department_id": z.string().uuid(),
  "clinical_scope_code": z.string(),
  "support_level": z.enum(["GENERAL_AVAILABLE","BASIC_CLOSED_LOOP","PACK_PENDING","UNSUPPORTED"]),
  "pack_release_id": z.string().uuid().nullable(),
  "evidence_bundle_hash": z.string().nullable(),
  "missing_safety_gates": z.array(z.string()),
  "assessed_by": z.string().uuid(),
  "assessed_at": z.string(),
  "expires_at": z.string().nullable(),
  "row_version": z.number().int(),
}).strict();
export type DepartmentSupportAssessmentWire = z.infer<typeof departmentSupportAssessmentWireSchema>;

export const contextReferenceWireSchema = z.object({
  "reference_id": z.string(),
  "source_type": z.enum(["DOCUMENT_VERSION","OBSERVATION","ORDER","GUIDELINE_CHUNK","RULE"]),
  "source_id": z.string().uuid(),
  "source_version": z.string(),
  "section_path": z.array(z.string()).optional(),
  "page": z.number().int().nullable().optional(),
  "paragraph": z.string().nullable().optional(),
  "field_path": z.string().nullable().optional(),
  "bbox": z.array(z.number()).min(4).max(4).nullable().optional(),
  "content_hash": z.string(),
  "excerpt": z.string(),
  "score": z.number(),
  "retrieval_method": z.array(z.enum(["SQL","BM25","DENSE","GRAPH"])),
  "authorization_watermark": z.string(),
  "retrieved_at": z.string(),
}).strict();
export type ContextReferenceWire = z.infer<typeof contextReferenceWireSchema>;

export const aiProposalWireSchema = z.object({
  "proposal_id": z.string().uuid(),
  "run_id": z.string().uuid(),
  "proposal_type": z.string(),
  "status": z.enum(["PENDING_REVIEW","ACCEPTED","MODIFIED","REJECTED","EXPIRED"]),
  "payload": z.record(z.string(), z.unknown()),
  "references": z.array(contextReferenceWireSchema),
  "expires_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type AIProposalWire = z.infer<typeof aiProposalWireSchema>;

export const aiRunSnapshotWireSchema = z.object({
  "run_id": z.string().uuid(),
  "context_lease_id": z.string().uuid(),
  "state": z.enum(["CREATED","ROUTING","RETRIEVING","PLANNING","WAITING_APPROVAL","GENERATING","VERIFYING","READY_FOR_REVIEW","ACCEPTED","REJECTED","EXPIRED","RETRYING","DEGRADED","RECONCILING","COMPLETED","FAILED","BLOCKED","CANCELLED"]),
  "sequence": z.number().int(),
  "data_watermark": z.string(),
  "created_at": z.string(),
  "updated_at": z.string(),
  "proposals": z.array(aiProposalWireSchema),
}).strict();
export type AIRunSnapshotWire = z.infer<typeof aiRunSnapshotWireSchema>;

export const aiRunCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "context_lease_id": z.string().uuid(),
  "use_case_code": z.string(),
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
}).strict();
export type AIRunCreateRequestWire = z.infer<typeof aiRunCreateRequestWireSchema>;

export const archiveBlockerWireSchema = z.object({
  "code": z.string(),
  "message": z.string(),
  "document_id": z.string().uuid().nullable(),
}).strict();
export type ArchiveBlockerWire = z.infer<typeof archiveBlockerWireSchema>;

export const archiveCaseItemWireSchema = z.object({
  "archive_case_item_id": z.string().uuid(),
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "document_type_code": z.string(),
  "content_hash": z.string(),
  "signature_summary_hash": z.string(),
  "item_order": z.number().int(),
}).strict();
export type ArchiveCaseItemWire = z.infer<typeof archiveCaseItemWireSchema>;

export const archiveEventWireSchema = z.object({
  "archive_case_event_id": z.string().uuid(),
  "event_no": z.number().int(),
  "event_type": z.enum(["ARCHIVED","SEALED","UNSEALED","EXPORT_CREATED"]),
  "actor_user_id": z.string().uuid(),
  "actor_display_name": z.string(),
  "reason": z.string().nullable(),
  "occurred_at": z.string(),
}).strict();
export type ArchiveEventWire = z.infer<typeof archiveEventWireSchema>;

export const archiveExportPackageWireSchema = z.object({
  "export_package_id": z.string().uuid(),
  "archive_case_id": z.string().uuid(),
  "purpose": z.string(),
  "output_format": z.literal("JSON"),
  "status": z.literal("READY"),
  "content_hash": z.string(),
  "byte_count": z.number().int(),
  "created_by": z.string().uuid(),
  "created_at": z.string(),
  "download_path": z.string(),
}).strict();
export type ArchiveExportPackageWire = z.infer<typeof archiveExportPackageWireSchema>;

export const archiveCaseWireSchema = z.object({
  "archive_case_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "archive_no": z.string(),
  "status": z.enum(["ARCHIVED","SEALED","UNSEALED"]),
  "manifest_hash": z.string(),
  "archived_by": z.string().uuid(),
  "archived_at": z.string(),
  "sealed_by": z.string().uuid().nullable(),
  "sealed_at": z.string().nullable(),
  "unsealed_by": z.string().uuid().nullable(),
  "unsealed_at": z.string().nullable(),
  "unseal_reason": z.string().nullable(),
  "row_version": z.number().int(),
  "items": z.array(archiveCaseItemWireSchema),
  "events": z.array(archiveEventWireSchema),
  "export_packages": z.array(archiveExportPackageWireSchema),
  "data_watermark": z.string(),
}).strict();
export type ArchiveCaseWire = z.infer<typeof archiveCaseWireSchema>;

export const archiveReadinessWireSchema = z.object({
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "encounter_status": z.enum(["PLANNED","IN_PROGRESS","FINISHED","CANCELLED"]),
  "document_count": z.number().int(),
  "ready": z.boolean(),
  "blockers": z.array(archiveBlockerWireSchema),
  "archive_case": archiveCaseWireSchema.nullable(),
}).strict();
export type ArchiveReadinessWire = z.infer<typeof archiveReadinessWireSchema>;

export const archiveCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
}).strict();
export type ArchiveCreateRequestWire = z.infer<typeof archiveCreateRequestWireSchema>;

export const archiveTransitionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type ArchiveTransitionRequestWire = z.infer<typeof archiveTransitionRequestWireSchema>;

export const archiveExportCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "purpose": z.string(),
  "output_format": z.literal("JSON"),
}).strict();
export type ArchiveExportCreateRequestWire = z.infer<typeof archiveExportCreateRequestWireSchema>;

export const aiProposalDecisionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "decision": z.enum(["ACCEPTED","MODIFIED","REJECTED"]),
  "reason": z.string().nullable().optional(),
}).strict();
export type AIProposalDecisionRequestWire = z.infer<typeof aiProposalDecisionRequestWireSchema>;

export const organizationUnitWireSchema = z.object({
  "unit_type": z.enum(["ORGANIZATION","FACILITY","DEPARTMENT","WARD","BED"]),
  "unit_id": z.string().uuid(),
  "parent_unit_id": z.string().uuid().nullable(),
  "unit_code": z.string(),
  "display_name": z.string(),
  "status": z.enum(["ACTIVE","INACTIVE"]),
  "effective_from": z.string(),
  "effective_until": z.string().nullable(),
  "row_version": z.number().int(),
}).strict();
export type OrganizationUnitWire = z.infer<typeof organizationUnitWireSchema>;

export const organizationUnitCreateRequestWireSchema = z.object({
  "unit_type": z.enum(["ORGANIZATION","FACILITY","DEPARTMENT","WARD","BED"]),
  "unit_id": z.string().uuid(),
  "parent_unit_id": z.string().uuid().optional(),
  "organization_id": z.string().uuid().optional(),
  "facility_id": z.string().uuid().optional(),
  "department_id": z.string().uuid().optional(),
  "unit_code": z.string(),
  "display_name": z.string(),
  "subtype": z.string().optional(),
  "effective_from": z.string(),
  "effective_until": z.string().optional(),
}).strict();
export type OrganizationUnitCreateRequestWire = z.infer<typeof organizationUnitCreateRequestWireSchema>;

export const organizationUnitDeactivateRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "effective_until": z.string(),
  "reason": z.string(),
}).strict();
export type OrganizationUnitDeactivateRequestWire = z.infer<typeof organizationUnitDeactivateRequestWireSchema>;

export const workforceIdentityWireSchema = z.object({
  "person_id": z.string().uuid(),
  "person_code": z.string(),
  "person_display_name": z.string(),
  "person_status": z.enum(["ACTIVE","INACTIVE"]),
  "person_row_version": z.number().int(),
  "user_id": z.string().uuid().nullable(),
  "external_subject": z.string().nullable(),
  "account_status": z.string().nullable(),
  "account_row_version": z.number().int(),
  "role_assignment_id": z.string().uuid().nullable(),
  "role_code": z.string().nullable(),
  "role_status": z.string().nullable(),
  "role_valid_from": z.string().nullable(),
  "role_valid_until": z.string().nullable(),
  "role_row_version": z.number().int(),
  "organization_id": z.string().uuid().nullable(),
  "facility_id": z.string().uuid().nullable(),
  "department_id": z.string().uuid().nullable(),
  "ward_id": z.string().uuid().nullable(),
  "position_code": z.string().nullable(),
  "active_credential_count": z.number().int(),
}).strict();
export type WorkforceIdentityWire = z.infer<typeof workforceIdentityWireSchema>;

export const workforceOnboardingRequestWireSchema = z.object({
  "person_id": z.string().uuid(),
  "person_code": z.string(),
  "display_name": z.string(),
  "user_id": z.string().uuid(),
  "external_subject": z.string(),
  "role_assignment_id": z.string().uuid(),
  "role_code": z.string(),
  "position_code": z.string(),
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "department_id": z.string().uuid().optional(),
  "ward_id": z.string().uuid().optional(),
  "valid_from": z.string(),
  "valid_until": z.string().optional(),
  "credential_id": z.string().uuid().optional(),
  "credential_type": z.string().optional(),
  "registration_number": z.string().optional(),
  "issuing_authority": z.string().optional(),
  "practice_scope": z.record(z.string(), z.unknown()).optional(),
}).strict();
export type WorkforceOnboardingRequestWire = z.infer<typeof workforceOnboardingRequestWireSchema>;

export const accountDeactivateRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type AccountDeactivateRequestWire = z.infer<typeof accountDeactivateRequestWireSchema>;

export const roleEndRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "effective_until": z.string(),
  "reason": z.string(),
}).strict();
export type RoleEndRequestWire = z.infer<typeof roleEndRequestWireSchema>;

export const authorizationPolicyWireSchema = z.object({
  "policy_id": z.string().uuid(),
  "policy_code": z.string(),
  "version_no": z.number().int(),
  "effect": z.enum(["ALLOW","DENY"]),
  "status": z.enum(["DRAFT","PUBLISHED","RETIRED"]),
  "subject_role_code": z.string().nullable(),
  "resource_type": z.string(),
  "action_code": z.string(),
  "organization_id": z.string().uuid().nullable(),
  "facility_id": z.string().uuid().nullable(),
  "department_id": z.string().uuid().nullable(),
  "ward_id": z.string().uuid().nullable(),
  "patient_relationship_required": z.boolean(),
  "relationship_types": z.array(z.string()),
  "resource_statuses": z.array(z.string()),
  "purpose_codes": z.array(z.string()),
  "emergency_override_allowed": z.boolean(),
  "priority": z.number().int(),
  "valid_from": z.string(),
  "valid_until": z.string().nullable(),
  "created_by": z.string().uuid(),
  "approved_by": z.string().uuid().nullable(),
  "published_at": z.string().nullable(),
  "row_version": z.number().int(),
}).strict();
export type AuthorizationPolicyWire = z.infer<typeof authorizationPolicyWireSchema>;

export const authorizationPolicyCreateRequestWireSchema = z.object({
  "policy_id": z.string().uuid().optional(),
  "policy_code": z.string(),
  "version_no": z.number().int(),
  "effect": z.enum(["ALLOW","DENY"]),
  "subject_role_code": z.string().optional(),
  "resource_type": z.string(),
  "action_code": z.string(),
  "organization_id": z.string().uuid().optional(),
  "facility_id": z.string().uuid().optional(),
  "department_id": z.string().uuid().optional(),
  "ward_id": z.string().uuid().optional(),
  "patient_relationship_required": z.boolean(),
  "relationship_types": z.array(z.string()),
  "resource_statuses": z.array(z.string()),
  "purpose_codes": z.array(z.string()),
  "emergency_override_allowed": z.boolean(),
  "priority": z.number().int(),
  "valid_from": z.string(),
  "valid_until": z.string().optional(),
}).strict();
export type AuthorizationPolicyCreateRequestWire = z.infer<typeof authorizationPolicyCreateRequestWireSchema>;

export const authorizationPolicyPublishRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
}).strict();
export type AuthorizationPolicyPublishRequestWire = z.infer<typeof authorizationPolicyPublishRequestWireSchema>;

export const authorizationSimulationRequestWireSchema = z.object({
  "target_user_id": z.string().uuid(),
  "target_role_assignment_ids": z.array(z.string().uuid()).min(1),
  "resource_type": z.string(),
  "action_code": z.string(),
  "organization_id": z.string().uuid().optional(),
  "facility_id": z.string().uuid().optional(),
  "department_id": z.string().uuid().optional(),
  "ward_id": z.string().uuid().optional(),
  "patient_id": z.string().uuid().optional(),
  "encounter_id": z.string().uuid().optional(),
  "purpose_code": z.string().optional(),
  "resource_status": z.string().optional(),
}).strict();
export type AuthorizationSimulationRequestWire = z.infer<typeof authorizationSimulationRequestWireSchema>;

export const authorizationDecisionWireSchema = z.object({
  "allowed": z.boolean(),
  "reason_code": z.string(),
  "matched_policy_ids": z.array(z.string().uuid()),
  "emergency_access_grant_id": z.string().uuid().nullable(),
  "explanation": z.string(),
}).strict();
export type AuthorizationDecisionWire = z.infer<typeof authorizationDecisionWireSchema>;

export const emergencyAccessRequestWireSchema = z.object({
  "role_assignment_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid().optional(),
  "resource_types": z.array(z.string()).min(1),
  "action_codes": z.array(z.string()).min(1),
  "reason": z.string(),
  "duration_minutes": z.number().int(),
  "risk_acknowledged": z.boolean(),
}).strict();
export type EmergencyAccessRequestWire = z.infer<typeof emergencyAccessRequestWireSchema>;

export const emergencyAccessReviewRequestWireSchema = z.object({
  "expected_row_version": z.number().int(),
  "outcome": z.enum(["APPROPRIATE","INAPPROPRIATE","ESCALATED"]),
  "note": z.string().optional(),
}).strict();
export type EmergencyAccessReviewRequestWire = z.infer<typeof emergencyAccessReviewRequestWireSchema>;

export const emergencyAccessGrantWireSchema = z.object({
  "emergency_access_grant_id": z.string().uuid(),
  "user_id": z.string().uuid(),
  "role_assignment_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid().nullable(),
  "resource_types": z.array(z.string()),
  "action_codes": z.array(z.string()),
  "reason": z.string(),
  "status": z.enum(["ACTIVE","EXPIRED","REVOKED","REVIEWED"]),
  "requested_at": z.string(),
  "expires_at": z.string(),
  "reviewed_by": z.string().uuid().nullable(),
  "reviewed_at": z.string().nullable(),
  "review_outcome": z.string().nullable(),
  "review_note": z.string().nullable(),
  "row_version": z.number().int(),
}).strict();
export type EmergencyAccessGrantWire = z.infer<typeof emergencyAccessGrantWireSchema>;

export const documentAttachmentCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "original_filename": z.string(),
  "media_type": z.string(),
  "content_base64": z.string(),
  "expected_sha256": z.string().nullable().optional(),
  "target_field_path": z.string(),
}).strict();
export type DocumentAttachmentCreateRequestWire = z.infer<typeof documentAttachmentCreateRequestWireSchema>;

export const documentSourceReferenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "source_type": z.enum(["DIAGNOSIS","ORDER","RESULT","ATTACHMENT"]),
  "source_resource_id": z.string().uuid(),
  "target_field_path": z.string(),
  "excerpt": z.string().nullable().optional(),
}).strict();
export type DocumentSourceReferenceCreateRequestWire = z.infer<typeof documentSourceReferenceCreateRequestWireSchema>;

export const documentAttachmentWireSchema = z.object({
  "attachment_id": z.string().uuid(),
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "original_filename": z.string(),
  "media_type": z.string(),
  "byte_size": z.number().int(),
  "content_hash": z.string(),
  "storage_status": z.enum(["AVAILABLE","QUARANTINED","REJECTED","MISSING"]),
  "malware_scan_status": z.enum(["PASSED","PENDING","FAILED","UNAVAILABLE"]),
  "uploaded_by": z.string().uuid(),
  "created_at": z.string(),
}).strict();
export type DocumentAttachmentWire = z.infer<typeof documentAttachmentWireSchema>;

export const documentSourceReferenceWireSchema = z.object({
  "source_reference_id": z.string().uuid(),
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "source_type": z.enum(["DIAGNOSIS","ORDER","RESULT","ATTACHMENT"]),
  "source_resource_id": z.string().uuid(),
  "source_version_ref": z.string(),
  "current_version_ref": z.string().nullable(),
  "freshness": z.enum(["CURRENT","STALE","MISSING"]),
  "target_field_path": z.string(),
  "display_label": z.string(),
  "excerpt_hash": z.string().nullable(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
}).strict();
export type DocumentSourceReferenceWire = z.infer<typeof documentSourceReferenceWireSchema>;

export const documentSourceBundleWireSchema = z.object({
  "document_id": z.string().uuid(),
  "document_version_id": z.string().uuid(),
  "attachments": z.array(documentAttachmentWireSchema),
  "references": z.array(documentSourceReferenceWireSchema),
  "data_watermark": z.string(),
}).strict();
export type DocumentSourceBundleWire = z.infer<typeof documentSourceBundleWireSchema>;

export const inpatientConsultationCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "requested_department": z.string(),
  "urgency": z.enum(["ROUTINE","URGENT","EMERGENCY"]),
  "reason": z.string(),
  "clinical_question": z.string(),
  "due_at": z.string(),
}).strict();
export type InpatientConsultationCreateRequestWire = z.infer<typeof inpatientConsultationCreateRequestWireSchema>;

export const inpatientConsultationActionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type InpatientConsultationActionRequestWire = z.infer<typeof inpatientConsultationActionRequestWireSchema>;

export const inpatientConsultationRejectRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "reason": z.string(),
}).strict();
export type InpatientConsultationRejectRequestWire = z.infer<typeof inpatientConsultationRejectRequestWireSchema>;

export const inpatientConsultationOpinionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "opinion": z.string(),
  "recommendation": z.string(),
}).strict();
export type InpatientConsultationOpinionRequestWire = z.infer<typeof inpatientConsultationOpinionRequestWireSchema>;

export const inpatientConsultationWireSchema = z.object({
  "consultation_id": z.string().uuid(),
  "admission_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "requested_department": z.string(),
  "urgency": z.enum(["ROUTINE","URGENT","EMERGENCY"]),
  "reason": z.string(),
  "clinical_question": z.string(),
  "status": z.enum(["REQUESTED","ACCEPTED","REJECTED","OPINION_SIGNED","COMPLETED","CANCELLED"]),
  "due_at": z.string(),
  "requested_by": z.string().uuid(),
  "requested_at": z.string(),
  "accepted_by": z.string().uuid().nullable(),
  "accepted_at": z.string().nullable(),
  "rejection_reason": z.string().nullable(),
  "opinion": z.string().nullable(),
  "recommendation": z.string().nullable(),
  "opinion_signed_by": z.string().uuid().nullable(),
  "opinion_signed_at": z.string().nullable(),
  "completed_by": z.string().uuid().nullable(),
  "completed_at": z.string().nullable(),
  "overdue": z.boolean(),
  "row_version": z.number().int(),
  "data_watermark": z.string(),
}).strict();
export type InpatientConsultationWire = z.infer<typeof inpatientConsultationWireSchema>;

export const inpatientPathwayEnrollRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "pathway_version_id": z.string().uuid(),
  "admission_basis": z.string(),
}).strict();
export type InpatientPathwayEnrollRequestWire = z.infer<typeof inpatientPathwayEnrollRequestWireSchema>;

export const inpatientPathwayActionRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
}).strict();
export type InpatientPathwayActionRequestWire = z.infer<typeof inpatientPathwayActionRequestWireSchema>;

export const inpatientPathwayVarianceRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "variance_type": z.enum(["CONTRAINDICATION","RESOURCE_UNAVAILABLE","PATIENT_REFUSAL","DIAGNOSIS_CHANGED","TASK_FAILED","OTHER"]),
  "reason": z.string(),
  "disposition": z.enum(["CONTINUE","WAIVE_TASK","EXIT_PATHWAY"]),
  "affected_task_id": z.string().uuid().nullable().optional(),
}).strict();
export type InpatientPathwayVarianceRequestWire = z.infer<typeof inpatientPathwayVarianceRequestWireSchema>;

export const inpatientPathwayVarianceReviewRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "expected_row_version": z.number().int(),
  "decision": z.enum(["APPROVE","REJECT"]),
  "review_note": z.string(),
}).strict();
export type InpatientPathwayVarianceReviewRequestWire = z.infer<typeof inpatientPathwayVarianceReviewRequestWireSchema>;

export const inpatientPathwayCatalogItemWireSchema = z.object({
  "pathway_definition_id": z.string().uuid(),
  "pathway_version_id": z.string().uuid(),
  "pathway_code": z.string(),
  "display_name": z.string(),
  "specialty_code": z.string(),
  "diagnosis_code": z.string(),
  "version_no": z.number().int(),
  "admission_criteria": z.string(),
  "published_at": z.string(),
  "stage_count": z.number().int(),
  "task_count": z.number().int(),
}).strict();
export type InpatientPathwayCatalogItemWire = z.infer<typeof inpatientPathwayCatalogItemWireSchema>;

export const inpatientPathwayTaskWireSchema = z.object({
  "pathway_task_id": z.string().uuid(),
  "stage_code": z.string(),
  "task_code": z.string(),
  "display_name": z.string(),
  "source_type": z.enum(["DOCUMENT_TASK","ORDER_ITEM"]),
  "source_key": z.string(),
  "required": z.boolean(),
  "state": z.enum(["PENDING","COMPLETED","WAIVED"]),
  "source_resource_id": z.string().uuid().nullable(),
  "source_status": z.string().nullable(),
  "completed_at": z.string().nullable(),
  "waived_by_variance_id": z.string().uuid().nullable(),
}).strict();
export type InpatientPathwayTaskWire = z.infer<typeof inpatientPathwayTaskWireSchema>;

export const inpatientPathwayStageWireSchema = z.object({
  "stage_code": z.string(),
  "display_name": z.string(),
  "sequence_no": z.number().int(),
  "expected_day_start": z.number().int(),
  "expected_day_end": z.number().int(),
  "status": z.enum(["COMPLETED","CURRENT","UPCOMING"]),
  "required_task_count": z.number().int(),
  "completed_task_count": z.number().int(),
  "tasks": z.array(inpatientPathwayTaskWireSchema),
}).strict();
export type InpatientPathwayStageWire = z.infer<typeof inpatientPathwayStageWireSchema>;

export const inpatientPathwayVarianceWireSchema = z.object({
  "variance_id": z.string().uuid(),
  "variance_type": z.enum(["CONTRAINDICATION","RESOURCE_UNAVAILABLE","PATIENT_REFUSAL","DIAGNOSIS_CHANGED","TASK_FAILED","OTHER"]),
  "reason": z.string(),
  "disposition": z.enum(["CONTINUE","WAIVE_TASK","EXIT_PATHWAY"]),
  "affected_task_id": z.string().uuid().nullable(),
  "status": z.enum(["REQUESTED","APPROVED","REJECTED"]),
  "requested_by": z.string().uuid(),
  "requested_at": z.string(),
  "reviewed_by": z.string().uuid().nullable(),
  "reviewed_at": z.string().nullable(),
  "review_note": z.string().nullable(),
}).strict();
export type InpatientPathwayVarianceWire = z.infer<typeof inpatientPathwayVarianceWireSchema>;

export const inpatientPathwayInstanceWireSchema = z.object({
  "pathway_instance_id": z.string().uuid(),
  "admission_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "pathway_definition_id": z.string().uuid(),
  "pathway_version_id": z.string().uuid(),
  "pathway_code": z.string(),
  "display_name": z.string(),
  "version_no": z.number().int(),
  "status": z.enum(["ACTIVE","COMPLETED","EXITED"]),
  "current_stage_code": z.string(),
  "admission_basis": z.string(),
  "enrolled_by": z.string().uuid(),
  "enrolled_at": z.string(),
  "completed_by": z.string().uuid().nullable(),
  "completed_at": z.string().nullable(),
  "exited_by_variance_id": z.string().uuid().nullable(),
  "row_version": z.number().int(),
  "required_task_count": z.number().int(),
  "completed_task_count": z.number().int(),
  "completion_percent": z.number().int(),
  "stages": z.array(inpatientPathwayStageWireSchema),
  "variances": z.array(inpatientPathwayVarianceWireSchema),
  "data_watermark": z.string(),
}).strict();
export type InpatientPathwayInstanceWire = z.infer<typeof inpatientPathwayInstanceWireSchema>;

export const inpatientPathwayWorkspaceWireSchema = z.object({
  "catalog": z.array(inpatientPathwayCatalogItemWireSchema),
  "instance": inpatientPathwayInstanceWireSchema.nullable(),
}).strict();
export type InpatientPathwayWorkspaceWire = z.infer<typeof inpatientPathwayWorkspaceWireSchema>;

export const aiRunWireEventWireSchema = z.object({
  "schema_version": z.literal(1),
  "event_id": z.string(),
  "run_id": z.string().uuid(),
  "sequence": z.number().int(),
  "event_type": z.enum(["RUN_STATE_CHANGED","REFERENCE_ADDED","PROPOSAL_UPSERTED","VERIFICATION_UPDATED","SNAPSHOT_REQUIRED"]),
  "state": z.string().nullable().optional(),
  "occurred_at": z.string(),
  "data_watermark": z.string(),
  "context_lease_id": z.string().uuid(),
  "payload": z.record(z.string(), z.unknown()),
}).strict();
export type AIRunWireEventWire = z.infer<typeof aiRunWireEventWireSchema>;

export const tcmQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["HERBAL_PRESCRIPTION","FOUR_EXAMINATIONS"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type TcmQcReviewWire = z.infer<typeof tcmQcReviewWireSchema>;

export const tcmQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["HERBAL_PRESCRIPTION","FOUR_EXAMINATIONS"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type TcmQcReviewCreateRequestWire = z.infer<typeof tcmQcReviewCreateRequestWireSchema>;

export const reproductiveQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["ART_CYCLE","EMBRYO_TRANSFER"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ReproductiveQcReviewWire = z.infer<typeof reproductiveQcReviewWireSchema>;

export const reproductiveQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["ART_CYCLE","EMBRYO_TRANSFER"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type ReproductiveQcReviewCreateRequestWire = z.infer<typeof reproductiveQcReviewCreateRequestWireSchema>;

export const pediatricQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["GROWTH_RECORD","FOLLOWUP_RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type PediatricQcReviewWire = z.infer<typeof pediatricQcReviewWireSchema>;

export const pediatricQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["GROWTH_RECORD","FOLLOWUP_RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type PediatricQcReviewCreateRequestWire = z.infer<typeof pediatricQcReviewCreateRequestWireSchema>;

export const neonatalQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["WRISTBAND_VERIFICATION","SCREENING_RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type NeonatalQcReviewWire = z.infer<typeof neonatalQcReviewWireSchema>;

export const neonatalQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["WRISTBAND_VERIFICATION","SCREENING_RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type NeonatalQcReviewCreateRequestWire = z.infer<typeof neonatalQcReviewCreateRequestWireSchema>;

export const mentalHealthQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["CRISIS_HANDOVER","CRISIS_FOLLOWUP"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type MentalHealthQcReviewWire = z.infer<typeof mentalHealthQcReviewWireSchema>;

export const mentalHealthQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["CRISIS_HANDOVER","CRISIS_FOLLOWUP"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type MentalHealthQcReviewCreateRequestWire = z.infer<typeof mentalHealthQcReviewCreateRequestWireSchema>;

export const ophthalmologyQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["PREOP_VERIFICATION","POSTOP_FOLLOWUP"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type OphthalmologyQcReviewWire = z.infer<typeof ophthalmologyQcReviewWireSchema>;

export const ophthalmologyQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["PREOP_VERIFICATION","POSTOP_FOLLOWUP"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type OphthalmologyQcReviewCreateRequestWire = z.infer<typeof ophthalmologyQcReviewCreateRequestWireSchema>;

export const entQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["AIRWAY_RISK_HANDOVER","RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type EntQcReviewWire = z.infer<typeof entQcReviewWireSchema>;

export const entQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["AIRWAY_RISK_HANDOVER","RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type EntQcReviewCreateRequestWire = z.infer<typeof entQcReviewCreateRequestWireSchema>;

export const dentalQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["TREATMENT_RECORD","RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DentalQcReviewWire = z.infer<typeof dentalQcReviewWireSchema>;

export const dentalQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["TREATMENT_RECORD","RECORD"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type DentalQcReviewCreateRequestWire = z.infer<typeof dentalQcReviewCreateRequestWireSchema>;

export const dermatologyQcReviewWireSchema = z.object({
  "review_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["BIOLOGIC_SCREENING","BIOLOGIC_FOLLOWUP"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_by": z.string().uuid(),
  "reviewed_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DermatologyQcReviewWire = z.infer<typeof dermatologyQcReviewWireSchema>;

export const dermatologyQcReviewCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "reviewed_record_type": z.enum(["BIOLOGIC_SCREENING","BIOLOGIC_FOLLOWUP"]),
  "reviewed_record_id": z.string().uuid(),
  "review_conclusion": z.enum(["PASS","FAIL"]),
  "defect_description": z.string().nullable().optional(),
  "reviewed_at": z.string(),
}).strict();
export type DermatologyQcReviewCreateRequestWire = z.infer<typeof dermatologyQcReviewCreateRequestWireSchema>;

export const neonatalFollowupRecordWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type NeonatalFollowupRecordWire = z.infer<typeof neonatalFollowupRecordWireSchema>;

export const neonatalFollowupRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type NeonatalFollowupRecordCreateRequestWire = z.infer<typeof neonatalFollowupRecordCreateRequestWireSchema>;

export const entFollowupRecordWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type EntFollowupRecordWire = z.infer<typeof entFollowupRecordWireSchema>;

export const entFollowupRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type EntFollowupRecordCreateRequestWire = z.infer<typeof entFollowupRecordCreateRequestWireSchema>;

export const dentalFollowupRecordWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DentalFollowupRecordWire = z.infer<typeof dentalFollowupRecordWireSchema>;

export const dentalFollowupRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type DentalFollowupRecordCreateRequestWire = z.infer<typeof dentalFollowupRecordCreateRequestWireSchema>;

export const tcmFollowupRecordWireSchema = z.object({
  "followup_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_by": z.string().uuid(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type TcmFollowupRecordWire = z.infer<typeof tcmFollowupRecordWireSchema>;

export const tcmFollowupRecordCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "followup_reason": z.string(),
  "scheduled_date": z.string(),
  "attended": z.boolean(),
  "no_show_reason": z.string().nullable().optional(),
  "outcome_note": z.string().nullable().optional(),
  "recorded_at": z.string(),
}).strict();
export type TcmFollowupRecordCreateRequestWire = z.infer<typeof tcmFollowupRecordCreateRequestWireSchema>;

export const obstetricCareNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ObstetricCareNoteWire = z.infer<typeof obstetricCareNoteWireSchema>;

export const obstetricCareNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type ObstetricCareNoteCreateRequestWire = z.infer<typeof obstetricCareNoteCreateRequestWireSchema>;

export const reproductiveCareNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ReproductiveCareNoteWire = z.infer<typeof reproductiveCareNoteWireSchema>;

export const reproductiveCareNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type ReproductiveCareNoteCreateRequestWire = z.infer<typeof reproductiveCareNoteCreateRequestWireSchema>;

export const ophthalmologyCareNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type OphthalmologyCareNoteWire = z.infer<typeof ophthalmologyCareNoteWireSchema>;

export const ophthalmologyCareNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type OphthalmologyCareNoteCreateRequestWire = z.infer<typeof ophthalmologyCareNoteCreateRequestWireSchema>;

export const dentalCareNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DentalCareNoteWire = z.infer<typeof dentalCareNoteWireSchema>;

export const dentalCareNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type DentalCareNoteCreateRequestWire = z.infer<typeof dentalCareNoteCreateRequestWireSchema>;

export const dermatologyCareNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DermatologyCareNoteWire = z.infer<typeof dermatologyCareNoteWireSchema>;

export const dermatologyCareNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type DermatologyCareNoteCreateRequestWire = z.infer<typeof dermatologyCareNoteCreateRequestWireSchema>;

export const tcmCareNoteWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type TcmCareNoteWire = z.infer<typeof tcmCareNoteWireSchema>;

export const tcmCareNoteCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type TcmCareNoteCreateRequestWire = z.infer<typeof tcmCareNoteCreateRequestWireSchema>;

export const reproductiveEvidenceWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type ReproductiveEvidenceWire = z.infer<typeof reproductiveEvidenceWireSchema>;

export const reproductiveEvidenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type ReproductiveEvidenceCreateRequestWire = z.infer<typeof reproductiveEvidenceCreateRequestWireSchema>;

export const pediatricEvidenceWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type PediatricEvidenceWire = z.infer<typeof pediatricEvidenceWireSchema>;

export const pediatricEvidenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type PediatricEvidenceCreateRequestWire = z.infer<typeof pediatricEvidenceCreateRequestWireSchema>;

export const mentalHealthEvidenceWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type MentalHealthEvidenceWire = z.infer<typeof mentalHealthEvidenceWireSchema>;

export const mentalHealthEvidenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type MentalHealthEvidenceCreateRequestWire = z.infer<typeof mentalHealthEvidenceCreateRequestWireSchema>;

export const ophthalmologyEvidenceWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type OphthalmologyEvidenceWire = z.infer<typeof ophthalmologyEvidenceWireSchema>;

export const ophthalmologyEvidenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type OphthalmologyEvidenceCreateRequestWire = z.infer<typeof ophthalmologyEvidenceCreateRequestWireSchema>;

export const entEvidenceWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type EntEvidenceWire = z.infer<typeof entEvidenceWireSchema>;

export const entEvidenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type EntEvidenceCreateRequestWire = z.infer<typeof entEvidenceCreateRequestWireSchema>;

export const dentalEvidenceWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DentalEvidenceWire = z.infer<typeof dentalEvidenceWireSchema>;

export const dentalEvidenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type DentalEvidenceCreateRequestWire = z.infer<typeof dentalEvidenceCreateRequestWireSchema>;

export const dermatologyEvidenceWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type DermatologyEvidenceWire = z.infer<typeof dermatologyEvidenceWireSchema>;

export const dermatologyEvidenceCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type DermatologyEvidenceCreateRequestWire = z.infer<typeof dermatologyEvidenceCreateRequestWireSchema>;

export const pediatricTreatmentWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type PediatricTreatmentWire = z.infer<typeof pediatricTreatmentWireSchema>;

export const pediatricTreatmentCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type PediatricTreatmentCreateRequestWire = z.infer<typeof pediatricTreatmentCreateRequestWireSchema>;

export const neonatalTreatmentWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type NeonatalTreatmentWire = z.infer<typeof neonatalTreatmentWireSchema>;

export const neonatalTreatmentCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type NeonatalTreatmentCreateRequestWire = z.infer<typeof neonatalTreatmentCreateRequestWireSchema>;

export const mentalHealthTreatmentWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type MentalHealthTreatmentWire = z.infer<typeof mentalHealthTreatmentWireSchema>;

export const mentalHealthTreatmentCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type MentalHealthTreatmentCreateRequestWire = z.infer<typeof mentalHealthTreatmentCreateRequestWireSchema>;

export const entTreatmentWireSchema = z.object({
  "note_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
  "row_version": z.number().int(),
}).strict();
export type EntTreatmentWire = z.infer<typeof entTreatmentWireSchema>;

export const entTreatmentCreateRequestWireSchema = z.object({
  "organization_id": z.string().uuid(),
  "facility_id": z.string().uuid(),
  "patient_id": z.string().uuid(),
  "encounter_id": z.string().uuid(),
  "assessment": z.string(),
  "intervention": z.string(),
  "risk_flag": z.boolean(),
  "recorded_at": z.string(),
}).strict();
export type EntTreatmentCreateRequestWire = z.infer<typeof entTreatmentCreateRequestWireSchema>;

export interface ClinicalContextLease {
  leaseId: string;
  tenantId: string;
  organizationId: string;
  facilityId: string;
  userId: string;
  roleAssignmentIds: string[];
  patientId: string | null;
  encounterId: string | null;
  taskId: string | null;
  purposeCode: string;
  allowedSourceTypes: ContextLeaseWire['allowed_source_types'];
  authorizationWatermark: string;
  dataClassificationCeiling: ContextLeaseWire['data_classification_ceiling'];
  modelResidencyPolicy: ContextLeaseWire['model_residency_policy'];
  expiresAt: string;
}

export function decodeContextLease(input: unknown): ClinicalContextLease {
  const wire = contextLeaseWireSchema.parse(input);
  return {
    leaseId: wire.lease_id,
    tenantId: wire.tenant_id,
    organizationId: wire.organization_id,
    facilityId: wire.facility_id,
    userId: wire.user_id,
    roleAssignmentIds: wire.role_assignment_ids,
    patientId: wire.patient_id,
    encounterId: wire.encounter_id,
    taskId: wire.task_id,
    purposeCode: wire.purpose_code,
    allowedSourceTypes: wire.allowed_source_types,
    authorizationWatermark: wire.authorization_watermark,
    dataClassificationCeiling: wire.data_classification_ceiling,
    modelResidencyPolicy: wire.model_residency_policy,
    expiresAt: wire.expires_at,
  };
}
