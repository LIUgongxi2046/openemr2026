package org.openemr2026.knowledge;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openemr2026.contracts.KnowledgeDocumentCreateRequestWire;
import org.openemr2026.contracts.KnowledgeDocumentVersionWire;
import org.openemr2026.contracts.KnowledgeImportBatchWire;
import org.openemr2026.contracts.KnowledgeImportRequestWire;
import org.openemr2026.contracts.KnowledgeSearchRequestWire;
import org.openemr2026.contracts.KnowledgeSearchResultWire;
import org.openemr2026.contracts.KnowledgeSourceRegisterRequestWire;
import org.openemr2026.contracts.KnowledgeSourceWire;
import org.openemr2026.contracts.KnowledgeVersionCreateRequestWire;
import org.openemr2026.contracts.KnowledgeVersionPublishRequestWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class KnowledgeCenterApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private KnowledgeSourceService sources;
    @Autowired
    private KnowledgeDocumentService documents;
    @Autowired
    private KnowledgeSearchService search;
    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    @Test
    void givenObsidianSource_whenReadOnlySelectiveImport_thenExcludedFilesSkippedAndSourceUnchanged(@TempDir Path root)
            throws Exception {
        Path included = root.resolve("医学结构化数据/图谱详情/疾病/ys-online/450_t119.md");
        Path excluded = root.resolve("知识详情/04_七巧板医学术语集/sample.md");
        Files.createDirectories(included.getParent());
        Files.createDirectories(excluded.getParent());
        Files.writeString(included, "---\n分类: 疾病\n系统: ys-online\n表名: t119\n---\n\n# t119\n\n高血压用药注意事项", StandardCharsets.UTF_8);
        Files.writeString(excluded, "# 七巧板术语条目\n\n不应被导入", StandardCharsets.UTF_8);
        byte[] includedBefore = Files.readAllBytes(included);

        String sourceCode = "OBS-" + UUID.randomUUID().toString().substring(0, 8);
        KnowledgeSourceWire source = sources.register(identity(), "src-" + UUID.randomUUID(),
                new KnowledgeSourceRegisterRequestWire(organization, facility, sourceCode,
                        "测试 Obsidian 库", KnowledgeSourceRegisterRequestWire.SourceKindValue.OBSIDIAN_VAULT,
                        root.toString(), null, null, KnowledgeSourceRegisterRequestWire.SensitivityValue.INTERNAL,
                        null, null));
        assertThat(source.status()).isEqualTo(KnowledgeSourceWire.StatusValue.REGISTERED);

        KnowledgeImportBatchWire batch = sources.importSource(identity(), "imp-" + UUID.randomUUID(),
                source.sourceId(), new KnowledgeImportRequestWire(organization, facility, "v1"));
        assertThat(batch.status()).isEqualTo(KnowledgeImportBatchWire.StatusValue.COMPLETED);
        assertThat(batch.importedRowCount()).isEqualTo(1);
        assertThat(batch.skippedRowCount()).isEqualTo(1);

        long docCount = jdbc.sql("""
                select count(*) from knowledge_document
                where tenant_id = cast(:tenant as uuid) and document_code like 'obsidian.%'
                """).param("tenant", TENANT).query(Long.class).single();
        assertThat(docCount).isEqualTo(1);

        // 源文件未被修改（只读约束）
        assertThat(Files.readAllBytes(included)).isEqualTo(includedBefore);
    }

    @Test
    void givenDocument_whenMaintainedAndPublished_thenActiveVersionSearchable() {
        String code = "DOC-" + UUID.randomUUID().toString().substring(0, 8);
        documents.createDocument(identity(), "doc-" + UUID.randomUUID(),
                new KnowledgeDocumentCreateRequestWire(organization, facility, code,
                        KnowledgeDocumentCreateRequestWire.ContentTypeValue.GUIDELINE,
                        "高血压诊疗指南", "国家指南", null,
                        KnowledgeDocumentCreateRequestWire.ClassificationValue.INTERNAL, null, null));
        UUID documentId = jdbc.sql("""
                select document_id from knowledge_document
                where tenant_id = cast(:tenant as uuid) and document_code = :code
                """).param("tenant", TENANT).param("code", code).query(UUID.class).single();

        KnowledgeDocumentVersionWire draft = documents.createVersion(identity(), "v-" + UUID.randomUUID(),
                documentId, new KnowledgeVersionCreateRequestWire(organization, facility,
                        "高血压诊断标准为诊室血压≥140/90mmHg，需结合家庭自测血压综合判断。", Map.of()));
        assertThat(draft.status()).isEqualTo(KnowledgeDocumentVersionWire.StatusValue.DRAFT);

        KnowledgeDocumentVersionWire reviewed = documents.submitVersion(identity(), "sub-" + UUID.randomUUID(),
                draft.docVersionId());
        assertThat(reviewed.status()).isEqualTo(KnowledgeDocumentVersionWire.StatusValue.IN_REVIEW);

        KnowledgeDocumentVersionWire published = documents.publishVersion(identity(), "pub-" + UUID.randomUUID(),
                draft.docVersionId(), new KnowledgeVersionPublishRequestWire(organization, facility, Instant.now()));
        assertThat(published.status()).isEqualTo(KnowledgeDocumentVersionWire.StatusValue.ACTIVE);

        KnowledgeSearchResultWire result = search.search(identity(),
                new KnowledgeSearchRequestWire(organization, facility, "高血压", null, null, 20));
        assertThat(result.references()).isNotEmpty();
        assertThat(result.references().get(0).sourceId()).isEqualTo(draft.docVersionId().toString());
        assertThat(result.references().get(0).contentHash()).isEqualTo(draft.contentHash());
    }

    @Test
    void givenActiveVersion_whenPublishingNewer_thenPreviousRetired() {
        String code = "DOC-" + UUID.randomUUID().toString().substring(0, 8);
        documents.createDocument(identity(), "doc-" + UUID.randomUUID(),
                new KnowledgeDocumentCreateRequestWire(organization, facility, code,
                        KnowledgeDocumentCreateRequestWire.ContentTypeValue.GUIDELINE,
                        "糖尿病诊疗指南", "国家指南", null,
                        KnowledgeDocumentCreateRequestWire.ClassificationValue.INTERNAL, null, null));
        UUID documentId = jdbc.sql("""
                select document_id from knowledge_document
                where tenant_id = cast(:tenant as uuid) and document_code = :code
                """).param("tenant", TENANT).param("code", code).query(UUID.class).single();

        KnowledgeDocumentVersionWire v1 = documents.createVersion(identity(), "v1-" + UUID.randomUUID(),
                documentId, new KnowledgeVersionCreateRequestWire(organization, facility, "第一版内容", Map.of()));
        documents.submitVersion(identity(), "s1-" + UUID.randomUUID(), v1.docVersionId());
        documents.publishVersion(identity(), "p1-" + UUID.randomUUID(), v1.docVersionId(),
                new KnowledgeVersionPublishRequestWire(organization, facility, Instant.now()));

        KnowledgeDocumentVersionWire v2 = documents.createVersion(identity(), "v2-" + UUID.randomUUID(),
                documentId, new KnowledgeVersionCreateRequestWire(organization, facility, "第二版内容", Map.of()));
        documents.submitVersion(identity(), "s2-" + UUID.randomUUID(), v2.docVersionId());
        documents.publishVersion(identity(), "p2-" + UUID.randomUUID(), v2.docVersionId(),
                new KnowledgeVersionPublishRequestWire(organization, facility, Instant.now()));

        long activeCount = jdbc.sql("""
                select count(*) from knowledge_document_version
                where tenant_id = cast(:tenant as uuid) and document_id = cast(:document as uuid) and status = 'ACTIVE'
                """).param("tenant", TENANT).param("document", documentId.toString()).query(Long.class).single();
        assertThat(activeCount).isEqualTo(1);
    }
}
