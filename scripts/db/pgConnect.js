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
  if (url.includes('pooler.supabase.com') || url.includes('pgbouncer=true')) {
    sslConfig = {
      rejectUnauthorized: false,
      requestCert: false,
      agent: false
    };
  }
  
  const client = new Client({
    connectionString: url,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
    query_timeout: 60000,
    statement_timeout: 60000,
    idle_in_transaction_session_timeout: 60000
  });
  
  await client.connect();
  return client;
}

module.exports = { tryConnect };