import {
  SILENT_CAPTURE_MAX,
  reserveSilentFrame,
  settleSilentFrame,
  silentCaptureEnabled,
  silentCaptureMediaKey,
  silentCaptureSubmission,
  type SilentCaptureFrame,
} from '../lib/silentCapture';
import { buildVerifyRequest } from '../store/submit';
import { buildApplicantVerifyRequest } from '../store/submitApplicant';
import { createKycStore } from '../store/kycStore';
import { mergeWorkflowConfig } from '../config/workflowMerge';
import type { ResolvedKYCConfig } from '../types/config';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Silent capture: the rules the three SDKs share ──────────────────────────
//
// A cap of 3 per verification, 1-based slots in capture order with no gaps,
// and an absent flag means ON. The web and Flutter SDKs pin the same rules.

jest.useFakeTimers();

const T = (n: number) => `2026-09-27T10:00:0${n}.000Z`;

function framesOf(ids: (string | null)[]): SilentCaptureFrame[] {
  return ids.map((mediaId, i) => ({ moment: 'document', capturedAt: T(i), mediaId }));
}

describe('silentCaptureEnabled', () => {
  it('is on when the flag is absent, and only false turns it off', () => {
    expect(silentCaptureEnabled({})).toBe(true);
    expect(silentCaptureEnabled({ silentCapture: true })).toBe(true);
    expect(silentCaptureEnabled({ silentCapture: null })).toBe(true);
    expect(silentCaptureEnabled({ silentCapture: false })).toBe(false);
  });

  it('never runs on a scoped flow: none of them captures a document', () => {
    for (const scope of ['biometric-authentication', 'biometric-enrollment', 'address', 'questionnaire', 'contact']) {
      expect(silentCaptureEnabled({ scope })).toBe(false);
    }
  });
});

describe('reserving frames', () => {
  it('numbers frames in capture order and stops at three', () => {
    let frames: SilentCaptureFrame[] = [];
    for (let i = 0; i < SILENT_CAPTURE_MAX; i++) {
      const r = reserveSilentFrame(frames, 'document', T(i));
      expect(r?.index).toBe(i);
      frames = r!.frames;
    }
    expect(SILENT_CAPTURE_MAX).toBe(3);
    expect(reserveSilentFrame(frames, 'document', T(9))).toBeNull();
  });

  it('keeps frames already taken whatever their upload did', () => {
    const r = reserveSilentFrame(framesOf(['a', null]), 'document', T(5))!;
    expect(r.frames.map((f) => f.mediaId)).toEqual(['a', null, null]);
    expect(r.frames[2]).toEqual({ moment: 'document', capturedAt: T(5), mediaId: null });
  });
});

describe('settling frames', () => {
  it('records the upload against the frame it belongs to', () => {
    const frames = settleSilentFrame(framesOf([null, null]), 1, T(1), 'm2');
    expect(frames.map((f) => f.mediaId)).toEqual([null, 'm2']);
  });

  it('ignores an upload that lands after the flow was reset', () => {
    // The slot index exists again, but for a different frame.
    const frames = settleSilentFrame(framesOf([null]), 0, 'an-earlier-verification', 'stale');
    expect(frames[0]!.mediaId).toBeNull();
    expect(settleSilentFrame([], 2, T(2), 'x')).toEqual([]);
  });
});

describe('the submission', () => {
  it('carries nothing when nothing uploaded', () => {
    expect(silentCaptureSubmission([])).toBeNull();
    expect(silentCaptureSubmission(framesOf([null, null]))).toBeNull();
  });

  it('renumbers the uploaded frames from 1 with no gaps', () => {
    const out = silentCaptureSubmission(framesOf([null, 'b', 'c']))!;
    expect(out.mediaIds).toEqual({ silentCapture1: 'b', silentCapture2: 'c' });
    expect(out.device).toEqual([
      { slot: 1, moment: 'document', capturedAt: T(1) },
      { slot: 2, moment: 'document', capturedAt: T(2) },
    ]);
  });

  it('never submits more than three', () => {
    const out = silentCaptureSubmission(framesOf(['a', 'b', 'c', 'd']))!;
    expect(Object.keys(out.mediaIds)).toEqual(['silentCapture1', 'silentCapture2', 'silentCapture3']);
    expect(silentCaptureMediaKey(2)).toBe('silentCapture2');
  });
});

describe('where frames are taken', () => {
  // Document capture only: the liveness step never takes one, and the
  // document review opens the front camera for it.
  const screens = join(__dirname, '..', 'screens');
  it('the liveness step takes none', () => {
    expect(readFileSync(join(screens, 'LivenessStep.tsx'), 'utf8')).not.toMatch(/useSilent|silentCapture|SilentCapture/);
  });
  it('the document review mounts the front-camera grab', () => {
    expect(readFileSync(join(screens, 'DocumentCaptureStep.tsx'), 'utf8')).toContain('<SilentFrontCapture');
  });
});

describe('on the wire', () => {
  function storeWith(config: Record<string, unknown> = {}) {
    const store = createKycStore({
      apiKey: 'pk_test_x',
      country: 'NG',
      metadata: {},
      ...config,
    } as unknown as ResolvedKYCConfig);
    const a = store.getState().reserveSilentFrame('document')!;
    const b = store.getState().reserveSilentFrame('document')!;
    store.getState().settleSilentFrame(a.index, a.capturedAt, null);
    store.getState().settleSilentFrame(b.index, b.capturedAt, 'med_2');
    return { store, b };
  }

  it('the store caps reservations at three, retakes included', () => {
    const { store } = storeWith();
    expect(store.getState().reserveSilentFrame('document')).not.toBeNull();
    expect(store.getState().reserveSilentFrame('document')).toBeNull();
    store.getState().reset();
    expect(store.getState().silentFrames).toEqual([]);
  });

  it('an individual submission carries the uploaded frames and their description', () => {
    const { store, b } = storeWith();
    store.setState({ selectedIdType: 'bvn', mediaIds: { selfie: 'med_selfie' } });
    const req = buildVerifyRequest(store.getState(), undefined);
    expect(req.mediaIds).toMatchObject({ selfie: 'med_selfie', silentCapture1: 'med_2' });
    expect('silentCapture2' in req.mediaIds).toBe(false);
    expect((req.metadata.device as Record<string, unknown>).silentCapture).toEqual([
      { slot: 1, moment: 'document', capturedAt: b.capturedAt },
    ]);
  });

  it('a business submission carries none; the applicant leg carries them', () => {
    const { store } = storeWith({ subjectType: 'business', business: { country: 'NG' } });
    store.setState({ selectedIdType: 'bvn' });
    const business = buildVerifyRequest(store.getState(), undefined);
    expect(business.mediaIds).toEqual({});
    expect((business.metadata.device as Record<string, unknown>).silentCapture).toBeUndefined();
    const applicant = buildApplicantVerifyRequest(store.getState(), 'kp_1', undefined);
    expect(applicant.mediaIds).toMatchObject({ silentCapture1: 'med_2' });
    expect((applicant.metadata.device as Record<string, unknown>).silentCapture).toHaveLength(1);
  });

  it('nothing is sent when no frame uploaded', () => {
    const store = createKycStore({ apiKey: 'pk_test_x', country: 'NG', metadata: {} } as unknown as ResolvedKYCConfig);
    const req = buildVerifyRequest(store.getState(), undefined);
    expect(Object.keys(req.mediaIds).some((k) => k.startsWith('silentCapture'))).toBe(false);
    expect((req.metadata.device as Record<string, unknown>).silentCapture).toBeUndefined();
  });

  it('a workflow flag rides the workflow merge like every template key', () => {
    expect(mergeWorkflowConfig({ silentCapture: false }, { silentCapture: true }).silentCapture).toBe(false);
    expect(mergeWorkflowConfig({}, { silentCapture: false }).silentCapture).toBe(false);
  });
});
