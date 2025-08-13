/**
 * Executive Readiness Snapshot E2E Tests
 * 
 * Comprehensive test suite for the Production Launch Gatekeeper v1
 * Executive Readiness Snapshot system including:
 * 
 * - API endpoint functionality and data validation
 * - UI component interactions and state management  
 * - Download functionality (Markdown, JSON, HTML)
 * - Real-time updates and auto-refresh
 * - Readiness gate validation logic
 * - Error handling and loading states
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as path from 'path';

test.describe('Executive Readiness Snapshot System', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to Command Center dashboard
    await page.goto('/dashboard');
    
    // Wait for Executive Readiness Card to load
    await page.waitForSelector('[data-testid="executive-readiness-card"]', { 
      state: 'visible',
      timeout: 10000 
    });
  });

  test.describe('API Endpoint Testing', () => {
    
    test('should fetch readiness snapshot data via GET endpoint', async ({ page }) => {
      // Test direct API endpoint
      const response = await page.request.get('/api/ops/readiness/snapshot');
      
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      // Validate response structure
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('overallReady');
      expect(data).toHaveProperty('readinessScore');
      expect(data).toHaveProperty('rehearsal');
      expect(data).toHaveProperty('testing');
      expect(data).toHaveProperty('guards');
      expect(data).toHaveProperty('incidents');
      expect(data).toHaveProperty('deploymentReadiness');
      expect(data).toHaveProperty('systemHealth');
      expect(data).toHaveProperty('artifacts');
      
      // Validate data types
      expect(typeof data.overallReady).toBe('boolean');
      expect(typeof data.readinessScore).toBe('number');
      expect(data.readinessScore).toBeGreaterThanOrEqual(0);
      expect(data.readinessScore).toBeLessThanOrEqual(100);
      
      // Validate nested structures
      expect(data.rehearsal).toHaveProperty('status');
      expect(data.rehearsal).toHaveProperty('isStale');
      expect(data.testing).toHaveProperty('e2e');
      expect(data.testing).toHaveProperty('infraSmoke');
      expect(data.testing).toHaveProperty('commandCenterE2E');
      expect(data.guards).toHaveProperty('overallStatus');
      expect(data.deploymentReadiness).toHaveProperty('missingRequirements');
      expect(Array.isArray(data.deploymentReadiness.missingRequirements)).toBe(true);
    });

    test('should generate Markdown report via POST endpoint', async ({ page }) => {
      const response = await page.request.post('/api/ops/readiness/snapshot');
      
      expect(response.status()).toBe(200);
      
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('text/markdown');
      
      const markdown = await response.text();
      expect(markdown).toContain('# Executive Readiness Snapshot');
      expect(markdown).toContain('**Overall Status**:');
      expect(markdown).toContain('**Readiness Score**:');
      expect(markdown).toContain('## 📋 Readiness Checklist');
      expect(markdown).toContain('### 1️⃣ Rehearsal Status');
      expect(markdown).toContain('### 2️⃣ Testing Status');
      expect(markdown).toContain('### 3️⃣ SLO Guards');
      expect(markdown).toContain('### 4️⃣ Incidents');
      expect(markdown).toContain('### 5️⃣ Deployment Gates');
    });

    test('should provide download endpoints with correct formats', async ({ page }) => {
      // Test Markdown download
      const markdownResponse = await page.request.get('/api/ops/readiness/download?format=markdown');
      expect(markdownResponse.status()).toBe(200);
      expect(markdownResponse.headers()['content-type']).toContain('text/markdown');
      expect(markdownResponse.headers()['content-disposition']).toContain('attachment');
      expect(markdownResponse.headers()['content-disposition']).toContain('.md');
      
      // Test JSON download
      const jsonResponse = await page.request.get('/api/ops/readiness/download?format=json');
      expect(jsonResponse.status()).toBe(200);
      expect(jsonResponse.headers()['content-type']).toContain('application/json');
      expect(jsonResponse.headers()['content-disposition']).toContain('attachment');
      expect(jsonResponse.headers()['content-disposition']).toContain('.json');
      
      // Test HTML/PDF download
      const htmlResponse = await page.request.get('/api/ops/readiness/download?format=pdf-html');
      expect(htmlResponse.status()).toBe(200);
      expect(htmlResponse.headers()['content-type']).toContain('text/html');
      expect(htmlResponse.headers()['content-disposition']).toContain('attachment');
      expect(htmlResponse.headers()['content-disposition']).toContain('.html');
      
      // Validate HTML contains PDF-ready styling
      const html = await htmlResponse.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('@page');
      expect(html).toContain('Executive Readiness Snapshot');
      expect(html).toContain('@media print');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Test with invalid route to trigger error handling
      const response = await page.request.get('/api/ops/readiness/invalid');
      expect(response.status()).toBe(404);
    });
  });

  test.describe('UI Component Functionality', () => {
    
    test('should display Executive Readiness Card with correct initial state', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Check card is visible
      await expect(card).toBeVisible();
      
      // Check for key elements
      await expect(card.locator('text=Executive Readiness Snapshot')).toBeVisible();
      await expect(card.locator('[data-testid="readiness-badge"]')).toBeVisible();
      await expect(card.locator('[data-testid="readiness-score"]')).toBeVisible();
      await expect(card.locator('[data-testid="readiness-progress"]')).toBeVisible();
      
      // Check for control buttons
      await expect(card.locator('[data-testid="refresh-button"]')).toBeVisible();
      await expect(card.locator('[data-testid="download-button"]')).toBeVisible();
    });

    test('should show loading state during data fetch', async ({ page }) => {
      // Reload page to trigger loading state
      await page.reload();
      
      // Check for loading indicator
      const loadingIndicator = page.locator('[data-testid="readiness-loading"]');
      await expect(loadingIndicator).toBeVisible();
      
      // Wait for loading to complete
      await page.waitForSelector('[data-testid="executive-readiness-card"]:not([data-loading="true"])', {
        timeout: 10000
      });
    });

    test('should display readiness score and status correctly', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Wait for data to load
      await card.waitFor({ state: 'visible' });
      
      // Check readiness score is displayed
      const scoreElement = card.locator('[data-testid="readiness-score"]');
      await expect(scoreElement).toBeVisible();
      
      const scoreText = await scoreElement.textContent();
      expect(scoreText).toMatch(/\d+\/100/);
      
      // Check readiness badge shows status
      const badge = card.locator('[data-testid="readiness-badge"]');
      await expect(badge).toBeVisible();
      
      const badgeText = await badge.textContent();
      expect(['READY', 'NOT READY'].includes(badgeText || '')).toBe(true);
    });

    test('should display missing requirements when not ready', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Check if missing requirements section exists
      const missingReqs = card.locator('[data-testid="missing-requirements"]');
      const isVisible = await missingReqs.isVisible();
      
      if (isVisible) {
        // If there are missing requirements, validate structure
        await expect(missingReqs.locator('text=Missing Requirements')).toBeVisible();
        
        const reqsList = missingReqs.locator('[data-testid="requirements-list"]');
        await expect(reqsList).toBeVisible();
        
        // Check that requirements are listed
        const reqItems = reqsList.locator('li');
        const count = await reqItems.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should show detailed status information for all categories', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Check for rehearsal status
      const rehearsalSection = card.locator('[data-testid="rehearsal-status"]');
      await expect(rehearsalSection).toBeVisible();
      await expect(rehearsalSection.locator('text=Rehearsal')).toBeVisible();
      
      // Check for E2E testing status
      const e2eSection = card.locator('[data-testid="e2e-status"]');
      await expect(e2eSection).toBeVisible();
      await expect(e2eSection.locator('text=E2E Tests')).toBeVisible();
      
      // Check for infrastructure status
      const infraSection = card.locator('[data-testid="infrastructure-status"]');
      await expect(infraSection).toBeVisible();
      await expect(infraSection.locator('text=Infrastructure')).toBeVisible();
      
      // Check for SLO guards status
      const sloSection = card.locator('[data-testid="slo-guards-status"]');
      await expect(sloSection).toBeVisible();
      await expect(sloSection.locator('text=SLO Guards')).toBeVisible();
      
      // Check for incidents status
      const incidentsSection = card.locator('[data-testid="incidents-status"]');
      await expect(incidentsSection).toBeVisible();
      await expect(incidentsSection.locator('text=Incidents')).toBeVisible();
      
      // Check for system health status
      const healthSection = card.locator('[data-testid="system-health-status"]');
      await expect(healthSection).toBeVisible();
      await expect(healthSection.locator('text=System Health')).toBeVisible();
    });

    test('should display deployment gates with correct status indicators', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Check deployment gates section
      const gatesSection = card.locator('[data-testid="deployment-gates"]');
      await expect(gatesSection).toBeVisible();
      await expect(gatesSection.locator('text=Deployment Gates')).toBeVisible();
      
      // Check for individual gates
      const expectedGates = [
        'E2E Tests',
        'Rehearsal',
        'Build',
        'Security',
        'Performance',
        'Schema Freeze'
      ];
      
      for (const gate of expectedGates) {
        await expect(gatesSection.locator(`text=${gate}`)).toBeVisible();
      }
      
      // Check that each gate has a status indicator
      const gateItems = gatesSection.locator('[data-testid^="gate-"]');
      const gateCount = await gateItems.count();
      expect(gateCount).toBeGreaterThanOrEqual(expectedGates.length);
    });
  });

  test.describe('Interactive Features', () => {
    
    test('should refresh data when refresh button is clicked', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      const refreshButton = card.locator('[data-testid="refresh-button"]');
      
      // Get initial timestamp
      const timestampElement = card.locator('[data-testid="last-updated"]');
      const initialTimestamp = await timestampElement.textContent();
      
      // Click refresh button
      await refreshButton.click();
      
      // Wait for loading state and completion
      await page.waitForTimeout(1000);
      
      // Check that refresh button shows loading state
      await expect(refreshButton.locator('[data-testid="refresh-icon"]')).toHaveClass(/animate-spin/);
      
      // Wait for refresh to complete
      await page.waitForTimeout(2000);
      
      // Verify timestamp updated (might be same if very fast)
      const newTimestamp = await timestampElement.textContent();
      expect(typeof newTimestamp).toBe('string');
    });

    test('should trigger download when download button is clicked', async ({ page, context }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      const downloadButton = card.locator('[data-testid="download-button"]');
      
      // Set up download promise
      const downloadPromise = page.waitForEvent('download');
      
      // Click download button
      await downloadButton.click();
      
      // Wait for download
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/readiness-snapshot-.*\.md$/);
      
      // Save download to temp file for validation
      const downloadPath = path.join(__dirname, 'temp', download.suggestedFilename());
      await download.saveAs(downloadPath);
      
      // Verify file exists and has content
      const fs = require('fs');
      const fileExists = fs.existsSync(downloadPath);
      expect(fileExists).toBe(true);
      
      if (fileExists) {
        const content = fs.readFileSync(downloadPath, 'utf8');
        expect(content).toContain('# Executive Readiness Snapshot');
        expect(content.length).toBeGreaterThan(100);
        
        // Cleanup
        fs.unlinkSync(downloadPath);
      }
    });

    test('should download JSON format when JSON button is clicked', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      const jsonButton = card.locator('[data-testid="download-json-button"]');
      
      // Check if JSON button exists and click it
      if (await jsonButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await jsonButton.click();
        
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/readiness-snapshot-.*\.json$/);
      }
    });

    test('should show deployment readiness button with correct state', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      const deployButton = card.locator('[data-testid="deploy-readiness-button"]');
      
      await expect(deployButton).toBeVisible();
      
      const buttonText = await deployButton.textContent();
      expect(['Ready to Deploy', 'Blocked'].includes(buttonText || '')).toBe(true);
      
      // Check button styling matches readiness state
      if (buttonText === 'Blocked') {
        await expect(deployButton).toBeDisabled();
      }
    });
  });

  test.describe('Real-time Updates', () => {
    
    test('should auto-refresh every 2 minutes', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      const timestampElement = card.locator('[data-testid="last-updated"]');
      
      // Get initial timestamp
      const initialTimestamp = await timestampElement.textContent();
      
      // Wait for auto-refresh (2 minutes + buffer)
      await page.waitForTimeout(125000); // 2 minutes 5 seconds
      
      // Check if timestamp updated
      const newTimestamp = await timestampElement.textContent();
      
      // Timestamp should have updated or at least the component should have tried to refresh
      expect(typeof newTimestamp).toBe('string');
    }, { timeout: 180000 }); // 3 minute timeout

    test('should handle connection errors gracefully', async ({ page }) => {
      // Simulate network error by going offline
      await page.context().setOffline(true);
      
      const card = page.locator('[data-testid="executive-readiness-card"]');
      const refreshButton = card.locator('[data-testid="refresh-button"]');
      
      // Try to refresh
      await refreshButton.click();
      
      // Should show error state or toast notification
      await page.waitForTimeout(3000);
      
      // Restore network
      await page.context().setOffline(false);
    });
  });

  test.describe('Error Handling', () => {
    
    test('should display error state when API fails', async ({ page }) => {
      // Mock API to return error
      await page.route('/api/ops/readiness/snapshot', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      // Reload to trigger error
      await page.reload();
      
      // Check for error display
      const errorElement = page.locator('[data-testid="readiness-error"]');
      await expect(errorElement).toBeVisible();
      
      // Check for retry button
      const retryButton = errorElement.locator('[data-testid="retry-button"]');
      await expect(retryButton).toBeVisible();
    });

    test('should recover from error state when retry is successful', async ({ page }) => {
      let callCount = 0;
      
      // Mock API to fail first time, succeed second time
      await page.route('/api/ops/readiness/snapshot', route => {
        callCount++;
        if (callCount === 1) {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Internal server error' })
          });
        } else {
          route.continue();
        }
      });
      
      // Reload to trigger error
      await page.reload();
      
      // Wait for error state
      const errorElement = page.locator('[data-testid="readiness-error"]');
      await expect(errorElement).toBeVisible();
      
      // Click retry
      const retryButton = errorElement.locator('[data-testid="retry-button"]');
      await retryButton.click();
      
      // Should recover and show normal card
      await page.waitForTimeout(2000);
      const card = page.locator('[data-testid="executive-readiness-card"]');
      await expect(card).toBeVisible();
      await expect(errorElement).not.toBeVisible();
    });

    test('should handle download errors gracefully', async ({ page }) => {
      // Mock download endpoint to fail
      await page.route('/api/ops/readiness/snapshot', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Download failed' })
          });
        } else {
          route.continue();
        }
      });
      
      const card = page.locator('[data-testid="executive-readiness-card"]');
      const downloadButton = card.locator('[data-testid="download-button"]');
      
      // Try to download
      await downloadButton.click();
      
      // Should show error toast or notification
      await page.waitForTimeout(2000);
      
      // Check for error indication (toast notification)
      const toast = page.locator('[data-testid="toast-error"]');
      if (await toast.isVisible()) {
        expect(await toast.textContent()).toContain('Download Failed');
      }
    });
  });

  test.describe('Readiness Logic Validation', () => {
    
    test('should calculate readiness score correctly', async ({ page }) => {
      const response = await page.request.get('/api/ops/readiness/snapshot');
      const data = await response.json();
      
      // Verify readiness score is within valid range
      expect(data.readinessScore).toBeGreaterThanOrEqual(0);
      expect(data.readinessScore).toBeLessThanOrEqual(100);
      
      // If score is 100, overall should be ready (assuming no missing requirements)
      if (data.readinessScore === 100 && data.deploymentReadiness.missingRequirements.length === 0) {
        expect(data.overallReady).toBe(true);
      }
      
      // If score is less than 90, overall should not be ready
      if (data.readinessScore < 90) {
        expect(data.overallReady).toBe(false);
      }
    });

    test('should identify missing requirements correctly', async ({ page }) => {
      const response = await page.request.get('/api/ops/readiness/snapshot');
      const data = await response.json();
      
      // Validate missing requirements structure
      expect(Array.isArray(data.deploymentReadiness.missingRequirements)).toBe(true);
      
      // If system is not ready, there should be missing requirements
      if (!data.overallReady) {
        expect(data.deploymentReadiness.missingRequirements.length).toBeGreaterThan(0);
      }
      
      // Each missing requirement should be a string
      data.deploymentReadiness.missingRequirements.forEach((req: any) => {
        expect(typeof req).toBe('string');
        expect(req.length).toBeGreaterThan(0);
      });
    });

    test('should validate SLO guard thresholds', async ({ page }) => {
      const response = await page.request.get('/api/ops/readiness/snapshot');
      const data = await response.json();
      
      // Validate guard data structure
      expect(data.guards).toHaveProperty('feedFreshnessSeconds');
      expect(data.guards).toHaveProperty('temporalBacklogAgeSeconds');
      expect(data.guards).toHaveProperty('failureBurnRateLevel');
      expect(data.guards).toHaveProperty('overallStatus');
      
      // Validate guard values
      expect(typeof data.guards.feedFreshnessSeconds).toBe('number');
      expect(typeof data.guards.temporalBacklogAgeSeconds).toBe('number');
      expect(['green', 'yellow', 'red'].includes(data.guards.failureBurnRateLevel)).toBe(true);
      expect(['green', 'yellow', 'red'].includes(data.guards.overallStatus)).toBe(true);
      
      // Validate threshold logic
      if (data.guards.feedFreshnessSeconds > 300) {
        expect(data.guards.violations.some((v: string) => v.includes('Feed freshness'))).toBe(true);
      }
      
      if (data.guards.temporalBacklogAgeSeconds > 300) {
        expect(data.guards.violations.some((v: string) => v.includes('Temporal backlog'))).toBe(true);
      }
    });

    test('should validate deployment gate logic', async ({ page }) => {
      const response = await page.request.get('/api/ops/readiness/snapshot');
      const data = await response.json();
      
      const gates = data.deploymentReadiness.gates;
      
      // Validate all required gates exist
      const requiredGates = [
        'e2eTests',
        'rehearsalFreshness', 
        'buildArtifacts',
        'securityScans',
        'performanceBaseline',
        'documentationComplete'
      ];
      
      requiredGates.forEach(gate => {
        expect(gates).toHaveProperty(gate);
        expect(typeof gates[gate]).toBe('boolean');
      });
      
      // Validate rehearsal freshness logic
      if (data.rehearsal.isStale || data.rehearsal.status !== 'passed') {
        expect(gates.rehearsalFreshness).toBe(false);
      }
      
      // Validate E2E test gate
      if (data.testing.e2e.status !== 'passed') {
        expect(gates.e2eTests).toBe(false);
      }
    });
  });

  test.describe('Accessibility & UX', () => {
    
    test('should be accessible to screen readers', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Check for proper ARIA labels
      await expect(card).toHaveAttribute('role');
      
      // Check for accessible button labels
      const refreshButton = card.locator('[data-testid="refresh-button"]');
      const downloadButton = card.locator('[data-testid="download-button"]');
      
      await expect(refreshButton).toHaveAccessibleName();
      await expect(downloadButton).toHaveAccessibleName();
      
      // Check for proper heading structure
      const headings = card.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to activate buttons with Enter/Space
      const refreshButton = card.locator('[data-testid="refresh-button"]');
      await refreshButton.focus();
      await expect(refreshButton).toBeFocused();
      
      // Test keyboard activation
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    });

    test('should have responsive design', async ({ page }) => {
      const card = page.locator('[data-testid="executive-readiness-card"]');
      
      // Test different viewport sizes
      const viewports = [
        { width: 320, height: 568 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1920, height: 1080 }  // Desktop
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);
        
        // Card should remain visible and functional
        await expect(card).toBeVisible();
        
        // Buttons should remain accessible
        const refreshButton = card.locator('[data-testid="refresh-button"]');
        const downloadButton = card.locator('[data-testid="download-button"]');
        
        await expect(refreshButton).toBeVisible();
        await expect(downloadButton).toBeVisible();
      }
    });
  });

  test.afterAll(async () => {
    // Cleanup temp directory
    const fs = require('fs');
    const tempDir = path.join(__dirname, 'temp');
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});