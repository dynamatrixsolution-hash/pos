async function inspectOnboarding() {
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
    'https://edu.thenexaedu.com/superadmin/onboarding',
    'https://edu.thenexaedu.com/superadmin/onboarding/register',
  ];

  for (const p of pages) {
    console.log('\n================================');
    console.log('Fetching:', p);
    console.log('================================');
    const res = await fetch(p, { headers });
    console.log('Status:', res.status, res.headers.get('content-type'));
    const html = await res.text();
    // Clean and print main text
    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    console.log('Text preview (first 2500 chars):\n', clean.substring(1000, 3500));
  }
}
inspectOnboarding();

