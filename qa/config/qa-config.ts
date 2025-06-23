/**
 * QA Configuration
 * Central configuration for all QA testing modules
 */

export interface QAConfig {
  environment: {
    baseUrl: string;
    apiUrl: string;
    testMode: boolean;
    name?: string;
    credentials?: {
      username: string;
      password: string;
      testUser?: {
        email: string;
        password: string;
      };
      adminUser?: {
        email: string;
        password: string;
      };
    };
  };
  
  test: {
    headless: boolean;
    slowMo: number;
    timeout: number;
    retries: number;
  };
  
  userTiers: {
    free: {
      maxPicks: number;
      features: string[];
      maxParlays: number;
    };
    premium: {
      maxPicks: number;
      features: string[];
      maxParlays: number;
    };
    vip: {
      maxPicks: number;
      features: string[];
      maxParlays: number;
    };
    trial: {
      maxPicks: number;
      features: string[];
      maxParlays: number;
    };
  };
  
  performance: {
    budgets: {
      loadTime: number;
      firstContentfulPaint: number;
      largestContentfulPaint: number;
      cumulativeLayoutShift: number;
      firstInputDelay: number;
    };
    thresholds: {
      lcp: number;
      fid: number;
      cls: number;
    };
    devices: string[];
    networkConditions: string[];
    maxPageLoadTime: number;
    maxApiResponseTime: number;
    maxResourceSize: number;
    maxMemoryUsage: number;
    maxNetworkLatency: number;
    maxDatabaseQueryTime: number;
  };
  
  mobile: {
    maxLoadTime: number;
    minTouchTargetSize: number;
    testDevices: string[];
  };
  
  accessibility: {
    wcagLevel: 'AA' | 'AAA';
    includeExperimental: boolean;
    tags: string[];
    standards?: string[];
    excludeRules?: string[];
  };
  
  security: {
    testDepth: 'basic' | 'comprehensive';
    includeVulnerabilityScans: boolean;
    maxPasswordAttempts: number;
  };
  
  integration: {
    timeout: number;
    retryAttempts: number;
    mockExternalServices: boolean;
  };
  
  reporting: {
    outputDir: string;
    formats: string[];
    includeScreenshots: boolean;
    detailedLogs: boolean;
  };
}

export const defaultQAConfig: QAConfig = {
  environment: {
    baseUrl: process.env.QA_BASE_URL || 'http://localhost:3000',
    apiUrl: process.env.QA_API_URL || 'http://localhost:3000/api',
    testMode: true,
    name: process.env.QA_ENV_NAME || 'test',
    credentials: {
      username: process.env.QA_USERNAME || 'test@example.com',
      password: process.env.QA_PASSWORD || 'testpassword123',
      testUser: {
        email: process.env.QA_TEST_USER_EMAIL || 'testuser@example.com',
        password: process.env.QA_TEST_USER_PASSWORD || 'testpassword123'
      },
      adminUser: {
        email: process.env.QA_ADMIN_USER_EMAIL || 'admin@example.com',
        password: process.env.QA_ADMIN_USER_PASSWORD || 'adminpassword123'
      }
    }
  },
  
  test: {
    headless: process.env.QA_HEADLESS !== 'false',
    slowMo: parseInt(process.env.QA_SLOW_MO || '0'),
    timeout: 30000,
    retries: 2
  },
  
  userTiers: {
    free: {
      maxPicks: 3,
      features: ['basic_picks', 'daily_recap'],
      maxParlays: 1
    },
    premium: {
      maxPicks: 10,
      features: ['basic_picks', 'daily_recap', 'analytics', 'priority_support'],
      maxParlays: 5
    },
    vip: {
      maxPicks: -1, // unlimited
      features: ['basic_picks', 'daily_recap', 'analytics', 'priority_support', 'custom_alerts', 'api_access'],
      maxParlays: -1 // unlimited
    },
    trial: {
      maxPicks: 5,
      features: ['basic_picks', 'daily_recap'],
      maxParlays: 2
    }
  },

  performance: {
    budgets: {
      loadTime: 3000,
      firstContentfulPaint: 1500,
      largestContentfulPaint: 2500,
      cumulativeLayoutShift: 0.1,
      firstInputDelay: 100
    },
    thresholds: {
      lcp: 2500,
      fid: 100,
      cls: 0.1
    },
    devices: ['desktop', 'mobile', 'tablet'],
    networkConditions: ['fast3g', 'slow3g', 'offline'],
    maxPageLoadTime: 5000,
    maxApiResponseTime: 2000,
    maxResourceSize: 1000000,
    maxMemoryUsage: 50000000,
    maxNetworkLatency: 1000,
    maxDatabaseQueryTime: 500
  },
  
  mobile: {
    maxLoadTime: 5000,
    minTouchTargetSize: 44,
    testDevices: ['iPhone 12', 'Pixel 5', 'iPad']
  },
  
  accessibility: {
    wcagLevel: 'AA',
    includeExperimental: false,
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    standards: ['WCAG2A', 'WCAG2AA', 'WCAG21AA'],
    excludeRules: ['color-contrast'] // Example of rules to exclude during testing
  },
  
  security: {
    testDepth: 'comprehensive',
    includeVulnerabilityScans: true,
    maxPasswordAttempts: 5
  },
  
  integration: {
    timeout: 10000,
    retryAttempts: 3,
    mockExternalServices: false
  },
  
  reporting: {
    outputDir: './qa-reports',
    formats: ['html', 'json', 'pdf'],
    includeScreenshots: true,
    detailedLogs: true
  }
};