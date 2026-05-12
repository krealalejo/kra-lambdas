import sharp from 'sharp';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export type ProcessingStrategy = {
  width: number;
  quality: number;
};

export const PORTRAIT_STRATEGY: ProcessingStrategy = { width: 600, quality: 82 };
export const DEFAULT_STRATEGY: ProcessingStrategy = { width: 400, quality: 80 };

export function selectStrategy(key: string): ProcessingStrategy {
  return key.startsWith('uploads/portraits/') ? PORTRAIT_STRATEGY : DEFAULT_STRATEGY;
}

export function isProcessableImage(key: string): boolean {
  if (!key.startsWith('uploads/')) return false;
  const ext = key.toLowerCase().slice(key.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function buildOutputKey(inputKey: string): string {
  if (inputKey.startsWith('uploads/portraits/')) {
    const filename = inputKey.slice('uploads/portraits/'.length);
    const lastDot = filename.lastIndexOf('.');
    const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    return `portraits/${baseName}.webp`;
  }
  if (inputKey.startsWith('uploads/blog/')) {
    const filename = inputKey.slice('uploads/blog/'.length);
    const lastDot = filename.lastIndexOf('.');
    const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    return `blog/${baseName}-cover.webp`;
  }
  // fallback for any other uploads/ key
  const withoutPrefix = inputKey.replace(/^uploads\//, '');
  const lastDot = withoutPrefix.lastIndexOf('.');
  const baseName = lastDot > 0 ? withoutPrefix.slice(0, lastDot) : withoutPrefix;
  return `processed/${baseName}.webp`;
}

export async function generateThumbnail(input: Buffer, strategy: ProcessingStrategy): Promise<Buffer> {
  return sharp(input)
    .resize(strategy.width, null, { withoutEnlargement: true })
    .webp({ quality: strategy.quality })
    .toBuffer();
}
