// Native fetch in Node 18+

async function check() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const cookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;
  console.log('Login success:', !!token);

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
    const res = await fetch(page, { headers });
    console.log(page, 'Status:', res.status);
    const html = await res.text();
    // search for navigation or text snippets
    const scripts = html.match(/src="([^"]+\.js)"/g) || [];
    console.log('Script count:', scripts.length);
    // Find text content like headers, tabs
    const title = html.match(/<title>([^<]+)<\/title>/i);
    console.log('Title:', title ? title[1] : 'none');
  }

  // Also probe potential API routes
  const apiRoutes = [
    'https://edu.thenexaedu.com/api/v1/superadmin/institutions',
    'https://edu.thenexaedu.com/api/v1/superadmin/institutions?status=pending',
    'https://edu.thenexaedu.com/api/v1/superadmin/institutions?status=expiring',
    'https://edu.thenexaedu.com/api/v1/superadmin/institutions/pending',
    'https://edu.thenexaedu.com/api/v1/superadmin/institutions/expiring',
    'https://edu.thenexaedu.com/api/v1/superadmin/stats',
    'https://edu.thenexaedu.com/api/v1/institutions'
  ];

  for (const route of apiRoutes) {
    try {
      const res = await fetch(route, { headers });
      console.log('API', route, res.status, res.headers.get('content-type'));
      if (res.headers.get('content-type')?.includes('json')) {
        const d = await res.json();
        console.log('-> payload preview:', JSON.stringify(d).substring(0, 300));
      }
    } catch (e) {
      console.log('API error', route, e.message);
    }
  }
}

check();
