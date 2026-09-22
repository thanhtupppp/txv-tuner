export const TXV_CONFIG = Object.freeze({
  defaultRefrigerant: 'R404A',
  defaultValve: 'T2_TE2',
  defaultOpMode: 'live',
  defaultEvapSource: 't2',
  defaultRoomTempC: -20.0,
  defaultTdK: 7.0,
  defaultTargetShK: 6.0,
  defaultEvapTempC: -27.0,
  defaultEvapPressureBar: 2.22,
  defaultSuctionTempC: -21.0,
  liveFallbackT1C: -18.0,
  liveFallbackT3C: -12.0,
  temperatureMinC: -100,
  temperatureMaxC: 100,
  pressureMinBar: 0.01,
  pressureMaxBar: 200,
  adjustmentToleranceK: 0.4,
  defaultMaxTurns: 8,
  turnIncrement: 0.25
});

export const SUPERHEAT_BANDS = Object.freeze({
  lowMaxK: 4,
  optimalMaxK: 8
});
