# Workflow Studio aus dem Quellcode starten

Dieses Repository enthält die neutrale Studio-Weiterentwicklung. Upstream-Downloads installieren eine andere Programmfassung. Die ursprünglichen Installationsskripte `install.ps1` und `install.sh` bleiben als Upstream-Referenz erhalten und beziehen Microsoft Skill Recorder. Für diese Fassung die folgenden Schritte verwenden.

## Voraussetzungen

- Git und Zugriff auf dieses private Repository.
- Node.js >=24.19.0 und <25, npm >=11.17.0.
- Windows 11 x64 für den hier verwendeten Studio-Startweg. Weitere Plattformen benötigen eine eigene Abnahme.

```powershell
git clone https://github.com/friedensbringer-peacemaker/workflow-studio.git
cd workflow-studio
npm run check:lockfile
npm ci --ignore-scripts=false --dangerously-allow-all-scripts=false --strict-allow-scripts
npm run electron:install-reviewed
npm run compliance:licenses
npm test
npm run test:studio
npm run build
.\Start-WorkflowStudio.cmd
```

Der Starter baut vor dem Öffnen und verwendet `.local/studio-profile`. Dieser Ordner wird nicht versioniert. Alternativ öffnet `npm run dev` die Entwicklungsfassung mit automatischem Neuladen. Eigene Aufnahmen, Logos und Zugangswerte gehören ausschließlich ins lokale Profil.

Eine eigene Node-Installation kann über `WORKFLOW_STUDIO_NODE` angegeben werden. Lockfile und Paketfreigaben nicht durch eine ungeprüfte Installation ersetzen. Kein Starter beginnt automatisch eine Aufnahme oder KI-Analyse.

Die ursprünglichen Details zu plattformspezifischen Laufzeiten und Integritätsprüfungen stehen in [INSTALL-UPSTREAM.md](INSTALL-UPSTREAM.md). Dessen Download-Adressen zeigen bewusst auf das Originalprojekt. Für Binärpakete gilt [RELEASING.md](RELEASING.md).
