import sharp from 'sharp';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export type ProcessingStrategy = {
  width: number;
  quality: number;
};

export const PORTRAIT_STRATEGY: ProcessingStrategy = { width: 600, quality: 82 };
export const DEFAULT_STRATEGY: ProcessingStrategy = { width: 400, quality: 80 };
export const LOGO_STRATEGY: ProcessingStrategy = { width: 128, quality: 90 };

export function selectStrategy(key: string): ProcessingStrategy {
  if (key.startsWith('uploads/portraits/')) return PORTRAIT_STRATEGY;
  if (key.startsWith('uploads/logos/')) return LOGO_STRATEGY;
  return DEFAULT_STRATEGY;
}

export function isProcessableImage(key: string): boolean {
  if (!key.startsWith('uploads/')) return false;
  const ext = key.toLowerCase().slice(key.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.has(ext);
}

function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

export function buildOutputKey(inputKey: string): string {
  if (inputKey.startsWith('uploads/portraits/')) {
    return `portraits/${stripExtension(inputKey.slice('uploads/portraits/'.length))}.webp`;
  }
  if (inputKey.startsWith('uploads/logos/')) {
    return `logos/${stripExtension(inputKey.slice('uploads/logos/'.length))}.webp`;
  }
  if (inputKey.startsWith('uploads/blog/')) {
    return `blog/${stripExtension(inputKey.slice('uploads/blog/'.length))}-cover.webp`;
  }
  return `processed/${stripExtension(inputKey.replace(/^uploads\//, ''))}.webp`;
}

export async function generateThumbnail(input: Buffer, strategy: ProcessingStrategy): Promise<Buffer> {
  return sharp(input)
    .resize(strategy.width, null, { withoutEnlargement: true })
    .webp({ quality: strategy.quality })
    .toBuffer();
}

export async function generateLogo(input: Buffer, strategy: ProcessingStrategy): Promise<Buffer> {
  return sharp(input)
    .trim()
    .ensureAlpha()
    .resize(strategy.width, null, { withoutEnlargement: true })
    .webp({ quality: strategy.quality, alphaQuality: strategy.quality })
    .toBuffer();
}
