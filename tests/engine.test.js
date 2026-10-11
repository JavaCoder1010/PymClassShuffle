import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSeating } from '../js/engine.js';
import { validatePlan } from '../js/validate.js';
import { classroom, seatAt, rule, topology } from './helpers.js';

/** Generates and checks the result with the independent validator. */
function generateValid(room, options = {}) {
  const result = generateSeating(room, options);
  assert.equal(result.ok, true, `expected a plan, got ${JSON.stringify(result.ok ? null : result.problem)}`);
  const check = validatePlan(room, result.assignments);
  assert.deepEqual(check.hard, [], 'no hard rule may be broken');
  const included = room.students.filter((s) => s.included !== false);
  assert.equal(Object.keys(result.assignments).length, included.length, 'every included student is seated');
  assert.equal(new Set(Object.values(result.assignments)).size, included.length, 'no shared seats');
  return result;
}

test('valid random assignment with no rules', () => {
  const room = classroom({ rows: 3, desksPerRow: 2, seatsPerDesk: 2, students: 10 });
  const result = generateValid(room, { seed: 42 });
  assert.equal(result.uniqueness, 'new');
  assert.deepEqual(result.unmet, []);
});

test('the same seed reproduces the same plan; different seeds vary', () => {
  const room = classroom({ rows: 4, desksPerRow: 3, seatsPerDesk: 2, students: 20 });
  const a = generateValid(room, { seed: 7 });
  const b = generateValid(room, { seed: 7 });
  assert.deepEqual(a.assignments, b.assignments);
  const plans = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(generateValid(room, { seed }).assignments)));
  assert.ok(plans.size > 1);
});

test('keep apart: two students never sit next to each other', () => {
  // 4 students, 2 desks of 2: apart pair must be split across desks.
  const room = classroom({ rows: 1, desksPerRow: 2, seatsPerDesk: 2, students: 4 });
  const [alex, jordan] = room.students;
  room.rules.push(rule('apart', { studentIds: [alex.id, jordan.id] }));
  const topo = topology(room);
  for (let seed = 1; seed <= 30; seed++) {
    const { assignments } = generateValid(room, { seed });
    assert.ok(!topo.adjacent(assignments[alex.id], assignments[jordan.id]));
  }
});

test('keep together: students sit next to each other when possible', () => {
  const room = classroom({ rows: 3, desksPerRow: 2, seatsPerDesk: 3, students: 15 });
  const [a, b, c] = room.students;
  room.rules.push(rule('together', { studentIds: [a.id, b.id, c.id] }));
  const topo = topology(room);
  for (let seed = 1; seed <= 20; seed++) {
    const { assignments } = generateValid(room, { seed });
    // Three in a row of a 3-seat desk: the middle one touches both others.
    const seats = [a, b, c].map((s) => assignments[s.id]);
    const links = [[0, 1], [0, 2], [1, 2]].filter(([i, j]) => topo.adjacent(seats[i], seats[j])).length;
    assert.ok(links >= 2);
  }
});

test('fixed seat: the student always gets that seat', () => {
  const room = classroom({ rows: 3, desksPerRow: 2, seatsPerDesk: 2, students: 12 });
  const seat = seatAt(room, 2, 3);
  room.rules.push(rule('fixed', { studentIds: [room.students[5].id], seatIds: [seat.id] }));
  for (let seed = 1; seed <= 10; seed++) {
    assert.equal(generateValid(room, { seed }).assignments[room.students[5].id], seat.id);
  }
});

test('preferred seat: met when possible, reported when not', () => {
  const room = classroom({ rows: 3, desksPerRow: 2, seatsPerDesk: 2, students: 8 });
  const [sam, kai] = room.students;
  const seat = seatAt(room, 0, 0);
  room.rules.push(rule('preferred', { studentIds: [sam.id], seatIds: [seat.id], strength: 'soft' }));
  for (let seed = 1; seed <= 10; seed++) {
    const result = generateValid(room, { seed });
    assert.equal(result.assignments[sam.id], seat.id);
    assert.deepEqual(result.unmet, []);
  }
  // Kai is fixed to Sam's preferred seat: the plan is still made, the preference is reported unmet.
  const fixedRule = rule('fixed', { studentIds: [kai.id], seatIds: [seat.id] });
  room.rules.push(fixedRule);
  const result = generateValid(room, { seed: 3 });
  assert.equal(result.assignments[kai.id], seat.id);
  assert.equal(result.unmet.length, 1);
  assert.equal(result.unmet[0].type, 'preferred');
});

test('avoid seats: the student never sits in the avoided seats', () => {
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 2, students: 6 });
  const avoided = room.seats.slice(0, 6).map((s) => s.id);
  const student = room.students[0];
  room.rules.push(rule('avoid', { studentIds: [student.id], seatIds: avoided }));
  for (let seed = 1; seed <= 10; seed++) {
    assert.ok(!avoided.includes(generateValid(room, { seed }).assignments[student.id]));
  }
});

test('front and back rows', () => {
  const room = classroom({ rows: 5, desksPerRow: 2, seatsPerDesk: 2, students: 16 });
  const [front, back] = room.students;
  room.rules.push(rule('front', { studentIds: [front.id], params: { rows: 1 } }));
  room.rules.push(rule('back', { studentIds: [back.id], params: { rows: 2 }, strength: 'hard' }));
  const topo = topology(room);
  for (let seed = 1; seed <= 10; seed++) {
    const { assignments } = generateValid(room, { seed });
    assert.equal(topo.rowRank(assignments[front.id]), 0);
    assert.ok(topo.rowRank(assignments[back.id]) >= 3);
  }
});

test('insufficient seats is reported before searching', () => {
  const room = classroom({ rows: 1, desksPerRow: 2, seatsPerDesk: 2, students: 5 });
  const result = generateSeating(room, { seed: 1 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.problem, { kind: 'not-enough-seats', students: 5, seats: 4 });
});

test('excluded students are not seated and do not count against seats', () => {
  const room = classroom({ rows: 1, desksPerRow: 2, seatsPerDesk: 2, students: 5 });
  room.students[4].included = false;
  const result = generateValid(room, { seed: 1 });
  assert.equal(result.assignments[room.students[4].id], undefined);
});

test('contradictory hard rules: the conflicting rules are identified', () => {
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 2, students: 6 });
  const [a, b, c] = room.students;
  const apart = rule('apart', { studentIds: [a.id, b.id] });
  const together = rule('together', { studentIds: [a.id, b.id] });
  const unrelated = rule('apart', { studentIds: [b.id, c.id] });
  room.rules.push(unrelated, apart, together);
  const result = generateSeating(room, { seed: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.problem.kind, 'conflict');
  assert.deepEqual([...result.problem.ruleIds].sort(), [apart.id, together.id].sort());
});

test('a group too big for any desk: the one impossible rule is named, quickly', () => {
  // Desks of 2 with aisles and no front/back neighbours: 3 students can never sit together.
  const room = classroom({ rows: 6, desksPerRow: 3, seatsPerDesk: 2, students: 30 });
  const s = room.students;
  const together = rule('together', { studentIds: [s[0].id, s[1].id, s[2].id] });
  room.rules.push(together);
  for (let i = 5; i < 15; i++) room.rules.push(rule('apart', { studentIds: [s[i].id, s[i + 10].id] }));
  const started = Date.now();
  const result = generateSeating(room, { seed: 1 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.problem, { kind: 'conflict', ruleIds: [together.id] });
  assert.ok(Date.now() - started < 1000);
});

test('two students fixed to the same seat: crowded group explained', () => {
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 2, students: 4 });
  const [alex, jordan] = room.students;
  const seat = seatAt(room, 0, 0).id;
  const r1 = rule('fixed', { studentIds: [alex.id], seatIds: [seat] });
  const r2 = rule('fixed', { studentIds: [jordan.id], seatIds: [seat] });
  room.rules.push(r1, r2);
  const result = generateSeating(room, { seed: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.problem.kind, 'crowded');
  assert.deepEqual([...result.problem.studentIds].sort(), [alex.id, jordan.id].sort());
  assert.deepEqual(result.problem.seatIds, [seat]);
  assert.deepEqual([...result.problem.ruleIds].sort(), [r1.id, r2.id].sort());
});

test('a student left with no seat: the rules that rule out every seat are named', () => {
  const room = classroom({ rows: 3, desksPerRow: 1, seatsPerDesk: 2, students: 2 });
  const student = room.students[0];
  const front = rule('front', { studentIds: [student.id], params: { rows: 1 } });
  const avoidFront = rule('avoid', { studentIds: [student.id], seatIds: [seatAt(room, 0, 0).id, seatAt(room, 0, 1).id] });
  const harmless = rule('avoid', { studentIds: [student.id], seatIds: [seatAt(room, 2, 0).id] });
  room.rules.push(front, harmless, avoidFront);
  const result = generateSeating(room, { seed: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.problem.kind, 'no-seat');
  assert.deepEqual([...result.problem.ruleIds].sort(), [front.id, avoidFront.id].sort());
});

test('fixed seat on a disabled seat is reported, never violated', () => {
  const room = classroom({ rows: 2, desksPerRow: 1, seatsPerDesk: 2, students: 2 });
  const seat = seatAt(room, 0, 0);
  seat.enabled = false;
  const fixed = rule('fixed', { studentIds: [room.students[0].id], seatIds: [seat.id] });
  room.rules.push(fixed);
  const result = generateSeating(room, { seed: 1 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.problem, { kind: 'no-seat', studentId: room.students[0].id, ruleIds: [fixed.id] });
});

test('disabled seats and gaps are respected', () => {
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 2, students: 6 });
  const disabled = [seatAt(room, 0, 0), seatAt(room, 1, 4)];
  disabled.forEach((s) => (s.enabled = false));
  const [a, b] = room.students;
  room.rules.push(rule('apart', { studentIds: [a.id, b.id] }));
  for (let seed = 1; seed <= 10; seed++) {
    const { assignments } = generateValid(room, { seed });
    for (const s of disabled) assert.ok(!Object.values(assignments).includes(s.id));
  }
});

test('duplicate names are distinct students', () => {
  const room = classroom({ rows: 1, desksPerRow: 2, seatsPerDesk: 2, names: ['Sam K.', 'Sam K.', 'Ana', 'Leo'] });
  const [sam1, sam2] = room.students;
  room.rules.push(rule('apart', { studentIds: [sam1.id, sam2.id] }));
  const topo = topology(room);
  const { assignments } = generateValid(room, { seed: 5 });
  assert.notEqual(assignments[sam1.id], assignments[sam2.id]);
  assert.ok(!topo.adjacent(assignments[sam1.id], assignments[sam2.id]));
});

test('successive generations keep all hard rules and differ from the previous plan', () => {
  const room = classroom({ rows: 4, desksPerRow: 3, seatsPerDesk: 2, students: 22 });
  const s = room.students;
  room.rules.push(
    rule('apart', { studentIds: [s[0].id, s[1].id, s[2].id] }),
    rule('together', { studentIds: [s[3].id, s[4].id] }),
    rule('fixed', { studentIds: [s[5].id], seatIds: [seatAt(room, 0, 0).id] }),
    rule('front', { studentIds: [s[6].id, s[7].id], params: { rows: 2 } }),
    rule('avoid', { studentIds: [s[8].id], seatIds: [seatAt(room, 3, 7).id] }),
    rule('preferred', { studentIds: [s[9].id], seatIds: [seatAt(room, 1, 1).id], strength: 'soft' }),
  );
  let previous = null;
  for (let seed = 1; seed <= 12; seed++) {
    const result = generateValid({ ...room, previous }, { seed });
    if (previous) {
      assert.equal(result.uniqueness, 'different');
      assert.notDeepEqual(result.assignments, previous);
    }
    previous = result.assignments;
  }
});

test('only one valid arrangement: reported instead of faking a new one', () => {
  const room = classroom({ rows: 1, desksPerRow: 1, seatsPerDesk: 2, students: 2 });
  const [a, b] = room.students;
  room.rules.push(rule('fixed', { studentIds: [a.id], seatIds: [seatAt(room, 0, 0).id] }));
  const first = generateValid(room, { seed: 1 });
  assert.equal(first.assignments[b.id], seatAt(room, 0, 1).id);
  const again = generateValid({ ...room, previous: first.assignments }, { seed: 2 });
  assert.equal(again.uniqueness, 'only-one');
  assert.deepEqual(again.assignments, first.assignments);
});

test('search budget: hard cases fail gracefully instead of hanging', () => {
  // 9 students who must all sit apart in 2 rows of 8 joined seats (at most 4 per row): impossible,
  // but proving it takes many steps. With a tiny budget the engine must stop and say so.
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 4, aisles: false, students: 12 });
  room.rules.push(rule('apart', { studentIds: room.students.slice(0, 9).map((s) => s.id) }));
  const started = Date.now();
  const result = generateSeating(room, { seed: 1, maxNodes: 50, attempts: 2, explainNodes: 50 });
  assert.equal(result.ok, false);
  assert.ok(['limit', 'conflict'].includes(result.problem.kind));
  assert.ok(Date.now() - started < 2000);
});

test('students are not favoured by list order (preferences treated alike)', () => {
  // Two students prefer the same seat; over many runs each should get it sometimes.
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 2, students: 6 });
  const [first, second] = room.students;
  const seat = seatAt(room, 0, 0).id;
  room.rules.push(
    rule('preferred', { studentIds: [first.id], seatIds: [seat], strength: 'soft' }),
    rule('preferred', { studentIds: [second.id], seatIds: [seat], strength: 'soft' }),
  );
  const wins = { first: 0, second: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const { assignments } = generateValid(room, { seed });
    if (assignments[first.id] === seat) wins.first++;
    if (assignments[second.id] === seat) wins.second++;
  }
  assert.equal(wins.first + wins.second, 40);
  assert.ok(wins.first >= 8 && wins.second >= 8, JSON.stringify(wins));
});
