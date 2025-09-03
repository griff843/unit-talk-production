export default class OpenAI {
  constructor(_: any) {}
  chat = {
    completions: {
      create: async (_: any) => ({
        id: 'mock-completion',
        choices: [{ message: { content: 'mocked response' } }],
      }),
    },
  };
}

