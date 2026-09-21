import { useNativeModelReady, type ModelReadyState } from '../lib/model-ready';
import { isFaceModelReady, primeFaceModel } from './visionCameraFaceDetector';

// The face half of the shared readiness gate. The rule, the polling and the
// reasoning live in ../lib/model-ready.ts, because the text recogniser needs
// exactly the same thing and one decision should not exist in two places.

export type { ModelReadyState };

/**
 * Tracks whether on-device face detection can run.
 *
 * `'preparing'` while Play Services fetches the model, `'ready'` once it can
 * run, `'unavailable'` when it could not be obtained — no Play Services, no
 * network, or a declined install.
 */
export function useFaceModelReady(): ModelReadyState {
  return useNativeModelReady(isFaceModelReady, primeFaceModel);
}
