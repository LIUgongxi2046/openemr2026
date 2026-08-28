import type {
  AuditEventWire,
  AuthorizationPolicyWire,
  ConfigurationItemWire,
  DictionaryItemWire,
  DocumentTemplateWire,
  EmergencyAccessGrantWire,
  OrganizationUnitWire,
  WorkforceIdentityWire,
} from '../generated/contracts';
import {
  loadAuthorizationPolicies,
  loadDocumentTemplates,
  loadEmergencyAccessForReview,
  loadOrganizationUnits,
  loadWorkforceIdentities,
} from '../clinical-api';
import { issueAuditLease, listAuditEvents } from './audit';
import { issueConfigurationLease, listConfigurations } from './config';
import { issueGovernanceLease, listDictionaryItems } from './governance';

export interface RoleConflict {
  personId: string;
  personCode: string;
  personDisplayName: string;
  roleCodes: string[];
  reason: string;
}

export interface RoleGovernanceResult {
  assignmentCount: number;
  privilegedAssignmentCount: number;
  conflicts: RoleConflict[];
}

const privilegedRoles = new Set(['SYSTEM_ADMIN', 'SECURITY_AUDITOR', 'AUTHORIZATION_ADMIN']);
export const SYSTEM_ADMINISTRATION_DICTIONARY_CODES = [
  'GENDER', 'ENCOUNTER_TYPE', 'ALLERGY_SEVERITY', 'LAB_UNIT',
  'BLOOD_TYPE', 'RH_TYPE', 'ADMISSION_SOURCE', 'DISCHARGE_DISPOSITION',
  'TRIAGE_LEVEL', 'DOCUMENT_STATUS', 'CREDENTIAL_TYPE', 'MARITAL_STATUS',
  'PAYMENT_TYPE', 'CONSENT_STATUS', 'BED_CLASS',
] as const;
const incompatibleRoles = [
  ['SYSTEM_ADMIN', 'SECURITY_AUDITOR', '系统管理与安全审计必须职责分离'],
  ['CONFIG_AUTHOR', 'CONFIG_APPROVER', '配置作者不能审批自己的配置'],
  ['AUTHORIZATION_ADMIN', 'SECURITY_AUDITOR', '授权管理与安全审计必须职责分离'],
] as const;

function roleIsEffective(identity: WorkforceIdentityWire, now: number) {
  if (!identity.role_assignment_id || identity.role_status !== 'ACTIVE' || !identity.role_code) return false;
  if (identity.role_valid_from && new Date(identity.role_valid_from).getTime() > now) return false;
  return !identity.role_valid_until || new Date(identity.role_valid_until).getTime() > now;
}

export function analyzeRoleGovernance(identities: WorkforceIdentityWire[], now = Date.now()): RoleGovernanceResult {
  const effective = identities.filter((identity) => roleIsEffective(identity, now));
  const people = new Map<string, { identity: WorkforceIdentityWire; roles: Set<string> }>();
  for (const identity of effective) {
    const entry = people.get(identity.person_id) ?? { identity, roles: new Set<string>() };
    entry.roles.add(identity.role_code!);
    people.set(identity.person_id, entry);
  }
  const conflicts: RoleConflict[] = [];
  for (const [personId, entry] of people) {
    for (const [left, right, reason] of incompatibleRoles) {
      if (entry.roles.has(left) && entry.roles.has(right)) {
        conflicts.push({
          personId,
          personCode: entry.identity.person_code,
          personDisplayName: entry.identity.person_display_name,
          roleCodes: [left, right],
          reason,
        });
      }
    }
  }
  return {
    assignmentCount: effective.length,
    privilegedAssignmentCount: effective.filter((identity) => privilegedRoles.has(identity.role_code!)).length,
    conflicts,
  };
}

export interface SystemAdministrationSnapshot {
  organizationUnits: OrganizationUnitWire[];
  workforce: WorkforceIdentityWire[];
  policies: AuthorizationPolicyWire[];
  emergencyAccess: EmergencyAccessGrantWire[];
  templates: DocumentTemplateWire[];
  dictionaryItems: DictionaryItemWire[];
  masterData: ConfigurationItemWire[];
  parameters: ConfigurationItemWire[];
  jobs: ConfigurationItemWire[];
  auditEvents: AuditEventWire[];
}

export async function loadSystemAdministrationSnapshot(): Promise<SystemAdministrationSnapshot> {
  const [configurationLease, auditLease, governanceLease, organizationUnits, workforce, policies, emergencyAccess, templates]
    = await Promise.all([
      issueConfigurationLease(), issueAuditLease(), issueGovernanceLease('DICTIONARY_ADMIN'),
      loadOrganizationUnits(), loadWorkforceIdentities(), loadAuthorizationPolicies(),
      loadEmergencyAccessForReview(), loadDocumentTemplates(),
    ]);
  const [masterData, parameters, jobs, auditEvents, dictionaryItems] = await Promise.all([
    listConfigurations(configurationLease, 'MASTER_DATA'),
    listConfigurations(configurationLease, 'PARAMETER'),
    listConfigurations(configurationLease, 'JOB'),
    listAuditEvents(auditLease),
    Promise.all(SYSTEM_ADMINISTRATION_DICTIONARY_CODES
      .map((dictionaryCode) => listDictionaryItems(governanceLease, dictionaryCode)))
      .then((groups) => groups.flat()),
  ]);
  return { organizationUnits, workforce, policies, emergencyAccess, templates, dictionaryItems, masterData, parameters, jobs, auditEvents };
}

export interface AuthenticationAdministrationSnapshot {
  parameters: ConfigurationItemWire[];
  events: AuditEventWire[];
  workforce: WorkforceIdentityWire[];
  emergencyAccess: EmergencyAccessGrantWire[];
}

export async function loadAuthenticationAdministration(): Promise<AuthenticationAdministrationSnapshot> {
  const [configurationLease, auditLease, workforce, emergencyAccess] = await Promise.all([
    issueConfigurationLease(), issueAuditLease(), loadWorkforceIdentities(), loadEmergencyAccessForReview(),
  ]);
  const [parameters, events] = await Promise.all([
    listConfigurations(configurationLease, 'PARAMETER'),
    listAuditEvents(auditLease),
  ]);
  return {
    parameters: parameters.filter((item) => /^(?:syn-)?auth-/.test(item.config_key)
      || /^(?:syn-)?admin-session-v1$/.test(item.config_key)),
    events: events.filter((event) => ['LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT_SUCCEEDED'].includes(event.action_code)),
    workforce,
    emergencyAccess,
  };
}
