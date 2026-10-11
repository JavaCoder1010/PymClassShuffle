import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridSeats, buildTopology, seatLabels, rowLetter, componentCount } from '../js/layout.js';
import { classroom, seatAt } from './helpers.js';

test('grid with aisles: desks of 2 separated by an empty column', () => {
  const { cols, seats } = gridSeats({ rows: 2, desksPerRow: 3, seatsPerDesk: 2, aisles: true }, () => Math.random().toString());
  assert.equal(cols, 8); // 2 + aisle + 2 + aisle + 2
  assert.equal(seats.length, 12);
  assert.deepEqual([...new Set(seats.map((s) => s.col))].sort((a, b) => a - b), [0, 1, 3, 4, 6, 7]);
});

test('re-layout keeps the id of seats at the same cell', () => {
  let n = 0;
  const first = gridSeats({ rows: 2, desksPerRow: 1, seatsPerDesk: 2, aisles: false }, () => `s${++n}`);
  const second = gridSeats({ rows: 3, desksPerRow: 1, seatsPerDesk: 2, aisles: false }, () => `s${++n}`, first.seats);
  assert.deepEqual(second.seats.slice(0, 4).map((s) => s.id), first.seats.map((s) => s.id));
});

test('left/right in the same row are adjacent; aisles break adjacency', () => {
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 2 });
  const topo = buildTopology(room.seats, room.adjacency);
  assert.ok(topo.adjacent(seatAt(room, 0, 0).id, seatAt(room, 0, 1).id));
  assert.ok(!topo.adjacent(seatAt(room, 0, 1).id, seatAt(room, 0, 3).id), 'aisle between desks');
  assert.ok(!topo.adjacent(seatAt(room, 0, 0).id, seatAt(room, 1, 0).id), 'front/back off by default');
  assert.ok(!topo.adjacent(seatAt(room, 0, 0).id, seatAt(room, 1, 1).id), 'diagonal off by default');
});

test('front/back and diagonal adjacency are configurable', () => {
  const room = classroom({ rows: 2, desksPerRow: 1, seatsPerDesk: 2 });
  const frontBack = buildTopology(room.seats, { frontBack: true, diagonal: false });
  assert.ok(frontBack.adjacent(seatAt(room, 0, 0).id, seatAt(room, 1, 0).id));
  assert.ok(!frontBack.adjacent(seatAt(room, 0, 0).id, seatAt(room, 1, 1).id));
  const diagonal = buildTopology(room.seats, { frontBack: false, diagonal: true });
  assert.ok(diagonal.adjacent(seatAt(room, 0, 0).id, seatAt(room, 1, 1).id));
});

test('disabled seats are not usable and break adjacency', () => {
  const room = classroom({ rows: 1, desksPerRow: 1, seatsPerDesk: 3 });
  seatAt(room, 0, 1).enabled = false;
  const topo = buildTopology(room.seats, room.adjacency);
  assert.equal(topo.usableIds.length, 2);
  assert.ok(!topo.adjacent(seatAt(room, 0, 0).id, seatAt(room, 0, 2).id));
  assert.equal(topo.distance(seatAt(room, 0, 0).id, seatAt(room, 0, 2).id), Infinity);
});

test('labels: row letters from the front, positions from the left, custom labels win', () => {
  const room = classroom({ rows: 2, desksPerRow: 2, seatsPerDesk: 1 });
  seatAt(room, 1, 2).label = 'Window';
  const labels = seatLabels(room.seats);
  assert.equal(labels.get(seatAt(room, 0, 0).id), 'A1');
  assert.equal(labels.get(seatAt(room, 0, 2).id), 'A2');
  assert.equal(labels.get(seatAt(room, 1, 2).id), 'Window');
  assert.equal(rowLetter(26), 'AA');
});

test('row ranks and front/back rows count only rows with usable seats', () => {
  const room = classroom({ rows: 4, desksPerRow: 1, seatsPerDesk: 1 });
  seatAt(room, 3, 0).enabled = false;
  const topo = buildTopology(room.seats, room.adjacency);
  assert.equal(topo.rowCount, 3);
  assert.ok(topo.inBackRows(seatAt(room, 2, 0).id, 1));
  assert.ok(topo.inFrontRows(seatAt(room, 1, 0).id, 2));
  assert.ok(!topo.inFrontRows(seatAt(room, 2, 0).id, 2));
});

test('componentCount finds connected groups of seats', () => {
  const room = classroom({ rows: 1, desksPerRow: 2, seatsPerDesk: 2 });
  const topo = buildTopology(room.seats, room.adjacency);
  const ids = (cols) => cols.map((c) => seatAt(room, 0, c).id);
  assert.equal(componentCount(topo, ids([0, 1])), 1);
  assert.equal(componentCount(topo, ids([0, 1, 3])), 2);
});
