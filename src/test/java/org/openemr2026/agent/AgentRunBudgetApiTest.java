package org.openemr2026.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.AgentRunBudgetDeactivateRequestWire;
import org.openemr2026.contracts.AgentRunBudgetDefineRequestWire;
import org.openemr2026.contracts.AgentRunBudgetUpdateRequestWire;
import org.openemr2026.contracts.AgentRunBudgetWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
@Transactional
final class AgentRunBudgetApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private AgentRunBudgetService budgets;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private AgentRunBudgetWire define(String budgetCode, long tokens, int durationSeconds) {
        return budgets.define(identity(), "budget-" + UUID.randomUUID(),
                new AgentRunBudgetDefineRequestWire(organization, facility, budgetCode,
                        "临床助手运行预算", tokens, durationSeconds));
    }

    @Test
    void givenBudget_whenDefiningAndListing_thenActiveBudgetRecorded() {
        String budgetCode = "BUDGET-" + UUID.randomUUID().toString().substring(0, 8);
        AgentRunBudgetWire defined = define(budgetCode, 100_000L, 300);
        assertThat(defined.status()).isEqualTo(AgentRunBudgetWire.StatusValue.ACTIVE);
        assertThat(defined.maxTokens()).isEqualTo(100_000L);

        List<AgentRunBudgetWire> listed = budgets.listBudgets(identity(), "ACTIVE");
        assertThat(listed).extracting(AgentRunBudgetWire::budgetId).contains(defined.budgetId());
    }

    @Test
    void givenNonPositiveLimits_whenDefining_thenRejected() {
        String budgetCode = "BUDGET-" + UUID.randomUUID().toString().substring(0, 8);
        assertThatThrownBy(() -> define(budgetCode, 0L, 300))
                .isInstanceOf(AgentRunBudgetException.class)
                .satisfies(e -> assertThat(((AgentRunBudgetException) e).code())
                        .isEqualTo("AGENT_RUN_BUDGET_REQUEST_INVALID"));
    }

    @Test
    void givenActiveBudget_whenDeactivating_thenInactive() {
        String budgetCode = "BUDGET-" + UUID.randomUUID().toString().substring(0, 8);
        AgentRunBudgetWire defined = define(budgetCode, 50_000L, 120);
        AgentRunBudgetWire deactivated = budgets.deactivate(identity(), "deact-" + UUID.randomUUID(),
                defined.budgetId(), new AgentRunBudgetDeactivateRequestWire(organization, facility));
        assertThat(deactivated.status()).isEqualTo(AgentRunBudgetWire.StatusValue.INACTIVE);
    }

    @Test
    void givenActiveBudget_whenUpdating_thenNewLimitsAffectItsVersionedDefinition() {
        AgentRunBudgetWire defined = define("BUDGET-" + UUID.randomUUID().toString().substring(0, 8), 50_000L, 120);
        AgentRunBudgetWire updated = budgets.update(identity(), "update-" + UUID.randomUUID(),
                defined.budgetId(), new AgentRunBudgetUpdateRequestWire(
                        organization, facility, "门诊高峰处理额度", 75_000L, 180, defined.rowVersion()));
        assertThat(updated.budgetName()).isEqualTo("门诊高峰处理额度");
        assertThat(updated.maxTokens()).isEqualTo(75_000L);
        assertThat(updated.rowVersion()).isEqualTo(defined.rowVersion() + 1);
    }

    @Test
    void givenBudgetIdentity_whenTampered_thenDatabaseRejectsMutation() {
        String budgetCode = "BUDGET-" + UUID.randomUUID().toString().substring(0, 8);
        AgentRunBudgetWire defined = define(budgetCode, 80_000L, 200);
        assertThatThrownBy(() -> jdbc.sql("""
                update agent_run_budget set max_tokens = 1
                where tenant_id = cast(:tenant as uuid) and budget_id = :budget
                """).param("tenant", TENANT).param("budget", defined.budgetId()).update())
                .isInstanceOf(DataAccessException.class);
    }
}
