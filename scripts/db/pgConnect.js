// scripts/db/pgConnect.js
const { Client } = require('pg');

/**
 * Try to connect to a PostgreSQL database
 * @param {string} url - The database connection URL
 * @returns {Promise<Client>} - Connected PostgreSQL client
 */
async function tryConnect(url) {
  // Determine SSL configuration based on URL
  let sslConfig = { rejectUnauthorized: false };
  
  // For pooler connections, use more lenient SSL
  if (url.includes('pooler.supabase.com')) {
    sslConfig = {
      rejectUnauthorized: false,
      requestCert: false,
      agent: false
    };
  }
  
  const client = new Client({
    connectionString: url,
    ssl: sslConfig
  });
  
  await client.connect();
  return client;
}

module.exports = { tryConnect };