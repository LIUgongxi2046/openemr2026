import { useQuery } from '@tanstack/vue-query';
import { computed, watch } from 'vue';

import { issueDocumentLease, loadCurrentDocument } from '../../clinical-api';
import { useClinicalContextStore } from '../stores/clinical-context';

export function useCurrentDocument() {
  const contextStore = useClinicalContextStore();
  const query = useQuery({
    queryKey: computed(() => [
      'clinical',
      'current-document',
      contextStore.patientId,
      contextStore.encounterId,
    ]),
    queryFn: async () => {
      const lease = await issueDocumentLease();
      return { lease, document: await loadCurrentDocument(lease) };
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  watch(() => query.data.value?.lease, (lease) => {
    if (lease) contextStore.replaceFromLease(lease);
  }, { immediate: true });
  return query;
}
