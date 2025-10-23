export declare class SMSService {
    private client;
    private fromNumber;
    constructor();
    sendAlert(to: string, message: string): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
export declare const smsService: SMSService;
//# sourceMappingURL=sms.d.ts.map