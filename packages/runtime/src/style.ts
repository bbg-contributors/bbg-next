// Unlayered like a plugin's, so a theme's resets cannot flatten it, and drawn from the shared tokens so it blends in.
export const css = `
/* Without specificity, so whatever a plugin or theme says about its own buttons wins. */
:where(.bbg-button) {
  padding: 0.375rem 1rem;
  border: 0;
  border-radius: var(--bbg-radius, 4px);
  background: var(--bbg-accent, #0d6efd);
  color: var(--bbg-on-accent, #fff);
  font: inherit;
  cursor: pointer;
}
:where(.bbg-button):disabled {
  cursor: default;
  opacity: 0.6;
}
bbg-encrypted {
  display: block;
  margin: 1rem 0;
}
.bbg-encrypted-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border: 1px dashed var(--bbg-border, #999);
  border-radius: var(--bbg-radius, 4px);
  color: var(--bbg-fg, inherit);
}
.bbg-encrypted-form > span {
  flex-basis: 100%;
}
.bbg-encrypted-notice {
  color: var(--bbg-muted, inherit);
}
.bbg-encrypted-error {
  color: color-mix(in srgb, #e03131 75%, var(--bbg-fg, currentColor));
}
.bbg-encrypted-form input {
  flex: 1 1 12rem;
  min-width: 0;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--bbg-border, #999);
  border-radius: var(--bbg-radius, 4px);
  background: var(--bbg-bg, transparent);
  color: inherit;
  font: inherit;
}
.bbg-encrypted-form button:disabled {
  cursor: progress;
}
`
