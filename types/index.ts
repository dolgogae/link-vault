export interface User {
  displayName: string;
  email: string;
  provider: 'google' | 'apple' | 'email';
  createdAt: Date;
  linkCount: number;
  plan: 'free' | 'premium';
  subscription?: {
    productId: string;
    purchaseToken: string;
    expiresAt: Date;
    autoRenewing: boolean;
  };
  monthlyUsage?: {
    period: string; // "2026-03" 형식
    linksSaved: number;
  };
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  depth: number; // 0~3, 최대 4단계
  order: number;
  linkCount: number;
  icon: string; // 이모지
  createdAt: Date;
}

export interface Link {
  id: string;
  url: string;
  title: string;
  description: string;
  ogImage: string;
  favicon: string;
  domain: string;
  categoryPath: string[]; // [catId1, catId2, catId3]
  tags: string[];
  savedAt: Date;
  lastAccessedAt: Date;
  isFavorite: boolean;
}

export interface ClassificationResult {
  categoryPath: string[];
  isNew: boolean;
  tags: string[];
  icon?: string;
}

export interface LinkMetadata {
  title: string;
  description: string;
  ogImage: string;
  favicon: string;
  domain: string;
  bodyText: string; // 첫 500자
}
