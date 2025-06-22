import { supabaseService } from './supabase';
import { logger } from '../utils/logger';

export interface ABTestCohort {
  id: string;
  name: string;
  description?: string;
  testType: string;
  percentage: number;
  isActive: boolean;
  config: Record<string, any>;
  createdAt: Date;
  endDate?: Date;
}

export interface UserCohortAssignment {
  id: string;
  userId: string;
  cohortId: string;
  testType: string;
  assignedAt: Date;
  metadata?: Record<string, any>;
}

export interface ABTestResult {
  id: string;
  userId: string;
  cohortId: string;
  testType: string;
  metric: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MessageTemplate {
  id: string;
  type: 'recap' | 'alert' | 'command_response' | 'notification';
  cohortId: string;
  template: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ABTestingService {
  // Cache functionality removed - using direct database queries for simplicity

  /**
   * Assign user to A/B test cohort
   */
  async assignUserToCohort(userId: string, testType: string = 'default'): Promise<string> {
    try {
      // Check if user already has assignment
      const { data: existing } = await supabaseService.client
        .from('user_cohort_assignments')
        .select('cohort_id')
        .eq('user_id', userId)
        .eq('test_type', testType)
        .single();

      if (existing) {
        return existing.cohort_id;
      }

      // Get active cohorts for test type
      const { data: cohorts } = await supabaseService.client
        .from('ab_test_cohorts')
        .select('*')
        .eq('test_type', testType)
        .eq('is_active', true);

      if (!cohorts || cohorts.length === 0) {
        return 'control'; // Default fallback
      }

      // Simple hash-based assignment for consistency
      const hash = this.hashUserId(userId + testType);
      const totalPercentage = cohorts.reduce((sum, c) => sum + c.percentage, 0);
      const normalizedHash = hash % totalPercentage;

      let currentPercentage = 0;
      let selectedCohort = cohorts[0];

      for (const cohort of cohorts) {
        currentPercentage += cohort.percentage;
        if (normalizedHash < currentPercentage) {
          selectedCohort = cohort;
          break;
        }
      }

      // Store assignment
      await supabaseService.client
        .from('user_cohort_assignments')
        .insert({
          user_id: userId,
          cohort_id: selectedCohort.id,
          test_type: testType,
          metadata: {}
        });

      return selectedCohort.id;

    } catch (error) {
      logger.error('Error assigning user to cohort:', error);
      return 'control';
    }
  }

  /**
   * Get message template for user
   */
  async getMessageTemplate(
    userId: string, 
    messageType: 'recap' | 'alert' | 'command_response' | 'notification',
    testType: string = 'default'
  ): Promise<MessageTemplate | null> {
    try {
      const cohortId = await this.assignUserToCohort(userId, testType);

      const { data: template } = await supabaseService.client
        .from('message_templates')
        .select('*')
        .eq('type', messageType)
        .eq('cohort_id', cohortId)
        .eq('is_active', true)
        .single();

      if (!template) {
        return null;
      }

      return {
        id: template.id,
        type: template.type as 'recap' | 'alert' | 'command_response' | 'notification',
        cohortId: template.cohort_id,
        template: template.template,
        variables: template.variables || [],
        isActive: template.is_active,
        createdAt: new Date(template.created_at),
        updatedAt: new Date(template.updated_at)
      };

    } catch (error) {
      logger.error('Error getting message template:', error);
      return null;
    }
  }

  /**
   * Render template with variables
   */
  renderTemplate(template: MessageTemplate, variables: Record<string, any>): string {
    let rendered = template.template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return rendered;
  }

  /**
   * Track A/B test result
   */
  async trackResult(
    userId: string,
    metric: string,
    value: number,
    testType: string = 'default',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const cohortId = await this.assignUserToCohort(userId, testType);

      await supabaseService.client
        .from('ab_test_results')
        .insert({
          user_id: userId,
          cohort_id: cohortId,
          test_type: testType,
          metric,
          value,
          metadata: metadata || {}
        });

    } catch (error) {
      logger.error('Error tracking A/B test result:', error);
    }
  }

  /**
   * Get A/B test analytics
   */
  async getAnalytics(testType: string = 'default', days: number = 30): Promise<any> {
    try {
      const { data: results } = await supabaseService.client
        .from('ab_test_results')
        .select(`
          cohort_id,
          metric,
          value,
          timestamp
        `)
        .eq('test_type', testType)
        .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (!results) return {};

      // Group by cohort and metric
      const analytics: Record<string, any> = {};

      for (const result of results) {
        const key = `${result.cohort_id}_${result.metric}`;
        if (!analytics[key]) {
          analytics[key] = {
            cohortId: result.cohort_id,
            metric: result.metric,
            values: [],
            count: 0,
            sum: 0,
            avg: 0
          };
        }

        analytics[key].values.push(result.value);
        analytics[key].count++;
        analytics[key].sum += result.value;
        analytics[key].avg = analytics[key].sum / analytics[key].count;
      }

      return analytics;

    } catch (error) {
      logger.error('Error getting A/B test analytics:', error);
      return {};
    }
  }

  /**
   * Create new cohort
   */
  async createCohort(cohort: Omit<ABTestCohort, 'createdAt'>): Promise<boolean> {
    try {
      await supabaseService.client
        .from('ab_test_cohorts')
        .insert({
          id: cohort.id,
          name: cohort.name,
          description: cohort.description,
          test_type: cohort.testType,
          percentage: cohort.percentage,
          is_active: cohort.isActive,
          config: cohort.config,
          end_date: cohort.endDate?.toISOString()
        });

      return true;
    } catch (error) {
      logger.error('Error creating cohort:', error);
      return false;
    }
  }

  /**
   * Create message template
   */
  async createTemplate(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      await supabaseService.client
        .from('message_templates')
        .insert({
          id: `${template.type}_${template.cohortId}_${Date.now()}`,
          type: template.type,
          cohort_id: template.cohortId,
          template: template.template,
          variables: template.variables,
          is_active: template.isActive
        });

      return true;
    } catch (error) {
      logger.error('Error creating template:', error);
      return false;
    }
  }

  /**
   * Get all cohorts
   */
  async getCohorts(testType?: string): Promise<ABTestCohort[]> {
    try {
      let query = supabaseService.client
        .from('ab_test_cohorts')
        .select('*');

      if (testType) {
        query = query.eq('test_type', testType);
      }

      const { data: cohorts } = await query;

      if (!cohorts) return [];

      return cohorts.map(c => {
        const cohort: ABTestCohort = {
          id: c.id,
          name: c.name,
          description: c.description,
          testType: c.test_type,
          percentage: c.percentage,
          isActive: c.is_active,
          config: c.config,
          createdAt: new Date(c.created_at)
        };

        if (c.end_date) {
          cohort.endDate = new Date(c.end_date);
        }

        return cohort;
      });

    } catch (error) {
      logger.error('Error getting cohorts:', error);
      return [];
    }
  }

  /**
   * Hash user ID for consistent assignment
   */
  private hashUserId(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export const abTestingService = new ABTestingService();