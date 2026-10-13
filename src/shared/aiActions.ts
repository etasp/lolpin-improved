import { ALL_PINGS, type PingId } from './pings';
import { isAiTarget, type AiTarget } from './aiTargets';

export const ACTION_KINDS = ['none', 'open-ai', 'assistant', 'api-bubble', 'copy-prompt', 'reminder'] as const;
export type ActionKind = typeof ACTION_KINDS[number];
export interface PingAction { kind: ActionKind; target: AiTarget | 'default'; prompt: string }
export type PingActions = Record<PingId, PingAction>;
export const AI_SKILLS: Record<PingId, { title: string; en: string; prompt: string; kind: ActionKind }> = {
  assist: { title: '解释 / 求助', en: 'Explain / help', kind: 'open-ai', prompt: '请用通俗的话解释以下内容，先给结论，再给一个例子。信息不足时先提问，不要编造。' },
  missing: { title: '提问 / 解惑', en: 'Questions', kind: 'assistant', prompt: '请指出以下内容中容易产生疑问的地方，并逐一解释。缺少的信息请明确列出来。' },
  danger: { title: '找坑点 / 风险', en: 'Pitfalls / risks', kind: 'assistant', prompt: '请检查以下内容的漏洞、风险、错误假设和容易踩的坑，并给出检查方法。区分确定的问题和待核实的推测。' },
  push: { title: '下一步', en: 'Next steps', kind: 'assistant', prompt: '针对以下内容，请列出接下来最值得做的三步，按优先级排序，说明每一步怎么开始。' },
  omw: { title: '开始行动', en: 'Start working', kind: 'reminder', prompt: '已标记：我开始处理这一步。' },
  allin: { title: '辅导 / 确认方案', en: 'Coach / confirm', kind: 'assistant', prompt: '请像辅导老师一样检查以下思路：先确认目标，再指出需要修正的地方，最后给一个可执行的方案。' },
  needvision: { title: '补背景', en: 'Background', kind: 'assistant', prompt: '请补充理解以下内容所需的背景、术语和前提，区分已知信息和仍需查证的内容。' },
  enemyvision: { title: '翻译', en: 'Translate', kind: 'assistant', prompt: '请将以下内容翻译为自然的中文；如果原文是中文，则翻译为英文。保留专有名词，并简要解释关键术语。' },
  generic: { title: '普通标记', en: 'Plain ping', kind: 'none', prompt: '请简要整理以下内容的重点。' },
  bait: { title: '聊天回复', en: 'Draft a reply', kind: 'assistant', prompt: '请根据以下聊天内容给出三种自然的回复：简洁、友好、正式。不要虚构我的经历或承诺。' },
  visioncleared: { title: '完成 / 已确认', en: 'Done / confirmed', kind: 'reminder', prompt: '已标记：这一步已确认。' },
};
export const defaultPingActions = (): PingActions => Object.fromEntries(ALL_PINGS.map(({ id }) => [id, {
  kind: AI_SKILLS[id].kind, target: 'default', prompt: AI_SKILLS[id].prompt,
}])) as PingActions;
export function normalizePingActions(raw: unknown): PingActions {
  const result = defaultPingActions();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return result;
  for (const { id } of ALL_PINGS) {
    const value = Object.hasOwn(raw, id) ? (raw as Record<string, unknown>)[id] : null;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
    const r = value as Record<string, unknown>;
    result[id] = {
      kind: ACTION_KINDS.includes(r.kind as ActionKind) ? r.kind as ActionKind : result[id].kind,
      target: isAiTarget(r.target) ? r.target : 'default',
      prompt: typeof r.prompt === 'string' && r.prompt.trim() ? r.prompt.trim().slice(0, 2000) : result[id].prompt,
    };
  }
  return result;
}
export function apiEndpoint(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 500) return null;
  try {
    const url = new URL(raw.trim());
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null;
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
    return url.href;
  } catch { return null; }
}
export interface AiState { revision: number; ping: PingId; context: string; response: string; error: string; busy: boolean; screenshot?: string }
export interface AiRequest { revision: number; context: string; includeScreenshot?: boolean }
export type AiResult = { ok: true } | { ok: false; error: string };
export interface AiBubble { x: number; y: number; title: string; body: string; pingId: PingId; ms: number }
