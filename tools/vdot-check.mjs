/**
 * 开发期自检（不随包加载）：node tools/vdot-check.mjs
 *
 * 断言：
 *  1) 比赛成绩 → VDOT 的锚点（含 5K 20:00 → 49.8，不得进位成 50.0）
 *  2) VDOT 50 的 8 项等效成绩
 *  3) VDOT 50 的 E/M/T/I/R 五区端点
 *  4) 公开 VDOT 表 40 格（VDOT 30/40/50/60/85 × 8 距离）逐秒对拍
 *  5) 格式化边界（3:60、1:31:31 等）
 *  6) 输入解析与越界行为
 */

const VO2_A = 0.000104;
const VO2_B = 0.182258;
const VO2_C = -4.6;

const DISTANCES = [
  ['1500', 1500],
  ['mile', 1609.344],
  ['3k', 3000],
  ['5k', 5000],
  ['10k', 10000],
  ['15k', 15000],
  ['hm', 21097.5],
  ['marathon', 42195]
];

const ZONES = [
  ['E', 0.59, 0.74],
  ['M', 0.75, 0.84],
  ['T', 0.83, 0.88],
  ['I', 0.95, 1.0],
  ['R', 1.05, 1.1]
];

const oxygenCost = (v) => VO2_C + VO2_B * v + VO2_A * v * v;
const sustainableFraction = (t) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);

function velocityForOxygen(target) {
  const c = -(target - VO2_C);
  const disc = VO2_B * VO2_B - 4 * VO2_A * c;
  return (-VO2_B + Math.sqrt(disc > 0 ? disc : 0)) / (2 * VO2_A);
}

function vdotFromRace(meters, seconds) {
  const t = seconds / 60;
  return oxygenCost(meters / t) / sustainableFraction(t);
}

function secondsForVdot(vdot, meters) {
  const implied = (t) => oxygenCost(meters / t) / sustainableFraction(t);
  let lo = meters / 600;
  let hi = meters / 50;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (implied(mid) > vdot) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}

function zonePaces(vdot) {
  return ZONES.map(([key, lo, hi]) => ({
    key,
    fast: 60000 / velocityForOxygen(vdot * hi),
    slow: 60000 / velocityForOxygen(vdot * lo)
  }));
}

function formatPace(secondsPerKm) {
  const total = Math.round(secondsPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function formatTime(totalSeconds) {
  const total = Math.round(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = (seconds < 10 ? '0' : '') + seconds;
  if (hours > 0) return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + ss;
  return minutes + ':' + ss;
}

const round1 = (v) => Math.round(v * 10) / 10;

function parseFinishTime(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return null;
  const normalized = raw.replace(/：/g, ':').replace(/\s+/g, '');
  if (!/^[0-9:]+$/.test(normalized)) return NaN;
  const parts = normalized.split(':');
  if (parts.length > 3) return NaN;
  const nums = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i] === '') return NaN;
    const n = Number(parts[i]);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return NaN;
    nums.push(n);
  }
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) {
    if (nums[1] > 59) return NaN;
    return nums[0] * 60 + nums[1];
  }
  if (nums[1] > 59 || nums[2] > 59) return NaN;
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

/* ------------------------------ 断言框架 ------------------------------ */

let failures = 0;
let checks = 0;

function eq(name, actual, expected) {
  checks += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.error('FAIL ' + name + '\n  actual   ' + a + '\n  expected ' + e);
  }
}

/* ------------------------------ 1. 反算锚点 ------------------------------ */

const vdotCases = [
  [[5000, 1200], '49.8', '5K 20:00 不得进位成 50.0'],
  [[5000, 1196], '50.0', '5K 19:56'],
  [[10000, 2480], '50.0', '10K 41:20'],
  [[21097.5, 5491], '50.0', '半马 1:31:31'],
  [[42195, 11440], '50.0', '全马 3:10:40'],
  [[1500, 324], '50.0', '1500m 5:24'],
  [[1609.344, 350], '50.0', '1mi 5:50'],
  [[3000, 693], '50.0', '3K 11:33'],
  [[5000, 1023], '60.0', '5K 17:03'],
  [[5000, 1841], '30.0', '5K 30:41'],
  [[5000, 1320], '44.5', '5K 22:00']
];

for (const [[meters, seconds], expected, label] of vdotCases) {
  eq('vdot ' + label, round1(vdotFromRace(meters, seconds)).toFixed(1), expected);
}

/* ------------------------------ 2. VDOT 50 等效成绩 ------------------------------ */

const gold50 = {
  1500: '5:24',
  1609.344: '5:50',
  3000: '11:33',
  5000: '19:56',
  10000: '41:20',
  15000: '1:03:34',
  21097.5: '1:31:31',
  42195: '3:10:40'
};

for (const [id, meters] of DISTANCES) {
  eq('vdot50 equivalent ' + id, formatTime(secondsForVdot(50, meters)), gold50[meters]);
}

/* ------------------------------ 3. VDOT 50 五区 ------------------------------ */

const zones50 = zonePaces(50);
const expectedZones50 = {
  E: '4:54-5:52',
  M: '4:25-4:50',
  T: '4:15-4:28',
  I: '3:50-4:00',
  R: '3:33-3:41'
};
for (const zone of zones50) {
  eq(
    'vdot50 zone ' + zone.key,
    formatPace(zone.fast) + '-' + formatPace(zone.slow),
    expectedZones50[zone.key]
  );
}

/* ------------------------------ 4. 公开表 40 格 ------------------------------ */

const published = {
  30: ['8:30', '9:10', '17:56', '30:41', '1:03:49', '1:38:21', '2:21:17', '4:49:49'],
  40: ['6:35', '7:07', '14:02', '24:06', '50:01', '1:17:02', '1:50:54', '3:49:37'],
  50: ['5:24', '5:50', '11:33', '19:56', '41:20', '1:03:34', '1:31:31', '3:10:40'],
  60: ['4:35', '4:57', '9:50', '17:03', '35:22', '54:18', '1:18:09', '2:43:22'],
  85: ['3:23', '3:39', '7:14', '12:37', '26:19', '40:18', '57:51', '2:01:15']
};

for (const [vdotText, expectedTimes] of Object.entries(published)) {
  const vdot = Number(vdotText);
  DISTANCES.forEach(([id, meters], index) => {
    eq(
      'published ' + vdot + ' ' + id,
      formatTime(secondsForVdot(vdot, meters)),
      expectedTimes[index]
    );
  });
}

/* ------------------------------ 5. 格式化边界 ------------------------------ */

eq('format 4:00 stays 4:00', formatPace(240), '4:00');
eq('format 239.6 rounds up safely', formatPace(239.6), '4:00');
eq('format 215.999', formatPace(215.999), '3:36');
eq('half marathon is h:mm:ss', formatTime(5491), '1:31:31');
eq('marathon is h:mm:ss', formatTime(11440), '3:10:40');
eq('5k time is m:ss', formatTime(1200), '20:00');
eq('no 3:60 form', /:60$/.test(formatPace(239.999)) === false, true);
for (let s = 0; s < 3600; s += 7) {
  if (/:60/.test(formatPace(s))) {
    eq('never emit :60 for ' + s, formatPace(s), 'x');
  }
}

/* ------------------------------ 6. 解析与边界 ------------------------------ */

eq('parse empty', parseFinishTime(''), null);
eq('parse 20:00', parseFinishTime('20:00'), 1200);
eq('parse 1:31:31', parseFinishTime('1:31:31'), 5491);
eq('parse 20', parseFinishTime('20'), 1200);
eq('parse full-width colon', parseFinishTime('1：31：31'), 5491);
eq('parse 20:75 invalid', Number.isNaN(parseFinishTime('20:75')), true);
eq('parse abc invalid', Number.isNaN(parseFinishTime('abc')), true);
eq('parse 1:75:00 invalid', Number.isNaN(parseFinishTime('1:75:00')), true);

eq('10K 1:30:00 below 20', round1(vdotFromRace(10000, 5400)) < 20, true);
eq('5K 9:00 above 90', round1(vdotFromRace(5000, 540)) > 90, true);

/* ------------------------------ 汇总 ------------------------------ */

if (failures > 0) {
  console.error('\n' + failures + ' / ' + checks + ' checks failed');
  process.exit(1);
}
console.log('OK: ' + checks + ' checks passed');
