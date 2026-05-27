const { read, utils } = require('xlsx');
const fs = require('fs');
const buf = fs.readFileSync('docs/arquivo/Razão22.05.2026.xlsx');
const wb = read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

let currentAcc = null;
let capturing = false;

for (var i = 0; i < rows.length; i++) {
  var r = rows[i];
  var c0 = String(r[0]).trim().toLowerCase();
  if (c0 === 'conta:' && String(r[2]).trim() === '4.1.30.100.1') {
    capturing = true;
    console.log('Found account:', String(r[2]).trim(), String(r[4]).trim());
    continue;
  }
  if (capturing && c0 === 'conta:') break;  // next account
  if (capturing) {
    var serial = parseFloat(String(r[0]));
    if (!isNaN(serial) && serial > 40000 && serial < 60000) {
      // r[9] is Saldo-Exercicio based on the detected layout
      console.log('row ' + i + ': debit=' + r[6] + ' credit=' + r[7] + ' saldo=' + r[8] + ' saldo-exerc=' + r[9]);
    } else {
      console.log('row ' + i + ':', String(r[0]).slice(0,20), '|', String(r[2]).slice(0,30));
    }
  }
}
