async function dumpOnboardingDetails() {
  const loginRes = await fetch('https://edu.thenexaedu.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'adminpassword123' })
  });
  const loginData = await loginRes.json();
  const cookies = loginRes.headers.get('set-cookie') || '';
  const token = loginData.data?.token || loginData.token;
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Cookie': cookies
  };

  const pages = [
    'https://edu.thenexaedu.com/superadmin/onboarding',
    'https://edu.thenexaedu.com/superadmin/onboarding/register'
  ];

  for (const p of pages) {
    const res = await fetch(p, { headers });
    const text = await res.text();
    console.log(`\n================== ${p} ==================`);
    // Find table headers
    const ths = [...text.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    console.log('Table Headers:', ths);
    // Find form fields / labels / inputs
    const labels = [...text.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    console.log('Labels count:', labels.length, 'Samples:', labels.slice(0, 15));
    // Find steps / workflows
    const steps = [...text.matchAll(/class="[^"]*step[^"]*"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    console.log('Steps:', steps);
  }
}

dumpOnboardingDetails();

