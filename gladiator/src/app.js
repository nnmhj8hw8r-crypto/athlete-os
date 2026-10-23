// Гладиатор: шахматки — интерфейс. Логика в logic.js (globalThis.GL).
(function () {
  'use strict';
  const GL = globalThis.GL;
  const STORAGE_KEY = 'gladiator.tournament.v1';
  const app = document.getElementById('app');
  const printArea = document.getElementById('print-area');

  // ---------- Состояние и сохранение ----------

  let storageOk = true;
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? GL.migrate(JSON.parse(raw)) : null;
    } catch (e) {
      storageOk = false;
      return null;
    }
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
  }

  let state = loadSaved();
  if (!state) {
    state = GL.defaultState();
    // Онлайн-демо открывается с помеченными тестовыми участниками, рабочий файл — пустым.
    if (globalThis.GLADIATOR_DEMO) {
      state.participants = GL.testParticipants(state, 50);
      state.settings.parts.forEach((p) => GL.buildPart(state, p.id));
    }
  }
  if (!state.settings.date) state.settings.date = todayIso();
  const history = [];
  const ui = { tab: 'weigh', part: state.settings.parts[0] ? state.settings.parts[0].id : null, editId: null, search: '', printPart: null, printMat: 'all', printSel: null, formError: '' };

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Любое изменение — через commit: снимок для «Отменить», автосохранение, перерисовка.
  function commit(mutate, message) {
    const before = JSON.stringify(state);
    const next = GL.clone(state);
    const result = mutate(next);
    if (result === false) return;
    history.push(before);
    if (history.length > 40) history.shift();
    state = next;
    persist();
    render();
    if (message) toast(typeof message === 'function' ? message(result) : message);
  }

  function undo() {
    if (!history.length) return;
    state = GL.migrate(JSON.parse(history.pop()));
    persist();
    render();
    toast('Последнее действие отменено');
  }

  // ---------- Мелкие помощники ----------

  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  function pm() { return GL.participantsMap(state); }
  function partName(id) {
    const p = GL.getPart(state, id);
    return p ? p.name : 'без части';
  }
  function gridNumber(grid) {
    return GL.gridsOfPart(state, grid.partId).indexOf(grid) + 1;
  }

  let toastTimer = null;
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3500);
  }

  // Своё окно подтверждения: системные confirm/alert в некоторых окнах не показываются.
  function ask(opts) {
    closeModal();
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3>' + h(opts.title) + '</h3>' +
      (opts.html || '<p>' + h(opts.text || '') + '</p>') +
      '<div class="row">' + (opts.cancel === false ? '' : '<button class="btn" data-m="no">' + h(opts.cancel || 'Отмена') + '</button>') +
      (opts.ok ? '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" data-m="yes">' + h(opts.ok) + '</button>' : '') + '</div></div>';
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (e.target === back || (b && b.dataset.m === 'no')) { closeModal(); if (opts.onCancel) opts.onCancel(); }
      if (b && b.dataset.m === 'yes') { closeModal(); opts.onOk(); }
    });
    document.body.appendChild(back);
    const yes = back.querySelector('[data-m="yes"]') || back.querySelector('[data-m="no"]');
    if (yes) yes.focus();
    if (opts.onOpen) opts.onOpen(back);
  }
  function closeModal() {
    document.querySelectorAll('.modal-back').forEach((x) => x.remove());
  }

  // Если правка трогает уже напечатанные сетки — сначала спросить.
  function commitWithPrintCheck(mutate, message) {
    const trial = GL.clone(state);
    const affected = mutate(trial) || [];
    const printed = state.grids.filter((g) => affected.includes(g.id) && g.printedAt);
    if (!printed.length) { commit(mutate, message); return; }
    const labels = GL.gridLabels(state, printed[0].partId);
    ask({
      title: 'Изменится напечатанная шахматка',
      text: 'Затронуты уже напечатанные сетки: ' + printed.map((g) => '№' + gridNumber(g) + ' (' + (labels[g.id] || '') + ' кг)').join(', ') +
        '. Если судьи уже начали — согласуйте с ними. Шахматки будут отмечены «нужно перепечатать».',
      ok: 'Изменить',
      onOk: () => commit(mutate, message),
    });
  }

  // ---------- Шапка ----------

  function renderTop(info) {
    const tabs = [
      ['setup', 'Турнир'],
      ['weigh', 'Взвешивание', info.total],
      ['grids', 'Сетки', state.grids.length],
      ['mats', 'Ковры'],
      ['print', 'Печать', info.reprint.length ? '↻' + info.reprint.length : ''],
    ];
    const hasTest = state.participants.some((p) => p.test);
    return (hasTest ? '<div class="banner"><div class="wrap"><b>Тестовые данные.</b> В турнире есть вымышленные участники для пробы. <button class="btn small" data-act="remove-test">Удалить тестовых</button></div></div>' : '') +
      (!storageOk ? '<div class="banner"><div class="wrap">Автосохранение в этом браузере недоступно — сохраняйте турнир в файл.</div></div>' : '') +
      '<header class="top"><div class="wrap">' +
      '<div class="brand"><span class="belts" aria-hidden="true"><i></i><i></i></span><span>Гладиатор: шахматки<br><small>' + h(GL.formatRuDate(state.settings.date)) + '</small></span></div>' +
      '<div class="chips">' +
      '<span class="chip">Взвешено: <b>' + info.total + '</b></span>' +
      '<span class="chip ' + (info.inGrids === info.total && info.total ? 'ok' : '') + '">В сетках: <b>' + info.inGrids + '</b></span>' +
      (info.notBuilt.length ? '<button class="chip warn" data-go="grids">Ждут разбивки: <b>' + info.notBuilt.length + '</b></button>' : '') +
      (info.problems ? '<button class="chip bad" data-go="grids">Проблем: <b>' + info.problems + '</b></button>' : (info.total ? '<span class="chip ok">Никто не потерян</span>' : '')) +
      (info.reprint.length ? '<button class="chip warn" data-go="print">Перепечатать: <b>' + info.reprint.length + '</b></button>' : '') +
      '</div>' +
      '<div class="actions">' +
      '<button class="btn" data-act="undo" ' + (history.length ? '' : 'disabled') + ' title="Ctrl+Z">Отменить</button>' +
      '<button class="btn" data-act="save-file">Сохранить в файл</button>' +
      '<button class="btn" data-act="open-file">Открыть файл</button>' +
      '</div></div>' +
      '<div class="wrap"><nav class="tabs" aria-label="Разделы">' +
      tabs.map(([id, name, n]) => '<button data-tab="' + id + '" ' + (ui.tab === id ? 'aria-current="page"' : '') + '>' + name + (n ? '<span class="n">' + n + '</span>' : '') + '</button>').join('') +
      '</nav></div></header>';
  }

  // ---------- Турнир (настройки) ----------

  function renderSetup() {
    const s = state.settings;
    const fmtOptions = (cur) => s.formats.map((f) => '<option ' + (f === cur ? 'selected' : '') + '>' + h(f) + '</option>').join('');
    const rows = s.parts.map((p, i) => {
      const count = GL.activeOfPart(state, p.id).length;
      return '<tr>' +
        '<td><input id="pn-' + p.id + '" data-part="' + p.id + '" data-field="name" value="' + h(p.name) + '" aria-label="Название части"></td>' +
        '<td><input id="pf-' + p.id + '" class="y" type="number" data-part="' + p.id + '" data-field="yearFrom" value="' + h(p.yearFrom || '') + '" placeholder="—" aria-label="Год рождения с"></td>' +
        '<td><input id="pt-' + p.id + '" class="y" type="number" data-part="' + p.id + '" data-field="yearTo" value="' + h(p.yearTo || '') + '" placeholder="—" aria-label="Год рождения по"></td>' +
        '<td><select id="pfo-' + p.id + '" data-part="' + p.id + '" data-field="format" aria-label="Формат борьбы">' + fmtOptions(p.format) + '</select></td>' +
        '<td><select id="pm-' + p.id + '" data-part="' + p.id + '" data-field="weightMode" aria-label="Весовые категории"><option value="float" ' + (p.weightMode !== 'fixed' ? 'selected' : '') + '>плавающие</option><option value="fixed" ' + (p.weightMode === 'fixed' ? 'selected' : '') + '>фиксированные</option></select></td>' +
        '<td><input id="pl-' + p.id + '" data-part="' + p.id + '" data-field="limits" value="' + h((p.limits || []).join(', ')) + '" placeholder="24, 26, 28" ' + (p.weightMode === 'fixed' ? '' : 'disabled') + ' aria-label="Границы категорий"></td>' +
        '<td><input id="pd-' + p.id + '" class="kg" type="number" step="0.5" min="0" data-part="' + p.id + '" data-field="maxDiffKg" value="' + h(p.maxDiffKg || '') + '" placeholder="авто" aria-label="Допустимая разница в весе"></td>' +
        '<td class="num">' + count + '</td>' +
        '<td><button class="btn small danger" data-act="del-part" data-id="' + p.id + '" ' + (s.parts.length < 2 ? 'disabled' : '') + ' aria-label="Удалить часть ' + (i + 1) + '">×</button></td></tr>';
    }).join('');
    return '<section class="panel"><h2>Турнир</h2>' +
      '<div class="row">' +
      '<label class="f" style="flex:3 1 320px"><span>Заголовок бланка</span><input id="s-title" data-set="title" value="' + h(s.title) + '"></label>' +
      '<label class="f"><span>Дата</span><input id="s-date" type="date" data-set="date" value="' + h(s.date) + '"></label>' +
      '<label class="f"><span>Ковров</span><input id="s-mats" type="number" min="1" max="10" data-set="mats" value="' + s.mats + '" style="width:80px"></label>' +
      '<label class="f"><span>В сетке от</span><input id="s-min" type="number" min="2" max="8" data-set="minSize" value="' + s.minSize + '" style="width:80px"></label>' +
      '<label class="f"><span>до</span><input id="s-max" type="number" min="2" max="8" data-set="maxSize" value="' + s.maxSize + '" style="width:80px"></label>' +
      '</div></section>' +
      '<section class="panel"><div class="row"><h2>Части турнира</h2><span class="spacer"></span><button class="btn" data-act="add-part">Добавить часть</button></div>' +
      '<p class="hint">Участник попадает в часть по году рождения. Если у части годы не заданы (например, «выборочно»), участников в неё ставят вручную при взвешивании. «Плавающие» категории — сетки собираются из ближайших по весу; на бланке пишется вес самого тяжёлого, округлённый вверх. «Фиксированные» — по границам «до 24, до 26…»; переполненная категория делится на подгруппы а, б, в. Пустая «разница в весе» — подбирается автоматически.</p>' +
      '<div class="table-wrap"><table class="list parts-table"><thead><tr><th>Название</th><th>Г. р. с</th><th>по</th><th>Формат борьбы</th><th>Вес</th><th>Границы, кг</th><th>Разница, кг</th><th>Чел.</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      '<section class="panel"><h2>Списки</h2><div class="row">' +
      '<label class="f" style="flex:1 1 240px"><span>Уровни подготовки (по одному в строке)</span><textarea id="s-levels" rows="4" data-list="levels">' + h(s.levels.join('\n')) + '</textarea></label>' +
      '<label class="f" style="flex:1 1 240px"><span>Форматы борьбы (по одному в строке)</span><textarea id="s-formats" rows="4" data-list="formats">' + h(s.formats.join('\n')) + '</textarea></label>' +
      '</div></section>' +
      '<section class="panel"><h2>Проба и сброс</h2><p class="hint">Тестовые участники вымышлены и помечены. Их удобно использовать, чтобы показать приложение и потренироваться; перед настоящим турниром удалите их.</p>' +
      '<div class="row"><button class="btn" data-act="add-test">Добавить тестовых (по 50 на часть)</button>' +
      '<button class="btn" data-act="remove-test">Удалить тестовых</button><span class="spacer"></span>' +
      '<button class="btn danger" data-act="reset">Начать новый турнир</button></div></section>';
  }

  // ---------- Взвешивание ----------

  function renderWeigh() {
    const s = state.settings;
    const editing = ui.editId ? state.participants.find((p) => p.id === ui.editId) : null;
    const v = editing || { lastName: '', firstName: '', birthDate: '', sex: 'М', weight: '', level: s.levels[0] || '', branch: lastValue('branch'), coach: lastValue('coach'), partId: '' };
    const branches = uniq(state.participants.map((p) => p.branch));
    const coaches = uniq(state.participants.map((p) => p.coach));
    const form = '<section class="panel"><div class="row"><h2>' + (editing ? 'Изменить участника' : 'Взвешивание') + '</h2><span class="spacer"></span><span class="hint">Enter — сохранить, Tab — следующее поле</span></div>' +
      '<form id="weigh-form" class="weigh-form" autocomplete="off">' +
      '<label class="f"><span>Фамилия</span><input id="f-last" name="lastName" value="' + h(v.lastName) + '" required></label>' +
      '<label class="f"><span>Имя</span><input id="f-first" name="firstName" value="' + h(v.firstName) + '"></label>' +
      '<label class="f"><span>Дата рождения</span><input id="f-birth" name="birthDate" type="date" min="2000-01-01" max="2030-12-31" value="' + h(v.birthDate) + '" required></label>' +
      '<label class="f"><span>Пол</span><select id="f-sex" name="sex"><option ' + (v.sex === 'М' ? 'selected' : '') + ' value="М">мальчик</option><option ' + (v.sex === 'Ж' ? 'selected' : '') + ' value="Ж">девочка</option></select></label>' +
      '<label class="f"><span>Вес, кг</span><input id="f-weight" name="weight" type="number" step="0.1" min="5" max="150" value="' + h(v.weight) + '" required></label>' +
      '<label class="f"><span>Уровень</span><select id="f-level" name="level">' + s.levels.map((l) => '<option ' + (l === v.level ? 'selected' : '') + '>' + h(l) + '</option>').join('') + '</select></label>' +
      '<label class="f"><span>Филиал</span><input id="f-branch" name="branch" list="dl-branch" value="' + h(v.branch) + '"></label>' +
      '<label class="f"><span>Тренер</span><input id="f-coach" name="coach" list="dl-coach" value="' + h(v.coach) + '"></label>' +
      '<label class="f"><span>Часть</span><select id="f-part" name="partId"><option value="">по году рождения</option>' + s.parts.map((p) => '<option value="' + p.id + '" ' + (v.partId === p.id ? 'selected' : '') + '>' + h(p.name) + '</option>').join('') + '</select></label>' +
      '<div class="row"><button class="btn primary" type="submit">' + (editing ? 'Сохранить' : 'Добавить') + '</button>' + (editing ? '<button class="btn" type="button" data-act="cancel-edit">Отмена</button>' : '') + '</div>' +
      '</form>' +
      '<datalist id="dl-branch">' + branches.map((b) => '<option value="' + h(b) + '">').join('') + '</datalist>' +
      '<datalist id="dl-coach">' + coaches.map((b) => '<option value="' + h(b) + '">').join('') + '</datalist>' +
      (ui.formError ? '<p class="err" role="alert">' + h(ui.formError) + '</p>' : '') +
      '</section>';

    const q = ui.search.trim().toLowerCase().replace(/ё/g, 'е');
    const map = pm();
    const list = state.participants.slice().reverse().filter((p) => !q || (GL.fullName(p) + ' ' + (p.branch || '') + ' ' + (p.coach || '')).toLowerCase().replace(/ё/g, 'е').includes(q));
    const rows = list.map((p) => {
      const g = GL.gridOfParticipant(state, p.id);
      const partId = GL.partOf(state, p);
      const labels = g ? GL.gridLabels(state, g.partId) : {};
      return '<tr class="' + (p.withdrawn ? 'withdrawn' : '') + '">' +
        '<td>' + h(GL.fullName(p)) + (p.test ? ' <span class="tag test">тест</span>' : '') + '</td>' +
        '<td>' + h(GL.formatBirth(p.birthDate)) + '</td>' +
        '<td><span class="tag ' + (p.sex === 'Ж' ? 'f' : 'm') + '">' + (p.sex === 'Ж' ? 'Ж' : 'М') + '</span></td>' +
        '<td class="num">' + h(Number(p.weight).toFixed(1)) + '</td>' +
        '<td>' + h(p.level) + '</td><td>' + h(p.branch) + '</td><td>' + h(p.coach) + '</td>' +
        '<td>' + (partId ? h(partName(partId)) : '<span class="tag" style="color:var(--red)">нет части</span>') + '</td>' +
        '<td>' + (p.withdrawn ? 'снят' : g ? '№' + gridNumber(g) + ' · ' + h(labels[g.id] || '') + ' кг' : (partId && state.builtParts[partId] ? '<span style="color:var(--red)">без сетки</span>' : '—')) + '</td>' +
        '<td><div class="actions"><button class="btn small" data-act="edit" data-id="' + p.id + '">Изменить</button>' +
        '<button class="btn small" data-act="' + (p.withdrawn ? 'restore' : 'withdraw') + '" data-id="' + p.id + '">' + (p.withdrawn ? 'Вернуть' : 'Снять') + '</button>' +
        '<button class="btn small danger" data-act="delete" data-id="' + p.id + '" aria-label="Удалить">×</button></div></td></tr>';
    }).join('');
    void map;
    const table = '<section class="panel"><div class="row"><h2>Участники <span class="hint">' + state.participants.length + '</span></h2><span class="spacer"></span>' +
      '<input id="search" type="search" placeholder="Поиск по фамилии, филиалу, тренеру" value="' + h(ui.search) + '" style="min-width:min(280px,100%)"></div>' +
      (state.participants.length ? '<div class="table-wrap"><table class="list"><thead><tr><th>ФИО</th><th>Д. р.</th><th>Пол</th><th>Вес</th><th>Уровень</th><th>Филиал</th><th>Тренер</th><th>Часть</th><th>Сетка</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (list.length ? '' : '<div class="empty">Никого не нашли по запросу «' + h(ui.search) + '».</div>')
        : '<div class="empty">Пока никто не взвешен. Введите первого участника в форме выше — он сразу попадёт в свою часть по году рождения. Для пробы можно добавить тестовых участников на вкладке «Турнир».</div>') +
      '</section>';
    return form + table;
  }

  function uniq(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'));
  }
  function lastValue(field) {
    for (let i = state.participants.length - 1; i >= 0; i -= 1) if (state.participants[i][field] && !state.participants[i].test) return state.participants[i][field];
    return '';
  }

  function submitWeigh(form) {
    const fd = new FormData(form);
    const data = {
      lastName: String(fd.get('lastName') || '').trim(),
      firstName: String(fd.get('firstName') || '').trim(),
      birthDate: String(fd.get('birthDate') || ''),
      sex: fd.get('sex') === 'Ж' ? 'Ж' : 'М',
      weight: Math.round(parseFloat(String(fd.get('weight')).replace(',', '.')) * 10) / 10,
      level: String(fd.get('level') || ''),
      branch: String(fd.get('branch') || '').trim(),
      coach: String(fd.get('coach') || '').trim(),
      partId: String(fd.get('partId') || ''),
    };
    if (!data.lastName) return formError('Введите фамилию.', 'f-last');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)) return formError('Введите дату рождения.', 'f-birth');
    if (!(data.weight >= 5 && data.weight <= 150)) return formError('Вес должен быть от 5 до 150 кг.', 'f-weight');
    ui.formError = '';
    const editId = ui.editId;
    const candidate = Object.assign({ id: editId || '' }, data);
    const dup = GL.findDuplicate(state, candidate);
    const go = () => (editId ? saveEdit(editId, data) : addParticipant(data));
    if (dup) {
      ask({ title: 'Похоже на повтор', text: GL.fullName(dup) + ', ' + GL.formatBirth(dup.birthDate) + ' уже есть в списке' + (dup.withdrawn ? ' (снят)' : '') + '. Всё равно сохранить?', ok: 'Сохранить', onOk: go });
      return;
    }
    go();
  }

  function formError(text, focusId) {
    ui.formError = text;
    render();
    const el = document.getElementById(focusId);
    if (el) el.focus();
  }

  function addParticipant(data) {
    const id = GL.uid('a');
    const mutate = (s) => {
      s.participants.push(Object.assign({ id, withdrawn: false, test: false, addedAt: new Date().toISOString() }, data));
      return GL.placeIncremental(s, id);
    };
    commitWithPrintCheck(mutate, (affected) => {
      const p = { birthDate: data.birthDate, partId: data.partId };
      const partId = GL.partOf(state, p);
      if (!partId) return 'Добавлен. Год рождения не входит ни в одну часть — укажите часть вручную.';
      if (affected && affected.length) {
        const g = state.grids.find((x) => x.id === affected[0]);
        return 'Добавлен в ' + partName(partId) + (g ? ', сетка №' + gridNumber(g) : '');
      }
      return 'Добавлен: ' + partName(partId);
    });
    ui.editId = null;
    setTimeout(() => { const el = document.getElementById('f-last'); if (el) el.focus(); }, 0);
  }

  function saveEdit(id, data) {
    const old = state.participants.find((p) => p.id === id);
    const regroup = old && (old.weight !== data.weight || old.sex !== data.sex || old.level !== data.level || old.birthDate !== data.birthDate || (old.partId || '') !== data.partId);
    const mutate = (s) => {
      const p = s.participants.find((x) => x.id === id);
      Object.assign(p, data);
      if (!regroup || p.withdrawn) {
        const g = GL.gridOfParticipant(s, id);
        if (g && g.printedAt) g.dirtyAfterPrint = true;
        return g ? [g.id] : [];
      }
      const was = GL.detach(s, id);
      return (was ? [was] : []).concat(GL.placeIncremental(s, id));
    };
    ui.editId = null;
    commitWithPrintCheck(mutate, 'Изменения сохранены');
  }

  // ---------- Сетки ----------

  function partTabs(current, onAttr) {
    return '<div class="subtabs">' + state.settings.parts.map((p) => {
      const n = GL.activeOfPart(state, p.id).length;
      return '<button ' + onAttr + '="' + p.id + '" aria-pressed="' + (p.id === current) + '">' + h(p.name) + ' <span class="hint">' + (GL.partYearsLabel(p) || 'выборочно') + ' · ' + n + '</span></button>';
    }).join('') + '</div>';
  }

  function renderGrids(info) {
    const part = GL.getPart(state, ui.part) || state.settings.parts[0];
    if (!part) return '<div class="empty">Добавьте хотя бы одну часть на вкладке «Турнир».</div>';
    ui.part = part.id;
    const s = state.settings;
    const people = GL.activeOfPart(state, part.id);
    const built = !!state.builtParts[part.id];
    const grids = GL.gridsOfPart(state, part.id);
    const labels = GL.gridLabels(state, part.id);
    const map = pm();
    const unassigned = info.unassigned.filter((p) => GL.partOf(state, p) === part.id);
    const head = '<section class="panel">' + partTabs(part.id, 'data-part-tab') +
      '<div class="row"><div><h2>' + h(part.name) + '</h2><p class="hint">' + (GL.partYearsLabel(part) ? 'Среди ' + GL.partYearsLabel(part) + ' г. р.' : 'Состав выборочный') + ' · ' + h(part.format) + ' · ' + people.length + ' ' + plural(people.length, 'участник', 'участника', 'участников') + (built ? ' · ' + grids.length + ' ' + plural(grids.length, 'сетка', 'сетки', 'сеток') : '') + '</p></div><span class="spacer"></span>' +
      (built ? '<button class="btn" data-act="distribute" data-id="' + part.id + '">Распределить по коврам</button>' : '') +
      '<button class="btn primary" data-act="build" data-id="' + part.id + '" ' + (people.length ? '' : 'disabled') + '>' + (built ? 'Пересобрать сетки' : 'Собрать сетки') + '</button></div>' +
      (built ? '' : (people.length ? '<div class="notice info">Когда взвешивание этой части закончено, нажмите «Собрать сетки». Приложение разложит участников по полу, уровню и весу на сетки по ' + s.minSize + '–' + s.maxSize + ' человек. Потом сетки можно поправить вручную.</div>' : '<div class="empty">В этой части пока нет взвешенных участников.</div>')) +
      (unassigned.length ? '<div class="notice bad"><b>Без сетки: ' + unassigned.length + '.</b> ' + unassigned.map((p) => h(GL.fullName(p)) + ' (' + p.weight + ' кг)').join(', ') + '. <button class="btn small" data-act="place-all" data-id="' + part.id + '">Разложить по сеткам</button></div>' : '') +
      '</section>';
    if (!built) return head;
    const cards = grids.map((g, i) => {
      const members = g.members.map((id) => map.get(id)).filter(Boolean);
      const ws = members.map((m) => m.weight);
      const range = ws.length ? Math.max.apply(null, ws) - Math.min.apply(null, ws) : 0;
      const small = members.length < s.minSize;
      const big = members.length > s.maxSize;
      const mixed = new Set(members.map((m) => m.level)).size > 1 || new Set(members.map((m) => m.sex)).size > 1;
      const moveOpts = grids.filter((x) => x !== g).map((x) => '<option value="' + x.id + '">в №' + (grids.indexOf(x) + 1) + ' · ' + h(labels[x.id]) + ' кг (' + x.members.length + ')</option>').join('');
      const rows = members.map((m, j) => '<tr><td class="no">' + (j + 1) + '</td><td>' + h(GL.fullName(m)) + ' <span class="hint">' + h(m.branch || '') + '</span></td><td class="w">' + m.weight.toFixed(1) + '</td>' +
        '<td class="act"><button class="btn small" data-act="up" data-g="' + g.id + '" data-id="' + m.id + '" ' + (j ? '' : 'disabled') + ' aria-label="Выше">↑</button> ' +
        '<select data-move="' + m.id + '" aria-label="Перенести ' + h(GL.fullName(m)) + '"><option value="">перенести…</option>' + moveOpts + '<option value="new">в новую сетку</option><option value="out">убрать из сеток</option></select></td></tr>').join('');
      const mats = Array.from({ length: s.mats }, (_, k) => '<option value="' + (k + 1) + '" ' + (g.mat === k + 1 ? 'selected' : '') + '>ковёр ' + GL.toRoman(k + 1) + '</option>').join('');
      const notes = [];
      if (small) notes.push('<div class="notice bad">Меньше ' + s.minSize + ' человек — перенесите сюда кого-то или объедините с соседней сеткой.</div>');
      if (big) notes.push('<div class="notice bad">Больше ' + s.maxSize + ' человек.</div>');
      if (mixed) notes.push('<div class="notice warn">В сетке разные пол или уровень — проверьте, что так и задумано.</div>');
      if (part.maxDiffKg && range > part.maxDiffKg) notes.push('<div class="notice warn">Разница в весе ' + range.toFixed(1) + ' кг — больше допустимых ' + part.maxDiffKg + ' кг.</div>');
      if (g.dirtyAfterPrint) notes.push('<div class="notice warn">Изменена после печати — перепечатайте.</div>');
      return '<article class="card ' + (small || big ? 'bad' : mixed || g.dirtyAfterPrint ? 'warn' : '') + '">' +
        '<header><span class="lbl">№' + (i + 1) + ' · ' + h(labels[g.id]) + ' кг</span><span class="meta">' + (g.sex === 'Ж' ? 'девочки' : 'мальчики') + ' · ' + h(g.level) + ' · ' + members.length + ' чел. / ' + GL.bouts(members.length) + ' ' + plural(GL.bouts(members.length), 'схватка', 'схватки', 'схваток') + ' · разница ' + range.toFixed(1) + ' кг</span>' +
        (g.printedAt && !g.dirtyAfterPrint ? '<span class="tag">напечатана</span>' : '') + (g.locked ? '<span class="tag">закреплена</span>' : '') + '</header>' +
        '<div class="body">' + notes.join('') + '<table>' + rows + '</table>' +
        '<div class="foot"><select data-mat="' + g.id + '" aria-label="Ковёр">' + mats + '</select>' +
        '<select data-format="' + g.id + '" aria-label="Формат борьбы">' + s.formats.map((f) => '<option ' + (f === g.format ? 'selected' : '') + '>' + h(f) + '</option>').join('') + '</select>' +
        '<label class="check">кат. <input class="lab" data-label="' + g.id + '" value="' + h(g.labelOverride || '') + '" placeholder="' + h(labels[g.id]) + '" aria-label="Своя подпись категории"></label>' +
        '<label class="check"><input type="checkbox" data-lock="' + g.id + '" ' + (g.locked ? 'checked' : '') + '> закрепить</label>' +
        '<span class="spacer"></span><button class="btn small danger" data-act="dissolve" data-g="' + g.id + '">Расформировать</button></div>' +
        '</div></article>';
    }).join('');
    return head + (grids.length ? '<div class="grid-cards">' + cards + '</div>' : '<div class="empty">Сеток нет. Нажмите «Пересобрать сетки».</div>') +
      '<p class="hint">«Закрепить» — сетка не меняется при пересборке. «кат.» — своя подпись весовой категории на бланке, если автоматическая не подходит.</p>';
  }

  function buildPart(partId) {
    const grids = GL.gridsOfPart(state, partId);
    const printed = grids.filter((g) => g.printedAt && !g.locked);
    const run = () => commit((s) => { GL.buildPart(s, partId); }, 'Сетки собраны и распределены по коврам');
    if (!grids.length) return run();
    ask({
      title: 'Пересобрать сетки части?',
      text: 'Все незакреплённые сетки «' + partName(partId) + '» будут собраны заново' + (printed.length ? ', в том числе ' + printed.length + ' уже ' + plural(printed.length, 'напечатанная', 'напечатанные', 'напечатанных') : '') + '. Закреплённые останутся как есть. Отменить можно кнопкой «Отменить».',
      ok: 'Пересобрать', danger: printed.length > 0, onOk: run,
    });
  }

  function moveMember(pid, target) {
    commitWithPrintCheck((s) => {
      const from = GL.gridOfParticipant(s, pid);
      if (!from) return [];
      const affected = [from.id];
      GL.detach(s, pid);
      if (target === 'out') return affected;
      let to;
      if (target === 'new') {
        const part = GL.getPart(s, from.partId);
        const p = s.participants.find((x) => x.id === pid);
        to = { id: GL.uid('g'), partId: from.partId, sex: p.sex, level: p.level, format: from.format || part.format, members: [], mat: from.mat, matManual: false, locked: false, printedAt: null, dirtyAfterPrint: false, labelOverride: '' };
        s.grids.push(to);
      } else {
        to = s.grids.find((g) => g.id === target);
      }
      to.members.push(pid);
      if (to.printedAt) to.dirtyAfterPrint = true;
      affected.push(to.id);
      return affected;
    }, 'Перенесено');
  }

  // ---------- Ковры ----------

  function renderMats() {
    const parts = state.settings.parts.filter((p) => state.builtParts[p.id]);
    if (!parts.length) return '<div class="empty">Сначала соберите сетки хотя бы одной части на вкладке «Сетки».</div>';
    const part = GL.getPart(state, ui.part) && state.builtParts[ui.part] ? GL.getPart(state, ui.part) : parts[0];
    ui.part = part.id;
    const s = state.settings;
    const grids = GL.gridsOfPart(state, part.id);
    const labels = GL.gridLabels(state, part.id);
    const loads = GL.matLoads(state, part.id);
    const maxLoad = Math.max(1, Math.max.apply(null, loads));
    const cols = loads.map((load, k) => {
      const items = grids.filter((g) => g.mat === k + 1).map((g) => {
        const opts = Array.from({ length: s.mats }, (_, m) => '<option value="' + (m + 1) + '" ' + (m === k ? 'selected' : '') + '>' + GL.toRoman(m + 1) + '</option>').join('');
        return '<div class="item"><span>№' + (grids.indexOf(g) + 1) + ' · <b>' + h(labels[g.id]) + '</b> кг · ' + g.members.length + ' чел.</span><select data-mat="' + g.id + '" aria-label="Ковёр">' + opts + '</select></div>';
      }).join('');
      return '<div class="mat"><h3>Ковёр ' + GL.toRoman(k + 1) + '<span class="load">' + load + ' ' + plural(load, 'схватка', 'схватки', 'схваток') + '</span></h3><div class="bar"><i style="width:' + Math.round((load / maxLoad) * 100) + '%"></i></div>' + (items || '<p class="hint">Пусто</p>') + '</div>';
    }).join('');
    const unplaced = grids.filter((g) => !(g.mat >= 1 && g.mat <= s.mats));
    return '<section class="panel">' + partTabs(part.id, 'data-part-tab') +
      '<div class="row"><div><h2>Ковры · ' + h(part.name) + '</h2><p class="hint">Нагрузка считается по числу схваток: 3 чел. — 3, 4 чел. — 6, 5 чел. — 10.</p></div><span class="spacer"></span>' +
      '<button class="btn primary" data-act="distribute-all" data-id="' + part.id + '">Распределить равномерно</button></div>' +
      (unplaced.length ? '<div class="notice bad">Без ковра: ' + unplaced.length + '. Нажмите «Распределить равномерно».</div>' : '') +
      '</section><div class="mats">' + cols + '</div>';
  }

  // ---------- Печать ----------

  function sheetHtml(g, label) {
    const s = state.settings;
    const part = GL.getPart(state, g.partId);
    const map = pm();
    const members = g.members.map((id) => map.get(id)).filter(Boolean);
    const n = members.length;
    const head = '<tr><th>№</th><th>ФИО</th>' + members.map((_, i) => '<th>' + (i + 1) + '</th>').join('') + '<th>очки</th><th>место</th></tr>';
    const body = members.map((m, i) => '<tr><td class="no">' + (i + 1) + '</td><td class="fio">' + h(GL.fullName(m)) + '</td>' +
      members.map((_, j) => '<td class="c' + (i === j ? ' x' : '') + '"></td>').join('') + '<td class="c"></td><td class="c"></td></tr>').join('');
    const rounds = GL.roundRobin(n).map((pairs, r) => '<div class="rt">' + (r + 1) + ' круг</div>' +
      pairs.map(([a, b]) => '<div class="pair"><span>' + a + ' ' + h(GL.fullName(members[a - 1])) + '</span><span>' + b + ' ' + h(GL.fullName(members[b - 1])) + '</span></div>').join('')).join('');
    const years = part ? GL.partYearsLabel(part) : '';
    return '<div class="sheet">' + (g.mat ? '<div class="mat-no">' + GL.toRoman(g.mat) + '</div>' : '') +
      '<h1>' + h(s.title) + '</h1>' +
      '<div class="line"><span>' + h(GL.formatRuDate(s.date)) + '</span><span>Весовая категория&nbsp;&nbsp;' + h(label) + '&nbsp;кг</span></div>' +
      '<div class="line"><span>' + h(g.format || (part && part.format) || '') + '</span><span>' + (years ? 'Среди&nbsp;&nbsp;' + h(years) + '&nbsp;г.р.' : '') + '</span></div>' +
      '<table class="chess">' + head + body + '</table><div class="rounds">' + rounds + '</div></div>';
  }

  function printable() {
    const parts = state.settings.parts.filter((p) => state.builtParts[p.id]);
    const part = parts.find((p) => p.id === ui.printPart) || parts.find((p) => p.id === ui.part) || parts[0];
    return { parts, part };
  }

  function renderPrint() {
    const { parts, part } = printable();
    if (!part) return '<div class="empty">Сначала соберите сетки на вкладке «Сетки». Здесь появятся шахматки для печати — по одной на лист A4, как на бланке клуба.</div>';
    ui.printPart = part.id;
    const s = state.settings;
    const grids = GL.gridsOfPart(state, part.id).filter((g) => ui.printMat === 'all' || g.mat === Number(ui.printMat));
    const labels = GL.gridLabels(state, part.id);
    if (!ui.printSel || ui.printSel.part !== part.id) ui.printSel = { part: part.id, ids: new Set(GL.gridsOfPart(state, part.id).filter((g) => !g.printedAt || g.dirtyAfterPrint).map((g) => g.id)) };
    const sel = ui.printSel.ids;
    const chosen = grids.filter((g) => sel.has(g.id));
    const list = grids.map((g) => '<label><input type="checkbox" data-psel="' + g.id + '" ' + (sel.has(g.id) ? 'checked' : '') + '> №' + (GL.gridsOfPart(state, part.id).indexOf(g) + 1) + ' · ' + h(labels[g.id]) + ' кг · ковёр ' + (g.mat ? GL.toRoman(g.mat) : '—') + ' · ' + g.members.length + ' чел. ' +
      (g.dirtyAfterPrint ? '<span class="tag test">перепечатать</span>' : g.printedAt ? '<span class="tag">напечатана</span>' : '') + '</label>').join('');
    return '<section class="panel">' + '<div class="subtabs">' + parts.map((p) => '<button data-print-part="' + p.id + '" aria-pressed="' + (p.id === part.id) + '">' + h(p.name) + '</button>').join('') + '</div>' +
      '<div class="row"><label class="f"><span>Ковёр</span><select id="print-mat" data-print-mat><option value="all">все</option>' + Array.from({ length: s.mats }, (_, k) => '<option value="' + (k + 1) + '" ' + (String(k + 1) === String(ui.printMat) ? 'selected' : '') + '>' + GL.toRoman(k + 1) + '</option>').join('') + '</select></label>' +
      '<button class="btn small" data-act="psel-all">Выбрать все</button><button class="btn small" data-act="psel-none">Снять выбор</button><span class="spacer"></span>' +
      '<button class="btn primary" data-act="print" ' + (chosen.length ? '' : 'disabled') + '>Печать выбранных (' + chosen.length + ')</button></div>' +
      '<p class="hint">В окне печати выберите принтер и формат A4, книжная ориентация, поля — «нет» или «минимальные». Чтобы получить PDF, выберите «Сохранить как PDF».</p>' +
      '<div class="print-list">' + (list || '<p class="hint">Нет сеток на этом ковре.</p>') + '</div></section>' +
      '<section class="sheets" aria-label="Предпросмотр">' + (chosen.length ? chosen.map((g) => '<div class="sheet-frame">' + sheetHtml(g, labels[g.id]) + '</div>').join('') : '<div class="empty">Отметьте шахматки, чтобы увидеть, как они будут напечатаны.</div>') + '</section>';
  }

  function doPrint() {
    const { part } = printable();
    if (!part) return;
    const labels = GL.gridLabels(state, part.id);
    const chosen = GL.gridsOfPart(state, part.id).filter((g) => ui.printSel.ids.has(g.id) && (ui.printMat === 'all' || g.mat === Number(ui.printMat)));
    printArea.innerHTML = chosen.map((g) => sheetHtml(g, labels[g.id])).join('');
    const ids = chosen.map((g) => g.id);
    try { window.print(); } catch (e) { /* окно печати недоступно */ }
    setTimeout(() => {
      ask({
        title: 'Шахматки напечатались?',
        text: 'Отметить ' + ids.length + ' ' + plural(ids.length, 'шахматку', 'шахматки', 'шахматок') + ' как напечатанные? Если окно печати не открылось, откройте файл gladiator.html на компьютере в Chrome или Edge.',
        ok: 'Да, отметить', cancel: 'Нет',
        onOk: () => commit((s) => {
          const now = new Date().toISOString();
          s.grids.forEach((g) => { if (ids.includes(g.id)) { g.printedAt = now; g.dirtyAfterPrint = false; } });
        }, 'Отмечено как напечатанные'),
      });
    }, 300);
  }

  // ---------- Файл турнира ----------

  function saveFile() {
    const json = JSON.stringify(state, null, 1);
    const name = 'турнир-гладиатор-' + (state.settings.date || todayIso()) + '.json';
    let downloaded = false;
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      downloaded = true;
    } catch (e) { downloaded = false; }
    ask({
      title: 'Файл турнира',
      html: '<p>' + (downloaded ? 'Файл «' + h(name) + '» должен появиться в папке «Загрузки». Если скачивание не началось, скопируйте текст ниже и сохраните его в файл с расширением .json.' : 'Скопируйте текст ниже и сохраните в файл с расширением .json.') + '</p><textarea id="json-out" readonly>' + h(json) + '</textarea>',
      ok: 'Скопировать', cancel: 'Закрыть',
      onOk: () => {
        const done = () => toast('Скопировано');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(done, () => toast('Не удалось скопировать — выделите текст вручную'));
      },
    });
  }

  function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => loadJson(String(reader.result));
      reader.onerror = () => toast('Не удалось прочитать файл');
      reader.readAsText(file);
    });
    input.click();
  }

  function loadJson(text) {
    let data;
    try { data = GL.migrate(JSON.parse(text)); } catch (e) {
      ask({ title: 'Файл не открылся', text: (e && e.message ? e.message : 'Неверный формат') + '. Выберите файл, сохранённый кнопкой «Сохранить в файл».', cancel: 'Понятно' });
      return;
    }
    ask({
      title: 'Открыть турнир из файла?',
      text: 'В файле ' + data.participants.length + ' ' + plural(data.participants.length, 'участник', 'участника', 'участников') + ', дата ' + GL.formatRuDate(data.settings.date) + '. Текущий турнир в приложении будет заменён (его можно вернуть кнопкой «Отменить»).',
      ok: 'Открыть', onOk: () => commit((s) => { Object.keys(s).forEach((k) => delete s[k]); Object.assign(s, data); }, 'Турнир открыт из файла'),
    });
  }

  // ---------- Отрисовка ----------

  function render() {
    const active = document.activeElement;
    const focusId = active && active.id ? active.id : null;
    const selStart = active && 'selectionStart' in active ? safe(() => active.selectionStart) : null;
    const info = GL.integrity(state);
    let body = '';
    if (ui.tab === 'setup') body = renderSetup();
    else if (ui.tab === 'weigh') body = renderWeigh();
    else if (ui.tab === 'grids') body = renderGrids(info);
    else if (ui.tab === 'mats') body = renderMats();
    else body = renderPrint();
    if (info.noPart.length && (ui.tab === 'weigh' || ui.tab === 'grids')) {
      body = '<div class="notice bad"><b>Не попали ни в одну часть: ' + info.noPart.length + '.</b> ' + info.noPart.map((p) => h(GL.fullName(p)) + ' (' + GL.formatBirth(p.birthDate) + ')').join(', ') + '. Укажите им часть вручную или поправьте годы частей на вкладке «Турнир».</div>' + body;
    }
    app.innerHTML = renderTop(info) + '<main class="wrap">' + body + '</main>';
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); if (selStart != null) safe(() => el.setSelectionRange(selStart, selStart)); }
    }
  }
  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  // ---------- События ----------

  app.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { ui.tab = go.dataset.go; render(); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { ui.tab = tab.dataset.tab; render(); return; }
    const pt = e.target.closest('[data-part-tab]');
    if (pt) { ui.part = pt.dataset.partTab; render(); return; }
    const pp = e.target.closest('[data-print-part]');
    if (pp) { ui.printPart = pp.dataset.printPart; ui.printSel = null; render(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'undo': undo(); break;
      case 'save-file': saveFile(); break;
      case 'open-file': openFile(); break;
      case 'edit': ui.editId = id; ui.formError = ''; render(); setTimeout(() => { const el = document.getElementById('f-weight'); if (el) el.focus(); }, 0); window.scrollTo(0, 0); break;
      case 'cancel-edit': ui.editId = null; ui.formError = ''; render(); break;
      case 'withdraw': commitWithPrintCheck((s) => { s.participants.find((p) => p.id === id).withdrawn = true; const g = GL.detach(s, id); return g ? [g] : []; }, 'Участник снят'); break;
      case 'restore': commitWithPrintCheck((s) => { s.participants.find((p) => p.id === id).withdrawn = false; return GL.placeIncremental(s, id); }, 'Участник возвращён'); break;
      case 'delete': {
        const p = state.participants.find((x) => x.id === id);
        ask({ title: 'Удалить участника?', text: GL.fullName(p) + ' будет удалён из списка и из сетки. Если человек просто не вышел — лучше нажать «Снять».', ok: 'Удалить', danger: true, onOk: () => commitWithPrintCheck((s) => { const g = GL.detach(s, id); s.participants = s.participants.filter((x) => x.id !== id); return g ? [g] : []; }, 'Удалён') });
        break;
      }
      case 'build': buildPart(id); break;
      case 'distribute': commit((s) => { GL.distributeMats(s, id, true); }, 'Сетки распределены по коврам (ручные переносы сохранены)'); break;
      case 'distribute-all': commit((s) => { GL.distributeMats(s, id, false); }, 'Сетки распределены равномерно'); break;
      case 'place-all': commitWithPrintCheck((s) => {
        const info = GL.integrity(s);
        return info.unassigned.filter((p) => GL.partOf(s, p) === id).flatMap((p) => GL.placeIncremental(s, p.id));
      }, 'Участники разложены по сеткам'); break;
      case 'up': commitWithPrintCheck((s) => {
        const g = s.grids.find((x) => x.id === b.dataset.g);
        const i = g.members.indexOf(id);
        if (i > 0) { g.members.splice(i, 1); g.members.splice(i - 1, 0, id); }
        return [g.id];
      }); break;
      case 'dissolve': commitWithPrintCheck((s) => { s.grids = s.grids.filter((g) => g.id !== b.dataset.g); return [b.dataset.g]; }, 'Сетка расформирована — участники в списке «Без сетки»'); break;
      case 'add-part': commit((s) => { s.settings.parts.push({ id: GL.uid('p'), name: 'Часть ' + (s.settings.parts.length + 1), yearFrom: null, yearTo: null, format: s.settings.formats[s.settings.formats.length - 1] || '', weightMode: 'float', limits: [], maxDiffKg: null }); }, 'Часть добавлена'); break;
      case 'del-part': {
        const part = GL.getPart(state, id);
        ask({ title: 'Удалить ' + part.name + '?', text: 'Сетки этой части будут удалены. Участники останутся в списке.', ok: 'Удалить', danger: true, onOk: () => commit((s) => {
          s.settings.parts = s.settings.parts.filter((p) => p.id !== id);
          s.grids = s.grids.filter((g) => g.partId !== id);
          delete s.builtParts[id];
          s.participants.forEach((p) => { if (p.partId === id) p.partId = ''; });
        }, 'Часть удалена') });
        break;
      }
      case 'add-test': commit((s) => { s.participants = s.participants.concat(GL.testParticipants(s, 50)); }, 'Добавлены тестовые участники'); break;
      case 'remove-test': commit((s) => {
        const ids = new Set(s.participants.filter((p) => p.test).map((p) => p.id));
        if (!ids.size) return false;
        s.participants = s.participants.filter((p) => !ids.has(p.id));
        s.grids.forEach((g) => { g.members = g.members.filter((x) => !ids.has(x)); });
        s.grids = s.grids.filter((g) => g.members.length);
      }, 'Тестовые участники удалены'); break;
      case 'reset': ask({ title: 'Начать новый турнир?', text: 'Все участники и сетки будут удалены, настройки частей останутся. Перед этим сохраните текущий турнир в файл.', ok: 'Начать новый', danger: true, onOk: () => commit((s) => {
        const fresh = GL.defaultState();
        fresh.settings = s.settings;
        fresh.settings.date = todayIso();
        return Object.assign(s, fresh);
      }, 'Новый турнир') }); break;
      case 'psel-all': GL.gridsOfPart(state, ui.printPart).forEach((g) => ui.printSel.ids.add(g.id)); render(); break;
      case 'psel-none': ui.printSel.ids.clear(); render(); break;
      case 'print': doPrint(); break;
      default: break;
    }
  });

  app.addEventListener('submit', (e) => {
    if (e.target.id === 'weigh-form') { e.preventDefault(); submitWeigh(e.target); }
  });

  app.addEventListener('input', (e) => {
    if (e.target.id === 'search') { ui.search = e.target.value; render(); }
  });

  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.set) {
      const key = t.dataset.set;
      let val = t.value;
      if (['mats', 'minSize', 'maxSize'].includes(key)) {
        val = Math.max(1, parseInt(val, 10) || 1);
        if (key === 'minSize') val = Math.min(val, state.settings.maxSize);
        if (key === 'maxSize') val = Math.max(val, state.settings.minSize);
      }
      setTimeout(() => commit((s) => { s.settings[key] = val; }), 0);
    } else if (t.dataset.list) {
      const items = t.value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!items.length) { toast('Список не может быть пустым'); render(); return; }
      setTimeout(() => commit((s) => { s.settings[t.dataset.list] = items; }), 0);
    } else if (t.dataset.part) {
      const field = t.dataset.field;
      let val = t.value;
      if (field === 'yearFrom' || field === 'yearTo') val = parseInt(val, 10) || null;
      if (field === 'maxDiffKg') val = parseFloat(String(val).replace(',', '.')) || null;
      if (field === 'limits') val = val.split(/[,;\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter((x) => x > 0).sort((a, b) => a - b);
      setTimeout(() => commit((s) => {
        const p = s.settings.parts.find((x) => x.id === t.dataset.part);
        p[field] = val;
        if (field === 'format') s.grids.forEach((g) => { if (g.partId === p.id) g.format = val; });
      }), 0);
    } else if (t.dataset.move) {
      if (t.value) moveMember(t.dataset.move, t.value);
    } else if (t.dataset.mat) {
      const gid = t.dataset.mat;
      commitWithPrintCheck((s) => { const g = s.grids.find((x) => x.id === gid); g.mat = Number(t.value); g.matManual = true; if (g.printedAt) g.dirtyAfterPrint = true; return [gid]; }, 'Ковёр изменён');
    } else if (t.dataset.format) {
      const gid = t.dataset.format;
      commitWithPrintCheck((s) => { const g = s.grids.find((x) => x.id === gid); g.format = t.value; if (g.printedAt) g.dirtyAfterPrint = true; return [gid]; });
    } else if (t.dataset.label) {
      const gid = t.dataset.label;
      commit((s) => { const g = s.grids.find((x) => x.id === gid); g.labelOverride = t.value.trim(); if (g.printedAt) g.dirtyAfterPrint = true; });
    } else if (t.dataset.lock) {
      const gid = t.dataset.lock;
      commit((s) => { s.grids.find((x) => x.id === gid).locked = t.checked; }, t.checked ? 'Сетка закреплена' : 'Сетка откреплена');
    } else if (t.dataset.psel) {
      if (t.checked) ui.printSel.ids.add(t.dataset.psel); else ui.printSel.ids.delete(t.dataset.psel);
      render();
    } else if (t.id === 'print-mat') {
      ui.printMat = t.value; render();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      undo();
    }
    if (e.key === 'Escape') closeModal();
  });

  window.addEventListener('afterprint', () => { printArea.innerHTML = ''; });

  render();
})();
