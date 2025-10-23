export declare class EmailService {
    private transporter;
    private config;
    constructor();
    sendAlert(to: string, subject: string, html: string): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
export declare const emailService: EmailService;
//# sourceMappingURL=email.d.ts.map