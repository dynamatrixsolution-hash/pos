async function checkNextData() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const cookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Cookie': cookies
  };

  const pages = [
    'https://edu.thenexaedu.com/superadmin/institutions',
    'https://edu.thenexaedu.com/superadmin/institutions/pending',
    'https://edu.thenexaedu.com/superadmin/institutions/expiring',
  ];

  for (const page of pages) {
    console.log('\n--- Fetching', page, '---');
    const res = await fetch(page, { headers });
    const html = await res.text();
    // Look for __NEXT_DATA__ or script chunks
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextDataMatch) {
      console.log('Found __NEXT_DATA__');
      const data = JSON.parse(nextDataMatch[1]);
      console.log('pageProps:', JSON.stringify(data.props?.pageProps).substring(0, 300));
    }
    // Search for keywords in HTML
    const keywords = ['Expiring', 'Pending', 'Institutions', 'Table', 'Filter', 'Columns', 'Days', 'Trial', 'Plan', 'Renew', 'Approve'];
    for (const kw of keywords) {
      const idx = html.indexOf(kw);
      if (idx !== -1) {
        console.log(`Found "${kw}" at index ${idx}:`, html.substring(Math.max(0, idx - 40), Math.min(html.length, idx + 100)).replace(/\s+/g, ' '));
      }
    }

    // Find JS chunks
    const jsMatches = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => m[1]);
    console.log('Chunks:', jsMatches.slice(0, 5));
  }
}

checkNextData();

