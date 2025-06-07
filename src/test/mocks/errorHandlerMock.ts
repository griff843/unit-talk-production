export const errorHandlerMock = {
  handleError: jest.fn(),
  withRetry: jest.fn((fn: any) => fn())
}; 