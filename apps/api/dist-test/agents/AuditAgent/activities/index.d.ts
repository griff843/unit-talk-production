/**
 * Audit parameters interface
 */
export interface AuditParams {
    auditType: 'compliance' | 'security' | 'performance' | 'data';
    scope: string[];
    startDate?: Date;
    endDate?: Date;
    severity?: 'low' | 'medium' | 'high' | 'critical';
}
/**
 * Temporal activity for performing audits
 */
export declare function performAudit(_params: AuditParams): Promise<void>;
/**
 * Temporal activity for generating audit reports
 */
export declare function generateReport(_params: AuditParams): Promise<void>;
/**
 * Temporal activity for compliance checks
 */
export declare function checkCompliance(_params: AuditParams): Promise<void>;
/**
 * Temporal activity for security audits
 */
export declare function performSecurityAudit(_params: AuditParams): Promise<void>;
//# sourceMappingURL=index.d.ts.map