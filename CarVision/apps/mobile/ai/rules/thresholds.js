/**
 * Rule thresholds — tune per fleet / vehicle class over time.
 * TODO: ML-learned bounds; per-VIN calibration.
 */

export const TH = {
  coolant: {
    warnC: 105,
    critC: 118,
    coldMinC: 40,
  },
  battery: {
    critLowV: 11.8,
    warnLowV: 12.2,
    warnHighV: 15.2,
    nominalMinV: 12.4,
    nominalMaxV: 14.9,
  },
  rpm: {
    idleHigh: 3200,
    redlineSoft: 6200,
  },
  trims: {
    warnAbs: 18,
    critAbs: 28,
  },
  engineLoad: {
    warnIdle: 72,
  },
  fuelPct: {
    low: 12,
    crit: 5,
  },
  map: {
    idleHighKpa: 65,
  },
};
