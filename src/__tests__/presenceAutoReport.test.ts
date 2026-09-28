// The reporter and background tier are covered elsewhere; this pins WHAT the
// SDK does on its own when a presence flow is submitted. A port of this file
// lives in the Flutter SDK (presence_auto_report_test.dart) — keep the two in
// lockstep.
jest.mock('../presence/report', () => ({ reportAddressPresence: jest.fn() }));
jest.mock('../presence/background', () => ({ enableBackgroundPresence: jest.fn() }));

import { autoReportPresence, shouldAutoReport, wantsBackground } from '../presence/auto-report';

// ─── The SDK reports presence itself ─────────────────────────────────────────
//
// Production, 2026-09-28: every live watch sat at 0 days / 0 nights because
// observations only ever came from calls the host app had to add, and most
// companies had not. The SDK now arms background monitoring (on by default)
// and makes the first report on submit.

const presenceOn = { addressCollection: { presence: { enabled: true } } };
const reported = { reported: true, inside: true, reason: 'reported' as const };
const armed = { enabled: true, reason: 'enabled' as const };

describe('shouldAutoReport', () => {
  it('acts when the flow ran presence and carries a user reference', () => {
    expect(shouldAutoReport({ apiKey: 'pk_live_x', userId: 'user_42', ...presenceOn })).toBe(true);
  });

  it('stays quiet when presence is off or absent', () => {
    expect(shouldAutoReport({ apiKey: 'pk_live_x', userId: 'user_42' })).toBe(false);
    expect(
      shouldAutoReport({ apiKey: 'pk_live_x', userId: 'user_42', addressCollection: { presence: { enabled: false } } }),
    ).toBe(false);
  });

  it('stays quiet without a user reference (no pin was stored under one)', () => {
    expect(shouldAutoReport({ apiKey: 'pk_live_x', ...presenceOn })).toBe(false);
    expect(shouldAutoReport({ apiKey: 'pk_live_x', userId: '  ', ...presenceOn })).toBe(false);
  });
});

describe('wantsBackground', () => {
  it('is on by default', () => {
    expect(wantsBackground({ apiKey: 'pk_live_x', userId: 'user_42', ...presenceOn })).toBe(true);
  });

  it('is off only when the workflow turns it off', () => {
    expect(
      wantsBackground({
        apiKey: 'pk_live_x', userId: 'user_42',
        addressCollection: { presence: { enabled: true, background: false } },
      }),
    ).toBe(false);
  });
});

describe('autoReportPresence', () => {
  it('arms background monitoring first, then reports, with the flow key and user reference', async () => {
    const order: string[] = [];
    const enableBackground = jest.fn(async () => { order.push('background'); return armed; });
    const report = jest.fn(async () => { order.push('report'); return reported; });
    const outcome = await autoReportPresence(
      { apiKey: 'pk_dev_x', devUrl: 'http://10.0.2.2:3001', userId: 'user_42', ...presenceOn },
      { report, enableBackground },
    );
    const expected = { apiKey: 'pk_dev_x', externalUserId: 'user_42', devUrl: 'http://10.0.2.2:3001' };
    expect(enableBackground).toHaveBeenCalledWith(expected);
    expect(report).toHaveBeenCalledWith(expected);
    expect(order).toEqual(['background', 'report']);
    expect(outcome).toEqual({ background: armed, report: reported });
  });

  it('only reports when the workflow turns background monitoring off', async () => {
    const enableBackground = jest.fn();
    const report = jest.fn().mockResolvedValue(reported);
    await autoReportPresence(
      { apiKey: 'pk_live_x', userId: 'user_42', addressCollection: { presence: { enabled: true, background: false } } },
      { report, enableBackground },
    );
    expect(enableBackground).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('still reports when arming background monitoring fails', async () => {
    const enableBackground = jest.fn().mockRejectedValue(new Error('boom'));
    const report = jest.fn().mockResolvedValue(reported);
    const outcome = await autoReportPresence(
      { apiKey: 'pk_live_x', userId: 'user_42', ...presenceOn },
      { report, enableBackground },
    );
    expect(outcome).toEqual({ background: null, report: reported });
  });

  it('does nothing when it should not act', async () => {
    const enableBackground = jest.fn();
    const report = jest.fn();
    await expect(
      autoReportPresence({ apiKey: 'pk_live_x', userId: 'user_42' }, { report, enableBackground }),
    ).resolves.toBeNull();
    expect(enableBackground).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('never throws, even when the reporter does', async () => {
    const outcome = await autoReportPresence(
      { apiKey: 'pk_live_x', userId: 'user_42', ...presenceOn },
      { report: jest.fn().mockRejectedValue(new Error('boom')), enableBackground: jest.fn().mockResolvedValue(armed) },
    );
    expect(outcome).toEqual({ background: armed, report: null });
  });
});
