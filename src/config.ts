import fs from "fs";
import os from "os";
import path from "path";
import { createUser, getUserByName, resetUsers, getUsers } from "./lib/db/queries/users";
import { fetchFeed } from "./rss.js";
import {
  createFeed,
  getFeedByUrl,
  getFeeds,
  getNextFeedToFetch,
  markFeedFetched,
} from "./lib/db/queries/feeds.js";
import type { Feed, User } from "./lib/db/schema.js";
import { createFeedFollow, getFeedFollowsForUser, deleteFeedFollow } from "./lib/db/queries/feed_follows.js";
import type { User } from "./lib/db/schema.js";
import { createPost, getPostsForUser } from "./lib/db/queries/posts.js";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

type middlewareLoggedIn = (handler: UserCommandHandler) => CommandHandler;

export type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>;
export type CommandsRegistry = Record<string, CommandHandler>;

export function middlewareLoggedIn(handler: UserCommandHandler): CommandHandler {
  return async (cmdName: string, ...args: string[]): Promise<void> => {
    const cfg = readConfig();

    if (!cfg.currentUserName) {
      throw new Error("No current user set");
    }

    const user = await getUserByName(cfg.currentUserName);

    if (!user) {
      throw new Error(`User ${cfg.currentUserName} does not exist`);
    }

    await handler(cmdName, user, ...args);
  };
}

function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);

  if (!match) {
    throw new Error("Invalid duration. Use format like 1s, 1m, or 1h");
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      throw new Error("Invalid duration unit");
  }
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  ms %= 3_600_000;

  const minutes = Math.floor(ms / 60_000);
  ms %= 60_000;

  const seconds = Math.floor(ms / 1000);
  ms %= 1000;

  if (hours > 0) return `${hours}h${minutes}m${seconds}s`;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  if (seconds > 0) return `${seconds}s`;
  return `${ms}ms`;
}

async function scrapeFeeds(): Promise<void> {
  const feed = await getNextFeedToFetch();

  if (!feed) {
    console.log("No feeds found.");
    return;
  }

  console.log(`Fetching ${feed.name} from ${feed.url}`);

  const rssFeed = await fetchFeed(feed.url);

  await markFeedFetched(feed.id);

for (const item of rssFeed.channel.item) {
  const publishedAt = new Date(item.pubDate);

  if (Number.isNaN(publishedAt.getTime())) {
    continue;
  }

  await createPost(
    item.title,
    item.link,
    item.description,
    publishedAt,
    feed.id,
  );
}
}

export async function handlerBrowse(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  const limit = args.length > 0 ? Number(args[0]) : 2;

  if (Number.isNaN(limit) || limit < 1) {
    throw new Error("Invalid limit");
  }

  const posts = await getPostsForUser(user.id, limit);

  for (const row of posts) {
    const post = row.posts;

    console.log(`Title: ${post.title}`);
    console.log(`URL: ${post.url}`);
    console.log(`Published: ${post.publishedAt}`);
    console.log(`Description: ${post.description}`);
    console.log();
  }
}

export async function handlerUnfollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error("Missing feed URL");
  }

  const deleted = await deleteFeedFollow(user.id, args[0]);

  if (!deleted) {
    throw new Error(`Feed follow not found for URL ${args[0]}`);
  }

  console.log(`Unfollowed ${args[0]}`);
}


export async function handlerFollow(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error("Missing feed URL");
  }

  const url = args[0];

  const feed = await getFeedByUrl(url);

  if (!feed) {
    throw new Error(`Feed with URL ${url} does not exist`);
  }

  const feedFollow = await createFeedFollow(user.id, feed.id);

  console.log(`Feed ${feedFollow.feedName} followed by ${feedFollow.userName}`);
}

export async function handlerFollowing(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  const feedFollows = await getFeedFollowsForUser(user.id);

  for (const feedFollow of feedFollows) {
    console.log(`* ${feedFollow.feedName}`);
  }
}

export function printFeed(feed: Feed, user: User): void {
  console.log(`Name: ${feed.name}`);
  console.log(`URL: ${feed.url}`);
  console.log(`User: ${user.name}`);
}

export async function handlerFeeds(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const feeds = await getFeeds();

  for (const feed of feeds) {
    console.log(`Name: ${feed.feedName}`);
    console.log(`URL: ${feed.feedUrl}`);
    console.log(`User: ${feed.userName}`);
    console.log();
  }
}

export async function handlerAddFeed(
  cmdName: string,
  user: User,
  ...args: string[]
): Promise<void> {
  if (args.length < 2) {
    throw new Error("Missing feed name or URL");
  }

  const [name, url] = args;

  const feed = await createFeed(name, url, user.id);

  printFeed(feed, user);

  const feedFollow = await createFeedFollow(user.id, feed.id);

  console.log(`Feed ${feedFollow.feedName} followed by ${feedFollow.userName}`);
}

export async function handlerAgg(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error("Missing time_between_reqs argument");
  }

  const timeBetweenRequests = parseDuration(args[0]);

  console.log(`Collecting feeds every ${formatDuration(timeBetweenRequests)}`);

  await scrapeFeeds();

  const interval = setInterval(() => {
    scrapeFeeds().catch((err) => {
      console.error((err as Error).message);
    });
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("Shutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}

export async function handlerRegister(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error("Missing username argument");
  }

  const name = args[0];

  const existingUser = await getUserByName(name);

  if (existingUser) {
    throw new Error(`User with name ${name} already exists`);
  }

  const user = await createUser(name);

  setUser(name);

  console.log(`User ${name} created`);
  console.log(user);
}

export async function handlerLogin(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  if (args.length < 1) {
    throw new Error("Missing username argument");
  }

  const name = args[0];

  const existingUser = await getUserByName(name);

  if (!existingUser) {
    throw new Error(`User with name ${name} does not exist`);
  }

  setUser(name);

  console.log(`User set to ${name}`);
}

export async function handlerResetUsers(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  await resetUsers();
  console.log("Users table reset.");
}

export async function handlerListUsers(
  cmdName: string,
  ...args: string[]
): Promise<void> {
  const users = await getUsers();
  const config = readConfig();

  for (const user of users) {
    if (user.name === config.currentUserName) {
      console.log(`* ${user.name} (current)`);
    } else {
      console.log(`* ${user.name}`);
    }
  }
}

export function registerCommand(registry: CommandsRegistry, cmdName: string, handler: CommandHandler): void {
  registry[cmdName] = handler;
}

export async function runCommand(registry: CommandsRegistry, cmdName: string, ...args: string[]): Promise<void> {
  const handler = registry[cmdName];

  if (!handler) {
    throw new Error(`Unknown command: ${cmdName}`);
  }

  await handler(cmdName, ...args);
}

function getConfigFilePath(): string {
  return path.join(os.homedir(), ".gatorconfig.json");
}

function writeConfig(cfg: Config): void {
  const rawConfig = {
    db_url: cfg.dbUrl,
    current_user_name: cfg.currentUserName,
  };

  fs.writeFileSync(getConfigFilePath(), JSON.stringify(rawConfig, null, 2));
}

function validateConfig(rawConfig: any): Config {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error("Invalid config file");
  }

  if (typeof rawConfig.db_url !== "string") {
    throw new Error("Invalid or missing db_url");
  }

  return {
    dbUrl: rawConfig.db_url,
    currentUserName: rawConfig.current_user_name,
  };
}

export function readConfig(): Config {
  const configPath = getConfigFilePath();
  const fileContents = fs.readFileSync(configPath, "utf-8");
  const rawConfig = JSON.parse(fileContents);

  return validateConfig(rawConfig);
}

export function setUser(userName: string): void {
  const cfg = readConfig();

  cfg.currentUserName = userName;

  writeConfig(cfg);
}

