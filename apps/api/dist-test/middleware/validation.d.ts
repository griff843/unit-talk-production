import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
declare global {
    namespace Express {
        interface Request {
            validatedData?: unknown;
            user?: {
                id: string;
                tier: string;
                permissions: string[];
            };
        }
    }
}
export declare const commonSchemas: {
    id: z.ZodString;
    discordId: z.ZodString;
    email: z.ZodString;
    url: z.ZodString;
    dateString: z.ZodString;
    positiveNumber: z.ZodNumber;
    nonEmptyString: z.ZodString;
    tier: z.ZodEnum<["member", "trial", "vip", "vip_plus", "capper", "staff", "admin", "owner"]>;
    sport: z.ZodEnum<["NBA", "NFL", "MLB", "NHL", "NCAAB", "NCAAF"]>;
    pickType: z.ZodEnum<["spread", "moneyline", "total", "prop"]>;
    betResult: z.ZodEnum<["win", "loss", "push", "pending"]>;
};
export declare const pickSubmissionSchema: z.ZodObject<{
    body: z.ZodObject<{
        sport: z.ZodEnum<["NBA", "NFL", "MLB", "NHL", "NCAAB", "NCAAF"]>;
        league: z.ZodString;
        game: z.ZodString;
        pick_type: z.ZodEnum<["spread", "moneyline", "total", "prop"]>;
        selection: z.ZodString;
        odds: z.ZodOptional<z.ZodString>;
        units: z.ZodOptional<z.ZodNumber>;
        confidence: z.ZodOptional<z.ZodNumber>;
        reasoning: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
        pick_type: "prop" | "moneyline" | "spread" | "total";
        league: string;
        game: string;
        selection: string;
        confidence?: number | undefined;
        odds?: string | undefined;
        units?: number | undefined;
        reasoning?: string | undefined;
    }, {
        sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
        pick_type: "prop" | "moneyline" | "spread" | "total";
        league: string;
        game: string;
        selection: string;
        confidence?: number | undefined;
        odds?: string | undefined;
        units?: number | undefined;
        reasoning?: string | undefined;
    }>;
    params: z.ZodOptional<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        userId?: string | undefined;
    }, {
        userId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    body: {
        sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
        pick_type: "prop" | "moneyline" | "spread" | "total";
        league: string;
        game: string;
        selection: string;
        confidence?: number | undefined;
        odds?: string | undefined;
        units?: number | undefined;
        reasoning?: string | undefined;
    };
    params?: {
        userId?: string | undefined;
    } | undefined;
}, {
    body: {
        sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
        pick_type: "prop" | "moneyline" | "spread" | "total";
        league: string;
        game: string;
        selection: string;
        confidence?: number | undefined;
        odds?: string | undefined;
        units?: number | undefined;
        reasoning?: string | undefined;
    };
    params?: {
        userId?: string | undefined;
    } | undefined;
}>;
export declare const userProfileSchema: z.ZodObject<{
    body: z.ZodObject<{
        username: z.ZodString;
        tier: z.ZodOptional<z.ZodEnum<["member", "trial", "vip", "vip_plus", "capper", "staff", "admin", "owner"]>>;
        settings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        username: string;
        metadata?: Record<string, any> | undefined;
        tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
        settings?: Record<string, any> | undefined;
    }, {
        username: string;
        metadata?: Record<string, any> | undefined;
        tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
        settings?: Record<string, any> | undefined;
    }>;
    params: z.ZodObject<{
        discordId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        discordId: string;
    }, {
        discordId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        discordId: string;
    };
    body: {
        username: string;
        metadata?: Record<string, any> | undefined;
        tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
        settings?: Record<string, any> | undefined;
    };
}, {
    params: {
        discordId: string;
    };
    body: {
        username: string;
        metadata?: Record<string, any> | undefined;
        tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
        settings?: Record<string, any> | undefined;
    };
}>;
export declare const gradingSchema: z.ZodObject<{
    body: z.ZodObject<{
        result: z.ZodEnum<["win", "loss", "push", "pending"]>;
        actual_value: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        result: "push" | "win" | "loss" | "pending";
        actual_value?: number | undefined;
        notes?: string | undefined;
    }, {
        result: "push" | "win" | "loss" | "pending";
        actual_value?: number | undefined;
        notes?: string | undefined;
    }>;
    params: z.ZodObject<{
        pickId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pickId: string;
    }, {
        pickId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        pickId: string;
    };
    body: {
        result: "push" | "win" | "loss" | "pending";
        actual_value?: number | undefined;
        notes?: string | undefined;
    };
}, {
    params: {
        pickId: string;
    };
    body: {
        result: "push" | "win" | "loss" | "pending";
        actual_value?: number | undefined;
        notes?: string | undefined;
    };
}>;
export declare const querySchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
        limit: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
        sort: z.ZodOptional<z.ZodString>;
        filter: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        sort?: string | undefined;
        filter?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        limit?: number | undefined;
        page?: number | undefined;
    }, {
        sort?: string | undefined;
        filter?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        sort?: string | undefined;
        filter?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        limit?: number | undefined;
        page?: number | undefined;
    };
}, {
    query: {
        sort?: string | undefined;
        filter?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        limit?: string | undefined;
        page?: string | undefined;
    };
}>;
export declare const sanitizeInput: (input: unknown) => unknown;
export declare const validateRequest: (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const sqlInjectionProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const xssProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const fileUploadValidation: (options: {
    maxSize?: number;
    allowedTypes?: string[];
    maxFiles?: number;
}) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
declare const _default: {
    validateRequest: (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    sanitizeInput: (input: unknown) => unknown;
    sqlInjectionProtection: (req: Request, res: Response, next: NextFunction) => void;
    xssProtection: (req: Request, res: Response, next: NextFunction) => void;
    fileUploadValidation: (options: {
        maxSize?: number;
        allowedTypes?: string[];
        maxFiles?: number;
    }) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
    commonSchemas: {
        id: z.ZodString;
        discordId: z.ZodString;
        email: z.ZodString;
        url: z.ZodString;
        dateString: z.ZodString;
        positiveNumber: z.ZodNumber;
        nonEmptyString: z.ZodString;
        tier: z.ZodEnum<["member", "trial", "vip", "vip_plus", "capper", "staff", "admin", "owner"]>;
        sport: z.ZodEnum<["NBA", "NFL", "MLB", "NHL", "NCAAB", "NCAAF"]>;
        pickType: z.ZodEnum<["spread", "moneyline", "total", "prop"]>;
        betResult: z.ZodEnum<["win", "loss", "push", "pending"]>;
    };
    pickSubmissionSchema: z.ZodObject<{
        body: z.ZodObject<{
            sport: z.ZodEnum<["NBA", "NFL", "MLB", "NHL", "NCAAB", "NCAAF"]>;
            league: z.ZodString;
            game: z.ZodString;
            pick_type: z.ZodEnum<["spread", "moneyline", "total", "prop"]>;
            selection: z.ZodString;
            odds: z.ZodOptional<z.ZodString>;
            units: z.ZodOptional<z.ZodNumber>;
            confidence: z.ZodOptional<z.ZodNumber>;
            reasoning: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
            pick_type: "prop" | "moneyline" | "spread" | "total";
            league: string;
            game: string;
            selection: string;
            confidence?: number | undefined;
            odds?: string | undefined;
            units?: number | undefined;
            reasoning?: string | undefined;
        }, {
            sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
            pick_type: "prop" | "moneyline" | "spread" | "total";
            league: string;
            game: string;
            selection: string;
            confidence?: number | undefined;
            odds?: string | undefined;
            units?: number | undefined;
            reasoning?: string | undefined;
        }>;
        params: z.ZodOptional<z.ZodObject<{
            userId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            userId?: string | undefined;
        }, {
            userId?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        body: {
            sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
            pick_type: "prop" | "moneyline" | "spread" | "total";
            league: string;
            game: string;
            selection: string;
            confidence?: number | undefined;
            odds?: string | undefined;
            units?: number | undefined;
            reasoning?: string | undefined;
        };
        params?: {
            userId?: string | undefined;
        } | undefined;
    }, {
        body: {
            sport: "NBA" | "MLB" | "NFL" | "NHL" | "NCAAF" | "NCAAB";
            pick_type: "prop" | "moneyline" | "spread" | "total";
            league: string;
            game: string;
            selection: string;
            confidence?: number | undefined;
            odds?: string | undefined;
            units?: number | undefined;
            reasoning?: string | undefined;
        };
        params?: {
            userId?: string | undefined;
        } | undefined;
    }>;
    userProfileSchema: z.ZodObject<{
        body: z.ZodObject<{
            username: z.ZodString;
            tier: z.ZodOptional<z.ZodEnum<["member", "trial", "vip", "vip_plus", "capper", "staff", "admin", "owner"]>>;
            settings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            username: string;
            metadata?: Record<string, any> | undefined;
            tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
            settings?: Record<string, any> | undefined;
        }, {
            username: string;
            metadata?: Record<string, any> | undefined;
            tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
            settings?: Record<string, any> | undefined;
        }>;
        params: z.ZodObject<{
            discordId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            discordId: string;
        }, {
            discordId: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        params: {
            discordId: string;
        };
        body: {
            username: string;
            metadata?: Record<string, any> | undefined;
            tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
            settings?: Record<string, any> | undefined;
        };
    }, {
        params: {
            discordId: string;
        };
        body: {
            username: string;
            metadata?: Record<string, any> | undefined;
            tier?: "capper" | "vip" | "vip_plus" | "member" | "admin" | "trial" | "staff" | "owner" | undefined;
            settings?: Record<string, any> | undefined;
        };
    }>;
    gradingSchema: z.ZodObject<{
        body: z.ZodObject<{
            result: z.ZodEnum<["win", "loss", "push", "pending"]>;
            actual_value: z.ZodOptional<z.ZodNumber>;
            notes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            result: "push" | "win" | "loss" | "pending";
            actual_value?: number | undefined;
            notes?: string | undefined;
        }, {
            result: "push" | "win" | "loss" | "pending";
            actual_value?: number | undefined;
            notes?: string | undefined;
        }>;
        params: z.ZodObject<{
            pickId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            pickId: string;
        }, {
            pickId: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        params: {
            pickId: string;
        };
        body: {
            result: "push" | "win" | "loss" | "pending";
            actual_value?: number | undefined;
            notes?: string | undefined;
        };
    }, {
        params: {
            pickId: string;
        };
        body: {
            result: "push" | "win" | "loss" | "pending";
            actual_value?: number | undefined;
            notes?: string | undefined;
        };
    }>;
    querySchema: z.ZodObject<{
        query: z.ZodObject<{
            page: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
            limit: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
            sort: z.ZodOptional<z.ZodString>;
            filter: z.ZodOptional<z.ZodString>;
            startDate: z.ZodOptional<z.ZodString>;
            endDate: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            sort?: string | undefined;
            filter?: string | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            limit?: number | undefined;
            page?: number | undefined;
        }, {
            sort?: string | undefined;
            filter?: string | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            limit?: string | undefined;
            page?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        query: {
            sort?: string | undefined;
            filter?: string | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            limit?: number | undefined;
            page?: number | undefined;
        };
    }, {
        query: {
            sort?: string | undefined;
            filter?: string | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            limit?: string | undefined;
            page?: string | undefined;
        };
    }>;
};
export default _default;
//# sourceMappingURL=validation.d.ts.map