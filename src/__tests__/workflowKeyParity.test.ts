import { describeInMonorepo, readPackageFile as read } from './helpers/monorepo';
import { WORKFLOW_KEYS } from '../config/workflowMerge';

// ─── RN's workflow key list must cover the web SDK's ─────────────────────────
//
// The defect this pins: a template block reaches the config TYPE, a screen
// reads it, the step order derives from it, the store persists it, the submit
// body carries it — and the key is missing from WORKFLOW_KEYS, so a
// workflow-mounted flow never receives the block at all. Nothing errors. Types
// pass. Every unit test on the pure helpers passes. The feature is simply
// inert, and only on the SDK with the gap.
//
// It shipped with `supportingDocuments` (user report 2026-09-25): the whole
// supporting-documents feature was wired end to end on RN and could never run,
// because this one line was absent. A source diff against the web list is the
// check that would have caught it, and the file's own header already claims to
// mirror that list.

/** The web list, read from source — the thing RN claims to mirror. */
function webWorkflowKeys(): string[] {
  const source = read('kyc-sdk-react/src/lib/workflow-merge.ts');
  const list = source.slice(
    source.indexOf('const WORKFLOW_KEYS'),
    source.indexOf('] as const'),
  );
  return [...list.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]!);
}

// Keys that are genuinely one platform's own. Adding to either set is a claim
// about the platform, not a way to silence the test — check the consumers
// first.
//
// `assetsBasePath` serves web bundling; `deviceHandoff` gates the desktop → phone
// QR, which a phone has no use for; `fullScreen` sizes a web modal, and RN is
// always fullscreen.
const WEB_ONLY = new Set(['assetsBasePath', 'deviceHandoff', 'fullScreen']);
// The KYB success screen's invite-link recovery sheet exists on the mobile SDKs
// only.
const RN_ONLY = new Set(['keyPeopleLinkRecovery']);

describeInMonorepo('the workflow key list mirrors the web SDK', () => {
  it('carries every web key that is not web-only', () => {
    const missing = webWorkflowKeys().filter(
      (key) => !WEB_ONLY.has(key) && !(WORKFLOW_KEYS as readonly string[]).includes(key),
    );
    expect(missing).toEqual([]);
  });

  it('adds nothing the web SDK lacks beyond the mobile-only keys', () => {
    const web = new Set(webWorkflowKeys());
    const extra = (WORKFLOW_KEYS as readonly string[]).filter(
      (key) => !web.has(key) && !RN_ONLY.has(key),
    );
    expect(extra).toEqual([]);
  });

  it('the platform-only sets name keys that really are one-sided', () => {
    const web = new Set(webWorkflowKeys());
    const rn = new Set(WORKFLOW_KEYS as readonly string[]);
    // A key listed as web-only but present here (or vice versa) means the set
    // is stale — delete the entry rather than leaving a false claim in place.
    for (const key of WEB_ONLY) {
      expect(web.has(key)).toBe(true);
      expect(rn.has(key)).toBe(false);
    }
    for (const key of RN_ONLY) {
      expect(rn.has(key)).toBe(true);
      expect(web.has(key)).toBe(false);
    }
  });

  it('carries supportingDocuments, the key the whole feature hung on', () => {
    expect(WORKFLOW_KEYS as readonly string[]).toContain('supportingDocuments');
  });
});
