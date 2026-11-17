import { tr } from './i18n';
import { useEffect, useRef } from "react";

import type { SensitiveModelStatus } from "../common/ipc";

/** Human-readable status for the on-device protection model shown in the sheet. */
function protectionModelNote(status: SensitiveModelStatus | null): string {
  if (!status) return tr("Checking…");
  switch (status.ocr) {
    case "ready":
      return tr("On-device model ready");
    case "downloading":
      return status.progress == null
        ? tr("Setting up the on-device model…")
        : tr('Setting up the on-device model… {count}%', { count: Math.round(status.progress) });
    case "error":
      return tr("Couldn't set up the model");
    default:
      return tr("On-device model not set up yet");
  }
}

/**
 * Plain-language disclosure of what the recorder captures, where it is stored,
 * and what leaves the machine on analysis. Every claim here is grounded in the
 * actual collectors and describer behavior, so it must be kept in sync with them.
 *
 * Also home to the Advanced-protection opt-out toggle: protection is on by default,
 * and this sheet is where the user reviews what it does and turns it off if they
 * don't want on-device screen-image scanning.
 */
export function WhatsRecorded({
  onClose,
  onReviewed,
  sensitive,
  advancedPending,
  onToggleAdvanced,
  onDownload,
}: {
  onClose: () => void;
  onReviewed: () => void;
  sensitive: SensitiveModelStatus | null;
  advancedPending: boolean;
  onToggleAdvanced: () => void;
  onDownload: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const advancedOn = sensitive?.enabled ?? true;
  const showModelError = advancedOn && sensitive?.ocr === "error";
  const showDownloadAction =
    advancedOn && (sensitive?.ocr === "error" || sensitive?.ocr === "missing");

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-recorded-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <span className="sheet-icon" aria-hidden>
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
          <h2 id="whats-recorded-title">{tr("What's recorded")}</h2>
        </header>

        <p className="sheet-lead">
          {tr("This tool records your screen and activity so it can turn what you did into a reusable skill. Here is exactly what it captures and what leaves your computer.")}
        </p>

        <section className="sheet-block">
          <h3>{tr("While you're recording")}</h3>
          <p className="sheet-note">{tr("Only between Start and Stop.")}</p>
          <ul>
            <li>{tr("Which apps you switch to, and their window and document titles.")}</li>
            <li>{tr("Web addresses of the pages you open.")}</li>
            <li>{tr('Nur wenn aktiviert: eine Zwischenablage-Vorschau bis 120 Zeichen. Standardmäßig aus.')}</li>
            <li>{tr('Je nach Aufnahmeart: stummes Video des gewählten Bildschirms, Klick-Screenshots oder beides.')}</li>
            <li>{tr('Klicks mit Zeitstempel und Position; optional Mausbewegungen mit bis zu zehn Positionsmessungen pro Sekunde und Steuertasten ohne Texteingaben.')}</li>
            <li>
              {tr("If you open the recorded terminal from the floating bar: its commands, working folders, exit status, timing, and complete terminal output.")}
            </li>
          </ul>
          <p className="sheet-caution">{tr('Erkannte native Passwortfelder unterdrücken Klickbilder und Steuertasten. Browser und eigene Eingabefelder werden nicht zuverlässig erkannt. Video und andere Erfassungswege laufen weiter: vor Passwörtern und vertraulichen Eingaben Aufnahme beenden.')}</p>
          <p className="sheet-caution">
            {tr("Do not type, paste, display, copy, or narrate passwords, access tokens, API keys, credentials, secrets, or other sensitive or confidential information. Anything visible on screen can appear in the recording, and copied text previews and narration are captured too.")}
          </p>
        </section>

        <section className="sheet-block">
          <h3>{tr("Recorded terminal (only if you open it)")}</h3>
          <ul>
            <li>{tr("Only the terminal opened from the floating recording bar is captured.")}</li>
            <li>
              {tr("Its full output stays with this recording and has no app-imposed size limit, so long-running or noisy commands can make the saved recording much larger.")}
            </li>
            <li>
              {tr("Skill Recorder does not edit shell profiles, install global hooks, watch existing terminals, or keep recording commands after this recording ends.")}
            </li>
          </ul>
        </section>

        <section className="sheet-block">
          <h3>{tr("Voice narration (only if you turn it on)")}</h3>
          <p className="sheet-note">
            {tr("Off by default. Choose the initial state and microphone with Narrate, then use the floating recording bar.")}
          </p>
          <ul>
            <li>
              {tr("Enabling Narrate briefly opens and releases the microphone so the app can request permission and show the available inputs. No audio is saved during this check.")}
            </li>
            <li>{tr("Your microphone audio is saved only while it is on and a recording is running.")}</li>
            <li>
              {tr("Turning the microphone off ends that voice segment and releases the device. Turning it on again, or switching inputs, starts a new segment linked to the same recording timeline.")}
            </li>
            <li>
              {tr("The recording can be turned into text on this computer using an on-device model. The transcript stays in the language you select from Whisper's 99 supported choices. The first transcription needs a one-time ~252 MB download that you choose when to start.")}
            </li>
            <li>{tr("Leave Narrate and the recording-bar microphone off and no microphone is opened.")}</li>
          </ul>
        </section>

        <section className="sheet-block">
          <h3>{tr("Where it's stored")}</h3>
          <ul>
            <li>{tr("Everything is saved on this computer, in the app's own session folder.")}</li>
            <li>{tr("Recordings stay until you delete them. You can delete any recording from Sessions.")}</li>
          </ul>
        </section>

        <section className="sheet-block">
          <h3>{tr("What's sent for analysis")}</h3>
          <ul>
            <li>{tr("Nothing leaves your computer while you record.")}</li>
            <li>
              {tr('The new provider adapters send only step text and the transcript to the selected server after your confirmation. The original Copilot workflow also uses the recording and screen images; its separate confirmation explains this.')}
            </li>
            <li>
              {tr("By default, before anything is sent, this computer hides sensitive details like passwords, keys, emails, and card or ID numbers from that text and from your screen images. You can turn this off below.")}
            </li>
          </ul>
        </section>

        <section className={`sheet-block sheet-advp ${advancedOn ? "on" : ""}`}>
          <div className="sheet-advp-head">
            <div className="sheet-advp-copy">
              <h3>{tr("Advanced protection")}</h3>
              <p className="sheet-note">
                {tr("On by default. Before your recording is analyzed, it checks the text and your screen images on this computer and hides sensitive details. Turn it off to send everything as recorded.")}
              </p>
            </div>
            <button
              type="button"
              className="sheet-switch-btn"
              role="switch"
              aria-checked={advancedOn}
              aria-busy={advancedPending}
              aria-label={tr("Advanced protection")}
              disabled={advancedPending}
              onClick={onToggleAdvanced}
            >
              <span className={`sheet-switch ${advancedOn ? "on" : ""}`} aria-hidden>
                <span className="sheet-switch-knob" />
              </span>
            </button>
          </div>
          {advancedOn && (
            <>
              <ul>
                <li>
                  {tr("It hides sensitive details like passwords, keys, emails, and card or ID numbers, both in the text that is sent (including narration and terminal output) and in your screen images.")}
                </li>
                <li>
                  {tr("Turning it off sends your recording as recorded. That can make the analysis more accurate, but nothing is hidden, so only do it when the recording has nothing sensitive.")}
                </li>
                <li>{tr("It all runs on this computer.")}</li>
              </ul>
              <div className={`sheet-advp-status ${showModelError ? "is-error" : ""}`}>
                <span className="sheet-advp-model">{protectionModelNote(sensitive)}</span>
                {showDownloadAction && (
                  <button type="button" className="sheet-advp-download" onClick={onDownload}>
                    {sensitive?.ocr === "error" ? tr("Retry") : tr("Set up now")}
                  </button>
                )}
              </div>
              <p className="sheet-caution">
                {tr("No method is 100% effective. It can miss details or mask the wrong ones. Treat it as a safety net, not a guarantee, and still avoid capturing anything secret.")}
              </p>
            </>
          )}
        </section>

        <section className="sheet-block">
          <h3>{tr("What it never does")}</h3>
          <ul>
            <li>{tr('Normale Texteingaben werden nicht protokolliert. Optional werden nur Steuertasten wie Tab, Enter, Escape und Pfeile samt Modifikatoren gespeichert.')}</li>
            <li>{tr('It does not capture commands from other Terminal, PowerShell, or terminal apps.')}</li>
            <li>{tr("It only captures while a recording is running. Nothing runs in the background.")}</li>
          </ul>
        </section>

        <button className="sheet-close" onClick={onReviewed}>
          {tr("Got it")}
        </button>
      </div>
    </div>
  );
}
