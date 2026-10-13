import { desktopCapturer, screen } from 'electron';
import type { SharedPing } from './overlayManager';

/** A user-clicked capture, cropped around their last local ping; never sent here. */
export async function capturePingScreen(point?: SharedPing): Promise<string> {
  const display = screen.getAllDisplays().find((d) => d.id === point?.displayId) ?? screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1920 } });
  const source = sources.find((s) => s.display_id === String(display.id));
  if (!source || source.thumbnail.isEmpty()) throw new Error('无法截取屏幕，请检查系统录屏权限。');
  const image = source.thumbnail;
  const size = image.getSize();
  const sx = size.width / display.bounds.width, sy = size.height / display.bounds.height;
  const width = Math.min(size.width, Math.round(1000 * sx)), height = Math.min(size.height, Math.round(700 * sy));
  const x = Math.max(0, Math.min(size.width - width, Math.round((point?.x ?? display.bounds.width / 2) * sx - width / 2)));
  const y = Math.max(0, Math.min(size.height - height, Math.round((point?.y ?? display.bounds.height / 2) * sy - height / 2)));
  return `data:image/jpeg;base64,${image.crop({ x, y, width, height }).toJPEG(85).toString('base64')}`;
}
