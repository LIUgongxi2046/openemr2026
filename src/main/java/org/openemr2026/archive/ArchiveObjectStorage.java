package org.openemr2026.archive;

import java.time.Instant;

interface ArchiveObjectStorage {
    void putImmutable(String storageKey, byte[] content);
    byte[] read(String storageKey);
    void seal(String storageKey, Instant retainUntil);
    void deleteUnsealedBestEffort(String storageKey);
}
