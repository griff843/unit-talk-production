import { AlertPayload } from '../../../types/alert';
/**
 * Sends an alert with advice to Retool via webhook or API.
 * The Retool dashboard should be set up to receive these for live ops display.
 */
export declare function sendRetoolAlert(alert: AlertPayload, advice: string): Promise<{
    status: string;
    response: any;
}>;
//# sourceMappingURL=retool.d.ts.map