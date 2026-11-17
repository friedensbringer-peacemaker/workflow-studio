# Workflow Studio

**Frühe BETA · in aktiver Entwicklung · Feedback ausdrücklich erwünscht**

Desktop-Arbeit aufzeichnen, Abläufe bearbeiten und daraus verständliche Dokumentation und KI-Skills erstellen.

**Fork von [Microsoft Skill Recorder](https://github.com/microsoft/skill-recorder), mit [OpenSteps](https://github.com/ebanez8/openstep) als Funktionsreferenz.**

Die ausführbare Codebasis stammt von Microsoft Skill Recorder. OpenSteps hat die Ausrichtung auf Screenshots und Schritt-für-Schritt-Dokumentation mitgeprägt; sein Code wurde nicht übernommen. Dieses eigenständig versionierte Repository enthält eine bereinigte Weiterentwicklung mit eigener Git-Historie. Es ist kein GitHub-Fork mit zwei Elternprojekten. [Herkunft und Lizenzen](docs/fork/PROVENANCE.md).

## Die Idee hinter meiner Weiterentwicklung

Eine Bildschirmaufnahme zeigt, **was** jemand macht. Für eine gute Übergabe und hilfreiche KI-Unterstützung braucht es auch das **Warum**: Welche Voraussetzungen gelten? Welche Besonderheiten hat ein Markt oder Kunde? Wann braucht es eine Rückfrage oder Freigabe?

Ich erweitere den Recorder deshalb zu einem Studio, in dem sich dieses Wissen zusammen mit den einzelnen Arbeitsschritten festhalten, ergänzen und weiterverwenden lässt. Ziel ist, dass Kolleginnen, Kollegen und KI-Assistenten einen Ablauf samt Kontext nachvollziehen können.

## Was ich angepasst und ergänzt habe

Die Aufnahme- und Skill-Builder-Grundlage stammt von Microsoft Skill Recorder. Darauf bauen diese Erweiterungen und Anpassungen auf:

| Bereich | Anpassungen und Ergänzungen in diesem Fork |
| --- | --- |
| **Prozesseditor** | Projekte, senkrechte Schrittliste und Detailansicht; Schritte ergänzen, bearbeiten, umordnen, teilen, zusammenführen und löschen. |
| **Wissen zum Ablauf** | Prozessziel, Erklärungen, Hintergründe, Ausnahmen und offene Fragen; KI-gestütztes Wissensinterview zum Ergänzen fehlenden Kontexts. |
| **Screenshots, Text und Sprache** | Bilder, Dokumente und Audio pro Schritt, Inhaltslabels, Bildbearbeitung und optionale ScreenToGif-Anbindung. Gesprochene Erklärungen werden zeitlich zugeordnet; Ergänzungen sind auch nach der Aufnahme möglich. Windows-Diktat ist an Textfeldern angebunden. |
| **Oberfläche und Gestaltung** | Aufgeräumte Oberfläche, klare Spalten und Einstellungen; frei wählbare Firmenbezeichnung, Logo und Farben. Drei Ansichten: alles in einem Fenster, zwei Fenster oder kompakter Recorder. |
| **KI-Anbieter** | Zusätzliche Adapter für Ollama, kompatible APIs, Claude API und Codex CLI; Voreinstellungen unter anderem für LM Studio, vLLM und Z.ai. Der ursprüngliche Copilot-Skill-Builder bleibt separat verfügbar. |
| **Prozessbewertung** | Fragen zu Verständlichkeit, Optimierung, KI-Unterstützung, Automatisierung und benötigter Umgebung. Exemplarische Methodenvorlagen, etwa Lean, SMART und Six Sigma, sowie eigene Vorgaben. |
| **Dokumentation und Skills** | Ausgaben als Markdown, JSON, HTML-Anleitung, Mermaid, SVG oder draw.io-Datei. Bearbeitbarer SKILL.md-Export mit deutscher oder englischer Vorlage und bewusster Prüfung vor dem Export. |
| **Wikis und Schutzfunktionen** | Erste Schnittstellen für Markdown-Wiki, Notion und Outline; optionaler Kennwortschutz für Löschvorgänge. Externe Übertragungen benötigen eine eigene Konfiguration und eine bewusste Aktion. |

Der Erststart enthält **keine Projekte, Aufnahmen, Screenshots, Vortragsbeispiele, Benutzerprofile oder Zugangsdaten**. Neue manuelle Prozesse sind leer. Synthetische Testfixtures bleiben für die automatisierten Tests im Quellcode; sie werden nicht als Benutzerprojekte angelegt.

## Start

Voraussetzung: Node.js 24.19 oder neuer innerhalb Version 24 und npm ab 11.17. Vollständige Anleitung: [INSTALL.md](INSTALL.md).

Nach dem geprüften Abhängigkeitsaufbau startet unter Windows **Start-WorkflowStudio.cmd** den aktuellen Build mit einem eigenen lokalen Entwicklungsprofil. Für Entwicklung mit automatischem Neuladen: `npm run dev`.

KI-Modelle, Anbieterzugänge und externe Werkzeuge sind nicht enthalten. Aufnahmen und Konfiguration bleiben im lokalen Benutzerprofil. Das Repository enthält nur Quellcode und benötigte lizenzierte Programmassets.

## Prüfstand und Grenzen

**Das Projekt ist eine frühe Beta, keine fertige Produktivlösung.** Funktionen, Oberfläche und Datenformate können sich noch verändern. Die Wiki-Anbindungen sind Grundlagen; auch Anbieter, Mikrofone, Diktat und Betriebssysteme brauchen weitere Tests unter realen Bedingungen.

Stand 17. November 2026: **326 automatisierte Tests**, Build, Typ- und Lizenzprüfungen sowie ein echter Electron-Start mit leerem Profil sind bestanden. Das bestätigt noch keine vollständige Aufnahme-, Mikrofon-, Windows-Diktat-, Modell- oder Paketabnahme. Darkmode und weitere Plattformabnahmen sind offen. [Prüfprotokoll und genaue Grenzen](docs/fork/VALIDATION.md).

Vor einer Binärverteilung sind die vollständigen Compliance- und Paketprüfungen aus [RELEASING.md](RELEASING.md) erforderlich. Modelle und Laufzeiten dürfen nicht durch Kopieren des Entwicklungsordners verteilt werden.

## Input ist willkommen

Ich freue mich über Erfahrungen aus der Praxis, Fehlerberichte, Ideen zur Bedienung und Beiträge zum Code. Besonders interessieren mich:

- Welche Informationen fehlen, damit jemand anderes euren Prozess zuverlässig übernehmen kann?
- Wo ist die Oberfläche noch unklar oder zu aufwendig?
- Welche Ausgabeformate oder Anbindungen wären für euch hilfreich?
- Was funktioniert bei euch noch nicht wie erwartet?

**[Feedback oder einen Fehler melden](https://github.com/friedensbringer-peacemaker/workflow-studio/issues/new)** · [Vorhandene Issues](https://github.com/friedensbringer-peacemaker/workflow-studio/issues) · [Hinweise zu Beiträgen](CONTRIBUTING.md)

Für Fehlerberichte helfen Betriebssystem, Programmstand, kurze Schritte zum Nachstellen und das erwartete Ergebnis. Bitte nur fiktive oder bereinigte Beispiele verwenden und keine Zugangsdaten, Kundendaten oder vertraulichen Aufnahmen hochladen. Sicherheitsthemen bitte gemäß [SECURITY.md](SECURITY.md) vertraulich melden.

## Herkunft

| Projekt | Rolle |
| --- | --- |
| [Microsoft Skill Recorder](https://github.com/microsoft/skill-recorder) | Codebasis und MIT-Lizenz |
| [OpenSteps](https://github.com/ebanez8/openstep) | Funktionsreferenz für visuelle Prozessdokumentation |

Die ursprünglichen Urheberhinweise in [LICENSE](LICENSE) und [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) bleiben erhalten. Upstream-Bedienhinweise stehen separat in [README-UPSTREAM.md](README-UPSTREAM.md).
