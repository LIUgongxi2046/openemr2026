package org.openemr2026.security;

import jakarta.servlet.http.HttpServletRequest;

public interface EmergencyReauthenticationVerifier {
    void verify(HttpServletRequest request);
}
