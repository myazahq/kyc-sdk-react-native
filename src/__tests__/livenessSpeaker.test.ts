const speak = jest.fn();
const stop = jest.fn();
const getAvailableVoicesAsync = jest.fn(() => Promise.resolve([]));
jest.mock('expo-speech', () => ({ speak, stop, getAvailableVoicesAsync }));

import { LivenessSpeaker } from '../liveness/speech';

beforeEach(() => jest.clearAllMocks());

describe('LivenessSpeaker (Android first-phrase race)', () => {
  it('warms the TTS engine at construction, before any phrase', () => {
    // Android's engine initialises asynchronously; without this the first
    // gesture command — often the first utterance of the whole session —
    // raced init and was never heard.
    new LivenessSpeaker(true);
    expect(getAvailableVoicesAsync).toHaveBeenCalledTimes(1);
  });

  it('does not warm anything when guidance is disabled', () => {
    new LivenessSpeaker(false);
    expect(getAvailableVoicesAsync).not.toHaveBeenCalled();
  });

  it('never calls stop() before the first phrase', () => {
    // There is nothing to interrupt yet, and poking a still-initialising
    // Android engine with stop() is what could eat the queued first phrase.
    const s = new LivenessSpeaker(true);
    s.speak('Turn your head to the left');
    expect(stop).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('Turn your head to the left', { language: 'en-US' });
  });

  it('cuts off the stale phrase on every subsequent one', () => {
    const s = new LivenessSpeaker(true);
    s.speak('Turn your head to the left');
    s.speak('Great');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('still de-dupes consecutive identical phrases', () => {
    const s = new LivenessSpeaker(true);
    s.speak('Hold still');
    s.speak('Hold still');
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
