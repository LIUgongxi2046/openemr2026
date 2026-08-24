package org.openemr2026.clinical;

import java.util.Map;
import java.util.UUID;
import org.openemr2026.contracts.DocumentVersionWire;
import org.openemr2026.security.ClinicalIdentity;

/** Public clinical document application boundary used by other bounded contexts. */
public interface ClinicalDocumentGateway {

    DocumentVersionWire createDocument(
            ClinicalIdentity identity,
            String idempotencyKey,
            UUID patientId,
            UUID encounterId,
            String documentTypeCode,
            Map<String, Object> sections);

    void configureSignaturePolicy(
            ClinicalIdentity identity,
            UUID documentId,
            UUID documentVersionId,
            String requiredSignatureLevel);
}
