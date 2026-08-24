import { defineStore } from 'pinia';
import type { ContextLeaseWire } from '../../generated/contracts';

export const useClinicalContextStore = defineStore('clinical-context', {
  state: () => ({
    leaseId: null as string | null,
    patientId: null as string | null,
    encounterId: null as string | null,
    purposeCode: null as string | null,
    contextEpoch: 0,
  }),
  actions: {
    replaceFromLease(lease: ContextLeaseWire) {
      this.leaseId = lease.lease_id;
      this.patientId = lease.patient_id;
      this.encounterId = lease.encounter_id;
      this.purposeCode = lease.purpose_code;
      this.contextEpoch += 1;
    },
    clear(reason = 'CONTEXT_DISPOSED') {
      this.leaseId = null;
      this.patientId = null;
      this.encounterId = null;
      this.purposeCode = null;
      this.contextEpoch += 1;
      return reason;
    },
  },
});
