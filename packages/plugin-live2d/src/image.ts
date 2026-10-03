// The Cubism 5 SDK loads a model's textures without asking for CORS, which WebGL needs to draw one from another origin.
export function CrossOriginImage(width?: number, height?: number): HTMLImageElement {
  const image = new globalThis.Image(width, height)
  image.crossOrigin = 'anonymous'

  return image
}
