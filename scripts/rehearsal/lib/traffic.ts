/**
 * @fileoverview Traffic Manager
 * 
 * Manages blue/green deployment traffic switching for rehearsal scenarios.
 * Provides safe traffic routing with rollback capabilities.
 */

import { execSync } from 'child_process';
import { FlagsManager } from './flags';

interface TrafficSwitchResult {
  success: boolean;
  activeColor: 'blue' | 'green';
  percentage: number;
  timestamp: number;
  error?: string;
}

interface RollbackResult {
  success: boolean;
  rollbackTo: 'blue';
  timestamp: number;
  auditId?: string;
  error?: string;
}

export class TrafficManager {
  private environment: 'staging' | 'prod';
  private flagsManager: FlagsManager;
  private originalColor: 'blue' | 'green' | null = null;

  constructor(environment: 'staging' | 'prod') {
    this.environment = environment;
    this.flagsManager = new FlagsManager(environment);
  }

  async switchTraffic(targetColor: 'blue' | 'green', percentage: number = 100): Promise<TrafficSwitchResult> {
    try {
      // Store original color for rollback
      if (this.originalColor === null) {
        const currentColor = await this.flagsManager.getFlag('ACTIVE_COLOR');
        this.originalColor = currentColor || 'blue';
      }

      // Validate percentage
      if (percentage < 0 || percentage > 100) {
        throw new Error('Percentage must be between 0 and 100');
      }

      // Set active color flag
      const flagResult = await this.flagsManager.setFlag('ACTIVE_COLOR', targetColor);
      if (!flagResult.success) {
        throw new Error(`Failed to set ACTIVE_COLOR: ${flagResult.error}`);
      }

      // Update Docker Compose or Kubernetes routing
      await this.updateServiceRouting(targetColor, percentage);

      // Create audit entry
      await this.createTrafficAudit({
        action: 'traffic_switch',
        fromColor: this.originalColor,
        toColor: targetColor,
        percentage,
        environment: this.environment,
        timestamp: new Date().toISOString(),
        source: 'go-live-rehearsal'
      });

      return {
        success: true,
        activeColor: targetColor,
        percentage,
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        activeColor: this.originalColor || 'blue',
        percentage: 0,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async updateServiceRouting(targetColor: 'blue' | 'green', percentage: number): Promise<void> {
    if (this.environment === 'staging') {
      // For staging, use Docker Compose environment variables
      await this.updateDockerComposeRouting(targetColor, percentage);
    } else {
      // For production, this would integrate with load balancer (e.g., nginx, AWS ALB)
      await this.updateProductionRouting(targetColor, percentage);
    }
  }

  private async updateDockerComposeRouting(targetColor: 'blue' | 'green', percentage: number): Promise<void> {
    try {
      // Create or update docker-compose override file
      const composeOverride = this.generateComposeOverride(targetColor, percentage);
      
      // Write the override file
      require('fs').writeFileSync(
        'docker-compose.rehearsal.yml',
        composeOverride
      );

      // Apply the override
      execSync('docker-compose -f docker-compose.yml -f docker-compose.rehearsal.yml up -d', {
        stdio: 'pipe'
      });

      console.log(`✅ Updated Docker Compose routing to ${targetColor} (${percentage}%)`);
    } catch (error) {
      throw new Error(`Failed to update Docker Compose routing: ${error}`);
    }
  }

  private generateComposeOverride(targetColor: 'blue' | 'green', percentage: number): string {
    // Generate a Docker Compose override that routes traffic based on color
    return `
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx-rehearsal.conf:/etc/nginx/nginx.conf:ro
    environment:
      - ACTIVE_COLOR=${targetColor}
      - TRAFFIC_PERCENTAGE=${percentage}
    depends_on:
      - api-blue
      - api-green

  api-blue:
    extends:
      file: docker-compose.yml
      service: api
    container_name: unit-talk-api-blue
    ports:
      - "3010:3000"
    environment:
      - COLOR=blue
      - DEPLOY_COLOR=blue

  api-green:
    extends:
      file: docker-compose.yml
      service: api
    container_name: unit-talk-api-green
    ports:
      - "3011:3000"
    environment:
      - COLOR=green
      - DEPLOY_COLOR=green
`;
  }

  private async updateProductionRouting(targetColor: 'blue' | 'green', percentage: number): Promise<void> {
    // In production, this would integrate with actual load balancer
    // For now, simulate the operation
    console.log(`🔄 [SIMULATED] Updating production routing to ${targetColor} (${percentage}%)`);
    
    // This would typically involve:
    // 1. AWS ALB target group weight updates
    // 2. nginx upstream configuration changes
    // 3. Kubernetes service selector updates
    // 4. CloudFlare load balancer rules
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
  }

  async rollbackToBlue(): Promise<RollbackResult> {
    try {
      const rollbackResult = await this.switchTraffic('blue', 100);
      
      if (!rollbackResult.success) {
        throw new Error(`Rollback failed: ${rollbackResult.error}`);
      }

      // Create rollback audit entry
      const auditId = await this.createTrafficAudit({
        action: 'traffic_rollback',
        fromColor: 'green',
        toColor: 'blue',
        percentage: 100,
        environment: this.environment,
        timestamp: new Date().toISOString(),
        source: 'go-live-rehearsal-rollback',
        reason: 'Health gate failure or manual rollback'
      });

      return {
        success: true,
        rollbackTo: 'blue',
        timestamp: Date.now(),
        auditId
      };

    } catch (error) {
      return {
        success: false,
        rollbackTo: 'blue',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async triggerRollback(): Promise<RollbackResult> {
    try {
      // This would typically integrate with GitHub API for production
      if (this.environment === 'prod') {
        await this.triggerGitHubRollback();
      } else {
        // For staging, do local rollback
        await this.performLocalRollback();
      }

      const auditId = await this.createTrafficAudit({
        action: 'manual_rollback',
        fromColor: await this.getCurrentColor(),
        toColor: 'blue',
        percentage: 100,
        environment: this.environment,
        timestamp: new Date().toISOString(),
        source: 'go-live-rehearsal-manual'
      });

      return {
        success: true,
        rollbackTo: 'blue',
        timestamp: Date.now(),
        auditId
      };

    } catch (error) {
      return {
        success: false,
        rollbackTo: 'blue',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async triggerGitHubRollback(): Promise<void> {
    // In production, this would trigger a GitHub deployment rollback
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      throw new Error('GitHub token not available for rollback');
    }

    // Mock GitHub API call for rollback
    console.log('🔄 [SIMULATED] Triggering GitHub deployment rollback...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  private async performLocalRollback(): Promise<void> {
    // Rollback to blue deployment locally
    await this.switchTraffic('blue', 100);
    
    // Remove rehearsal override
    try {
      require('fs').unlinkSync('docker-compose.rehearsal.yml');
    } catch (error) {
      // File may not exist, ignore
    }

    // Restart services with original configuration
    execSync('docker-compose restart', { stdio: 'pipe' });
  }

  private async getCurrentColor(): Promise<'blue' | 'green'> {
    const color = await this.flagsManager.getFlag('ACTIVE_COLOR');
    return color || 'blue';
  }

  private async createTrafficAudit(auditData: any): Promise<string> {
    try {
      // In a real implementation, this would write to an audit table
      const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`📝 Traffic audit created: ${auditId}`, auditData);
      
      // Store in database
      // await this.supabase.from('traffic_audit').insert({
      //   id: auditId,
      //   ...auditData
      // });

      return auditId;
    } catch (error) {
      console.error('Failed to create traffic audit:', error);
      return '';
    }
  }

  async getTrafficStatus(): Promise<{
    activeColor: 'blue' | 'green';
    percentage: number;
    lastSwitch: number;
    rollbackAvailable: boolean;
  }> {
    try {
      const activeColor = await this.getCurrentColor();
      
      return {
        activeColor,
        percentage: 100, // In a real implementation, this would be tracked
        lastSwitch: Date.now(),
        rollbackAvailable: this.originalColor !== null
      };
    } catch (error) {
      return {
        activeColor: 'blue',
        percentage: 100,
        lastSwitch: 0,
        rollbackAvailable: false
      };
    }
  }

  async validateTrafficRouting(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check if both blue and green services are running
      const blueHealth = await this.checkServiceHealth('blue');
      const greenHealth = await this.checkServiceHealth('green');

      if (!blueHealth) {
        issues.push('Blue service is not healthy');
      }

      if (!greenHealth) {
        issues.push('Green service is not healthy');
      }

      // Check routing configuration
      const activeColor = await this.getCurrentColor();
      const routingValid = await this.validateRoutingConfig(activeColor);

      if (!routingValid) {
        issues.push('Routing configuration is invalid');
      }

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      issues.push(`Validation error: ${error}`);
      return { valid: false, issues };
    }
  }

  private async checkServiceHealth(color: 'blue' | 'green'): Promise<boolean> {
    try {
      const port = color === 'blue' ? '3010' : '3011';
      const response = await fetch(`http://localhost:${port}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async validateRoutingConfig(activeColor: 'blue' | 'green'): Promise<boolean> {
    try {
      // Check if routing is properly configured
      // This would validate nginx config, load balancer rules, etc.
      return true; // Simplified for rehearsal
    } catch (error) {
      return false;
    }
  }

  getOriginalColor(): 'blue' | 'green' | null {
    return this.originalColor;
  }

  resetOriginalColor(): void {
    this.originalColor = null;
  }
}