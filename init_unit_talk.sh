#!/bin/bash

echo "🌟 Initializing Node.js + TypeScript project (production settings)..."

# Initialize git (if not already)
git init

# Initialize Node project
npm init -y

# Install dependencies
npm install typescript tsx @types/node dotenv pino @supabase/supabase-js zod

# Install dev dependencies
npm install -D jest ts-jest @types/jest ts-node nodemon eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Setup TypeScript config
npx tsc --init --rootDir src --outDir dist --esModuleInterop --resolveJsonModule --module commonjs --target es2022 --strict

# Create core folders and files
mkdir -p src/agents/IngestionAgent/__tests__
mkdir -p src/agents/DailyPicksAgent/__tests__
mkdir -p src/agents/GradingAgent/__tests__
mkdir -p src/agents/FinalizerAgent/__tests__
mkdir -p src/agents/ContestAgent/__tests__
mkdir -p src/agents/ReferralAgent/__tests__
mkdir -p src/agents/AlertAgent/__tests__
mkdir -p src/services
mkdir -p src/types
mkdir -p src/utils
mkdir -p src/config
mkdir -p src/workflows
mkdir -p tests/integration
mkdir -p tests/e2e
mkdir -p scripts

touch src/agents/IngestionAgent/index.ts
touch src/agents/IngestionAgent/fetchRawProps.ts
touch src/agents/IngestionAgent/ingestion.types.ts
touch src/agents/IngestionAgent/ingestion.sop.md
touch src/services/supabaseClient.ts
touch src/services/logging.ts
touch src/types/agentTypes.ts
touch src/types/pickTypes.ts
touch src/utils/errorHandler.ts
touch src/config/env.ts
touch src/config/agentConfig.ts
touch src/workflows/ingestion.workflow.ts
touch src/index.ts
touch README.md

# Add a basic .gitignore if not present
if [ ! -f .gitignore ]; then
cat <<EOL > .gitignore
node_modules/
dist/
.env
*.log
EOL
fi

echo "{
  \"compilerOptions\": {
    \"target\": \"es2022\",
    \"module\": \"commonjs\",
    \"rootDir\": \"src\",
    \"outDir\": \"dist\",
    \"strict\": true,
    \"esModuleInterop\": true,
    \"resolveJsonModule\": true
  }
}
" > tsconfig.json

echo "{
  \"name\": \"unit-talk-platform\",
  \"version\": \"1.0.0\",
  \"main\": \"dist/index.js\",
  \"type\": \"module\",
  \"scripts\": {
    \"build\": \"tsc\",
    \"dev\": \"nodemon --exec tsx src/index.ts\",
    \"start\": \"node dist/index.js\",
    \"test\": \"jest\"
  }
}
" > package.json

echo "✅ Node.js + TypeScript project initialized and folder structure scaffolded."
echo "🚀 Next: Open in VS Code, connect your repo, or start coding in src/agents/IngestionAgent/index.ts"
