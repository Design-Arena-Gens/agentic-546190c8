"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCompactNumber, formatDuration, formatRelativeTime } from "@/lib/formatters";
import type { InteractionAction, InteractionPlan, QueueItem, TikTokVideo } from "@/types/tiktok";

const DEFAULT_KEYWORD = "القهوة";
const DEFAULT_COMMENT = "قهوتك اليوم؟ شاركهم تجربتك وادعُهم لزيارة حسابك لمزيد من الوصفات.";

type FetchState = "idle" | "loading" | "error";

const ACTION_LABELS: Record<InteractionAction, string> = {
  like: "إعجاب",
  comment: "تعليق",
  follow: "متابعة",
  repost: "إعادة نشر",
};

function createDefaultPlan(video: TikTokVideo): QueueItem {
  const interactions: InteractionPlan[] = [
    { action: "like", enabled: true },
    {
      action: "comment",
      enabled: true,
      details: DEFAULT_COMMENT,
    },
    {
      action: "repost",
      enabled: true,
      details: "أعد نشر المقطع مع تعليق صوتي أو ترجمة عربية تشد عشاق القهوة.",
    },
    {
      action: "follow",
      enabled: false,
      details: "تابع الحساب إذا تكرر محتواه المميز حول القهوة.",
    },
  ];

  return {
    ...video,
    interactions,
    caption: `☕️ ${video.title.trim()}\n\nتابعوني لمزيد من أفكار ومراجعات القهوة يوميًا.`,
    notes: "",
    scheduledFor: "",
  };
}

export default function HomeDashboard() {
  const [keywordInput, setKeywordInput] = useState(DEFAULT_KEYWORD);
  const [activeKeyword, setActiveKeyword] = useState(DEFAULT_KEYWORD);
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem("tiktok-queue");
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored) as QueueItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("tiktok-queue", JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    void searchVideos(DEFAULT_KEYWORD, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchVideos(keyword: string, isNewSearch: boolean) {
    if (!keyword.trim()) {
      return;
    }

    setFetchState("loading");
    setErrorMessage(null);

    const params = new URLSearchParams({
      keywords: keyword,
      count: "18",
    });
    if (!isNewSearch && cursor) {
      params.set("cursor", cursor);
    }

    try {
      const response = await fetch(`/api/tiktok/search?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("تعذر الوصول إلى نتائج تيك توك.");
      }

      const data = await response.json();
      const newVideos: TikTokVideo[] = data.videos ?? [];

      setVideos((prev) => (isNewSearch ? newVideos : [...prev, ...newVideos]));
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
      setFetchState("idle");
      setActiveKeyword(keyword);
    } catch (error) {
      console.error(error);
      setFetchState("error");
      setErrorMessage("حدث خطأ أثناء جلب المقاطع. جرّب مرة أخرى لاحقًا.");
    }
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursor(null);
    void searchVideos(keywordInput, true);
  }

  function refreshKeyword(keyword: string) {
    setKeywordInput(keyword);
    setCursor(null);
    void searchVideos(keyword, true);
  }

  function fetchMore() {
    if (!hasMore) return;
    void searchVideos(activeKeyword, false);
  }

  function addToQueue(video: TikTokVideo) {
    setQueue((prev) => {
      if (prev.some((item) => item.id === video.id)) {
        return prev;
      }
      return [createDefaultPlan(video), ...prev];
    });
  }

  function removeFromQueue(videoId: string) {
    setQueue((prev) => prev.filter((item) => item.id !== videoId));
  }

  function updateQueueItem(videoId: string, updates: Partial<QueueItem>) {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === videoId
          ? {
              ...item,
              ...updates,
            }
          : item,
      ),
    );
  }

  function toggleInteraction(videoId: string, action: InteractionAction) {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === videoId
          ? {
              ...item,
              interactions: item.interactions.map((interaction) =>
                interaction.action === action
                  ? { ...interaction, enabled: !interaction.enabled }
                  : interaction,
              ),
            }
          : item,
      ),
    );
  }

  function updateInteractionDetails(
    videoId: string,
    action: InteractionAction,
    details: string,
  ) {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === videoId
          ? {
              ...item,
              interactions: item.interactions.map((interaction) =>
                interaction.action === action
                  ? { ...interaction, details }
                  : interaction,
              ),
            }
          : item,
      ),
    );
  }

  function suggestCaption(video: QueueItem) {
    const base = [
      "☕️ لمحبي القهوة المميزة!",
      `يلهمني هذا المقطع من @${video.author.handle || video.author.displayName
        } لإعداد وصفة جديدة.`,
      "ما رأيكم أن نجربها مع تعديل بسيط ونشارك النتيجة؟",
      "تابعني لجولات قادمة في عالم المقاهي والمشروبات.",
    ];
    return base.join(" ");
  }

  const activeQueue = useMemo(
    () => queue.sort((a, b) => (a.scheduledFor || "").localeCompare(b.scheduledFor || "")),
    [queue],
  );

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <header className="border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">مراقب مجتمع القهوة في تيك توك</h1>
            <p className="mt-1 text-sm text-zinc-400">
              استكشف المقاطع الرائجة، جهّز خطة التفاعل، ونظم عمليات إعادة النشر من مكان واحد.
            </p>
          </div>
          <div className="flex gap-3 text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => refreshKeyword("القهوة")}
              className="rounded-full border border-white/10 px-3 py-1 transition hover:border-white/30 hover:text-white"
            >
              #القهوة
            </button>
            <button
              type="button"
              onClick={() => refreshKeyword("قهوة مختصة")}
              className="rounded-full border border-white/10 px-3 py-1 transition hover:border-white/30 hover:text-white"
            >
              #قهوة_مختصة
            </button>
            <button
              type="button"
              onClick={() => refreshKeyword("coffee tiktok")}
              className="rounded-full border border-white/10 px-3 py-1 transition hover:border-white/30 hover:text-white"
            >
              #coffee
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section>
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-950/40 p-4 shadow-lg shadow-black/20 sm:flex-row"
          >
            <input
              type="text"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="البحث عن كلمات مفتاحية أو هاشتاق (مثل: روتين القهوة)"
              className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              بحث
            </button>
            {hasMore && (
              <button
                type="button"
                onClick={fetchMore}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-400/40 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                مزيد من النتائج
              </button>
            )}
          </form>

          {fetchState === "error" && errorMessage && (
            <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <article
                key={video.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 transition hover:border-emerald-400/40 hover:shadow-2xl hover:shadow-emerald-500/10"
              >
                <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
                  <video
                    controls
                    poster={video.coverUrl}
                    className="h-full w-full object-cover"
                    src={video.playUrl}
                  />
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                    {formatDuration(video.duration)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div>
                    <h2 className="line-clamp-2 text-sm font-semibold text-white">
                      {video.title || "بدون عنوان"}
                    </h2>
                    <p className="mt-2 text-xs text-zinc-400">
                      @{video.author.handle || video.author.displayName} ·{" "}
                      {formatRelativeTime(video.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-300">
                    <span>👁 {formatCompactNumber(video.stats.plays, "ar")}</span>
                    <span>❤️ {formatCompactNumber(video.stats.likes, "ar")}</span>
                    <span>💬 {formatCompactNumber(video.stats.comments, "ar")}</span>
                    <span>🔁 {formatCompactNumber(video.stats.shares, "ar")}</span>
                    {video.music.title && (
                      <span className="flex items-center gap-1 text-emerald-200">
                        ♫ {video.music.title}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => addToQueue(video)}
                    className="mt-auto inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    أضف إلى خطة التفاعل
                  </button>
                </div>
              </article>
            ))}
          </div>

          {fetchState === "loading" && (
            <div className="mt-8 grid animate-pulse grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-80 rounded-2xl border border-white/5 bg-white/5"
                />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 shadow-xl shadow-black/30">
            <h2 className="text-lg font-semibold text-white">قائمة إعادة النشر</h2>
            <p className="mt-1 text-xs text-zinc-400">
              خطط لمحتوى إعادة النشر وحدد التفاعل المطلوب مع كل مقطع.
            </p>
            {activeQueue.length === 0 && (
              <div className="mt-6 rounded-lg border border-dashed border-white/10 bg-black/30 p-6 text-sm text-zinc-400">
                أضف مقطعًا من القائمة اليسرى لإنشاء خطة تفاعل سريعة.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {activeQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-lg shadow-emerald-500/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {item.title || "مقطع بدون عنوان"}
                    </h3>
                    <p className="mt-1 text-xs text-emerald-200">
                      @{item.author.handle || item.author.displayName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(item.id)}
                    className="text-xs text-emerald-200/80 transition hover:text-red-300"
                  >
                    إزالة
                  </button>
                </div>

                <div className="mt-3 space-y-3 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-emerald-100">موعد إعادة النشر</span>
                    <input
                      type="datetime-local"
                      value={item.scheduledFor ?? ""}
                      onChange={(event) =>
                        updateQueueItem(item.id, { scheduledFor: event.target.value })
                      }
                      className="rounded-lg border border-emerald-500/30 bg-black/30 px-3 py-2 text-emerald-50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-emerald-100">وصف مخصص لإعادة النشر</span>
                    <textarea
                      value={item.caption ?? ""}
                      onChange={(event) =>
                        updateQueueItem(item.id, { caption: event.target.value })
                      }
                      rows={3}
                      className="rounded-lg border border-emerald-500/30 bg-black/30 px-3 py-2 text-emerald-50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateQueueItem(item.id, { caption: suggestCaption(item) })
                    }
                    className="w-full rounded-lg border border-emerald-400/40 px-3 py-2 text-emerald-100 transition hover:border-emerald-300 hover:text-white"
                  >
                    اقتراح وصف عربي
                  </button>

                  <label className="flex flex-col gap-1">
                    <span className="text-emerald-100">ملاحظات إضافية</span>
                    <textarea
                      value={item.notes ?? ""}
                      onChange={(event) =>
                        updateQueueItem(item.id, { notes: event.target.value })
                      }
                      rows={2}
                      className="rounded-lg border border-emerald-500/30 bg-black/30 px-3 py-2 text-emerald-50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </label>
                </div>

                <div className="mt-4 space-y-2 rounded-xl border border-emerald-500/20 bg-black/20 p-3 text-xs">
                  <p className="text-emerald-100">خطة التفاعل</p>
                  {item.interactions.map((interaction) => (
                    <div
                      key={interaction.action}
                      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-2"
                    >
                      <label className="flex items-center justify-between gap-2 text-white">
                        <span>{ACTION_LABELS[interaction.action]}</span>
                        <input
                          type="checkbox"
                          checked={interaction.enabled}
                          onChange={() => toggleInteraction(item.id, interaction.action)}
                          className="h-4 w-4 accent-emerald-400"
                        />
                      </label>
                      <textarea
                        value={interaction.details ?? ""}
                        onChange={(event) =>
                          updateInteractionDetails(
                            item.id,
                            interaction.action,
                            event.target.value,
                          )
                        }
                        rows={interaction.action === "comment" ? 3 : 2}
                        className="rounded-lg border border-emerald-500/30 bg-black/30 px-2 py-1 text-emerald-50 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
                        disabled={!interaction.enabled}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
