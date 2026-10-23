// Проверки логики шахматок: node gladiator/tests/run-tests.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/logic.js';

const GL = globalThis.GL;

function person(id, weight, extra = {}) {
  return { id, lastName: 'Ф' + id, firstName: 'И', birthDate: '2021-05-05', sex: 'М', weight, level: 'Новичок', withdrawn: false, ...extra };
}

function stateWith(people, patch = {}) {
  const s = GL.defaultState();
  s.settings.date = '2026-10-18';
  Object.assign(s.settings, patch);
  s.participants = people;
  return s;
}

test('круги для 4 участников совпадают с бланком', () => {
  assert.deepEqual(GL.roundRobin(4), [
    [[1, 2], [4, 3]],
    [[1, 3], [2, 4]],
    [[1, 4], [3, 2]],
  ]);
});

for (const n of [2, 3, 4, 5, 6]) {
  test(`круговая система для ${n}: каждая пара ровно один раз, никто дважды в круге`, () => {
    const rounds = GL.roundRobin(n);
    const seen = new Set();
    for (const r of rounds) {
      const inRound = new Set();
      for (const [a, b] of r) {
        assert.ok(!inRound.has(a) && !inRound.has(b));
        inRound.add(a); inRound.add(b);
        const key = [a, b].sort().join('-');
        assert.ok(!seen.has(key), 'повтор пары ' + key);
        seen.add(key);
      }
    }
    assert.equal(seen.size, GL.bouts(n));
  });
}

test('разбивка без хвостов из 1–2 человек для любого числа от 3 до 60', () => {
  for (let n = 3; n <= 60; n += 1) {
    const items = Array.from({ length: n }, (_, i) => ({ weight: 20 + i * 0.7 }));
    const chunks = GL.partitionByWeight(items, 3, 5, null);
    assert.equal(chunks.flat().length, n);
    for (const c of chunks) assert.ok(c.length >= 3 && c.length <= 5, `n=${n}: сетка из ${c.length}`);
  }
});

test('разбивка держит близкие веса вместе', () => {
  const ws = [20, 20.5, 21, 30, 30.2, 30.4];
  const chunks = GL.partitionByWeight(ws.map((weight) => ({ weight })), 3, 5, null);
  assert.deepEqual(chunks.map((c) => c.map((x) => x.weight)), [[20, 20.5, 21], [30, 30.2, 30.4]]);
});

test('сборка части: никто не потерян и не попал в две сетки', () => {
  const s = GL.defaultState();
  s.participants = GL.testParticipants(s, 50);
  for (const part of s.settings.parts) GL.buildPart(s, part.id);
  const info = GL.integrity(s);
  assert.equal(info.unassigned.length, 0);
  assert.equal(info.duplicates.length, 0);
  assert.equal(info.inGrids, s.participants.length);
});

test('сетка содержит один пол и один уровень', () => {
  const people = [
    person('a', 20), person('b', 21), person('c', 22),
    person('d', 20, { sex: 'Ж' }), person('e', 21, { sex: 'Ж' }), person('f', 22, { sex: 'Ж' }),
  ];
  const s = stateWith(people);
  GL.buildPart(s, 'p1');
  const pm = GL.participantsMap(s);
  for (const g of s.grids) {
    const sexes = new Set(g.members.map((id) => pm.get(id).sex));
    assert.equal(sexes.size, 1);
  }
  assert.equal(s.grids.length, 2);
});

test('ковры загружены равномерно по числу схваток', () => {
  const s = GL.defaultState();
  s.participants = GL.testParticipants(s, 50);
  GL.buildPart(s, 'p2');
  const loads = GL.matLoads(s, 'p2');
  const maxGrid = Math.max(...GL.gridsOfPart(s, 'p2').map((g) => GL.bouts(g.members.length)));
  assert.ok(Math.max(...loads) - Math.min(...loads) <= maxGrid, loads.join(','));
});

test('добавление опоздавшего меняет только одну сетку, если есть место', () => {
  const people = [person('a', 20), person('b', 20.4), person('c', 20.8), person('d', 30), person('e', 30.3), person('f', 30.6)];
  const s = stateWith(people);
  GL.buildPart(s, 'p1');
  const before = JSON.stringify(s.grids.find((g) => g.members.includes('d')));
  s.participants.push(person('x', 20.6));
  const affected = GL.placeIncremental(s, 'x');
  assert.equal(affected.length, 1);
  assert.ok(s.grids.find((g) => g.id === affected[0]).members.includes('a'));
  assert.equal(JSON.stringify(s.grids.find((g) => g.members.includes('d'))), before);
});

test('изменённая после печати сетка помечается на перепечатку', () => {
  const people = [person('a', 20), person('b', 20.4), person('c', 20.8), person('d', 21)];
  const s = stateWith(people);
  GL.buildPart(s, 'p1');
  s.grids[0].printedAt = '2026-10-18T08:00:00Z';
  GL.detach(s, 'd');
  assert.equal(s.grids[0].dirtyAfterPrint, true);
});

test('фиксированные категории делятся на подгруппы а, б', () => {
  const people = Array.from({ length: 8 }, (_, i) => person('p' + i, 21 + i * 0.3));
  const s = stateWith(people);
  s.settings.parts[0].weightMode = 'fixed';
  s.settings.parts[0].limits = [24, 26];
  GL.buildPart(s, 'p1');
  const labels = Object.values(GL.gridLabels(s, 'p1')).sort();
  assert.deepEqual(labels, ['24а', '24б']);
});

test('плавающая категория — вес самого тяжёлого, округлённый вверх', () => {
  const s = stateWith([person('a', 22.1), person('b', 22.9), person('c', 23.4)]);
  GL.buildPart(s, 'p1');
  assert.deepEqual(Object.values(GL.gridLabels(s, 'p1')), ['24']);
});

test('дата на бланке как в образце', () => {
  assert.equal(GL.formatRuDate('2026-10-18'), '«18» октября 2026 г.');
  assert.equal(GL.toRoman(3), 'III');
});

test('файл турнира проходит сохранение и открытие', () => {
  const s = GL.defaultState();
  s.participants = GL.testParticipants(s, 5);
  GL.buildPart(s, 'p1');
  const back = GL.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(back.participants.length, s.participants.length);
  assert.throws(() => GL.migrate({ foo: 1 }));
});

test('две девочки одного уровня не остаются отдельной сеткой — объединяются с соседним уровнем', () => {
  const people = [
    person('g1', 20, { sex: 'Ж', level: 'Новичок' }), person('g2', 21, { sex: 'Ж', level: 'Новичок' }),
    person('g3', 20.5, { sex: 'Ж', level: 'Средний' }), person('g4', 21.5, { sex: 'Ж', level: 'Средний' }), person('g5', 22, { sex: 'Ж', level: 'Средний' }),
  ];
  const s = stateWith(people);
  GL.buildPart(s, 'p1');
  assert.equal(GL.integrity(s).small.length, 0);
  assert.equal(s.grids.length, 1);
});

test('одиночку без пары оставляем видимой проблемой, а не теряем', () => {
  const s = stateWith([person('a', 20), person('b', 21), person('c', 22), person('z', 30, { sex: 'Ж' })]);
  GL.buildPart(s, 'p1');
  const info = GL.integrity(s);
  assert.equal(info.small.length, 1);
  assert.equal(info.inGrids, 4);
});

test('список из Excel: даты в разных видах, заголовок пропускается, ошибки называются', () => {
  const { items, errors } = GL.parseRosterText('Фамилия\tИмя\tДата\nПанков\tМирон\t04.03.2021\tМ\tНовичок\tФилиал 1\tИванов\nПепеляева;Мария;2020-1-5;ж\nБездаты\tИван\t\n');
  assert.equal(items.length, 2);
  assert.equal(items[0].birthDate, '2021-03-04');
  assert.equal(items[1].birthDate, '2020-01-05');
  assert.equal(items[1].sex, 'Ж');
  assert.equal(errors.length, 1);
});

test('справочник: повторное добавление обновляет запись, поиск по началу фамилии без учёта ё', () => {
  const s = GL.defaultState();
  GL.rosterUpsert(s, { lastName: 'Сёмин', firstName: 'Лев', birthDate: '2019-02-02', sex: 'М', branch: 'Филиал 1' });
  GL.rosterUpsert(s, { lastName: 'Семин', firstName: 'Лев', birthDate: '2019-02-02', branch: 'Филиал 2' });
  assert.equal(s.roster.length, 1);
  assert.equal(s.roster[0].branch, 'Филиал 2');
  assert.equal(GL.rosterFind(s, 'сем').length, 1);
  assert.equal(GL.rosterFind(s, 'лев').length, 0);
});

test('файл версии 1 открывается: два формата борьбы вместо трёх', () => {
  const old = GL.defaultState();
  old.schema = 1;
  old.settings.formats = ['На коленках без курток', 'На коленках', 'В стойке'];
  delete old.roster;
  const s = GL.migrate(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(s.settings.formats, ['На коленках', 'В стойке']);
  assert.deepEqual(s.roster, []);
});
