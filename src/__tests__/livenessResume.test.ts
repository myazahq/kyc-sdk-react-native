import { withoutRestoredSelfie } from '../lib/livenessResume';

describe('withoutRestoredSelfie', () => {
  it('drops a restored selfie and its recording, and sends a later step back to liveness', () => {
    expect(
      withoutRestoredSelfie({
        step: 'questionnaire',
        mediaIds: { selfie: 's', livenessVideo: 'v', documentFront: 'd' },
      }),
    ).toEqual({ step: 'liveness', mediaIds: { documentFront: 'd' } });
  });

  it('leaves an earlier step alone', () => {
    expect(withoutRestoredSelfie({ step: 'id-type', mediaIds: { selfie: 's' } })).toEqual({
      step: 'id-type',
      mediaIds: {},
    });
  });

  it('changes nothing when no selfie was restored', () => {
    const r = { step: 'document-capture', mediaIds: { documentFront: 'd' } };
    expect(withoutRestoredSelfie(r)).toBe(r);
  });
});
