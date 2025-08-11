/**
 * Smart Form Caching System
 *
 * Features:
 * - Form data persistence
 * - Validation result caching
 * - User preferences storage
 * - Draft management
 * - Performance optimization
 */

interface FormCacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  formId?: string;
  userId?: string;
  validation?: ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  timestamp: number;
}

interface FormDraft {
  formId: string;
  userId: string;
  data: any;
  lastSaved: number;
  autoSave: boolean;
}

interface SmartFormCacheOptions {
  ttl?: number;
  persist?: boolean;
  autoSave?: boolean;
  formId?: string;
  userId?: string;
}

class SmartFormCache {
  private cache = new Map<string, FormCacheItem>();
  private validationCache = new Map<string, ValidationResult>();
  private drafts = new Map<string, FormDraft>();

  private readonly VALIDATION_TTL = 60000; // 1 minute for validation results
  private readonly FORM_DATA_TTL = 1800000; // 30 minutes for form data
  private readonly DRAFT_TTL = 86400000; // 24 hours for drafts
  private readonly USER_PREF_TTL = 604800000; // 7 days for user preferences

  // Core cache operations
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check TTL
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set<T>(key: string, data: T, options: SmartFormCacheOptions = {}): void {
    const ttl = options.ttl || this.FORM_DATA_TTL;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      formId: options.formId,
      userId: options.userId,
    });

    // Persist to localStorage if requested
    if (options.persist) {
      this.persistToStorage(key, data, ttl);
    }
  }

  // Form-specific caching methods
  cacheFormData(formId: string, userId: string, data: any, autoSave = false): void {
    const key = `form:${formId}:${userId}`;
    this.set(key, data, {
      ttl: this.FORM_DATA_TTL,
      formId,
      userId,
      persist: true,
    });

    // Also save as draft if auto-save enabled
    if (autoSave) {
      this.saveDraft(formId, userId, data, true);
    }
  }

  getFormData(formId: string, userId: string): any | null {
    const key = `form:${formId}:${userId}`;
    return this.get(key) || this.loadFromStorage(key);
  }

  // Validation result caching
  cacheValidationResult(formId: string, data: any, result: ValidationResult): void {
    const validationKey = this.generateValidationKey(formId, data);
    result.timestamp = Date.now();
    this.validationCache.set(validationKey, result);

    // Auto-cleanup old validation results
    setTimeout(() => {
      this.validationCache.delete(validationKey);
    }, this.VALIDATION_TTL);
  }

  getCachedValidation(formId: string, data: any): ValidationResult | null {
    const validationKey = this.generateValidationKey(formId, data);
    const cached = this.validationCache.get(validationKey);

    if (cached && Date.now() - cached.timestamp < this.VALIDATION_TTL) {
      return cached;
    }

    return null;
  }

  private generateValidationKey(formId: string, data: any): string {
    // Create a hash of the form data for validation caching
    const dataStr = JSON.stringify(data);
    return `validation:${formId}:${this.simpleHash(dataStr)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Draft management
  saveDraft(formId: string, userId: string, data: any, autoSave = false): void {
    const draftKey = `draft:${formId}:${userId}`;
    const draft: FormDraft = {
      formId,
      userId,
      data,
      lastSaved: Date.now(),
      autoSave,
    };

    this.drafts.set(draftKey, draft);

    // Persist draft to localStorage
    this.persistToStorage(draftKey, draft, this.DRAFT_TTL);
  }

  getDraft(formId: string, userId: string): FormDraft | null {
    const draftKey = `draft:${formId}:${userId}`;
    const cached = this.drafts.get(draftKey);
    if (cached) return cached;

    // Try loading from storage
    return this.loadFromStorage<FormDraft>(draftKey);
  }

  deleteDraft(formId: string, userId: string): void {
    const draftKey = `draft:${formId}:${userId}`;
    this.drafts.delete(draftKey);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(`smart-form:${draftKey}`);
    }
  }

  getAllDrafts(userId: string): FormDraft[] {
    const userDrafts: FormDraft[] = [];

    // Check memory cache
    for (const [key, draft] of this.drafts.entries()) {
      if (draft.userId === userId) {
        userDrafts.push(draft);
      }
    }

    // Check localStorage
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`smart-form:draft:`) && key.includes(userId)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const item = JSON.parse(stored);
              if (Date.now() - item.timestamp < this.DRAFT_TTL) {
                userDrafts.push(item.data);
              }
            }
          } catch (error) {
            console.warn('Failed to load draft from storage:', error);
          }
        }
      });
    }

    return userDrafts;
  }

  // User preferences
  setUserPreference(userId: string, key: string, value: any): void {
    const prefKey = `pref:${userId}:${key}`;
    this.set(prefKey, value, {
      ttl: this.USER_PREF_TTL,
      persist: true,
      userId,
    });
  }

  getUserPreference<T>(userId: string, key: string, defaultValue: T): T {
    const prefKey = `pref:${userId}:${key}`;
    return this.get<T>(prefKey) || this.loadFromStorage<T>(prefKey) || defaultValue;
  }

  // Form templates and configurations
  cacheFormTemplate(templateId: string, template: any): void {
    this.set(`template:${templateId}`, template, {
      ttl: this.DRAFT_TTL, // Templates are stable, cache for 24 hours
      persist: true,
    });
  }

  getFormTemplate(templateId: string): any | null {
    return this.get(`template:${templateId}`) || this.loadFromStorage(`template:${templateId}`);
  }

  // Auto-save functionality
  enableAutoSave(formId: string, userId: string, interval = 30000): () => void {
    const autoSaveInterval = setInterval(() => {
      const currentData = this.getFormData(formId, userId);
      if (currentData) {
        this.saveDraft(formId, userId, currentData, true);
      }
    }, interval);

    // Return cleanup function
    return () => clearInterval(autoSaveInterval);
  }

  // Storage operations
  private persistToStorage(key: string, data: any, ttl: number): void {
    if (typeof window === 'undefined') return;

    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`smart-form:${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to persist to localStorage:', error);
    }
  }

  private loadFromStorage<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(`smart-form:${key}`);
      if (!stored) return null;

      const item = JSON.parse(stored);

      // Check TTL
      if (Date.now() > item.timestamp + item.ttl) {
        localStorage.removeItem(`smart-form:${key}`);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }

  // Performance optimization
  preloadFormData(formId: string, userId: string): void {
    // Pre-load form data and template in background
    Promise.all([
      this.getFormData(formId, userId),
      this.getFormTemplate(formId),
      this.getDraft(formId, userId),
    ]).catch(error => {
      console.warn('Form data preload failed:', error);
    });
  }

  // Cleanup and maintenance
  cleanup(): void {
    const now = Date.now();

    // Cleanup memory cache
    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.ttl) {
        this.cache.delete(key);
      }
    }

    // Cleanup validation cache
    for (const [key, result] of this.validationCache.entries()) {
      if (now - result.timestamp > this.VALIDATION_TTL) {
        this.validationCache.delete(key);
      }
    }

    // Cleanup drafts
    for (const [key, draft] of this.drafts.entries()) {
      if (now - draft.lastSaved > this.DRAFT_TTL) {
        this.drafts.delete(key);
      }
    }

    // Cleanup localStorage
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('smart-form:')) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (now > item.timestamp + item.ttl) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            localStorage.removeItem(key); // Remove corrupted items
          }
        }
      });
    }
  }

  // Statistics and monitoring
  getStats() {
    return {
      cacheSize: this.cache.size,
      validationCacheSize: this.validationCache.size,
      draftsCount: this.drafts.size,
      memoryUsage: (this.cache.size + this.validationCache.size + this.drafts.size) * 64,
    };
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.validationCache.clear();
    this.drafts.clear();

    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('smart-form:')) {
          localStorage.removeItem(key);
        }
      });
    }
  }
}

// Global smart form cache instance
export const smartFormCache = new SmartFormCache();

// React hooks for smart form cache integration
import { useCallback, useEffect, useState } from 'react';

export function useSmartFormCache() {
  return {
    get: smartFormCache.get.bind(smartFormCache),
    set: smartFormCache.set.bind(smartFormCache),
    cacheFormData: smartFormCache.cacheFormData.bind(smartFormCache),
    getFormData: smartFormCache.getFormData.bind(smartFormCache),
    saveDraft: smartFormCache.saveDraft.bind(smartFormCache),
    getDraft: smartFormCache.getDraft.bind(smartFormCache),
  };
}

export function useFormData(formId: string, userId: string) {
  const [data, setData] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load form data from cache
    const cachedData = smartFormCache.getFormData(formId, userId);
    const draft = smartFormCache.getDraft(formId, userId);

    // Use draft if more recent than cached form data
    if (draft && (!cachedData || draft.lastSaved > Date.now() - 300000)) {
      setData(draft.data);
    } else if (cachedData) {
      setData(cachedData);
    }

    setLoaded(true);
  }, [formId, userId]);

  const saveData = useCallback(
    (newData: any, autoSave = false) => {
      smartFormCache.cacheFormData(formId, userId, newData, autoSave);
      setData(newData);
    },
    [formId, userId]
  );

  return { data, loaded, saveData };
}

export function useFormDrafts(userId: string) {
  const [drafts, setDrafts] = useState<FormDraft[]>([]);

  useEffect(() => {
    const userDrafts = smartFormCache.getAllDrafts(userId);
    setDrafts(userDrafts);
  }, [userId]);

  const refreshDrafts = useCallback(() => {
    const userDrafts = smartFormCache.getAllDrafts(userId);
    setDrafts(userDrafts);
  }, [userId]);

  return { drafts, refreshDrafts };
}

export function useFormValidation(formId: string) {
  const validateWithCache = useCallback(
    async (data: any, validator: (data: any) => Promise<ValidationResult>) => {
      // Check cache first
      const cached = smartFormCache.getCachedValidation(formId, data);
      if (cached) {
        return cached;
      }

      // Run validation and cache result
      const result = await validator(data);
      smartFormCache.cacheValidationResult(formId, data, result);

      return result;
    },
    [formId]
  );

  return { validateWithCache };
}

export function useAutoSave(formId: string, userId: string, enabled = true, interval = 30000) {
  useEffect(() => {
    if (!enabled) return;

    const cleanup = smartFormCache.enableAutoSave(formId, userId, interval);
    return cleanup;
  }, [formId, userId, enabled, interval]);
}

// Initialize smart form cache
if (typeof window !== 'undefined') {
  // Cleanup periodically
  setInterval(() => {
    smartFormCache.cleanup();
  }, 300000); // Every 5 minutes

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    smartFormCache.cleanup();
  });
}

export default smartFormCache;
