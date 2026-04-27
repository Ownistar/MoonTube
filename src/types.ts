export const CATEGORIES = [
  'All',
  'Gaming',
  'Music',
  'Education',
  'Technology',
  'Entertainment',
  'Lifestyle',
  'Vlogs',
  'News'
];

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  totalViews: number;
  subscriberCount: number;
  earningsBalance: number;
  paypalEmail: string;
  mppJoinedAt: string;
}

export interface Video {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  youtubeUrl: string;
  youtubeId: string;
  views: number;
  likes?: number;
  dislikes?: number;
  createdAt: string;
  thumbnail: string;
  ownerName?: string;
  ownerPhoto?: string;
  isShort?: boolean;
  commentCount?: number;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  paypalEmail: string;
  createdAt: string;
}
