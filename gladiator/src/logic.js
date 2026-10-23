// Гладиатор: шахматки — чистая логика без интерфейса.
// Подключается обычным <script> (создаёт globalThis.GL) и импортируется в тестах Node.
(function () {
  'use strict';

  const SCHEMA_VERSION = 2;
  // «Цена» каждой лишней сетки в разбивке (в кг² разброса веса): чем больше, тем реже сетки по 3.
  const GRID_COST = 1;
  const LETTERS = ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'к', 'л', 'м'];
  const MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];

  let idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + idCounter.toString(36) +
      Math.random().toString(36).slice(2, 6);
  }

  function defaultState() {
    return {
      schema: SCHEMA_VERSION,
      settings: {
        title: 'Первенство спортивного клуба Гладиатор',
        date: '',
        minSize: 3,
        maxSize: 5,
        mats: 3,
        levels: ['Новичок', 'Средний', 'Опытный'],
        formats: ['На коленках', 'В стойке'],
        branches: [],
        coaches: [],
        parts: [
          { id: 'p1', name: 'Часть 1', yearFrom: 2020, yearTo: 2022, format: 'На коленках', weightMode: 'float', limits: [], maxDiffKg: null },
          { id: 'p2', name: 'Часть 2', yearFrom: 2017, yearTo: 2019, format: 'В стойке', weightMode: 'float', limits: [], maxDiffKg: null },
          { id: 'p3', name: 'Часть 3', yearFrom: 2014, yearTo: 2016, format: 'В стойке', weightMode: 'float', limits: [], maxDiffKg: null },
          { id: 'p4', name: 'Часть 4', yearFrom: null, yearTo: null, format: 'В стойке', weightMode: 'float', limits: [], maxDiffKg: null },
        ],
      },
      participants: [],
      grids: [],
      builtParts: {},
      roster: [],
    };
  }

  // Старые файлы турнира приводим к текущему формату.
  function migrate(data) {
    if (!data || typeof data !== 'object') throw new Error('Файл не похож на турнир');
    if (!Array.isArray(data.participants) || !data.settings) throw new Error('В файле нет списка участников или настроек');
    if ((data.schema || 0) > SCHEMA_VERSION) throw new Error('Файл создан более новой версией приложения');
    const base = defaultState();
    const state = {
      schema: SCHEMA_VERSION,
      settings: Object.assign({}, base.settings, data.settings),
      participants: data.participants,
      grids: Array.isArray(data.grids) ? data.grids : [],
      builtParts: data.builtParts || {},
      roster: Array.isArray(data.roster) ? data.roster : [],
    };
    // Версия 1: три формата по умолчанию → два («На коленках», «В стойке»).
    if ((data.schema || 1) < 2 && JSON.stringify(state.settings.formats) === JSON.stringify(['На коленках без курток', 'На коленках', 'В стойке'])) {
      const used = state.settings.parts.some((p) => p.format === 'На коленках без курток') || state.grids.some((g) => g.format === 'На коленках без курток');
      if (!used) state.settings.formats = base.settings.formats.slice();
    }
    return state;
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  // ---------- Даты и подписи ----------

  function birthYear(p) {
    const y = parseInt(String(p.birthDate || '').slice(0, 4), 10);
    return Number.isFinite(y) ? y : null;
  }

  function formatRuDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '«___» __________ 20__ г.';
    return '«' + parseInt(m[3], 10) + '» ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1] + ' г.';
  }

  function formatBirth(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }

  function toRoman(n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    let x = n;
    for (const [v, s] of map) while (x >= v) { out += s; x -= v; }
    return out;
  }

  function fullName(p) {
    return (p.lastName + ' ' + p.firstName).trim();
  }

  function partYearsLabel(part) {
    if (part.yearFrom && part.yearTo) {
      const a = Math.min(part.yearFrom, part.yearTo);
      const b = Math.max(part.yearFrom, part.yearTo);
      return a === b ? String(a) : a + '-' + b;
    }
    return '';
  }

  // ---------- Части и группы ----------

  function partInRange(part, year) {
    if (!part.yearFrom || !part.yearTo || year == null) return false;
    const a = Math.min(part.yearFrom, part.yearTo);
    const b = Math.max(part.yearFrom, part.yearTo);
    return year >= a && year <= b;
  }

  // Участник может быть вручную закреплён за частью (p.partId), иначе — по году рождения.
  function partOf(state, p) {
    if (p.partId && state.settings.parts.some((x) => x.id === p.partId)) return p.partId;
    const y = birthYear(p);
    const part = state.settings.parts.find((x) => partInRange(x, y));
    return part ? part.id : null;
  }

  function getPart(state, partId) {
    return state.settings.parts.find((x) => x.id === partId) || null;
  }

  function activeOfPart(state, partId) {
    return state.participants.filter((p) => !p.withdrawn && partOf(state, p) === partId);
  }

  function sortedLimits(part) {
    return (part.limits || []).map(Number).filter((x) => x > 0).sort((a, b) => a - b);
  }

  // Граница фиксированной категории: наименьшая «до X», куда помещается вес; тяжелее всех — «св. последней».
  function fixedLimit(part, weight) {
    const limits = sortedLimits(part);
    if (!limits.length) return null;
    for (const l of limits) if (weight <= l) return l;
    return -limits[limits.length - 1];
  }

  function groupKey(part, p) {
    const parts = [p.sex, p.level || ''];
    if (part.weightMode === 'fixed' && sortedLimits(part).length) parts.push(String(fixedLimit(part, p.weight)));
    return parts.join('|');
  }

  // ---------- Разбивка по весу ----------

  // Делим отсортированный по весу список на подряд идущие сетки размером min..max так,
  // чтобы разброс веса внутри сеток был минимальным (динамическое программирование).
  function partitionByWeight(items, min, max, maxDiffKg) {
    const n = items.length;
    if (n === 0) return [];
    if (n < min) return [items.slice()];
    const w = items.map((x) => x.weight);
    const INF = Number.POSITIVE_INFINITY;
    const dp = new Array(n + 1).fill(INF);
    const cut = new Array(n + 1).fill(-1);
    dp[0] = 0;
    for (let i = min; i <= n; i += 1) {
      for (let k = min; k <= max && k <= i; k += 1) {
        const j = i - k;
        if (dp[j] === INF) continue;
        const range = w[i - 1] - w[j];
        let cost = range * range;
        if (maxDiffKg && range > maxDiffKg) cost += 1000 + (range - maxDiffKg) * 100;
        cost += GRID_COST + Math.abs(k - 4) * 0.01; // меньше лишних сеток; при равенстве — ближе к 4
        if (dp[j] + cost < dp[i]) { dp[i] = dp[j] + cost; cut[i] = j; }
      }
    }
    if (dp[n] === INF) return [items.slice()];
    const chunks = [];
    let i = n;
    while (i > 0) { const j = cut[i]; chunks.unshift(items.slice(j, i)); i = j; }
    return chunks;
  }

  function byWeight(a, b) {
    return a.weight - b.weight || fullName(a).localeCompare(fullName(b), 'ru');
  }

  function makeGrid(partId, part, members) {
    const first = members[0];
    return {
      id: uid('g'),
      partId,
      sex: first ? first.sex : 'М',
      level: first ? first.level || '' : '',
      format: part.format || '',
      members: members.map((m) => m.id),
      mat: null,
      matManual: false,
      locked: false,
      printedAt: null,
      dirtyAfterPrint: false,
      labelOverride: '',
    };
  }

  // Группа меньше минимума сетки (например, 2 девочки-новичка) объединяется с ближайшим
  // уровнем того же пола (и той же весовой категории) — без «хвостов» из 1–2 человек.
  function mergeSmallGroups(state, part, groups) {
    const levels = state.settings.levels;
    const min = state.settings.minSize;
    const fixed = part.weightMode === 'fixed' && sortedLimits(part).length;
    const info = (g) => ({ sex: g[0].sex, lvl: levels.indexOf(g[0].level), cat: fixed ? fixedLimit(part, g[0].weight) : null, w: avg(g.map((p) => p.weight)) });
    const list = groups.slice();
    const keep = new Set();
    for (;;) {
      const i = list.findIndex((g) => g.length < min && !keep.has(g));
      if (i < 0) break;
      const a = info(list[i]);
      let best = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      list.forEach((g, j) => {
        if (j === i) return;
        const b = info(g);
        if (b.sex !== a.sex || b.cat !== a.cat) return;
        const score = Math.abs(b.lvl - a.lvl) * 1000 + Math.abs(b.w - a.w);
        if (score < bestScore) { bestScore = score; best = j; }
      });
      if (best < 0) { keep.add(list[i]); continue; }
      list[best] = list[best].concat(list[i]);
      list.splice(i, 1);
    }
    return list;
  }

  // Порядок сеток: мальчики, девочки; уровни как в настройках; по возрастанию веса.
  function sortGrids(state, grids) {
    const pm = participantsMap(state);
    const levels = state.settings.levels;
    const minW = (g) => Math.min.apply(null, gridWeights(state, g, pm).concat(Infinity));
    return grids.slice().sort((a, b) =>
      (a.sex === b.sex ? 0 : a.sex === 'Ж' ? 1 : -1) ||
      (levels.indexOf(a.level) - levels.indexOf(b.level)) ||
      (minW(a) - minW(b)));
  }

  function gridsOfPart(state, partId) {
    return state.grids.filter((g) => g.partId === partId);
  }

  // Собрать сетки части заново. Закреплённые сетки не трогаем.
  function buildPart(state, partId) {
    const part = getPart(state, partId);
    if (!part) return state;
    const s = state.settings;
    const locked = gridsOfPart(state, partId).filter((g) => g.locked);
    const inLocked = new Set(locked.flatMap((g) => g.members));
    const pool = activeOfPart(state, partId).filter((p) => !inLocked.has(p.id));
    const groups = new Map();
    for (const p of pool) {
      const key = groupKey(part, p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const created = [];
    for (const list of mergeSmallGroups(state, part, Array.from(groups.values()))) {
      list.sort(byWeight);
      for (const chunk of partitionByWeight(list, s.minSize, s.maxSize, part.maxDiffKg)) {
        created.push(makeGrid(partId, part, chunk));
      }
    }
    state.grids = state.grids.filter((g) => g.partId !== partId).concat(sortGrids(state, locked.concat(created)));
    state.builtParts[partId] = true;
    distributeMats(state, partId, false);
    return state;
  }

  // ---------- Подписи весовой категории ----------

  function participantsMap(state) {
    const m = new Map();
    for (const p of state.participants) m.set(p.id, p);
    return m;
  }

  function gridWeights(state, grid, pm) {
    const map = pm || participantsMap(state);
    return grid.members.map((id) => map.get(id)).filter(Boolean).map((p) => p.weight);
  }

  function gridBase(state, grid, pm) {
    const part = getPart(state, grid.partId);
    const weights = gridWeights(state, grid, pm);
    if (!weights.length) return '';
    const max = Math.max.apply(null, weights);
    if (part && part.weightMode === 'fixed' && sortedLimits(part).length) {
      const l = fixedLimit(part, max);
      return l < 0 ? 'св. ' + -l : String(l);
    }
    return String(Math.ceil(max - 1e-9));
  }

  // Подписи для всех сеток части: «24», а если сеток с одинаковым числом несколько — «24а», «24б»…
  function gridLabels(state, partId) {
    const pm = participantsMap(state);
    const grids = gridsOfPart(state, partId);
    const buckets = new Map();
    for (const g of grids) {
      const base = gridBase(state, g, pm);
      const key = (g.format || '') + '|' + base;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ g, base, avg: avg(gridWeights(state, g, pm)) });
    }
    const labels = {};
    for (const list of buckets.values()) {
      list.sort((a, b) => a.avg - b.avg || a.g.id.localeCompare(b.g.id));
      list.forEach((x, i) => {
        const auto = list.length > 1 ? x.base + (LETTERS[i] || String(i + 1)) : x.base;
        labels[x.g.id] = x.g.labelOverride ? x.g.labelOverride : auto;
      });
    }
    return labels;
  }

  function avg(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  // ---------- Круги ----------

  // Круговая система методом «круга»: №1 стоит на месте, остальные вращаются.
  // Для 4 участников даёт ровно порядок с бланка: 1–2, 4–3 / 1–3, 2–4 / 1–4, 3–2.
  function roundRobin(n) {
    if (n < 2) return [];
    const BYE = 0;
    const rot = [];
    for (let i = 2; i <= n; i += 1) rot.push(i);
    if (n % 2 === 1) rot.push(BYE);
    const m = rot.length;
    const rounds = [];
    for (let r = 0; r < m; r += 1) {
      const pairs = [[1, rot[0]]];
      for (let k = 1; k <= (m - 1) / 2; k += 1) pairs.push([rot[m - k], rot[k]]);
      rounds.push(pairs.filter(([a, b]) => a !== BYE && b !== BYE));
      rot.push(rot.shift());
    }
    return rounds;
  }

  function bouts(n) {
    return (n * (n - 1)) / 2;
  }

  // ---------- Ковры ----------

  // Равномерно по числу схваток: крупные сетки первыми, каждую — на наименее загруженный ковёр.
  // Сетки, перенесённые вручную, остаются на своём ковре.
  function distributeMats(state, partId, keepManual) {
    const mats = Math.max(1, state.settings.mats | 0);
    const grids = gridsOfPart(state, partId);
    const load = new Array(mats + 1).fill(0);
    const free = [];
    for (const g of grids) {
      if (keepManual !== false && g.matManual && g.mat >= 1 && g.mat <= mats) load[g.mat] += bouts(g.members.length);
      else free.push(g);
    }
    free.sort((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id));
    for (const g of free) {
      let best = 1;
      for (let m = 2; m <= mats; m += 1) if (load[m] < load[best]) best = m;
      if (g.mat !== best && g.printedAt) g.dirtyAfterPrint = true;
      g.mat = best;
      g.matManual = false;
      load[best] += bouts(g.members.length);
    }
    return state;
  }

  function matLoads(state, partId) {
    const mats = Math.max(1, state.settings.mats | 0);
    const load = new Array(mats + 1).fill(0);
    for (const g of gridsOfPart(state, partId)) if (g.mat >= 1 && g.mat <= mats) load[g.mat] += bouts(g.members.length);
    return load.slice(1);
  }

  // ---------- Изменения после разбивки ----------

  function gridOfParticipant(state, pid) {
    return state.grids.find((g) => g.members.includes(pid)) || null;
  }

  function touch(grid) {
    if (grid.printedAt) grid.dirtyAfterPrint = true;
  }

  // Убрать участника из его сетки (снятие, удаление, смена данных). Возвращает id затронутой сетки.
  function detach(state, pid) {
    const g = gridOfParticipant(state, pid);
    if (!g) return null;
    g.members = g.members.filter((x) => x !== pid);
    touch(g);
    if (!g.members.length) state.grids = state.grids.filter((x) => x !== g);
    return g.id;
  }

  // Поставить участника в подходящую сетку его части, не трогая остальные.
  // Если подходящей сетки с местом нет — пересобираем только его группу (пол, уровень, категория).
  function placeIncremental(state, pid) {
    const p = state.participants.find((x) => x.id === pid);
    if (!p || p.withdrawn) return [];
    const partId = partOf(state, p);
    if (!partId || !state.builtParts[partId]) return [];
    const part = getPart(state, partId);
    const s = state.settings;
    const key = groupKey(part, p);
    const pm = participantsMap(state);
    const sameGroup = gridsOfPart(state, partId).filter((g) => {
      const first = pm.get(g.members[0]);
      return first && groupKey(part, first) === key;
    });
    let best = null;
    let bestRange = Number.POSITIVE_INFINITY;
    for (const g of sameGroup) {
      if (g.locked || g.members.length >= s.maxSize) continue;
      const ws = gridWeights(state, g, pm).concat(p.weight);
      const range = Math.max.apply(null, ws) - Math.min.apply(null, ws);
      if (range < bestRange) { bestRange = range; best = g; }
    }
    const tolerance = part.maxDiffKg || Math.max(2, typicalRange(state, sameGroup, pm) * 1.5);
    if (best && bestRange <= tolerance) {
      best.members.push(pid);
      touch(best);
      return [best.id];
    }
    return rebuildGroup(state, partId, key);
  }

  function typicalRange(state, grids, pm) {
    const ranges = grids.filter((g) => g.members.length > 1).map((g) => {
      const ws = gridWeights(state, g, pm);
      return Math.max.apply(null, ws) - Math.min.apply(null, ws);
    });
    return ranges.length ? avg(ranges) : 0;
  }

  // Пересобрать одну группу части; закреплённые сетки не трогаем. Ковры для новых сеток подбираются.
  function rebuildGroup(state, partId, key) {
    const part = getPart(state, partId);
    const s = state.settings;
    const pm = participantsMap(state);
    const old = gridsOfPart(state, partId).filter((g) => {
      const first = pm.get(g.members[0]);
      return !g.locked && first && groupKey(part, first) === key;
    });
    const lockedIds = new Set(gridsOfPart(state, partId).filter((g) => g.locked).flatMap((g) => g.members));
    const assigned = new Set(state.grids.flatMap((g) => g.members));
    const oldIds = new Set(old.flatMap((g) => g.members));
    const pool = activeOfPart(state, partId).filter((p) =>
      groupKey(part, p) === key && !lockedIds.has(p.id) && (oldIds.has(p.id) || !assigned.has(p.id)));
    const wasPrinted = old.some((g) => g.printedAt);
    const oldMats = old.map((g) => g.mat).filter(Boolean);
    state.grids = state.grids.filter((g) => !old.includes(g));
    const created = partitionByWeight(pool.sort(byWeight), s.minSize, s.maxSize, part.maxDiffKg)
      .map((chunk) => makeGrid(partId, part, chunk));
    const loads = matLoads(state, partId);
    created.forEach((g, i) => {
      if (oldMats[i]) g.mat = oldMats[i];
      else {
        let best = 0;
        for (let m = 1; m < loads.length; m += 1) if (loads[m] < loads[best]) best = m;
        g.mat = best + 1;
      }
      loads[g.mat - 1] += bouts(g.members.length);
      if (wasPrinted) { g.printedAt = 'перестроена'; g.dirtyAfterPrint = true; }
    });
    state.grids = state.grids.concat(created);
    return created.map((g) => g.id).concat(old.map((g) => g.id));
  }

  // ---------- Контроль целостности ----------

  function integrity(state) {
    const s = state.settings;
    const active = state.participants.filter((p) => !p.withdrawn);
    const count = new Map();
    for (const g of state.grids) for (const id of g.members) count.set(id, (count.get(id) || 0) + 1);
    const activeIds = new Set(active.map((p) => p.id));
    const noPart = active.filter((p) => !partOf(state, p));
    const unassigned = active.filter((p) => {
      const partId = partOf(state, p);
      return partId && state.builtParts[partId] && !count.has(p.id);
    });
    const notBuilt = active.filter((p) => {
      const partId = partOf(state, p);
      return partId && !state.builtParts[partId];
    });
    const duplicates = Array.from(count.entries()).filter(([, c]) => c > 1).map(([id]) => id);
    const ghosts = state.grids.flatMap((g) => g.members.filter((id) => !activeIds.has(id)));
    const small = state.grids.filter((g) => g.members.length < s.minSize);
    const big = state.grids.filter((g) => g.members.length > s.maxSize);
    const reprint = state.grids.filter((g) => g.dirtyAfterPrint);
    const notPrinted = state.grids.filter((g) => !g.printedAt);
    const inGrids = active.filter((p) => count.has(p.id)).length;
    const problems = noPart.length + unassigned.length + duplicates.length + ghosts.length + small.length + big.length;
    return { total: active.length, inGrids, noPart, unassigned, notBuilt, duplicates, ghosts, small, big, reprint, notPrinted, problems };
  }

  function findDuplicate(state, p) {
    const name = fullName(p).toLowerCase().replace(/ё/g, 'е');
    return state.participants.find((x) =>
      x.id !== p.id && x.birthDate === p.birthDate && fullName(x).toLowerCase().replace(/ё/g, 'е') === name) || null;
  }

  // ---------- Тестовые данные ----------

  // Детерминированный набор вымышленных участников, помеченных test: true.
  function testParticipants(state, perPart) {
    const boys = ['Миша', 'Артём', 'Иван', 'Лев', 'Матвей', 'Тимур', 'Егор', 'Марк', 'Даниил', 'Фёдор', 'Глеб', 'Савва'];
    const girls = ['Аня', 'Маша', 'Соня', 'Ева', 'Алиса', 'Вера', 'Полина', 'Варя'];
    const lasts = ['Тестов', 'Пробин', 'Образцов', 'Примеров', 'Демин', 'Учебнов', 'Макетов', 'Черновой'];
    const branches = ['Филиал 1', 'Филиал 2', 'Филиал 3'];
    const coaches = ['Тренер А', 'Тренер Б', 'Тренер В', 'Тренер Г'];
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const out = [];
    const levels = state.settings.levels.length ? state.settings.levels : [''];
    for (const part of state.settings.parts) {
      const from = part.yearFrom || 2012;
      const to = part.yearTo || from;
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      for (let i = 0; i < perPart; i += 1) {
        const year = lo + Math.floor(rnd() * (hi - lo + 1));
        const girl = rnd() < 0.2;
        const age = 2026 - year;
        const baseW = 10 + age * 2.8;
        const weight = Math.round((baseW + (rnd() - 0.5) * age * 1.4) * 10) / 10;
        const month = String(1 + Math.floor(rnd() * 12)).padStart(2, '0');
        const day = String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
        const last = pick(lasts);
        out.push({
          id: uid('t'),
          lastName: girl ? last + 'а' : last,
          firstName: girl ? pick(girls) : pick(boys),
          birthDate: year + '-' + month + '-' + day,
          sex: girl ? 'Ж' : 'М',
          weight: Math.max(12, weight),
          level: pick(levels),
          branch: pick(branches),
          coach: pick(coaches),
          withdrawn: false,
          test: true,
          partId: part.yearFrom && part.yearTo ? '' : part.id,
          addedAt: new Date().toISOString(),
        });
      }
    }
    return out;
  }

  // ---------- Справочник клуба (база спортсменов) ----------

  function norm(s) {
    return String(s || '').trim().toLowerCase().replace(/ё/g, 'е');
  }

  function rosterKey(p) {
    return norm(p.lastName) + '|' + norm(p.firstName) + '|' + (p.birthDate || '');
  }

  // Поиск по началу фамилии (или «фамилия имя»), до limit вариантов.
  function rosterFind(state, query, limit) {
    const q = norm(query);
    if (!q) return [];
    return state.roster
      .filter((r) => norm(r.lastName + ' ' + r.firstName).startsWith(q) || norm(r.lastName).startsWith(q))
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'))
      .slice(0, limit || 8);
  }

  // Добавить спортсмена в базу или обновить его данные (филиал, тренер, уровень, пол).
  function rosterUpsert(state, p) {
    const key = rosterKey(p);
    const fields = ['lastName', 'firstName', 'birthDate', 'sex', 'level', 'branch', 'coach'];
    let r = state.roster.find((x) => rosterKey(x) === key);
    if (!r) { r = { id: uid('r') }; state.roster.push(r); }
    for (const f of fields) if (p[f] != null && p[f] !== '') r[f] = p[f];
    return r;
  }

  function parseDate(text) {
    const t = String(text || '').trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return '';
  }

  // Список из Excel/таблицы: строки, колонки через Tab, «;» или «,».
  // Порядок колонок: Фамилия, Имя, Дата рождения, Пол, Уровень, Филиал, Тренер (последние можно не заполнять).
  function parseRosterText(text) {
    const items = [];
    const errors = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
      const c = line.split(sep).map((x) => x.trim());
      if (i === 0 && norm(c[0]) === 'фамилия') return;
      const birthDate = parseDate(c[2]);
      if (!c[0] || !birthDate) { errors.push('Строка ' + (i + 1) + ': нужны фамилия и дата рождения (ДД.ММ.ГГГГ)'); return; }
      const sx = norm(c[3]);
      items.push({
        lastName: c[0], firstName: c[1] || '', birthDate,
        sex: sx.startsWith('ж') || sx.startsWith('д') || sx === 'f' ? 'Ж' : 'М',
        level: c[4] || '', branch: c[5] || '', coach: c[6] || '',
      });
    });
    return { items, errors };
  }

  const GL = {
    SCHEMA_VERSION, uid, defaultState, migrate, clone,
    birthYear, formatRuDate, formatBirth, toRoman, fullName, partYearsLabel,
    partOf, getPart, activeOfPart, fixedLimit, sortedLimits, groupKey,
    partitionByWeight, buildPart, gridsOfPart, gridLabels, gridWeights, participantsMap,
    roundRobin, bouts, distributeMats, matLoads,
    gridOfParticipant, detach, placeIncremental, rebuildGroup,
    integrity, findDuplicate, testParticipants,
    rosterFind, rosterUpsert, rosterKey, parseRosterText, parseDate,
  };
  globalThis.GL = GL;
})();
