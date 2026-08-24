import {
  departmentSupportAssessmentWireSchema,
  type DepartmentSupportAssessmentWire,
} from './generated/contracts';

export type SpecialtyRouteAccess =
  | { mode: 'SPECIALTY_ENABLED'; reason: 'VERIFIED_CLOSED_LOOP' }
  | { mode: 'GENERAL_CORE_ONLY'; reason: 'NO_VERIFIED_SPECIALTY_CLOSED_LOOP' }
  | { mode: 'GAP_ONLY'; reason: 'PACK_OR_EVIDENCE_PENDING'; missingSafetyGates: string[] }
  | { mode: 'BLOCKED'; reason: 'UNSUPPORTED_DEPARTMENT_SCOPE'; missingSafetyGates: string[] };

export function decodeDepartmentSupportAssessment(input: unknown): DepartmentSupportAssessmentWire {
  return departmentSupportAssessmentWireSchema.parse(input);
}

export function resolveSpecialtyRouteAccess(
  assessment: DepartmentSupportAssessmentWire,
): SpecialtyRouteAccess {
  switch (assessment.support_level) {
    case 'BASIC_CLOSED_LOOP':
      return { mode: 'SPECIALTY_ENABLED', reason: 'VERIFIED_CLOSED_LOOP' };
    case 'GENERAL_AVAILABLE':
      return { mode: 'GENERAL_CORE_ONLY', reason: 'NO_VERIFIED_SPECIALTY_CLOSED_LOOP' };
    case 'PACK_PENDING':
      return {
        mode: 'GAP_ONLY',
        reason: 'PACK_OR_EVIDENCE_PENDING',
        missingSafetyGates: assessment.missing_safety_gates,
      };
    case 'UNSUPPORTED':
      return {
        mode: 'BLOCKED',
        reason: 'UNSUPPORTED_DEPARTMENT_SCOPE',
        missingSafetyGates: assessment.missing_safety_gates,
      };
  }
}
