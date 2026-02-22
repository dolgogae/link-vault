import { useLinkStore } from '@/stores/linkStore';

describe('linkStore', () => {
  beforeEach(() => {
    useLinkStore.setState({
      categories: [],
      currentCategoryId: null,
      categoryBreadcrumb: [],
      isSaving: false,
      saveCount: 0,
    });
  });

  it('has correct initial state', () => {
    const state = useLinkStore.getState();
    expect(state.categories).toEqual([]);
    expect(state.currentCategoryId).toBeNull();
    expect(state.categoryBreadcrumb).toEqual([]);
    expect(state.isSaving).toBe(false);
    expect(state.saveCount).toBe(0);
  });

  describe('navigateToCategory', () => {
    it('sets currentCategoryId and adds breadcrumb', () => {
      useLinkStore.getState().navigateToCategory('cat1', '기술');
      const state = useLinkStore.getState();
      expect(state.currentCategoryId).toBe('cat1');
      expect(state.categoryBreadcrumb).toEqual([{ id: 'cat1', name: '기술' }]);
    });

    it('stacks breadcrumbs on nested navigation', () => {
      useLinkStore.getState().navigateToCategory('cat1', '기술');
      useLinkStore.getState().navigateToCategory('cat2', '프로그래밍');
      const state = useLinkStore.getState();
      expect(state.currentCategoryId).toBe('cat2');
      expect(state.categoryBreadcrumb).toEqual([
        { id: 'cat1', name: '기술' },
        { id: 'cat2', name: '프로그래밍' },
      ]);
    });

    it('does not add breadcrumb when categoryId is null', () => {
      useLinkStore.getState().navigateToCategory(null);
      const state = useLinkStore.getState();
      expect(state.currentCategoryId).toBeNull();
      expect(state.categoryBreadcrumb).toEqual([]);
    });
  });

  describe('goBackCategory', () => {
    it('pops last breadcrumb and updates currentCategoryId', () => {
      useLinkStore.getState().navigateToCategory('cat1', '기술');
      useLinkStore.getState().navigateToCategory('cat2', '프로그래밍');
      useLinkStore.getState().goBackCategory();
      const state = useLinkStore.getState();
      expect(state.currentCategoryId).toBe('cat1');
      expect(state.categoryBreadcrumb).toEqual([{ id: 'cat1', name: '기술' }]);
    });

    it('sets currentCategoryId to null when breadcrumb is empty', () => {
      useLinkStore.getState().navigateToCategory('cat1', '기술');
      useLinkStore.getState().goBackCategory();
      const state = useLinkStore.getState();
      expect(state.currentCategoryId).toBeNull();
      expect(state.categoryBreadcrumb).toEqual([]);
    });
  });

  describe('resetNavigation', () => {
    it('clears currentCategoryId and breadcrumb', () => {
      useLinkStore.getState().navigateToCategory('cat1', '기술');
      useLinkStore.getState().navigateToCategory('cat2', '프로그래밍');
      useLinkStore.getState().resetNavigation();
      const state = useLinkStore.getState();
      expect(state.currentCategoryId).toBeNull();
      expect(state.categoryBreadcrumb).toEqual([]);
    });
  });

  describe('incrementSaveCount', () => {
    it('increments saveCount by 1', () => {
      useLinkStore.getState().incrementSaveCount();
      expect(useLinkStore.getState().saveCount).toBe(1);
    });

    it('increments multiple times', () => {
      useLinkStore.getState().incrementSaveCount();
      useLinkStore.getState().incrementSaveCount();
      useLinkStore.getState().incrementSaveCount();
      expect(useLinkStore.getState().saveCount).toBe(3);
    });
  });

  describe('setSaving', () => {
    it('updates isSaving', () => {
      useLinkStore.getState().setSaving(true);
      expect(useLinkStore.getState().isSaving).toBe(true);
      useLinkStore.getState().setSaving(false);
      expect(useLinkStore.getState().isSaving).toBe(false);
    });
  });
});
