import { create } from 'zustand';
import { PLAN_LIMITS } from '@/constants/subscription';

interface SubscriptionState {
  plan: 'free' | 'premium';
  monthlyLinksSaved: number;
  currentPeriod: string;
  isLoading: boolean;

  setPlan: (plan: 'free' | 'premium') => void;
  setUsage: (period: string, linksSaved: number) => void;
  setLoading: (loading: boolean) => void;
  isPremium: () => boolean;
  getMonthlyRemaining: () => number;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plan: 'free',
  monthlyLinksSaved: 0,
  currentPeriod: '',
  isLoading: true,

  setPlan: (plan) => set({ plan }),
  setUsage: (period, linksSaved) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    set({
      currentPeriod: period,
      monthlyLinksSaved: period === currentMonth ? linksSaved : 0,
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
  isPremium: () => get().plan === 'premium',
  getMonthlyRemaining: () => {
    const { plan, monthlyLinksSaved } = get();
    if (plan === 'premium') return Infinity;
    return Math.max(0, PLAN_LIMITS.free.monthlyLinks - monthlyLinksSaved);
  },
}));
