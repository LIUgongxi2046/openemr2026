package org.openemr2026.assistant;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
final class ClinicalAssistantService {

    String stream(String message) {
        String prompt = message == null ? "" : message.trim();
        List<String> chunks = List.of(
                "这是开发合成环境的确定性假模型回复，仅用于验证 SSE 流式通道。",
                "您的问题：" + (prompt.isEmpty() ? "（空）" : prompt) + "。",
                "临床 AI 助手只出候选，不获得独立临床权力：建议不会自动写入病历、诊断、医嘱或处方。",
                "当前患者 / 就诊上下文已按上下文租约隔离，跨患者或跨就诊不会共享会话。");
        StringBuilder sse = new StringBuilder();
        for (int i = 0; i < chunks.size(); i++) {
            sse.append("id: ").append(i + 1).append('\n')
               .append("event: delta\n")
               .append("data: ").append(chunks.get(i)).append("\n\n");
        }
        sse.append("event: done\n").append("data: {\"model_behavior\":\"DETERMINISTIC_FAKE\"}\n\n");
        return sse.toString();
    }
}
