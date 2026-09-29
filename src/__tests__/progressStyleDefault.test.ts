import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';

// The progress bar is the default indicator in all three SDKs (2026-09-29).
// A config that names no style draws the bar; Flutter's mapping is tested in
// progress_style_default_test.dart. This pins the three defaults together so
// they cannot drift.

describeInMonorepo('the progress bar is the default indicator', () => {
  it('react native', () => {
    expect(read('kyc-sdk-react-native/src/components/KycSheet.tsx')).toMatch(/config\.progressStyle \?\? "bar"/);
  });

  it('web', () => {
    expect(read('kyc-sdk-react/src/components/KYCModal.tsx')).toMatch(/config\.progressStyle \?\? 'bar'/);
  });

  it('flutter', () => {
    const src = read('kyc-sdk-flutter/lib/src/config/kyc_config.dart');
    expect(src).toMatch(/this\.progressStyle = MyazaProgressStyle\.bar,/);
  });
});
