async function checkOnboardingHtml() {
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
  console.log('HTML Length:', html.length);
  // find titles, headings, and tables
  const headings = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  console.log('Headings:', headings);

  // find links or buttons
  const buttons = [...html.matchAll(/<(button|a)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => m[2].replace(/<[^>]+>/g, '').trim())
    .filter(t => t.length > 2 && t.length < 50);
  console.log('Buttons/Links count:', buttons.length, 'Samples:', buttons.slice(0, 25));

  // extract main text block
  const mainIdx = html.indexOf('<main');
  if (mainIdx !== -1) {
    const mainText = html.substring(mainIdx, mainIdx + 3000)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    console.log('Main snippet:\n', mainText.substring(0, 1500));
  }
}
checkOnboardingHtml();

