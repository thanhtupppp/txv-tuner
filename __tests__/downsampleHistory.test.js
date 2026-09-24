import { downsampleHistory } from '../src/domain/telemetry/downsampleHistory';

describe('downsampleHistory - pure domain telemetry downsampling', () => {
  it('returns empty array when given empty, null, or undefined input', () => {
    expect(downsampleHistory([], 30)).toEqual([]);
    expect(downsampleHistory(null, 30)).toEqual([]);
    expect(downsampleHistory(undefined, 30)).toEqual([]);
  });

  it('returns single point when given array with 1 point', () => {
    const single = [{ timestamp: 1000, actualSh: 6.2, targetSh: 6.0 }];
    const result = downsampleHistory(single, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(single[0]);
  });

  it('returns all points if points count is less than or equal to maxPoints', () => {
    const points = [
      { timestamp: 1000, actualSh: 5.5 },
      { timestamp: 2000, actualSh: 6.0 },
      { timestamp: 3000, actualSh: 6.5 },
    ];
    const result = downsampleHistory(points, 5);
    expect(result).toHaveLength(3);
    expect(result).toEqual(points);
  });

  it('filters out invalid points (null, non-finite values, missing keys)', () => {
    const raw = [
      null,
      { timestamp: 1000, actualSh: 5.0 },
      { timestamp: 2000, actualSh: NaN },
      { timestamp: 'invalid', actualSh: 6.0 },
      { timestamp: 3000, actualSh: null },
      { timestamp: 4000, actualSh: Infinity },
      { timestamp: 5000, actualSh: 7.0 },
      undefined,
    ];
    const result = downsampleHistory(raw, 10);
    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBe(1000);
    expect(result[1].timestamp).toBe(5000);
  });

  it('guarantees output length never exceeds maxPoints', () => {
    const raw = Array.from({ length: 200 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      actualSh: 5 + Math.sin(i / 5) * 3,
    }));

    const maxPoints = 40;
    const result = downsampleHistory(raw, maxPoints);
    expect(result.length).toBeLessThanOrEqual(maxPoints);
    expect(result.length).toBeGreaterThan(1);
  });

  it('preserves the exact first and last point of the time series', () => {
    const raw = Array.from({ length: 150 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      actualSh: 6.0 + (i % 3) * 0.2,
    }));

    const result = downsampleHistory(raw, 30);
    expect(result[0].timestamp).toBe(raw[0].timestamp);
    expect(result[0].actualSh).toBe(raw[0].actualSh);
    expect(result[result.length - 1].timestamp).toBe(raw[raw.length - 1].timestamp);
    expect(result[result.length - 1].actualSh).toBe(raw[raw.length - 1].actualSh);
  });

  it('preserves extreme min and max spikes in superheat data', () => {
    // 100 points hovering around 6.0K, with a sharp spike to 15.5K and drop to 0.8K
    const raw = Array.from({ length: 100 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      actualSh: 6.0,
    }));

    raw[35] = { timestamp: 1000 + 35 * 1000, actualSh: 15.5 }; // Sharp spike
    raw[70] = { timestamp: 1000 + 70 * 1000, actualSh: 0.8 };  // Deep drop

    const result = downsampleHistory(raw, 20);
    expect(result.length).toBeLessThanOrEqual(20);

    const values = result.map((p) => p.actualSh);
    expect(Math.max(...values)).toBe(15.5);
    expect(Math.min(...values)).toBe(0.8);
  });

  it('preserves chronological order of timestamps in output', () => {
    const raw = Array.from({ length: 120 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      actualSh: 5 + (i % 5),
    }));

    const result = downsampleHistory(raw, 25);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timestamp).toBeGreaterThan(result[i - 1].timestamp);
    }
  });

  it('supports custom valueKey and timeKey (e.g. t2 and time)', () => {
    const raw = Array.from({ length: 80 }, (_, i) => ({
      time: 5000 + i * 2000,
      t2: -25 + (i % 4),
    }));
    raw[40] = { time: 5000 + 40 * 2000, t2: -10.0 }; // Warm spike

    const result = downsampleHistory(raw, 20, {
      valueKey: 't2',
      timeKey: 'time',
    });

    expect(result.length).toBeLessThanOrEqual(20);
    const temps = result.map((p) => p.t2);
    expect(Math.max(...temps)).toBe(-10.0);
    expect(result[0].time).toBe(5000);
  });

  it('supports LTTB algorithm and preserves general shape', () => {
    const raw = Array.from({ length: 100 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      actualSh: 5 + Math.sin(i / 10) * 4,
    }));

    const result = downsampleHistory(raw, 30, { algorithm: 'lttb' });
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result[0].timestamp).toBe(raw[0].timestamp);
    expect(result[result.length - 1].timestamp).toBe(raw[raw.length - 1].timestamp);
  });

  it('strictly rejects points with missing timestamp unless allowSyntheticTime is true', () => {
    const withoutTime = [
      { actualSh: 6.0 }, // missing timestamp
      { timestamp: 2000, actualSh: 6.5 },
      { actualSh: 7.0 }, // missing timestamp
    ];
    const strictResult = downsampleHistory(withoutTime, 10);
    expect(strictResult).toHaveLength(1);
    expect(strictResult[0].timestamp).toBe(2000);

    const syntheticResult = downsampleHistory(withoutTime, 10, { allowSyntheticTime: true });
    expect(syntheticResult).toHaveLength(3);
  });
});
