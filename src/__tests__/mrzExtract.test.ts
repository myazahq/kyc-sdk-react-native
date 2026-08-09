import { sanitizeMrzLine } from '../mrz/extract';

describe('ML Kit filler mangling (Android)', () => {
  it('maps guillemets back to fillers instead of deleting them', () => {
    // ML Kit's latin model reads OCR-B '<<' as '«'. Deleting it (the old
    // behaviour) shortened the line past fit()'s tolerance and the whole MRZ
    // was discarded — the reported "had to rescan at the chip step" bug.
    expect(sanitizeMrzLine('P«NGAINGWE««RICHARD‹UNIMKE')).toBe(
      'P<<NGAINGWE<<<<RICHARD<UNIMKE',
    );
    expect(sanitizeMrzLine('abc»def')).toBe('ABC<<DEF');
  });
});
