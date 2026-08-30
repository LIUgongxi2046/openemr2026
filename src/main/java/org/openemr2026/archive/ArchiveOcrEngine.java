package org.openemr2026.archive;

interface ArchiveOcrEngine {
    OcrResult extract(byte[] content, String mediaType, String filename);

    record OcrResult(String text, double confidence, String engine) {}
}
