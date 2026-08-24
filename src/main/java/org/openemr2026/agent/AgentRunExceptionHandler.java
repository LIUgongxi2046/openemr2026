package org.openemr2026.agent;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AgentRunController.class)
final class AgentRunExceptionHandler {

    @ExceptionHandler(AgentRunException.class)
    ResponseEntity<ApiErrorEnvelope> failure(AgentRunException failure) {
        String category = failure.status() == 409 ? "CONFLICT" : failure.status() == 403 ? "AUTHORIZATION" : "VALIDATION";
        return ResponseEntity.status(failure.status()).body(new ApiErrorEnvelope(new ApiError(
                failure.code(), category, failure.getMessage(), UUID.randomUUID().toString(), false, null, List.of())));
    }

    record ApiErrorEnvelope(ApiError error) {}

    record ApiError(
            String code,
            String category,
            String message,
            String traceId,
            boolean retryable,
            Object recovery,
            List<Object> violations) {}
}
