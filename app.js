const grid = document.getElementById("grid");
const customColorInput = document.getElementById("customColor");
const eraseBtn = document.getElementById("erase");
const penBtn = document.getElementById("pen");
const fillBtn = document.getElementById("fill");
const lineBtn = document.getElementById("line");
const mirrorBtn = document.getElementById("mirror");
const clearBtn = document.getElementById("clear");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const downloadBtn = document.getElementById("download");
const saveJSONBtn = document.getElementById("saveJSON");
const loadJSONInput = document.getElementById("loadJSON");
const gridSizeSelect = document.getElementById("gridSize");

let currentColor = "#000000";
let tool = "pen";
let mirrorMode = false;
let isDrawing = false;
let startCell = null;
let history = [];
let redoStack = [];
let size = parseInt(gridSizeSelect.value);

const presets = {
  flower: [
    { x: 7, y: 7, color: "pink" },
    { x: 8, y: 7, color: "pink" },
    { x: 7, y: 8, color: "pink" },
    { x: 8, y: 8, color: "pink" },
    { x: 8, y: 8, color: "yellow" },
  ],
  heart: [
    { x: 7, y: 6, color: "red" },
    { x: 8, y: 6, color: "red" },
    { x: 6, y: 7, color: "red" },
    { x: 9, y: 7, color: "red" },
    { x: 5, y: 8, color: "red" },
    { x: 10, y: 8, color: "red" },
    { x: 6, y: 9, color: "red" },
    { x: 9, y: 9, color: "red" },
    { x: 7, y: 10, color: "red" },
    { x: 8, y: 10, color: "red" },
  ],
  star: [
    { x: 8, y: 5, color: "yellow" },
    { x: 8, y: 6, color: "yellow" },
    { x: 7, y: 7, color: "yellow" },
    { x: 8, y: 7, color: "yellow" },
    { x: 9, y: 7, color: "yellow" },
    { x: 8, y: 8, color: "yellow" },
    { x: 8, y: 9, color: "yellow" },
  ],
  landscape: [
    // ground
    ...Array.from({ length: 16 }, (_, i) => ({ x: i, y: 15, color: "green" })),
    // tree trunk
    { x: 4, y: 12, color: "brown" },
    { x: 4, y: 11, color: "brown" },
    { x: 4, y: 10, color: "brown" },
    // tree leaves
    { x: 3, y: 9, color: "green" },
    { x: 4, y: 9, color: "green" },
    { x: 5, y: 9, color: "green" },
  ],
  smiley: [
    // face
    ...Array.from({ length: 6 }, (_, i) => ({
      x: 5 + i,
      y: 5,
      color: "yellow",
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      x: 5 + i,
      y: 10,
      color: "yellow",
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      x: 4,
      y: 6 + i,
      color: "yellow",
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      x: 11,
      y: 6 + i,
      color: "yellow",
    })),
    // eyes
    { x: 6, y: 7, color: "black" },
    { x: 9, y: 7, color: "black" },
    // mouth
    { x: 6, y: 9, color: "black" },
    { x: 7, y: 10, color: "black" },
    { x: 8, y: 10, color: "black" },
    { x: 9, y: 9, color: "black" },
  ],
};

// Build grid dynamically
function buildGrid(size) {
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${size}, 20px)`;
  grid.style.gridTemplateRows = `repeat(${size}, 20px)`;
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.index = i;
    cell.style.background = "white";
    cell.addEventListener("mousedown", () => handleCellClick(cell));
    cell.addEventListener("mouseover", () => {
      if (isDrawing && tool === "pen") paintCell(cell);
    });
    grid.appendChild(cell);
  }
}

// Paint a cell
function paintCell(cell, color = currentColor) {
  const prevColor = cell.style.background;
  const newColor = tool === "erase" ? "white" : color;
  if (prevColor !== newColor) {
    history.push({ cell, prevColor, newColor });
    redoStack = [];
    cell.style.background = newColor;
    if (mirrorMode) {
      const index = parseInt(cell.dataset.index);
      const x = index % size;
      const y = Math.floor(index / size);
      const mirrorX = size - 1 - x;
      const mirrorIndex = y * size + mirrorX;
      const mirrorCell = grid.children[mirrorIndex];
      if (mirrorCell && mirrorCell !== cell) {
        mirrorCell.style.background = newColor;
      }
    }
  }
}

// Fill tool (flood fill)
function floodFill(cell, targetColor, replacementColor) {
  if (targetColor === replacementColor) return;
  const stack = [cell];
  while (stack.length) {
    const current = stack.pop();
    if (current.style.background === targetColor) {
      paintCell(current, replacementColor);
      const index = parseInt(current.dataset.index);
      const x = index % size;
      const y = Math.floor(index / size);
      const neighbors = [
        { x: x + 1, y: y },
        { x: x - 1, y: y },
        { x: x, y: y + 1 },
        { x: x, y: y - 1 },
      ];
      neighbors.forEach((n) => {
        if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size) {
          const neighborIndex = n.y * size + n.x;
          stack.push(grid.children[neighborIndex]);
        }
      });
    }
  }
}

// Line tool (Bresenham’s algorithm)
function drawLine(start, end) {
  const x0 = start.x,
    y0 = start.y;
  const x1 = end.x,
    y1 = end.y;
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0,
    y = y0;
  while (true) {
    const index = y * size + x;
    paintCell(grid.children[index]);
    if (x === x1 && y === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// Handle cell click depending on tool
function handleCellClick(cell) {
  if (tool === "pen" || tool === "erase") {
    paintCell(cell);
  } else if (tool === "fill") {
    floodFill(cell, cell.style.background, currentColor);
  } else if (tool === "line") {
    if (!startCell) {
      startCell = cell;
    } else {
      const startIndex = parseInt(startCell.dataset.index);
      const endIndex = parseInt(cell.dataset.index);
      const start = { x: startIndex % size, y: Math.floor(startIndex / size) };
      const end = { x: endIndex % size, y: Math.floor(endIndex / size) };
      drawLine(start, end);
      startCell = null;
    }
  }
}

// 🌸 Apply preset to grid
function applyPreset(name) {
  clearBtn.click();
  const pattern = presets[name];
  if (!pattern) return;
  pattern.forEach((p) => {
    const index = p.y * size + p.x;
    if (grid.children[index]) {
      grid.children[index].style.background = p.color;
    }
  });
}

// 🖼️ Render preset thumbnails
function renderPresetThumbnails() {
  document.querySelectorAll(".preset").forEach((canvas) => {
    const name = canvas.dataset.preset;
    const pattern = presets[name];
    if (!pattern) return;
    const ctx = canvas.getContext("2d");
    const thumbSize = 16;
    canvas.width = thumbSize;
    canvas.height = thumbSize;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, thumbSize, thumbSize);
    pattern.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 1, 1);
    });
    canvas.addEventListener("click", () => applyPreset(name));
  });
}

// Undo/Redo
undoBtn.addEventListener("click", () => {
  const action = history.pop();
  if (action) {
    redoStack.push(action);
    action.cell.style.background = action.prevColor;
  }
});
redoBtn.addEventListener("click", () => {
  const action = redoStack.pop();
  if (action) {
    history.push(action);
    action.cell.style.background = action.newColor;
  }
});

// Tool buttons
penBtn.addEventListener("click", () => (tool = "pen"));
eraseBtn.addEventListener("click", () => (tool = "erase"));
fillBtn.addEventListener("click", () => (tool = "fill"));
lineBtn.addEventListener("click", () => (tool = "line"));
mirrorBtn.addEventListener("click", () => (mirrorMode = !mirrorMode));

// Color picker
customColorInput.addEventListener("input", () => {
  currentColor = customColorInput.value;
  tool = "pen";
});

// Clear
clearBtn.addEventListener("click", () => {
  document
    .querySelectorAll(".cell")
    .forEach((cell) => (cell.style.background = "white"));
  history = [];
  redoStack = [];
});

// Download PNG
downloadBtn.addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell, i) => {
    const color = window.getComputedStyle(cell).backgroundColor;
    const x = i % size;
    const y = Math.floor(i / size);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });
  const link = document.createElement("a");
  link.download = "pixel-art.png";
  link.href = canvas.toDataURL();
  link.click();
});

// Save JSON
saveJSONBtn.addEventListener("click", () => {
  const cells = document.querySelectorAll(".cell");
  const data = Array.from(cells).map((cell) => cell.style.background);
  const blob = new Blob([JSON.stringify({ size, data })], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.download = "pixel-art.json";
  link.href = URL.createObjectURL(blob);
  link.click();
});

// Load JSON
loadJSONInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const obj = JSON.parse(reader.result);
    buildGrid(obj.size);
    obj.data.forEach((color, i) => {
      grid.children[i].style.background = color;
    });
  };
  reader.readAsText(file);
});

// Grid resizing
gridSizeSelect.addEventListener("change", () => {
  size = parseInt(gridSizeSelect.value);
  buildGrid(size);
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") undoBtn.click();
  if (e.ctrlKey && e.key === "y") redoBtn.click();
  if (e.key === "c") clearBtn.click();
  if (e.key === "e") eraseBtn.click();
});

const themeToggleBtn = document.getElementById('themeToggle');
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');

  // Change title color dynamically
  const title = document.querySelector('h1');
  if (document.body.classList.contains('dark')) {
    title.style.color = '#ffcc00'; // dark mode accent
  } else {
    title.style.color = '#222'; // light mode default
  }
});


// Mouse events for drag painting
document.body.addEventListener("mousedown", () => (isDrawing = true));
document.body.addEventListener("mouseup", () => (isDrawing = false));

// Initialize
buildGrid(size);
renderPresetThumbnails();
