import { useQuery } from '@tanstack/vue-query';
import { watch } from 'vue';

import { issueDocumentLease, loadCurrentDocument } from '../../clinical-api';
import { useClinicalContextStore } from '../stores/clinical-context';

export function useCurrentDocument() {
  const clinicalContext = useClinicalContextStore();
  const query = useQuery({
    queryKey: ['clinical', 'current-document'],
    queryFn: async () => {
      const lease = await issueDocumentLease();
      return { lease, document: await loadCurrentDocument(lease) };
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  watch(() => query.data.value?.lease, (lease) => {
    if (lease) clinicalContext.replaceFromLease(lease);
  }, { immediate: true });
  return query;
}
