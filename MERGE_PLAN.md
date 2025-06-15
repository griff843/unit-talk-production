# Repository Merge Plan: Unit Talk Production System

## Overview
Merging main repository (gold standard) with droid agent repository to create a single, production-grade Fortune 100-level sports betting agent system.

## Analysis Summary

### Main Repository Strengths
- **RecapAgent**: Comprehensive, production-ready with extensive features
- **Rich Dependencies**: More complete package.json with additional libraries (axios, luxon, prettier)
- **Advanced Features**: Complex AI orchestration, embed builders, advice engines
- **Monitoring**: Comprehensive Prometheus metrics and health checks
- **Error Handling**: Robust error handling and logging systems

### Droid Agent Repository Strengths  
- **Cleaner BaseAgent**: More standardized, simpler lifecycle management
- **Consistent Architecture**: More uniform agent structure across implementations
- **Simplified Dependencies**: Cleaner dependency injection pattern
- **Test Structure**: Better organized test harnesses and mocks

## Merge Strategy

### Phase 1: Foundation Merge
1. **BaseAgent Architecture**: Use main repo's BaseAgent as foundation, incorporate droid repo's lifecycle improvements
2. **Dependencies**: Merge package.json files, keeping main repo's richer dependency set
3. **Configuration**: Standardize config structure using main repo's approach
4. **Types**: Enhance main repo's types with droid repo's cleaner interfaces

### Phase 2: Agent-by-Agent Analysis
For each agent, choose the most feature-complete implementation:

#### Keep Main Repository Implementation (Gold Standard)
- **RecapAgent**: Feature-complete, production-ready
- **AlertAgent**: Advanced AI orchestration and embed building
- **AnalyticsAgent**: Comprehensive metrics and monitoring
- **GradingAgent**: Robust scoring and evaluation logic

#### Evaluate and Merge
- **BaseAgent**: Merge lifecycle improvements from droid repo
- **Test Harnesses**: Standardize using best practices from both
- **Monitoring**: Enhance with any missing features from droid repo

#### Unique Agents
- Include any agents only present in one repository
- Apply production-quality standards to all

### Phase 3: Standardization
1. **Code Style**: Apply consistent TypeScript best practices
2. **Error Handling**: Standardize error handling patterns
3. **Testing**: Unify test harnesses and mocking strategies
4. **Documentation**: Merge and enhance documentation

### Phase 4: Production Readiness
1. **Type Safety**: Ensure end-to-end TypeScript compliance
2. **Modularity**: Verify clean interface definitions
3. **Scalability**: Ensure system can handle new agents/features
4. **Temporal Integration**: Verify workflow wiring compatibility

## Implementation Order
1. Merge BaseAgent foundation
2. Update package.json and dependencies
3. Merge RecapAgent (gold standard reference)
4. Process remaining agents by feature completeness
5. Standardize test harnesses
6. Clean up dead/duplicate code
7. Final production audit

## Success Criteria
- [ ] End-to-end TypeScript compliance
- [ ] All test harnesses functional
- [ ] Modular and scalable architecture
- [ ] Ready for Temporal workflow integration
- [ ] All .env/config toggles functional
- [ ] No dead or duplicate code
- [ ] Production-grade error handling
- [ ] Comprehensive monitoring and metrics