import { extractChipPortrait } from '../emrtd/dg2';

// ---------------------------------------------------------------------------
// Locating the portrait inside DG2.
//
// The container wraps the image in CBEFF/biometric headers that vary by
// issuer, so the image's own magic bytes are the only dependable landmark —
// and the EARLIEST one wins. Preferring JPEG over JP2 regardless of position
// was subtly wrong: compressed JP2 data can contain a spurious FF D8 FF by
// chance, and slicing there produced a "jpeg" that rendered as nothing while
// the real, decodable JP2 sat earlier in the file.
// ---------------------------------------------------------------------------

const JP2_SIG = [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a];
const J2K_SIG = [0xff, 0x4f, 0xff, 0x51];
const JPEG_SIG = [0xff, 0xd8, 0xff, 0xe0];

const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');
/** A fake CBEFF prefix — header bytes before the image starts. */
const header = [0x75, 0x82, 0x01, 0x00, 0x7f, 0x61, 0x02, 0x03];

describe('extractChipPortrait', () => {
  it('renders a baseline JPEG directly', () => {
    const portrait = extractChipPortrait(b64([...header, ...JPEG_SIG, 1, 2, 3]));
    expect(portrait.format).toBe('jpeg');
    expect(portrait.dataUri).toMatch(/^data:image\/jpeg;base64,/);
    // Sliced from the magic — the CBEFF header must not lead the image file.
    expect(Buffer.from(portrait.imageBase64!, 'base64')[0]).toBe(0xff);
  });

  it('reports JP2 for the platform decoder, with the image sliced out', () => {
    const portrait = extractChipPortrait(b64([...header, ...JP2_SIG, 9, 9]));
    expect(portrait.format).toBe('jp2');
    expect(portrait.dataUri).toBeNull();
    expect(Buffer.from(portrait.imageBase64!, 'base64')[4]).toBe(0x6a);
  });

  it('recognises a raw J2K codestream as JP2-family', () => {
    const portrait = extractChipPortrait(b64([...header, ...J2K_SIG, 0, 0]));
    expect(portrait.format).toBe('jp2');
    expect(portrait.dataUri).toBeNull();
  });

  it('picks the EARLIEST signature, not the preferred format', () => {
    // Real JP2 header first, then a spurious JPEG magic inside its data — the
    // case that used to produce an unrenderable "jpeg" slice.
    const portrait = extractChipPortrait(b64([...header, ...JP2_SIG, 0x11, ...JPEG_SIG, 0x22]));
    expect(portrait.format).toBe('jp2');
    expect(portrait.dataUri).toBeNull();
    expect(Buffer.from(portrait.imageBase64!, 'base64')[0]).toBe(0x00);
  });

  it('yields nothing for an unrecognised container, and for no DG2 at all', () => {
    expect(extractChipPortrait(b64([...header, 1, 2, 3])).format).toBe('unknown');
    expect(extractChipPortrait(undefined)).toEqual({
      format: 'unknown',
      dataUri: null,
      imageBase64: null,
    });
  });
});
