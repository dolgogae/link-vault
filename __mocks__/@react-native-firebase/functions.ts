const functions = jest.fn(() => ({
  httpsCallable: jest.fn(() => jest.fn()),
}));

export default functions;
