package org.openemr2026.mock;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openemr2026.contracts.MockInterfaceWire;
import org.openemr2026.contracts.MockInvocationResultWire;
import org.springframework.stereotype.Service;

@Service
final class MockInterfaceService {

    private static final Instant SIMULATION_EPOCH = Instant.parse("2026-08-24T00:00:00Z");

    private static final List<MockInterfaceWire> INTERFACES = List.of(
            mock("LIS_RESULTS", "LIS 检验结果查询", "INTEGRATION_LIS", "模拟检验科 LIS：返回检验结果、危急值与报告状态",
                    "HL7 FHIR R4 DiagnosticReport / Observation",
                    Map.of("patient_id", "uuid", "encounter_id", "uuid", "order_codes", "string[]"),
                    Map.of("results", "array<result>", "critical_values", "array<string>"),
                    "真实 LIS 对接：HL7 v2 ORU^R01 或 FHIR DiagnosticReport；替换 handler 为真实 LIS HTTP 客户端，保持同一请求/响应契约与危急值语义。"),
            mock("PACS_IMAGES", "PACS 影像检索", "INTEGRATION_PACS", "模拟影像 PACS：返回检查图像元数据、序列与报告状态",
                    "DICOMweb QIDO-RS / WADO-RS",
                    Map.of("study_uid", "uid", "patient_id", "uuid"),
                    Map.of("study_uid", "uid", "modality", "string", "series", "array<series>"),
                    "真实 PACS 对接：DICOMweb QIDO-RS 检索 + WADO-RS 取图；替换 handler 为 PACS DICOMweb 客户端。"),
            mock("HIS_INSURANCE", "HIS 医保结算", "INTEGRATION_HIS", "模拟医保平台：返回费用明细、报销比例与结算状态",
                    "医保平台 REST（按地区医保接口规范）",
                    Map.of("encounter_id", "uuid", "items", "array<item>"),
                    Map.of("claim_id", "string", "items", "array<item>", "reimbursed_total", "decimal"),
                    "真实医保对接：按当地医保结算接口规范（REST/WebService）；替换 handler 为医保平台客户端。"),
            mock("CA_TIMESTAMP", "CA 电子签名时间戳", "INTEGRATION_CA", "模拟 CA：返回可信时间戳、签名值与证据引用",
                    "RFC 3161 Time-Stamp Protocol (TSA)",
                    Map.of("content_hash", "string(sha256)", "algorithm", "string"),
                    Map.of("timestamp_token", "string", "signed_at", "date-time", "certificate_serial", "string"),
                    "真实 CA 对接：RFC 3161 TSA 时间戳 + X.509 证书；替换 handler 为真实 TSA 客户端。"),
            mock("HIE_DOCUMENT_EXCHANGE", "区域平台文档交换", "INTEGRATION_HIE", "模拟区域平台：返回 CDA/FHIR 文档上传、回执和共享状态",
                    "CDA R2 / HL7 FHIR R4 DocumentReference",
                    Map.of("document_id", "string", "content_hash", "string(sha256)", "patient_id", "uuid"),
                    Map.of("exchange_id", "string", "receipt_status", "string", "shared_at", "date-time|null"),
                    "真实区域平台对接：按属地规范上传 CDA R2 或 FHIR 文档；上传使用文档哈希幂等，回执查询只读可重试。"),
            mock("MODEL_PROVIDER", "模型推理 Provider", "MODEL", "模拟外部模型服务：返回确定性推理文本与引用",
                    "OpenAI-compatible /chat/completions",
                    Map.of("model", "string", "messages", "array<message>", "max_tokens", "int"),
                    Map.of("output_text", "string", "citations", "array<string>", "behavior", "string"),
                    "真实模型对接：OpenAI-compatible 或厂商 SDK；替换 handler 为真实模型客户端，保持数据驻留/许可边界。"),
            mock("DEVICE_GATEWAY", "设备网关遥测", "DEVICE", "模拟监护设备网关：返回体征遥测、设备时钟与绑定状态",
                    "HL7 v2 ORU^R01 / 厂商设备网关协议",
                    Map.of("device_id", "string", "patient_id", "uuid"),
                    Map.of("telemetry", "array<metric>", "device_clock_offset_seconds", "int", "bound_patient", "uuid"),
                    "真实设备对接：HL7 v2 或厂商网关协议（MQTT/串口）；替换 handler 为设备网关采集器。"),
            mock("DICTATION_ASR", "语音转写 ASR", "DICTATION", "模拟语音转写服务：返回分句转写与说话人置信度",
                    "语音转写 REST（流式/批量）",
                    Map.of("audio_ref", "string", "language", "string"),
                    Map.of("segments", "array<segment>", "unconfirmed_segments", "int"),
                    "真实语音对接：厂商 ASR REST/WebSocket；替换 handler 为真实转写客户端。"),
            mock("IDP_AUTHENTICATE", "身份认证 IdP", "IDENTITY", "模拟 IdP：返回认证令牌、MFA 状态与会话任期",
                    "OIDC Authorization Code + PKCE",
                    Map.of("subject", "uuid", "credentials", "object"),
                    Map.of("authenticated", "bool", "mfa", "string", "token_expires_in_seconds", "int"),
                    "真实 IdP 对接：OIDC/OAuth2 + MFA；替换 handler 为真实 IdP 客户端（生产由 OIDC 会话注入，此接口仅联调用）。"),
            mock("SCAN_CAPTURE", "纸质病案扫描", "ARCHIVE_SCAN", "模拟扫描仪：返回图像页、OCR 文本与完整性校验",
                    "TWAIN / ISIS 扫描接口",
                    Map.of("batch_id", "string", "pages", "array<page>"),
                    Map.of("pages", "array<page>", "integrity", "string"),
                    "真实扫描对接：TWAIN/ISIS 或扫描仪 SDK；替换 handler 为扫描设备驱动。"),
            mock("STORAGE_PRESERVE", "病案长期保存", "ARCHIVE_STORAGE", "模拟长期保存：返回存储位置、内容哈希与保存期限",
                    "S3 / OSS 对象存储 API",
                    Map.of("content_ref", "string", "content_hash", "string"),
                    Map.of("storage_ref", "string", "content_hash", "string", "retention_years", "int"),
                    "真实存储对接：S3/OSS 兼容对象存储；替换 handler 为对象存储客户端，保持 WORM/保留期策略。"),
            mock("PATHOLOGY_DIAGNOSE", "病理诊断", "PATHOLOGY", "模拟病理系统：返回取材、制片与诊断状态",
                    "病理 LIS 报告接口",
                    Map.of("specimen_id", "string", "patient_id", "uuid"),
                    Map.of("stages", "array<stage>", "diagnosis_status", "string"),
                    "真实病理对接：病理科 LIS 报告接口；替换 handler 为病理系统客户端。"),
            mock("ANESTHESIA_EVENT", "麻醉事件轴", "ANESTHESIA", "模拟麻醉系统：返回事件轴、用药与复苏去向",
                    "AIMS 麻醉信息系统接口",
                    Map.of("encounter_id", "uuid"),
                    Map.of("event_axis", "array<event>", "recovery_disposition", "string", "monitoring", "string"),
                    "真实麻醉对接：AIMS 麻醉信息系统接口；替换 handler 为 AIMS 客户端。"),
            mock("THERAPY_EXECUTE", "治疗执行", "THERAPY", "模拟治疗系统：返回排程、核对与不良事件",
                    "治疗执行系统 REST",
                    Map.of("therapy_id", "string", "patient_id", "uuid"),
                    Map.of("verification", "object", "adverse_event", "string|null", "status", "string"),
                    "真实治疗对接：治疗执行系统 REST；替换 handler 为治疗系统客户端，保持双人核对/不良事件语义。"));

    List<MockInterfaceWire> list() {
        return INTERFACES;
    }

    private static MockInterfaceWire mock(
            String code, String name, String type, String desc,
            String standardInterface, Map<String, Object> requestSchema,
            Map<String, Object> responseSchema, String integrationDoc) {
        return new MockInterfaceWire(code, name, type, desc,
                standardInterface, requestSchema, responseSchema, integrationDoc);
    }

    MockInvocationResultWire invoke(String code, Map<String, Object> payload) {
        String scenario = str(payload, "simulation_scenario", "SUCCESS").toUpperCase();
        if (!List.of("SUCCESS", "DEGRADED", "UNAVAILABLE").contains(scenario)) {
            throw new MockInterfaceException("MOCK_SCENARIO_INVALID", 422,
                    "simulation_scenario 必须为 SUCCESS、DEGRADED 或 UNAVAILABLE");
        }
        if ("UNAVAILABLE".equals(scenario)) {
            throw new MockInterfaceException("MOCK_DEPENDENCY_UNAVAILABLE", 503,
                    "合成外部依赖不可用；页面必须保留人工降级路径，且不得写入临床事实");
        }
        Map<String, Object> response = switch (code) {
            case "LIS_RESULTS" -> lisResults(payload);
            case "PACS_IMAGES" -> pacsImages(payload);
            case "HIS_INSURANCE" -> hisInsurance(payload);
            case "CA_TIMESTAMP" -> caTimestamp(payload);
            case "HIE_DOCUMENT_EXCHANGE" -> hieDocumentExchange(payload);
            case "MODEL_PROVIDER" -> modelProvider(payload);
            case "DEVICE_GATEWAY" -> deviceGateway(payload);
            case "DICTATION_ASR" -> dictationAsr(payload);
            case "IDP_AUTHENTICATE" -> idpAuthenticate(payload);
            case "SCAN_CAPTURE" -> scanCapture(payload);
            case "STORAGE_PRESERVE" -> storagePreserve(payload);
            case "PATHOLOGY_DIAGNOSE" -> pathologyDiagnose(payload);
            case "ANESTHESIA_EVENT" -> anesthesiaEvent(payload);
            case "THERAPY_EXECUTE" -> therapyExecute(payload);
            default -> throw new MockInterfaceException("MOCK_INTERFACE_UNKNOWN", 404, "未知模拟接口：" + code);
        };
        if ("DEGRADED".equals(scenario)) {
            response.put("_simulation", Map.of(
                    "scenario", "DEGRADED",
                    "completeness", "PARTIAL",
                    "reason", "合成上游延迟，结果仅供流程演练，禁止据此自动执行临床动作"));
        }
        String deterministicKey = stableToken(code, payload, "request");
        return new MockInvocationResultWire(
                code, UUID.fromString(deterministicKey), simulationTime(payload),
                MockInvocationResultWire.ScenarioValue.valueOf(scenario),
                code + ":" + deterministicKey.substring(0, 8), response,
                "DEGRADED".equals(scenario)
                        ? "降级合成场景 · 结果不完整，必须人工复核，不进入真实临床事实"
                        : "确定性合成数据 · 相同输入产生相同输出 · 不进入真实临床事实");
    }

    private Map<String, Object> lisResults(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("patient_id", str(payload, "patient_id", "018f0000-0000-7000-8000-000000001001"));
        result.put("results", List.of(
                Map.of("test_code", "K", "test_name", "血钾", "value", "3.4", "unit", "mmol/L", "flag", "L", "status", "CONFIRMED"),
                Map.of("test_code", "CREA", "test_name", "肌酐", "value", "92", "unit", "μmol/L", "flag", "", "status", "CONFIRMED"),
                Map.of("test_code", "TNI", "test_name", "肌钙蛋白 I", "value", "0.12", "unit", "ng/mL", "flag", "H", "status", "PENDING_REVIEW")));
        result.put("critical_values", List.of("血钾 3.4 mmol/L 低于参考下限，已触发危急值通知"));
        return result;
    }

    private Map<String, Object> pacsImages(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("study_uid", "1.2.840.113619.2." + stableToken("PACS_IMAGES", payload, "study").substring(0, 8));
        result.put("modality", "CT");
        result.put("body_part", "CHEST");
        result.put("series", List.of(
                Map.of("series_no", 1, "description", "平扫", "images", 120, "status", "AVAILABLE"),
                Map.of("series_no", 2, "description", "增强", "images", 80, "status", "REPORTING")));
        result.put("report_status", "DRAFT");
        return result;
    }

    private Map<String, Object> hisInsurance(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("claim_id", "CLM-" + stableToken("HIS_INSURANCE", payload, "claim").substring(0, 8).toUpperCase());
        result.put("items", List.of(
                Map.of("item", "血钾测定", "amount", "28.00", "reimbursement_ratio", 0.8, "category", "检验"),
                Map.of("item", "胸部 CT 平扫", "amount", "320.00", "reimbursement_ratio", 0.7, "category", "检查")));
        result.put("settlement_status", "SETTLED");
        result.put("reimbursed_total", "254.40");
        return result;
    }

    private Map<String, Object> caTimestamp(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp_token", "TSA-" + stableToken("CA_TIMESTAMP", payload, "token").substring(0, 12));
        result.put("signed_at", simulationTime(payload).toString());
        result.put("certificate_serial", "CA-" + stableToken("CA_TIMESTAMP", payload, "certificate").substring(0, 8).toUpperCase());
        result.put("evidence_ref", "evidence:tsa:" + stableToken("CA_TIMESTAMP", payload, "evidence"));
        result.put("algorithm", "SHA256withRSA");
        return result;
    }

    private Map<String, Object> hieDocumentExchange(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("document_id", str(payload, "document_id", "CDA-21018"));
        result.put("exchange_id", "HIE-" + stableToken("HIE_DOCUMENT_EXCHANGE", payload, "exchange")
                .substring(0, 10).toUpperCase());
        result.put("content_hash", str(payload, "content_hash",
                "sha256:" + stableToken("HIE_DOCUMENT_EXCHANGE", payload, "document")));
        result.put("receipt_status", "PENDING_ACK");
        result.put("shared_at", null);
        result.put("clinical_impact", "不影响院内病历签署；区域共享状态保持待确认");
        return result;
    }

    private Map<String, Object> modelProvider(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("model", "MedBase-L 2.1 (DETERMINISTIC_FAKE)");
        result.put("output_text", "AI 候选：建议核对血钾偏低与降压方案，具体处置需医生确认。");
        result.put("citations", List.of("LIS 报告 v2", "门诊记录 07-21", "今日分诊 08:43"));
        result.put("behavior", "DETERMINISTIC_FAKE");
        return result;
    }

    private Map<String, Object> deviceGateway(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("device_id", str(payload, "device_id", "BEDSIDE-MONITOR-01"));
        result.put("telemetry", List.of(
                Map.of("metric", "HR", "value", 76, "unit", "bpm", "at", simulationTime(payload).minusSeconds(10).toString()),
                Map.of("metric", "SpO2", "value", 98, "unit", "%", "at", simulationTime(payload).minusSeconds(10).toString()),
                Map.of("metric", "NIBP", "value", "92/58", "unit", "mmHg", "at", simulationTime(payload).minusSeconds(20).toString())));
        result.put("device_clock_offset_seconds", 86);
        result.put("bound_patient", str(payload, "patient_id", "018f0000-0000-7000-8000-000000001001"));
        return result;
    }

    private Map<String, Object> dictationAsr(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("segments", List.of(
                Map.of("speaker", "医生", "text", "患者一周前无明显诱因出现头晕。", "confidence", 0.97),
                Map.of("speaker", "医生", "text", "自测血压最高一百六十八。", "confidence", 0.94)));
        result.put("unconfirmed_segments", 1);
        return result;
    }

    private Map<String, Object> idpAuthenticate(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("authenticated", true);
        result.put("subject", str(payload, "subject", "018f0000-0000-7000-8000-00000000aa04"));
        result.put("mfa", "VERIFIED");
        result.put("token_expires_in_seconds", 900);
        result.put("roles", List.of("AUTHORIZED_CLINICAL_OR_AI_GOVERNANCE_ROLE"));
        return result;
    }

    private Map<String, Object> scanCapture(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("batch_id", "SCAN-" + stableToken("SCAN_CAPTURE", payload, "batch").substring(0, 8).toUpperCase());
        result.put("pages", List.of(
                Map.of("page", 1, "image_ref", "scan://page-1", "ocr_excerpt", "病案首页 · 主要诊断：急性心力衰竭", "checksum", "sha256:" + stableToken("SCAN_CAPTURE", payload, "page-1")),
                Map.of("page", 2, "image_ref", "scan://page-2", "ocr_excerpt", "出院记录 · 出院医嘱", "checksum", "sha256:" + stableToken("SCAN_CAPTURE", payload, "page-2"))));
        result.put("integrity", "VERIFIED");
        return result;
    }

    private Map<String, Object> storagePreserve(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("storage_ref", "preserve://" + stableToken("STORAGE_PRESERVE", payload, "storage").substring(0, 12));
        result.put("content_hash", "sha256:" + stableToken("STORAGE_PRESERVE", payload, "content"));
        result.put("retention_years", 30);
        result.put("format", "CDA");
        result.put("sealed", true);
        return result;
    }

    private Map<String, Object> pathologyDiagnose(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("specimen_id", "PATH-" + stableToken("PATHOLOGY_DIAGNOSE", payload, "specimen").substring(0, 8).toUpperCase());
        result.put("stages", List.of(
                Map.of("stage", "取材", "status", "COMPLETED", "at", simulationTime(payload).minusSeconds(72000).toString()),
                Map.of("stage", "制片", "status", "COMPLETED", "at", simulationTime(payload).minusSeconds(36000).toString()),
                Map.of("stage", "诊断", "status", "PENDING_REVIEW", "at", simulationTime(payload).toString())));
        result.put("diagnosis_status", "PENDING_REVIEW");
        return result;
    }

    private Map<String, Object> anesthesiaEvent(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("event_axis", List.of(
                Map.of("at", simulationTime(payload).minusSeconds(2400).toString(), "event", "诱导", "drug", "丙泊酚"),
                Map.of("at", simulationTime(payload).minusSeconds(1200).toString(), "event", "插管", "drug", "罗库溴铵"),
                Map.of("at", simulationTime(payload).minusSeconds(300).toString(), "event", "监护", "drug", "无")));
        result.put("recovery_disposition", "PACU");
        result.put("monitoring", "STABLE");
        return result;
    }

    private Map<String, Object> therapyExecute(Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("therapy_id", "THER-" + stableToken("THERAPY_EXECUTE", payload, "therapy").substring(0, 8).toUpperCase());
        result.put("verification", Map.of("patient_checked", true, "order_checked", true, "dual_sign", true));
        result.put("adverse_event", null);
        result.put("status", "COMPLETED");
        return result;
    }

    private String str(Map<String, Object> payload, String key, String fallback) {
        Object value = payload.get(key);
        return value == null ? fallback : String.valueOf(value);
    }

    private Instant simulationTime(Map<String, Object> payload) {
        String token = stableToken("CLOCK", payload, "produced-at");
        long seconds = Long.parseUnsignedLong(token.substring(0, 8), 16) % 86_400L;
        return SIMULATION_EPOCH.plusSeconds(seconds);
    }

    private String stableToken(String code, Map<String, Object> payload, String salt) {
        String canonical = code + "|" + salt + "|" + canonical(payload);
        return UUID.nameUUIDFromBytes(canonical.getBytes(StandardCharsets.UTF_8)).toString();
    }

    private String canonical(Object value) {
        if (value instanceof Map<?, ?> map) {
            List<Map.Entry<?, ?>> entries = new ArrayList<>(map.entrySet());
            entries.sort(Comparator.comparing(entry -> String.valueOf(entry.getKey())));
            StringBuilder builder = new StringBuilder("{");
            for (Map.Entry<?, ?> entry : entries) {
                builder.append(entry.getKey()).append(':').append(canonical(entry.getValue())).append(';');
            }
            return builder.append('}').toString();
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::canonical).reduce("[", (left, right) -> left + right + ",") + "]";
        }
        return String.valueOf(value);
    }
}
