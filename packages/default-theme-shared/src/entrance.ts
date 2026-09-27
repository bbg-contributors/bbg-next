/** The slide-in the original played on every navigation, played here over content that has just changed. */
export function enter(node: HTMLElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  node.animate({ opacity: [0, 1], translate: ['-20px', '0'] }, { duration: 800, easing: 'ease' })
}
