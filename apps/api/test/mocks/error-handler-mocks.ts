export interface ErrorHandlerMock {
  handleError: jest.Mock;
  reportError: jest.Mock;
  shouldRetry: jest.Mock;
  getRetryDelay: jest.Mock;
}

export const createErrorHandlerMock = (): ErrorHandlerMock => ({
  handleError: jest.fn(),
  reportError: jest.fn(),
  shouldRetry: jest.fn().mockReturnValue(false),
  getRetryDelay: jest.fn().mockReturnValue(1000)
});