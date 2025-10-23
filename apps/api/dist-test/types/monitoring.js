"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemComponent = exports.AlertLevel = void 0;
var AlertLevel;
(function (AlertLevel) {
    AlertLevel["CRITICAL"] = "CRITICAL";
    AlertLevel["HIGH"] = "HIGH";
    AlertLevel["MEDIUM"] = "MEDIUM";
    AlertLevel["LOW"] = "LOW";
})(AlertLevel || (exports.AlertLevel = AlertLevel = {}));
var SystemComponent;
(function (SystemComponent) {
    SystemComponent["ML"] = "ML";
    SystemComponent["RISK"] = "RISK";
    SystemComponent["DATA"] = "DATA";
    SystemComponent["INFRASTRUCTURE"] = "INFRASTRUCTURE";
})(SystemComponent || (exports.SystemComponent = SystemComponent = {}));
