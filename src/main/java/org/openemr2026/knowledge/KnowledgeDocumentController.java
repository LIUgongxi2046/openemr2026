package org.openemr2026.knowledge;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.KnowledgeDocumentCreateRequestWire;
import org.openemr2026.contracts.KnowledgeDocumentVersionWire;
import org.openemr2026.contracts.KnowledgeDocumentWire;
import org.openemr2026.contracts.KnowledgeVersionCreateRequestWire;
import org.openemr2026.contracts.KnowledgeVersionPublishRequestWire;
import org.openemr2026.contracts.KnowledgeVersionRetireRequestWire;
import org.openemr2026.contracts.KnowledgeVersionSubmitRequestWire;
import org.openemr2026.security.ClinicalCommandSecurity;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
final class KnowledgeDocumentController {
    private final ClinicalCommandSecurity security;
    private final KnowledgeDocumentService documents;

    KnowledgeDocumentController(ClinicalCommandSecurity security, KnowledgeDocumentService documents) {
        this.security = security;
        this.documents = documents;
    }

    @GetMapping("/knowledge-documents")
    ResponseEntity<List<KnowledgeDocumentWire>> list(
            HttpServletRequest request,
            @RequestParam(value = "content_type", required = false) String contentType,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(documents.listDocuments(identity, contentType));
    }

    @PostMapping("/knowledge-documents")
    ResponseEntity<KnowledgeDocumentWire> create(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody KnowledgeDocumentCreateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(documents.createDocument(identity, idempotencyKey, command));
    }

    @PostMapping("/knowledge-documents/{document_id}/versions")
    ResponseEntity<KnowledgeDocumentVersionWire> createVersion(
            HttpServletRequest request,
            @PathVariable("document_id") UUID documentId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody KnowledgeVersionCreateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(documents.createVersion(identity, idempotencyKey, documentId, command));
    }

    @PostMapping("/knowledge-versions/{doc_version_id}/submissions")
    ResponseEntity<KnowledgeDocumentVersionWire> submit(
            HttpServletRequest request,
            @PathVariable("doc_version_id") UUID docVersionId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody KnowledgeVersionSubmitRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(documents.submitVersion(identity, idempotencyKey, docVersionId));
    }

    @PostMapping("/knowledge-versions/{doc_version_id}/publications")
    ResponseEntity<KnowledgeDocumentVersionWire> publish(
            HttpServletRequest request,
            @PathVariable("doc_version_id") UUID docVersionId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody KnowledgeVersionPublishRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(documents.publishVersion(identity, idempotencyKey, docVersionId, command));
    }

    @PostMapping("/knowledge-versions/{doc_version_id}/retirements")
    ResponseEntity<KnowledgeDocumentVersionWire> retire(
            HttpServletRequest request,
            @PathVariable("doc_version_id") UUID docVersionId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody KnowledgeVersionRetireRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(documents.retireVersion(identity, idempotencyKey, docVersionId));
    }
}
