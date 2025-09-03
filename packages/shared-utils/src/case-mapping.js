"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCamelKeys = toCamelKeys;
exports.toSnakeKeys = toSnakeKeys;
function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}
function toCamel(str) {
    return str.replace(/[_-](\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}
function toSnake(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .replace(/[-\s]+/g, '_')
        .toLowerCase()
        .replace(/^_+/, '');
}
function toCamelKeys(input) {
    if (Array.isArray(input))
        return input.map((v) => toCamelKeys(v));
    if (input instanceof Date)
        return input;
    if (!input || typeof input !== 'object' || !isPlainObject(input))
        return input;
    const out = {};
    for (const [k, v] of Object.entries(input)) {
        const key = toCamel(k);
        out[key] = toCamelKeys(v);
    }
    return out;
}
function toSnakeKeys(input) {
    if (Array.isArray(input))
        return input.map((v) => toSnakeKeys(v));
    if (input instanceof Date)
        return input;
    if (!input || typeof input !== 'object' || !isPlainObject(input))
        return input;
    const out = {};
    for (const [k, v] of Object.entries(input)) {
        const key = toSnake(k);
        out[key] = toSnakeKeys(v);
    }
    return out;
}
