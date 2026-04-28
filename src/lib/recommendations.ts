import { Video } from '../types';

export interface UserInterests {
  categories: Record<string, number>;
  tags: Record<string, number>;
}

export function getStoredInterests(): UserInterests {
  try {
    const stored = localStorage.getItem('moon_interests_full');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse interests', e);
  }
  return { categories: {}, tags: {} };
}

export function trackInterest(category: string, tags: string[] = []) {
  const interests = getStoredInterests();
  
  // Track Category
  interests.categories[category] = (interests.categories[category] || 0) + 1;
  
  // Track Tags
  tags.forEach(tag => {
    const lowTag = tag.toLowerCase().trim();
    if (lowTag) {
      interests.tags[lowTag] = (interests.tags[lowTag] || 0) + 1;
    }
  });

  localStorage.setItem('moon_interests_full', JSON.stringify(interests));
}

export function scoreVideo(video: Video, interests: UserInterests): number {
  let score = 0;

  // Category match (highest weight)
  const catCount = interests.categories[video.category] || 0;
  score += catCount * 10;

  // Tag matches
  if (video.tags) {
    video.tags.forEach(tag => {
      const lowTag = tag.toLowerCase().trim();
      const tagCount = interests.tags[lowTag] || 0;
      score += tagCount * 5;
    });
  }

  // Title match with interests
  const titleWords = video.title.toLowerCase().split(/\s+/);
  Object.keys(interests.tags).forEach(tag => {
    if (titleWords.includes(tag)) {
      score += (interests.tags[tag] || 0) * 2;
    }
  });

  // Add a small amount of randomness to keep it fresh
  score += Math.random() * 5;

  return score;
}

export function getRecommendedVideos(pool: Video[], limit: number = 20): Video[] {
  const interests = getStoredInterests();
  
  // Score all videos
  const scored = pool.map(video => ({
    video,
    score: scoreVideo(video, interests)
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top pool (more than we need to allow for shuffling)
  const topPool = scored.slice(0, limit * 2);

  // Shuffle the top pool to ensure variety on each visit
  for (let i = topPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [topPool[i], topPool[j]] = [topPool[j], topPool[i]];
  }

  return topPool.slice(0, limit).map(item => item.video);
}
