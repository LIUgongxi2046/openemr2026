package org.openemr2026.agent;

final class ModelProviderUnavailableException extends RuntimeException {

    private final String code;

    ModelProviderUnavailableException(String code) {
        super(code);
        this.code = code;
    }

    String code() {
        return code;
    }
}
