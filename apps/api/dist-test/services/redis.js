"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = exports.redis = void 0;
var productionRedis_1 = require("./productionRedis");
Object.defineProperty(exports, "redis", { enumerable: true, get: function () { return productionRedis_1.productionRedis; } });
var productionRedis_2 = require("./productionRedis");
Object.defineProperty(exports, "RedisService", { enumerable: true, get: function () { return productionRedis_2.ProductionRedisService; } });
