# ClassShuffle

**Randomized. Not random.** Classroom seating plans that follow the teacher's rules: who sits apart, who sits together, fixed and preferred seats, front or back rows, seats to avoid.

Built from the ClassShuffle product spec.

## Running it

No build step and no runtime dependencies (same setup as PymPocket). From this folder:

```bash
npm start
```

Then open <http://localhost:8020>. (`index.html` can't be opened by double-clicking: browsers block JavaScript modules on `file://` addresses.)

| Command | What it does |
|---|---|
| `npm start` | Local server on port 8020 (`http-server`, fetched by `npx`) |
| `npm test` | Engine, validator, layout and classroom tests (Node's built-in test runner, Node 20+) |
| `npm run typecheck` | Type-checks the core modules from their JSDoc types (TypeScript fetched by `npx`) |
| `npm run build:offline` | Builds `dist/ClassShuffle.html`, the offline version (esbuild fetched by `npx`) |

### Offline version (no server, no internet)

`npm run build:offline` bundles the whole app — HTML, CSS, JavaScript and icon — into a single `dist/ClassShuffle.html`. Copy it to a desktop or USB stick and open it with a double-click; it needs no server or internet. The PyM Technologies site offers it for download (its `npm run sync:classshuffle` rebuilds it).

The offline version saves its data separately from the web version (its own storage keys). To bring a classroom from one to the other, use **Download classroom backup** in one and **Import backup file** in the other.

Data is saved in the browser (localStorage) per classroom. **Saved → Download classroom backup** exports a `.json` file that can be imported on another computer or browser.

## Using it

1. **Create a classroom**: rows, desks per row, seats per desk, aisles. Then use **Edit layout** to add, remove, move (drag), rename or mark seats unavailable.
2. **Add students**: one at a time, or **Paste a list** (one name per line, bullets and numbering are stripped). Repeated names are allowed and flagged ("Same name"). The checkbox leaves a student out of the arrangement without deleting them.
3. **Add rules** in plain language. Each rule is either **Must** (never broken) or **Try to** (a preference).
4. **Generate seating plan**. Then **Generate another arrangement** for a different valid one.
5. Adjust by hand: drag a student to another seat, or click a student and then a seat (this also works with the keyboard). A move that would break a Must rule is not made. ClassShuffle explains why, and you can cancel or relax that rule. Unmet preferences show as warnings.
6. **Print** the chart, download a **CSV**, or **Save** arrangements to switch back to later.

Undo/redo covers every change (Ctrl+Z / Ctrl+Shift+Z). A clearly labelled demo classroom with made-up students (already seated) is available from the start screen, or directly with `?demo` in the URL (used by the PyM Technologies portfolio site).

## How the seating engine works

`js/engine.js` (pure, no DOM, tested on its own):

1. **Seat options.** Every included student starts with all usable seats. Hard rules about a student's own seat (fixed, front/back rows, avoid) narrow those options up front.
2. **Quick feasibility checks** with specific explanations: enough seats; no student left without options (naming the smallest set of rules that rule out every seat); no group of students squeezed into fewer seats than they need (found with a bipartite matching, Hall's theorem).
3. **Rule-by-rule consistency.** For each rule linking students, seats from which that rule can't be met even on its own are removed. For example, a group of three who must sit together can't start at a desk of two.
4. **Backtracking search** with *minimum remaining values* (always seat next the student with the fewest options; ties broken at random) and **forward checking** (after each choice, seats that would break a hard rule are removed from the other students' options). Seats are tried in random order. A node budget per attempt stops runaway cases.
5. **Improvement** by simulated annealing: random moves and swaps that keep every hard rule are accepted when they meet more preferences. A small pull away from the previous arrangement makes successive plans differ.
6. **Independent validation** (`js/validate.js`) re-checks the final arrangement from scratch before it's returned.

When no arrangement exists, the engine finds a **minimal set of conflicting rules**: it drops rules one at a time while the problem stays provably impossible, first using only the students those rules mention. If the previous arrangement turns out to be the only valid one, it says so instead of pretending to shuffle. Randomness is seeded (each plan stores its seed). Valid arrangements are explored in random order, but the distribution is **not** claimed to be uniform.

"Next to each other" (`js/layout.js`) is a graph built from the floor plan, separate from the drawing: seats left/right in the same row are neighbours unless an aisle, gap or unavailable seat separates them. Front/behind and diagonal neighbours are optional (**Edit layout → "Next to" rules**).

## Structure

```
index.html              Page shell and icon sprite
css/app.css             Design tokens, components, chart, print styles
js/model.js             Data model (Classroom, Seat, Student, Rule, SeatingPlan) and factories
js/layout.js            Seat grid, labels, adjacency model ("next to")
js/constraints.js       Rule types: meaning (evaluate) and search hooks; add new types here
js/engine.js            Seating assignment engine
js/validate.js          Independent arrangement checker
js/rng.js               Seeded random numbers
js/classroom.js         Consistent edits (removing seats/students cleans plans and rules)
js/store.js             State, undo/redo, autosave, derived view data
js/repo.js              Persistence (localStorage, async API — swappable for a server)
js/export.js            CSV and printable chart
js/demo.js              Optional demo classroom
js/i18n.js, js/i18n/    Texts (English); add a language by adding a dictionary
js/ui/                  Interface: chart, drag and drop, students, rules, plan, layout tools, classrooms
tests/                  node:test suites
```

## Limitations

- Data lives in one browser. Use backup files to move it; there's no sync or sharing.
- Very tight rule sets can hit the search budget. The engine then says it couldn't find a plan in time and names the rules causing the most dead ends, instead of claiming the setup is impossible.
- Seat labels (A1, B3…) are positional, so inserting a seat into a row renumbers the seats after it. Rules keep pointing at the same physical seats; give seats custom names if you need fixed labels.
- English only for now. All texts live in `js/i18n/en.js`.
