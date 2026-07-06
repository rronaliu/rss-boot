import { db } from "..";
import { feeds, users } from "../schema";
import { eq, asc, sql } from "drizzle-orm";

export async function createFeed(name: string, url: string, userId: string) {
  const [result] = await db
    .insert(feeds)
    .values({ name, url, userId })
    .returning();

  return result;
}

export async function getFeeds() {
  return await db
    .select({
      feedName: feeds.name,
      feedUrl: feeds.url,
      userName: users.name,
    })
    .from(feeds)
    .innerJoin(users, eq(feeds.userId, users.id));
}

export async function getFeedByUrl(url: string) {
  const [result] = await db.select().from(feeds).where(eq(feeds.url, url)).limit(1);
  return result;
}

export async function markFeedFetched(feedId: string) {
  const [result] = await db
    .update(feeds)
    .set({ lastFetchedAt: new Date(),
        updatedAt: new Date() })
    .where(eq(feeds.id, feedId))
    .returning();

  return result;
}

export async function getNextFeedToFetch() {
    const [result] = await db
        .select()
        .from(feeds)
        .orderBy(sql`${feeds.lastFetchedAt} NULLS FIRST`, asc(feeds.lastFetchedAt))
        .limit(1);
    return result;
}