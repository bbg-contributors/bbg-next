// @vitest-environment happy-dom
import { describeThemeContract } from '../testing/index.ts'
import * as stubTheme from './stubTheme.ts'

describeThemeContract(stubTheme)
