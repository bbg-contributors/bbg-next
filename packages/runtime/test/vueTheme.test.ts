// @vitest-environment happy-dom
import * as vueTheme from '@bbg-next/default-theme-vue'
import { describeThemeContract } from './themeContract.ts'

// A separate file: both themes claim the same element names, and `customElements` is per document.
describeThemeContract(vueTheme)
