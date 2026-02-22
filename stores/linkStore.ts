import { create } from 'zustand';
import { Category } from '@/types';

interface LinkStore {
  categories: Category[];
  currentCategoryId: string | null;
  categoryBreadcrumb: { id: string; name: string }[];

  isSaving: boolean;
  saveResult: { type: 'success'; categoryPath: string[] } | { type: 'error'; message: string } | null;
  saveCount: number;

  incrementSaveCount: () => void;
  setSaveResult: (result: LinkStore['saveResult']) => void;

  setCategories: (categories: Category[]) => void;
  navigateToCategory: (categoryId: string | null, name?: string) => void;
  navigateToPath: (categoryIds: string[], categoryNames: string[]) => void;
  goBackCategory: () => void;
  resetNavigation: () => void;

  setSaving: (saving: boolean) => void;
}

export const useLinkStore = create<LinkStore>((set) => ({
  categories: [],
  currentCategoryId: null,
  categoryBreadcrumb: [],

  isSaving: false,
  saveResult: null,
  saveCount: 0,

  incrementSaveCount: () => set((state) => ({ saveCount: state.saveCount + 1 })),
  setSaveResult: (saveResult) => set({ saveResult }),

  setCategories: (categories) => set({ categories }),
  navigateToCategory: (categoryId, name) =>
    set((state) => ({
      currentCategoryId: categoryId,
      categoryBreadcrumb: categoryId && name
        ? [...state.categoryBreadcrumb, { id: categoryId, name }]
        : state.categoryBreadcrumb,
    })),
  navigateToPath: (categoryIds, categoryNames) =>
    set({
      currentCategoryId: categoryIds[categoryIds.length - 1] || null,
      categoryBreadcrumb: categoryIds.map((id, i) => ({ id, name: categoryNames[i] })),
    }),
  goBackCategory: () =>
    set((state) => {
      const newBreadcrumb = state.categoryBreadcrumb.slice(0, -1);
      return {
        currentCategoryId:
          newBreadcrumb.length > 0
            ? newBreadcrumb[newBreadcrumb.length - 1].id
            : null,
        categoryBreadcrumb: newBreadcrumb,
      };
    }),
  resetNavigation: () =>
    set({ currentCategoryId: null, categoryBreadcrumb: [] }),

  setSaving: (isSaving) => set({ isSaving }),
}));
