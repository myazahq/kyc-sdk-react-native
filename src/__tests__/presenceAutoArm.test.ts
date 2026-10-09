// The rule under test is pure; the module's OS dependencies are never reached.
jest.mock('expo-location', () => ({}));
jest.mock('../presence/background', () => ({}));
jest.mock('../presence/geofence', () => ({}));
jest.mock('../presence/store', () => ({}));

import { shouldArmBackground, type ArmInputs } from '../presence/auto-arm';

// ─── The reporter arms background monitoring for a running check ────────────
//
// People verified before the SDK armed it on submit, and always-on
// arrangements, never pass the submit step again, so their checks collected
// app-open reports only. A port of this file lives in the Flutter SDK
// (presence_auto_arm_test.dart): keep the two in lockstep.

const base: ArmInputs = {
  optedOut: false,
  fresh: false,
  pin: {},
  watch: { status: 'in_progress', stopped: false },
  registered: true,
  armed: false,
  alwaysGranted: false,
};
const decide = (over: Partial<ArmInputs>) => shouldArmBackground({ ...base, ...over });

describe('shouldArmBackground', () => {
  it('asks once for a running check that has no background monitoring', () => {
    expect(decide({})).toBe('ask');
  });

  it('never asks a second time for the same stored address', () => {
    expect(decide({ pin: { backgroundAsked: true } })).toBe('skip');
  });

  it('arms without a prompt when "allow all the time" is already granted, asked or not', () => {
    expect(decide({ alwaysGranted: true })).toBe('silent');
    expect(decide({ alwaysGranted: true, pin: { backgroundAsked: true } })).toBe('silent');
  });

  it('does nothing when the host opted out', () => {
    expect(decide({ optedOut: true })).toBe('skip');
  });

  it('leaves a just-saved address to the submit step', () => {
    expect(decide({ fresh: true })).toBe('skip');
  });

  it('does nothing when the fence is already armed', () => {
    expect(decide({ armed: true, alwaysGranted: true })).toBe('skip');
  });

  it('does nothing when the app cannot receive fence events', () => {
    expect(decide({ registered: false })).toBe('skip');
  });

  it('respects a workflow that switched background monitoring off', () => {
    expect(decide({ pin: { background: false } })).toBe('skip');
    expect(decide({ pin: { background: false }, alwaysGranted: true })).toBe('skip');
  });

  it('asks nobody when the server could not be read, or monitoring was stopped', () => {
    expect(decide({ watch: null })).toBe('skip');
    expect(decide({ watch: { status: 'revoked', stopped: true } })).toBe('skip');
    expect(decide({ watch: { status: 'verified', stopped: true }, pin: { alwaysOn: true } })).toBe('skip');
  });

  it('does nothing for a finished one-off check', () => {
    expect(decide({ watch: { status: 'verified', stopped: false } })).toBe('skip');
    expect(decide({ watch: { status: 'not_started', stopped: false } })).toBe('skip');
  });

  it('keeps an always-on arrangement armed between two checks', () => {
    expect(decide({ watch: { status: 'verified', stopped: false }, pin: { alwaysOn: true } })).toBe('ask');
    expect(decide({ watch: { status: 'inconclusive', stopped: false }, pin: { alwaysOn: true } })).toBe('ask');
  });

  it('does not re-arm an always-on arrangement that ended in a failed check', () => {
    expect(decide({ watch: { status: 'failed', stopped: false }, pin: { alwaysOn: true } })).toBe('skip');
  });
});
