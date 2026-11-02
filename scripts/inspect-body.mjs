async function dumpPageContent() {
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
    { url: 'https://edu.thenexaedu.com/superadmin/institutions', name: 'institutions' },
    { url: 'https://edu.thenexaedu.com/superadmin/institutions/pending', name: 'pending' },
    { url: 'https://edu.thenexaedu.com/superadmin/institutions/expiring', name: 'expiring' },
  ];

  for (const p of pages) {
    const res = await fetch(p.url, { headers });
    const html = await res.text();
    // extract <main ...> or body content
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    if (mainMatch) {
      console.log(`\n=== MAIN CONTENT OF ${p.name.toUpperCase()} ===`);
      // Strip tags to get clean structure and text
      const clean = mainMatch[1]
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      console.log(clean.substring(0, 1500));
    }
  }
}

dumpPageContent();

