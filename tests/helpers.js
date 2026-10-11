// Test helpers: small classrooms built without the UI.
import { gridSeats, buildTopology } from '../js/layout.js';
import { createRule } from '../js/model.js';

let counter = 0;
const id = (prefix) => `${prefix}${++counter}`;

/** Classroom with `rows` × `desksPerRow` desks of `seatsPerDesk`, aisles between desks. */
export function classroom({ rows = 3, desksPerRow = 2, seatsPerDesk = 2, aisles = true, students = 0, names } = {}) {
  const grid = gridSeats({ rows, desksPerRow, seatsPerDesk, aisles }, () => id('seat'));
  const list = (names ?? Array.from({ length: students }, (_, i) => `Student ${i + 1}`)).map((name) => ({
    id: id('student'),
    name,
    notes: '',
    included: true,
    createdAt: '',
  }));
  return { seats: grid.seats, students: list, rules: [], adjacency: { frontBack: false, diagonal: false } };
}

/** Seat at a grid cell. */
export const seatAt = (room, row, col) => room.seats.find((s) => s.row === row && s.col === col);

export const rule = (type, fields) => createRule(type, fields);

export const topology = (room) => buildTopology(room.seats, room.adjacency);
