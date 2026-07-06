# Gator

Gator is a command-line RSS feed aggregator built with TypeScript, PostgreSQL, Drizzle ORM, and Node.js.

## Requirements

- Node.js (v18+)
- PostgreSQL
- npm

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

Create and apply the database schema:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

## Configuration

Create a file named `.gatorconfig.json` in your home directory (`~/.gatorconfig.json`).

Example:

```json
{
  "db_url": "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable"
}
```

Replace the connection string with your own PostgreSQL credentials.

## Running

All commands are run through npm:

```bash
npm run start <command> [arguments]
```

## Commands

Register a new user:

```bash
npm run start register <username>
```

Log in:

```bash
npm run start login <username>
```

Add a feed:

```bash
npm run start addfeed "<feed name>" "<feed url>"
```

Follow a feed:

```bash
npm run start follow "<feed url>"
```

Unfollow a feed:

```bash
npm run start unfollow "<feed url>"
```

Show followed feeds:

```bash
npm run start following
```

List all feeds:

```bash
npm run start feeds
```

Browse recent posts:

```bash
npm run start browse
```

Browse a specific number of posts:

```bash
npm run start browse 10
```

Run the feed aggregator (polls every minute):

```bash
npm run start agg 1m
```

Reset the database:

```bash
npm run start reset
```

## Example

```bash
npm run start register lane
npm run start login lane
npm run start addfeed "Boot.dev Blog" "https://blog.boot.dev/index.xml"
npm run start agg 30s
npm run start browse
```
