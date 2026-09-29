import * as v from 'valibot'

// Four-digit years, all a feed's date format can hold.
const earliest = Date.parse('0000-01-01T00:00:00Z')
const latest = Date.parse('9999-12-31T23:59:59.999Z')

// ISO string or epoch ms. Legacy sites are already +08:00 shifted; never re-apply.
const TimestampSchema = v.pipe(
  v.union([v.string(), v.number()]),
  v.rawTransform<string | number, number>(({ dataset, addIssue, NEVER }) => {
    const ms = typeof dataset.value === 'number' ? dataset.value : Date.parse(dataset.value)
    if (Number.isNaN(ms) || ms < earliest || ms > latest) {
      addIssue({ message: `Not a valid date: ${JSON.stringify(dataset.value)}` })

      return NEVER
    }

    return ms
  }),
)

const TagsSchema = v.pipe(
  v.array(v.pipe(v.string(), v.trim(), v.minLength(1))),
  v.transform(tags => [...new Set(tags)]),
)

export const ArticleMetaSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, 'An article needs a title')),
  slug: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  tags: v.optional(TagsSchema, []),
  created: v.optional(TimestampSchema),
  updated: v.optional(TimestampSchema),
  pinned: v.optional(v.boolean(), false),
  /** Never reaches the manifest. */
  draft: v.optional(v.boolean(), false),
  /** In the manifest but out of every listing, so direct links still resolve. */
  hidden: v.optional(v.boolean(), false),
  excerpt: v.optional(v.pipe(v.string(), v.trim())),
  comments: v.optional(v.boolean(), true),
})

export const PageMetaSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, 'A page needs a title')),
  slug: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  updated: v.optional(TimestampSchema),
  draft: v.optional(v.boolean(), false),
  showInNav: v.optional(v.boolean(), true),
  navLabel: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  /** Lower first; pages without one follow in file-name order. */
  navOrder: v.optional(v.number()),
  comments: v.optional(v.boolean(), true),
})
