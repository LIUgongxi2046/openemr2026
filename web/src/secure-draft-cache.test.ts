import { describe, expect, it } from 'vitest';

import {
  clinicalJsonSnapshot,
  clinicalContextFingerprint,
  decryptDraftPayload,
  encryptDraftPayload,
  type SecureDocumentDraft,
} from './secure-draft-cache';

const draft: SecureDocumentDraft = {
  contextFingerprint: 'context-a',
  documentId: '018f0f4c-1f44-7b2f-9f60-f41f2046682f',
  baseVersionId: '018f0f4c-1f44-7b2f-9f60-f41f20466830',
  baseRowVersion: 4,
  sections: { chief_complaint: '加密病历草稿' },
  updatedAt: '2026-08-20T12:00:00Z',
};

describe('secure session draft cache', () => {
  it('turns reactive-style proxies into a plain clinical JSON snapshot', () => {
    const proxied = new Proxy({ nested: { text: '医生编辑内容' } }, {});
    expect(() => structuredClone(proxied)).toThrow();
    const snapshot = clinicalJsonSnapshot(proxied);
    expect(snapshot).toEqual({ nested: { text: '医生编辑内容' } });
    expect(() => structuredClone(snapshot)).not.toThrow();
  });

  it('round-trips clinical content with AES-GCM without placing plaintext in the stored record', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const stored = await encryptDraftPayload(key, 'draft-a', draft);
    expect(JSON.stringify(stored)).not.toContain('加密病历草稿');
    await expect(decryptDraftPayload(key, stored)).resolves.toEqual(draft);
  });

  it('binds ciphertext to its storage identity and rejects record swapping', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const stored = await encryptDraftPayload(key, 'draft-a', draft);
    await expect(decryptDraftPayload(key, { ...stored, id: 'draft-b' })).rejects.toThrow();
  });

  it('produces a deterministic pseudonymous context fingerprint', async () => {
    const first = await clinicalContextFingerprint(['tenant', 'patient', 'encounter', 'document']);
    const second = await clinicalContextFingerprint(['tenant', 'patient', 'encounter', 'document']);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toContain('patient');
  });
});
