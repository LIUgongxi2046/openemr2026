package org.openemr2026.agent;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@Profile("prod")
@ConditionalOnProperty(name = "openemr2026.production.ai.enabled", havingValue = "true")
final class DeepSeekClinicalModelProvider implements ClinicalModelProvider {

    private final String modelId;
    private final DeepSeekChatTransport transport;
    private final ObjectMapper objectMapper;

    DeepSeekClinicalModelProvider(
            @Value("${openemr2026.production.ai.model-id}") String modelId,
            DeepSeekChatTransport transport,
            ObjectMapper objectMapper) {
        this.modelId = modelId;
        this.transport = transport;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean supports(String providerCode) {
        return "DEEPSEEK".equals(providerCode) || "DEEPSEEK_OPENAI_COMPATIBLE".equals(providerCode);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> generate(DraftPrompt prompt) {
        try {
            String currentSections = objectMapper.writeValueAsString(prompt.currentSections());
            Map<String, Object> request = Map.of(
                    "model", modelId,
                    "messages", List.of(
                            Map.of("role", "system", "content", """
                                    你是AI医助小南的医疗文书草稿 Agent。只返回 JSON object，根字段必须且只能包含 sections。
                                    sections 只能是文书段落映射；不得返回签名、工具调用、SQL、授权或临床写入动作。
                                    保留不确定性，不编造未提供的患者事实；输出必须由医生人工审阅。
                                    """),
                            Map.of("role", "user", "content", "请基于当前文书段落生成候选草稿：" + currentSections)),
                    "response_format", Map.of("type", "json_object"),
                    "max_tokens", prompt.maxOutputTokens(),
                    "stream", false);
            Map<String, Object> response = transport.complete(request);
            Object choicesValue = response.get("choices");
            if (!(choicesValue instanceof List<?> choices) || choices.isEmpty()
                    || !(choices.getFirst() instanceof Map<?, ?> choice)
                    || !(choice.get("message") instanceof Map<?, ?> message)
                    || !(message.get("content") instanceof String content)) {
                throw new ModelProviderUnavailableException("MODEL_PROVIDER_RESPONSE_INVALID");
            }
            Map<String, Object> candidate = objectMapper.convertValue(objectMapper.readTree(content), Map.class);
            Object sections = candidate.get("sections");
            if (!(sections instanceof Map<?, ?>)) {
                throw new ModelProviderUnavailableException("MODEL_PROVIDER_RESPONSE_INVALID");
            }
            return Map.of(
                    "sections", sections,
                    "notice", "DeepSeek 候选草稿，必须由医生审阅并重新通过业务校验。",
                    "model_behavior", "DEEPSEEK_REVIEW_REQUIRED");
        } catch (ModelProviderUnavailableException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new ModelProviderUnavailableException("MODEL_PROVIDER_RESPONSE_INVALID");
        }
    }
}
