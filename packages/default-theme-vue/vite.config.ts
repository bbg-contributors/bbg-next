import tailwindcss from '@tailwindcss/vite'
import { browserBundle, vue } from '../../vite.base.config.ts'

export default browserBundle(tailwindcss(), vue())
