import sharp from 'sharp';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const THUMBNAIL_WIDTH = 300;
const WEBP_QUALITY = 80;

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

export async function generateThumbnail(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
