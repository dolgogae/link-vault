import { create } from 'zustand';
import { Link, Category } from '@/types';

interface LinkStore {
  links: Link[];
  favoriteLinks: Link[];
  searchResults: Link[];
  isLoadingLinks: boolean;

  categories: Category[];
  currentCategoryId: string | null;
  categoryBreadcrumb: { id: string; name: string }[];

  isSaving: boolean;
  saveCount: number;

  setLinks: (links: Link[]) => void;
  setFavoriteLinks: (links: Link[]) => void;
  setSearchResults: (results: Link[]) => void;
  setLoadingLinks: (loading: boolean) => void;
  incrementSaveCount: () => void;

  setCategories: (categories: Category[]) => void;
  navigateToCategory: (categoryId: string | null, name?: string) => void;
  goBackCategory: () => void;
  resetNavigation: () => void;

  setSaving: (saving: boolean) => void;
}

export const useLinkStore = create<LinkStore>((set) => ({
  links: [],
  favoriteLinks: [],
  searchResults: [],
  isLoadingLinks: false,

  categories: [],
  currentCategoryId: null,
  categoryBreadcrumb: [],

  isSaving: false,
  saveCount: 0,

  setLinks: (links) => set({ links }),
  setFavoriteLinks: (links) => set({ favoriteLinks: links }),
  setSearchResults: (results) => set({ searchResults: results }),
  setLoadingLinks: (isLoadingLinks) => set({ isLoadingLinks }),
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
