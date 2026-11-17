import React from "react";
import { BrandingSync } from "./Branding";
import { createRoot } from "react-dom/client";

import { StudioWorkspace } from './StudioWorkspace';
import { Recorder } from "./Recorder";
import { RecordingControls } from "./RecordingControls";
import { Terminal } from "./Terminal";
import "./App.css";
import './StudioPolish.css';
import './CleanUI.css';
import './WorkspaceLayout.css';
import { LanguageSync } from './i18n';
import { CaptureRegionPicker } from './CaptureRegionPicker';

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

const route = window.location.hash.replace("#", "");
const isLibrary = route === "library";
const isLegacyLibrary = route === 'legacy-library';
if (isLibrary) document.title = 'Workflow Studio';
const isRecordingControls = route === "recording-controls";
const isTerminal = route === "terminal";
const isRegionPicker = route === 'capture-region';
if (!isLibrary && !isLegacyLibrary && !isRecordingControls && !isTerminal && !isRegionPicker) document.title = 'Workflow Recorder';
document.body.dataset.route = isRegionPicker ? 'capture-region' : isLibrary || isLegacyLibrary
  ? "library"
  : isRecordingControls
    ? "recording-controls"
    : isTerminal
      ? "terminal"
    : "recorder";

createRoot(root).render(
  <React.StrictMode>
    <LanguageSync><BrandingSync>
    {isRegionPicker ? <CaptureRegionPicker/> : isLibrary ? <StudioWorkspace /> : isLegacyLibrary ? (
      <StudioWorkspace legacy/>
    ) : isRecordingControls ? (
      <RecordingControls />
    ) : isTerminal ? (
      <Terminal />
    ) : (
      <Recorder />
    )}
    </BrandingSync></LanguageSync>
  </React.StrictMode>,
);
