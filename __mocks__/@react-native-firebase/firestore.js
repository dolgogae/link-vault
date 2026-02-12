const collection = jest.fn(() => ({
  doc: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(),
      add: jest.fn(),
      onSnapshot: jest.fn(),
    })),
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(),
}));

const firestore = jest.fn(() => ({
  collection,
  batch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(),
  })),
}));

firestore.FieldValue = {
  serverTimestamp: jest.fn(),
  increment: jest.fn((n: number) => n),
};

export default firestore;
