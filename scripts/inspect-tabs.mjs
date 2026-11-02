async function checkTabs() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const cookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;
  const headers = { 'Authorization': 'Bearer ' + token, 'Cookie': cookies };

  const pages = [
    'https://edu.thenexaedu.com/superadmin/institutions',
    'https://edu.thenexaedu.com/superadmin/institutions/pending',
    'https://edu.thenexaedu.com/superadmin/institutions/expiring'
  ];

  for (const p of pages) {
    const res = await fetch(p, { headers });
    const html = await res.text();
    console.log('\n=== Page:', p, '===');
    const regex = /href="(\/superadmin\/institutions[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      const txt = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('Link:', m[1], 'Text:', txt);
    }
  }
}
checkTabs();

