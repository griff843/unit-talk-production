# 🤝 Contributing to Unit Talk Platform

## Overview

Welcome to the Unit Talk Platform! This guide helps you contribute effectively
to our Fortune 100-grade sports betting intelligence platform.

## 🚀 Quick Start

### Development Workflow

1. **Fork Repository** - Create personal fork for development
2. **Branch Naming** - Use `feat/<agent>-<desc>` or `fix/<agent>-<issue>`
3. **Development** - Follow coding standards and agent patterns
4. **Quality Gates** - `npm run lint && npm run test` must pass ✅
5. **Pull Request** - Submit PR with detailed description

### Branch Naming Convention

```bash
# Feature branches
feat/grading-agent-ml-improvements
feat/discord-bot-slash-commands

# Bug fixes
fix/alert-agent-notification-issue
fix/database-connection-timeout

# Documentation
docs/agent-development-guide
docs/api-documentation-update
```

## 🏗️ Agent Development Guidelines

### Core Requirements

- **Extend BaseAgent** - Never reinvent lifecycle/metrics/retry logic
- **Configuration** - Must match `BaseAgentConfigSchema`
- **No Duplicate Types** - Always import from `@shared/types/*`
- **Health Checks** - Implement comprehensive health monitoring
- **Error Handling** - Use centralized error handling patterns

### Agent Creation Checklist

```typescript
// ✅ Correct pattern
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig } from '@shared/types/base';

export class NewAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async healthCheck(): Promise<HealthCheckResult> {
    // Required: Implement health monitoring
  }
}
```

## 🧪 Testing Requirements

### Quality Standards

- **Test Coverage**: 80%+ required before PR approval
- **Agent Testing**: All agents must have dedicated test suites
- **Integration Tests**: Test agent interactions and workflows
- **Type Safety**: Full TypeScript compliance with strict mode

### Test Commands

```bash
# Run all tests
npm test

# Test specific agent
npm run agents:test -- --agent=GradingAgent

# Coverage report
npm run test:coverage

# Integration tests
npm run test:integration
```

## 📝 Code Quality

### TypeScript Standards

- **Strict Mode**: Enabled across all projects
- **Type Imports**: Use proper import patterns
- **Shared Types**: Import from designated locations only
- **No Any Types**: Explicit typing required

### Linting & Formatting

```bash
# Lint code (Docker-only)
docker-compose exec api npm run lint

# Fix linting issues (Docker-only)
docker-compose exec api npm run lint:fix

# Format code (Docker-only)
docker-compose exec api npm run format

# Type checking (Docker-only; prod config where applicable)
docker-compose run --rm --no-deps api npm run type-check
```

## 🧠 AI Assistant Guidelines

When using AI tools (Copilot, Claude, etc.) for development:

### ✅ Allowed

- Type annotations and interface definitions
- Import statement corrections
- Code formatting and linting fixes
- Test case generation
- Documentation improvements

### ❌ Prohibited

- Modifying core business logic without review
- Changing agent lifecycle management
- Altering BaseAgent patterns
- Overriding established architecture patterns

### Best Practices

- **Types Only**: Focus on adding missing types and imports
- **Use Standards**: Always use `AgentExecutionPayload` and `BaseActivityParams`
- **Preserve Logic**: Never modify functionality, only enhance typing
- **Review Changes**: Always review AI-generated code before committing

## 🔧 Development Environment

### Prerequisites

- **Node.js 18+** with npm/yarn
- **TypeScript 5+** for development
- **Docker** for service orchestration
- **Redis** for caching and queues
- **PostgreSQL 14+** (via Supabase)

### Setup Commands

```bash
# Install dependencies
npm install

# Start development environment
npm run start:dev

# Start Temporal worker
npm run worker:dev

# Run database migrations
npm run db:migrate
```

## 📋 Pull Request Process

### PR Template

We use `.github/pull_request_template.md` for consistency.

### Required Information

- **Description**: Clear explanation of changes
- **Testing**: Evidence of testing completed
- **Impact**: Assessment of system impact
- **Documentation**: Updates to relevant docs

### Review Process

1. **Automated Checks**: CI/CD pipeline validation
2. **Code Review**: Manual review by maintainers
3. **Testing**: QA validation if needed
4. **Approval**: Two approvals required for merge

## 🏆 Code Standards

### Architecture Patterns

- **BaseAgent Framework**: All agents inherit from BaseAgent
- **Shared Types**: Consistent type system across platform
- **Error Handling**: Centralized error management
- **Logging**: Structured logging with correlation IDs
- **Metrics**: Prometheus metrics for all agents

### Performance Requirements

- **Response Time**: <500ms for API calls
- **Processing**: <50s for 1-minute update cycles
- **Memory Usage**: Efficient memory management
- **Error Rates**: <0.1% for critical operations

## 🆘 Getting Help

### Resources

- **[Agent Development SOP](agent-development-sop.md)** - Detailed development
  guide
- **[Architecture Documentation](ARCHITECTURE.md)** - System design
- **[API Documentation](api/)** - REST API reference
- **[BaseAgent README](../apps/api/src/agents/BaseAgent/README.md)** - Core
  framework

### Support Channels

- **GitHub Issues** - Bug reports and feature requests
- **Documentation** - Comprehensive guides in `/docs`

## 🔐 Security Guidelines

### Security Requirements

- **No Hardcoded Secrets** - Use environment variables
- **Input Validation** - Validate all external inputs
- **Error Sanitization** - Never expose internal details
- **Dependency Scanning** - Regular security audits

### Security Review

All PRs undergo security review for:

- Secret management
- Input validation
- Error handling
- Dependency vulnerabilities

---

## License

**Proprietary** - All rights reserved. Contributors must sign CLA.

---

_Thank you for contributing to Unit Talk Platform! 🏆_
