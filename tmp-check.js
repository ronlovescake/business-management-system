const fs = require('fs');
const path = require('path');
const csvPath = path.join(__dirname, 'csv/NEW CUSTOMERS.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/);
const targets = new Set([
  'Phinalope Ryle Chandumal',
  'Crista | Stang Rosete',
  'Charise Mae G. Catinoy | Candy Gandia Catinoy',
  'Roshelle Devanadera',
  'BOB & LOREN CLOTHING | Loren Young',
  'Russell Mayugba | Marjorie Lagarto',
  'April Dawn Del Rosario',
  'Amira Mama | Mirs Balangue',
  'Mark Anthony Salazar | Eme Kate Villatema',
  'Marinel Canamaque | Nel Maraya Canamaque',
]);
function parse(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result.map((v) => v.trim().replace(/^"|"$/g, ''));
}
const phoneRegex =
  /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
const taxRegex = /^[A-Z0-9-]{5,20}$/;
const header = parse(lines[0] ?? '');
const issues = [];
for (let i = 1; i < lines.length; i += 1) {
  const line = lines[i];
  if (!line?.trim()) {
    continue;
  }
  const values = parse(line);
  const name = values[1];
  if (!targets.has(name)) {
    continue;
  }
  const row = {
    Date: values[0] || '',
    CustomerName: values[1] || '',
    PhoneNumber: values[2] || '',
    Address: values[3] || '',
    Facebook: values[4] || '',
    Email: values[5] || '',
    BusinessName: values[6] || '',
    TaxNumber: values[7] || '',
    BusinessAddress: values[8] || '',
    BusinessContactNumber: values[9] || '',
    CustomerStatus: values[10] || '',
  };
  const errors = {};
  if (row.CustomerName.length < 2) {
    errors.customerName = 'too short';
  }
  if (row.CustomerName.length > 100) {
    errors.customerName = 'too long';
  }
  if (row.PhoneNumber && !phoneRegex.test(row.PhoneNumber)) {
    errors.phoneNumber = 'invalid primary phone';
  }
  if (
    row.BusinessContactNumber &&
    !phoneRegex.test(row.BusinessContactNumber)
  ) {
    errors.businessContactNumber = 'invalid business contact';
  }
  if (row.TaxNumber && !taxRegex.test(row.TaxNumber)) {
    errors.taxNumber = 'invalid tax';
  }
  if (
    row.CustomerStatus &&
    !['Active', 'Inactive', 'Prospect', 'VIP', 'Banned', '🚫 banned'].includes(
      row.CustomerStatus
    )
  ) {
    errors.customerStatus = 'invalid status';
  }
  issues.push({ name: row.CustomerName, row, errors });
}
console.log(JSON.stringify({ header, issues }, null, 2));
