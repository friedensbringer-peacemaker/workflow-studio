import { z } from 'zod';

export const BRANDING_PRESETS = {
  green: { primary: '#D8F4B5', secondary: '#1E2520' },
  yellow: { primary: '#FFDD04', secondary: '#212121' },
} as const;
export const BrandingSchema = z.object({
  companyName: z.string().trim().max(80).default(''),
  primary: z.string().regex(/^#[0-9a-f]{6}$/i).default(BRANDING_PRESETS.green.primary),
  secondary: z.string().regex(/^#[0-9a-f]{6}$/i).default(BRANDING_PRESETS.green.secondary),
  logo: z.string().max(3_000_000).regex(/^(?:|data:image\/png;base64,[A-Za-z0-9+/]+={0,2})$/).default(''),
});
export type Branding = z.infer<typeof BrandingSchema>;
export const DEFAULT_BRANDING: Branding = BrandingSchema.parse({});
export const brandTitle = (brand: Branding, product = 'Workflow Studio') => [brand.companyName, product].filter(Boolean).join(' ');
export function foreground(hex: string): string {
  const rgb = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#000000' : '#FFFFFF';
}
export function brandTokens(brand: Branding): Record<string, string> {
  const rgb = brand.primary.slice(1).match(/../g)!.map(v => parseInt(v, 16));
  return { '--brand': brand.primary, '--brand-hover': 'color-mix(in srgb, ' + brand.primary + ', black 10%)',
    '--brand-fg': foreground(brand.primary), '--brand-rgb': rgb.join(','), '--signal': brand.primary,
    '--signal-dim': 'color-mix(in srgb, ' + brand.primary + ' 14%, white)',
    '--brand-secondary': brand.secondary, '--brand-secondary-fg': foreground(brand.secondary) };
}
