import { create } from 'zustand';
import { Category } from '@/types';

interface LinkStore {
  categories: Category[];
  currentCategoryId: string | null;
  categoryBreadcrumb: { id: string; name: string }[];

  isSaving: boolean;
  saveCount: number;

  incrementSaveCount: () => void;

  setCategories: (categories: Category[]) => void;
  navigateToCategory: (categoryId: string | null, name?: string) => void;
  goBackCategory: () => void;
  resetNavigation: () => void;

  setSaving: (saving: boolean) => void;
}

export const useLinkStore = create<LinkStore>((set) => ({
  categories: [],
  currentCategoryId: null,
  categoryBreadcrumb: [],

  isSaving: false,
  saveCount: 0,

  incrementSaveCount: () => set((state) => ({ saveCount: state.saveCount + 1 })),

  setCategories: (categories) => set({ categories }),
  navigateToCategory: (categoryId, name) =>
    set((state) => ({
      currentCategoryId: categoryId,
      categoryBreadcrumb: categoryId && name
        ? [...state.categoryBreadcrumb, { id: categoryId, name }]
        : state.categoryBreadcrumb,
    })),
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
