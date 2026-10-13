import { Button, Checkbox, Dropdown, Input, Option, Textarea } from '@fluentui/react-components';
import { PeopleCommunity24Regular } from '@fluentui/react-icons';
import { useEffect, useRef, useState } from 'react';
import { ACTION_KINDS, AI_SKILLS, apiEndpoint, defaultPingActions, type AiState, type PingAction } from '../../../shared/aiActions';
import { AI_TARGETS, type AiTarget } from '../../../shared/aiTargets';
import { ALL_PINGS, textureUrl, type PingId } from '../../../shared/pings';
import type { Settings } from '../../../shared/settings';
import { api } from '../api';
import { useText } from '../text';
import type { Update } from '../useAppState';
import { SettingRow, SwitchRow } from './rows';

export function AiSection({ settings: s, update }: { settings: Settings; update: Update }) {
  const t = useText();
  const zh = t.lang === 'zh-CN';
  const label = (cn: string, en: string) => zh ? cn : en;
  const kinds = { none: label('只发 ping', 'Just ping'), 'open-ai': label('直接呼出 AI', 'Open AI'), assistant: label('打开智能面板', 'Assistant panel'), 'copy-prompt': label('复制提示词', 'Copy prompt'), reminder: label('本地提醒', 'Local reminder') };
  const [state, setState] = useState<AiState | null>(null);
  const [context, setContext] = useState('');
  const [key, setKey] = useState('');
  const [apiUrl, setApiUrl] = useState(s.aiApiBaseUrl);
  const [model, setModel] = useState(s.aiApiModel);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState('');
  const revision = useRef(-1);
  useEffect(() => { setApiUrl(s.aiApiBaseUrl); setModel(s.aiApiModel); }, [s.aiApiBaseUrl, s.aiApiModel]);
  useEffect(() => {
    let received = false;
    const receive = (next: AiState) => {
      received = true;
      if (revision.current !== next.revision) { revision.current = next.revision; setContext(next.context); setMessage(''); setIncludeScreenshot(true); }
      setState(next);
    };
    const off = api.onAi(receive);
    void api.getAi().then((next) => { if (!received) receive(next); });
    void api.aiKeyStatus().then(setConfigured);
    return off;
  }, []);
  const change = (id: PingId, patch: Partial<PingAction>) => void update({ pingActions: { ...s.pingActions, [id]: { ...s.pingActions[id], ...patch } } });
  const run = async (external: boolean) => {
    if (!state) return;
    const id = state.revision;
    setMessage('');
    const result = await (external ? api.openAiDraft : api.runAi)({ revision: id, context, includeScreenshot });
    if (revision.current === id) setMessage(result.ok ? external ? label('提示词已复制，AI 已打开；粘贴后发送。', 'Prompt copied; paste it into the opened AI.') : '' : result.error);
  };
  const saveConfig = async () => {
    if (!apiEndpoint(apiUrl) || !/^[a-zA-Z0-9._:/-]{1,100}$/.test(model)) { setMessage(label('请输入有效的 API 地址和模型名。', 'Enter a valid API URL and model.')); return; }
    if (key.trim()) {
      const result = await api.saveAiKey(key);
      if (!result.ok) { setMessage(result.error); return; }
      setKey(''); setConfigured(true);
    }
    await update({ aiApiBaseUrl: apiUrl, aiApiModel: model });
    setMessage(label('API 配置已保存。', 'API setup saved.'));
  };
  return <>
    <SwitchRow icon={<PeopleCommunity24Regular />} title={s.aiAssist ? label('当前：AI 模式', 'AI mode') : label('当前：娱乐 ping 模式', 'Fun ping mode')}
      description={label('Ctrl＋Alt＋A 切换。娱乐模式只发信号；AI 模式仅处理本机 ping。联机收到的信号不会调用 AI。', 'Ctrl/⌘+Alt+A switches modes. Fun mode only pings. Remote pings never call AI.')}
      checked={s.aiAssist} onChange={(aiAssist) => void update({ aiAssist })} />
    <SettingRow icon={<PeopleCommunity24Regular />} title={label('默认呼出的 AI', 'Default AI')}>
      <Dropdown value={AI_TARGETS[s.aiAssistTarget].name} selectedOptions={[s.aiAssistTarget]} onOptionSelect={(_, d) => void update({ aiAssistTarget: d.optionValue as AiTarget })}>
        {Object.entries(AI_TARGETS).map(([id, target]) => <Option key={id} value={id}>{target.name}</Option>)}
      </Dropdown>
    </SettingRow>
    <div className="card aiPanel">
      <h3>{label('智能面板', 'Assistant')} · {state ? zh ? AI_SKILLS[state.ping].title : AI_SKILLS[state.ping].en : ''}</h3>
      <p className="desc">{label('先复制文字，再发对应 ping；也可以直接填写。确认内容后选 API 直答，或复制到 Codex / CC / DS。', 'Copy text and ping, or type here. Review it before sending to the API or opening your AI.')}</p>
      <Textarea aria-label={label('待分析内容', 'Context')} value={context} rows={5} resize="vertical" maxLength={20000} onChange={(_, d) => setContext(d.value)} />
      <Button disabled={!s.aiAssist || state?.busy} onClick={() => {
        void api.captureAiScreen().then((result) => { setMessage(result.ok ? label('截图已预览；确认后再发送。', 'Review the screenshot before sending.') : result.error); setIncludeScreenshot(true); });
      }}>{label('截取信号附近画面', 'Capture around the ping')}</Button>
      {state?.screenshot ? <><img className="aiScreenshot" src={state.screenshot} alt={label('待发送的截图预览', 'Screenshot preview')} /><Checkbox checked={includeScreenshot} onChange={(_, d) => setIncludeScreenshot(d.checked === true)} label={label('发送时附带这张截图（需模型支持图片）', 'Include this screenshot (vision model required)')} /><span className="desc">{label('呼出桌面 / 网页 AI 时只复制文字，图片请自行附上。', 'External AI receives copied text; attach the image yourself.')}</span></> : null}
      <div className="aiButtons">
        <Button appearance="primary" disabled={!s.aiAssist || !configured || (!context.trim() && !(includeScreenshot && state?.screenshot)) || state?.busy} onClick={() => void run(false)}>{state?.busy ? label('正在请求…', 'Working…') : label('发送给 API', 'Send to API')}</Button>
        <Button disabled={!s.aiAssist || (!context.trim() && !(includeScreenshot && state?.screenshot)) || state?.busy} onClick={() => void run(true)}>{label('复制并打开 AI', 'Copy and open AI')}</Button>
        {state?.busy ? <Button onClick={() => void api.cancelAi()}>{label('取消', 'Cancel')}</Button> : null}
      </div>
      {message || state?.error ? <p className="warnText" role="status">{message || state?.error}</p> : null}
      {state?.response ? <pre className="aiAnswer">{state.response}</pre> : null}
    </div>
    <details className="card aiPanel">
      <summary>{label('API 配置（可选）', 'API setup (optional)')} · {configured ? label('已保存密钥', 'Key saved') : label('尚未配置密钥', 'No key saved')}</summary>
      <p className="desc">{label('兼容 Chat Completions；例如 DeepSeek。密钥保存在本机加密文件中。只发送你确认的内容。', 'Chat Completions compatible. The key is encrypted locally. Only reviewed content is sent.')}</p>
      <label>API URL<Input value={apiUrl} onChange={(_, d) => setApiUrl(d.value)} /></label>
      <label>{label('模型', 'Model')}<Input value={model} onChange={(_, d) => setModel(d.value)} /></label>
      <label>API Key<Input type="password" autoComplete="off" value={key} placeholder={configured ? label('留空保留已保存的密钥', 'Leave blank to keep your key') : ''} onChange={(_, d) => setKey(d.value)} /></label>
      <div className="aiButtons"><Button onClick={() => void saveConfig()}>{label('保存 API 配置', 'Save API setup')}</Button><Button disabled={!configured} onClick={() => void api.clearAiKey().then(() => setConfigured(false))}>{label('删除密钥', 'Delete key')}</Button></div>
    </details>
    <div className="card aiPanel"><div className="aiButtons"><h3>{label('每种 ping 的动作', 'Per-ping actions')}</h3><Button onClick={() => void update({ pingActions: defaultPingActions() })}>{label('恢复默认动作', 'Reset actions')}</Button></div>
      <p className="desc">{label('点击展开可修改动作、使用的 AI 和提示词。原轮盘图标保持不变。', 'Expand each ping to change its action, AI and prompt.')}</p>
    </div>
    {ALL_PINGS.map((p) => <details className="card aiPanel" key={p.id}>
      <summary><img src={textureUrl(p.icon)} width={28} height={28} alt="" />{t.pingNames[p.id]} · {zh ? AI_SKILLS[p.id].title : AI_SKILLS[p.id].en}<span className="desc">{kinds[s.pingActions[p.id].kind]}</span></summary>
      <div className="aiButtons"><Dropdown aria-label={`${t.pingNames[p.id]} action`} value={kinds[s.pingActions[p.id].kind]} selectedOptions={[s.pingActions[p.id].kind]} onOptionSelect={(_, d) => change(p.id, { kind: d.optionValue as PingAction['kind'] })}>
        {ACTION_KINDS.map((kind) => <Option key={kind} value={kind}>{kinds[kind]}</Option>)}
      </Dropdown><Dropdown aria-label={`${t.pingNames[p.id]} AI`} value={s.pingActions[p.id].target === 'default' ? label('使用默认 AI', 'Default AI') : AI_TARGETS[s.pingActions[p.id].target as AiTarget].name} selectedOptions={[s.pingActions[p.id].target]} onOptionSelect={(_, d) => change(p.id, { target: d.optionValue as PingAction['target'] })}>
        <Option value="default">{label('使用默认 AI', 'Default AI')}</Option>{Object.entries(AI_TARGETS).map(([id, target]) => <Option key={id} value={id}>{target.name}</Option>)}
      </Dropdown></div>
      <Textarea aria-label={`${t.pingNames[p.id]} prompt`} value={s.pingActions[p.id].prompt} rows={3} maxLength={2000} resize="vertical" onChange={(_, d) => change(p.id, { prompt: d.value })} />
    </details>)}
  </>;
}
