import { describe, it, expect, vi } from 'vitest'
import { buildOutputKey, isProcessableImage, selectStrategy, generateThumbnail, PORTRAIT_STRATEGY, DEFAULT_STRATEGY } from './thumbnail.js'

const { mockToBuffer, mockWebp, mockResize } = vi.hoisted(() => {
  const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from('fake-webp'))
  const mockWebp = vi.fn().mockReturnValue({ toBuffer: mockToBuffer })
  const mockResize = vi.fn().mockReturnValue({ webp: mockWebp })
  return { mockToBuffer, mockWebp, mockResize }
})

vi.mock('sharp', () => ({ default: vi.fn().mockReturnValue({ resize: mockResize }) }))

describe('buildOutputKey', () => {
  it('transforms images/photo.jpg to thumbnails/photo-thumb.webp', () => {
    expect(buildOutputKey('images/photo.jpg')).toBe('thumbnails/photo-thumb.webp')
  })

  it('preserves subdirectory structure', () => {
    expect(buildOutputKey('images/blog/header.png')).toBe('thumbnails/blog/header-thumb.webp')
  })

  it('handles deep nesting', () => {
    expect(buildOutputKey('images/a/b/c.jpeg')).toBe('thumbnails/a/b/c-thumb.webp')
  })

  it('handles portraits sub-prefix', () => {
    expect(buildOutputKey('images/portraits/uuid.jpg')).toBe('thumbnails/portraits/uuid-thumb.webp')
  })

  it('handles key with no extension', () => {
    expect(buildOutputKey('images/noext')).toBe('thumbnails/noext-thumb.webp')
  })
})

describe('isProcessableImage', () => {
  it('returns true for jpg', () => {
    expect(isProcessableImage('photo.jpg')).toBe(true)
  })

  it('returns true for png', () => {
    expect(isProcessableImage('image.PNG')).toBe(true)
  })

  it('returns false for txt', () => {
    expect(isProcessableImage('file.txt')).toBe(false)
  })

  it('returns false for pdf', () => {
    expect(isProcessableImage('doc.pdf')).toBe(false)
  })
})

describe('generateThumbnail', () => {
  it('returns a Buffer', async () => {
    const result = await generateThumbnail(Buffer.from([1, 2, 3]), DEFAULT_STRATEGY)
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('calls resize with strategy width and no enlargement', async () => {
    await generateThumbnail(Buffer.from([1]), PORTRAIT_STRATEGY)
    expect(mockResize).toHaveBeenCalledWith(PORTRAIT_STRATEGY.width, null, { withoutEnlargement: true })
  })

  it('calls webp with strategy quality', async () => {
    await generateThumbnail(Buffer.from([1]), DEFAULT_STRATEGY)
    expect(mockWebp).toHaveBeenCalledWith({ quality: DEFAULT_STRATEGY.quality })
  })
})

describe('selectStrategy', () => {
  it('returns PORTRAIT_STRATEGY for images/portraits/ prefix', () => {
    expect(selectStrategy('images/portraits/uuid.jpg')).toBe(PORTRAIT_STRATEGY)
  })

  it('returns DEFAULT_STRATEGY for images/ prefix', () => {
    expect(selectStrategy('images/photo.jpg')).toBe(DEFAULT_STRATEGY)
  })

  it('returns DEFAULT_STRATEGY for blog sub-prefix', () => {
    expect(selectStrategy('images/blog/header.png')).toBe(DEFAULT_STRATEGY)
  })

  it('PORTRAIT_STRATEGY has higher width and quality than DEFAULT_STRATEGY', () => {
    expect(PORTRAIT_STRATEGY.width).toBeGreaterThan(DEFAULT_STRATEGY.width)
    expect(PORTRAIT_STRATEGY.quality).toBeGreaterThan(DEFAULT_STRATEGY.quality)
  })
})
