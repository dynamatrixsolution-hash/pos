const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/business-onboarding-wizard.tsx', 'utf8');

c = c.replace(
  'bg-slate-900 text-white rounded-lg p-6 shadow-sm relative overflow-hidden',
  'bg-[#FFFCF7] text-[#292320] border border-[#D8CEC1] rounded-lg p-5 shadow-xs relative'
);
c = c.replace(/border-slate-800/g, 'border-[#D8CEC1]');
c = c.replace(/text-blue-400/g, 'text-[#6B2837]');
c = c.replace('bg-[#6B2837]/30 text-blue-400 border border-blue-500/30', 'bg-[#FAF4ED] text-[#6B2837] border border-[#6B2837]/30');
c = c.replace('text-white text-base', 'text-[#292320] text-base font-bold');
c = c.replace(/bg-\[#3A322D\]/g, 'bg-[#FAF6F0]');
c = c.replace(/border-\[#71675E\]\/50/g, 'border-[#D8CEC1]');
c = c.replace(/border-\[#71675E\]/g, 'border-[#D8CEC1]');
c = c.replace(/text-emerald-400/g, 'text-[#28634B]');
c = c.replace(/text-\[#EEE7DD\]/g, 'text-[#71675E]');
c = c.replace(/<Sparkles[^>]*\/>\s*/g, '');

fs.writeFileSync('frontend/src/components/business-onboarding-wizard.tsx', c, 'utf8');
console.log('Fixed wizard preview styling!');

