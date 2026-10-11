import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeStudent, removeSeats, removeStudents, setIncluded, setSeatEnabled, applyGridLayout } from '../js/classroom.js';
import { createClassroom, createStudent, createRule, parseNames, studentLabels, duplicateIds } from '../js/model.js';

function room() {
  const doc = createClassroom({ name: 'Test', rows: 2, desksPerRow: 2, seatsPerDesk: 2 });
  doc.students = ['Ana', 'Ben', 'Cy'].map((n) => createStudent(n));
  const [a, b] = doc.students;
  doc.plan = { id: 'p', createdAt: '', assignments: { [a.id]: doc.seats[0].id, [b.id]: doc.seats[1].id }, generated: null, edited: false };
  return doc;
}

test('placing a student: move to an empty seat, swap with an occupant, displace when coming from no seat', () => {
  const doc = room();
  const [a, b, c] = doc.students;
  const s = doc.seats.map((x) => x.id);
  assert.deepEqual(placeStudent(doc.plan.assignments, a.id, s[2]).assignments, { [a.id]: s[2], [b.id]: s[1] });
  assert.deepEqual(placeStudent(doc.plan.assignments, a.id, s[1]).assignments, { [a.id]: s[1], [b.id]: s[0] });
  const fromTray = placeStudent(doc.plan.assignments, c.id, s[0]);
  assert.deepEqual(fromTray.assignments, { [c.id]: s[0], [b.id]: s[1] });
  assert.equal(fromTray.displaced, a.id);
});

test('removing a seat unseats its student and drops rules left without seats', () => {
  const doc = room();
  const [a] = doc.students;
  const seat = doc.seats[0].id;
  doc.rules.push(createRule('fixed', { studentIds: [a.id], seatIds: [seat] }));
  doc.rules.push(createRule('avoid', { studentIds: [a.id], seatIds: [seat, doc.seats[3].id] }));
  const dropped = removeSeats(doc, [seat]);
  assert.equal(dropped, 1);
  assert.equal(doc.plan.assignments[a.id], undefined);
  assert.deepEqual(doc.rules.map((r) => r.type), ['avoid']);
  assert.deepEqual(doc.rules[0].seatIds, [doc.seats[2].id]);
});

test('removing students cleans plans and rules', () => {
  const doc = room();
  const [a, b, c] = doc.students;
  doc.rules.push(createRule('apart', { studentIds: [a.id, b.id] }), createRule('together', { studentIds: [a.id, b.id, c.id] }));
  doc.saved.push({ id: 's', name: 'x', createdAt: '', assignments: { ...doc.plan.assignments } });
  const dropped = removeStudents(doc, [b.id]);
  assert.equal(dropped, 1); // apart lost its second student
  assert.deepEqual(doc.rules[0].studentIds, [a.id, c.id]);
  assert.equal(doc.plan.assignments[b.id], undefined);
  assert.equal(doc.saved[0].assignments[b.id], undefined);
});

test('excluding a student or disabling their seat takes them out of the plan', () => {
  const doc = room();
  const [a, b] = doc.students;
  setIncluded(doc, a.id, false);
  assert.equal(doc.plan.assignments[a.id], undefined);
  setSeatEnabled(doc, doc.seats[1].id, false);
  assert.equal(doc.plan.assignments[b.id], undefined);
});

test('quick layout keeps seats (and their students) that stay in place', () => {
  const doc = room();
  const [a] = doc.students;
  const keptSeat = doc.plan.assignments[a.id];
  applyGridLayout(doc, { rows: 3, desksPerRow: 2, seatsPerDesk: 2, aisles: true });
  assert.equal(doc.seats.length, 12);
  assert.equal(doc.plan.assignments[a.id], keptSeat);
  applyGridLayout(doc, { rows: 1, desksPerRow: 1, seatsPerDesk: 1, aisles: false });
  assert.equal(doc.seats.length, 1);
  assert.equal(doc.plan.assignments[a.id], keptSeat); // seat (0,0) survived
});

test('pasted lists: bullets and numbering are stripped, blank lines ignored', () => {
  assert.deepEqual(parseNames('1. Ana  Lopez\n2) Ben\n- Cy\n• Dee\n\n  Eve  \r\nFay'), ['Ana Lopez', 'Ben', 'Cy', 'Dee', 'Eve', 'Fay']);
});

test('duplicate names get distinct labels and are flagged', () => {
  const students = ['Sam K.', 'sam k.', 'Ana'].map((n) => createStudent(n));
  const labels = studentLabels(students);
  assert.equal(labels.get(students[0].id), 'Sam K.');
  assert.equal(labels.get(students[1].id), 'sam k. (2)');
  assert.deepEqual([...duplicateIds(students)].sort(), [students[0].id, students[1].id].sort());
});
