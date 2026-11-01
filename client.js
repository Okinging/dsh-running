/**
 * 「跑步」页面（左侧栏图标 + 中央主面板页；一期：跑力 / Daniels VDOT + E/M/T/I/R 配速）。
 *
 * 结构：
 *   1) 纯函数：Daniels–Gilbert 方程反算 VDOT、正算等效成绩、五区配速、格式化与解析。
 *   2) 页面组件：输入卡 → 跑力结果卡（等效成绩）→ 五区训练配速 → 脚注。
 *   3) 注册：ctx.locale 字典、sidebar.panellist 图标、main 主面板页。
 *
 * 注意：不 require 任何 @deepseek-ai/dsh-client-* 包；React 来自浏览器模块表。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-running',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'running';
    const PANEL_ID = 'running';
    const STORAGE_KEY = 'dsh.running.v1';

    /* ============================== 常量 ============================== */

    const VO2_A = 0.000104;
    const VO2_B = 0.182258;
    const VO2_C = -4.6;

    const DISTANCES = [
      { id: '1500', meters: 1500, labelKey: 'dist.1500' },
      { id: 'mile', meters: 1609.344, labelKey: 'dist.mile' },
      { id: '3k', meters: 3000, labelKey: 'dist.3k' },
      { id: '5k', meters: 5000, labelKey: 'dist.5k' },
      { id: '10k', meters: 10000, labelKey: 'dist.10k' },
      { id: '15k', meters: 15000, labelKey: 'dist.15k' },
      { id: 'hm', meters: 21097.5, labelKey: 'dist.hm' },
      { id: 'marathon', meters: 42195, labelKey: 'dist.marathon' }
    ];
    const DEFAULT_DISTANCE = '5k';

    /** Daniels 训练强度区间（占 VDOT 的百分比）。 */
    const ZONES = [
      { key: 'E', lo: 0.59, hi: 0.74 },
      { key: 'M', lo: 0.75, hi: 0.84 },
      { key: 'T', lo: 0.83, hi: 0.88 },
      { key: 'I', lo: 0.95, hi: 1.0 },
      { key: 'R', lo: 1.05, hi: 1.1 }
    ];

    /* ============================== 文案 ============================== */

    const ZH = {
      'panel.label': '跑步',
      'page.title': '跑步',
      'page.lead': '跑力：按 Jack Daniels 的 VDOT 方法，用一场比赛成绩反算跑力值，并给出 E/M/T/I/R 五区训练配速。',
      'page.chip': '跑力',
      'input.distance': '比赛距离',
      'input.time': '完赛成绩',
      'input.time.hint': '例：20:00 或 1:31:31',
      'input.pace': '折算配速',
      'input.unit.perKm': '/公里',
      'result.vdot': '跑力 VDOT',
      'result.source': '来源',
      'result.equivalents': '等效成绩',
      'badge.table': '表格范围',
      'badge.extrapolated': '公式外推',
      'zone.title': 'E/M/T/I/R 训练配速',
      'zone.fastToSlow': '快→慢',
      'zone.name.E': '轻松跑',
      'zone.name.M': '马拉松配速',
      'zone.name.T': '乳酸阈',
      'zone.name.I': '间歇',
      'zone.name.R': '重复跑',
      'zone.purpose.E': '有氧基础、恢复与长距离主力，可轻松对话。',
      'zone.purpose.M': '马拉松专项耐力，长距离中的稳态段。',
      'zone.purpose.T': '乳酸阈，约可维持 1 小时比赛的强度。',
      'zone.purpose.I': '最大摄氧量，3–5 分钟一组，间歇约等于工作时间。',
      'zone.purpose.R': '速度与跑步经济性，200–400 米短重复、充分恢复。',
      'dist.1500': '1500 米',
      'dist.mile': '1 英里',
      'dist.3k': '3 公里',
      'dist.5k': '5 公里',
      'dist.10k': '10 公里',
      'dist.15k': '15 公里',
      'dist.hm': '半程马拉松',
      'dist.marathon': '马拉松',
      'state.empty': '输入一场比赛的距离与完赛成绩，得到跑力与五区配速。',
      'state.example': '示例：5K 20:00 → 跑力 49.8',
      'error.format': '请输入 分:秒 或 时:分:秒，例如 20:00 或 1:31:31。',
      'error.tooSlow': '成绩过慢或与距离不匹配，请检查输入。',
      'error.tooFast': '成绩超出模型可信范围（VDOT > 90），请检查输入。',
      'warn.outOfTable': '跑力超出 Daniels 表格范围（30–85），配速为公式外推。',
      'warn.shortRace': '成绩短于 3.5 分钟，属公式外推，仅供参考。',
      'warn.longRace': '成绩超过 4 小时，属公式外推，仅供参考。',
      'footer.source': '依据 Daniels–Gilbert 方程与 Daniels 五区强度口径（%VO2max）。训练参考，不替代教练判断与身体感受。'
    };

    const EN = {
      'panel.label': 'Running',
      'page.title': 'Running',
      'page.lead': 'VDOT: turn one race result into a Daniels VDOT score and the five E/M/T/I/R training paces.',
      'page.chip': 'VDOT',
      'input.distance': 'Race distance',
      'input.time': 'Finish time',
      'input.time.hint': 'e.g. 20:00 or 1:31:31',
      'input.pace': 'Pace',
      'input.unit.perKm': '/km',
      'result.vdot': 'VDOT',
      'result.source': 'From',
      'result.equivalents': 'Equivalent times',
      'badge.table': 'Within table',
      'badge.extrapolated': 'Extrapolated',
      'zone.title': 'E/M/T/I/R training paces',
      'zone.fastToSlow': 'fast→slow',
      'zone.name.E': 'Easy',
      'zone.name.M': 'Marathon',
      'zone.name.T': 'Threshold',
      'zone.name.I': 'Interval',
      'zone.name.R': 'Repetition',
      'zone.purpose.E': 'Aerobic base, recovery and most weekly volume; conversational.',
      'zone.purpose.M': 'Marathon-specific endurance; steady blocks in long runs.',
      'zone.purpose.T': 'Lactate threshold; about the effort you could race for an hour.',
      'zone.purpose.I': 'VO2max; 3–5 minute reps with recovery about equal to work.',
      'zone.purpose.R': 'Speed and economy; short 200–400 m reps with full recovery.',
      'dist.1500': '1500 m',
      'dist.mile': '1 mile',
      'dist.3k': '3 km',
      'dist.5k': '5 km',
      'dist.10k': '10 km',
      'dist.15k': '15 km',
      'dist.hm': 'Half marathon',
      'dist.marathon': 'Marathon',
      'state.empty': 'Enter a race distance and finish time to get your VDOT and five training paces.',
      'state.example': 'Example: 5K 20:00 → VDOT 49.8',
      'error.format': 'Use m:ss or h:mm:ss, for example 20:00 or 1:31:31.',
      'error.tooSlow': 'That result is too slow for the distance. Check the input.',
      'error.tooFast': 'That result is beyond the model range (VDOT > 90). Check the input.',
      'warn.outOfTable': 'VDOT is outside the Daniels table (30–85); paces are extrapolated.',
      'warn.shortRace': 'Results under 3.5 minutes are extrapolated; treat them as indicative.',
      'warn.longRace': 'Results past four hours are extrapolated; treat them as indicative.',
      'footer.source': 'Based on the Daniels–Gilbert equations and Daniels\u2019 %VO2max bands. Training guidance only, not a substitute for a coach.'
    };

    let translate = function (key) {
      return ZH[key] || key;
    };
    function fallbackT(key) {
      return translate(key);
    }

    /* ============================== 算法 ============================== */

    /** 速度（米/分钟）→ 跑步氧耗（ml/kg/min）。Daniels & Gilbert 1979。 */
    function oxygenCost(v) {
      return VO2_C + VO2_B * v + VO2_A * v * v;
    }

    /** 某持续时间（分钟）可维持的 %VO2max。Daniels & Gilbert 1979。 */
    function sustainableFraction(minutes) {
      return (
        0.8 +
        0.1894393 * Math.exp(-0.012778 * minutes) +
        0.2989558 * Math.exp(-0.1932605 * minutes)
      );
    }

    /** 氧耗 → 速度（米/分钟）：解 VO2(v) = target 的二次方程正根。 */
    function velocityForOxygen(target) {
      const c = -(target - VO2_C);
      const disc = VO2_B * VO2_B - 4 * VO2_A * c;
      return (-VO2_B + Math.sqrt(disc > 0 ? disc : 0)) / (2 * VO2_A);
    }

    /** 一场比赛成绩 → VDOT（未取整）。 */
    function vdotFromRace(meters, seconds) {
      const minutes = seconds / 60;
      const v = meters / minutes;
      return oxygenCost(v) / sustainableFraction(minutes);
    }

    /** 给定 VDOT 与距离 → 等效成绩（秒，未取整）。对时间二分。 */
    function secondsForVdot(vdot, meters) {
      const implied = (minutes) => oxygenCost(meters / minutes) / sustainableFraction(minutes);
      let lo = meters / 600;
      let hi = meters / 50;
      let guard = 0;
      while (implied(lo) < vdot && guard < 60) {
        lo = lo / 2;
        guard += 1;
      }
      guard = 0;
      while (implied(hi) > vdot && guard < 120) {
        hi = hi * 2;
        guard += 1;
      }
      for (let i = 0; i < 200; i += 1) {
        const mid = (lo + hi) / 2;
        if (implied(mid) > vdot) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return ((lo + hi) / 2) * 60;
    }

    /** 五区配速（秒/公里）：fast 为强度上沿，slow 为下沿。 */
    function zonePaces(vdot) {
      return ZONES.map((zone) => ({
        key: zone.key,
        lo: zone.lo,
        hi: zone.hi,
        slowSecPerKm: 60000 / velocityForOxygen(vdot * zone.lo),
        fastSecPerKm: 60000 / velocityForOxygen(vdot * zone.hi)
      }));
    }

    function secPerKm(meters, seconds) {
      return seconds / (meters / 1000);
    }

    /* ============================== 格式化 ============================== */

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
      if (hours > 0) {
        return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + ss;
      }
      return minutes + ':' + ss;
    }

    function formatVdot(vdot) {
      return vdot.toFixed(1);
    }

    /** 解析完赛成绩：空 → null；格式非法 → NaN；合法 → 总秒数。 */
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

    /* ============================== 本地记忆 ============================== */

    function readSaved() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return null;
        let distanceId = DEFAULT_DISTANCE;
        for (let i = 0; i < DISTANCES.length; i += 1) {
          if (DISTANCES[i].id === data.distanceId) distanceId = data.distanceId;
        }
        return {
          distanceId,
          timeText: typeof data.timeText === 'string' ? data.timeText : ''
        };
      } catch (err) {
        return null;
      }
    }

    function writeSaved(state) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        /* 本地记忆失败不影响计算 */
      }
    }

    /* ============================== 视图模型 ============================== */

    function distanceById(id) {
      for (let i = 0; i < DISTANCES.length; i += 1) {
        if (DISTANCES[i].id === id) return DISTANCES[i];
      }
      return DISTANCES[3];
    }

    function buildView(distance, parsed) {
      if (parsed === null) return { kind: 'empty' };
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { kind: 'error', errorKey: 'error.format' };
      }
      const raw = vdotFromRace(distance.meters, parsed);
      if (!Number.isFinite(raw)) return { kind: 'error', errorKey: 'error.format' };
      const vdot = Math.round(raw * 10) / 10;
      if (vdot < 20) return { kind: 'error', errorKey: 'error.tooSlow' };
      if (vdot > 90) return { kind: 'error', errorKey: 'error.tooFast' };

      const warnings = [];
      if (vdot < 30 || vdot > 85) warnings.push('warn.outOfTable');
      if (parsed < 210) warnings.push('warn.shortRace');
      if (parsed > 14400) warnings.push('warn.longRace');

      return {
        kind: 'ok',
        vdot,
        seconds: parsed,
        zones: zonePaces(vdot),
        equivalents: DISTANCES.map((item) => ({
          id: item.id,
          labelKey: item.labelKey,
          seconds: secondsForVdot(vdot, item.meters)
        })),
        warnings,
        badgeKey: vdot >= 30 && vdot <= 85 ? 'badge.table' : 'badge.extrapolated'
      };
    }

    /* ============================== 样式 ============================== */

    const CSS = `
.rn-page{height:100%;overflow:auto;box-sizing:border-box;padding:25px 28px 44px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);container-type:inline-size;container-name:running;}
.rn-inner{max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:16px;}
.rn-head{display:flex;flex-direction:column;gap:4px;}
.rn-title{margin:0;font-size:22px;font-weight:600;letter-spacing:-0.2px;}
.rn-lead{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary);max-width:680px;}
.rn-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}
.rn-chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;border:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;}
.rn-chip.rn-chip-active{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);}
.rn-card{background:var(--dsw-alias-bg-layer-1);border:0.5px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;}
.rn-fields{display:grid;grid-template-columns:1fr;gap:10px;}
.rn-field{display:flex;flex-direction:column;gap:4px;}
.rn-label{font-size:12px;color:var(--dsw-alias-label-secondary);}
.rn-select,.rn-input{width:100%;box-sizing:border-box;height:34px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:13px;font-variant-numeric:tabular-nums;}
.rn-select:focus-visible,.rn-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px;}
.rn-input.rn-invalid{border-color:var(--dsw-alias-state-error-primary);}
.rn-hint{font-size:11px;color:var(--dsw-alias-label-secondary);}
.rn-pace{font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}
.rn-pace b{color:var(--dsw-alias-label-primary);font-weight:600;}
.rn-error{font-size:12px;color:var(--dsw-alias-state-error-primary);}
.rn-warn{border-left:2px solid var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:6px 8px;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary);}
.rn-grid{display:grid;grid-template-columns:1fr;gap:16px;align-items:start;}
.rn-col{display:flex;flex-direction:column;gap:16px;min-width:0;}
.rn-vdotline{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.rn-vdotlabel{font-size:12px;color:var(--dsw-alias-label-secondary);}
.rn-vdotnum{font-size:44px;line-height:1.05;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-0.8px;margin-top:2px;}
.rn-badge{font-size:11px;padding:2px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.rn-badge.rn-badge-warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);}
.rn-source{font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}
.rn-h3{margin:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);}
.rn-h3 span{font-weight:400;}
.rn-eq{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px 14px;}
.rn-eq-row{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:0.5px solid var(--dsw-alias-border-l1);min-width:0;}
.rn-eq-key{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.rn-eq-val{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;}
.rn-zones{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:10px;}
.rn-zone{border:0.5px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:4px;background:var(--dsw-alias-bg-layer-2);min-width:0;}
.rn-zone-head{display:flex;align-items:baseline;gap:6px;}
.rn-zone-key{font-weight:700;font-size:13px;min-width:14px;color:var(--dsw-alias-brand-primary);}
.rn-zone-name{font-weight:600;font-size:12px;}
.rn-zone-pct{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}
.rn-zone-pace{font-size:20px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-0.3px;}
.rn-zone-unit{font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary);margin-left:2px;}
.rn-zone-purpose{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary);}
.rn-emptycard{background:var(--dsw-alias-bg-layer-1);border:0.5px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:28px 18px;text-align:center;font-size:13px;color:var(--dsw-alias-label-secondary);}
.rn-emptycard .rn-example{display:block;margin-top:6px;font-variant-numeric:tabular-nums;}
.rn-foot{margin:4px 0 0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);}
.rn-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
@container running (min-width:560px){.rn-fields{grid-template-columns:1fr 1fr;}}
@container running (min-width:780px){.rn-grid{grid-template-columns:minmax(0,360px) minmax(0,1fr);}.rn-vdotnum{font-size:52px;}}
`;

    /* ============================== 页面组件 ============================== */

    function RunningPage(props) {
      const p = props || {};
      const t = typeof p.t === 'function' ? p.t : fallbackT;

      const saved = React.useMemo(readSaved, []);
      const [distanceId, setDistanceId] = React.useState(
        saved ? saved.distanceId : DEFAULT_DISTANCE
      );
      const [timeText, setTimeText] = React.useState(saved ? saved.timeText : '');

      React.useEffect(() => {
        writeSaved({ distanceId, timeText });
      }, [distanceId, timeText]);

      const distance = distanceById(distanceId);
      const parsed = React.useMemo(() => parseFinishTime(timeText), [timeText]);
      const view = React.useMemo(() => buildView(distance, parsed), [distance, parsed]);

      const paceLine = (function () {
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        return formatPace(secPerKm(distance.meters, parsed));
      })();

      const errorNode =
        view.kind === 'error'
          ? h('div', { className: 'rn-error', role: 'alert' }, t(view.errorKey))
          : null;

      const warningNodes =
        view.kind === 'ok' && view.warnings.length
          ? view.warnings.map((key) => h('div', { key, className: 'rn-warn' }, t(key)))
          : null;

      const inputCard = h(
        'section',
        { className: 'rn-card' },
        h(
          'div',
          { className: 'rn-fields' },
          h(
            'label',
            { className: 'rn-field' },
            h('span', { className: 'rn-label' }, t('input.distance')),
            h(
              'select',
              {
                className: 'rn-select',
                value: distanceId,
                onChange: (event) => setDistanceId(event.target.value),
                'aria-label': t('input.distance')
              },
              DISTANCES.map((item) =>
                h('option', { key: item.id, value: item.id }, t(item.labelKey))
              )
            )
          ),
          h(
            'label',
            { className: 'rn-field' },
            h('span', { className: 'rn-label' }, t('input.time')),
            h('input', {
              className: 'rn-input' + (view.kind === 'error' ? ' rn-invalid' : ''),
              type: 'text',
              inputMode: 'numeric',
              autoComplete: 'off',
              spellCheck: false,
              placeholder: '20:00',
              value: timeText,
              onChange: (event) => setTimeText(event.target.value),
              'aria-invalid': view.kind === 'error' ? 'true' : 'false',
              'aria-label': t('input.time')
            })
          )
        ),
        h('div', { className: 'rn-hint' }, t('input.time.hint')),
        paceLine
          ? h(
              'div',
              { className: 'rn-pace' },
              t('input.pace') + ' ',
              h('b', null, paceLine),
              ' ',
              t('input.unit.perKm')
            )
          : null,
        errorNode
      );

      const headerNode = h(
        'header',
        { className: 'rn-head' },
        h('h1', { className: 'rn-title' }, t('page.title')),
        h('p', { className: 'rn-lead' }, t('page.lead')),
        h(
          'div',
          { className: 'rn-chips' },
          h('span', { className: 'rn-chip rn-chip-active' }, t('page.chip'))
        )
      );

      const emptyNode =
        view.kind === 'empty'
          ? h(
              'div',
              { className: 'rn-emptycard' },
              t('state.empty'),
              h('span', { className: 'rn-example' }, t('state.example'))
            )
          : null;

      const resultCard =
        view.kind === 'ok'
          ? h(
              'section',
              { className: 'rn-card' },
              h(
                'div',
                { className: 'rn-vdotline' },
                h(
                  'div',
                  null,
                  h('div', { className: 'rn-vdotlabel' }, t('result.vdot')),
                  h('div', { className: 'rn-vdotnum' }, formatVdot(view.vdot))
                ),
                h(
                  'span',
                  {
                    className:
                      'rn-badge' + (view.badgeKey === 'badge.extrapolated' ? ' rn-badge-warn' : '')
                  },
                  t(view.badgeKey)
                )
              ),
              h(
                'div',
                { className: 'rn-source' },
                t('result.source') +
                  ' · ' +
                  t(distance.labelKey) +
                  ' ' +
                  formatTime(view.seconds)
              ),
              warningNodes,
              h(
                'p',
                { className: 'rn-sr', 'aria-live': 'polite' },
                t('result.vdot') + ' ' + formatVdot(view.vdot)
              )
            )
          : null;

      const equivalentsCard =
        view.kind === 'ok'
          ? h(
              'section',
              { className: 'rn-card' },
              h('h3', { className: 'rn-h3' }, t('result.equivalents')),
              h(
                'div',
                { className: 'rn-eq' },
                view.equivalents.map((item) =>
                  h(
                    'div',
                    { key: item.id, className: 'rn-eq-row' },
                    h('span', { className: 'rn-eq-key' }, t(item.labelKey)),
                    h('span', { className: 'rn-eq-val' }, formatTime(item.seconds))
                  )
                )
              )
            )
          : null;

      const zoneCard =
        view.kind === 'ok'
          ? h(
              'section',
              { className: 'rn-card' },
              h(
                'h3',
                { className: 'rn-h3' },
                t('zone.title'),
                h('span', null, '（' + t('zone.fastToSlow') + '）')
              ),
              h(
                'div',
                { className: 'rn-zones' },
                view.zones.map((zone) =>
                  h(
                    'div',
                    { key: zone.key, className: 'rn-zone' },
                    h(
                      'div',
                      { className: 'rn-zone-head' },
                      h('span', { className: 'rn-zone-key' }, zone.key),
                      h('span', { className: 'rn-zone-name' }, t('zone.name.' + zone.key)),
                      h(
                        'span',
                        { className: 'rn-zone-pct' },
                        Math.round(zone.lo * 100) +
                          '–' +
                          Math.round(zone.hi * 100) +
                          '%'
                      )
                    ),
                    h(
                      'div',
                      {
                        className: 'rn-zone-pace',
                        title:
                          formatPace(zone.fastSecPerKm) +
                          ' 至 ' +
                          formatPace(zone.slowSecPerKm) +
                          ' 每公里'
                      },
                      formatPace(zone.fastSecPerKm) + '–' + formatPace(zone.slowSecPerKm),
                      h('span', { className: 'rn-zone-unit' }, t('input.unit.perKm'))
                    ),
                    h(
                      'div',
                      { className: 'rn-zone-purpose' },
                      t('zone.purpose.' + zone.key)
                    )
                  )
                )
              )
            )
          : null;

      const body =
        view.kind === 'ok'
          ? h(
              'div',
              { className: 'rn-grid' },
              h('div', { className: 'rn-col' }, resultCard),
              h('div', { className: 'rn-col' }, equivalentsCard, zoneCard)
            )
          : emptyNode;

      return h(
        'div',
        { className: 'rn-page' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'rn-inner' },
          headerNode,
          inputCard,
          body,
          h('p', { className: 'rn-foot' }, t('footer.source'))
        )
      );
    }

    /* ============================== 左侧栏图标 ============================== */

    function RunningGlyph(props) {
      const p = props || {};
      const size = typeof p.size === 'number' ? p.size : 20;
      const active = p.active === true;
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: active ? 2 : 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' }
        },
        h('circle', { cx: 15.4, cy: 4.6, r: 2.1 }),
        h('path', { d: 'M13.4 8.3 11 12.4l2.9 2.3' }),
        h('path', { d: 'M11 12.4 6.2 13.6 4.2 18' }),
        h('path', { d: 'M13.9 14.7l3.4 1.9 1.4 4.4' }),
        h('path', { d: 'M13.6 9.4l3.6 1.4 1.2 2.5' })
      );
    }

    /* ============================== 注册 ============================== */

    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh: ZH,
            en: EN
          }),
        'dsh-running: dictionaries'
      );
      translate = ctx.locale.bind(NS);

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: PANEL_ID,
                order: 30,
                label: () => translate('panel.label'),
                locale: NS
              },
              RunningGlyph
            )
          ),
        'dsh-running: sidebar entry'
      );

      ctx.effect(
        () =>
          ctx.slots.inject('main', () =>
            ctx.slots.register(
              {
                name: 'main',
                key: PANEL_ID,
                locale: NS
              },
              RunningPage
            )
          ),
        'dsh-running: main page'
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply
    };
  }
});
