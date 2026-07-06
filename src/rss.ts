import { XMLParser } from "fast-xml-parser";

export type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
    item: RSSItem[];
  };
};

export type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const response = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`);
  }

  const xml = await response.text();

  const parser = new XMLParser({
    processEntities: false,
  });

  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;

  if (!channel) {
    throw new Error("Invalid RSS feed: missing channel");
  }

  if (
    !isValidString(channel.title) ||
    !isValidString(channel.link) ||
    !isValidString(channel.description)
  ) {
    throw new Error("Invalid RSS feed: missing channel metadata");
  }

  let rawItems: unknown[] = [];

  if (channel.item) {
    rawItems = Array.isArray(channel.item) ? channel.item : [channel.item];
  }

  const items: RSSItem[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const rawItem = item as Record<string, unknown>;

    if (
      !isValidString(rawItem.title) ||
      !isValidString(rawItem.link) ||
      !isValidString(rawItem.description) ||
      !isValidString(rawItem.pubDate)
    ) {
      continue;
    }

    items.push({
      title: rawItem.title,
      link: rawItem.link,
      description: rawItem.description,
      pubDate: rawItem.pubDate,
    });
  }

  return {
    channel: {
      title: channel.title,
      link: channel.link,
      description: channel.description,
      item: items,
    },
  };
}