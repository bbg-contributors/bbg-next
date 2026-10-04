# Migrating from bbg

`bbg-next migrate` turns a site made by the old bbg editor into a bbg-next site in place. What it carries over, and in what form, is set out by `migrateSettings` in [packages/cli/src/migrate/settings.ts](packages/cli/src/migrate/settings.ts) and `migrateDocuments` in [packages/cli/src/migrate/documents.ts](packages/cli/src/migrate/documents.ts). What bbg did that bbg-next has no counterpart for:

## On the site

- The buttons under an article that copy its text or download its Markdown.
- The licence notice under each article and page, maybe we can declare it on the front matter.
- Hint boxes (`<info-hint>`, `<warning-hint>`, `<success-hint>`, `<danger-hint>`) and references (`<ref>`, which bbg gathered into a list at the end of the article). Both show as written.
- HTML inside Markdown, which shows as written: `createMarkdown` in [packages/core/src/markdown.ts](packages/core/src/markdown.ts) keeps raw HTML off. That holds for the footer, the announcement and the text on the friends page too, which bbg read as HTML.
- Pages of raw HTML, and pages that open in a new tab. A raw HTML page stays at its own address, with no way to it in the nav.
- Links to other sites in the nav, which lists the site's own pages only.
- Valine comments and Disqus.

## In the settings

- A solid background colour. A background picture carries over as `wallpaper` in `data/themes/<theme>.json`.
- Articles in an order of one's own: they list pinned first, then newest first by `created`.
- Third-party themes: the theme store and checking a theme for updates.

## In the editor

bbg-next is a command line, with nothing for these parts of bbg's desktop app:

- The lists of articles and pages, the tag cloud, and filtering by date and tag. An article's or page's metadata is the front matter at the top of its file.
- The built-in Markdown editor, with its live preview, synced scrolling and switch to an external editor.
- AI writing help: continuing, polishing and summarising.
- Creating an article or a page: the file and its front matter are written by hand.
- Publishing: bbg committed and pushed the site with Git, or uploaded it with scp.
- An interface in other languages: the command line speaks English.

Part of a document goes behind a password, as with bbg's partial encryption, by running `bbg-next encrypt` on a file holding just that part and no front matter, then pasting the block it holds into the document.

## Not planned

- The stylesheet CDN: the theme and plugins carry their stylesheets in their bundles.
- Serif type.
- Custom CSS and JavaScript, which a plugin can bring instead, and custom interface text.
- Colours of their own for the bar's text and for links: the theme works every colour out from `seed` in `data/site.json`. Third party themes which need them can put them in their `data/themes/<theme>.json`.
