export default class Anthropic {
  constructor(_: any) {}
  messages = {
    create: async (_: any) => ({
      id: 'mock-anthropic',
      content: [{ text: 'mocked anthropic response' }],
    }),
  };
}

