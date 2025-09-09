/**
 * Docker Service Monitoring for Command Center
 * Real-time monitoring of Docker services, containers, and health
 */

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopped' | 'error';
  container_id: string;
  image: string;
  ports: string[];
  uptime: string;
  cpu_usage: number;
  memory_usage: number;
  memory_limit: number;
  network_rx: number;
  network_tx: number;
  last_health_check: string;
  health_check_passing: boolean;
  restart_count: number;
  logs: string[];
}

export interface ServiceMetrics {
  timestamp: number;
  services: ServiceHealth[];
  system: {
    total_containers: number;
    running_containers: number;
    stopped_containers: number;
    total_images: number;
    disk_usage: string;
    network_usage: {
      rx_bytes: number;
      tx_bytes: number;
    };
    metrics?: {
      system: {
        cpu: number;
        memory: {
          percentage: number;
          used: number;
          total: number;
        };
        disk: {
          percentage: number;
          used: number;
          total: number;
        };
        uptime: number;
        load: {
          load1: number;
        };
      };
    };
    issues?: string[];
  };
  docker?: {
    running_containers: number;
    stopped_containers: number;
    total_images: number;
    disk_usage: string;
  };
}

class DockerServiceMonitor {
  private isMonitoring = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private callbacks: ((metrics: ServiceMetrics) => void)[] = [];

  /**
   * Start monitoring Docker services
   */
  async startMonitoring(intervalMs: number = 5000): Promise<void> {
    if (this.isMonitoring) {
      console.warn('Docker monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.callbacks.forEach(callback => callback(metrics));
      } catch (error) {
        console.error('Failed to collect Docker metrics:', error);
      }
    }, intervalMs);

    console.log('Docker service monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.isMonitoring = false;
    console.log('Docker service monitoring stopped');
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(callback: (metrics: ServiceMetrics) => void): () => void {
    this.callbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Collect comprehensive Docker service metrics
   */
  async collectMetrics(): Promise<ServiceMetrics> {
    const [services, systemInfo] = await Promise.all([
      this.getServiceHealth(),
      this.getSystemInfo(),
    ]);

    return {
      timestamp: Date.now(),
      services,
      system: systemInfo,
    };
  }

  /**
   * Get health status of all services
   */
  private async getServiceHealth(): Promise<ServiceHealth[]> {
    try {
      // Get container list with stats
      const containers = await this.execDockerCommand(
        'ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"'
      );
      const containerLines = containers
        .split('\n')
        .slice(1)
        .filter(line => line.trim());

      const services: ServiceHealth[] = [];

      for (const line of containerLines) {
        const [id, name, image, status, ports] = line.split('\t').map(s => s.trim());

        if (!id || !name) continue;

        try {
          // Get detailed stats for this container
          const stats = await this.getContainerStats(id);
          const logs = await this.getContainerLogs(id, 5);
          const inspect = await this.getContainerInspect(id);

          const service: ServiceHealth = {
            name,
            status: this.parseContainerStatus(status),
            container_id: id,
            image,
            ports: ports
              ? ports
                  .split(',')
                  .map(p => p.trim())
                  .filter(p => p)
              : [],
            uptime: this.calculateUptime(inspect.StartedAt),
            cpu_usage: stats.cpu_percent,
            memory_usage: stats.memory_usage,
            memory_limit: stats.memory_limit,
            network_rx: stats.network_rx,
            network_tx: stats.network_tx,
            last_health_check: new Date().toISOString(),
            health_check_passing:
              inspect.Health?.Status === 'healthy' || status.includes('healthy'),
            restart_count: inspect.RestartCount || 0,
            logs,
          };

          services.push(service);
        } catch (error) {
          console.warn(`Failed to get stats for container ${name}:`, error);

          // Add basic service info even if stats fail
          services.push({
            name,
            status: this.parseContainerStatus(status),
            container_id: id,
            image,
            ports: ports
              ? ports
                  .split(',')
                  .map(p => p.trim())
                  .filter(p => p)
              : [],
            uptime: 'unknown',
            cpu_usage: 0,
            memory_usage: 0,
            memory_limit: 0,
            network_rx: 0,
            network_tx: 0,
            last_health_check: new Date().toISOString(),
            health_check_passing: false,
            restart_count: 0,
            logs: [],
          });
        }
      }

      return services;
    } catch (error) {
      console.error('Failed to get service health:', error);
      return [];
    }
  }

  /**
   * Get container statistics
   */
  private async getContainerStats(containerId: string): Promise<{
    cpu_percent: number;
    memory_usage: number;
    memory_limit: number;
    network_rx: number;
    network_tx: number;
  }> {
    try {
      const statsJson = await this.execDockerCommand(
        `stats ${containerId} --no-stream --format "table {{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}"`
      );
      const lines = statsJson.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('No stats data returned');
      }

      const [cpuPerc, memUsage, netIO] = (lines[1] ?? '').split('\t').map(s => s.trim());

      // Parse CPU percentage
      const cpu_percent = parseFloat((cpuPerc ?? '').replace('%', '')) || 0;

      // Parse memory usage (format: "used / limit")
      const memParts = (memUsage ?? '').split(' / ');
      const memory_usage = this.parseBytes(memParts[0] ?? '') || 0;
      const memory_limit = this.parseBytes(memParts[1] ?? '') || 0;

      // Parse network I/O (format: "rx / tx")
      const netParts = (netIO ?? '').split(' / ');
      const network_rx = this.parseBytes(netParts[0] ?? '') || 0;
      const network_tx = this.parseBytes(netParts[1] ?? '') || 0;

      return {
        cpu_percent,
        memory_usage,
        memory_limit,
        network_rx,
        network_tx,
      };
    } catch (error) {
      console.warn(`Failed to get stats for container ${containerId}:`, error);
      return {
        cpu_percent: 0,
        memory_usage: 0,
        memory_limit: 0,
        network_rx: 0,
        network_tx: 0,
      };
    }
  }

  /**
   * Get container logs
   */
  private async getContainerLogs(containerId: string, lines: number = 5): Promise<string[]> {
    try {
      const logs = await this.execDockerCommand(`logs ${containerId} --tail ${lines} --timestamps`);
      return logs
        .split('\n')
        .filter(line => line.trim())
        .slice(-lines);
    } catch (error) {
      console.warn(`Failed to get logs for container ${containerId}:`, error);
      return [];
    }
  }

  /**
   * Get container inspection details
   */
  private async getContainerInspect(containerId: string): Promise<any> {
    try {
      const inspectJson = await this.execDockerCommand(`inspect ${containerId}`);
      const inspect = JSON.parse(inspectJson);
      return Array.isArray(inspect) ? inspect[0] : inspect;
    } catch (error) {
      console.warn(`Failed to inspect container ${containerId}:`, error);
      return {};
    }
  }

  /**
   * Get Docker system information
   */
  private async getSystemInfo(): Promise<ServiceMetrics['system']> {
    try {
      const [systemInfo, networkStats] = await Promise.all([
        this.execDockerCommand(
          'system df --format "table {{.Type}}\\t{{.Total}}\\t{{.Active}}\\t{{.Size}}"'
        ),
        this.getNetworkStats(),
      ]);

      const lines = systemInfo
        .split('\n')
        .slice(1)
        .filter(line => line.trim());
      let total_containers = 0;
      let running_containers = 0;
      let total_images = 0;
      let disk_usage = '0B';

      for (const line of lines) {
        const [type, total, active, size] = line.split('\t').map(s => s.trim());

        if (type === 'Containers') {
          total_containers = parseInt(total ?? '') || 0;
          running_containers = parseInt(active ?? '') || 0;
        } else if (type === 'Images') {
          total_images = parseInt(total ?? '') || 0;
        } else if (type === 'Local Volumes') {
          disk_usage = size || '0B';
        }
      }

      return {
        total_containers,
        running_containers,
        stopped_containers: total_containers - running_containers,
        total_images,
        disk_usage,
        network_usage: networkStats,
      };
    } catch (error) {
      console.error('Failed to get system info:', error);
      return {
        total_containers: 0,
        running_containers: 0,
        stopped_containers: 0,
        total_images: 0,
        disk_usage: '0B',
        network_usage: { rx_bytes: 0, tx_bytes: 0 },
      };
    }
  }

  /**
   * Get network statistics
   */
  private async getNetworkStats(): Promise<{ rx_bytes: number; tx_bytes: number }> {
    try {
      // This is a simplified approach - in production you might want to aggregate
      // network stats from all containers or use system-level network monitoring
      return { rx_bytes: 0, tx_bytes: 0 };
    } catch (error) {
      return { rx_bytes: 0, tx_bytes: 0 };
    }
  }

  /**
   * Execute Docker command and return output
   */
  private async execDockerCommand(command: string): Promise<string> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const fullCommand = `docker ${command}`;
    const { stdout, stderr } = await execAsync(fullCommand);

    if (stderr && !stderr.includes('WARNING')) {
      console.warn(`Docker command warning: ${stderr}`);
    }

    return stdout.trim();
  }

  /**
   * Parse container status to health status
   */
  private parseContainerStatus(status: string): ServiceHealth['status'] {
    const statusLower = status.toLowerCase();

    if (statusLower.includes('up') && statusLower.includes('healthy')) {
      return 'healthy';
    } else if (statusLower.includes('up') && statusLower.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statusLower.includes('up')) {
      return 'healthy'; // Assume healthy if up and no explicit health status
    } else if (statusLower.includes('restarting') || statusLower.includes('starting')) {
      return 'starting';
    } else if (statusLower.includes('exited') || statusLower.includes('stopped')) {
      return 'stopped';
    } else {
      return 'error';
    }
  }

  /**
   * Calculate uptime from start time
   */
  private calculateUptime(startedAt: string): string {
    if (!startedAt) return 'unknown';

    try {
      const startTime = new Date(startedAt).getTime();
      const now = Date.now();
      const uptimeMs = now - startTime;

      const seconds = Math.floor(uptimeMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}d ${hours % 24}h`;
      } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else {
        return `${minutes}m`;
      }
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Parse bytes string to number
   */
  private parseBytes(bytesStr: string): number {
    if (!bytesStr) return 0;

    const match = bytesStr.match(/^([\d.]+)\s*([KMGT]?i?B)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1] ?? '');
    const unit = (match[2] ?? '').toUpperCase();

    const multipliers: { [key: string]: number } = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
      KIB: 1024,
      MIB: 1024 * 1024,
      GIB: 1024 * 1024 * 1024,
      TIB: 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }

  /**
   * Control service (start, stop, restart)
   */
  async controlService(
    serviceName: string,
    action: 'start' | 'stop' | 'restart'
  ): Promise<{ success: boolean; message: string }> {
    try {
      let command: string;

      switch (action) {
        case 'start':
          command = `start ${serviceName}`;
          break;
        case 'stop':
          command = `stop ${serviceName}`;
          break;
        case 'restart':
          command = `restart ${serviceName}`;
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const _result = await this.execDockerCommand(command);

      return {
        success: true,
        message: `Service ${serviceName} ${action}ed successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to ${action} service ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get current metrics without starting monitoring
   */
  async getCurrentMetrics(): Promise<ServiceMetrics> {
    return this.collectMetrics();
  }
}

// Export singleton instance
export const dockerServiceMonitor = new DockerServiceMonitor();

export { DockerServiceMonitor };
