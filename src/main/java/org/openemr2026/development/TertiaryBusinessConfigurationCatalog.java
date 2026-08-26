package org.openemr2026.development;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Deterministic, non-patient tertiary-hospital configuration fixtures for dev-synthetic. */
final class TertiaryBusinessConfigurationCatalog {

    private static final List<String> PROTECTED_MODULES = List.of(
            "CORE_PATIENT", "CLINICAL_RECORD", "DIGITAL_SIGNATURE", "AUDIT_OUTBOX");

    private TertiaryBusinessConfigurationCatalog() { }

    static List<ConfigurationSeed> configurations() {
        return List.of(
                new ConfigurationSeed(id("c101"), id("c321"), "WORKFLOW",
                        "syn-workflow-closed-loop-v1", "runtime-workflow-consult-v1",
                        "三级医院门急住一体化闭环流程", workflowPayload()),
                new ConfigurationSeed(id("c102"), id("c322"), "FORM_TEMPLATE",
                        "syn-medical-record-v1", "runtime-form-record-v1",
                        "三级医院结构化病历模板集", formPayload()),
                new ConfigurationSeed(id("c103"), id("c323"), "RULE",
                        "syn-clinical-safety-v1", "runtime-rule-safety-v1",
                        "三级医院临床安全与时限规则集", rulePayload()),
                new ConfigurationSeed(id("c104"), id("c324"), "SCOPE",
                        "syn-role-scope-v1", "runtime-scope-clinical-v1",
                        "三级医院角色职责与数据范围", scopePayload()));
    }

    static List<CapabilityPackSeed> capabilityPacks() {
        String core = "SYN-CORE-CLINICAL";
        String tertiary = "SYN-TERTIARY-HOSPITAL";
        return List.of(
                pack("c301", "c601", "c701", core, "临床核心能力包", null,
                        "全院公共内核", List.of("CORE_PATIENT", "CLINICAL_RECORD", "ORDER_RESULT", "DIGITAL_SIGNATURE", "AUDIT_OUTBOX")),
                pack("c302", "c602", "c702", tertiary, "三级医院综合能力包", core,
                        "全院门急住医技", List.of("CORE_PATIENT", "CLINICAL_RECORD", "ORDER_RESULT", "DIGITAL_SIGNATURE", "AUDIT_OUTBOX", "OUTPATIENT", "EMERGENCY", "INPATIENT", "NURSING", "MEDICAL_TECH", "QUALITY_RESEARCH")),
                pack("c331", "c603", "c703", "SYN-OUTPATIENT", "门诊诊疗能力包", tertiary,
                        "门诊部", baseline("OUTPATIENT")),
                pack("c332", "c604", "c704", "SYN-EMERGENCY", "急诊急救能力包", tertiary,
                        "急诊医学科", baseline("EMERGENCY", "CRITICAL_CARE")),
                pack("c333", "c605", "c705", "SYN-INPATIENT", "住院诊疗能力包", tertiary,
                        "住院部", baseline("INPATIENT", "NURSING")),
                pack("c334", "c606", "c706", "SYN-NURSING", "临床护理能力包", tertiary,
                        "护理部", baseline("NURSING")),
                pack("c335", "c607", "c707", "SYN-SURGERY", "围术期管理能力包", tertiary,
                        "手术部", baseline("SURGERY", "ANESTHESIA", "CRITICAL_CARE")),
                pack("c336", "c608", "c708", "SYN-CRITICAL-CARE", "重症医学能力包", tertiary,
                        "重症医学科", baseline("CRITICAL_CARE", "NURSING")),
                pack("c337", "c609", "c709", "SYN-MEDICAL-TECH", "医技协同能力包", tertiary,
                        "医技科室", baseline("MEDICAL_TECH")),
                pack("c338", "c60a", "c70a", "SYN-QUALITY-RESEARCH", "质控科研能力包", tertiary,
                        "医务处与科研处", baseline("QUALITY_RESEARCH")),
                pack("c303", "c304", "c70b", "SYN-CARDIOLOGY", "心血管专科能力包", tertiary,
                        "心血管内科", baseline("SPECIALTY_CARDIOLOGY")),
                pack("c339", "c60c", "c70c", "SYN-PEDIATRICS", "儿科专科能力包", tertiary,
                        "儿科", baseline("SPECIALTY_PEDIATRICS")),
                pack("c340", "c60d", "c70d", "SYN-MENTAL-HEALTH", "精神心理专科能力包", tertiary,
                        "精神心理科", baseline("SPECIALTY_MENTAL_HEALTH")),
                pack("c341", "c60e", "c70e", "SYN-ONCOLOGY", "肿瘤诊疗能力包", tertiary,
                        "肿瘤科", baseline("SPECIALTY_ONCOLOGY")),
                pack("c342", "c60f", "c70f", "SYN-OBSTETRICS", "妇产诊疗能力包", tertiary,
                        "妇产科", baseline("SPECIALTY_OBSTETRICS")));
    }

    static List<SpecialtySeed> specialties() {
        return List.of(
                specialty("c411", "ab15", "c401", "GENERAL_MEDICINE", "全科医学", "GENERAL_AVAILABLE", "SYN-SP-GENERAL", List.of("record", "order", "result", "followup")),
                specialty("c412", "aa08", "c402", "CARDIOLOGY", "心血管内科", "BASIC_CLOSED_LOOP", "SYN-SP-CARDIOLOGY", List.of("ecg", "critical-value", "cath-lab", "consult")),
                specialty("c413", "ab04", "c403", "PEDIATRICS", "儿科", "BASIC_CLOSED_LOOP", "SYN-SP-PEDIATRICS", List.of("weight-dose", "growth-chart", "neonatal-handoff")),
                specialty("c414", "ab14", "c404", "MENTAL_HEALTH", "精神心理科", "BASIC_CLOSED_LOOP", "SYN-SP-MENTAL-HEALTH", List.of("consent", "crisis", "restricted-record")),
                specialty("c415", "ab01", "c405", "EMERGENCY_MEDICINE", "急诊医学科", "BASIC_CLOSED_LOOP", "SYN-SP-EMERGENCY", List.of("triage", "resuscitation", "observation", "green-channel")),
                specialty("c416", "ab02", "c406", "NEUROLOGY", "神经内科", "BASIC_CLOSED_LOOP", "SYN-SP-NEUROLOGY", List.of("stroke", "nihss", "thrombolysis")),
                specialty("c417", "ab03", "c407", "GENERAL_SURGERY", "普通外科", "BASIC_CLOSED_LOOP", "SYN-SP-SURGERY", List.of("preop", "operation", "postop", "pathology")),
                specialty("c418", "ab05", "c408", "LABORATORY_MEDICINE", "医学检验科", "GENERAL_AVAILABLE", "SYN-SP-LAB", List.of("lis", "specimen", "critical-value", "qc")),
                specialty("c419", "ab06", "c409", "RADIOLOGY", "医学影像科", "GENERAL_AVAILABLE", "SYN-SP-RADIOLOGY", List.of("ris", "pacs", "structured-report", "critical-image")),
                specialty("c41a", "admin:OBSTETRICS", "c40a", "OBSTETRICS", "妇产科", "BASIC_CLOSED_LOOP", "SYN-SP-OBSTETRICS", List.of("antenatal", "delivery", "postpartum", "newborn")),
                specialty("c41b", "admin:ONCOLOGY", "c40b", "ONCOLOGY", "肿瘤科", "BASIC_CLOSED_LOOP", "SYN-SP-ONCOLOGY", List.of("staging", "mdt", "chemotherapy", "followup")),
                specialty("c41c", "admin:ICU", "c40c", "CRITICAL_CARE", "重症医学科", "BASIC_CLOSED_LOOP", "SYN-SP-ICU", List.of("sofa", "ventilator", "sepsis", "handoff")),
                specialty("c41d", "admin:ANESTHESIOLOGY", "c40d", "ANESTHESIOLOGY", "麻醉科", "BASIC_CLOSED_LOOP", "SYN-SP-ANESTHESIA", List.of("assessment", "anesthesia", "pacu", "controlled-drug")),
                specialty("c41e", "admin:PATHOLOGY", "c40e", "PATHOLOGY", "病理科", "GENERAL_AVAILABLE", "SYN-SP-PATHOLOGY", List.of("specimen", "gross", "microscopy", "report")),
                specialty("c41f", "admin:PHARMACY", "c40f", "PHARMACY", "药学部", "GENERAL_AVAILABLE", "SYN-SP-PHARMACY", List.of("prescription-review", "dispensing", "antimicrobial", "adverse-reaction")),
                specialty("c420", "admin:REHABILITATION", "c410", "REHABILITATION", "康复医学科", "BASIC_CLOSED_LOOP", "SYN-SP-REHABILITATION", List.of("assessment", "plan", "therapy", "outcome")));
    }

    static Map<String, Object> compositionPayload(CapabilityPackSeed pack) {
        List<Map<String, Object>> dependencies = new ArrayList<>();
        for (String module : pack.modules()) {
            if (!"CORE_PATIENT".equals(module)) dependencies.add(object("module", module, "requires", "CORE_PATIENT"));
        }
        return object(
                "schema_version", 2,
                "capability_pack_id", pack.packId().toString(),
                "inherits_from", pack.inheritsFrom(),
                "selected_modules", pack.modules(),
                "dependencies", dependencies,
                "conflicts", List.of(object("left", "LEGACY_EXPORT", "right", "QUALITY_RESEARCH")),
                "protected_modules", PROTECTED_MODULES,
                "scope_overrides", List.of(object("scope", pack.scope(), "module", pack.modules().getLast(), "effect", "ENABLE")),
                "rating_impact", pack.packCode().equals("SYN-CORE-CLINICAL") ? "通用可用 · B" : "三级医院闭环 · A",
                "rollout_tasks", List.of("依赖解析", "128 例合成病例回放", "科室负责人联合签署", "灰度观察 72 小时", "审计与回退演练"));
    }

    private static Map<String, Object> workflowPayload() {
        return base("覆盖门诊、急诊、住院、医技、会诊、转科、出院和病案归档的三级医院闭环流程。")
                .with("nodes", List.of(
                        node("registration", "实名建档与就诊登记", "START", "门诊部/急诊预检", 5, false, false),
                        node("triage", "分诊与风险分级", "TASK", "分诊护士", 10, false, false),
                        node("resuscitation", "急危重症抢救", "TASK", "急诊抢救团队", 15, false, false),
                        node("assessment", "医师接诊评估", "TASK", "经治医生", 30, false, false),
                        node("orders", "医嘱与检查申请", "TASK", "经治医生", 20, false, false),
                        node("results", "医技结果审核", "TASK", "医技审核人员", 120, false, false),
                        node("critical", "危急值闭环处置", "TASK", "经治医生与科主任", 10, false, false),
                        node("consult", "多学科会诊", "TASK", "会诊专家组", 120, false, false),
                        node("treatment", "诊疗计划执行", "TASK", "医护药技团队", 240, false, false),
                        node("handoff", "入院转科与交接", "TASK", "床位医师与责任护士", 30, false, false),
                        node("discharge", "出院审核与随访计划", "TASK", "经治医生与护士", 60, false, false),
                        node("sign", "病历数字签署", "SIGN", "经治医生/上级医师", 20, true, false),
                        node("audit", "病案质控与审计", "AUDIT", "病案室与质控办", 1440, true, false),
                        node("complete", "就诊闭环完成", "END", "系统", 1, true, true)),
                "edges", List.of(
                        edge("registration", "triage", "登记成功", false),
                        edge("triage", "resuscitation", "分级为 I/II 级", false),
                        edge("triage", "assessment", "生命体征稳定", false),
                        edge("resuscitation", "assessment", "抢救后生命体征稳定", false),
                        edge("assessment", "orders", "诊疗计划已形成", false),
                        edge("orders", "results", "医技项目已执行", false),
                        edge("results", "critical", "结果命中危急值", false),
                        edge("results", "consult", "疑难复杂或跨学科", false),
                        edge("results", "treatment", "常规结果已审核", false),
                        edge("critical", "treatment", "危急值已确认并处置", false),
                        edge("consult", "treatment", "会诊意见已签署", false),
                        edge("treatment", "handoff", "需要住院或转科", false),
                        edge("treatment", "discharge", "门急诊治疗完成", false),
                        edge("handoff", "discharge", "达到出院标准", false),
                        edge("discharge", "sign", "出院记录与随访计划完成", false),
                        edge("sign", "audit", "签名及时间戳有效", false),
                        edge("audit", "complete", "病案完整性检查通过", false),
                        edge("consult", "assessment", "资料不全退回补充", true),
                        edge("handoff", "treatment", "病情恶化启动补偿流程", true)),
                "protected_nodes", List.of("sign", "audit", "complete"),
                "timeout_policy", "危急值 10 分钟、急会诊 30 分钟、普通会诊 120 分钟、出院病历 24 小时逐级升级",
                "escalation_chain", List.of("责任人", "科主任", "医务处值班", "医疗质量委员会"),
                "synthetic_cases", List.of("急性心肌梗死绿色通道", "脑卒中溶栓", "多发伤抢救转 ICU", "复杂肿瘤 MDT"));
    }

    private static Map<String, Object> formPayload() {
        List<Map<String, Object>> groups = List.of(
                group("identity", "患者与就诊", 2), group("complaint", "主诉与现病史", 2),
                group("history", "既往史与风险", 2), group("exam", "体格检查与评分", 3),
                group("orders", "医嘱与结果", 2), group("assessment", "诊断与计划", 2),
                group("consent", "知情同意与签署", 2));
        List<Map<String, Object>> fields = List.of(
                field("patient_name", "患者姓名", "TEXT", "identity", true, true, null, null),
                field("encounter_no", "就诊号", "TEXT", "identity", true, true, null, null),
                field("encounter_type", "就诊类型", "SELECT", "identity", true, false, "ENCOUNTER_TYPE", null),
                field("department", "接诊科室", "CODE", "identity", true, false, "OPENEMR-DEPARTMENT", null),
                field("chief_complaint", "主诉", "TEXTAREA", "complaint", true, false, "SNOMED-CT", null),
                field("present_illness", "现病史", "TEXTAREA", "complaint", true, false, "SNOMED-CT", null),
                field("symptom_onset", "症状起始时间", "DATETIME", "complaint", true, false, null, null),
                field("allergies", "过敏史", "CODE", "history", true, false, "SNOMED-CT", null),
                field("medication_history", "用药史", "TEXTAREA", "history", false, false, "ATC", null),
                field("past_history", "既往史", "TEXTAREA", "history", false, false, "ICD-10-CN", null),
                field("pregnancy_status", "妊娠状态", "SELECT", "history", false, false, null, null),
                field("temperature", "体温", "NUMBER", "exam", true, false, "UCUM", null),
                field("blood_pressure", "血压", "TEXT", "exam", true, false, "UCUM", null),
                field("heart_rate", "心率", "NUMBER", "exam", true, false, "UCUM", null),
                field("spo2", "血氧饱和度", "NUMBER", "exam", true, false, "UCUM", null),
                field("pain_score", "疼痛评分", "NUMBER", "exam", true, false, null, null),
                field("early_warning", "早期预警评分", "CALCULATED", "exam", true, true, null, "NEWS2(temperature,blood_pressure,heart_rate,spo2)"),
                field("orders_summary", "医嘱摘要", "TEXTAREA", "orders", true, false, null, null),
                field("critical_values", "危急值记录", "TEXTAREA", "orders", false, true, "LOINC", null),
                field("primary_diagnosis", "主要诊断", "CODE", "assessment", true, true, "ICD-10-CN", null),
                field("secondary_diagnosis", "其他诊断", "CODE", "assessment", false, false, "ICD-10-CN", null),
                field("treatment_plan", "诊疗计划", "TEXTAREA", "assessment", true, false, null, null),
                field("followup_plan", "随访计划", "TEXTAREA", "assessment", false, false, null, null),
                field("consent_record", "知情同意记录", "TEXTAREA", "consent", true, true, null, null),
                field("clinician_signature", "医生数字签名", "SIGNATURE", "consent", true, true, null, null),
                field("supervisor_signature", "上级医师签名", "SIGNATURE", "consent", false, true, null, null));
        return base("覆盖门诊病历、急诊记录、住院首次病程、会诊、交接、出院和知情同意的结构化模板集。")
                .with("groups", groups, "fields", fields,
                        "terminology_mapping", List.of(
                                object("field", "primary_diagnosis", "system", "ICD-10-CN"),
                                object("field", "chief_complaint", "system", "SNOMED-CT"),
                                object("field", "critical_values", "system", "LOINC"),
                                object("field", "temperature", "system", "UCUM"),
                                object("field", "medication_history", "system", "ATC")),
                        "print_template", "A4-三级医院统一病历-v3",
                        "template_profiles", List.of("门诊病历", "急诊病历", "住院病历", "会诊记录", "出院记录", "知情同意书"));
    }

    private static Map<String, Object> rulePayload() {
        List<Map<String, Object>> rules = List.of(
                rule("allergy-block", "严重过敏处方阻断", "PLATFORM_HARD", 1200, "严重过敏且药物成分命中", "阻断处方并要求选择替代药", "国家药品不良反应监测规范"),
                rule("duplicate-medication", "重复用药阻断", "PLATFORM_HARD", 1150, "同成分或同治疗分类重复", "阻断重复医嘱并展示现有医嘱", "处方管理办法"),
                rule("high-alert-double-check", "高警示药品双人核对", "INSTITUTION_HARD", 1100, "高警示药品或浓缩电解质", "要求医师与药师双签", "三级医院高警示药品目录 2026"),
                rule("renal-dose", "肾功能剂量校验", "INSTITUTION_HARD", 1050, "eGFR 低于药品阈值", "阻断超剂量并给出肾功能剂量范围", "医院药事委员会肾功能剂量规范"),
                rule("pediatric-dose", "儿科体重剂量校验", "INSTITUTION_HARD", 1000, "年龄小于 14 岁且体重已记录", "超出 mg/kg 范围时阻断", "院内儿科用药目录 2026.2"),
                rule("pregnancy-contraindication", "妊娠禁忌用药校验", "INSTITUTION_HARD", 950, "妊娠状态与禁忌药物同时命中", "阻断并要求专科会诊", "妊娠期用药安全规范"),
                rule("critical-value", "危急值十分钟闭环", "INSTITUTION_HARD", 900, "检验或影像结果命中危急值", "10 分钟内确认并创建处置任务", "危急值报告制度"),
                rule("sepsis-screening", "脓毒症早期筛查", "INSTITUTION_HARD", 850, "qSOFA/NEWS2 达到阈值", "启动脓毒症路径和乳酸复查", "Sepsis 3.0 与医院急救路径"),
                rule("vte-risk", "住院 VTE 风险评估", "INSTITUTION_HARD", 800, "入院或术后 24 小时未评估", "阻断病程提交并创建评估任务", "国家医疗质量安全改进目标"),
                rule("consult-timeout", "会诊超时升级", "REMINDER", 600, "急会诊 30 分钟或普通会诊 120 分钟未响应", "提醒科主任并升级医务处", "医疗核心制度"),
                rule("pending-result", "出院未回结果追踪", "REMINDER", 550, "出院时存在未回重要结果", "创建结果追踪和患者通知任务", "检查检验结果闭环制度"),
                rule("record-completion", "病历完成时限提醒", "REMINDER", 500, "出院记录或首次病程接近时限", "提醒责任人与上级医师", "病历书写基本规范"),
                rule("antimicrobial-review", "抗菌药物 72 小时复评", "REMINDER", 450, "限制级抗菌药物使用达到 72 小时", "提醒感染评估与降阶梯", "抗菌药物临床应用管理办法"),
                rule("ai-summary", "AI 病情摘要建议", "AI_ADVICE", 100, "资料完整度达到 80%", "生成带来源的摘要候选供医生确认", "clinical-ai-golden-v1"));
        return base("覆盖用药安全、危急值、脓毒症、VTE、抗菌药物、会诊和病历时限的三级医院规则集。")
                .with("conditions", List.of("患者特征", "诊断与过敏", "医嘱", "检验检查", "任务时限"),
                        "actions", List.of("阻断", "双签", "创建任务", "逐级提醒", "人工确认建议"),
                        "rule_layer", "MIXED", "rules", rules,
                        "sample_case", object("case_id", "SYN-TERTIARY-RULE-01", "scenario", "急诊胸痛患者合并严重青霉素过敏和肾功能不全"));
    }

    private static Map<String, Object> scopePayload() {
        List<Map<String, Object>> permissions = List.of(
                permission("门诊经治医生", "门诊病历", "读写", "本人接诊患者", "ALLOW", 0, "签署后更正需上级复核"),
                permission("急诊医生", "急诊全量病历", "读写", "当前急诊患者", "ALLOW", 0, "抢救结束后自动收窄"),
                permission("住院经治医生", "住院病历与医嘱", "读写", "本人医疗组患者", "ALLOW", 0, "上级医师完成最终签署"),
                permission("会诊医生", "病历全文", "只读", "会诊授权患者", "ALLOW", 4, "禁止导出和转授权"),
                permission("责任护士", "护理记录与医嘱执行", "读写", "本人病区患者", "ALLOW", 0, "护理审核人与作者分离"),
                permission("临床药师", "用药相关病历与处方", "审核", "药学服务患者", "ALLOW", 8, "不能修改医生诊断"),
                permission("医技审核人员", "检查检验申请与结果", "审核", "本科室任务队列", "ALLOW", 0, "报告审核人与采集人分离"),
                permission("病案管理员", "封存病案", "归档", "已出院患者", "ALLOW", 0, "不得修改临床正文"),
                permission("质控专家", "病历与质量指标", "审核", "授权抽检范围", "ALLOW", 8, "只能生成质控问题"),
                permission("科研人员", "脱敏科研数据集", "只读", "伦理批准队列", "ALLOW", 24, "禁止反识别和外传"),
                permission("信息系统管理员", "系统配置", "管理", "本机构", "ALLOW", 0, "无临床病历正文读取权"),
                permission("急救破窗人员", "急救最小病历", "只读", "急救授权患者", "ALLOW", 2, "强制理由、通知与事后复核"),
                permission("跨科医生", "批量病历导出", "导出", "全部患者", "DENY", 0, "保护性拒绝优先"),
                permission("AI 医助", "最小必要临床上下文", "生成候选", "当前患者与任务", "ALLOW", 1, "不得直接写入或签署"));
        return base("按机构、院区、科室、病区、医疗组、患者关系、班次和临时授权组合计算最终权限。")
                .with("roles", List.of("门诊经治医生", "急诊医生", "住院经治医生", "会诊医生", "责任护士", "临床药师", "医技审核人员", "病案管理员", "质控专家", "科研人员", "系统管理员", "AI 医助"),
                        "data_scopes", List.of("本人接诊", "医疗组", "病区", "会诊授权", "任务队列", "脱敏科研", "急救破窗"),
                        "permissions", permissions,
                        "separation_of_duties", "作者!=审批人；采集人!=报告审核人；配置作者!=发布审批人；系统管理员无临床正文权限",
                        "temporary_grant_hours", 4,
                        "deny_overrides_allow", true,
                        "break_glass_review_hours", 24);
    }

    private static Payload base(String description) {
        return new Payload(object(
                "schema_version", 2,
                "description", description,
                "environment", "dev-synthetic",
                "owner", "三级医院配置管理委员会",
                "effective_scope", List.of("江城大学附属医院", "总院区", "门诊/急诊/住院/医技/科研"),
                "controls", List.of("双人审批", "最小权限", "审计留痕", "失败关闭", "灰度发布", "可验证回退"),
                "evidence", object("dataset", "tertiary-hospital-business-config-v1", "case_count", 128,
                        "last_verified", "2026-08-26", "standards", List.of("医疗核心制度", "病历书写基本规范", "三级医院评审标准"))));
    }

    private static CapabilityPackSeed pack(
            String packId, String compositionId, String releaseId, String code, String name,
            String inherits, String scope, List<String> modules) {
        return new CapabilityPackSeed(id(packId), id(compositionId), id(releaseId), code, name, inherits, scope, modules);
    }

    private static List<String> baseline(String... additions) {
        List<String> modules = new ArrayList<>(List.of(
                "CORE_PATIENT", "CLINICAL_RECORD", "ORDER_RESULT", "DIGITAL_SIGNATURE", "AUDIT_OUTBOX"));
        modules.addAll(List.of(additions));
        return List.copyOf(modules);
    }

    private static SpecialtySeed specialty(
            String assessmentId, String departmentId, String releaseId, String scopeCode,
            String displayName, String supportLevel, String packCode, List<String> modules) {
        return new SpecialtySeed(id(assessmentId), departmentId(departmentId), id(releaseId), scopeCode, displayName,
                supportLevel, packCode, "3.0.0", modules, sha256("tertiary-evidence:" + scopeCode));
    }

    private static UUID departmentId(String reference) {
        if (!reference.startsWith("admin:")) return id(reference);
        String code = reference.substring("admin:".length());
        String facility = "018f0000-0000-7000-8000-00000000aa03";
        return UUID.nameUUIDFromBytes(("openemr2026:tertiary-hospital:department:" + facility + ":" + code)
                .getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, Object> node(String id, String name, String type, String owner,
                                             int minutes, boolean protectedNode, boolean terminal) {
        return object("id", id, "name", name, "type", type, "owner", owner, "minutes", minutes,
                "protected", protectedNode, "terminal", terminal);
    }

    private static Map<String, Object> edge(String from, String to, String condition, boolean compensation) {
        return object("from", from, "to", to, "condition", condition, "compensation", compensation);
    }

    private static Map<String, Object> group(String id, String name, int columns) {
        return object("id", id, "name", name, "columns", columns);
    }

    private static Map<String, Object> field(String id, String label, String type, String group,
                                              boolean required, boolean protectedField,
                                              String terminology, String calculation) {
        return object("id", id, "label", label, "type", type, "group", group, "required", required,
                "protected", protectedField, "terminology", terminology, "calculation", calculation,
                "visibility", "ALWAYS");
    }

    private static Map<String, Object> rule(String id, String name, String layer, int priority,
                                             String condition, String action, String evidence) {
        return object("id", id, "name", name, "layer", layer, "priority", priority,
                "condition", condition, "action", action, "evidence", evidence, "enabled", true,
                "exception", layer.contains("HARD") ? "必须记录授权例外与双签" : "允许责任人说明原因后关闭提醒");
    }

    private static Map<String, Object> permission(String role, String resource, String action, String scope,
                                                   String effect, int hours, String sod) {
        return object("role", role, "resource", resource, "action", action, "scope", scope,
                "effect", effect, "temporary_hours", hours, "sod", sod);
    }

    private static Map<String, Object> object(Object... pairs) {
        if (pairs.length % 2 != 0) throw new IllegalArgumentException("key/value pairs required");
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            result.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return result;
    }

    private static UUID id(String suffix) {
        return UUID.fromString("018f0000-0000-7000-8000-00000000" + suffix);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    record ConfigurationSeed(
            UUID draftId, UUID runtimeId, String configType, String draftKey,
            String runtimeKey, String displayName, Map<String, Object> payload) { }

    record CapabilityPackSeed(
            UUID packId, UUID compositionId, UUID releaseId, String packCode,
            String packName, String inheritsFrom, String scope, List<String> modules) { }

    record SpecialtySeed(
            UUID assessmentId, UUID departmentId, UUID releaseId, String scopeCode,
            String displayName, String supportLevel, String packCode, String semanticVersion,
            List<String> modules, String evidenceHash) { }

    private static final class Payload extends LinkedHashMap<String, Object> {
        Payload(Map<String, Object> base) { super(base); }

        Payload with(Object... pairs) {
            putAll(object(pairs));
            return this;
        }
    }
}
