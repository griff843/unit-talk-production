# MCP (Model Context Protocol) Setup Guide

## Overview

This guide provides comprehensive instructions for setting up and configuring all MCP (Model Context Protocol) servers used in the Unit Talk Platform with Claude Code.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Claude Code CLI installed
- Access to required API keys and tokens

## Installed MCP Servers

### 1. ByteRover MCP (Knowledge Management)
**Status**: ✅ Installed and Configured

**Description**: Provides intelligent knowledge retrieval and storage capabilities for the Unit Talk platform.

**Configuration**:
```json
{
  "byterover-mcp": {
    "type": "http",
    "url": "https://mcp.byterover.dev/mcp?machineId=1f05f302-824e-61a0-9c44-f35a49009ccc"
  }
}
```

**Available Tools**:
- `byterover-retrieve-knowledge`: Retrieve relevant context before tasks
- `byterover-store-knowledge`: Store critical information after successful tasks

**Usage**:
Always use these tools as instructed in CLAUDE.md files:
1. Retrieve knowledge before starting any task
2. Store knowledge after completing successful tasks

### 2. Supabase MCP
**Status**: ✅ Installed and Configured

**Description**: Provides direct integration with Supabase database for data operations.

**Version**: 0.5.9

**Configuration**:
```json
{
  "supabase": {
    "command": "cmd",
    "args": ["/c", "npx", "@supabase/mcp-server-supabase"],
    "env": {
      "SUPABASE_URL": "${SUPABASE_URL}",
      "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
    }
  }
}
```

**Required Environment Variables**:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

**Available Operations**:
- Direct database queries
- Real-time subscriptions
- Row-level security compliance
- Database schema inspection

### 3. Playwright MCP (Browser Automation)
**Status**: ✅ Installed and Configured

**Description**: Provides browser automation capabilities for testing and web scraping.

**Version**: 0.0.48

**Configuration**:
```json
{
  "playwright": {
    "command": "cmd",
    "args": ["/c", "npx", "@playwright/mcp", "--headless"]
  }
}
```

**Available Tools**:
- `browser_navigate`: Navigate to URLs
- `browser_click`: Click elements on pages
- `browser_type`: Type text into form fields
- `browser_snapshot`: Take accessibility snapshots
- `browser_take_screenshot`: Capture screenshots
- `browser_evaluate`: Execute JavaScript on pages
- `browser_wait_for`: Wait for conditions
- And many more...

**Usage Example**:
```typescript
// Navigate to a page
await browser_navigate({ url: "https://example.com" });

// Take a screenshot
await browser_take_screenshot({ filename: "page-screenshot.png" });
```

### 4. Magic MCP (UI Component Generation)
**Status**: ✅ Installed and Configured

**Description**: Provides intelligent UI component generation and logo search capabilities.

**Version**: 0.0.46

**Configuration**:
```json
{
  "magic": {
    "command": "cmd",
    "args": ["/c", "npx", "@21st-dev/magic"]
  }
}
```

**Available Tools**:
- `21st_magic_component_builder`: Create new UI components
- `21st_magic_component_inspiration`: Get component inspiration from 21st.dev
- `21st_magic_component_refiner`: Refine existing UI components
- `logo_search`: Search for company logos in JSX, TSX, or SVG formats

**Usage Example**:
```typescript
// Search for logos
await logo_search({
  queries: ["discord", "github"],
  format: "TSX"
});

// Build a UI component
await magic_component_builder({
  message: "Create a modern dashboard card component",
  searchQuery: "dashboard card"
});
```

### 5. Sequential Thinking MCP
**Status**: ✅ Installed and Configured

**Description**: Provides advanced sequential thinking capabilities for complex problem-solving.

**Configuration**:
```json
{
  "sequential-thinking": {
    "command": "cmd",
    "args": ["/c", "npx", "@modelcontextprotocol/server-sequential-thinking"]
  }
}
```

**Available Tools**:
- `sequentialthinking`: Multi-step problem-solving with revision capabilities

**Features**:
- Dynamic thought count adjustment
- Revision and backtracking support
- Branch exploration
- Hypothesis generation and verification

### 6. Notion MCP
**Status**: ✅ Installed and Configured

**Description**: Provides integration with Notion workspace for documentation and knowledge management.

**Configuration**:
```json
{
  "notion": {
    "command": "cmd",
    "args": ["/c", "npx", "-y", "notion-mcp-server"],
    "env": {
      "NOTION_TOKEN": "${NOTION_TOKEN}",
      "NOTION_PAGE_ID": "${NOTION_PAGE_ID}"
    }
  }
}
```

**Required Environment Variables**:
```bash
# Get your integration token from: https://www.notion.so/my-integrations
NOTION_TOKEN=your-notion-integration-token

# Get your page ID from the URL: notion.so/workspace/PAGE_ID
NOTION_PAGE_ID=your-notion-page-id
```

**Setup Instructions**:
1. Go to https://www.notion.so/my-integrations
2. Create a new integration
3. Copy the integration token
4. Share the target page with your integration
5. Copy the page ID from the URL
6. Add both values to your `.env` file

## Installation Instructions

### Quick Start

1. **Verify Node.js Installation**:
   ```bash
   node --version  # Should be 18+
   npx --version
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in the required values:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file**:
   Add the following MCP-specific variables:
   ```bash
   # Supabase MCP Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here

   # Notion MCP Configuration
   NOTION_TOKEN=your-notion-integration-token
   NOTION_PAGE_ID=your-notion-page-id
   ```

4. **Test MCP Installations**:
   ```bash
   # Test Playwright
   npx @playwright/mcp --version

   # Test Supabase
   npx @supabase/mcp-server-supabase --version

   # Test Magic
   npx @21st-dev/magic --version

   # Test Sequential Thinking
   npx @modelcontextprotocol/server-sequential-thinking --version
   ```

### Troubleshooting

#### MCP Server Not Connecting

1. **Check environment variables**:
   ```bash
   # Verify .env file exists and contains required variables
   cat .env | grep -E "(SUPABASE_URL|SUPABASE_ANON_KEY|NOTION_TOKEN)"
   ```

2. **Verify npx is working**:
   ```bash
   where npx  # Windows
   which npx  # macOS/Linux
   ```

3. **Clear npm cache and retry**:
   ```bash
   npm cache clean --force
   npx @playwright/mcp --version
   ```

#### ByteRover MCP Connection Issues

If you see "Failed to reconnect to claude-flow":
- This is a known connection issue with the HTTP-based MCP server
- The server should automatically reconnect
- Check your internet connection
- Verify the machine ID in the URL matches your configuration

#### Supabase MCP Issues

1. **Verify Supabase credentials**:
   ```bash
   # Test connection
   curl https://your-project.supabase.co/rest/v1/ \
     -H "apikey: your-anon-key"
   ```

2. **Check environment variable substitution**:
   - Ensure `.env` file is in the project root
   - Restart Claude Code after updating environment variables

#### Notion MCP Issues

1. **Verify integration setup**:
   - Integration created at https://www.notion.so/my-integrations
   - Target page shared with the integration
   - Page ID correctly copied from URL

2. **Test token validity**:
   ```bash
   curl -H "Authorization: Bearer ${NOTION_TOKEN}" \
     -H "Notion-Version: 2022-06-28" \
     https://api.notion.com/v1/users/me
   ```

## Configuration Files

### Main Configuration (`.mcp.json`)
Located at project root. Contains all MCP server definitions.

### Claude Code Settings (`.claude/settings.local.json`)
Contains permissions and enabled server list:
```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "byterover-mcp",
    "supabase",
    "playwright",
    "magic",
    "sequential-thinking",
    "notion"
  ]
}
```

### App-Specific Configurations
Each app directory can have its own `.mcp.json` for app-specific MCP servers:
- `apps/api/.mcp.json`
- `apps/command-center/.mcp.json`
- `apps/dashboard/.mcp.json`
- `apps/discord-bot/.mcp.json`
- `apps/smart-form/.mcp.json`

## Best Practices

### Security
1. **Never commit `.env` files** with real credentials
2. **Use environment variables** for all sensitive data
3. **Rotate API keys regularly** in production
4. **Limit MCP server permissions** to required operations only

### Performance
1. **Cache MCP responses** when appropriate
2. **Use rate limiting** for external MCP servers
3. **Monitor MCP server health** and response times
4. **Implement timeout handling** for slow servers

### Development Workflow
1. **Test MCP tools** before using in production code
2. **Document custom MCP configurations** in app-specific CLAUDE.md files
3. **Keep MCP packages updated** with `npx -y` flag
4. **Use TypeScript types** for MCP tool parameters when available

## Verification Checklist

- [ ] All MCP packages install successfully
- [ ] Environment variables configured in `.env`
- [ ] `.mcp.json` contains all server definitions
- [ ] `settings.local.json` lists all enabled servers
- [ ] ByteRover MCP connects to knowledge base
- [ ] Supabase MCP can query database
- [ ] Playwright MCP can launch browser
- [ ] Magic MCP can search for components
- [ ] Sequential Thinking MCP responds
- [ ] Notion MCP can access workspace

## Support and Resources

### Documentation
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Unit Talk Platform Documentation](./README.md)

### MCP Server Documentation
- [Playwright MCP](https://github.com/anthropics/mcp-playwright)
- [Supabase MCP](https://github.com/supabase-community/mcp-server-supabase)
- [21st.dev Magic](https://21st.dev)
- [Sequential Thinking MCP](https://github.com/modelcontextprotocol/servers)

### Getting Help
- Check the troubleshooting section above
- Review app-specific CLAUDE.md files
- Consult the main CLAUDE.md for project-wide guidance
- Contact the platform team for assistance

---

**Last Updated**: November 27, 2025
**Maintainer**: Platform Engineering Team
**Next Review**: Monthly MCP configuration review
