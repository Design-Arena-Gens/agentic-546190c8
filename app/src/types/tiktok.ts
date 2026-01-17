export interface TikTokVideo {
  id: string;
  title: string;
  region: string;
  coverUrl: string;
  playUrl: string;
  duration: number;
  stats: {
    plays: number;
    likes: number;
    comments: number;
    shares: number;
  };
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatar: string;
  };
  music: {
    title: string;
    artist: string;
  };
  createdAt: number;
}

export type InteractionAction = "like" | "comment" | "follow" | "repost";

export interface InteractionPlan {
  action: InteractionAction;
  enabled: boolean;
  details?: string;
}

export interface QueueItem extends TikTokVideo {
  scheduledFor?: string;
  caption?: string;
  notes?: string;
  interactions: InteractionPlan[];
}
