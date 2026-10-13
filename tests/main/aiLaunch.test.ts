import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { shell } from 'electron';
import { openAi } from '../../src/main/aiLaunch';

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }));
vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const finishWith = (stdout: string) => ((...args: unknown[]) => {
  const callback = args.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
  callback(null, stdout, '');
}) as typeof execFile;
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  vi.mocked(shell.openExternal).mockResolvedValue();
  vi.mocked(execFile).mockImplementation(finishWith('True\n'));
});
afterEach(() => { Object.defineProperty(process, 'platform', originalPlatform); vi.resetAllMocks(); });

it('uses the supported Codex new-chat link and activates its window on Windows', async () => {
  await openAi('codex');
  expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith('codex://threads/new');
  expect(execFile).toHaveBeenCalledWith(expect.stringMatching(/powershell\.exe$/),
    expect.arrayContaining(['Hidden', expect.stringContaining('AttachThreadInput')]),
    { windowsHide: true, timeout: 8000 }, expect.any(Function));
});

it('reports failed activation and skips Windows activation for other targets and platforms', async () => {
  vi.mocked(execFile).mockImplementation(finishWith('False\n'));
  await expect(openAi('codex')).rejects.toThrow('could not be activated');
  await openAi('cc'); await openAi('deepseek');
  Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  await openAi('codex');
  expect(execFile).toHaveBeenCalledTimes(1);
});
