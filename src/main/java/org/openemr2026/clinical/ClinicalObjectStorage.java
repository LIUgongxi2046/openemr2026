package org.openemr2026.clinical;

interface ClinicalObjectStorage {
    void put(String storageKey, byte[] content, String mediaType);
    void deleteBestEffort(String storageKey);
}
