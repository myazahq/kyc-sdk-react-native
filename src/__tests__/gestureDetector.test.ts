import { detectNod, detectTurn, detectBlink, detectSmile, pushHistory } from '../liveness/gestureDetector';

describe('gesture detectors (native-signal thresholds, ported from Flutter)', () => {
  it('detectNod passes when pitch dips below −10° then recovers above −5°', () => {
    expect(detectNod([0, -12, -3])).toBe(true);
    expect(detectNod([0, -6, -3])).toBe(false); // never dipped far enough
    expect(detectNod([0, -12, -8])).toBe(false); // hasn't recovered
    expect(detectNod([-12])).toBe(false); // <2 frames
  });

  it('detectTurn passes when yaw exceeds ±25°', () => {
    expect(detectTurn(30)).toBe(true);
    expect(detectTurn(-26)).toBe(true);
    expect(detectTurn(20)).toBe(false);
  });

  it('detectBlink passes when eye-open drops below 0.2 then recovers above 0.5', () => {
    expect(detectBlink([0.9, 0.1, 0.8])).toBe(true);
    expect(detectBlink([0.9, 0.3, 0.8])).toBe(false); // never closed enough
    expect(detectBlink([0.9, 0.1, 0.4])).toBe(false); // not recovered
  });

  it('detectSmile passes above 0.5', () => {
    expect(detectSmile(0.6)).toBe(true);
    expect(detectSmile(0.4)).toBe(false);
  });
});

describe('pushHistory', () => {
  it('appends and trims to maxLen', () => {
    let h: number[] = [];
    for (let i = 0; i < 25; i++) h = pushHistory(h, i, 20);
    expect(h.length).toBe(20);
    expect(h[h.length - 1]).toBe(24);
    expect(h[0]).toBe(5);
  });
});
