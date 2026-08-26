// EF.COM gating for the optional detail groups (DG7/DG11/DG12): the chip's own
// table of contents decides which files are worth selecting, and a COM that
// does not parse falls back to probing everything rather than reading nothing.
import { parseComDataGroups } from '../emrtd/extras';

/** Build a minimal EF.COM: outer 60 wrapping 5F01, 5F36 and the 5C tag list. */
function buildCom(tagList: number[]): Uint8Array {
  const ldsVersion = [0x5f, 0x01, 0x04, 0x30, 0x31, 0x30, 0x37];
  const unicodeVersion = [0x5f, 0x36, 0x06, 0x30, 0x34, 0x30, 0x30, 0x30, 0x30];
  const list = [0x5c, tagList.length, ...tagList];
  const content = [...ldsVersion, ...unicodeVersion, ...list];
  return new Uint8Array([0x60, content.length, ...content]);
}

describe('parseComDataGroups', () => {
  it('maps the declared tag list to data-group numbers', () => {
    // DG1, DG2, DG7, DG11, DG12 — the set a richly-populated passport declares.
    const present = parseComDataGroups(buildCom([0x61, 0x75, 0x67, 0x6b, 0x6c]));
    expect(present).not.toBeNull();
    expect([...present!].sort((a, b) => a - b)).toEqual([1, 2, 7, 11, 12]);
  });

  it('reports a sparse chip honestly (no DG7/DG11/DG12 declared)', () => {
    const present = parseComDataGroups(buildCom([0x61, 0x75]));
    expect(present!.has(7)).toBe(false);
    expect(present!.has(11)).toBe(false);
    expect(present!.has(12)).toBe(false);
  });

  it('ignores tag bytes that are not LDS data groups', () => {
    const present = parseComDataGroups(buildCom([0x61, 0x00, 0xff]));
    expect([...present!]).toEqual([1]);
  });

  it('returns null for bytes that are not an EF.COM, so the caller probes instead', () => {
    expect(parseComDataGroups(new Uint8Array([0x30, 0x02, 0x01, 0x02]))).toBeNull();
    expect(parseComDataGroups(new Uint8Array([]))).toBeNull();
  });
});
