package org.openemr2026.agent;

import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * AI 医助 Eva 的运行时编排骨架。
 *
 * <p>当前编排模型是「主医助（stage=ALL）+ 专科子医助（按 stage_code）」的组合；
 * 前端在打开对话时按路由选择主医助，harness 再按 stage_code 分派子医助。本服务把
 * 「路由 → 主医助 + 阶段」的决策集中到后端，作为后续动态编排（例如按消息意图分类、
 * 多医助计划拆解）的挂载点。现阶段只提供确定性路由解析，不改变既有 harness 行为。</p>
 */
@Service
final class AgentOrchestrator {

    /** 编排决策结果：主医助编码 + 首选阶段。 */
    record Routing(String mainAgentCode, String stageCode) {}

    /**
     * 按路由解析默认的主医助与阶段；未命中时回落到就诊事实总协调。
     */
    Routing resolve(String routeId) {
        if (routeId == null || routeId.isBlank()) {
            return new Routing("ENCOUNTER_SUMMARIZER", "ACTIVE_ENCOUNTER");
        }
        String id = routeId.toLowerCase(Locale.ROOT);
        return switch (id) {
            // 病历与质控
            case "record", "record-qc", "record-versions",
                 "quality-center", "department-qc" -> new Routing("RECORD_QC", "ACTIVE_RECORD");
            case "record-editor", "opd-record", "er-record" -> new Routing("DOCUMENT_DRAFTER", "OUTPATIENT");
            // 结果闭环
            case "opd-results", "lis-report", "pacs-viewer" ->
                    new Routing("RESULT_FOLLOWUP_COORDINATOR", "NEW_RESULT");
            // 诊疗协同
            case "opd-consult" -> new Routing("CARE_COORDINATOR", "CONSULT");
            case "opd-followup" -> new Routing("CARE_COORDINATOR", "FOLLOWUP");
            case "inpatient-course" -> new Routing("DOCUMENT_DRAFTER", "FIRST_COURSE");
            case "inpatient" -> new Routing("ENCOUNTER_SUMMARIZER", "INPATIENT_DAILY");
            case "emergency", "er-triage" -> new Routing("ENCOUNTER_SUMMARIZER", "TRIAGE");
            // 院感监测
            case "infection-events" -> new Routing("INFECTION_SURVEILLANCE", "INFECTION_CASE");
            // 医保合规
            case "billing" -> new Routing("INSURANCE_COMPLIANCE", "CHARGE");
            // 医技预约调度
            case "lab-workbench" -> new Routing("MEDICAL_TECH_SCHEDULING", "EXAM_SLOT");
            case "imaging-workbench" -> new Routing("MEDICAL_TECH_SCHEDULING", "EQUIPMENT");
            // 科研随访
            case "research", "cohort-builder" -> new Routing("RESEARCH_FOLLOWUP", "COHORT");
            // 患者宣教
            case "inpatient-discharge" -> new Routing("PATIENT_EDUCATION", "MEDICATION_GUIDE");
            // 默认：就诊事实总协调
            default -> new Routing("ENCOUNTER_SUMMARIZER", "ACTIVE_ENCOUNTER");
        };
    }
}
