package org.openemr2026.lab;

final class LabSpecimenException extends RuntimeException {

    private final String code;
    private final int status;

    LabSpecimenException(String code, int status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    String code() { return code; }

    int status() { return status; }
}
