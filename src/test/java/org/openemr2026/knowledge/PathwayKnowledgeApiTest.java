package org.openemr2026.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.KnowledgeGraphNeighborsWire;
import org.openemr2026.contracts.KnowledgeGraphNodeWire;
import org.openemr2026.contracts.KnowledgeGraphPathsWire;
import org.openemr2026.contracts.KnowledgeGraphWire;
import org.openemr2026.contracts.PathwayKnowledgeCreateRequestWire;
import org.openemr2026.contracts.PathwayKnowledgeReferenceWire;
import org.openemr2026.contracts.PathwayKnowledgeSearchRequestWire;
import org.openemr2026.contracts.PathwayKnowledgeSearchResultWire;
import org.openemr2026.contracts.PathwayKnowledgeStageInputWire;
import org.openemr2026.contracts.PathwayKnowledgeTaskInputWire;
import org.openemr2026.contracts.PathwayKnowledgeVersionCreateRequestWire;
import org.openemr2026.contracts.PathwayKnowledgeVersionWire;
import org.openemr2026.contracts.PathwayKnowledgeWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class PathwayKnowledgeApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String AUTHOR = "018f0000-0000-7000-8000-00000000aa04";
    private static final String REVIEWER = "018f0000-0000-7000-8000-00000000aa06";
    private static final String APPROVER = "018f0000-0000-7000-8000-00000000aa14";

    @Autowired
    private PathwayKnowledgeService pathways;
    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity(String user) {
        return new ClinicalIdentity(tenant, UUID.fromString(user), List.of());
    }

    private PathwayKnowledgeWire create(String code) {
        return pathways.createKnowledge(identity(AUTHOR), "k-" + UUID.randomUUID(),
                new PathwayKnowledgeCreateRequestWire(organization, facility, code, code + "路径",
                        "NEPHROLOGY", "N00", "纳入标准", "排除标准", 7));
    }

    private PathwayKnowledgeVersionWire createVersion(UUID knowledgeId) {
        List<PathwayKnowledgeStageInputWire> stages = List.of(
                new PathwayKnowledgeStageInputWire("DAY1", "第1天", 1, 1, 1, "完善检查", "评估肾功能",
                        List.of(
                                new PathwayKnowledgeTaskInputWire(
                                        PathwayKnowledgeTaskInputWire.TaskTypeValue.LAB, "尿常规+肾功能", "LAB-001", true, 1),
                                new PathwayKnowledgeTaskInputWire(
                                        PathwayKnowledgeTaskInputWire.TaskTypeValue.MEDICATION, "ACEI 降压", "DRUG-001", true, 2))));
        return pathways.createVersion(identity(AUTHOR), "v-" + UUID.randomUUID(), knowledgeId,
                new PathwayKnowledgeVersionCreateRequestWire(organization, facility, stages, List.of(), List.of()));
    }

    @Test
    void givenPathway_whenPublished_thenExecutionConfigGeneratedAndSearchable() {
        String code = "PATH-" + UUID.randomUUID().toString().substring(0, 8);
        PathwayKnowledgeWire knowledge = create(code);
        PathwayKnowledgeVersionWire version = createVersion(knowledge.pathwayKnowledgeId());

        assertThat(version.status()).isEqualTo(PathwayKnowledgeVersionWire.StatusValue.DRAFT);

        pathways.submitVersion(identity(AUTHOR), "s-" + UUID.randomUUID(), version.pathwayVersionId());
        assertThat(pathways.listVersions(identity(AUTHOR), knowledge.pathwayKnowledgeId()).get(0).status())
                .isEqualTo(PathwayKnowledgeVersionWire.StatusValue.IN_REVIEW);

        pathways.reviewVersion(identity(REVIEWER), "r-" + UUID.randomUUID(), version.pathwayVersionId());
        pathways.approveVersion(identity(APPROVER), "a-" + UUID.randomUUID(), version.pathwayVersionId());

        PathwayKnowledgeVersionWire published = pathways
                .listVersions(identity(AUTHOR), knowledge.pathwayKnowledgeId()).get(0);
        assertThat(published.status()).isEqualTo(PathwayKnowledgeVersionWire.StatusValue.ACTIVE);

        // 发布生成执行配置
        long definitionCount = jdbc.sql("""
                select count(*) from clinical_pathway_definition
                where tenant_id = cast(:tenant as uuid) and pathway_code = :code
                """).param("tenant", TENANT).param("code", code).query(Long.class).single();
        assertThat(definitionCount).isEqualTo(1);
        long stageCount = jdbc.sql("""
                select count(*) from clinical_pathway_stage stage
                join clinical_pathway_version version on version.tenant_id = stage.tenant_id
                  and version.pathway_version_id = stage.pathway_version_id
                join clinical_pathway_definition definition on definition.tenant_id = version.tenant_id
                  and definition.pathway_definition_id = version.pathway_definition_id
                where stage.tenant_id = cast(:tenant as uuid) and definition.pathway_code = :code
                """).param("tenant", TENANT).param("code", code).query(Long.class).single();
        assertThat(stageCount).isEqualTo(1);

        PathwayKnowledgeSearchResultWire result = pathways.search(identity(AUTHOR),
                new PathwayKnowledgeSearchRequestWire(organization, facility, code, null, null, 20));
        assertThat(result.references()).isNotEmpty();
        assertThat(result.references()).extracting(PathwayKnowledgeReferenceWire::pathwayKnowledgeId)
                .contains(knowledge.pathwayKnowledgeId());
    }

    @Test
    void givenSubmittedPathway_whenSubmitterReviews_thenRejected() {
        String code = "PATH-" + UUID.randomUUID().toString().substring(0, 8);
        PathwayKnowledgeWire knowledge = create(code);
        PathwayKnowledgeVersionWire version = createVersion(knowledge.pathwayKnowledgeId());
        pathways.submitVersion(identity(AUTHOR), "s-" + UUID.randomUUID(), version.pathwayVersionId());

        assertThatThrownBy(() -> pathways.reviewVersion(identity(AUTHOR), "r-" + UUID.randomUUID(),
                version.pathwayVersionId()))
                .isInstanceOf(PathwayKnowledgeException.class)
                .hasMessageContaining("cannot review their own pathway");
    }

    @Test
    void givenSeededGraph_whenQueryingRelations_thenPredicatesNeighborsAndPathsReturned() {
        record Pair(UUID from, UUID to) {}
        Pair pair = jdbc.sql("""
                select r.from_concept as f, r.to_concept as t from knowledge_relation r
                where r.tenant_id = cast(:tenant as uuid) limit 1
                """).param("tenant", TENANT).query((rs, row) ->
                new Pair(rs.getObject("f", UUID.class), rs.getObject("t", UUID.class))).single();

        KnowledgeGraphWire graph = pathways.graph(identity(AUTHOR), 50);
        assertThat(graph.edges()).isNotEmpty();
        assertThat(graph.edges()).allMatch(e -> e.predicate() != null && !e.predicate().isBlank());

        KnowledgeGraphNeighborsWire neighbors = pathways.neighbors(identity(AUTHOR), pair.from());
        assertThat(neighbors.node()).isNotNull();
        assertThat(neighbors.outgoing()).isNotEmpty();

        KnowledgeGraphPathsWire paths = pathways.paths(identity(AUTHOR), pair.from(), pair.to(), 3);
        assertThat(paths.paths()).isNotEmpty();
        assertThat(paths.paths().get(0).nodes().get(0).id()).isEqualTo(pair.from());
        assertThat(paths.paths().get(0).nodes().get(paths.paths().get(0).nodes().size() - 1).id()).isEqualTo(pair.to());
    }

    @Test
    void givenSeededGraph_whenExpandingEgo_thenNeighborhoodReturned() {
        record Pair(UUID from, UUID to) {}
        Pair pair = jdbc.sql("""
                select r.from_concept as f, r.to_concept as t from knowledge_relation r
                where r.tenant_id = cast(:tenant as uuid) limit 1
                """).param("tenant", TENANT).query((rs, row) ->
                new Pair(rs.getObject("f", UUID.class), rs.getObject("t", UUID.class))).single();

        KnowledgeGraphWire ego = pathways.ego(identity(AUTHOR), pair.from(), 1, 200);
        assertThat(ego.nodes()).extracting(KnowledgeGraphNodeWire::id).contains(pair.from(), pair.to());
        assertThat(ego.edges()).isNotEmpty();
    }

    @Test
    void givenActivePathway_whenRetired_thenExecutionConfigRetired() {
        String code = "PATH-" + UUID.randomUUID().toString().substring(0, 8);
        PathwayKnowledgeWire knowledge = create(code);
        PathwayKnowledgeVersionWire version = createVersion(knowledge.pathwayKnowledgeId());
        pathways.submitVersion(identity(AUTHOR), "s-" + UUID.randomUUID(), version.pathwayVersionId());
        pathways.reviewVersion(identity(REVIEWER), "r-" + UUID.randomUUID(), version.pathwayVersionId());
        pathways.approveVersion(identity(APPROVER), "a-" + UUID.randomUUID(), version.pathwayVersionId());

        pathways.retireVersion(identity(AUTHOR), "t-" + UUID.randomUUID(), version.pathwayVersionId());
        long activeDefinitionCount = jdbc.sql("""
                select count(*) from clinical_pathway_definition
                where tenant_id = cast(:tenant as uuid) and pathway_code = :code and status = 'ACTIVE'
                """).param("tenant", TENANT).param("code", code).query(Long.class).single();
        assertThat(activeDefinitionCount).isEqualTo(0);
    }
}
