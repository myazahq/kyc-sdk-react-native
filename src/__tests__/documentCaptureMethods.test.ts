import { readFileSync } from 'fs';
import { join } from 'path';

import { documentCaptureMethods } from '../config/documentCaptureMethods';
import { documentReviewCopy } from '../components/documentReviewCopy';
import { mergeWorkflowConfig, overlayApplicantWorkflow } from '../config/workflowMerge';

// ─── Scan, upload, or both ────────────────────────────────────────────────────
//
// A workflow may switch off the live camera (`allowDocumentScan`) or the photo
// upload (`allowDocumentUpload`), never both. The SDK cannot rely on the server
// having refused that: a stored or prop-supplied config can still arrive with
// both off, and then the camera stays on rather than leaving the applicant with
// no way to add their document.

describe('documentCaptureMethods', () => {
  it('offers both methods when neither switch is set', () => {
    expect(documentCaptureMethods({})).toEqual({ scan: true, upload: true });
  });

  it('drops the camera when scanning is switched off', () => {
    expect(documentCaptureMethods({ allowDocumentScan: false })).toEqual({ scan: false, upload: true });
  });

  it('drops the upload when uploading is switched off', () => {
    expect(documentCaptureMethods({ allowDocumentUpload: false })).toEqual({ scan: true, upload: false });
  });

  it('keeps the camera on when a config switches both off', () => {
    expect(documentCaptureMethods({ allowDocumentScan: false, allowDocumentUpload: false })).toEqual({
      scan: true,
      upload: false,
    });
  });

  it('treats only an explicit false as off', () => {
    expect(documentCaptureMethods({ allowDocumentScan: undefined, allowDocumentUpload: undefined })).toEqual({
      scan: true,
      upload: true,
    });
    expect(documentCaptureMethods({ allowDocumentScan: true, allowDocumentUpload: true })).toEqual({
      scan: true,
      upload: true,
    });
  });
});

describe('the switches ride a workflow', () => {
  it("a workflow's value wins over a prop", () => {
    const merged = mergeWorkflowConfig({ allowDocumentScan: false }, { allowDocumentScan: true });
    expect(documentCaptureMethods(merged)).toEqual({ scan: false, upload: true });
  });

  it("a mapped applicant workflow carries both switches onto the applicant's own leg", () => {
    const overlaid = overlayApplicantWorkflow(
      { id: 'wf_applicant', config: { allowDocumentScan: false, allowDocumentUpload: true } },
      { allowDocumentScan: true, allowDocumentUpload: false },
    );
    expect(documentCaptureMethods(overlaid)).toEqual({ scan: false, upload: true });
  });
});

// A source scan, because the failure it guards is a PROMPT: an upload-only flow
// that still calls VisionCamera's hooks asks for camera access it never uses,
// and nothing about that fails a render test.
describe('an upload-only document step never touches the camera', () => {
  const SCREENS = join(__dirname, '..', 'screens');
  const step = readFileSync(join(SCREENS, 'DocumentCaptureStep.tsx'), 'utf8');
  const upload = readFileSync(join(SCREENS, 'document', 'UploadPhase.tsx'), 'utf8');

  it('keeps the camera hooks out of the step itself', () => {
    expect(step).not.toMatch(/react-native-vision-camera/);
  });

  it('calls the camera hook only from the scanning wrapper', () => {
    const calls = step.match(/useDocumentCamera\(/g) ?? [];
    expect(calls).toHaveLength(1);
    const wrapper = step.slice(step.indexOf('function ScanningDocumentCapture('));
    expect(wrapper.indexOf('useDocumentCamera(')).toBeGreaterThan(-1);
    expect(wrapper.indexOf('useDocumentCamera(')).toBeLessThan(wrapper.indexOf('\n}\n'));
  });

  it('builds the upload screen from nothing camera-shaped', () => {
    expect(upload).not.toMatch(/react-native-vision-camera|CameraViewfinder|CameraPhase|useDocumentCamera/);
  });

  it('reads the switches through the helper, never the raw keys', () => {
    expect(step).not.toMatch(/config\.allowDocument(Scan|Upload)/);
    expect(step).toMatch(/documentCaptureMethods\(/);
  });

  it('writes its copy without em dashes', () => {
    expect(upload).not.toMatch(/—/);
  });

  it('tells the shared review which mode it is in', () => {
    expect(step).toMatch(/mode=\{camera \? 'scan' : 'upload'\}/);
    // The review components take their words from documentReviewCopy rather
    // than hard-coding the camera's, which an upload-only flow never showed.
    const COMPONENTS = join(__dirname, '..', 'components');
    for (const file of ['DocumentReview.tsx', 'DocumentReviewSide.tsx', 'DocumentReviewZoom.tsx']) {
      const source = readFileSync(join(COMPONENTS, file), 'utf8');
      expect(source).not.toMatch(/['`>]\s*Retake\b|captured['`]/);
    }
  });
});

describe('the review names what the applicant actually did', () => {
  it('keeps the camera words when the camera was used (scan-only and both-on)', () => {
    const one = documentReviewCopy('scan', false);
    const two = documentReviewCopy('scan', true);
    expect(one.status).toBe('Photo captured');
    expect(two.status).toBe('Both sides captured');
    expect(two.redo).toBe('Retake');
    expect(two.redoAccessibility('Front')).toBe('Retake front');
    expect(two.redoSide('Back')).toBe('Retake back');
  });

  it('says added and Replace when the workflow is upload-only (the web SDK wording)', () => {
    const one = documentReviewCopy('upload', false);
    const two = documentReviewCopy('upload', true);
    expect(one.status).toBe('Photo added');
    expect(two.status).toBe('Both sides added');
    expect(two.redo).toBe('Replace');
    expect(two.redoAccessibility('Front')).toBe('Replace the front photo');
    expect(two.redoSide('Back')).toBe('Replace back');
    const words = [one.status, two.status, two.redo, two.redoAccessibility('Front'), two.redoSide('Back')];
    for (const text of words) expect(text).not.toMatch(/retake|captur|—/i);
  });

  it('labels the front preview Replace in upload-only mode and Retake when scanning', () => {
    const step = readFileSync(join(__dirname, '..', 'screens', 'DocumentCaptureStep.tsx'), 'utf8');
    expect(step).toMatch(/label=\{camera \? 'Retake' : 'Replace'\}/);
  });
});
