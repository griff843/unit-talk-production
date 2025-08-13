#!/usr/bin/env tsx

/**
 * Docker Pin Manager - Manages Docker base image digest pinning
 * Ensures supply chain security by pinning base images to specific SHA256 digests
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import crypto from 'crypto';

interface DockerPin {
  image: string;
  digest: string;
  updatedAt: string;
  architecture?: string;
  size?: number;
  vulnerabilities?: number;
}

interface DockerPinsFile {
  pins: Record<string, string>;
  metadata: {
    generated: string;
    generator: string;
    version: string;
  };
  images: Record<string, DockerPin>;
}

interface PinManagerConfig {
  pinsFile: string;
  dockerfilesPattern: string[];
  excludeImages: string[];
  verifyBeforePin: boolean;
  maxConcurrentPulls: number;
}

export class DockerPinManager {
  private config: PinManagerConfig;
  private logger: any;

  constructor(config: Partial<PinManagerConfig> = {}, logger: any = console) {
    this.config = {
      pinsFile: '.docker-pins.json',
      dockerfilesPattern: ['Dockerfile*'],
      excludeImages: ['scratch'],
      verifyBeforePin: true,
      maxConcurrentPulls: 3,
      ...config
    };
    this.logger = logger;
  }

  /**
   * Discover all base images from Dockerfiles
   */
  async discoverBaseImages(): Promise<string[]> {
    const dockerfiles = await this.findDockerfiles();
    const baseImages = new Set<string>();

    for (const dockerfile of dockerfiles) {
      try {
        const content = await fs.readFile(dockerfile, 'utf-8');
        const images = this.extractFromStatements(content);
        
        for (const image of images) {
          if (!this.shouldExcludeImage(image)) {
            baseImages.add(image);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to read ${dockerfile}:`, error);
      }
    }

    return Array.from(baseImages);
  }

  /**
   * Find all Dockerfiles in the project
   */
  private async findDockerfiles(): Promise<string[]> {
    const dockerfiles: string[] = [];
    
    for (const pattern of this.config.dockerfilesPattern) {
      try {
        const output = execSync(`find . -name "${pattern}" -type f`, { encoding: 'utf-8' });
        const files = output.trim().split('\n').filter(f => f && !f.includes('.pinned'));
        dockerfiles.push(...files);
      } catch (error) {
        this.logger.warn(`Failed to find files with pattern ${pattern}:`, error);
      }
    }

    return [...new Set(dockerfiles)];
  }

  /**
   * Extract FROM statements from Dockerfile content
   */
  private extractFromStatements(content: string): string[] {
    const lines = content.split('\n');
    const fromStatements: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match FROM statements, excluding comments and multi-stage references
      if (trimmed.match(/^FROM\s+/) && !trimmed.startsWith('#')) {
        let imageName = trimmed.replace(/^FROM\s+/, '');
        
        // Remove "as alias" part
        imageName = imageName.replace(/\s+[aA][sS]\s+\w+.*$/, '');
        
        // Skip if it's already pinned with digest
        if (!imageName.includes('@sha256:')) {
          fromStatements.push(imageName.trim());
        }
      }
    }

    return fromStatements;
  }

  /**
   * Check if an image should be excluded from pinning
   */
  private shouldExcludeImage(image: string): boolean {
    return this.config.excludeImages.some(excluded => 
      image === excluded || image.startsWith(excluded + ':')
    );
  }

  /**
   * Get digest for a Docker image
   */
  async getImageDigest(image: string): Promise<DockerPin | null> {
    try {
      this.logger.info(`Getting digest for: ${image}`);

      // Pull the image to get latest digest
      execSync(`docker pull ${image}`, { stdio: 'pipe' });

      // Get image digest
      const inspectOutput = execSync(
        `docker inspect --format='{{json .}}' ${image}`,
        { encoding: 'utf-8' }
      );

      const imageInfo = JSON.parse(inspectOutput);
      const repoDigests = imageInfo.RepoDigests || [];
      
      if (repoDigests.length === 0) {
        this.logger.warn(`No digest available for ${image}`);
        return null;
      }

      // Extract digest from first repo digest
      const digestMatch = repoDigests[0].match(/@(sha256:[a-f0-9]+)/);
      if (!digestMatch) {
        this.logger.warn(`Could not extract digest from ${repoDigests[0]}`);
        return null;
      }

      const digest = digestMatch[1];
      const size = imageInfo.Size || 0;
      const architecture = imageInfo.Architecture || 'unknown';

      return {
        image,
        digest,
        updatedAt: new Date().toISOString(),
        architecture,
        size,
        vulnerabilities: 0 // Will be updated by security scanning
      };

    } catch (error) {
      this.logger.error(`Failed to get digest for ${image}:`, error);
      return null;
    }
  }

  /**
   * Verify that a digest is valid and accessible
   */
  async verifyDigest(image: string, digest: string): Promise<boolean> {
    try {
      execSync(`docker manifest inspect ${image}@${digest}`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      this.logger.warn(`Digest verification failed for ${image}@${digest}`);
      return false;
    }
  }

  /**
   * Load existing pins file
   */
  async loadPinsFile(): Promise<DockerPinsFile> {
    try {
      const content = await fs.readFile(this.config.pinsFile, 'utf-8');
      const pins = JSON.parse(content) as DockerPinsFile;
      
      // Ensure structure is correct
      return {
        pins: pins.pins || {},
        metadata: pins.metadata || {
          generated: new Date().toISOString(),
          generator: 'docker-pin-manager',
          version: '1.0.0'
        },
        images: pins.images || {}
      };
    } catch (error) {
      this.logger.info('No existing pins file found, creating new one');
      return {
        pins: {},
        metadata: {
          generated: new Date().toISOString(),
          generator: 'docker-pin-manager',
          version: '1.0.0'
        },
        images: {}
      };
    }
  }

  /**
   * Save pins file
   */
  async savePinsFile(pins: DockerPinsFile): Promise<void> {
    pins.metadata.generated = new Date().toISOString();
    
    const content = JSON.stringify(pins, null, 2);
    await fs.writeFile(this.config.pinsFile, content, 'utf-8');
    
    this.logger.info(`Saved pins to ${this.config.pinsFile}`);
  }

  /**
   * Update pins for discovered images
   */
  async updatePins(forceUpdate: boolean = false): Promise<{ updated: number; failed: number }> {
    const baseImages = await this.discoverBaseImages();
    const existingPins = await this.loadPinsFile();
    
    let updated = 0;
    let failed = 0;

    this.logger.info(`Found ${baseImages.length} base images to process`);

    // Process images in batches to avoid overwhelming Docker
    const batchSize = this.config.maxConcurrentPulls;
    for (let i = 0; i < baseImages.length; i += batchSize) {
      const batch = baseImages.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (image) => {
        try {
          const existingPin = existingPins.images[image];
          
          // Skip if already pinned and not forcing update
          if (!forceUpdate && existingPin && existingPin.digest) {
            this.logger.info(`Skipping ${image} (already pinned)`);
            return;
          }

          const pin = await this.getImageDigest(image);
          
          if (pin) {
            // Verify digest if enabled
            if (this.config.verifyBeforePin) {
              const isValid = await this.verifyDigest(image, pin.digest);
              if (!isValid) {
                this.logger.error(`Digest verification failed for ${image}`);
                failed++;
                return;
              }
            }

            existingPins.pins[image] = pin.digest;
            existingPins.images[image] = pin;
            updated++;
            
            this.logger.info(`✅ Updated pin for ${image} -> ${pin.digest.substring(0, 16)}...`);
          } else {
            failed++;
            this.logger.error(`❌ Failed to get pin for ${image}`);
          }
        } catch (error) {
          failed++;
          this.logger.error(`Error processing ${image}:`, error);
        }
      }));
    }

    await this.savePinsFile(existingPins);
    
    return { updated, failed };
  }

  /**
   * Generate pinned Dockerfiles
   */
  async generatePinnedDockerfiles(): Promise<string[]> {
    const pins = await this.loadPinsFile();
    const dockerfiles = await this.findDockerfiles();
    const generatedFiles: string[] = [];

    for (const dockerfile of dockerfiles) {
      try {
        const content = await fs.readFile(dockerfile, 'utf-8');
        let pinnedContent = content;

        // Replace each unpinned image with pinned version
        for (const [image, digest] of Object.entries(pins.pins)) {
          const escapedImage = image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          // Replace FROM statements
          pinnedContent = pinnedContent.replace(
            new RegExp(`^FROM\\s+${escapedImage}\\s*$`, 'gm'),
            `FROM ${image}@${digest}`
          );
          
          pinnedContent = pinnedContent.replace(
            new RegExp(`^FROM\\s+${escapedImage}\\s+[aA][sS]\\s+`, 'gm'),
            `FROM ${image}@${digest} AS `
          );
        }

        // Only save if content changed
        if (pinnedContent !== content) {
          const pinnedFile = `${dockerfile}.pinned`;
          await fs.writeFile(pinnedFile, pinnedContent, 'utf-8');
          generatedFiles.push(pinnedFile);
          
          this.logger.info(`Generated pinned Dockerfile: ${pinnedFile}`);
        }
      } catch (error) {
        this.logger.error(`Failed to generate pinned version of ${dockerfile}:`, error);
      }
    }

    return generatedFiles;
  }

  /**
   * Validate all pinned digests
   */
  async validatePins(): Promise<{ valid: number; invalid: string[] }> {
    const pins = await this.loadPinsFile();
    const invalid: string[] = [];
    let valid = 0;

    this.logger.info(`Validating ${Object.keys(pins.pins).length} pinned images...`);

    for (const [image, digest] of Object.entries(pins.pins)) {
      const isValid = await this.verifyDigest(image, digest);
      
      if (isValid) {
        valid++;
        this.logger.info(`✅ ${image}@${digest.substring(0, 16)}...`);
      } else {
        invalid.push(`${image}@${digest}`);
        this.logger.error(`❌ ${image}@${digest.substring(0, 16)}...`);
      }
    }

    return { valid, invalid };
  }

  /**
   * Generate security report for pinned images
   */
  async generateSecurityReport(): Promise<string> {
    const pins = await this.loadPinsFile();
    const baseImages = await this.discoverBaseImages();
    
    const report = [
      '# Docker Security Report',
      '',
      `**Generated**: ${new Date().toISOString()}`,
      `**Total Base Images**: ${baseImages.length}`,
      `**Pinned Images**: ${Object.keys(pins.pins).length}`,
      '',
      '## Pinned Images',
      ''
    ];

    for (const [image, digest] of Object.entries(pins.pins)) {
      const imageInfo = pins.images[image];
      const size = imageInfo?.size ? `${Math.round(imageInfo.size / 1024 / 1024)}MB` : 'unknown';
      const arch = imageInfo?.architecture || 'unknown';
      
      report.push(`- **${image}**`);
      report.push(`  - Digest: \`${digest}\``);
      report.push(`  - Size: ${size}`);
      report.push(`  - Architecture: ${arch}`);
      report.push(`  - Updated: ${imageInfo?.updatedAt || 'unknown'}`);
      report.push('');
    }

    // Add unpinned images warning
    const unpinned = baseImages.filter(image => !pins.pins[image]);
    if (unpinned.length > 0) {
      report.push('## ⚠️ Unpinned Images');
      report.push('');
      unpinned.forEach(image => {
        report.push(`- ${image}`);
      });
      report.push('');
    }

    return report.join('\n');
  }

  /**
   * Clean up old pinned Dockerfiles
   */
  async cleanup(): Promise<number> {
    let cleaned = 0;
    
    try {
      const output = execSync('find . -name "Dockerfile*.pinned" -type f', { encoding: 'utf-8' });
      const pinnedFiles = output.trim().split('\n').filter(f => f);
      
      for (const file of pinnedFiles) {
        await fs.unlink(file);
        cleaned++;
        this.logger.info(`Removed old pinned file: ${file}`);
      }
    } catch (error) {
      // No pinned files found, or other error
    }

    return cleaned;
  }

  /**
   * Get summary statistics
   */
  async getStats(): Promise<{
    totalImages: number;
    pinnedImages: number;
    dockerfiles: number;
    lastUpdate: string;
  }> {
    const baseImages = await this.discoverBaseImages();
    const pins = await this.loadPinsFile();
    const dockerfiles = await this.findDockerfiles();

    return {
      totalImages: baseImages.length,
      pinnedImages: Object.keys(pins.pins).length,
      dockerfiles: dockerfiles.length,
      lastUpdate: pins.metadata.generated
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const manager = new DockerPinManager();

  try {
    switch (command) {
      case 'discover':
        const images = await manager.discoverBaseImages();
        console.log('Base images found:');
        images.forEach(image => console.log(`  ${image}`));
        break;

      case 'update':
        const forceUpdate = args.includes('--force');
        console.log(`Updating pins (force: ${forceUpdate})...`);
        const result = await manager.updatePins(forceUpdate);
        console.log(`Updated: ${result.updated}, Failed: ${result.failed}`);
        break;

      case 'generate':
        console.log('Generating pinned Dockerfiles...');
        const generated = await manager.generatePinnedDockerfiles();
        console.log(`Generated ${generated.length} pinned Dockerfiles`);
        break;

      case 'validate':
        console.log('Validating pinned digests...');
        const validation = await manager.validatePins();
        console.log(`Valid: ${validation.valid}, Invalid: ${validation.invalid.length}`);
        if (validation.invalid.length > 0) {
          console.log('Invalid digests:');
          validation.invalid.forEach(invalid => console.log(`  ${invalid}`));
        }
        break;

      case 'report':
        const report = await manager.generateSecurityReport();
        console.log(report);
        break;

      case 'cleanup':
        const cleaned = await manager.cleanup();
        console.log(`Cleaned up ${cleaned} old pinned files`);
        break;

      case 'stats':
        const stats = await manager.getStats();
        console.log(`Docker Pin Statistics:
  Total Images: ${stats.totalImages}
  Pinned Images: ${stats.pinnedImages}
  Dockerfiles: ${stats.dockerfiles}
  Last Update: ${stats.lastUpdate}`);
        break;

      default:
        console.log(`Docker Pin Manager

Usage: docker-pin-manager.ts <command>

Commands:
  discover   - Discover all base images from Dockerfiles
  update     - Update pins for all discovered images (--force to force update)
  generate   - Generate pinned versions of Dockerfiles
  validate   - Validate all pinned digests are accessible
  report     - Generate security report
  cleanup    - Remove old pinned Dockerfiles
  stats      - Show statistics about pins

Examples:
  npx tsx scripts/docker/docker-pin-manager.ts discover
  npx tsx scripts/docker/docker-pin-manager.ts update --force
  npx tsx scripts/docker/docker-pin-manager.ts generate`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

export { DockerPinManager };