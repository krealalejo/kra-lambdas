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
  it('transforms uploads/blog/photo.jpg to blog/photo-cover.webp', () => {
    expect(buildOutputKey('uploads/blog/photo.jpg')).toBe('blog/photo-cover.webp')
  })

  it('transforms uploads/portraits/home.jpg to portraits/home.webp', () => {
    expect(buildOutputKey('uploads/portraits/home.jpg')).toBe('portraits/home.webp')
  })

  it('transforms uploads/portraits/cv.png to portraits/cv.webp', () => {
    expect(buildOutputKey('uploads/portraits/cv.png')).toBe('portraits/cv.webp')
  })

  it('handles blog key with no extension', () => {
    expect(buildOutputKey('uploads/blog/my-post')).toBe('blog/my-post-cover.webp')
  })

  it('handles portrait key with no extension', () => {
    expect(buildOutputKey('uploads/portraits/home')).toBe('portraits/home.webp')
  })

  it('falls back to processed/ prefix for unknown uploads/ path', () => {
    expect(buildOutputKey('uploads/other/file.jpg')).toBe('processed/other/file.webp')
  })
})

describe('isProcessableImage', () => {
  it('returns true for uploads/blog jpg', () => {
    expect(isProcessableImage('uploads/blog/photo.jpg')).toBe(true)
  })

  it('returns true for uploads/portraits PNG (case-insensitive)', () => {
    expect(isProcessableImage('uploads/portraits/home.PNG')).toBe(true)
  })

  it('returns false for txt under uploads/', () => {
    expect(isProcessableImage('uploads/blog/file.txt')).toBe(false)
  })

  it('returns false for pdf under uploads/', () => {
    expect(isProcessableImage('uploads/blog/doc.pdf')).toBe(false)
  })

  it('returns false for images/ prefix (not a staging key)', () => {
    expect(isProcessableImage('images/photo.jpg')).toBe(false)
  })

  it('returns false for key with no uploads/ prefix', () => {
    expect(isProcessableImage('photo.jpg')).toBe(false)
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
  it('returns PORTRAIT_STRATEGY for uploads/portraits/ prefix', () => {
    expect(selectStrategy('uploads/portraits/home.jpg')).toBe(PORTRAIT_STRATEGY)
  })

  it('returns DEFAULT_STRATEGY for uploads/blog/ prefix', () => {
    expect(selectStrategy('uploads/blog/photo.jpg')).toBe(DEFAULT_STRATEGY)
  })

  it('returns DEFAULT_STRATEGY for other uploads/ paths', () => {
    expect(selectStrategy('uploads/other/header.png')).toBe(DEFAULT_STRATEGY)
  })

  it('PORTRAIT_STRATEGY has higher width and quality than DEFAULT_STRATEGY', () => {
    expect(PORTRAIT_STRATEGY.width).toBeGreaterThan(DEFAULT_STRATEGY.width)
    expect(PORTRAIT_STRATEGY.quality).toBeGreaterThan(DEFAULT_STRATEGY.quality)
  })
})
