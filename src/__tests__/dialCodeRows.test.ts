import { buildDialCodeItems, dialCodeItemKey, filterDialCodeOptions } from '../components/dialCodeRows';

// The country sheet's list as data: the search, the pinned geo row and the
// region grouping the address-scope country control asks for. Flutter's
// dial_code_rows_test.dart pins the same rules.

const options = [
  { code: 'FR', name: 'France', dialCode: '+33' },
  { code: 'GH', name: 'Ghana', dialCode: '+233' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234' },
  { code: 'US', name: 'United States', dialCode: '+1' },
];

const codes = (items: ReturnType<typeof buildDialCodeItems>['items']) =>
  items.map((i) => (i.kind === 'header' ? `#${i.region}` : i.option.code));

describe('filterDialCodeOptions', () => {
  it('matches the name, the ISO code and the dial code with or without its plus', () => {
    expect(filterDialCodeOptions(options, 'nig').map((o) => o.code)).toEqual(['NG']);
    expect(filterDialCodeOptions(options, 'gh').map((o) => o.code)).toEqual(['GH']);
    expect(filterDialCodeOptions(options, '+23').map((o) => o.code)).toEqual(['GH', 'NG']);
    expect(filterDialCodeOptions(options, '23').map((o) => o.code)).toEqual(['GH', 'NG']);
  });

  it('returns everything for a blank query', () => {
    expect(filterDialCodeOptions(options, '  ')).toBe(options);
  });
});

describe('buildDialCodeItems', () => {
  it('flat: the geo row first, then the rest in the given order', () => {
    const { geo, items } = buildDialCodeItems(options, 'ng', false);
    expect(geo?.code).toBe('NG');
    expect(codes(items)).toEqual(['NG', 'FR', 'GH', 'US']);
  });

  it('grouped: the geo row first, then region headers with their countries A to Z', () => {
    const { items } = buildDialCodeItems(options, 'GH', true);
    expect(codes(items)).toEqual(['GH', '#Africa', 'NG', '#Europe', 'FR', '#Americas', 'US']);
  });

  it('grouped without a guess opens straight on the first region', () => {
    const { geo, items } = buildDialCodeItems(options, null, true);
    expect(geo).toBeNull();
    expect(codes(items)[0]).toBe('#Africa');
  });

  it('keeps the caller\'s option objects, dial codes included', () => {
    const { items } = buildDialCodeItems(options, null, true);
    const ng = items.find((i) => i.kind === 'row' && i.option.code === 'NG');
    expect(ng && ng.kind === 'row' ? ng.option : null).toBe(options[2]);
  });

  it('keys headers apart from rows', () => {
    const { items } = buildDialCodeItems(options, 'NG', true);
    expect(new Set(items.map(dialCodeItemKey)).size).toBe(items.length);
    expect(dialCodeItemKey({ kind: 'header', region: 'Africa' })).toBe('region:Africa');
  });
});
