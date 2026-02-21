import 'dotenv/config';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.log('Upstash REST not configured, skipping cache clear');
  process.exit(0);
}

try {
  const response = await fetch(`${url}/del/catalog:cappers:active`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  console.log('Cache clear result:', data);
} catch (e) {
  console.log('Error:', e.message);
}
