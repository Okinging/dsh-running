/**
 * 开发期渲染冒烟（不随包加载）：node tools/component-smoke.cjs
 *
 * 用最小 React 钩子桩加载 client.js，执行注册并渲染页面组件，
 * 覆盖：空态 / 有效值 / 错误态 / 越界 / 40 格锚点中的典型值。
 * 这样在没有浏览器控制的环境里，仍能发现组件层的运行时错误。
 */
const fs = require('fs');
const path = require('path');

let failures = 0;
let checks = 0;

function eq(name, actual, expected) {
  checks += 1;
  if (actual !== expected) {
    failures += 1;
    console.error('FAIL ' + name + '\n  actual   ' + actual + '\n  expected ' + expected);
  }
}

function renderWith(saved) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8');
  const captured = {};

  const ReactStub = {
    createElement(type, props, ...children) {
      const merged = Object.assign({}, props || {});
      if (children.length === 1) merged.children = children[0];
      else if (children.length > 1) merged.children = children;
      return { type, props: merged };
    },
    useState(initial) {
      const value = typeof initial === 'function' ? initial() : initial;
      return [value, function noop() {}];
    },
    useMemo(factory) {
      return factory();
    },
    useEffect() {}
  };

  const windowStub = {
    __ModuleLoader__: {
      load(definition) {
        captured.definition = definition;
      }
    },
    localStorage: {
      getItem() {
        return saved == null ? null : JSON.stringify(saved);
      },
      setItem() {}
    }
  };

  // client.js 顶层只访问 window；require 由 factory 内部使用
  const load = new Function('window', source);
  load(windowStub);

  const api = captured.definition.factory(function requireStub(name) {
    if (name === 'react') return ReactStub;
    throw new Error('unexpected require: ' + name);
  });

  const ctx = {
    effect(effect) {
      const dispose = effect();
      return typeof dispose === 'function' ? dispose : function noop() {};
    },
    locale: {
      register(namespace, dictionaries) {
        captured.namespace = namespace;
        captured.dictionaries = dictionaries;
        return function dispose() {};
      },
      bind() {
        return function translate(key) {
          return key;
        };
      }
    },
    sidebarRightTabs: {
      register(definition) {
        captured.tabType = definition;
        return function dispose() {};
      }
    },
    slots: {
      inject(ownerKey, callback) {
        captured.ownerKeys = captured.ownerKeys || [];
        captured.ownerKeys.push(ownerKey);
        callback();
        return function dispose() {};
      },
      register(options, component) {
        captured.slots = captured.slots || {};
        captured.slots[options.name] = { options, component };
        return function dispose() {};
      }
    }
  };

  api.apply(ctx);

  const mainEntry = captured.slots.main;
  const tree = mainEntry.component({});
  const collected = { classes: [], texts: [], tags: [] };
  (function walk(node) {
    if (node == null || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'string' || typeof node === 'number') {
      collected.texts.push(String(node));
      return;
    }
    if (typeof node === 'object') {
      if (node.type) collected.tags.push(node.type);
      const props = node.props || {};
      if (typeof props.className === 'string') collected.classes.push(props.className);
      if (props.children !== undefined) walk(props.children);
    }
  })(tree);

  return {
    captured,
    tree,
    glyph: captured.slots['sidebar.panellist'].component({ size: 18, active: true }),
    classes: collected.classes.join(' '),
    text: collected.texts.join('|'),
    tags: collected.tags
  };
}

/* ---------- 注册形状 ---------- */

const first = renderWith({ distanceId: '5k', timeText: '20:00' });
const panellist = first.captured.slots['sidebar.panellist'];
const main = first.captured.slots.main;
eq('module id', first.captured.definition.id, '@local/dsh-running');
eq('owner keys', first.captured.ownerKeys.join(','), 'sidebar.panellist,main');
eq('panel id', panellist.options.id, 'running');
eq('panel order', panellist.options.order, 30);
eq('panel label', panellist.options.label(), 'panel.label');
eq('main key', main.options.key, 'running');
eq('main locale', main.options.locale, 'running');
eq('glyph size', first.glyph.props.width, 18);
eq('glyph active stroke', first.glyph.props.strokeWidth, 2);
eq('locale ns', first.captured.namespace, 'running');
eq('zh dictionary', typeof first.captured.dictionaries.zh['panel.label'], 'string');
eq('en dictionary', typeof first.captured.dictionaries.en['panel.label'], 'string');
eq('eight distance options', (first.text.match(/dist\./g) || []).length >= 8, true);

/* ---------- 有效值：5K 20:00 → 49.8 ---------- */

eq('renders page root', first.classes.indexOf('rn-page') >= 0, true);
eq('shows vdot 49.8', first.text.indexOf('49.8') >= 0, true);
eq('shows easy band', first.text.indexOf('4:54–5:53') >= 0, true);
eq('shows threshold band', first.text.indexOf('4:16–4:28') >= 0, true);
eq('shows repetition band', first.text.indexOf('3:34–3:42') >= 0, true);
eq('shows table badge', first.text.indexOf('badge.table') >= 0, true);
eq('shows source time', first.text.indexOf('20:00') >= 0, true);
eq('equivalent 5k', first.text.indexOf('20:00') >= 0, true);

/* ---------- 空态 ---------- */

const empty = renderWith(null);
eq('empty state', empty.text.indexOf('state.empty') >= 0, true);
eq('empty example', empty.text.indexOf('state.example') >= 0, true);

/* ---------- 错误态：20:75 ---------- */

const bad = renderWith({ distanceId: '5k', timeText: '20:75' });
eq('format error', bad.text.indexOf('error.format') >= 0, true);
eq('no result on error', bad.classes.split(' ').indexOf('rn-vdotnum') >= 0, false);

/* ---------- 越界：5K 9:00 ---------- */

const tooFast = renderWith({ distanceId: '5k', timeText: '9:00' });
eq('too fast error', tooFast.text.indexOf('error.tooFast') >= 0, true);

/* ---------- 外推警告：全马 6:00:00 ---------- */

const slow = renderWith({ distanceId: 'marathon', timeText: '6:00:00' });
eq('warn out of table', slow.text.indexOf('warn.outOfTable') >= 0, true);
eq('warn long race', slow.text.indexOf('warn.longRace') >= 0, true);
eq('slow marathon vdot', slow.text.indexOf('22.7') >= 0, true);

/* ---------- 另一档：半马 1:31:31 → 50.0 ---------- */

const half = renderWith({ distanceId: 'hm', timeText: '1:31:31' });
eq('half vdot 50.0', half.text.indexOf('50.0') >= 0, true);
eq('half equivalent marathon', half.text.indexOf('3:10:40') >= 0, true);

if (failures > 0) {
  console.error('\n' + failures + ' / ' + checks + ' checks failed');
  process.exit(1);
}
console.log('OK: ' + checks + ' smoke checks passed');
