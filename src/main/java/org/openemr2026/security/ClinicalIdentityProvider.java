package org.openemr2026.security;

import jakarta.servlet.http.HttpServletRequest;

interface ClinicalIdentityProvider {

    ClinicalIdentity current(HttpServletRequest request);
}
