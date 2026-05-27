const { read, utils } = require('xlsx');
const fs = require('fs');
const buf = fs.readFileSync('docs/arquivo/Razão22.05.2026.xlsx');
const wb = read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

function serialToMonth(s) {
  const d = new Date(new Date(1899, 11, 30).getTime() + Number(s) * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

let currentCC = null;
const results = {};

for (const r of rows) {
  const c0 = String(r[0]).trim().toLowerCase();
  if (c0 === 'centro de custos:') {
    currentCC = String(r[2]).trim();
  } else {
    const serial = parseFloat(String(r[0]));
    if (!isNaN(serial) && serial > 40000 && serial < 60000) {
      const month = serialToMonth(serial);
      const key = (currentCC || 'null') + '|' + month;
      results[key] = (results[key] || 0) + 1;
    }
  }
}

const sorted = Object.entries(results).sort();
sorted.forEach(function(kv) { console.log(kv[0], '->', kv[1], 'transactions'); });
