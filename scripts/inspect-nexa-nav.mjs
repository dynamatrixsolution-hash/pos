async function check() {
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
  
  // Find all <a> tags
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  console.log('--- Links in NexaEdu Institutions ---');
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (href.includes('institution') || href.includes('superadmin')) {
      console.log(`${href} -> "${text}"`);
    }
  }

  // Also check if there is a tab bar in the page content
  const tabRegex = /role="tab"[^>]*>([\s\S]*?)<\//gi;
  let tabMatch;
  while ((tabMatch = tabRegex.exec(html)) !== null) {
    console.log('Tab:', tabMatch[1].replace(/<[^>]+>/g, '').trim());
  }
}
check();
