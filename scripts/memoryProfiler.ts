
/**
 * Memory and Resource Profiler
 * Monitors system resource usage and identifies optimization opportunities
 */

class MemoryResourceProfiler {
  private initialMemory: NodeJS.MemoryUsage;
  private samples: Array<{ timestamp: number; memory: NodeJS.MemoryUsage; cpu: number }> = [];

  constructor() {
    this.initialMemory = process.memoryUsage();
  }

  async profileSystem(): Promise<void> {
    console.log('🧠 MEMORY & RESOURCE PROFILING');
    console.log('==============================\n');

    console.log('📊 Initial Memory State:');
    this.logMemoryUsage(this.initialMemory);

    // Start profiling
    console.log('\n🔍 Starting resource monitoring...');
    await this.startProfiling();

    // Simulate workload
    console.log('\n⚡ Simulating production workload...');
    await this.simulateWorkload();

    // Analyze results
    console.log('\n📈 Analyzing resource usage patterns...');
    await this.analyzeResults();

    // Generate recommendations
    console.log('\n💡 Generating optimization recommendations...');
    this.generateRecommendations();
  }

  private async startProfiling(): Promise<void> {
    const profilingDuration = 30000; // 30 seconds
    const sampleInterval = 1000; // 1 second
    
    const startTime = Date.now();
    
    const profileInterval = setInterval(() => {
      const memory = process.memoryUsage();
      const cpu = process.cpuUsage();
      const cpuPercent = (cpu.user + cpu.system) / 1000000; // Convert to seconds
      
      this.samples.push({
        timestamp: Date.now() - startTime,
        memory,
        cpu: cpuPercent
      });
      
      if (Date.now() - startTime >= profilingDuration) {
        clearInterval(profileInterval);
      }
    }, sampleInterval);

    // Wait for profiling to complete
    await new Promise(resolve => setTimeout(resolve, profilingDuration));
  }

  private async simulateWorkload(): Promise<void> {
    const workloads = [
      { name: 'Agent Processing', fn: () => this.simulateAgentWork() },
      { name: 'Data Processing', fn: () => this.simulateDataProcessing() },
      { name: 'Memory Allocation', fn: () => this.simulateMemoryAllocation() },
      { name: 'Concurrent Operations', fn: () => this.simulateConcurrentOps() }
    ];

    for (const workload of workloads) {
      console.log(`   🔄 Running ${workload.name}...`);
      const startMem = process.memoryUsage();
      
      await workload.fn();
      
      const endMem = process.memoryUsage();
      const memDiff = endMem.heapUsed - startMem.heapUsed;
      console.log(`   📊 ${workload.name}: ${this.formatBytes(memDiff)} memory change`);
    }
  }

  private async simulateAgentWork(): Promise<void> {
    // Simulate agent processing
    const agents = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      data: new Array(1000).fill(0).map(() => Math.random())
    }));

    await Promise.all(agents.map(async (agent) => {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      // Process data
      agent.data = agent.data.map(x => x * 2).filter(x => x > 0.5);
    }));
  }

  private async simulateDataProcessing(): Promise<void> {
    // Simulate large data processing
    const largeDataset = new Array(50000).fill(0).map(() => ({
      id: Math.random(),
      value: Math.random() * 1000,
      timestamp: Date.now()
    }));

    // Process data
    const processed = largeDataset
      .filter(item => item.value > 500)
      .map(item => ({ ...item, processed: true }))
      .sort((a, b) => b.value - a.value);

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async simulateMemoryAllocation(): Promise<void> {
    // Simulate memory-intensive operations
    const buffers = [];
    
    for (let i = 0; i < 10; i++) {
      const buffer = Buffer.alloc(1024 * 1024); // 1MB buffer
      buffer.fill(i);
      buffers.push(buffer);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Cleanup
    buffers.length = 0;
    if (global.gc) {
      global.gc();
    }
  }

  private async simulateConcurrentOps(): Promise<void> {
    // Simulate concurrent operations
    const operations = Array.from({ length: 20 }, (_, i) => 
      this.simulateAsyncOperation(i)
    );

    await Promise.all(operations);
  }

  private async simulateAsyncOperation(id: number): Promise<void> {
    const data = new Array(5000).fill(0).map(() => Math.random());
    
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    
    // Process data
    const result = data.reduce((sum, val) => sum + val, 0);
    return result;
  }

  private analyzeResults(): void {
    if (this.samples.length === 0) {
      console.log('   ⚠️ No profiling data collected');
      return;
    }

    const memoryUsages = this.samples.map(s => s.memory.heapUsed);
    const maxMemory = Math.max(...memoryUsages);
    const minMemory = Math.min(...memoryUsages);
    const avgMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;

    console.log(`   📊 Memory Usage Analysis:`);
    console.log(`      Peak Memory: ${this.formatBytes(maxMemory)}`);
    console.log(`      Min Memory: ${this.formatBytes(minMemory)}`);
    console.log(`      Avg Memory: ${this.formatBytes(avgMemory)}`);
    console.log(`      Memory Growth: ${this.formatBytes(maxMemory - minMemory)}`);

    // Check for memory leaks
    const memoryGrowth = maxMemory - minMemory;
    const growthRate = memoryGrowth / this.samples.length;
    
    if (growthRate > 1024 * 1024) { // 1MB per sample
      console.log(`   🚨 Potential memory leak detected: ${this.formatBytes(growthRate)}/sample`);
    } else {
      console.log(`   ✅ Memory usage appears stable`);
    }

    // Analyze garbage collection
    const finalMemory = process.memoryUsage();
    console.log(`\n   🗑️ Current Memory State:`);
    this.logMemoryUsage(finalMemory);
  }

  private generateRecommendations(): void {
    const currentMemory = process.memoryUsage();
    const recommendations = [];

    // Memory recommendations
    if (currentMemory.heapUsed > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Consider implementing memory pooling for large objects');
    }

    if (currentMemory.external > 50 * 1024 * 1024) { // 50MB
      recommendations.push('Review external memory usage (buffers, etc.)');
    }

    // Performance recommendations
    recommendations.push('Implement object pooling for frequently created objects');
    recommendations.push('Use streaming for large data processing');
    recommendations.push('Consider implementing lazy loading for non-critical data');
    recommendations.push('Add memory monitoring alerts for production');

    console.log(`   💡 Optimization Recommendations:`);
    recommendations.forEach((rec, index) => {
      console.log(`      ${index + 1}. ${rec}`);
    });

    // Performance score
    const heapUsedMB = currentMemory.heapUsed / (1024 * 1024);
    const performanceScore = Math.max(0, 100 - Math.floor(heapUsedMB / 2));
    
    console.log(`\n   📈 Performance Score: ${performanceScore}/100`);
    
    if (performanceScore >= 80) {
      console.log('   🎉 Memory usage optimized for production!');
    } else if (performanceScore >= 60) {
      console.log('   ⚠️ Memory usage acceptable but could be improved');
    } else {
      console.log('   🚨 Memory usage needs optimization before production');
    }
  }

  private logMemoryUsage(memory: NodeJS.MemoryUsage): void {
    console.log(`      Heap Used: ${this.formatBytes(memory.heapUsed)}`);
    console.log(`      Heap Total: ${this.formatBytes(memory.heapTotal)}`);
    console.log(`      External: ${this.formatBytes(memory.external)}`);
    console.log(`      RSS: ${this.formatBytes(memory.rss)}`);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

const profiler = new MemoryResourceProfiler();
profiler.profileSystem().catch(console.error);
