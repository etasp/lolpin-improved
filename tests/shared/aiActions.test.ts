import { expect, it } from 'vitest';
import { apiEndpoint, defaultPingActions, normalizePingActions } from '../../src/shared/aiActions';
import { ALL_PINGS } from '../../src/shared/pings';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/shared/settings';

it('covers all pings with independent editable actions and safely repairs malformed settings', () => {
  const actions = defaultPingActions();
  expect(Object.keys(actions)).toHaveLength(ALL_PINGS.length);
  expect(actions.assist.kind).toBe('open-ai'); expect(actions.missing.kind).toBe('assistant');
  const repaired = normalizePingActions({ assist: { kind: 'exec', target: '__proto__', prompt: 'a'.repeat(3000) }, danger: { kind: 'none' } });
  expect(repaired.assist).toMatchObject({ kind: 'open-ai', target: 'default' });
  expect(repaired.assist.prompt).toHaveLength(2000); expect(repaired.danger.kind).toBe('none');
  repaired.push.prompt = 'changed'; expect(defaultPingActions().push.prompt).not.toBe('changed');
  expect(normalizeSettings({ ...DEFAULT_SETTINGS, pingActions: repaired }).pingActions).toEqual(repaired);
});
it('accepts compatibility API roots or exact paths, allows local HTTP, and rejects unsafe credential URLs', () => {
  expect(apiEndpoint('https://api.deepseek.com/')).toBe('https://api.deepseek.com/chat/completions');
  expect(apiEndpoint('https://example.com/v1/chat/completions')).toBe('https://example.com/v1/chat/completions');
  expect(apiEndpoint('http://127.0.0.1:8000/v1')).toBe('http://127.0.0.1:8000/v1/chat/completions');
  for (const value of ['http://example.com', 'https://key@example.com', 'file:///x', 'https://example.com?key=x']) expect(apiEndpoint(value)).toBeNull();
});
