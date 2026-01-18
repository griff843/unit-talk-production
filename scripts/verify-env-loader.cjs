// scripts/verify-env-loader.cjs
const path = require("path");
const fs = require("fs");

function loadEnv(root) {
  require("dotenv").config({ path: path.join(root, ".env") });
  require("dotenv").config({ path: path.join(root, ".env.shared") });
}

function findRepoRoot(start) {
  let dir = start;
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, ".env.shared"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

const root = findRepoRoot(process.cwd());
if (!root) {
  console.error("❌ Could not find repo root from:", process.cwd());
  process.exit(1);
}

loadEnv(root);

console.log("\n📋 ENV VERIFICATION");
console.log("Repo root:", root);
console.log("CWD:", process.cwd());
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "✅ LOADED" : "❌ MISSING");
console.log("SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "✅ LOADED" : "❌ MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ LOADED" : "❌ MISSING");
console.log("");
