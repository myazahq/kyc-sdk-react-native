// The presence tier's tiny JSON persistence, via expo-file-system loaded
// through the SDK's optional-module pattern — a host without the module
// simply has no presence tier, never a crash. Shared by the pin store and
// the background tier's own store so the shim exists once.

interface FileLike {
  exists: boolean;
  create(options?: { intermediates?: boolean; overwrite?: boolean }): void;
  write(content: string): void;
  textSync(): string;
}

interface FileSystemModule {
  File: new (directory: unknown, name: string) => FileLike;
  Paths: { document: unknown };
}

function fsModule(): FileSystemModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-file-system') as Partial<FileSystemModule>;
    return mod?.File && mod?.Paths ? (mod as FileSystemModule) : null;
  } catch {
    return null;
  }
}

export function readJsonFile(name: string): Record<string, unknown> {
  const fs = fsModule();
  if (!fs) return {};
  try {
    const file = new fs.File(fs.Paths.document, name);
    if (!file.exists) return {};
    const parsed = JSON.parse(file.textSync()) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function writeJsonFile(name: string, value: Record<string, unknown>): void {
  const fs = fsModule();
  if (!fs) return;
  try {
    const file = new fs.File(fs.Paths.document, name);
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(value));
  } catch {
    // Best-effort: a failed save costs the presence tier, never the flow.
  }
}
