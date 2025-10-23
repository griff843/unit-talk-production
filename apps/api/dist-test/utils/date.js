"use strict";
// /utils/date.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toISO = toISO;
exports.fromISO = fromISO;
function toISO(date) {
    return (date || new Date()).toISOString();
}
function fromISO(str) {
    return new Date(str);
}
