import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildOutputKey, isProcessableImage } from './thumbnail.js';

describe('buildOutputKey', () => {
  it('transforms images/photo.jpg to thumbnails/photo-thumb.webp', () => {
    assert.strictEqual(buildOutputKey('images/photo.jpg'), 'thumbnails/photo-thumb.webp');
  });

  it('preserves subdirectory structure', () => {
    assert.strictEqual(buildOutputKey('images/blog/header.png'), 'thumbnails/blog/header-thumb.webp');
  });

  it('handles deep nesting', () => {
    assert.strictEqual(buildOutputKey('images/a/b/c.jpeg'), 'thumbnails/a/b/c-thumb.webp');
  });
});

describe('isProcessableImage', () => {
  it('returns true for jpg', () => {
    assert.strictEqual(isProcessableImage('photo.jpg'), true);
  });

  it('returns true for png', () => {
    assert.strictEqual(isProcessableImage('image.PNG'), true);
  });

  it('returns false for txt', () => {
    assert.strictEqual(isProcessableImage('file.txt'), false);
  });

  it('returns false for pdf', () => {
    assert.strictEqual(isProcessableImage('doc.pdf'), false);
  });
});
