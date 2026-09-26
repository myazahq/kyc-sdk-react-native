import { supportingDocumentsIntro } from '../lib/supportingDocumentsIntro';

const req = (n: number) => Array.from({ length: n }, () => ({ required: true }));
const opt = (n: number) => Array.from({ length: n }, () => ({ required: false }));

// MIRROR of the web SDK's supporting-documents-intro test. An applicant on
// Android must read the same words as one on the web.
describe('supportingDocumentsIntro', () => {
  it('says what is needed when everything is', () => {
    expect(supportingDocumentsIntro(req(1))).toBe('We need this document to continue. Upload it below.');
    expect(supportingDocumentsIntro(req(3))).toBe(
      'We need all 3 of these documents to continue. Upload one for each item below.',
    );
  });

  it('says the step can be skipped when nothing is compulsory', () => {
    expect(supportingDocumentsIntro(opt(1))).toContain('You can skip it.');
    expect(supportingDocumentsIntro(opt(2))).toContain('You can skip the rest.');
  });

  it('counts the required ones when the list is mixed', () => {
    expect(supportingDocumentsIntro([...req(1), ...opt(2)])).toBe(
      'We need 1 of these 3 documents to continue, marked with *. Upload the others if you have them.',
    );
  });

  it('never explains the asterisk where it marks everything or nothing', () => {
    expect(supportingDocumentsIntro(req(2))).not.toContain('*');
    expect(supportingDocumentsIntro(opt(2))).not.toContain('*');
  });

  it('never hedges the plural', () => {
    for (const slots of [req(1), req(2), opt(1), opt(3), [...req(1), ...opt(1)]]) {
      expect(supportingDocumentsIntro(slots)).not.toContain('(s)');
    }
  });
});
