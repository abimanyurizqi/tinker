'use client'
import { useEffect, useRef } from 'react'
import { DiffEditor, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/editor/editor.all'
import 'monaco-editor/esm/vs/basic-languages/monaco.contribution'
import 'monaco-editor/min/vs/editor/editor.main.css'

loader.config({ monaco })

if (!monaco.languages?.getLanguages?.().some(l => l.id === 'json')) {
  monaco.languages.register({ id: 'json' })
  monaco.languages.setLanguageConfiguration('json', {
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '"', close: '"', notIn: ['string'] }],
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
  })
  monaco.languages.setMonarchTokensProvider('json', {
    defaultToken: '',
    tokenPostfix: '.json',
    tokenizer: {
      root: [
        { include: '@whitespace' },
        [/[{}]/, 'delimiter.bracket'],
        [/[\[\]]/, 'delimiter.array'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/[+-]?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/\btrue\b|\bfalse\b/, 'keyword'],
        [/\bnull\b/, 'keyword.null'],
      ],
      whitespace: [[/[ \t\r\n]+/, ''], [/\/\*/, 'comment', '@comment'], [/\/\/.*$/, 'comment']],
      comment: [[/[^/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[/*]/, 'comment']],
      string: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]],
    },
  })
}

export type DiffNav = { next: () => void; prev: () => void }

const options: React.ComponentProps<typeof DiffEditor>['options'] = {
  renderSideBySide: true,
  readOnly: true,
  originalEditable: false,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  renderOverviewRuler: true,
  renderIndicators: true,
  lineNumbers: 'on',
  folding: true,
  showFoldingControls: 'always',
  contextmenu: true,
  wordWrap: 'off',
  accessibilitySupport: 'off',
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
}

export default function MonacoDiff({ original, modified, language, theme, navRef }: { original: string; modified: string; language: string; theme: 'light' | 'dark'; navRef?: { current: DiffNav | null } }) {
  const apiRef = useRef<any>(null)
  const indexRef = useRef(0)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => { indexRef.current = 0 }, [original, modified])
  useEffect(() => () => {
    if (navRef) navRef.current = null
  }, [navRef])

  const navigate = (dir: 1 | -1) => {
    try {
      const api = apiRef.current
      if (!api || typeof api.getLineChanges !== 'function') return
      const changes = (api.getLineChanges() ?? []).filter((c: { modifiedStartLineNumber?: number; originalStartLineNumber?: number }) => typeof c.modifiedStartLineNumber === 'number' && c.modifiedStartLineNumber > 0)
      frameRef.current?.setAttribute('data-nav-count', String(changes.length))
      if (!changes.length) return
      let i = indexRef.current + dir
      if (i < 0) i = changes.length - 1
      else if (i >= changes.length) i = 0
      indexRef.current = i
      const modifiedEditor = api.getModifiedEditor?.()
      const originalEditor = api.getOriginalEditor?.()
      const modifiedModel = modifiedEditor?.getModel?.()
      if (!modifiedEditor || !modifiedModel) return
      const maxLine = modifiedModel.getLineCount()
      const line = Math.min(Math.max(1, changes[i].modifiedStartLineNumber), maxLine)
      frameRef.current?.setAttribute('data-nav-line', String(line))
      frameRef.current?.setAttribute('data-nav-index', String(i))
      modifiedEditor.revealLineInCenter(line)
      modifiedEditor.setPosition({ lineNumber: line, column: 1 })
      modifiedEditor.focus()
      const origLine = changes[i].originalStartLineNumber
      if (originalEditor && typeof origLine === 'number' && origLine > 0) {
        const origMax = originalEditor.getModel?.()?.getLineCount?.() ?? Infinity
        originalEditor.revealLineInCenter(Math.min(origLine, Math.max(1, origMax)))
      }
    } catch { /* non-critical: keep navigation resilient */ }
  }

  const onMount = (editor: any) => {
    apiRef.current = editor
    if (navRef) navRef.current = { next: () => navigate(1), prev: () => navigate(-1) }
  }

  return (
    <div className="monaco-diff-frame" ref={frameRef}>
      <DiffEditor
        height="100%"
        original={original}
        modified={modified}
        language={language}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={options}
        keepCurrentOriginalModel
        keepCurrentModifiedModel
        onMount={onMount}
        loading={<div className="monaco-loading">Loading diff…</div>}
      />
    </div>
  )
}