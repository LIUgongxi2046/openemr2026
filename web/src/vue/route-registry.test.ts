import { createMemoryHistory } from 'vue-router';
import { describe, expect, it } from 'vitest';

import { createOpenEmrRouter } from './router';
import { nativeVueRouteIds, primaryNavigationId, routeRegistry, specialtyGuardRouteIds, specialtyScopeForRoute } from './route-registry';

describe('Vue route registry', () => {
  it('registers the exact 199-route contract with one primary domain per route', () => {
    expect(routeRegistry).toHaveLength(199);
    expect(new Set(routeRegistry.map((route) => route.route_id)).size).toBe(199);
    expect(routeRegistry.every((route) => Boolean(route.primary_domain))).toBe(true);
  });

  it('keeps record and outpatient in different primary navigation domains', () => {
    expect(primaryNavigationId('record')).toBe('record');
    expect(primaryNavigationId('outpatient')).toBe('outpatient');
  });

  it('resolves registered deep links and fails closed for unknown paths', () => {
    const router = createOpenEmrRouter(createMemoryHistory());
    expect(router.resolve('/record-diff/document/from/to').name).toBe('record-diff');
    expect(router.resolve('/route-that-does-not-exist').name).toBe('safe-not-found');
  });

  it('exposes system login as a public standalone layout with a legacy alias', () => {
    const router = createOpenEmrRouter(createMemoryHistory());
    const login = router.resolve('/login');
    expect(login.name).toBe('login-context');
    expect(login.meta).toMatchObject({ layout: 'SYSTEM_AUTH', publicRoute: true, primaryDomain: 'SYSTEM' });
    expect(router.resolve('/login-context').name).toBe('login-context');
  });

  it('moves the U01-V2/V3 implemented routes to native Vue without a second route registry', () => {
    for (const routeId of ['outpatient', 'opd-record', 'record', 'record-qc', 'record-sign', 'record-sources', 'inpatient', 'record-versions', 'record-diff', 'archive-assets', 'opd-orders', 'ip-orders', 'opd-diagnosis', 'clinical-tasks', 'opd-results', 'admin-org', 'admin-users', 'admin-permissions', 'admin-templates', 'emergency-access', 'patient-registry', 'patient-merge', 'patient-timeline']) {
      expect(nativeVueRouteIds.has(routeId)).toBe(true);
    }
  });

  it('routes all 70 specialty deep pages plus the center through the real support guard', () => {
    expect(specialtyGuardRouteIds.size).toBe(71);
    expect(specialtyScopeForRoute('obgyn-record')).toBe('OBGYN');
    expect(specialtyScopeForRoute('tcm-followup')).toBe('TCM');
    expect(specialtyScopeForRoute('specialty-center')).toBeNull();
  });
});
