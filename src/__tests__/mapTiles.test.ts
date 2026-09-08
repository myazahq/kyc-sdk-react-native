import {
  defaultMapView,
  latLngToWorld,
  panCenter,
  visibleTiles,
  worldToLatLng,
  worldSize,
} from '../lib/map-tiles';

describe('web mercator projection', () => {
  it('puts the origin at the world centre', () => {
    const world = latLngToWorld({ lat: 0, lng: 0 }, 1);
    expect(world.x).toBeCloseTo(worldSize(1) / 2);
    expect(world.y).toBeCloseTo(worldSize(1) / 2);
  });

  it('round-trips a Lagos coordinate', () => {
    const point = { lat: 6.4281, lng: 3.4219 };
    const world = latLngToWorld(point, 17);
    const back = worldToLatLng(world.x, world.y, 17);
    expect(back.lat).toBeCloseTo(point.lat, 5);
    expect(back.lng).toBeCloseTo(point.lng, 5);
  });

  it('clamps latitudes beyond the projection poles', () => {
    const world = latLngToWorld({ lat: 89, lng: 0 }, 3);
    expect(world.y).toBeGreaterThanOrEqual(0);
  });
});

describe('visibleTiles', () => {
  it('covers a viewport with contiguous tiles and wraps longitude', () => {
    const tiles = visibleTiles({ lat: 6.4281, lng: 179.9 }, 5, 512, 256);
    expect(tiles.length).toBeGreaterThanOrEqual(6);
    for (const tile of tiles) {
      expect(tile.url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/5\/\d+\/\d+\.png$/);
    }
  });

  it('skips rows above the world', () => {
    const tiles = visibleTiles({ lat: 85, lng: 0 }, 3, 256, 2048);
    for (const tile of tiles) {
      const y = Number(tile.url.split('/').at(-1)!.replace('.png', ''));
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(2 ** 3);
    }
  });
});

describe('panCenter', () => {
  it('dragging the map east moves the centre west', () => {
    const start = { lat: 6.4281, lng: 3.4219 };
    const next = panCenter(start, 12, 100, 0);
    expect(next.lng).toBeLessThan(start.lng);
    expect(next.lat).toBeCloseTo(start.lat, 3);
  });
});

describe('defaultMapView', () => {
  it('opens gov-DB countries at country zoom and unknowns on a wide view', () => {
    expect(defaultMapView('NG').zoom).toBe(6);
    expect(defaultMapView('FR').zoom).toBe(3);
    expect(defaultMapView(undefined).zoom).toBe(3);
  });
});
