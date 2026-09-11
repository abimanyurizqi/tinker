'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Binary, Braces, Check, ChevronDown, ChevronRight, Clipboard, Code2, Copy, Download, FileCode2, FileJson, Fingerprint, KeyRound, Moon, Minimize2, RotateCcw, Sun, Wand2 } from 'lucide-react'

type Format = 'JSON' | 'XML'
type Tool = 'formatter' | 'base64' | 'jwt' | 'regex'
type Diagnostic = { message: string; line: number; column: number; position: number }
type Match = { value: string; index: number }

function loadCache(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function saveCache(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* storage may be unavailable */ }
}

const sampleXml = `<transaction><id>TRX-2024-00981</id><status>success</status><amount currency="IDR">125000</amount><customer><name>Nadia Pratama</name><email>nadia@example.com</email></customer><items><item sku="ST-001" qty="1">Studio Headphones</item></items></transaction>`

const sampleJson = `{
  "transaction": {
    "id": "TRX-2024-00981",
    "status": "success",
    "amount": 125000,
    "currency": "IDR",
    "customer": {
      "name": "Nadia Pratama",
      "email": "nadia@example.com"
    },
    "items": [
      { "sku": "ST-001", "name": "Studio Headphones", "qty": 1 }
    ]
  }
}`
const sampleJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJUUlgtMjAyNC0wMDk4MSIsIm5hbWUiOiJOYWRpYSBQcmF0YW1hIiwiaWF0IjoxNzI2NzE2ODAwfQ.A5FYhBjXuKBNhbMojljKKVHh9ovpi6EtrQ5n7SfQ8nE`

function beautifyXml(source: string) {
  const compact = source.replace(/>\s*</g, '><').trim()
  if (!compact) return ''
  const tokens = compact.match(/<[^>]+>|[^<]+/g) || []
  const lines: string[] = []
  let depth = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].trim()
    if (!token) continue
    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      lines.push(`${'  '.repeat(depth)}${token}`)
      continue
    }
    if (token.startsWith('<?') || token.startsWith('<!') || token.endsWith('/>')) {
      lines.push(`${'  '.repeat(depth)}${token}`)
      continue
    }
    if (token.startsWith('<')) {
      const text = tokens[index + 1]?.trim()
      const closing = tokens[index + 2]?.trim()
      if (text && !text.startsWith('<') && closing?.startsWith('</')) {
        lines.push(`${'  '.repeat(depth)}${token}${text}${closing}`)
        index += 2
      } else {
        lines.push(`${'  '.repeat(depth)}${token}`)
        depth += 1
      }
      continue
    }
    lines.push(`${'  '.repeat(depth)}${token}`)
  }
  return lines.join('\n')
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodeJwt(token: string): { header: Record<string, unknown> | null; payload: Record<string, unknown> | null; signature: string; error: string } {
  const empty = { header: null, payload: null, signature: '', error: '' }
  const parts = token.trim().split('.')
  if (parts.length !== 3) return { ...empty, error: 'JWT harus terdiri dari 3 segmen: header.payload.signature' }
  const base64url = (segment: string) => {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }
  try {
    const header = JSON.parse(base64url(parts[0])) as Record<string, unknown>
    const payload = JSON.parse(base64url(parts[1])) as Record<string, unknown>
    return { header, payload, signature: parts[2], error: '' }
  } catch {
    return { ...empty, error: 'Segmen token bukan base64url / JSON yang valid' }
  }
}

function getRegexMatches(pattern: string, flags: string, text: string): { matches: Match[]; error: string } {
  if (!pattern) return { matches: [], error: '' }
  try {
    const regex = new RegExp(pattern, flags)
    const matches: Match[] = []
    if (flags.includes('g')) {
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        matches.push({ value: match[0], index: match.index })
        if (match[0] === '') regex.lastIndex += 1
      }
    } else {
      const match = regex.exec(text)
      if (match) matches.push({ value: match[0], index: match.index })
    }
    return { matches, error: '' }
  } catch (cause) {
    return { matches: [], error: cause instanceof Error ? cause.message : 'Invalid regex pattern' }
  }
}

function getDiagnostic(source: string, format: Format): Diagnostic | null {
  if (!source.trim()) return null
  try {
    if (format === 'JSON') JSON.parse(source)
    else if (typeof window !== 'undefined') {
      const xml = new DOMParser().parseFromString(source, 'application/xml')
      const parserError = xml.querySelector('parsererror')
      if (parserError) {
        const text = parserError.textContent || 'Invalid XML'
        const lineMatch = text.match(/line (\d+)/i)
        return { message: 'Invalid XML', line: Number(lineMatch?.[1] || 1), column: 1, position: 0 }
      }
    }
    return null
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Invalid JSON'
    const position = Number(message.match(/position (\d+)/i)?.[1] || 0)
    const before = source.slice(0, position)
    return { message: message.replace(/ in JSON at position \d+/i, '').replace(/^JSON\.parse:\s*/i, '') || 'Invalid JSON', line: before.split('\n').length, column: position - before.lastIndexOf('\n'), position }
  }
}

function parseXmlTree(source: string): { name: string; value: any } | null {
  if (typeof window === 'undefined') return null
  const document = new DOMParser().parseFromString(source, 'application/xml')
  if (document.querySelector('parsererror') || !document.documentElement) return null
  const walk = (element: Element): any => {
    const result: Record<string, any> = {}
    Array.from(element.attributes).forEach(attribute => { result[`@${attribute.name}`] = attribute.value })
    const children = Array.from(element.children)
    const text = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent?.trim()).filter(Boolean).join(' ')
    if (!children.length && !Object.keys(result).length) return text
    if (text) result['#text'] = text
    children.forEach(child => {
      const value = walk(child)
      if (result[child.tagName]) result[child.tagName] = Array.isArray(result[child.tagName]) ? [...result[child.tagName], value] : [result[child.tagName], value]
      else result[child.tagName] = value
    })
    return result
  }
  return { name: document.documentElement.tagName, value: walk(document.documentElement) }
}

function AppTool({ theme, setTheme, tool, onSelectTool, toolName, children }: { theme: 'light' | 'dark'; setTheme: (value: 'light' | 'dark') => void; tool: Tool; onSelectTool: (value: Tool) => void; toolName: string; children: ReactNode }) {
  const items: { id: Tool; label: string; icon?: ReactNode; glyph?: string }[] = [
    { id: 'formatter', label: 'Formatter', icon: <Code2 size={16}/> },
    { id: 'base64', label: 'Base64', icon: <Binary size={16}/> },
    { id: 'jwt', label: 'JWT decoder', glyph: 'JWT' },
    { id: 'regex', label: 'Regex tester', glyph: '/' },
  ]
  return <main className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}><nav className="topbar"><div className="brand"><span className="brand-mark">T</span><span>Tinker</span></div><div className="topbar-tools"><span className="tool-name">{toolName}</span><span className="topbar-divider"/><button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}</button><div className="avatar">D</div></div></nav><div className="workspace"><aside className="sidebar"><div className="sidebar-label">TOOLS</div>{items.map(item => <button key={item.id} className={`tool-item ${tool === item.id ? 'active' : ''}`} onClick={() => onSelectTool(item.id)}>{item.icon || <span className="tool-glyph">{item.glyph}</span>}<span>{item.label}</span></button>)}</aside><section className="content">{children}</section></div></main>
}

function TreeNode({ name, value, depth = 0 }: { name: string; value: any; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const branch = value && typeof value === 'object'
  const entries = branch ? Object.entries(value) : []
  return <div className="tree-node" style={{ marginLeft: depth * 16 }}><div className="tree-line" onClick={() => branch && setOpen(!open)}>{branch ? (open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span className="tree-dot"/>}<span className="key">{name}</span>{branch && <span className="muted">{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</span>}{!branch && <><span className="colon">:</span><span className={typeof value === 'number' ? 'number' : value === null ? 'null' : 'string'}>{typeof value === 'string' ? `"${value}"` : String(value)}</span></>}</div>{branch && open && entries.map(([key, child]) => <TreeNode key={key} name={Array.isArray(value) ? String(key) : key} value={child} depth={depth + 1}/>)}</div>
}

function highlightLine(source: string, format: Format) {
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (format === 'XML') return escaped.replace(/(&lt;\/?)([\w:-]+)(.*?)(\/??&gt;)/g, '$1<span class="hl-tag">$2</span><span class="hl-attr">$3</span>$4').replace(/([\w:-]+)=(&quot;.*?&quot;)/g, '<span class="hl-key">$1</span>=<span class="hl-string">$2</span>')
  return escaped.replace(/(&quot;.*?&quot;)(\s*:)/g, '<span class="hl-key">$1</span>$2').replace(/(&quot;.*?&quot;)/g, '<span class="hl-string">$1</span>').replace(/\b(true|false)\b/g, '<span class="hl-bool">$1</span>').replace(/\b(null)\b/g, '<span class="hl-null">$1</span>').replace(/(-?\b\d+(?:\.\d+)?\b)/g, '<span class="hl-number">$1</span>')
}

export default function Home() {
  const [tool, setTool] = useState<Tool>('formatter')
  const [format, setFormat] = useState<Format>('JSON')
  const [drafts, setDrafts] = useState<Record<Format, string>>({ JSON: sampleJson, XML: sampleXml })
  const input = drafts[format]
  const setInput = (value: string) => setDrafts(prev => ({ ...prev, [format]: value }))
  const [activeTab, setActiveTab] = useState('tree')
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [base64Mode, setBase64Mode] = useState<'encode' | 'decode'>('encode')
  const [base64Input, setBase64Input] = useState('Hello, Tinker')
  const [base64Copied, setBase64Copied] = useState(false)
  const [jwtInput, setJwtInput] = useState(sampleJwt)
  const [jwtCopied, setJwtCopied] = useState(false)
  const [regexPattern, setRegexPattern] = useState('\\b(TRX|ST)-\\d+\\b|\\b\\d{4,}\\b')
  const [regexFlags, setRegexFlags] = useState('g')
  const [regexText, setRegexText] = useState('Order TRX-2024-001 and ST-1001 shipped. Total 125000 IDR.\nReferensi: TRX-2024-00812')
  useEffect(() => {
    const raw = loadCache('tinker:drafts')
    if (raw) { try { const parsed = JSON.parse(raw); setDrafts({ JSON: typeof parsed.JSON === 'string' ? parsed.JSON : sampleJson, XML: typeof parsed.XML === 'string' ? parsed.XML : sampleXml }) } catch { /* ignore */ } }
    if (loadCache('tinker:format') === 'XML') setFormat('XML')
    if (loadCache('tinker:tool') === 'base64') setTool('base64')
    if (loadCache('tinker:tool') === 'jwt') setTool('jwt')
    if (loadCache('tinker:tool') === 'regex') setTool('regex')
    if (loadCache('tinker:theme') === 'light') setTheme('light')
    if (loadCache('tinker:b64mode') === 'decode') setBase64Mode('decode')
    setBase64Input(loadCache('tinker:b64input') ?? 'Hello, Tinker')
    setJwtInput(loadCache('tinker:jwt') ?? sampleJwt)
    setRegexPattern(loadCache('tinker:regexpattern') ?? '\\b(TRX|ST)-\\d+\\b|\\b\\d{4,}\\b')
    setRegexFlags(loadCache('tinker:regexflags') ?? 'g')
    setRegexText(loadCache('tinker:regextext') ?? 'Order TRX-2024-001 and ST-1001 shipped. Total 125000 IDR.\nReferensi: TRX-2024-00812')
  }, [])
  useEffect(() => saveCache('tinker:drafts', JSON.stringify(drafts)), [drafts])
  useEffect(() => saveCache('tinker:format', format), [format])
  useEffect(() => saveCache('tinker:tool', tool), [tool])
  useEffect(() => saveCache('tinker:theme', theme), [theme])
  useEffect(() => saveCache('tinker:b64mode', base64Mode), [base64Mode])
  useEffect(() => saveCache('tinker:b64input', base64Input), [base64Input])
  useEffect(() => saveCache('tinker:jwt', jwtInput), [jwtInput])
  useEffect(() => saveCache('tinker:regexpattern', regexPattern), [regexPattern])
  useEffect(() => saveCache('tinker:regexflags', regexFlags), [regexFlags])
  useEffect(() => saveCache('tinker:regextext', regexText), [regexText])
  const diagnostic = useMemo(() => getDiagnostic(input, format), [input, format])
  const treeRoot = useMemo(() => { try { return format === 'JSON' ? { name: 'root', value: JSON.parse(input) } : parseXmlTree(input) } catch { return null } }, [input, format])
  const pretty = () => { try { if (format === 'JSON') setInput(JSON.stringify(JSON.parse(input), null, 2)); else setInput(beautifyXml(input)); } catch { /* diagnostic is live */ } }
  const minify = () => { try { if (format === 'JSON') setInput(JSON.stringify(JSON.parse(input))); else setInput(input.replace(/\s*\n\s*/g, '').replace(/>\s+</g, '><')); } catch { /* diagnostic is live */ } }
  const copy = async () => { await navigator.clipboard?.writeText(input); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const base64Result = useMemo(() => {
    try { return { value: base64Mode === 'encode' ? encodeBase64(base64Input) : decodeBase64(base64Input), error: '' } }
    catch { return { value: '', error: base64Mode === 'decode' ? 'Invalid Base64 input' : 'Unable to encode input' } }
  }, [base64Input, base64Mode])
  const copyBase64 = async () => { await navigator.clipboard?.writeText(base64Result.value); setBase64Copied(true); setTimeout(() => setBase64Copied(false), 1500) }
  const jwtDecoded = useMemo(() => decodeJwt(jwtInput), [jwtInput])
  const copyJwt = async () => { if (!jwtDecoded.error) await navigator.clipboard?.writeText(JSON.stringify({ header: jwtDecoded.header, payload: jwtDecoded.payload }, null, 2)); setJwtCopied(true); setTimeout(() => setJwtCopied(false), 1500) }
  const regexResult = useMemo(() => getRegexMatches(regexPattern, regexFlags, regexText), [regexPattern, regexFlags, regexText])
  const regexPreview = useMemo(() => {
    if (regexResult.error || !regexText) return null
    const nodes: ReactNode[] = []
    let last = 0
    regexResult.matches.forEach((match, index) => {
      nodes.push(regexText.slice(last, match.index))
      nodes.push(<mark key={index} className="match-hl">{regexText.slice(match.index, match.index + match.value.length)}</mark>)
      last = match.index + match.value.length
    })
    nodes.push(regexText.slice(last))
    return nodes
  }, [regexResult, regexText])
  const toggleFlag = (flag: string) => setRegexFlags(prev => prev.includes(flag) ? prev.replace(flag, '') : prev + flag)
  const lines = input.split('\n')
  const editorLines = lines.map((line, index) => <div key={index} className={`code-line ${diagnostic?.line === index + 1 ? 'line-error' : ''}`} dangerouslySetInnerHTML={{ __html: highlightLine(line || ' ', format) }} />)
  if (tool === 'base64') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool} toolName="Base64"><div className="content-head"><div><h1>Base64 Encoder / Decoder</h1></div><div className="format-switch"><button className={base64Mode === 'encode' ? 'selected' : ''} onClick={() => setBase64Mode('encode')}>Encode</button><button className={base64Mode === 'decode' ? 'selected' : ''} onClick={() => setBase64Mode('decode')}>Decode</button></div></div><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Binary size={16}/><h2>Input</h2><span className="format-label">{base64Mode === 'encode' ? 'TEXT' : 'BASE64'}</span></div><button className="quiet-button" onClick={() => setBase64Input('')} aria-label="Clear input"><RotateCcw size={14}/></button></div><div className="plain-editor-wrap"><textarea value={base64Input} onChange={event => setBase64Input(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Base64 input" placeholder={base64Mode === 'encode' ? 'Type text to encode' : 'Paste Base64 to decode'}/></div><div className="panel-foot"><span className="meta-text">{base64Input.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Code2 size={16}/><h2>Result</h2></div><button className="quiet-button" onClick={copyBase64}>{base64Copied ? <Check size={14}/> : <Copy size={14}/>} {base64Copied ? 'Copied' : 'Copy'}</button></div><div className="result-body">{base64Result.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16}/></div><div><strong>{base64Result.error}</strong><p>Check the input and try again.</p></div></div> : <pre className="raw-view">{base64Result.value}</pre>}</div><div className="panel-foot"><span className={`status-dot ${base64Result.error ? 'error' : ''}`}/><span className="meta-text">{base64Result.error ? 'Invalid input' : 'Ready'}</span></div></section></div></AppTool>
  if (tool === 'jwt') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool} toolName="JWT"><div className="content-head"><div><h1>JWT Decoder</h1></div></div><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><KeyRound size={16}/><h2>Token</h2></div><button className="quiet-button" onClick={() => setJwtInput('')} aria-label="Clear token"><RotateCcw size={14}/></button></div><div className="plain-editor-wrap"><textarea value={jwtInput} onChange={event => setJwtInput(event.target.value)} className="plain-editor" spellCheck={false} aria-label="JWT token" placeholder="Paste a JWT token here"/></div><div className="panel-foot"><span className="meta-text">{jwtInput.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Fingerprint size={16}/><h2>Decoded</h2></div><button className="quiet-button" onClick={copyJwt}>{jwtCopied ? <Check size={14}/> : <Copy size={14}/>} {jwtCopied ? 'Copied' : 'Copy'}</button></div><div className="inspector-body">{jwtDecoded.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16}/></div><div><strong>Unable to decode JWT</strong><p>{jwtDecoded.error}</p></div></div> : <><div className="section-label">HEADER</div><pre className="raw-view">{JSON.stringify(jwtDecoded.header, null, 2)}</pre><div className="section-label">PAYLOAD</div><pre className="raw-view">{JSON.stringify(jwtDecoded.payload, null, 2)}</pre><div className="section-label">SIGNATURE</div><div className="sig-text">{jwtDecoded.signature}</div></>}</div><div className="panel-foot inspector-status"><span className={`status-dot ${jwtDecoded.error ? 'error' : ''}`}/><span className="meta-text">{jwtDecoded.error ? 'Invalid token' : 'Valid JWT structure'}</span></div></section></div></AppTool>
  if (tool === 'regex') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool} toolName="Regex"><div className="content-head"><div><h1>Regex Tester</h1></div></div><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Braces size={16}/><h2>Pattern</h2><span className="format-label">/{regexPattern}/{regexFlags}</span></div><button className="quiet-button" onClick={() => setRegexPattern('')} aria-label="Clear pattern"><RotateCcw size={14}/></button></div><div className="regex-inputs"><input className="plain-input" value={regexPattern} onChange={event => setRegexPattern(event.target.value)} spellCheck={false} aria-label="Regex pattern" placeholder="Enter regex pattern"/><div className="flag-row">{[['g','Global'],['i','Ignore case'],['m','Multiline'],['s','Dotall'],['u','Unicode'],['y','Sticky']].map(([flag, label]) => <button key={flag} className={`flag-button ${regexFlags.includes(flag) ? 'on' : ''}`} onClick={() => toggleFlag(flag)}>{label}</button>)}</div></div><div className="panel-head"><div className="panel-title"><Braces size={16}/><h2>Test string</h2></div><button className="quiet-button" onClick={() => setRegexText('')} aria-label="Clear test string"><RotateCcw size={14}/></button></div><div className="plain-editor-wrap"><textarea value={regexText} onChange={event => setRegexText(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Test string"/></div><div className="panel-foot"><span className="meta-text">{regexText.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Check size={16}/><h2>Matches</h2></div></div><div className="inspector-body">{regexResult.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16}/></div><div><strong>Invalid regex</strong><p>{regexResult.error}</p></div></div> : regexText ? <><div className="match-summary">{regexResult.matches.length} match{regexResult.matches.length === 1 ? '' : 'es'}</div><pre className="raw-view match-preview">{regexPreview}</pre>{regexResult.matches.map((match, index) => <div key={index} className="match-row"><span className="match-index">#{index + 1} · {match.index}</span><span className="match-value">{match.value}</span></div>)}</> : <div className="empty-state">Enter text to scan</div>}</div><div className="panel-foot inspector-status"><span className={`status-dot ${regexResult.error ? 'error' : ''}`}/><span className="meta-text">{regexResult.error ? 'Invalid pattern' : regexResult.matches.length ? `${regexResult.matches.length} found` : 'No matches'}</span></div></section></div></AppTool>
  return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool} toolName="Formatter"><div className="content-head"><div><h1>JSON & XML Formatter</h1></div></div>
  <div className="panels"><section className="panel editor-panel"><div className="panel-head"><div className="panel-title"><Code2 size={16}/><h2>Editor</h2><span className="format-label">{format}</span></div><div className="panel-actions"><div className="format-switch"><button className={format === 'JSON' ? 'selected' : ''} onClick={() => setFormat('JSON')}><FileJson size={15}/> JSON</button><button className={format === 'XML' ? 'selected' : ''} onClick={() => setFormat('XML')}><FileCode2 size={15}/> XML</button></div><button className="quiet-button" onClick={() => setInput('')} aria-label="Clear editor"><RotateCcw size={14}/></button><button className="outline-button" onClick={minify}><Minimize2 size={14}/> Minify</button><button className="primary-button" onClick={pretty}><Wand2 size={14}/> Beautify</button></div></div><div className="editor-wrap"><div className="line-numbers">{lines.map((_, i) => <span key={i} className={diagnostic?.line === i + 1 ? 'number-error' : ''}>{String(i + 1).padStart(2, '0')}</span>)}</div><div className="code-editor"><pre aria-hidden="true">{editorLines}</pre><textarea spellCheck={false} value={input} onChange={e => setInput(e.target.value)} onScroll={e => { const t = e.currentTarget; const overlay = t.previousElementSibling as HTMLElement | null; const gutter = t.parentElement?.previousElementSibling as HTMLElement | null; if (overlay) { overlay.scrollTop = t.scrollTop; overlay.scrollLeft = t.scrollLeft } if (gutter) gutter.scrollTop = t.scrollTop }} className="editor" wrap="soft" aria-label={`${format} editor`}/></div></div><div className="panel-foot"><span className="meta-text">{input.length} characters</span>{diagnostic && <span className="error-inline">Line {diagnostic.line}, col {diagnostic.column}</span>}</div></section>
  <section className="panel inspector-panel"><div className="panel-head"><div className="panel-title"><Code2 size={16}/><h2>Inspector</h2></div><div className="panel-actions"><button className="quiet-button" onClick={copy}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy'}</button><button className="quiet-button icon-only" aria-label="Download"><Download size={14}/></button></div></div><div className="tabs"><button className={activeTab === 'tree' ? 'active' : ''} onClick={() => setActiveTab('tree')}>Tree</button><button className={activeTab === 'raw' ? 'active' : ''} onClick={() => setActiveTab('raw')}>Raw</button></div><div className="inspector-body">{diagnostic ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16}/></div><div><strong>Unable to parse {format}</strong><p>{diagnostic.message}</p><button onClick={() => { setActiveTab('raw'); document.querySelector<HTMLTextAreaElement>('.editor')?.focus() }}>Go to line {diagnostic.line}<span>:{diagnostic.column}</span></button></div></div> : activeTab === 'tree' ? treeRoot ? <TreeNode name={treeRoot.name} value={treeRoot.value}/> : <div className="empty-state">Enter a valid {format} payload</div> : <pre className="raw-view">{input}</pre>}</div><div className="panel-foot inspector-status"><span className={`status-dot ${diagnostic ? 'error' : ''}`}/><span className="meta-text">{diagnostic ? `Invalid ${format}` : `Valid ${format}`}</span></div></section></div></AppTool>
}
