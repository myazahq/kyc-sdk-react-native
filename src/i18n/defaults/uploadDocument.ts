// Document capture: camera, upload, crop and review.
//
// Keys this SDK shows, each with ITS OWN default: the wording the screen had
// before the key existed, byte for byte. NOT_SHOWN lists the group's keys that
// name a place this SDK has no screen for, each with the reason.

export const UPLOAD_DOCUMENT_TEXTS: Record<string, string> = {
  // Sheet headers (components/stepHeaderCopy.ts, stepHeaderMeta.tsx).
  'uploadDocument.title.capture': 'Capture Your {document}',
  'uploadDocument.description.capture': 'Photograph your {document}. Position it within the frame and hold steady.',
  'uploadDocument.title.frontCaptured': 'Front Side Captured',
  'uploadDocument.description.frontCaptured': 'Looks good? Tap Next to flip the card and scan the back side.',
  'uploadDocument.title.scanBack': 'Scan Back Side',
  'uploadDocument.description.scanBack': 'Now place the BACK of your {document} within the frame.',
  'uploadDocument.title.review': 'Review Your {document}',
  'uploadDocument.description.review': 'Tap Continue to upload and submit your document.',
  'uploadDocument.title.upload': 'Upload Your {document}',
  'uploadDocument.description.upload': 'Choose a clear photo of your {document} from your device.',
  'uploadDocument.title.frontAdded': 'Front Side Added',
  'uploadDocument.description.frontAdded': 'Looks good? Tap Next to add a photo of the back.',
  'uploadDocument.title.uploadBack': 'Upload Back Side',
  // A two-sided document's front and review: the same wording as the
  // one-sided screens, until an org words them differently.
  'uploadDocument.title.scanFront': 'Capture Your {document}',
  'uploadDocument.description.scanFront': 'Photograph your {document}. Position it within the frame and hold steady.',
  'uploadDocument.title.uploadFront': 'Upload Your {document}',
  'uploadDocument.description.uploadFront': 'Choose a clear photo of your {document} from your device.',
  'uploadDocument.description.reviewBoth': 'Tap Continue to upload and submit your document.',
  'uploadDocument.description.reviewBothAdded': 'Tap Continue to upload and submit your document.',
  'uploadDocument.description.uploadBack': 'Now choose a photo of the back of your {document}.',
  // The camera (screens/document/CameraPhase.tsx).
  'uploadDocument.flipBanner': 'Flip the card over and scan the other side',
  'uploadDocument.camera.havingTrouble': 'Having trouble?',
  'uploadDocument.camera.uploadInstead': 'Upload a photo instead',
  // Upload-only capture (screens/document/UploadPhase.tsx).
  'uploadDocument.upload.hint': 'Choose a clear photo from your device. You can crop it on the next screen.',
  'uploadDocument.upload.tapToChoose': 'Tap to choose a photo',
  'uploadDocument.upload.tip2': 'The whole document in view, all four corners',
  'uploadDocument.upload.tip3': 'Sharp and evenly lit, with no glare',
  // components/DocumentCropper.tsx.
  'uploadDocument.crop.confirm': 'Crop & Use',
  // components/DocumentReview.tsx.
  'uploadDocument.review.tapToEnlarge': 'Tap a photo to see it larger.',
  // screens/document/CaptureCheckNotice.tsx (default kept in lib/documentCaptureCheck.ts).
  'uploadDocument.check.title': 'Check your photos',
};

export const UPLOAD_DOCUMENT_NOT_SHOWN: Record<string, string> = {
  'uploadDocument.upload.addFromGallery':
    'The upload card heading names the side being added (the front, the back or the document), which this text cannot carry',
  'uploadDocument.upload.tip1': 'The upload tips have no lay-it-flat line; the two shown are tip2 and tip3',
  'uploadDocument.crop.title':
    'The cropper is a full-screen view with its own fixed bar; no step header is shown while cropping',
  'uploadDocument.crop.description':
    'The cropper is a full-screen view with its own fixed bar; no step header is shown while cropping',
};
