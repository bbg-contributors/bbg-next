import type { Diagnostic } from '@bbg-next/core'
import process from 'node:process'

const useColour = process.stderr.isTTY === true && process.env['NO_COLOR'] === undefined

function paint(code: string, text: string): string {
  return useColour ? `\u001B[${code}m${text}\u001B[0m` : text
}

export const style = {
  bold: (text: string) => paint('1', text),
  dim: (text: string) => paint('2', text),
  green: (text: string) => paint('32', text),
  red: (text: string) => paint('31', text),
  yellow: (text: string) => paint('33', text),
}

export function reportDiagnostics(diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const label = diagnostic.level === 'error' ? style.red('error') : style.yellow('warn')
    process.stderr.write(`  ${label} ${style.dim(diagnostic.file)}\n        ${diagnostic.message}\n`)
  }
}
