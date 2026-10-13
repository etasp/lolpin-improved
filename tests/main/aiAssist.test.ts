import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { clipboard, shell } from 'electron';
import { registerAiAssist } from '../../src/main/aiAssist';
import type { OverlayManager } from '../../src/main/overlayManager';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/shared/settings';
import { AiAssistant } from '../../src/main/aiAssistant';
import { AiKeyStore } from '../../src/main/aiKeyStore';
import { AI_TARGETS, type AiTarget } from '../../src/shared/aiTargets';

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() }, clipboard: { readText: vi.fn(), writeText: vi.fn() } }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

it('opens the chosen AI only for enabled local assistance, suppresses bursts, and reports launch failures', async () => {
  vi.useFakeTimers();
  const overlays = new EventEmitter() as OverlayManager;
  let enabled = false;
  let target: AiTarget = 'codex';
  const failed = vi.fn();
  const open = vi.mocked(shell.openExternal).mockResolvedValue();
  const assistant = new AiAssistant({
    settings: () => normalizeSettings({ ...DEFAULT_SETTINGS, aiAssist: enabled, aiAssistTarget: target }), enabled: () => true,
    keys: { read: () => null } as AiKeyStore, capture: vi.fn(), show: vi.fn(), toast: failed,
  });
  registerAiAssist(overlays, assistant);
  overlays.emit('shared', { id: 'assist' });
  expect(open).not.toHaveBeenCalled();
  enabled = true;
  overlays.emit('remotePing', { id: 'assist' });
  expect(open).not.toHaveBeenCalled();
  overlays.emit('shared', { id: 'assist' });
  overlays.emit('shared', { id: 'assist' });
  expect(open).toHaveBeenCalledExactlyOnceWith('codex://launch');
  await vi.advanceTimersByTimeAsync(1500);
  open.mockRejectedValueOnce(new Error('No protocol handler'));
  overlays.emit('shared', { id: 'assist' });
  await vi.advanceTimersByTimeAsync(1500);
  expect(failed).toHaveBeenCalledOnce();
  overlays.emit('shared', { id: 'assist' });
  expect(open).toHaveBeenCalledTimes(3);
  for (const next of ['cc', 'deepseek'] as const) {
    await vi.advanceTimersByTimeAsync(1500);
    target = next;
    overlays.emit('shared', { id: 'assist' });
    expect(open).toHaveBeenLastCalledWith(AI_TARGETS[next].url);
    expect(normalizeSettings({ aiAssistTarget: next }).aiAssistTarget).toBe(next);
  }
  expect(normalizeSettings({ aiAssist: true }).aiAssist).toBe(true);
  expect(normalizeSettings({ aiAssist: 'yes' }).aiAssist).toBe(false);
  expect(normalizeSettings({ aiAssistTarget: '__proto__' }).aiAssistTarget).toBe('codex');
});

it('fun mode and remote pings never read context, capture, or call AI', async () => {
  const overlays = new EventEmitter() as OverlayManager;
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const capture = vi.fn(); const show = vi.fn();
  const assistant = new AiAssistant({ settings: () => normalizeSettings({ ...DEFAULT_SETTINGS }), enabled: () => true,
    keys: { read: () => 'test-only' } as AiKeyStore, capture, show, toast: vi.fn() });
  registerAiAssist(overlays, assistant);
  overlays.emit('shared', { id: 'missing' });
  overlays.emit('remotePing', { id: 'missing' });
  await assistant.capture();
  await assistant.run({ revision: 0, context: 'hello' });
  expect(clipboard.readText).not.toHaveBeenCalled();
  expect(shell.openExternal).not.toHaveBeenCalled();
  expect(capture).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled(); expect(show).not.toHaveBeenCalled();
});

it('only submits reviewed text or explicitly included screenshots, and keeps each ping intent', async () => {
  vi.useFakeTimers();
  let s = normalizeSettings({ ...DEFAULT_SETTINGS, aiAssist: true });
  const sent: Record<string, unknown>[] = [];
  const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string));
    return new Response(JSON.stringify({ choices: [{ message: { content: '这里是检查后的结果' } }] }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  vi.mocked(clipboard.readText).mockResolvedValue('用户复制的文字');
  const capture = vi.fn().mockResolvedValue('data:image/jpeg;base64,dGVzdA==');
  const assistant = new AiAssistant({ settings: () => s, enabled: () => true, keys: { read: () => 'test-only' } as AiKeyStore, capture, show: vi.fn(), toast: vi.fn() });
  await assistant.ping('danger');
  expect(assistant.state()).toMatchObject({ ping: 'danger', context: '用户复制的文字', busy: false });
  expect(fetcher).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled();
  const first = assistant.state().revision;
  await assistant.capture();
  await assistant.run({ revision: first, context: '确认过的文字', includeScreenshot: false });
  expect(sent[0]).toMatchObject({ messages: [{ role: 'system' }, { role: 'user', content: expect.stringContaining('风险') }] });
  expect((sent[0].messages as { content: unknown }[])[1].content).not.toContain('用户复制的文字');
  expect(assistant.state().response).toBe('这里是检查后的结果');
  await assistant.run({ revision: first, context: '', includeScreenshot: true });
  expect((sent[1].messages as { content: unknown }[])[1].content).toEqual([
    { type: 'text', text: expect.stringContaining('截图') }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,dGVzdA==' } },
  ]);
  await vi.advanceTimersByTimeAsync(1500); await assistant.ping('push');
  expect((await assistant.run({ revision: first, context: 'stale' })).ok).toBe(false);
  await assistant.run({ revision: assistant.state().revision, context: '新任务' });
  expect((sent[2].messages as { content: unknown }[])[1].content).toContain('三步');
  s = { ...s, aiAssist: false };
  expect((await assistant.run({ revision: assistant.state().revision, context: 'blocked' })).ok).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('cancels requests without letting a stale response replace a new ping, and reports API errors', async () => {
  vi.useFakeTimers();
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, aiAssist: true });
  vi.mocked(clipboard.readText).mockResolvedValue('text');
  const fetcher = vi.fn((_url: unknown, options: RequestInit) => new Promise<Response>((_, reject) => options.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
  vi.stubGlobal('fetch', fetcher);
  const assistant = new AiAssistant({ settings: () => settings, enabled: () => true, keys: { read: () => 'test-only' } as AiKeyStore,
    capture: vi.fn(), show: vi.fn(), toast: vi.fn() });
  await assistant.ping('missing');
  const pending = assistant.run({ revision: assistant.state().revision, context: 'text' });
  await vi.advanceTimersByTimeAsync(1500);
  await assistant.ping('enemyvision');
  expect((await pending).ok).toBe(false);
  expect(assistant.state()).toMatchObject({ ping: 'enemyvision', response: '', error: '', busy: false });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not shown', { status: 401 })));
  expect(await assistant.run({ revision: assistant.state().revision, context: 'text' })).toMatchObject({ ok: false, error: expect.stringContaining('401') });
});
