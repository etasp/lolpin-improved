import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { safeStorage } from 'electron';
import { AiKeyStore } from '../../src/main/aiKeyStore';

vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: vi.fn(() => true),
  encryptString: (s: string) => Buffer.from(Buffer.from(s).toString('base64')), decryptString: (b: Buffer) => Buffer.from(b.toString(), 'base64').toString() } }));
it('stores encrypted bytes separately, deletes keys, and refuses an unencrypted fallback', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ping-key-')); const keys = new AiKeyStore(dir);
  expect(keys.read()).toBeNull(); keys.save('dummy-test-key');
  expect(readFileSync(join(dir, 'ai-key.enc')).toString()).not.toContain('dummy-test-key');
  expect(new AiKeyStore(dir).read()).toBe('dummy-test-key'); keys.clear(); expect(keys.read()).toBeNull();
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
  expect(() => keys.save('dummy-test-key')).toThrow('加密'); expect(keys.read()).toBeNull();
});
