const fs = require('fs');
const path = require('path');

const pricesPath = path.join(
  __dirname,
  '..',
  'csv',
  'prices - backup - do not delete.csv'
);
const productsPath = path.join(
  __dirname,
  '..',
  'csv',
  'products - backup - do not delete.csv'
);
const outputPath = path.join(__dirname, '..', 'csv', 'prices-cleaned.csv');

function extractCodeFromCell(cell) {
  if (!cell) {
    return null;
  }
  const match = cell.match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim() : null;
}

function loadProductsCodes() {
  const raw = fs.readFileSync(productsPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const header = lines[0];
  const headers = header.split(',');
  const productCodeIdx = headers.indexOf('Product Code');
  if (productCodeIdx === -1) {
    throw new Error('Could not find "Product Code" column in products CSV');
  }

  const codes = new Set();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    const cols = line.split(',');
    const cell = cols[productCodeIdx];
    const code = extractCodeFromCell(cell);
    if (code) {
      codes.add(code);
    }
  }
  return codes;
}

function cleanPrices() {
  const productCodes = loadProductsCodes();
  const raw = fs.readFileSync(pricesPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (!lines.length) {
    throw new Error('Prices CSV is empty');
  }

  const header = lines[0];
  const headers = header.split(',');
  const productCodeIdx = headers.indexOf('Product Code');
  if (productCodeIdx === -1) {
    throw new Error('Could not find "Product Code" column in prices CSV');
  }

  const keptLines = [header];
  const removedCodes = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      keptLines.push(line);
      continue;
    }
    const cols = line.split(',');
    const cell = cols[productCodeIdx];
    const code = extractCodeFromCell(cell);

    // If no code in this row, just keep it (blank/separator rows, etc.)
    if (!code) {
      keptLines.push(line);
      continue;
    }

    if (productCodes.has(code)) {
      keptLines.push(line);
    } else {
      removedCodes.add(code);
    }
  }

  fs.writeFileSync(outputPath, keptLines.join('\n'), 'utf8');

  console.log('Wrote cleaned prices CSV to:', outputPath);
  console.log(
    'Unique codes removed (present in prices but not in products):',
    removedCodes.size
  );
  console.log('Codes removed:');
  console.log(Array.from(removedCodes).sort().join('\n'));
}

cleanPrices();
