# Workflow Studio

Desktop-Arbeit aufzeichnen, Abläufe bearbeiten und daraus verständliche Dokumentation und KI-Skills erstellen.

**Fork von [Microsoft Skill Recorder](https://github.com/microsoft/skill-recorder), mit [OpenSteps](https://github.com/ebanez8/openstep) als Funktionsreferenz.**

Die ausführbare Codebasis stammt von Microsoft Skill Recorder. OpenSteps hat die Ausrichtung auf Screenshots und Schritt-für-Schritt-Dokumentation mitgeprägt; sein Code wurde nicht übernommen. Dieses eigenständig versionierte Repository enthält eine bereinigte Weiterentwicklung mit eigener Git-Historie. Es ist kein GitHub-Fork mit zwei Elternprojekten. [Herkunft und Lizenzen](docs/fork/PROVENANCE.md).

## Was enthalten ist

- Recorder für Bildschirmaufnahmen, Klicks und optionale gesprochene Erklärungen.
- Studio mit Projekten, senkrechter Schrittliste und bearbeitbaren Details; Text, Screenshots, Audio und Dateien pro Schritt.
- Drei Ansichten: alles in einem Fenster, zwei Fenster oder kompakter Recorder.
- Frei wählbare Firmenbezeichnung, Logo und Farben; neutrale Voreinstellung ohne Firmenname oder Logo.
- Windows-Diktat an Textfeldern, nachträgliche Ergänzungen und optionaler Kennwortschutz für Löschvorgänge.
- Markdown, JSON, HTML-Anleitungen, Mermaid, SVG und draw.io-Ausgaben.
- KI-Anbieter, Wissensinterview, Prozessbewertung mit exemplarischen Methoden und geprüfter SKILL.md-Export.
- Grundlagen für Markdown-Wiki, Notion und Outline. Externe Übertragungen erfordern eigene Konfiguration und eine bewusste Aktion.

Der Erststart enthält **keine Projekte, Aufnahmen, Screenshots, Vortragsbeispiele, Benutzerprofile oder Zugangsdaten**. Neue manuelle Prozesse sind leer. Synthetische Testfixtures bleiben für die automatisierten Tests im Quellcode; sie werden nicht als Benutzerprojekte angelegt.

## Start

Voraussetzung: Node.js 24.19 oder neuer innerhalb Version 24 und npm ab 11.17. Vollständige Anleitung: [INSTALL.md](INSTALL.md).

Nach dem geprüften Abhängigkeitsaufbau startet unter Windows **Start-WorkflowStudio.cmd** den aktuellen Build mit einem eigenen lokalen Entwicklungsprofil. Für Entwicklung mit automatischem Neuladen: `npm run dev`.

KI-Modelle, Anbieterzugänge und externe Werkzeuge sind nicht enthalten. Aufnahmen und Konfiguration bleiben im lokalen Benutzerprofil. Das Repository enthält nur Quellcode und benötigte lizenzierte Programmassets.

## Prüfstand und Grenzen

Dies ist eine Entwicklungsfassung, keine allgemeine Produktionsfreigabe. Automatisierte Tests ersetzen keine reale Aufnahme-, Mikrofon-, Windows-Diktat-, Modell- oder Paketabnahme. [Prüfprotokoll](docs/fork/VALIDATION.md).

Vor einer Binärverteilung sind die vollständigen Compliance- und Paketprüfungen aus [RELEASING.md](RELEASING.md) erforderlich. Modelle und Laufzeiten dürfen nicht durch Kopieren des Entwicklungsordners verteilt werden.

## Herkunft

| Projekt | Rolle |
| --- | --- |
| [Microsoft Skill Recorder](https://github.com/microsoft/skill-recorder) | Codebasis und MIT-Lizenz |
| [OpenSteps](https://github.com/ebanez8/openstep) | Funktionsreferenz für visuelle Prozessdokumentation |

Die ursprünglichen Urheberhinweise in [LICENSE](LICENSE) und [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) bleiben erhalten. Upstream-Bedienhinweise stehen separat in [README-UPSTREAM.md](README-UPSTREAM.md).
