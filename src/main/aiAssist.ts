import { isPingId } from '../shared/pings';
import type { AiAssistant } from './aiAssistant';
import type { OverlayManager, SharedPing } from './overlayManager';

/** Only committed local pings emit 'shared'; remote pings and settings previews do not. */
export function registerAiAssist(overlays: OverlayManager, assistant: AiAssistant): void {
  overlays.on('shared', (ping: SharedPing) => {
    if (isPingId(ping.id)) void assistant.ping(ping.id, ping);
  });
}
