package org.openemr2026.agent;

import java.util.Map;

interface ClinicalModelProvider {

    boolean supports(String providerCode);

    Map<String, Object> generate(DraftPrompt prompt);

    record DraftPrompt(Map<String, Object> currentSections, int maxOutputTokens) {}
}
