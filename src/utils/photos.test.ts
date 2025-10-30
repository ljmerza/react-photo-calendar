import { describe, expect, it } from 'vitest';
import { createPhotosByDateMap } from './photos';

describe('createPhotosByDateMap', () => {
  it('returns an empty object when entries are missing', () => {
    expect(createPhotosByDateMap()).toEqual({});
    expect(createPhotosByDateMap([])).toEqual({});
  });

  it('groups photos by ISO date, preserving input order', () => {
    const map = createPhotosByDateMap([
      { datetime: '2030-01-05T10:00:00Z', photos: ['a.jpg', 'b.jpg'] },
      { datetime: '2030-01-05T22:00:00Z', photos: ['c.jpg'] },
      { datetime: '2030-01-06T10:00:00Z', photos: ['d.jpg'] }
    ]);

    expect(Object.keys(map)).toEqual(['2030-01-05', '2030-01-06']);
    expect(map['2030-01-05']).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(map['2030-01-06']).toEqual(['d.jpg']);
  });

  it('ignores entries that do not contain photos', () => {
    const map = createPhotosByDateMap([
      { datetime: '2030-01-05T10:00:00Z', photos: [] },
      { datetime: '2030-01-05T11:00:00Z', photos: ['keep.jpg'] }
    ]);

    expect(map).toEqual({ '2030-01-05': ['keep.jpg'] });
  });
});
