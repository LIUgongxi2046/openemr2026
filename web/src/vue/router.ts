import { createMemoryHistory, createRouter, createWebHashHistory, type RouterHistory, type RouteRecordRaw } from 'vue-router';

import { nativeVueRouteIds, routeRegistry, specialtyGuardRouteIds } from './route-registry';
import { clearInpatientSyntheticActor } from '../clinical-api';

const plannedComponent = () => import('./views/PlannedRoutePage.vue');
const specialtyGuardComponent = () => import('./views/SpecialtySupportGuardPage.vue');
const nativeComponents: Record<string, () => Promise<unknown>> = {
  clinical: () => import('./views/ClinicalPortalPage.vue'),
  admin: () => import('./views/AdminWorkspacePage.vue'),
  'admission-bed': () => import('./views/AdmissionBedPage.vue'),
  outpatient: () => import('./views/OutpatientWorkspacePage.vue'),
  'opd-record': () => import('./views/OutpatientRecordPage.vue'),
  record: () => import('./views/RecordCenterPage.vue'),
  'record-qc': () => import('./views/RecordGovernancePage.vue'),
  'record-sign': () => import('./views/RecordGovernancePage.vue'),
  'record-sources': () => import('./views/RecordSourcesPage.vue'),
  inpatient: () => import('./views/InpatientWorkspacePage.vue'),
  'inpatient-overview': () => import('./views/InpatientJourneyPage.vue'),
  'inpatient-course': () => import('./views/InpatientJourneyPage.vue'),
  'inpatient-doc-editor': () => import('./views/InpatientDocumentEditorPage.vue'),
  'inpatient-doc-qc': () => import('./views/InpatientDocumentEditorPage.vue'),
  'inpatient-doc-versions': () => import('./views/InpatientJourneyPage.vue'),
  'inpatient-discharge': () => import('./views/InpatientJourneyPage.vue'),
  'record-versions': () => import('./views/RecordVersionsPage.vue'),
  'record-diff': () => import('./views/RecordDiffPage.vue'),
  'record-editor': () => import('./views/RecordEditorPage.vue'),
  'lis-report': () => import('./views/LisReportPage.vue'),
  'pacs-viewer': () => import('./views/PacsViewerPage.vue'),
  'archive-assets': () => import('./views/ArchiveAssetsPage.vue'),
  'archive-borrow': () => import('./views/ArchiveBorrowPage.vue'),
  'archive-catalog': () => import('./views/ArchiveCatalogPage.vue'),
  'archive-integrity': () => import('./views/ArchiveIntegrityPage.vue'),
  'asset-detail': () => import('./views/AssetDetailPage.vue'),
  'opd-orders': () => import('./views/OrdersWorkspacePage.vue'),
  'ip-orders': () => import('./views/OrdersWorkspacePage.vue'),
  'opd-diagnosis': () => import('./views/DiagnosisWorkspacePage.vue'),
  'clinical-tasks': () => import('./views/ClinicalTasksPage.vue'),
  'opd-results': () => import('./views/ResultsWorkspacePage.vue'),
  'ip-results': () => import('./views/ResultsWorkspacePage.vue'),
  'ip-consult': () => import('./views/InpatientConsultationPage.vue'),
  'ip-pathway': () => import('./views/InpatientPathwayPage.vue'),
  'admin-org': () => import('./views/OrganizationAdministrationPage.vue'),
  'admin-users': () => import('./views/WorkforceAdministrationPage.vue'),
  'admin-permissions': () => import('./views/AuthorizationAdministrationPage.vue'),
  'admin-templates': () => import('./views/DocumentTemplateAdministrationPage.vue'),
  'admin-dictionaries': () => import('./views/DictionaryAdministrationPage.vue'),
  'admin-audit': () => import('./views/AdminAuditPage.vue'),
  'capability-pack': () => import('./views/CapabilityPackPage.vue'),
  integration: () => import('./views/IntegrationPage.vue'),
  'migration': () => import('./views/MigrationPage.vue'),
  models: () => import('./views/ModelDeploymentPage.vue'),
  'agent-catalog': () => import('./views/AgentCatalogPage.vue'),
  'skill-catalog': () => import('./views/SkillCatalogPage.vue'),
  'tool-catalog': () => import('./views/ToolCatalogPage.vue'),
  'model-evaluation': () => import('./views/ModelEvaluationPage.vue'),
  aiops: () => import('./views/AiOpsPage.vue'),
  'data-quality': () => import('./views/DataQualityPage.vue'),
  'cohort-builder': () => import('./views/CohortBuilderPage.vue'),
  'research-dataset': () => import('./views/ResearchDatasetPage.vue'),
  opensource: () => import('./views/OpenSourcePage.vue'),
  'emergency-access': () => import('./views/EmergencyAccessPage.vue'),
  'patient-registry': () => import('./views/PatientRegistryPage.vue'),
  'patient-merge': () => import('./views/PatientMergePage.vue'),
  'patient-timeline': () => import('./views/PatientTimelinePage.vue'),
  'appointment-registration': () => import('./views/AppointmentRegistrationPage.vue'),
  emergency: () => import('./views/EmergencyWorkspacePage.vue'),
  'er-triage': () => import('./views/EmergencyTriagePage.vue'),
  'er-observation': () => import('./views/EmergencyObservationPage.vue'),
  'er-record': () => import('./views/EmergencyRecordPage.vue'),
  'er-nursing': () => import('./views/EmergencyNursingPage.vue'),
  'er-handoff': () => import('./views/EmergencyHandoffPage.vue'),
  'opd-consult': () => import('./views/OutpatientConsultPage.vue'),
  billing: () => import('./views/BillingPage.vue'),
  'outpatient-pharmacy': () => import('./views/OutpatientPharmacyPage.vue'),
  'inpatient-pharmacy': () => import('./views/InpatientPharmacyPage.vue'),
  'lab-workbench': () => import('./views/LabWorkbenchPage.vue'),
  'imaging-workbench': () => import('./views/ImagingWorkbenchPage.vue'),
  transfusion: () => import('./views/TransfusionPage.vue'),
  'surgery-schedule': () => import('./views/SurgerySchedulePage.vue'),
  'care-operations': () => import('./views/CareOperationsPage.vue'),
  ward: () => import('./views/WardPage.vue'),
  'infection-events': () => import('./views/InfectionEventsPage.vue'),
  'quality-rating': () => import('./views/QualityRatingPage.vue'),
  credentials: () => import('./views/CredentialsPage.vue'),
  'specialty-center': () => import('./views/SpecialtyCenterPage.vue'),
  'obgyn-record': () => import('./views/ObstetricRecordPage.vue'),
  'reproductive-record': () => import('./views/ReproductiveRecordPage.vue'),
  'pediatrics-record': () => import('./views/PediatricRecordPage.vue'),
  'neonatal-record': () => import('./views/NeonatalRecordPage.vue'),
  'mental-record': () => import('./views/MentalHealthRecordPage.vue'),
  'ophthalmology-record': () => import('./views/OphthalmologyRecordPage.vue'),
  'ent-record': () => import('./views/EntRecordPage.vue'),
  'dental-record': () => import('./views/DentalRecordPage.vue'),
  'dermatology-record': () => import('./views/DermatologyRecordPage.vue'),
  'tcm-record': () => import('./views/TcmRecordPage.vue'),
  'obgyn-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'reproductive-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'pediatrics-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'neonatal-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'mental-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'ophthalmology-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'ent-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'dental-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'dermatology-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'tcm-workbench': () => import('./views/SpecialtyWorkbenchPage.vue'),
  'obgyn-treatment': () => import('./views/ObstetricDeliveryPage.vue'),
  'obgyn-evidence': () => import('./views/ObstetricAntenatalExamPage.vue'),
  'obgyn-followup': () => import('./views/ObstetricPostpartumFollowupPage.vue'),
  'obgyn-qc': () => import('./views/ObstetricQcReviewPage.vue'),
  'reproductive-treatment': () => import('./views/ReproductiveTransferPage.vue'),
  'reproductive-followup': () => import('./views/ReproductiveOutcomePage.vue'),
  'pediatrics-care': () => import('./views/PediatricGrowthPage.vue'),
  'pediatrics-followup': () => import('./views/PediatricFollowupPage.vue'),
  'neonatal-care': () => import('./views/NeonatalWristbandPage.vue'),
  'neonatal-evidence': () => import('./views/NeonatalScreeningPage.vue'),
  'mental-care': () => import('./views/MentalCrisisHandoverPage.vue'),
  'mental-followup': () => import('./views/MentalCrisisFollowupPage.vue'),
  'ophthalmology-treatment': () => import('./views/OphthalmologyPreopPage.vue'),
  'ophthalmology-followup': () => import('./views/OphthalmologyPostopPage.vue'),
  'ent-care': () => import('./views/EntAirwayHandoverPage.vue'),
  'dental-treatment': () => import('./views/DentalTreatmentPage.vue'),
  'dermatology-treatment': () => import('./views/DermatologyScreeningPage.vue'),
  'dermatology-followup': () => import('./views/DermatologyFollowupPage.vue'),
  'tcm-treatment': () => import('./views/TcmHerbalPage.vue'),
  'tcm-evidence': () => import('./views/TcmFourExamPage.vue'),
  'tcm-qc': () => import('./views/TcmQcPage.vue'),
  'reproductive-qc': () => import('./views/ReproductiveQcReviewPage.vue'),
  'pediatrics-qc': () => import('./views/PediatricQcReviewPage.vue'),
  'neonatal-qc': () => import('./views/NeonatalQcReviewPage.vue'),
  'mental-qc': () => import('./views/MentalHealthQcReviewPage.vue'),
  'ophthalmology-qc': () => import('./views/OphthalmologyQcReviewPage.vue'),
  'ent-qc': () => import('./views/EntQcReviewPage.vue'),
  'dental-qc': () => import('./views/DentalQcReviewPage.vue'),
  'dermatology-qc': () => import('./views/DermatologyQcReviewPage.vue'),
  'neonatal-followup': () => import('./views/NeonatalFollowupPage.vue'),
  'ent-followup': () => import('./views/EntFollowupPage.vue'),
  'dental-followup': () => import('./views/DentalFollowupPage.vue'),
  'tcm-followup': () => import('./views/TcmFollowupPage.vue'),
  'obgyn-care': () => import('./views/ObstetricCareNotePage.vue'),
  'reproductive-care': () => import('./views/ReproductiveCareNotePage.vue'),
  'ophthalmology-care': () => import('./views/OphthalmologyCareNotePage.vue'),
  'dental-care': () => import('./views/DentalCareNotePage.vue'),
  'dermatology-care': () => import('./views/DermatologyCareNotePage.vue'),
  'tcm-care': () => import('./views/TcmCareNotePage.vue'),
  'reproductive-evidence': () => import('./views/ReproductiveEvidencePage.vue'),
  'pediatrics-evidence': () => import('./views/PediatricEvidencePage.vue'),
  'mental-evidence': () => import('./views/MentalHealthEvidencePage.vue'),
  'ophthalmology-evidence': () => import('./views/OphthalmologyEvidencePage.vue'),
  'ent-evidence': () => import('./views/EntEvidencePage.vue'),
  'dental-evidence': () => import('./views/DentalEvidencePage.vue'),
  'dermatology-evidence': () => import('./views/DermatologyEvidencePage.vue'),
  'pediatrics-treatment': () => import('./views/PediatricTreatmentPage.vue'),
  'neonatal-treatment': () => import('./views/NeonatalTreatmentPage.vue'),
  'mental-treatment': () => import('./views/MentalHealthTreatmentPage.vue'),
  'ent-treatment': () => import('./views/EntTreatmentPage.vue'),
  'ai-action-review': () => import('./views/AiActionReviewPage.vue'),
  'ai-reminder-detail': () => import('./views/AiReminderDetailPage.vue'),
  'ai-assistant': () => import('./views/AiAssistantPage.vue'),
  'integration-mapping': () => import('./views/IntegrationMappingPage.vue'),
  'specialty-coverage': () => import('./views/SpecialtyCoveragePage.vue'),
  'admin-roles': () => import('./views/AdminRolesPage.vue'),
  'admin-auth': () => import('./views/AdminAuthPage.vue'),
  'admin-jobs': () => import('./views/AdminJobsPage.vue'),
  'admin-master-data': () => import('./views/AdminMasterDataPage.vue'),
  'admin-parameters': () => import('./views/AdminParametersPage.vue'),
  'agent': () => import('./views/AgentRunPage.vue'),
  'agent-compose': () => import('./views/AgentComposePage.vue'),
  'agent-context': () => import('./views/AgentContextPage.vue'),
  'agent-evals': () => import('./views/AgentEvalsPage.vue'),
  'ai-assistant-policy': () => import('./views/AiAssistantPolicyPage.vue'),
  'ai-capture': () => import('./views/AiCapturePage.vue'),
  'ai-center': () => import('./views/AiCenterPage.vue'),
  'anesthesia-workbench': () => import('./views/AnesthesiaWorkbenchPage.vue'),
  'archive-preservation': () => import('./views/ArchivePreservationPage.vue'),
  'archive-scan': () => import('./views/ArchiveScanPage.vue'),
  'backup': () => import('./views/BackupPage.vue'),
  'config-release': () => import('./views/ConfigReleasePage.vue'),
  'config-upgrade': () => import('./views/ConfigUpgradePage.vue'),
  'data-center': () => import('./views/DataCenterPage.vue'),
  'department-qc': () => import('./views/DepartmentQcPage.vue'),
  'device-monitoring': () => import('./views/DeviceMonitoringPage.vue'),
  'devices': () => import('./views/DevicesPage.vue'),
  'form-designer': () => import('./views/FormDesignerPage.vue'),
  'install': () => import('./views/InstallPage.vue'),
  'integration-connectors': () => import('./views/IntegrationConnectorsPage.vue'),
  'integration-messages': () => import('./views/IntegrationMessagesPage.vue'),
  'login-context': () => import('./views/LoginContextPage.vue'),
  'model-connection': () => import('./views/ModelConnectionPage.vue'),
  'model-routing': () => import('./views/ModelRoutingPage.vue'),
  'opd-followup': () => import('./views/OpdFollowupPage.vue'),
  'operations': () => import('./views/OperationsPage.vue'),
  'pathology-workbench': () => import('./views/PathologyWorkbenchPage.vue'),
  'quality-center': () => import('./views/QualityCenterPage.vue'),
  'release-gates': () => import('./views/ReleaseGatesPage.vue'),
  'research': () => import('./views/ResearchPage.vue'),
  'research-stats': () => import('./views/ResearchStatsPage.vue'),
  'rule-center': () => import('./views/RuleCenterPage.vue'),
  'scope-designer': () => import('./views/ScopeDesignerPage.vue'),
  'therapy-workbench': () => import('./views/TherapyWorkbenchPage.vue'),
  'unified-home': () => import('./views/UnifiedHomePage.vue'),
  'workflow': () => import('./views/WorkflowPage.vue'),
};

function vuePath(routeId: string): string {
  if (routeId === 'record-diff') return '/record-diff/:documentId?/:fromVersionId?/:toVersionId?';
  return `/${routeId}`;
}

export function buildContractRoutes(): RouteRecordRaw[] {
  return routeRegistry.map((definition) => ({
    path: vuePath(definition.route_id),
    name: definition.route_id,
    ...(definition.route_id === 'clinical-tasks' ? { alias: ['/tasks'] } : {}),
    component: nativeComponents[definition.route_id]
      ?? (specialtyGuardRouteIds.has(definition.route_id) ? specialtyGuardComponent : undefined)
      ?? plannedComponent,
    meta: {
      contractId: definition.route_id,
      primaryDomain: definition.primary_domain,
      guards: definition.guards,
      implementation: nativeVueRouteIds.has(definition.route_id)
        ? 'VUE_NATIVE'
        : (specialtyGuardRouteIds.has(definition.route_id)
          ? 'SUPPORT_GUARD'
          : 'NOT_AVAILABLE'),
    },
  }));
}

function defaultHistory(): RouterHistory {
  return typeof window === 'undefined' ? createMemoryHistory() : createWebHashHistory();
}

export function createOpenEmrRouter(history: RouterHistory = defaultHistory()) {
  return createRouter({
    history,
    routes: [
      { path: '/', redirect: '/clinical' },
      ...buildContractRoutes(),
      {
        path: '/mock-interfaces',
        name: 'mock-interfaces',
        component: () => import('./views/MockInterfacePage.vue'),
        meta: { contractId: 'mock-interfaces', primaryDomain: 'ADMIN', guards: ['SESSION'], implementation: 'VUE_NATIVE' },
      },
      { path: '/:pathMatch(.*)*', name: 'safe-not-found', component: () => import('./views/SafeNotFoundPage.vue') },
    ],
    scrollBehavior: () => ({ top: 0 }),
  });
}

export const router = createOpenEmrRouter();

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.routeId = String(to.meta.contractId ?? to.name ?? 'unknown');
  }
  if (!to.path.startsWith('/inpatient') && !to.path.startsWith('/ip-')) clearInpatientSyntheticActor();
});

declare module 'vue-router' {
  interface RouteMeta {
    contractId?: string;
    primaryDomain?: string;
    guards?: readonly string[];
    implementation?: 'VUE_NATIVE' | 'SUPPORT_GUARD' | 'NOT_AVAILABLE';
  }
}
