"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotionAlert = sendNotionAlert;
async function sendNotionAlert(_alert, _advice) {
    // Use Notion API or n8n to push alert as a new page/entry
    // Log the advice in a Unit Talk Advice field
    // Example code will depend on your integration, but core logic:
    // - Add row to Notion DB with all alert fields + advice
    return { status: 'sent' };
}
