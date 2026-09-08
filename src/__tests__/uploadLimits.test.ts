import { readFileSync } from 'fs';
import { join } from 'path';

import { IMAGE_MAX_BYTES, PDF_MAX_BYTES, UPLOAD_HINT, uploadSizeError } from '../config/uploadLimits';
import { describeInMonorepo, sharedVectors } from './helpers/monorepo';

// ─── The shared vectors (kyc-sdk-flutter/test/upload_limits_vectors.json) ────
//
// The size rule and the hint under every drop zone are data the three SDKs
// must agree on; one file holds them and each mirror's test reads it.

interface Vectors {
  hint: string;
  imageMaxBytes: number;
  pdfMaxBytes: number;
  cases: Array<{ name: string; mime: string | null; bytes: number | null; error: string | null }>;
}

const vectors = sharedVectors<Vectors>('kyc-sdk-flutter/test/upload_limits_vectors.json', {
  hint: '',
  imageMaxBytes: 0,
  pdfMaxBytes: 0,
  cases: [],
});

describeInMonorepo('upload limits (shared vectors)', () => {
  it('carry the shared caps and hint', () => {
    expect(IMAGE_MAX_BYTES).toBe(vectors.imageMaxBytes);
    expect(PDF_MAX_BYTES).toBe(vectors.pdfMaxBytes);
    expect(UPLOAD_HINT).toBe(vectors.hint);
    expect(UPLOAD_HINT).not.toContain('—');
  });

  for (const c of vectors.cases) {
    it(c.name, () => {
      expect(uploadSizeError(c.mime, c.bytes)).toBe(c.error);
    });
  }
});

describe('upload limits', () => {
  it('the drop zones read the hint from the one constant', () => {
    for (const rel of ['screens/ProofOfAddressParts.tsx', 'screens/BusinessDocumentSlot.tsx']) {
      const src = readFileSync(join(__dirname, '..', rel), 'utf8');
      expect(src).toContain('UPLOAD_HINT');
      expect(src).not.toMatch(/up to 20MB/);
    }
  });
});
