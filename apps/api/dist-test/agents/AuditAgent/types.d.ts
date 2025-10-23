import * as z from 'zod';
export declare const AuditIncidentSchema: z.ZodObject<{
    id: z.ZodString;
    table: z.ZodString;
    tableName: z.ZodOptional<z.ZodString>;
    row_id: z.ZodOptional<z.ZodString>;
    severity: z.ZodEnum<["low", "medium", "high", "critical", "warning"]>;
    description: z.ZodString;
    timestamp: z.ZodDate;
    detectedAt: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timestamp: Date;
    id: string;
    severity: "warning" | "critical" | "low" | "medium" | "high";
    table: string;
    description: string;
    type?: string | undefined;
    tableName?: string | undefined;
    row_id?: string | undefined;
    detectedAt?: string | undefined;
}, {
    timestamp: Date;
    id: string;
    severity: "warning" | "critical" | "low" | "medium" | "high";
    table: string;
    description: string;
    type?: string | undefined;
    tableName?: string | undefined;
    row_id?: string | undefined;
    detectedAt?: string | undefined;
}>;
export type AuditIncident = z.infer<typeof AuditIncidentSchema>;
//# sourceMappingURL=types.d.ts.map