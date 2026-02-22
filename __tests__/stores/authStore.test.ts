import { useAuthStore } from '@/stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isOnboarded: false,
    });
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.isOnboarded).toBe(false);
  });

  it('setUser updates user', () => {
    const mockUser = { uid: 'test-uid', displayName: 'Test' } as any;
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toBe(mockUser);
  });

  it('setUser can set null', () => {
    const mockUser = { uid: 'test-uid' } as any;
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('setOnboarded updates isOnboarded', () => {
    useAuthStore.getState().setOnboarded(true);
    expect(useAuthStore.getState().isOnboarded).toBe(true);
  });
});
