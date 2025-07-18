import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

class TypeScriptErrorFixer {
    private readonly rootDir: string;

    constructor(rootDir: string) {
        this.rootDir = rootDir;
    }

    public async fix() {
        const files = this.findTypeScriptFiles();
        console.log(`Found ${files.length} TypeScript files to process`);

        for (const file of files) {
            try {
                await this.fixFile(file);
            } catch (err) {
                console.error(`Error fixing file ${file}:`, err);
            }
        }
    }

    private findTypeScriptFiles(): string[] {
        return glob.sync('src/**/*.ts', { cwd: this.rootDir, absolute: true });
    }

    private async fixFile(filePath: string) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        let fixed = content;

        // Fix: Date object handling
        fixed = this.fixDateHandling(fixed);

        // Fix: Error handler arguments
        fixed = this.fixErrorHandlerArgs(fixed);

        // Fix: Missing type definitions
        fixed = this.fixMissingTypes(fixed);

        // Fix: Logger instantiation
        fixed = this.fixLoggerInstantiation(fixed);

        // Fix: Base agent configuration
        fixed = this.fixBaseAgentConfig(fixed);

        // Fix: Metrics configuration
        fixed = this.fixMetricsConfig(fixed);

        if (fixed !== content) {
            await fs.promises.writeFile(filePath, fixed, 'utf8');
            console.log(`Fixed: ${filePath}`);
        }
    }

    private fixDateHandling(content: string): string {
        // Replace string.now() with Date.now()
        content = content.replace(/string\.now\(\)/g, 'Date.now()');

        // Fix getTime() calls on string timestamps
        content = content.replace(/(\w+)\.getTime\(\)/g, '$1 instanceof Date ? $1.getTime() : new Date($1).getTime()');

        // Fix other date methods
        const dateMethods = ['getHours', 'getFullYear', 'getMonth'];
        for (const method of dateMethods) {
            content = content.replace(
                new RegExp(`(\\w+)\\.${method}\\(\\)`, 'g'),
                `$1 instanceof Date ? $1.${method}() : new Date($1).${method}()`
            );
        }

        return content;
    }

    private fixErrorHandlerArgs(content: string): string {
        // Fix error handler constructor calls
        content = content.replace(/new ErrorHandler\((['"][\w-]+['"])\s*,\s*\w+\)/g, '$1');

        // Fix handleError calls with missing context
        content = content.replace(/handleError\(([^,)]+)\)/g, 'handleError($1, "error")');

        // Fix context parameter type
        content = content.replace(/handleError\([^,]+,\s*{\s*context:[^}]+}\)/g, 
            '$& as string');

        return content;
    }

    private fixMissingTypes(content: string): string {
        // Add missing BaseActivityParams properties
        if (content.includes('BaseActivityParams')) {
            content = content.replace(/(\w+)\s*:\s*BaseActivityParams\s*&\s*{([^}]+)}/g, 
                '$1: BaseActivityParams & {timestamp: string, error?: Error, context?: Record<string, unknown>, $2}');
        }

        // Fix Logger type imports
        if (content.includes('Logger') && !content.includes('import { Logger }')) {
            content = `import { Logger } from '../../utils/logger';\n${content}`;
        }

        return content;
    }

    private fixLoggerInstantiation(content: string): string {
        // Replace new Logger() with createLogger()
        content = content.replace(/new Logger\(([^)]+)\)/g, 'createLogger($1)');

        // Add createLogger import if needed
        if (content.includes('createLogger') && !content.includes('import { createLogger }')) {
            content = `import { createLogger } from '../../utils/logger';\n${content}`;
        }

        return content;
    }

    private fixBaseAgentConfig(content: string): string {
        // Add missing BaseAgentConfig properties
        if (content.includes('BaseAgentConfig')) {
            content = content.replace(/(\w+)\s*:\s*BaseAgentConfig\s*=\s*{([^}]+)}/g,
                '$1: BaseAgentConfig = {name: "DefaultAgent", version: "1.0.0", logLevel: "info", $2}');
        }

        return content;
    }

    private fixMetricsConfig(content: string): string {
        // Fix metrics configuration
        content = content.replace(/metrics:\s*{\s*enabled:\s*true\s*}/g, 
            'metrics: { enabled: true, interval: 60000 }');

        // Fix health check configuration
        content = content.replace(/health:\s*{\s*enabled:\s*true\s*}/g, 
            'health: { enabled: true, interval: 60000 }');

        return content;
    }
}

async function main() {
    const rootDir = path.resolve(__dirname, '..');
    const fixer = new TypeScriptErrorFixer(rootDir);
    await fixer.fix();
}

main().catch(console.error);
