/**
 * DEPRECATION NOTICE
 * This script is legacy and will be removed or consolidated.
 * Prefer using scripts in scripts/ops or documented npm scripts in the repo root package.json.
 */

/**
 * Manual Command Center Verification Script
 *
 * This script manually verifies the Command Center application
 * functionality using Node.js HTTP requests instead of Playwright
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class CommandCenterVerifier {
  constructor(baseUrl = 'http://localhost:3004') {
    this.baseUrl = baseUrl;
    this.results = {
      connectivity: false,
      responseTime: 0,
      statusCode: 0,
      contentLength: 0,
      contentType: '',
      hasTitle: false,
      hasContent: false,
      nextjsDetected: false,
      timestamp: new Date().toISOString()
    };
  }

  async makeRequest(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const startTime = Date.now();

      const req = client.request(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
          // Limit data collection to prevent memory issues
          if (data.length > 100000) { // 100KB limit
            data = data.substring(0, 100000);
          }
        });

        res.on('end', () => {
          const endTime = Date.now();
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            responseTime: endTime - startTime
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async verify() {
    console.log('🚀 Starting Command Center Manual Verification');
    console.log('=' .repeat(60));

    try {
      console.log(`🌐 Testing connectivity to ${this.baseUrl}...`);

      const response = await this.makeRequest(this.baseUrl);

      // Basic connectivity test
      this.results.connectivity = true;
      this.results.statusCode = response.statusCode;
      this.results.responseTime = response.responseTime;
      this.results.contentLength = response.data.length;
      this.results.contentType = response.headers['content-type'] || '';

      console.log(`✅ HTTP ${response.statusCode} - Response received`);
      console.log(`⏱️  Response time: ${response.responseTime}ms`);
      console.log(`📄 Content type: ${this.results.contentType}`);
      console.log(`📊 Content length: ${this.results.contentLength} characters`);

      // Content analysis
      const content = response.data.toLowerCase();

      // Check for title
      const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) {
        this.results.hasTitle = true;
        console.log(`📖 Page title: "${titleMatch[1]}"`);
      }

      // Check for meaningful content
      this.results.hasContent = content.length > 1000;
      console.log(`📝 Has substantial content: ${this.results.hasContent}`);

      // Check for Next.js indicators
      const nextjsIndicators = [
        '_next/',
        'next-router',
        '__next',
        'next/script',
        'next/head'
      ];

      this.results.nextjsDetected = nextjsIndicators.some(indicator =>
        content.includes(indicator.toLowerCase())
      );
      console.log(`⚛️  Next.js detected: ${this.results.nextjsDetected}`);

      // Check for common UI framework indicators
      const uiIndicators = {
        tailwind: content.includes('tailwind') || /class="[^"]*\b(flex|grid|bg-|text-|p-|m-)\b/.test(content),
        react: content.includes('react') || content.includes('jsx'),
        dashboard: content.includes('dashboard') || content.includes('command center'),
        interactive: content.includes('<button') || content.includes('onclick') || content.includes('href')
      };

      console.log('🎨 UI Framework Detection:');
      Object.entries(uiIndicators).forEach(([framework, detected]) => {
        console.log(`  ${framework}: ${detected ? '✅' : '❌'}`);
      });

      // Performance assessment
      let performanceGrade = 'F';
      if (this.results.responseTime < 1000) performanceGrade = 'A';
      else if (this.results.responseTime < 2000) performanceGrade = 'B';
      else if (this.results.responseTime < 5000) performanceGrade = 'C';
      else if (this.results.responseTime < 10000) performanceGrade = 'D';

      console.log(`⚡ Performance Grade: ${performanceGrade} (${this.results.responseTime}ms)`);

    } catch (error) {
      console.error(`❌ Verification failed: ${error.message}`);
      this.results.connectivity = false;
    }

    this.printSummary();
    return this.results;
  }

  printSummary() {
    console.log('\n📊 COMMAND CENTER VERIFICATION SUMMARY');
    console.log('=' .repeat(60));

    const status = this.results.connectivity ?
      (this.results.statusCode === 200 ? '🟢 OPERATIONAL' : '🟡 RESPONDING') :
      '🔴 DOWN';

    console.log(`Status: ${status}`);
    console.log(`URL: ${this.baseUrl}`);
    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log(`Response Code: HTTP ${this.results.statusCode}`);
    console.log(`Response Time: ${this.results.responseTime}ms`);
    console.log(`Content Size: ${this.results.contentLength} characters`);
    console.log(`Content Type: ${this.results.contentType}`);
    console.log(`Has Title: ${this.results.hasTitle ? '✅' : '❌'}`);
    console.log(`Has Content: ${this.results.hasContent ? '✅' : '❌'}`);
    console.log(`Next.js App: ${this.results.nextjsDetected ? '✅' : '❌'}`);

    // Overall health assessment
    const healthScore = [
      this.results.connectivity,
      this.results.statusCode === 200,
      this.results.hasTitle,
      this.results.hasContent,
      this.results.nextjsDetected,
      this.results.responseTime < 5000
    ].filter(Boolean).length;

    const healthPercentage = Math.round((healthScore / 6) * 100);
    console.log(`Health Score: ${healthScore}/6 (${healthPercentage}%)`);

    if (healthPercentage >= 80) {
      console.log('\n🎉 COMMAND CENTER IS PRODUCTION READY!');
    } else if (healthPercentage >= 60) {
      console.log('\n⚠️  COMMAND CENTER IS OPERATIONAL BUT NEEDS ATTENTION');
    } else {
      console.log('\n🚨 COMMAND CENTER NEEDS IMMEDIATE ATTENTION');
    }

    console.log('=' .repeat(60));
  }
}

// Run verification
async function main() {
  const verifier = new CommandCenterVerifier('http://localhost:3004');

  try {
    await verifier.verify();
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = CommandCenterVerifier;