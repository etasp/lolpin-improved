import { safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Stored separately from settings; only encrypted bytes reach disk. */
export class AiKeyStore {
  private readonly file: string;
  constructor(private readonly dir: string) { this.file = join(dir, 'ai-key.enc'); }
  read(): string | null {
    try {
      if (!safeStorage.isEncryptionAvailable() || !existsSync(this.file)) return null;
      return safeStorage.decryptString(readFileSync(this.file)) || null;
    } catch { return null; }
  }
  save(key: unknown): void {
    if (typeof key !== 'string' || !key.trim() || key.length > 4096 || /[\r\n]/.test(key)) throw new Error('请输入有效的 API 密钥。');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统加密不可用，无法保存密钥。');
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file, safeStorage.encryptString(key.trim()), { mode: 0o600 });
  }
  clear(): void { rmSync(this.file, { force: true }); }
}
