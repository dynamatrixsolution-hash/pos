async function dumpTabStyles() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const cookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;
  const headers = { 'Authorization': 'Bearer ' + token, 'Cookie': cookies };

  const res = await fetch('https://edu.thenexaedu.com/superadmin/institutions', { headers });
  const html = await res.text();

  // Find the HTML block containing the subnav links
  const idx = html.indexOf('/superadmin/institutions/pending');
  if (idx !== -1) {
    console.log('Snippet around subnav:');
    console.log(html.substring(Math.max(0, idx - 400), Math.min(html.length, idx + 500)));
  }
}
dumpTabStyles();

