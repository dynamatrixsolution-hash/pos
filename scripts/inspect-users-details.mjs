async function inspectUsersDetails() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const rawCookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;

  const headers = { 'Authorization': 'Bearer ' + token, 'Cookie': rawCookies };
  const res = await fetch('https://edu.thenexaedu.com/superadmin/users', { headers });
  const html = await res.text();

  // Find KPI cards
  const kpiIdx = html.indexOf('Total Users');
  if (kpiIdx !== -1) {
    console.log('KPIs snippet:');
    console.log(html.substring(kpiIdx - 100, kpiIdx + 1200).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  }

  // Find action buttons & filter tabs
  const filterIdx = html.indexOf('Table Headers') || html.indexOf('<table');
  const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  console.log('Buttons:', buttons.slice(0, 20));
}
inspectUsersDetails();

