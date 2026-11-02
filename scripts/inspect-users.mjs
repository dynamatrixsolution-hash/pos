async function inspectUsers() {
  // Login to NexaEdu
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const rawCookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;
  console.log('Login success:', !!token);

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Cookie': rawCookies
  };

  const res = await fetch('https://edu.thenexaedu.com/superadmin/users', { headers });
  console.log('Users page status:', res.status);
  const html = await res.text();

  // Find headings, tabs, buttons, table columns
  const headings = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  console.log('Headings:', headings);

  const ths = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  console.log('Table Headers:', ths);

  // Snippet around main
  const mainIdx = html.indexOf('<main');
  if (mainIdx !== -1) {
    const clean = html.substring(mainIdx, mainIdx + 3000)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    console.log('Main snippet:\n', clean.substring(0, 1500));
  }
}
inspectUsers();

