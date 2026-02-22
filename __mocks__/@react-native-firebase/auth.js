const auth = jest.fn(() => ({
  signInWithCredential: jest.fn(),
  signInWithCustomToken: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  currentUser: null,
}));

auth.GoogleAuthProvider = { credential: jest.fn() };
auth.AppleAuthProvider = { credential: jest.fn() };

export default auth;
export type FirebaseAuthTypes = {
  User: any;
};
