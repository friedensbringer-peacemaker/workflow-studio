// Preload bridge — CommonJS on purpose (runs in the renderer's isolated world).
// Keep channel strings in sync with common/ipc.ts.
const { contextBridge, ipcRenderer } = require("electron");

const IPC = {
  start: "recorder:start",
  startConfirmed: "recorder:start-confirmed",
  stop: "recorder:stop",
  discard: "recorder:discard",
  microphone: "recorder:microphone",
  narrationLanguage: "recorder:narration-language",
  microphoneSettings: "microphone:settings",
  microphoneNarration: "microphone:narration",
  microphoneDevice: "microphone:device",
  microphoneSettingsChanged: "microphone:settings-changed",
  screenSettings: "screen:settings",
  screenSource: "screen:source",
  screenSettingsChanged: "screen:settings-changed",
  status: "recorder:status",
  marker: "recorder:marker",
  doctor: "doctor:check",
  copilotSignIn: "copilot:sign-in",
  copilotSignInCancel: "copilot:sign-in-cancel",
  statusChanged: "recorder:status-changed",
  recordingPrivacyReviewed: "recorder:privacy-reviewed",
  recordingPrivacyWarningRequested: "recorder:privacy-warning-requested",
  narrationStatus: "narration:status",
  narrationDownload: "narration:download",
  narrationTranscribe: "narration:transcribe",
  narrationStatusChanged: "narration:status-changed",
  sensitiveModelStatus: "sensitive:status",
  sensitiveSetAdvanced: "sensitive:set-advanced",
  sensitiveDownloadModels: "sensitive:download-models",
  sensitiveStatusChanged: "sensitive:status-changed",
  sensitiveGetReport: "sensitive:get-report",
  analyze: "analyze:start",
  analyzeFeedback: "analyze:feedback",
  getAnalysis: "analyze:get",
  updateAnalysis: "analyze:update",
  cancelAnalysis: "analyze:cancel",
  analyzeProgress: "analyze:progress",
  listSessions: "sessions:list",
  deleteSession: "sessions:delete",
  exportDebugBundle: "sessions:export-debug",
  buildSkill: "skill:build",
  prepareSkill: "skill:prepare",
  discardSkillPreview: "skill:discard-preview",
  createSkill: "skill:create",
  getSkill: "skill:get",
  cancelSkill: "skill:cancel",
  revealSkill: "skill:reveal",
  skillProgress: "skill:progress",
  buildAutomation: "automation:build",
  createAutomation: "automation:create",
  getAutomation: "automation:get",
  cancelAutomation: "automation:cancel",
  revealAutomation: "automation:reveal",
  automationProgress: "automation:progress",
  terminalOpen: "terminal:open",
  terminalReady: "terminal:ready",
  terminalStatus: "terminal:status",
  terminalShells: "terminal:shells",
  terminalSwitchShell: "terminal:switch-shell",
  terminalInput: "terminal:input",
  terminalResize: "terminal:resize",
  terminalHide: "terminal:hide",
  terminalStatusChanged: "terminal:status-changed",
  terminalFinishConfirmationRequested: "terminal:finish-confirmation-requested",
  terminalOutput: "terminal:output",
  openLibrary: "ui:open-library",
  closeLibrary: "ui:close-library",
  cancelClose: "ui:cancel-close",
  recordingControlsExpanded: "ui:recording-controls-expanded",
  fitRecorderHeight: "ui:fit-recorder-height",
};

let recordingPrivacyWarningPending = false;
let recordingPrivacyWarningCallback = null;
ipcRenderer.on(IPC.recordingPrivacyWarningRequested, () => {
  if (recordingPrivacyWarningCallback) {
    recordingPrivacyWarningCallback();
    return;
  }
  recordingPrivacyWarningPending = true;
});

contextBridge.exposeInMainWorld("skillRecorder", {
  studio: {
    wikiTargets: () => ipcRenderer.invoke('studio:wiki-targets'),
    saveWikiTarget: (target,key) => ipcRenderer.invoke('studio:save-wiki-target',target,key),
    wikiFolder: () => ipcRenderer.invoke('studio:wiki-folder'),
    publishWiki: (document,kind,includeReview,confirmed) => ipcRenderer.invoke('studio:publish-wiki',document,kind,includeReview,confirmed),
    reviewProcess: (document, id, method, consent) => ipcRenderer.invoke('studio:process-review', document, id, method, consent),
    narrationSource: (id) => ipcRenderer.invoke('studio:narration-source',id),
    branding: () => ipcRenderer.invoke('studio:branding'),
    saveBranding: (brand) => ipcRenderer.invoke('studio:save-branding', brand),
    prepareLogo: (bytes) => ipcRenderer.invoke('studio:prepare-logo', bytes),
    onBrandingChanged: (cb) => {
      const listener = (_event, brand) => cb(brand);
      ipcRenderer.on('studio:branding-changed', listener);
      return () => ipcRenderer.removeListener('studio:branding-changed', listener);
    },
    screenToGifStatus: () => ipcRenderer.invoke('studio:stg-status'),
    screenToGifInfo: (page) => ipcRenderer.invoke('studio:stg-info', page),
    screenToGifSelect: () => ipcRenderer.invoke('studio:stg-select'),
    screenToGifDownload: (consent) => ipcRenderer.invoke('studio:stg-download', consent),
    screenToGifCancelDownload: () => ipcRenderer.invoke('studio:stg-cancel-download'),
    screenToGifOpen: (document, request) => ipcRenderer.invoke('studio:stg-open', document, request),
    screenToGifJob: (session, id) => ipcRenderer.invoke('studio:stg-job', session, id),
    screenToGifJobs: (session, step) => ipcRenderer.invoke('studio:stg-jobs', session, step),
    screenToGifFolder: (session, id) => ipcRenderer.invoke('studio:stg-folder', session, id),
    screenToGifImport: (session, id, name) => ipcRenderer.invoke('studio:stg-import', session, id, name),
    dictate: (consent) => ipcRenderer.invoke('studio:dictate', consent),
    deletionStatus: () => ipcRenderer.invoke('studio:deletion-status'),
    configureDeletion: (current, next) => ipcRenderer.invoke('studio:configure-deletion', current, next),
    deleteMaterial: (document, id, password) => ipcRenderer.invoke('studio:delete-material', document, id, password),
    knowledge: (document, id, kind, consent, language) => ipcRenderer.invoke('studio:knowledge', document, id, kind, consent, language),
    exportSkill: (document, body, reviewed) => ipcRenderer.invoke('studio:export-skill', document, body, reviewed),
    editImage: (id, source, recipe) => ipcRenderer.invoke('studio:edit-image', id, source, recipe),
    exportGuide: (document, options) => ipcRenderer.invoke('studio:export-guide', document, options),
    openRegionPicker: (id) => ipcRenderer.invoke('studio:open-region-picker', id),
    targetPreview: (id) => ipcRenderer.invoke('studio:target-preview', id),
    setCaptureRegion: (id, region) => ipcRenderer.invoke('studio:capture-region', id, region),
    importMaterials: (id, remaining) => ipcRenderer.invoke('studio:import-materials', id, remaining),
    saveVoice: (id, bytes) => ipcRenderer.invoke('studio:save-voice', id, bytes),
    material: (id, materialId) => ipcRenderer.invoke('studio:material', id, materialId),
    openMaterial: (id, materialId) => ipcRenderer.invoke('studio:open-material', id, materialId),
    transcribeMaterial: (id, materialId, language) => ipcRenderer.invoke('studio:transcribe-material', id, materialId, language),
    inputSettings: () => ipcRenderer.invoke('studio:input-settings'),
    saveInputSettings: (settings) => ipcRenderer.invoke('studio:save-input-settings', settings),
    onInputSettingsChanged: (callback) => {
      const listener = (_event, settings) => callback(settings);
      ipcRenderer.on('studio:input-settings-changed', listener);
      return () => ipcRenderer.removeListener('studio:input-settings-changed', listener);
    },
    uiLanguage: () => ipcRenderer.invoke('studio:ui-language'),
    setUiLanguage: (language) => ipcRenderer.invoke('studio:set-ui-language', language),
    onLanguageChanged: (callback) => {
      const listener = (_event, language) => callback(language);
      ipcRenderer.on('studio:language-changed', listener);
      return () => ipcRenderer.removeListener('studio:language-changed', listener);
    },
    onSettingsChanged: (callback) => {
      const listener = (_event, settings) => callback(settings);
      ipcRenderer.on('studio:settings-changed', listener);
      return () => ipcRenderer.removeListener('studio:settings-changed', listener);
    },
    load: (id) => ipcRenderer.invoke('studio:load', id),
    save: (document, password) => ipcRenderer.invoke('studio:save', document, password),
    frame: (id, file) => ipcRenderer.invoke('studio:frame', id, file),
    settings: () => ipcRenderer.invoke('studio:settings'),
    saveSettings: (settings, keys) => ipcRenderer.invoke('studio:save-settings', settings, keys),
    models: (id) => ipcRenderer.invoke('studio:models', id),
    check: (id) => ipcRenderer.invoke('studio:check', id),
    discoverLocal: () => ipcRenderer.invoke('studio:discover-local'),
    windowMode: () => ipcRenderer.invoke('studio:window-mode'),
    setWindowMode: (mode) => ipcRenderer.invoke('studio:set-window-mode', mode),
    onWindowModeChanged: (callback) => {
      const listener = (_event, mode) => callback(mode);
      ipcRenderer.on('studio:window-mode-changed', listener);
      return () => ipcRenderer.removeListener('studio:window-mode-changed', listener);
    },
    testProvider: (id, consent) => ipcRenderer.invoke('studio:test-provider', id, consent),
    analyze: (document, id, consent, images) => ipcRenderer.invoke('studio:analyze', document, id, consent, images),
    cancel: () => ipcRenderer.invoke('studio:cancel'),
    export: (document, format) => ipcRenderer.invoke('studio:export', document, format),
    createDocument: () => ipcRenderer.invoke('studio:create-document'),
  },
  start: () => ipcRenderer.invoke(IPC.start),
  confirmStart: () => ipcRenderer.invoke(IPC.startConfirmed),
  markRecordingPrivacyReviewed: () => ipcRenderer.invoke(IPC.recordingPrivacyReviewed),
  onRecordingPrivacyWarningRequested: (cb) => {
    recordingPrivacyWarningCallback = cb;
    if (recordingPrivacyWarningPending) {
      recordingPrivacyWarningPending = false;
      cb();
    }
    return () => {
      if (recordingPrivacyWarningCallback === cb) recordingPrivacyWarningCallback = null;
    };
  },
  stop: (forceTerminal) => ipcRenderer.invoke(IPC.stop, forceTerminal),
  discard: (forceTerminal) => ipcRenderer.invoke(IPC.discard, forceTerminal),
  setMicrophoneEnabled: (enabled) => ipcRenderer.invoke(IPC.microphone, enabled),
  setNarrationLanguage: (language) => ipcRenderer.invoke(IPC.narrationLanguage, language),
  microphoneSettings: () => ipcRenderer.invoke(IPC.microphoneSettings),
  setNarrationEnabled: (enabled) => ipcRenderer.invoke(IPC.microphoneNarration, enabled),
  selectMicrophone: (deviceId) => ipcRenderer.invoke(IPC.microphoneDevice, deviceId),
  onMicrophoneSettingsChanged: (cb) => {
    const listener = (_event, status) => cb(status);
    ipcRenderer.on(IPC.microphoneSettingsChanged, listener);
    return () => ipcRenderer.removeListener(IPC.microphoneSettingsChanged, listener);
  },
  screenSettings: () => ipcRenderer.invoke(IPC.screenSettings),
  selectScreen: (sourceId) => ipcRenderer.invoke(IPC.screenSource, sourceId),
  onScreenSettingsChanged: (cb) => {
    const listener = (_event, status) => cb(status);
    ipcRenderer.on(IPC.screenSettingsChanged, listener);
    return () => ipcRenderer.removeListener(IPC.screenSettingsChanged, listener);
  },
  status: () => ipcRenderer.invoke(IPC.status),
  marker: (note) => ipcRenderer.invoke(IPC.marker, note),
  doctor: () => ipcRenderer.invoke(IPC.doctor),
  copilotSignIn: (attemptId) => ipcRenderer.invoke(IPC.copilotSignIn, attemptId),
  cancelCopilotSignIn: (attemptId) => ipcRenderer.invoke(IPC.copilotSignInCancel, attemptId),
  onStatusChanged: (cb) => {
    const listener = (_event, status) => cb(status);
    ipcRenderer.on(IPC.statusChanged, listener);
    return () => ipcRenderer.removeListener(IPC.statusChanged, listener);
  },
  openTerminal: () => ipcRenderer.invoke(IPC.terminalOpen),
  terminalReady: () => ipcRenderer.invoke(IPC.terminalReady),
  terminalStatus: () => ipcRenderer.invoke(IPC.terminalStatus),
  terminalShells: () => ipcRenderer.invoke(IPC.terminalShells),
  switchTerminalShell: (shell) => ipcRenderer.invoke(IPC.terminalSwitchShell, shell),
  writeTerminal: (data) => ipcRenderer.send(IPC.terminalInput, data),
  resizeTerminal: (columns, rows) =>
    ipcRenderer.send(IPC.terminalResize, { columns, rows }),
  hideTerminal: () => ipcRenderer.invoke(IPC.terminalHide),
  onTerminalStatusChanged: (cb) => {
    const listener = (_event, status) => cb(status);
    ipcRenderer.on(IPC.terminalStatusChanged, listener);
    return () => ipcRenderer.removeListener(IPC.terminalStatusChanged, listener);
  },
  onTerminalFinishConfirmationRequested: (cb) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.terminalFinishConfirmationRequested, listener);
    return () =>
      ipcRenderer.removeListener(IPC.terminalFinishConfirmationRequested, listener);
  },
  onTerminalOutput: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on(IPC.terminalOutput, listener);
    return () => ipcRenderer.removeListener(IPC.terminalOutput, listener);
  },
  narrationStatus: () => ipcRenderer.invoke(IPC.narrationStatus),
  downloadNarrationModel: () => ipcRenderer.invoke(IPC.narrationDownload),
  transcribeNarration: (sessionId) => ipcRenderer.invoke(IPC.narrationTranscribe, sessionId),
  onNarrationStatusChanged: (cb) => {
    const listener = (_event, status) => cb(status);
    ipcRenderer.on(IPC.narrationStatusChanged, listener);
    return () => ipcRenderer.removeListener(IPC.narrationStatusChanged, listener);
  },
  sensitiveModelStatus: () => ipcRenderer.invoke(IPC.sensitiveModelStatus),
  setAdvancedProtection: (enabled) => ipcRenderer.invoke(IPC.sensitiveSetAdvanced, enabled),
  downloadSensitiveModels: () => ipcRenderer.invoke(IPC.sensitiveDownloadModels),
  onSensitiveModelStatusChanged: (cb) => {
    const listener = (_event, status) => cb(status);
    ipcRenderer.on(IPC.sensitiveStatusChanged, listener);
    return () => ipcRenderer.removeListener(IPC.sensitiveStatusChanged, listener);
  },
  getSensitiveReport: (sessionId) => ipcRenderer.invoke(IPC.sensitiveGetReport, sessionId),
  analyze: (sessionId) => ipcRenderer.invoke(IPC.analyze, sessionId),
  analyzeFeedback: (input) => ipcRenderer.invoke(IPC.analyzeFeedback, input),
  getAnalysis: (sessionId) => ipcRenderer.invoke(IPC.getAnalysis, sessionId),
  updateAnalysis: (input) => ipcRenderer.invoke(IPC.updateAnalysis, input),
  cancelAnalysis: (sessionId) => ipcRenderer.invoke(IPC.cancelAnalysis, sessionId),
  onAnalyzeProgress: (cb) => {
    const listener = (_event, progress) => cb(progress);
    ipcRenderer.on(IPC.analyzeProgress, listener);
    return () => ipcRenderer.removeListener(IPC.analyzeProgress, listener);
  },
  listSessions: () => ipcRenderer.invoke(IPC.listSessions),
  deleteSession: (sessionId, password) => ipcRenderer.invoke(IPC.deleteSession, sessionId, password),
  exportDebugBundle: (sessionId) => ipcRenderer.invoke(IPC.exportDebugBundle, sessionId),
  buildSkill: (input) => ipcRenderer.invoke(IPC.buildSkill, input),
  prepareSkill: (sessionId, plan) => ipcRenderer.invoke(IPC.prepareSkill, sessionId, plan),
  discardSkillPreview: (sessionId, previewId) => ipcRenderer.invoke(IPC.discardSkillPreview, sessionId, previewId),
  createSkill: (sessionId, plan, placement, previewId) =>
    ipcRenderer.invoke(IPC.createSkill, sessionId, plan, placement, previewId),
  getSkill: (sessionId) => ipcRenderer.invoke(IPC.getSkill, sessionId),
  cancelSkill: (sessionId) => ipcRenderer.invoke(IPC.cancelSkill, sessionId),
  revealSkill: (sessionId) => ipcRenderer.invoke(IPC.revealSkill, sessionId),
  onSkillProgress: (cb) => {
    const listener = (_event, progress) => cb(progress);
    ipcRenderer.on(IPC.skillProgress, listener);
    return () => ipcRenderer.removeListener(IPC.skillProgress, listener);
  },
  buildAutomation: (input) => ipcRenderer.invoke(IPC.buildAutomation, input),
  createAutomation: (sessionId, plan) => ipcRenderer.invoke(IPC.createAutomation, sessionId, plan),
  getAutomation: (sessionId) => ipcRenderer.invoke(IPC.getAutomation, sessionId),
  cancelAutomation: (sessionId) => ipcRenderer.invoke(IPC.cancelAutomation, sessionId),
  revealAutomation: (sessionId) => ipcRenderer.invoke(IPC.revealAutomation, sessionId),
  onAutomationProgress: (cb) => {
    const listener = (_event, progress) => cb(progress);
    ipcRenderer.on(IPC.automationProgress, listener);
    return () => ipcRenderer.removeListener(IPC.automationProgress, listener);
  },
  openLibrary: () => ipcRenderer.invoke(IPC.openLibrary),
  closeLibrary: () => ipcRenderer.invoke(IPC.closeLibrary),
  cancelClose: () => ipcRenderer.invoke(IPC.cancelClose),
  setRecordingControlsExpanded: (expanded) =>
    ipcRenderer.invoke(IPC.recordingControlsExpanded, expanded),
  fitRecorderHeight: (height) => ipcRenderer.send(IPC.fitRecorderHeight, height),
});
