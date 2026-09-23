import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

import { classOnlyFile } from './class-only-file.js'

const linter = new Linter()

function messages(source) {
  return linter.verify(source, [
    {
      languageOptions: { parser: tseslint.parser },
      plugins: { local: { rules: { 'class-only-file': classOnlyFile } } },
      rules: { 'local/class-only-file': 'error' },
    },
  ])
}

describe('class-only-file rule', () => {
  it('allows imports and type declarations around one class', () => {
    expect(
      messages(
        'import { x } from "x"; type Value = string; interface Options { ok: boolean }; export type { Value }; export class Example {}',
      ),
    ).toEqual([])
  })

  it('rejects runtime helpers and singleton instances beside a class', () => {
    const errors = messages(
      'function helper() {} export class Example {} export const instance = new Example()',
    )
    expect(errors.map((error) => error.message)).toEqual([
      'Move runtime declarations outside this class file.',
      'Move runtime declarations outside this class file.',
    ])
  })

  it('does not restrict modules without a class', () => {
    expect(messages('export function helper() {}')).toEqual([])
  })

  it('rejects class expressions and nested classes', () => {
    expect(messages('export const Example = class {}')).toHaveLength(1)
    expect(messages('function create() { class Nested {} }')).toHaveLength(1)
  })

  it('rejects a second top-level class', () => {
    expect(
      messages('class First {} class Second {}').map((error) => error.message),
    ).toEqual(['Keep only one class in this file.'])
  })
})
