async function dumpFullOnboarding() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const cookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;
  const headers = { 'Authorization': 'Bearer ' + token, 'Cookie': cookies };

  const res = await fetch('https://edu.thenexaedu.com/superadmin/onboarding', { headers });
  const html = await res.text();
  const mainIdx = html.indexOf('All Registrations');
  const clean = html.substring(mainIdx, mainIdx + 5000)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  console.log('Clean Content:\n', clean);
}
dumpFullOnboarding();

