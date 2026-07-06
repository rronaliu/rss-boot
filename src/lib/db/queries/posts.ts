import { desc, eq } from "drizzle-orm";
import { db } from "..";
import { feedFollows, posts } from "../schema";

export async function createPost(
  title: string,
  url: string,
  description: string | null,
  publishedAt: Date | null,
  feedId: string,
) {
  const [result] = await db
    .insert(posts)
    .values({ title, url, description, publishedAt, feedId })
    .onConflictDoNothing()
    .returning();

  return result;
}

export async function getPostsForUser(userId: string, limit: number) {
  return await db
    .select()
    .from(posts)
    .innerJoin(feedFollows, eq(posts.feedId, feedFollows.feedId))
    .where(eq(feedFollows.userId, userId))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}