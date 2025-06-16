
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export interface Validator {
  rules: ValidationRule[];
  validate(data: any): ValidationResult;
}
