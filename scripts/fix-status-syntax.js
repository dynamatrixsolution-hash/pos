const fs = require('fs');
let c = fs.readFileSync('frontend/src/app/auth/register/status/page.tsx', 'utf8');
c = c.replace(/<\s*className="h-5 w-5" \/>\s*/g, '');
c = c.replace(/<\r?\nclassName="h-5 w-5" \/>\s*/g, '');
fs.writeFileSync('frontend/src/app/auth/register/status/page.tsx', c, 'utf8');
console.log('Fixed status page syntax!');

