export const flags = {
  onboarding_v2_enabled: process.env.ONBOARDING_V2_ENABLED === 'true',
  invite_intents_enabled: process.env.INVITE_INTENTS_ENABLED === 'true',
  scheduler_enabled: process.env.SCHEDULER_ENABLED === 'true',
  staff_gate_enabled: process.env.STAFF_GATE_ENABLED === 'true',
  capper_gate_enabled: process.env.CAPPER_GATE_ENABLED === 'true',
};

