const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Check current state
const idx = c.indexOf('function parseResult');
console.log('Current parseResult:', c.substring(idx, idx+200));
console.log('---');

// The function already has the fix - problem must be elsewhere
// Let's check what text looks like when it arrives
c = c.replace(
  "function parseResult(text){",
  "function parseResult(text){ console.log('RAW TEXT FIRST 100:', text.slice(0,100));"
);

fs.writeFileSync('index.html', c);
console.log('Added debug logging!');
