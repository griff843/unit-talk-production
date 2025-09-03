export const supabaseMock = {
  from: jest.fn(function () { return this; }),
  select: jest.fn(function () { return this; }),
  limit: jest.fn(function () { return this; }),
  single: jest.fn(function () { return Promise.resolve({ data: [{ id: '123' }], error: null }); }),
  insert: jest.fn(function () { return this; }),
  in: jest.fn(function () { return this; }),
  rpc: jest.fn(function () { return this; }),
}; 