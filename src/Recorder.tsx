import { BrandMark } from './Branding';
import { AppSettings } from './AppSettings';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type {
  MicrophoneSettingsStatus,
  NarrationStatus,
  RecorderStatus,
  ScreenSettingsStatus,
  SensitiveModelStatus,
} from "../common/ipc";
import {
  DEFAULT_NARRATION_LANGUAGE,
  isNarrationLanguage,
  NARRATION_LANGUAGES,
  NARRATION_MODEL_DOWNLOAD_LABEL,
  narrationLanguageLabel,
  type NarrationLanguage,
} from "../common/narration";
import { formatMs } from "./format";
import { RecordingPrivacyWarning } from "./RecordingPrivacyWarning";
import { WhatsRecorded } from "./WhatsRecorded";
import type { ProviderProfile } from '../common/studio';
import { tr, useUiLanguage } from './i18n';
import { StudioIcon } from './StudioIcon';

const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
/** Mirrors the main-process global shortcut "CommandOrControl+Shift+R", per OS. */
const TOGGLE_SHORTCUT = IS_MAC ? "⌘⇧R" : "Ctrl+Shift+R";
type PrivacyReviewOrigin = "home" | "warning";

/** The HUD fills the window (`height:100vh`), so its own box can't reveal how tall the
 *  content actually is. Sum the in-flow children (skipping absolute/fixed overlays like
 *  scrims, popovers and the privacy sheet) to get the natural content height the window
 *  should shrink/grow to. */
function measureHudHeight(hud: HTMLElement): number {
  const style = getComputedStyle(hud);
  const gap = parseFloat(style.rowGap || style.gap) || 0;
  let total = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  let inFlow = 0;
  for (const child of Array.from(hud.children)) {
    if (!(child instanceof HTMLElement)) continue;
    const cs = getComputedStyle(child);
    if (cs.position === "absolute" || cs.position === "fixed" || cs.display === "none") continue;
    total += child.getBoundingClientRect().height;
    total += (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    inFlow += 1;
  }
  if (inFlow > 1) total += gap * (inFlow - 1);
  return Math.ceil(total);
}

export function Recorder({ embedded = false }: { embedded?: boolean } = {}) {
  const language = useUiLanguage();
  const appliedLanguageDefault = useRef<string | null>(null);
  const [status, setStatus] = useState<RecorderStatus | null>(null);
  const [analysisProvider, setAnalysisProvider] = useState<ProviderProfile | null>(null);
  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus | null>(null);
  const [microphoneSettings, setMicrophoneSettings] =
    useState<MicrophoneSettingsStatus | null>(null);
  const [screenSettings, setScreenSettings] =
    useState<ScreenSettingsStatus | null>(null);
  const [privacyReviewOrigin, setPrivacyReviewOrigin] =
    useState<PrivacyReviewOrigin | null>(null);
  const [showRecordingWarning, setShowRecordingWarning] = useState(false);
  const [warningStarting, setWarningStarting] = useState(false);
  const [showNarrationSettings, setShowNarrationSettings] = useState(false);
  const [narrationLanguage, setSelectedNarrationLanguage] =
    useState<NarrationLanguage>(DEFAULT_NARRATION_LANGUAGE);
  const [sensitive, setSensitive] = useState<SensitiveModelStatus | null>(null);
  const [advancedPending, setAdvancedPending] = useState(false);
  const [microphonePending, setMicrophonePending] = useState(false);
  const [microphoneActionError, setMicrophoneActionError] = useState<string | null>(null);
  const [screenPending, setScreenPending] = useState(false);
  const [screenActionError, setScreenActionError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const narrationSettingsRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    const list = await window.skillRecorder.listSessions();
    setSessionCount(list.length);
    setPendingCount(list.filter((s) => !s.analysis).length);
  }, []);

  const applyRecorderStatus = useCallback((next: RecorderStatus) => {
    setStatus(next);
    setSelectedNarrationLanguage(next.narrationLanguage);
  }, []);

  useEffect(() => {
    void window.skillRecorder.status().then(applyRecorderStatus);
    const applyProvider = (settings: import('../common/studio').StudioSettings) => setAnalysisProvider(settings.profiles.find(p => p.id === settings.selected) ?? null);
    void window.skillRecorder.studio.settings().then(result => { if (result.ok && result.value) applyProvider(result.value); });
    const offProvider = window.skillRecorder.studio.onSettingsChanged(applyProvider);
    void window.skillRecorder.narrationStatus().then(setNarrationStatus);
    void window.skillRecorder.microphoneSettings().then(setMicrophoneSettings);
    void window.skillRecorder.screenSettings().then(setScreenSettings);
    void window.skillRecorder.sensitiveModelStatus().then(setSensitive);
    void refreshCount();
    const offRecorder = window.skillRecorder.onStatusChanged(applyRecorderStatus);
    const offNarration = window.skillRecorder.onNarrationStatusChanged(setNarrationStatus);
    const offMicrophones =
      window.skillRecorder.onMicrophoneSettingsChanged(setMicrophoneSettings);
    const offScreens =
      window.skillRecorder.onScreenSettingsChanged(setScreenSettings);
    const offSensitive = window.skillRecorder.onSensitiveModelStatusChanged(setSensitive);
    return () => {
      offRecorder();
      offProvider();
      offNarration();
      offMicrophones();
      offScreens();
      offSensitive();
    };
  }, [applyRecorderStatus, refreshCount]);

  useEffect(() => {
    return window.skillRecorder.onRecordingPrivacyWarningRequested(() => {
      setShowNarrationSettings(false);
      setShowRecordingWarning(true);
    });
  }, []);

  // The analyze step happens in the library window, so re-check how many
  // recordings still need analysis whenever the recorder regains focus.
  useEffect(() => {
    const onFocus = () => void refreshCount();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCount]);

  const recording = status?.state === "recording";
  const transitioning = status?.transition !== "none";
  const startedAt = status?.startedAt ?? null;
  const justSaved = !recording && status?.lastFinish?.outcome === "saved";
  const justDiscarded = !recording && status?.lastFinish?.outcome === "discarded";
  const narrate = microphoneSettings?.narrationEnabled ?? false;
  const narrationLanguageName = narrationLanguageLabel(narrationLanguage);
  const advancedOn = sensitive?.enabled ?? true;
  const selectedScreenName = screenSettings?.selectedSourceLabel ?? tr('Loading screens...');
  const selectedScreenLabel = screenSettings?.region ? tr('Ausschnitt · {source}', { source: selectedScreenName }) : screenSettings?.selectedSourceId.startsWith('window:') ? tr('Fenster · {source}', { source: selectedScreenName }) : selectedScreenName;

  useEffect(() => {
    if (!status || recording || transitioning || appliedLanguageDefault.current === language) return;
    appliedLanguageDefault.current = language;
    void window.skillRecorder.setNarrationLanguage(language).then(result => {
      if (!result.ok) { appliedLanguageDefault.current = null; setMicrophoneActionError(result.error ?? tr('Could not change the narration language.')); }
    }).catch(() => { appliedLanguageDefault.current = null; setMicrophoneActionError(tr('Could not change the narration language.')); });
  }, [language, recording, transitioning, status]);

  useEffect(() => {
    if (recording) {
      setShowNarrationSettings(false);
    }
  }, [recording]);

  useEffect(() => {
    if (!showNarrationSettings) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowNarrationSettings(false);
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || narrationSettingsRef.current?.contains(target)) return;
      setShowNarrationSettings(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [showNarrationSettings]);

  // Keep the fixed-width HUD window sized to its content: no dead space in short
  // states, no clipping when the doctor reveals an extra model row. Observers catch
  // both row add/remove (MutationObserver) and reflow/size changes (ResizeObserver).
  useLayoutEffect(() => {
    if (embedded) return;
    const hud = hudRef.current;
    if (!hud) return;
    let frame = 0;
    const report = () => {
      frame = 0;
      window.skillRecorder.fitRecorderHeight?.(measureHudHeight(hud));
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(report);
    };
    const ro = new ResizeObserver(schedule);
    const observeChildren = () => {
      ro.disconnect();
      for (const child of Array.from(hud.children)) ro.observe(child);
    };
    const mo = new MutationObserver(() => {
      observeChildren();
      schedule();
    });
    observeChildren();
    mo.observe(hud, { childList: true });
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
    };
  }, [embedded]);

  // Refresh the library count whenever a recording finishes.
  useEffect(() => {
    if (!recording) void refreshCount();
  }, [recording, refreshCount]);

  useEffect(() => {
    if (!recording || startedAt == null) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => clearInterval(id);
  }, [recording, startedAt]);

  const toggle = useCallback(async () => {
    if (recording) {
      const res = await window.skillRecorder.stop();
      if (!res.ok) window.alert(res.error ?? tr("Action failed"));
      applyRecorderStatus(await window.skillRecorder.status());
      return;
    }

    const res = await window.skillRecorder.start();
    if (res.privacyWarningRequired) {
      setShowRecordingWarning(true);
      return;
    }
    if (!res.ok) window.alert(res.error ?? tr("Action failed"));
    applyRecorderStatus(await window.skillRecorder.status());
  }, [applyRecorderStatus, recording]);

  const startAfterWarning = useCallback(async () => {
    setWarningStarting(true);
    const res = await window.skillRecorder.confirmStart();
    if (!res.ok) {
      setWarningStarting(false);
      window.alert(res.error ?? tr("Could not start recording."));
      return;
    }
    setShowRecordingWarning(false);
    setWarningStarting(false);
    applyRecorderStatus(await window.skillRecorder.status());
  }, [applyRecorderStatus]);

  const openPrivacyReview = useCallback((origin: PrivacyReviewOrigin) => {
    setShowRecordingWarning(false);
    setPrivacyReviewOrigin(origin);
  }, []);

  const closePrivacyReview = useCallback(() => {
    const returnToWarning = privacyReviewOrigin === "warning";
    setPrivacyReviewOrigin(null);
    if (returnToWarning) setShowRecordingWarning(true);
  }, [privacyReviewOrigin]);

  const completePrivacyReview = useCallback(async () => {
    await window.skillRecorder.markRecordingPrivacyReviewed();
    setPrivacyReviewOrigin(null);
    setShowRecordingWarning(false);
  }, []);

  const selectNarrationLanguage = useCallback(
    async (value: string) => {
      if (!isNarrationLanguage(value)) {
        window.alert(tr("Unsupported narration language."));
        return;
      }
      setSelectedNarrationLanguage(value);
      const result = await window.skillRecorder.setNarrationLanguage(value);
      if (!result.ok) window.alert(result.error ?? tr("Could not change the narration language."));
      applyRecorderStatus(await window.skillRecorder.status());
    },
    [applyRecorderStatus],
  );

  const toggleNarration = useCallback(async () => {
    if (!microphoneSettings) return;
    setMicrophonePending(true);
    setMicrophoneActionError(null);
    const result = await window.skillRecorder.setNarrationEnabled(
      !microphoneSettings.narrationEnabled,
    );
    setMicrophoneSettings(result.status);
    if (!result.ok) {
      setMicrophoneActionError(
        result.error ?? tr("Could not update the narration preference."),
      );
      setShowNarrationSettings(true);
    }
    setMicrophonePending(false);
  }, [microphoneSettings]);

  const selectMicrophone = useCallback(async (deviceId: string) => {
    setMicrophonePending(true);
    setMicrophoneActionError(null);
    const result = await window.skillRecorder.selectMicrophone(deviceId);
    setMicrophoneSettings(result.status);
    if (!result.ok) {
      setMicrophoneActionError(
        result.error ?? tr("Could not select that microphone."),
      );
    }
    setMicrophonePending(false);
  }, []);

  const selectScreen = useCallback(async (sourceId: string) => {
    setScreenPending(true);
    setScreenActionError(null);
    const result = await window.skillRecorder.selectScreen(sourceId);
    setScreenSettings(result.status);
    if (!result.ok) {
      setScreenActionError(result.error ?? tr("Could not select that screen."));
    }
    setScreenPending(false);
  }, []);

  const openLibrary = useCallback(() => {
    void window.skillRecorder.openLibrary();
  }, []);

  const downloadNarrationModel = useCallback(async () => {
    const res = await window.skillRecorder.downloadNarrationModel();
    if (!res.ok) window.alert(res.error ?? tr("Could not download the voice transcription model."));
  }, []);

  const toggleAdvanced = useCallback(async () => {
    if (!sensitive) return;
    const next = !sensitive.enabled;
    setAdvancedPending(true);
    setSensitive((s) => (s ? { ...s, enabled: next } : s)); // optimistic; real state follows
    const res = await window.skillRecorder.setAdvancedProtection(next);
    if (!res.ok) {
      void window.skillRecorder.sensitiveModelStatus().then(setSensitive);
      window.alert(res.error ?? tr("Could not update advanced protection."));
    }
    setAdvancedPending(false);
  }, [sensitive]);

  const downloadSensitiveModels = useCallback(async () => {
    const res = await window.skillRecorder.downloadSensitiveModels();
    if (!res.ok) window.alert(res.error ?? tr("Could not download the protection models."));
  }, []);

  return (
    <div className="hud" ref={hudRef}>
      {!embedded && <header className="recorder-heading"><BrandMark/><AppSettings disabled={recording || transitioning} onProvider={openLibrary} tools={<button data-close-settings onClick={openLibrary}>{tr("Aufnahmen ansehen")}</button>} /></header>}
      <div className="transport">
        <button
          className={`record ${recording ? "on" : ""}`}
          onClick={toggle}
          disabled={transitioning || microphonePending || screenPending}
          aria-label={recording ? tr("Stop recording") : tr("Start recording")}
        >
          <span className="record-glyph" /><span className="transport-label">{recording ? tr('Stop recording') : tr('Start recording')}</span>
        </button>
        <div className={`timecode ${recording ? "live" : ""}`}>
          {recording ? formatMs(elapsed) : "00:00"}
        </div>
        <div className="transport-sub" title={selectedScreenLabel}>
          {recording
            ? tr('{count} events captured', { count: status?.eventCount ?? 0 })
            : justSaved
              ? tr("Capture saved. Open Sessions to analyze")
              : justDiscarded
                ? tr("Recording discarded")
              : screenSettings?.error
                ? tr("Screen capture needs attention")
                : tr('Ready to capture · {screen}', { screen: selectedScreenLabel })}
        </div>
      </div>

      <section ref={narrationSettingsRef} className={`narrate ${narrate ? "on" : ""}`}>
        <div className="narrate-head">
          <button
            className="narrate-toggle"
            role="switch"
            aria-checked={narrate}
            aria-busy={microphonePending}
            onClick={() => void toggleNarration()}
            disabled={
              !microphoneSettings ||
              microphonePending ||
              recording ||
              transitioning
            }
          >
            <span className="narrate-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect
                  x="7.5"
                  y="2.5"
                  width="5"
                  height="9"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M5 9.2a5 5 0 0 0 10 0"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M10 14.2v3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="narrate-text">
              <span className="narrate-label">{tr("Narrate")}</span>
              <span className="narrate-sub">
                {microphonePending
                  ? tr("Requesting microphone access...")
                  : microphoneActionError || microphoneSettings?.error
                    ? tr("Microphone needs attention")
                    : recording
                      ? narrate
                        ? tr('Listening · {language}', { language: narrationLanguageName })
                        : tr("Voice off for this recording")
                      : narrate
                        ? narrationLanguageName
                        : tr("Explain out loud (optional)")}
              </span>
            </span>
          </button>
          <button
            className={`narrate-settings-toggle ${showNarrationSettings ? "open" : ""}`}
            aria-label={tr("Recording settings")}
            aria-controls="recording-settings"
            aria-expanded={showNarrationSettings}
            title={tr("Recording settings")}
            disabled={microphonePending || screenPending || recording || transitioning}
            onClick={() => {
              setMicrophoneActionError(null);
              setScreenActionError(null);
              setShowNarrationSettings((open) => !open);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.2 7.2 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.7 7.7 0 0 0 0 1.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65A.5.5 0 0 0 10 22h4a.5.5 0 0 0 .5-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="narrate-switch-btn"
            aria-hidden
            tabIndex={-1}
            disabled={
              !microphoneSettings ||
              microphonePending ||
              recording ||
              transitioning
            }
            onClick={() => void toggleNarration()}
          >
            <span className={`narrate-switch ${narrate ? "on" : ""}`}>
              <span className="narrate-knob" />
            </span>
          </button>
        </div>

        {showNarrationSettings && (
          <>
            <button
              type="button"
              className="narrate-scrim"
              aria-hidden
              tabIndex={-1}
              onClick={() => setShowNarrationSettings(false)}
            />
            <div id="recording-settings" className="narrate-settings">
            <label htmlFor="narrate-language">{tr("Language")}</label>
            <div className="narrate-select-wrap">
              <select
                id="narrate-language"
                value={narrationLanguage}
                disabled={microphonePending || recording || transitioning}
                onChange={(event) =>
                  void selectNarrationLanguage(event.currentTarget.value)
                }
                title={tr("The transcript stays in this language")}
              >
                {NARRATION_LANGUAGES.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {code === 'de' ? (language === 'de' ? 'Deutsch' : 'German') : code === 'en' ? (language === 'de' ? 'Englisch' : 'English') : label}
                  </option>
                ))}
              </select>
              <span className="narrate-select-chevron" aria-hidden>
                ▾
              </span>
            </div>

            <label htmlFor="narrate-microphone">{tr("Microphone")}</label>
            <div className="narrate-select-wrap">
              <select
                id="narrate-microphone"
                value={microphoneSettings?.selectedDeviceId ?? ""}
                disabled={microphonePending || recording || transitioning}
                onChange={(event) => void selectMicrophone(event.target.value)}
              >
                {microphoneSettings ? (
                  microphoneSettings.devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))
                ) : (
                  <option value="">{tr("Loading microphones...")}</option>
                )}
              </select>
              <span className="narrate-select-chevron" aria-hidden>
                ▾
              </span>
            </div>
            <label htmlFor="recording-screen">{tr('Aufnahmequelle')}</label>
            <div className="narrate-select-wrap">
              <select
                id="recording-screen"
                value={screenSettings?.selectedSourceId ?? ""}
                disabled={
                  screenPending ||
                  recording ||
                  transitioning ||
                  !screenSettings ||
                  screenSettings.screens.length === 0
                }
                onChange={(event) => void selectScreen(event.target.value)}
              >
                {screenSettings?.screens.length ? (
                  ['screen:', 'window:'].map(prefix => <optgroup key={prefix} label={tr(prefix === 'screen:' ? 'Bildschirme' : 'Programmfenster')}>
                    {screenSettings.screens.filter(source => source.id.startsWith(prefix)).map(source => <option key={source.id} value={source.id}>{source.label}</option>)}
                  </optgroup>)
                ) : (
                  <option value="">
                    {screenSettings ? tr("No screens available") : tr("Loading screens...")}
                  </option>
                )}
              </select>
              <span className="narrate-select-chevron" aria-hidden>
                ▾
              </span>
            </div>
            <div className="capture-target-actions">
              <button type="button" disabled={recording || transitioning || screenPending || !screenSettings?.selectedSourceId} onClick={() => void selectScreen(screenSettings!.selectedSourceId)}>{tr('Auswahl bestätigen / aktualisieren')}</button>
              {!screenSettings?.selectedSourceId.startsWith('window:') && <button type="button" disabled={recording || transitioning || screenPending || !screenSettings?.selectedSourceId} onClick={async () => {
                setScreenPending(true);
                try { const result = await window.skillRecorder.studio.openRegionPicker(screenSettings!.selectedSourceId); if (!result.ok) setScreenActionError(result.error ?? tr('Keine Bildschirmvorschau verfügbar.')); } catch { setScreenActionError(tr('Keine Bildschirmvorschau verfügbar.')); }
                finally { setScreenPending(false); }
              }}>{tr(screenSettings?.region ? 'Bereich ändern' : 'Bereich auswählen')}</button>}
              {screenSettings?.region && <button type="button" disabled={recording || transitioning} onClick={async () => { const result = await window.skillRecorder.studio.setCaptureRegion(screenSettings.selectedSourceId, null); if (result.ok && result.value) setScreenSettings(result.value); else setScreenActionError(result.error ?? tr('Auswahl konnte nicht gespeichert werden.')); }}>{tr('Ganzer Bildschirm')}</button>}
              <small>{tr('Fenster und Ausschnitte begrenzen Bilder und Video. App-Aktivitäten werden weiterhin separat erfasst.')}</small>
            </div>
            {(microphoneActionError ||
              microphoneSettings?.error ||
              microphoneSettings?.fallback) && (
              <p
                className={`narrate-settings-note ${
                  microphoneActionError || microphoneSettings?.error
                    ? "error"
                    : "warn"
                }`}
                role={
                  microphoneActionError || microphoneSettings?.error
                    ? "alert"
                    : undefined
                }
              >
                {microphoneActionError ??
                  microphoneSettings?.error ??
                  microphoneSettings?.fallback}
              </p>
            )}
            {(screenActionError ||
              screenSettings?.error ||
              screenSettings?.fallback) && (
              <p
                className={`narrate-settings-note ${
                  screenActionError || screenSettings?.error
                    ? "error"
                    : "warn"
                }`}
                role={
                  screenActionError || screenSettings?.error
                    ? "alert"
                    : undefined
                }
              >
                {screenActionError ??
                  screenSettings?.error ??
                  (screenSettings?.fallback ? tr(screenSettings.fallback) : null)}
              </p>
            )}
            </div>
          </>
        )}
      </section>


      <button
        className={`sessions-open ${pendingCount > 0 ? "has-new" : ""}`}
        onClick={openLibrary}
        aria-label={
          pendingCount > 0
            ? tr('Review sessions, {count} ready to analyze', { count: pendingCount })
            : sessionCount === 0
              ? tr("Review sessions, nothing recorded yet")
              : tr('Review sessions, {count} recorded', { count: sessionCount })
        }
      >
        <span className="sessions-open-icon" aria-hidden>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2.6 3.2 6 10 9.4 16.8 6 10 2.6Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M3.4 10 10 13.3 16.6 10"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3.4 13.6 10 16.9 16.6 13.6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="sessions-open-text">
          <span className="sessions-open-label">
            {tr("Review sessions")}
            {pendingCount > 0 && <span className="sessions-open-flag">{pendingCount}</span>}
          </span>
          <span className={`sessions-open-sub ${pendingCount > 0 ? "is-new" : ""}`}>
            {pendingCount > 0
              ? tr('{count} ready to analyze', { count: pendingCount })
              : sessionCount === 0
                ? tr("No recordings yet")
                : tr(sessionCount === 1 ? '{count} recording' : '{count} recordings', { count: sessionCount })}
          </span>
        </span>
        <span className="sessions-open-chevron" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <button className="privacy-note" onClick={() => openPrivacyReview("home")}>
        <span className="privacy-note-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2.5 4 4.8v4.3c0 3.4 2.4 6.2 6 7.4 3.6-1.2 6-4 6-7.4V4.8L10 2.5Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="m7.4 9.8 1.9 1.9 3.4-3.6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="privacy-note-text">
          <span className="privacy-note-title">{tr("Was wird aufgenommen?")}</span>
        </span>
        {!advancedOn ? (
          <span className="privacy-note-badge is-off">{tr("Protection off")}</span>
        ) : null}
        <span className="privacy-note-chevron" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {analysisProvider && (
        <details className="recorder-models" open={(sensitive?.enabled && sensitive.ocr !== 'ready') || (narrate && narrationStatus?.model !== 'ready') || undefined}>
          <summary>{tr('KI & lokale Modelle')}</summary><div className="doctor">
          <Row
            label={tr(analysisProvider.name)}
            status="neutral"
            note=""
            action={{ label: tr("Ändern"), onClick: openLibrary }}
          />
          {narrate && narrationStatus && (
            <VoiceModelRow
              status={narrationStatus}
              recording={recording}
              onDownload={downloadNarrationModel}
            />
          )}
          {sensitive && (
            <SensitiveModelRow
              status={sensitive}
              recording={recording}
              onDownload={downloadSensitiveModels}
            />
          )}
        </div></details>
      )}

      <p className="hint"><kbd>{TOGGLE_SHORTCUT}</kbd><span>{tr('Aufnahme starten / stoppen')}</span></p>

      {showRecordingWarning && (
        <RecordingPrivacyWarning
          starting={warningStarting}
          onStart={() => void startAfterWarning()}
          onReview={() => openPrivacyReview("warning")}
          onClose={() => setShowRecordingWarning(false)}
        />
      )}
      {privacyReviewOrigin && (
        <WhatsRecorded
          onClose={closePrivacyReview}
          onReviewed={() => void completePrivacyReview()}
          sensitive={sensitive}
          advancedPending={advancedPending}
          onToggleAdvanced={() => void toggleAdvanced()}
          onDownload={downloadSensitiveModels}
        />
      )}
    </div>
  );
}

type RowStatus = "good" | "warn" | "bad" | "neutral";

function Row({
  label,
  status,
  note,
  action,
}: {
  label: string;
  status: RowStatus;
  note: string;
  action?: { label: string; disabled?: boolean; onClick: () => void };
}) {
  const symbol = status === "good" ? "✓" : status === "warn" ? "!" : "✕";
  return (
    <div className="row">
      <span className={`badge ${status}`}>{status === 'neutral' ? <StudioIcon name="flow"/> : symbol}</span>
      <span className="row-label">{label}</span>
      {note && <span className="row-note">{note}</span>}
      {action && (
        <button className="row-action" disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function VoiceModelRow({
  status,
  recording,
  onDownload,
}: {
  status: NarrationStatus;
  recording: boolean;
  onDownload: () => void;
}) {
  if (status.phase === "downloading") {
    const progress = status.progress == null ? tr("downloading") : `${status.progress}%`;
    return <Row label={tr("voice transcription")} status="warn" note={progress} />;
  }
  if (status.phase === "loading") {
    return <Row label={tr("voice transcription")} status="warn" note={tr("preparing")} />;
  }
  if (status.model === "ready") {
    return <Row label={tr("voice transcription")} status="good" note={tr("on-device · multilingual")} />;
  }
  return (
    <Row
      label={tr("voice transcription")}
      status="warn"
      note={
        status.model === "error"
          ? tr("download failed")
          : tr('{size} · multilingual', { size: NARRATION_MODEL_DOWNLOAD_LABEL })
      }
      action={{
        label: status.model === "error" ? tr("retry") : tr("download"),
        disabled: recording,
        onClick: onDownload,
      }}
    />
  );
}

/** Single doctor row for the opt-out Advanced-protection model, shown while enabled.
 *  Goes red whenever the on-device screen-text model isn't downloaded, with one
 *  action that fetches it. */
function SensitiveModelRow({
  status,
  recording,
  onDownload,
}: {
  status: SensitiveModelStatus;
  recording: boolean;
  onDownload: () => void;
}) {
  if (!status.enabled) return null;
  if (status.ocr === "downloading") {
    const note = status.progress == null ? tr("downloading") : `${Math.round(status.progress)}%`;
    return <Row label={tr("advanced protection")} status="warn" note={note} />;
  }
  if (status.ocr === "ready") {
    return <Row label={tr('Erweiterter Schutz · lokal')} status="good" note="" />;
  }
  const failed = status.ocr === "error";
  return (
    <Row
      label={tr("advanced protection")}
      status="bad"
      note={failed ? tr("download failed") : tr("not downloaded")}
      action={{ label: failed ? tr("retry") : tr("download"), disabled: recording, onClick: onDownload }}
    />
  );
}
