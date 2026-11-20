import { describe, expect, it } from 'vitest';
import { toAverageDurationDisplay } from './format';

describe('toAverageDurationDisplay', () => {
  it('shows averages below one hour in minutes', () => {
    expect(toAverageDurationDisplay(0.5)).toEqual({
      value: 30,
      note: 'Rata-rata (Menit)',
    });
    expect(toAverageDurationDisplay(0.99)).toEqual({
      value: 59.4,
      note: 'Rata-rata (Menit)',
    });
  });

  it('keeps averages of one hour or more in hours', () => {
    expect(toAverageDurationDisplay(1)).toEqual({
      value: 1,
      note: 'Rata-rata (Jam)',
    });
    expect(toAverageDurationDisplay(2.25)).toEqual({
      value: 2.25,
      note: 'Rata-rata (Jam)',
    });
  });

  it('uses zero minutes when the average is unavailable', () => {
    expect(toAverageDurationDisplay()).toEqual({
      value: 0,
      note: 'Rata-rata (Menit)',
    });
  });
});
