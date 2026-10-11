import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan } from '../js/validate.js';
import { generateSeating } from '../js/engine.js';
import { classroom, seatAt, rule } from './helpers.js';

test('a manual move that seats an apart pair together is a hard violation', () => {
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 2, students: 4 });
  const [a, b, c, d] = room.students;
  const apart = rule('apart', { studentIds: [a.id, b.id] });
  room.rules.push(apart);
  const plan = { [a.id]: seatAt(room, 0, 0).id, [b.id]: seatAt(room, 0, 3).id, [c.id]: seatAt(room, 0, 1).id, [d.id]: seatAt(room, 1, 0).id };
  assert.equal(validatePlan(room, plan).valid, true);
  // Swap B and C: B now sits next to A.
  const moved = { ...plan, [b.id]: plan[c.id], [c.id]: plan[b.id] };
  const check = validatePlan(room, moved);
  assert.equal(check.valid, false);
  assert.equal(check.hard.length, 1);
  assert.equal(check.hard[0].ruleId, apart.id);
  assert.deepEqual([...check.hard[0].studentIds].sort(), [a.id, b.id].sort());
});

test('moving a student out of a fixed seat is a hard violation; out of a preferred seat a warning', () => {
  const room = classroom({ rows: 1, desksPerRow: 2, seatsPerDesk: 2, students: 2 });
  const [a, b] = room.students;
  room.rules.push(rule('fixed', { studentIds: [a.id], seatIds: [seatAt(room, 0, 0).id] }));
  room.rules.push(rule('preferred', { studentIds: [b.id], seatIds: [seatAt(room, 0, 4).id], strength: 'soft' }));
  const check = validatePlan(room, { [a.id]: seatAt(room, 0, 1).id, [b.id]: seatAt(room, 0, 3).id });
  assert.deepEqual(check.hard.map((i) => i.type), ['fixed']);
  assert.deepEqual(check.soft.map((i) => i.type), ['preferred']);
});

test('structural problems: shared, disabled and missing seats; unseated students', () => {
  const room = classroom({ rows: 1, desksPerRow: 2, seatsPerDesk: 2, students: 4 });
  const [a, b, c, d] = room.students;
  const off = seatAt(room, 0, 4);
  off.enabled = false;
  const check = validatePlan(room, {
    [a.id]: seatAt(room, 0, 0).id,
    [b.id]: seatAt(room, 0, 0).id,
    [c.id]: off.id,
    [d.id]: 'gone',
  });
  assert.deepEqual(check.hard.map((i) => i.code).sort(), ['seat-disabled', 'seat-missing', 'seat-shared']);
  const partial = validatePlan(room, { [a.id]: seatAt(room, 0, 0).id });
  assert.equal(partial.valid, true);
  assert.equal(partial.notices.filter((n) => n.code === 'unseated').length, 3);
});

test('turned-off rules and rules about excluded students do not apply', () => {
  const room = classroom({ rows: 1, desksPerRow: 1, seatsPerDesk: 3, students: 3 });
  const [a, b, c] = room.students;
  const seats = room.seats.map((s) => s.id);
  const plan = { [a.id]: seats[0], [b.id]: seats[1], [c.id]: seats[2] };
  room.rules.push(rule('apart', { studentIds: [a.id, b.id], active: false }));
  assert.equal(validatePlan(room, plan).valid, true);
  room.rules.push(rule('apart', { studentIds: [b.id, c.id] }));
  assert.equal(validatePlan(room, plan).valid, false);
  c.included = false;
  const { [c.id]: _, ...withoutC } = plan;
  assert.equal(validatePlan(room, withoutC).valid, true);
});

test('front/back adjacency setting changes what "next to" means', () => {
  const room = classroom({ rows: 2, desksPerRow: 1, seatsPerDesk: 1, students: 2 });
  const [a, b] = room.students;
  room.rules.push(rule('apart', { studentIds: [a.id, b.id] }));
  const plan = { [a.id]: seatAt(room, 0, 0).id, [b.id]: seatAt(room, 1, 0).id };
  assert.equal(validatePlan(room, plan).valid, true);
  room.adjacency = { frontBack: true, diagonal: false };
  assert.equal(validatePlan(room, plan).valid, false);
  // And the engine agrees: with front/back adjacency there is no valid plan.
  const result = generateSeating(room, { seed: 1 });
  assert.equal(result.ok, false);
});
