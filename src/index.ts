import {
  CommandsRegistry,
  handlerLogin,
  registerCommand,
  runCommand,
  handlerRegister,
  handlerResetUsers,
  handlerListUsers,
  handlerAgg,
  handlerAddFeed,
  handlerFeeds,
  handlerFollow,
  handlerFollowing,
  middlewareLoggedIn,
  handlerUnfollow,
  handlerBrowse,
} from "./config.js";

async function main() {
  const registry: CommandsRegistry = {};

  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "reset", handlerResetUsers);
  registerCommand(registry, "users", handlerListUsers);
  registerCommand(registry, "agg", handlerAgg);
  registerCommand(registry, "feeds", handlerFeeds);
  registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(registry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));
registerCommand(registry, "browse", middlewareLoggedIn(handlerBrowse));

  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Not enough arguments provided");
    process.exit(1);
  }

  const [cmdName, ...cmdArgs] = args;

  try {
    await runCommand(registry, cmdName, ...cmdArgs);
    process.exit(0);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

main();