import fs from 'fs';

// 1. Update businesses/page.tsx
let bPage = fs.readFileSync('frontend/src/app/dashboard/super-admin/businesses/page.tsx', 'utf8');

const bTarget = `      {/* 4. Sub-Navigation Tabs matching NexaEdu */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => { setActiveTab("all"); router.push("/dashboard/super-admin/businesses?tab=all"); }}
          className={\`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors \${
            activeTab === "all" ? "border-[#6B2837] text-[#6B2837]" : "border-transparent text-[#71675E] hover:text-[#292320]"
          }\`}
        >
          All Businesses ({totalBusinesses})
        </button>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Pending Approvals
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Expiring Subscriptions
        </Link>
        <button
          onClick={() => { setActiveTab("suspended"); router.push("/dashboard/super-admin/businesses?tab=suspended"); }}
          className={\`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors \${
            activeTab === "suspended" ? "border-[#6B2837] text-[#6B2837]" : "border-transparent text-[#71675E] hover:text-[#292320]"
          }\`}
        >
          Suspended ({suspendedSubs})
        </button>
        <button
          onClick={() => { setActiveTab("add"); router.push("/dashboard/super-admin/businesses?tab=add"); }}
          className={\`pb-2.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors \${
            activeTab === "add" ? "border-[#6B2837] text-[#6B2837]" : "border-transparent text-[#71675E] hover:text-[#292320]"
          }\`}
        >
          + Add Business
        </button>
      </div>`;

const bReplacement = `      {/* Sub-Menu Tabs matching Sidebar */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <Link
          href="/dashboard/super-admin/businesses"
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          All Businesses ({totalBusinesses})
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Pending Approvals
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Expiring Subscriptions
        </Link>
      </div>`;

if (bPage.includes(bTarget)) {
  bPage = bPage.replace(bTarget, bReplacement);
  fs.writeFileSync('frontend/src/app/dashboard/super-admin/businesses/page.tsx', bPage, 'utf8');
  console.log('Updated businesses/page.tsx tabs');
} else {
  console.log('bTarget not found in businesses/page.tsx');
}

// 2. Update businesses/pending/page.tsx
let pPage = fs.readFileSync('frontend/src/app/dashboard/super-admin/businesses/pending/page.tsx', 'utf8');

const pTarget = `      {/* 2. Sub-Navigation Tabs matching NexaEdu */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <Link
          href="/dashboard/super-admin/businesses?tab=all"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          All Businesses
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          Pending Approvals ({counts.pending})
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Expiring Subscriptions
        </Link>
        <Link
          href="/dashboard/super-admin/businesses?tab=suspended"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Suspended
        </Link>
        <Link
          href="/dashboard/super-admin/businesses?tab=add"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          + Add Business
        </Link>
      </div>`;

const pReplacement = `      {/* Sub-Menu Tabs matching Sidebar */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <Link
          href="/dashboard/super-admin/businesses"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          All Businesses
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          Pending Approvals ({counts.pending})
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Expiring Subscriptions
        </Link>
      </div>`;

if (pPage.includes(pTarget)) {
  pPage = pPage.replace(pTarget, pReplacement);
  fs.writeFileSync('frontend/src/app/dashboard/super-admin/businesses/pending/page.tsx', pPage, 'utf8');
  console.log('Updated businesses/pending/page.tsx tabs');
} else {
  console.log('pTarget not found in businesses/pending/page.tsx');
}

// 3. Update businesses/expiring/page.tsx
let ePage = fs.readFileSync('frontend/src/app/dashboard/super-admin/businesses/expiring/page.tsx', 'utf8');

const eTarget = `      {/* 2. Sub-Navigation Tabs matching NexaEdu */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <Link
          href="/dashboard/super-admin/businesses?tab=all"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          All Businesses
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Pending Approvals
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          Expiring Subscriptions ({counts.expiringSoon + counts.expired})
        </Link>
        <Link
          href="/dashboard/super-admin/businesses?tab=suspended"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Suspended
        </Link>
        <Link
          href="/dashboard/super-admin/businesses?tab=add"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          + Add Business
        </Link>
      </div>`;

const eReplacement = `      {/* Sub-Menu Tabs matching Sidebar */}
      <div className="flex border-b border-[#D8CEC1] gap-6 text-xs font-semibold overflow-x-auto">
        <Link
          href="/dashboard/super-admin/businesses"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          All Businesses
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/pending"
          className="pb-2.5 border-b-2 border-transparent text-[#71675E] hover:text-[#292320] whitespace-nowrap transition-colors"
        >
          Pending Approvals
        </Link>
        <Link
          href="/dashboard/super-admin/businesses/expiring"
          className="pb-2.5 border-b-2 border-[#6B2837] text-[#6B2837] whitespace-nowrap"
        >
          Expiring Subscriptions ({counts.expiringSoon + counts.expired})
        </Link>
      </div>`;

if (ePage.includes(eTarget)) {
  ePage = ePage.replace(eTarget, eReplacement);
  fs.writeFileSync('frontend/src/app/dashboard/super-admin/businesses/expiring/page.tsx', ePage, 'utf8');
  console.log('Updated businesses/expiring/page.tsx tabs');
} else {
  console.log('eTarget not found in businesses/expiring/page.tsx');
}

