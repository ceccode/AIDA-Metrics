import { describe, it, expect } from 'vitest';
import { parseRelativeDate, daysBetween } from './dates.js';

describe('parseRelativeDate', () => {
  it('parses relative days (e.g. 30d)', () => {
    const now = Date.now();
    const result = parseRelativeDate('30d');
    const expected = now - 30 * 24 * 60 * 60 * 1000;
    // Allow 2h tolerance for DST boundary crossings
    expect(Math.abs(result.getTime() - expected)).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it('parses relative weeks (e.g. 2w)', () => {
    const now = Date.now();
    const result = parseRelativeDate('2w');
    const expected = now - 14 * 24 * 60 * 60 * 1000;
    // Allow 2h tolerance for DST boundary crossings
    expect(Math.abs(result.getTime() - expected)).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it('parses relative months (e.g. 3m)', () => {
    const result = parseRelativeDate('3m');
    const now = new Date();
    now.setMonth(now.getMonth() - 3);
    expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
  });

  it('parses relative years (e.g. 1y)', () => {
    const result = parseRelativeDate('1y');
    const now = new Date();
    now.setFullYear(now.getFullYear() - 1);
    expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
  });

  it('parses ISO date strings', () => {
    const result = parseRelativeDate('2024-06-15');
    expect(result.toISOString()).toContain('2024-06-15');
  });

  it('parses ISO datetime strings', () => {
    const result = parseRelativeDate('2024-06-15T12:00:00Z');
    expect(result.toISOString()).toBe('2024-06-15T12:00:00.000Z');
  });

  it('throws on invalid format', () => {
    expect(() => parseRelativeDate('abc')).toThrow('Invalid date format');
  });

  it('throws on unsupported unit', () => {
    expect(() => parseRelativeDate('10x')).toThrow('Invalid date format');
  });

  it('throws on invalid ISO-like strings (e.g. "not-a-date")', () => {
    expect(() => parseRelativeDate('not-a-date')).toThrow('Invalid date format');
  });
});

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    const d = new Date('2024-01-01');
    expect(daysBetween(d, d)).toBe(0);
  });

  it('returns correct days between two dates', () => {
    const a = new Date('2024-01-01');
    const b = new Date('2024-01-11');
    expect(daysBetween(a, b)).toBe(10);
  });

  it('is symmetric (order does not matter)', () => {
    const a = new Date('2024-01-01');
    const b = new Date('2024-02-01');
    expect(daysBetween(a, b)).toBe(daysBetween(b, a));
  });
});
