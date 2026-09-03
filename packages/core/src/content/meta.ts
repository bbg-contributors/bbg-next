import * as v from 'valibot'

// ISO string, epoch ms or Date — YAML gives all three. Legacy sites are already +08:00 shifted; never re-apply.
const TimestampSchema = v.pipe(
  v.union([v.string(), v.number(), v.date()]),
  v.rawTransform<string | number | Date, number>(({ dataset, addIssue, NEVER }) => {
    const value = dataset.value
    const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)
    if (!Number.isFinite(ms)) {
      addIssue({ message: `Not a valid date: ${JSON.stringify(value)}` })

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
})

export const PageMetaSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, 'A page needs a title')),
  slug: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  updated: v.optional(TimestampSchema),
  draft: v.optional(v.boolean(), false),
  showInNav: v.optional(v.boolean(), true),
  navLabel: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
})
