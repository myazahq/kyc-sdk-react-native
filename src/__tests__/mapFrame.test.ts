import {
  buildMapFrameSrc,
  buildStreetViewFrameSrc,
  centerCommandScript,
  parseMapFrameMessage,
  parseStreetViewFrameMessage,
  samePin,
  streetViewFrameUrlOf,
} from '../lib/map-frame';

// The framed map's protocol, mirrored from the web SDK: no origin on an app
// URL (the page proves it has no embedder instead), validate-and-drop on
// everything the bridge delivers, and a recentre that reaches the page as a
// script.

describe('buildMapFrameSrc', () => {
  it('keeps the grant and mode, adds the view, never an origin', () => {
    const src = new URL(
      buildMapFrameSrc('https://trust.myaza.co/embed/map?grant=abc&mode=app', {
        center: { lat: 6.4, lng: 3.4 },
        zoom: 12,
        hasPin: true,
        theme: 'dark',
        primaryColor: '#5645F5',
      }),
    );
    expect(src.searchParams.get('grant')).toBe('abc');
    expect(src.searchParams.get('mode')).toBe('app');
    expect(src.searchParams.get('zoom')).toBe('16');
    expect(src.searchParams.get('theme')).toBe('dark');
    expect(src.searchParams.get('origin')).toBeNull();
  });
});

describe('parseMapFrameMessage', () => {
  it('accepts the JSON string the bridge delivers, drops the rest', () => {
    expect(parseMapFrameMessage('{"source":"myaza-map","type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseMapFrameMessage({ source: 'myaza-map', type: 'pin', lat: 1, lng: 2 })).toEqual({ type: 'pin', lat: 1, lng: 2 });
    expect(parseMapFrameMessage('{"source":"myaza-map","type":"pin","lat":91,"lng":0}')).toBeNull();
    expect(parseMapFrameMessage('{"source":"other","type":"ready"}')).toBeNull();
    expect(parseMapFrameMessage('not json')).toBeNull();
    expect(parseMapFrameMessage(null)).toBeNull();
  });
});

describe('centerCommandScript', () => {
  it('calls the page global with the command as a JSON string', () => {
    const script = centerCommandScript({ lat: 6.4, lng: 3.4 });
    expect(script).toContain('window.__myazaMapCommand(');
    // The command is a JSON string INSIDE the script, so its quotes are escaped.
    expect(script).toContain('myaza-sdk');
    expect(script).toContain('\\"type\\":\\"center\\"');
    expect(script.trim().endsWith('true;')).toBe(true);
  });
  it('samePin tolerates float noise only', () => {
    expect(samePin({ lat: 1, lng: 2 }, { lat: 1 + 1e-9, lng: 2 })).toBe(true);
    expect(samePin({ lat: 1, lng: 2 }, { lat: 1.001, lng: 2 })).toBe(false);
    expect(samePin(null, { lat: 1, lng: 2 })).toBe(false);
  });
});

describe('the framed street-view page', () => {
  const mapUrl = 'https://trust.myaza.co/embed/map?grant=abc&mode=app';

  it('derives its URL from the map frame, keeping the grant and app mode', () => {
    const sv = streetViewFrameUrlOf(mapUrl);
    expect(sv).toBe('https://trust.myaza.co/embed/street-view?grant=abc&mode=app');
  });

  it('refuses a frame URL outside the page family', () => {
    expect(streetViewFrameUrlOf('https://trust.myaza.co/embed/other?grant=abc')).toBeNull();
    expect(streetViewFrameUrlOf('not a url')).toBeNull();
  });

  it('adds the pin and theme to the page URL, never an origin', () => {
    const src = new URL(buildStreetViewFrameSrc(streetViewFrameUrlOf(mapUrl)!, { pin: { lat: 6.4, lng: 3.4 }, theme: 'dark' }));
    expect(src.pathname).toBe('/embed/street-view');
    expect(src.searchParams.get('grant')).toBe('abc');
    expect(src.searchParams.get('mode')).toBe('app');
    expect(src.searchParams.get('lat')).toBe('6.4');
    expect(src.searchParams.get('theme')).toBe('dark');
    expect(src.searchParams.get('origin')).toBeNull();
  });

  it('parses the page messages, JSON strings included, and drops the rest', () => {
    expect(parseStreetViewFrameMessage('{"source":"myaza-map","type":"sv-ready"}')).toEqual({ type: 'sv-ready' });
    expect(parseStreetViewFrameMessage({ source: 'myaza-map', type: 'sv-unavailable' })).toEqual({ type: 'sv-unavailable' });
    expect(
      parseStreetViewFrameMessage({ source: 'myaza-map', type: 'sv-pov', panoId: 'p', heading: 90, pitch: 0, viewFov: 75 }),
    ).toEqual({ type: 'sv-pov', panoId: 'p', heading: 90, pitch: 0, viewFov: 75 });
    expect(parseStreetViewFrameMessage({ source: 'myaza-map', type: 'sv-pov', panoId: '', heading: 90, pitch: 0, viewFov: 75 })).toBeNull();
    expect(parseStreetViewFrameMessage({ source: 'myaza-map', type: 'sv-pov', panoId: 'p', heading: NaN, pitch: 0, viewFov: 75 })).toBeNull();
    expect(parseStreetViewFrameMessage({ source: 'other', type: 'sv-ready' })).toBeNull();
    expect(parseStreetViewFrameMessage('{not json')).toBeNull();
  });
});
