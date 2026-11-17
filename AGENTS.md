# Workflow Studio

Read README.md, docs/fork/PROVENANCE.md, INSTALL.md and RELEASING.md first.

This is an independently versioned, neutral source fork of Microsoft Skill Recorder. OpenSteps is a functional reference; no OpenSteps source was merged.

- Preserve user changes, recordings and runtime paths. Never add profiles, recordings, desktop captures, credentials, build caches or installed dependencies to Git.
- The default application must start without seeded projects, transcripts, customer content or company branding. Keep tests synthetic and separate from runtime user data.
- Preserve the upstream MIT license, third-party notices, local font/icon licenses, lockfile and strict installation-script approvals.
- Keep capture/storage/transcription separate from provider analysis and authentication. Do not record, upload, call a paid provider or execute a generated skill merely to validate a change.
- Run appropriate tests and builds. UI and hardware behavior needs explicit validation notes; mocked tests do not prove a microphone, real model or native dictation works.
- Packaging requires the full compliance material and native smoke tests described in RELEASING.md. Source launch alone is not package validation.
- Design assets use local Inter and Phosphor Light. Update docs/fork/design-assets.json when intentionally modifying those files.
- Do not spawn sub-agents unless requested by the user.
