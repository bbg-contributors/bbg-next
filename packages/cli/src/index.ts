#!/usr/bin/env node
import {
  Cli,
  completionsPlugin,
  friendlyErrorPlugin,
  notFoundPlugin,
  strictFlagsPlugin,
  updateNotifierPlugin,
} from 'clerc'
import pkg from '../package.json' with { type: 'json' }
import { init } from './commands/init.ts'
import { preview } from './commands/preview.ts'
import { sync } from './commands/sync.ts'
import { theme, themeUse } from './commands/theme.ts'

// clerc routes rejections to its own error handler.
void Cli()
  .scriptName('bbg-next')
  .description('A static blog generator')
  .version(pkg.version)
  .use(friendlyErrorPlugin())
  .use(notFoundPlugin())
  .use(strictFlagsPlugin())
  .use(completionsPlugin())
  .use(updateNotifierPlugin({ pkg }))
  .command([init, sync, preview, theme, themeUse])
  .parse()
