import sharp from 'sharp';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export type ProcessingStrategy = {
  width: number;
  quality: number;
};

export const PORTRAIT_STRATEGY: ProcessingStrategy = { width: 800, quality: 90 };
export const DEFAULT_STRATEGY: ProcessingStrategy = { width: 400, quality: 80 };

export function selectStrategy(key: string): ProcessingStrategy {
  return key.startsWith('images/portraits/') ? PORTRAIT_STRATEGY : DEFAULT_STRATEGY;
}

export function isProcessableImage(key: string): boolean {
  const ext = key.toLowerCase().slice(key.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function buildOutputKey(inputKey: string): string {
  const withoutPrefix = inputKey.replace(/^images\//, '');
  const lastDot = withoutPrefix.lastIndexOf('.');
  const baseName = lastDot > 0 ? withoutPrefix.slice(0, lastDot) : withoutPrefix;
  return `thumbnails/${baseName}-thumb.webp`;
}

export async function generateThumbnail(input: Buffer, strategy: ProcessingStrategy): Promise<Buffer> {
  return sharp(input)
    .resize(strategy.width, null, { withoutEnlargement: true })
    .webp({ quality: strategy.quality })
    .toBuffer();
}
