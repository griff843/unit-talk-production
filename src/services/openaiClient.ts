// src/services/openaiClient.ts

import { OpenAI } from "openai";

// Load API key from .env or your secrets manager
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment variables');

export const openai = new OpenAI({ apiKey });
