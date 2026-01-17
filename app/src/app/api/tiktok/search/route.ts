import { NextResponse } from "next/server";

const TIKWM_ENDPOINT = "https://www.tikwm.com/api/feed/search";

interface TikwmVideo {
  video_id: string;
  title: string;
  region: string;
  cover: string;
  play: string;
  duration: number;
  play_count: number;
  digg_count: number;
  comment_count: number;
  share_count: number;
  create_time: number;
  author: {
    id: string;
    unique_id: string;
    nickname: string;
    avatar: string;
  };
  music_info?: {
    title?: string;
    author?: string;
  };
}

interface TikwmResponse {
  code: number;
  msg?: string;
  data?: {
    cursor?: string | number;
    has_more?: boolean;
    videos?: TikwmVideo[];
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords");

  if (!keywords) {
    return NextResponse.json(
      { error: "keywords query parameter is required" },
      { status: 400 },
    );
  }

  const count = searchParams.get("count") ?? "12";
  const cursor = searchParams.get("cursor") ?? "0";

  const params = new URLSearchParams({
    keywords,
    count,
    cursor,
  });

  try {
    const response = await fetch(`${TIKWM_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.tikwm.com/",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to reach upstream search API" },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as TikwmResponse;

    if (payload.code !== 0 || !payload.data) {
      return NextResponse.json(
        { error: payload.msg ?? "Search API returned an error" },
        { status: 502 },
      );
    }

    const videos =
      payload.data.videos?.map((video) => ({
        id: video.video_id,
        title: video.title,
        region: video.region,
        coverUrl: video.cover,
        playUrl: video.play,
        duration: video.duration,
        stats: {
          plays: video.play_count,
          likes: video.digg_count,
          comments: video.comment_count,
          shares: video.share_count,
        },
        author: {
          id: video.author?.id ?? "",
          handle: video.author?.unique_id ?? "",
          displayName: video.author?.nickname ?? "",
          avatar: video.author?.avatar ?? "",
        },
        music: {
          title: video.music_info?.title ?? "",
          artist: video.music_info?.author ?? "",
        },
        createdAt: video.create_time * 1000,
      })) ?? [];

    return NextResponse.json({
      videos,
      hasMore: payload.data.has_more ?? false,
      nextCursor: payload.data.cursor ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch TikTok search results", error);
    return NextResponse.json(
      { error: "Unexpected error while fetching TikTok data" },
      { status: 500 },
    );
  }
}
