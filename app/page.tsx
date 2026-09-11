'use client'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Binary, Check, ChevronDown, ChevronRight, Clipboard, Code2, Copy, Download, FileCode2, FileJson, Moon, Minimize2, RotateCcw, Sun, Wand2 } from 'lucide-react'

type Format = 'JSON' | 'XML'
type Tool = 'formatter' | 'base64'
type Diagnostic = { message: string; line: number; column: number; position: number }

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
  useEffect(() => {
    const raw = loadCache('tinker:drafts')
    if (raw) { try { const parsed = JSON.parse(raw); setDrafts({ JSON: typeof parsed.JSON === 'string' ? parsed.JSON : sampleJson, XML: typeof parsed.XML === 'string' ? parsed.XML : sampleXml }) } catch { /* ignore */ } }
    if (loadCache('tinker:format') === 'XML') setFormat('XML')
    if (loadCache('tinker:tool') === 'base64') setTool('base64')
    if (loadCache('tinker:theme') === 'light') setTheme('light')
    if (loadCache('tinker:b64mode') === 'decode') setBase64Mode('decode')
    setBase64Input(loadCache('tinker:b64input') ?? 'Hello, Tinker')
  }, [])
  useEffect(() => saveCache('tinker:drafts', JSON.stringify(drafts)), [drafts])
  useEffect(() => saveCache('tinker:format', format), [format])
  useEffect(() => saveCache('tinker:tool', tool), [tool])
  useEffect(() => saveCache('tinker:theme', theme), [theme])
  useEffect(() => saveCache('tinker:b64mode', base64Mode), [base64Mode])
  useEffect(() => saveCache('tinker:b64input', base64Input), [base64Input])
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
  const lines = input.split('\n')
  const editorLines = lines.map((line, index) => <div key={index} className={`code-line ${diagnostic?.line === index + 1 ? 'line-error' : ''}`} dangerouslySetInnerHTML={{ __html: highlightLine(line || ' ', format) }} />)
  if ((tool as string) === 'base64') return <main className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}><nav className="topbar"><div className="brand"><span className="brand-mark">T</span><span>Tinker</span></div><div className="topbar-tools"><span className="tool-name">Base64</span><span className="topbar-divider"/><button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}</button><div className="avatar">D</div></div></nav><div className="workspace"><aside className="sidebar"><div className="sidebar-label">TOOLS</div><button className="tool-item" onClick={() => setTool('formatter')}><Code2 size={16}/><span>Formatter</span></button><button className="tool-item active"><Binary size={16}/><span>Base64</span></button><button className="tool-item"><span className="tool-glyph">JWT</span><span>JWT decoder</span><span className="soon">Soon</span></button><button className="tool-item"><span className="tool-glyph">/</span><span>Regex tester</span><span className="soon">Soon</span></button></aside><section className="content"><div className="content-head"><div><h1>Base64 Encoder / Decoder</h1></div><div className="format-switch"><button className={base64Mode === 'encode' ? 'selected' : ''} onClick={() => setBase64Mode('encode')}>Encode</button><button className={base64Mode === 'decode' ? 'selected' : ''} onClick={() => setBase64Mode('decode')}>Decode</button></div></div><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Binary size={16}/><h2>Input</h2><span className="format-label">{base64Mode === 'encode' ? 'TEXT' : 'BASE64'}</span></div><button className="quiet-button" onClick={() => setBase64Input('')} aria-label="Clear input"><RotateCcw size={14}/></button></div><div className="plain-editor-wrap"><textarea value={base64Input} onChange={event => setBase64Input(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Base64 input" placeholder={base64Mode === 'encode' ? 'Type text to encode' : 'Paste Base64 to decode'}/></div><div className="panel-foot"><span className="meta-text">{base64Input.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Code2 size={16}/><h2>Result</h2></div><button className="quiet-button" onClick={copyBase64}>{base64Copied ? <Check size={14}/> : <Copy size={14}/>} {base64Copied ? 'Copied' : 'Copy'}</button></div><div className="result-body">{base64Result.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16}/></div><div><strong>{base64Result.error}</strong><p>Check the input and try again.</p></div></div> : <pre className="raw-view">{base64Result.value}</pre>}</div><div className="panel-foot"><span className={`status-dot ${base64Result.error ? 'error' : ''}`}/><span className="meta-text">{base64Result.error ? 'Invalid input' : 'Ready'}</span></div></section></div></section></div></main>
  return <main className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}><nav className="topbar"><div className="brand"><span className="brand-mark">T</span><span>Tinker</span></div><div className="topbar-tools"><span className="tool-name">Formatter</span><span className="topbar-divider"/><button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}</button><div className="avatar">D</div></div></nav>
  <div className="workspace"><aside className="sidebar"><div className="sidebar-label">TOOLS</div><button className={`tool-item ${tool === 'formatter' ? 'active' : ''}`} onClick={() => setTool('formatter')}><Code2 size={16}/><span>Formatter</span></button><button className={`tool-item ${tool === 'base64' ? 'active' : ''}`} onClick={() => setTool('base64')}><Binary size={16}/><span>Base64</span></button><button className="tool-item"><span className="tool-glyph">JWT</span><span>JWT decoder</span><span className="soon">Soon</span></button><button className="tool-item"><span className="tool-glyph">/</span><span>Regex tester</span><span className="soon">Soon</span></button></aside>
  <section className="content"><div className="content-head"><div><h1>JSON & XML Formatter</h1></div></div>
  <div className="panels"><section className="panel editor-panel"><div className="panel-head"><div className="panel-title"><Code2 size={16}/><h2>Editor</h2><span className="format-label">{format}</span></div><div className="panel-actions"><div className="format-switch"><button className={format === 'JSON' ? 'selected' : ''} onClick={() => setFormat('JSON')}><FileJson size={15}/> JSON</button><button className={format === 'XML' ? 'selected' : ''} onClick={() => setFormat('XML')}><FileCode2 size={15}/> XML</button></div><span className="meta-text">{input.length} characters</span>{diagnostic && <span className="error-inline">Line {diagnostic.line}, col {diagnostic.column}</span>}<button className="quiet-button" onClick={() => setInput('')} aria-label="Clear editor"><RotateCcw size={14}/></button><button className="outline-button" onClick={minify}><Minimize2 size={14}/> Minify</button><button className="primary-button" onClick={pretty}><Wand2 size={14}/> Beautify</button></div></div><div className="editor-wrap"><div className="line-numbers">{lines.map((_, i) => <span key={i} className={diagnostic?.line === i + 1 ? 'number-error' : ''}>{String(i + 1).padStart(2, '0')}</span>)}</div><div className="code-editor"><pre aria-hidden="true">{editorLines}</pre><textarea spellCheck={false} value={input} onChange={e => setInput(e.target.value)} onScroll={e => { const t = e.currentTarget; const overlay = t.previousElementSibling as HTMLElement | null; const gutter = t.parentElement?.previousElementSibling as HTMLElement | null; if (overlay) { overlay.scrollTop = t.scrollTop; overlay.scrollLeft = t.scrollLeft } if (gutter) gutter.scrollTop = t.scrollTop }} className="editor" wrap="soft" aria-label={`${format} editor`}/></div></div></section>
  <section className="panel inspector-panel"><div className="panel-head"><div className="panel-title"><Code2 size={16}/><h2>Inspector</h2></div><div className="panel-actions"><button className="quiet-button" onClick={copy}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy'}</button><button className="quiet-button icon-only" aria-label="Download"><Download size={14}/></button></div></div><div className="tabs"><button className={activeTab === 'tree' ? 'active' : ''} onClick={() => setActiveTab('tree')}>Tree</button><button className={activeTab === 'raw' ? 'active' : ''} onClick={() => setActiveTab('raw')}>Raw</button></div><div className="inspector-body">{diagnostic ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16}/></div><div><strong>Unable to parse {format}</strong><p>{diagnostic.message}</p><button onClick={() => { setActiveTab('raw'); document.querySelector<HTMLTextAreaElement>('.editor')?.focus() }}>Go to line {diagnostic.line}<span>:{diagnostic.column}</span></button></div></div> : activeTab === 'tree' ? treeRoot ? <TreeNode name={treeRoot.name} value={treeRoot.value}/> : <div className="empty-state">Enter a valid {format} payload</div> : <pre className="raw-view">{input}</pre>}</div><div className="panel-foot inspector-status"><span className={`status-dot ${diagnostic ? 'error' : ''}`}/><span className="meta-text">{diagnostic ? `Invalid ${format}` : `Valid ${format}`}</span></div></section></div></section></div></main>
}
