import matrix from './ui-translations.json' with { type: 'json' };

export type UiLanguage = 'de' | 'en';
export const UI_TRANSLATIONS: Readonly<Record<string, { de: string; en: string }>> = matrix;
export function translateUi(source: string, language: UiLanguage, values: Record<string, string | number> = {}): string {
  const template = UI_TRANSLATIONS[source]?.[language] ?? source;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]));
}
