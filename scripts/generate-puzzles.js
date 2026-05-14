const fs = require("fs");
const path = require("path");

function randomDigit() {
  return Math.floor(Math.random() * 9) + 1;
}

function generateGrid() {
  return Array.from({ length: 16 }, randomDigit);
}

function computeRowSums(grid) {
  return [0, 1, 2, 3].map((r) =>
    grid.slice(r * 4, r * 4 + 4).reduce((a, b) => a + b, 0)
  );
}

function computeColSums(grid) {
  return [0, 1, 2, 3].map((c) =>
    [0, 1, 2, 3].reduce((a, r) => a + grid[r * 4 + c], 0)
  );
}

function chooseHidden(count) {
  const indices = Array.from({ length: 16 }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const START_DATE = "2026-05-14";
const DIFFICULTIES = [
  { name: "easy", count: 30, hidden: 4 },
  { name: "medium", count: 30, hidden: 6 },
  { name: "hard", count: 30, hidden: 9 },
];

const puzzles = [];
let id = 1;
let dayOffset = 0;

for (const { name, count, hidden: hiddenCount } of DIFFICULTIES) {
  for (let i = 0; i < count; i++) {
    const grid = generateGrid();
    puzzles.push({
      id,
      date: addDays(START_DATE, dayOffset),
      difficulty: name,
      grid,
      hidden: chooseHidden(hiddenCount),
      rowSums: computeRowSums(grid),
      colSums: computeColSums(grid),
    });
    id++;
    dayOffset++;
  }
}

const outDir = path.join(__dirname, "..", "src", "data");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "puzzles.json");
fs.writeFileSync(outPath, JSON.stringify(puzzles, null, 2));
console.log(`Generated ${puzzles.length} puzzles → ${outPath}`);
