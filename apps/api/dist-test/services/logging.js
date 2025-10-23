"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logAgentEvent = logAgentEvent;
exports.logAgentError = logAgentError;
const pino_1 = __importDefault(require("pino"));
const isDev = process.env['NODE_ENV'] !== 'production';
exports.logger = isDev
    ? (0, pino_1.default)({
        transport: {
            target: 'pino-pretty',
            options: { colorize: true }
        }
    })
    : (0, pino_1.default)();
function logAgentEvent(agent, msg, meta) {
    exports.logger.info({ agent, ...meta }, msg);
}
function logAgentError(agent, err, meta) {
    exports.logger.error({ agent, error: err, ...meta }, 'Agent error');
}
