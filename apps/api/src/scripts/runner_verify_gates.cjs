require('dotenv').config({ path: require('path').resolve('/workspace/.env') });
require('ts-node/register/transpile-only');
require('./verify-gates.ts');

