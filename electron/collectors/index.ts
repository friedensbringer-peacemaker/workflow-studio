import type { CaptureConfig } from "../../common/config";
import type { Collector } from "../recorder/collector";
import { ActiveWindowCollector } from "./active-window";
import { ClipboardCollector } from "./clipboard";
import { InteractionCollector } from './interactions';

/**
 * Builds the collectors enabled by `config`. Sources the user hasn't opted into
 * are simply not constructed, so a disabled source costs nothing and — crucially
 * for `windowTitles`/`browserUrls` — never triggers a permission prompt.
 *
 * Video is not a main-process Collector: it is captured in the renderer via
 * desktopCapturer/MediaRecorder and wired up in the video-capture milestone, so
 * `config.video` is handled there, not here.
 */
export function createCollectors(config: CaptureConfig, options?: import('../../common/ipc').StartOptions): Collector[] {
  const collectors: Collector[] = [];

  if (config.appActivity || config.windowTitles || config.browserUrls) {
    collectors.push(
      new ActiveWindowCollector({
        captureTitles: config.windowTitles,
        captureUrls: config.browserUrls,
      }),
    );
  }
  if (config.clipboard) collectors.push(new ClipboardCollector());
  if (config.interactions) collectors.push(new InteractionCollector(config.interactions, options?.screenDisplayId, options?.screenSourceId, options?.captureRegion));

  return collectors;
}
