async function inspectWithFullCookies() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const rawCookies = loginRes.headers.get('set-cookie') || '';
  // parse all cookies
  const cookies = rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const token = loginData.data?.token || loginData.token;
  console.log('Token exists:', !!token, 'Cookies:', cookies);

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Cookie': cookies,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  };

  const pages = [
    'https://edu.thenexaedu.com/superadmin/onboarding',
    'https://edu.thenexaedu.com/superadmin/onboarding/register'
  ];

  for (const p of pages) {
    const res = await fetch(p, { headers, redirect: 'manual' });
    console.log(p, 'Status:', res.status, 'Location:', res.headers.get('location'));
    if (res.status === 200) {
      const text = await res.text();
      const ths = [...text.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      console.log('THs:', ths);
      const labels = [...text.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      console.log('Labels:', labels);
    }
  }
}

inspectWithFullCookies();

