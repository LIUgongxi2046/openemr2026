package org.openemr2026.infection;

final class InfectionEventException extends RuntimeException {

    private final String code;
    private final int status;

    InfectionEventException(String code, int status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    String code() { return code; }

    int status() { return status; }
}
