import fs from 'node:fs';

const filePath = 'frontend/src/app/dashboard/super-admin/businesses/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /<div className="font-bold text-\[#292320\] text-sm">\{b\.name\}<\/div>/,
  '<Link href={`/dashboard/super-admin/businesses/${b.id}`} className="font-bold text-[#292320] text-sm hover:text-[#6B2837] hover:underline">{b.name}</Link>'
);

content = content.replace(
  /<button\s+onClick=\{\(\) => setSelectedBusiness\(b\)\}[^>]*title="View Details & Credentials"[^>]*>\s*<Eye[^>]*\/>\s*<\/button>/,
  '<Link href={`/dashboard/super-admin/businesses/${b.id}`} className="p-1.5 hover:bg-[#EEE7DD] rounded-lg text-[#6B2837] border border-[#D8CEC1] hover:border-[#D8CEC1] cursor-pointer inline-flex items-center" title="Open 5-Tab Detail View"><Eye className="h-4 w-4" /></Link>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated businesses/page.tsx with direct links!');

