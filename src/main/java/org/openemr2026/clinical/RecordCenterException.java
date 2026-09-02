package org.openemr2026.clinical;

final class RecordCenterException extends RuntimeException {
    private final String code;
    private final int status;

    RecordCenterException(String code, int status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    String code() {
        return code;
    }

    int status() {
        return status;
    }
}
