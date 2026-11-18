import { describe, expect, it } from 'vitest';
import { pageWindow } from './common';

describe('pageWindow', () => {
  it('muestra todas las páginas si son pocas', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('recorta con «…» y mantiene siempre primera y última', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 16, 17, 18, 19, 20]);
  });
  it('nunca pasa de 7 elementos', () => {
    for (let p = 1; p <= 50; p++) expect(pageWindow(p, 50).length).toBeLessThanOrEqual(7);
  });
});
