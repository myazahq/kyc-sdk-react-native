/**
 * `expo-document-picker`, loaded on demand.
 *
 * A static import runs the module's native lookup at MODULE load, which throws
 * `Cannot find native module 'ExpoDocumentPicker'` on any host app that has not
 * rebuilt to pick it up — taking down the whole SDK, including flows that never
 * choose a file. Requiring it at the moment the user taps means the capability
 * degrades to photo-only where it is unavailable, matching the null-degrade
 * posture the platform uses for every other optional native dependency.
 */
export type DocumentPickerModule = typeof import('expo-document-picker');

export function loadDocumentPicker(): DocumentPickerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-document-picker') as DocumentPickerModule;
  } catch {
    return null;
  }
}
