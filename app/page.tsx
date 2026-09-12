'use client'
import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, type UIEvent } from 'react'
import { AlertTriangle, ArrowLeftRight, Binary, Boxes, Braces, Check, ChevronDown, ChevronRight, Clock, Code2, Coffee, Copy, Database, Dices, Download, FileCode2, FileDiff, FileJson, FileText, Fingerprint, Hash, KeyRound, Link, List, Moon, Minimize2, RotateCcw, Scissors, ShieldCheck, Sun, Table, Terminal, Wand2 } from 'lucide-react'

type Format = 'JSON' | 'XML'
type Tool = 'formatter' | 'base64' | 'jwt' | 'regex' | 'compare' | 'clean' | 'timestamp' | 'sql' | 'plsql' | 'jsondiff' | 'xmldiff' | 'j2ts' | 'j2java' | 'j2kt' | 'yaml' | 'jsonxml' | 'csv' | 'curl' | 'url' | 'headers' | 'hash' | 'hmac' | 'cert' | 'uuid' | 'randstr' | 'mock'
type Diagnostic = { message: string; line: number; column: number; position: number }
type Match = { value: string; index: number }

function loadCache(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function saveCache(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* storage may be unavailable */ }
}

function usePersist<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    const raw = loadCache(key)
    if (raw == null) return
    try {
      const parsed = JSON.parse(raw)
      setValue((typeof initial === 'string' ? raw : parsed) as T)
    } catch { setValue(raw as unknown as T) }
  }, [key])
  useEffect(() => {
    const stored = typeof value === 'string' ? value : JSON.stringify(value)
    saveCache(key, stored)
  }, [key, value])
  return [value, setValue]
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

const sampleJsonB = `{
  "transaction": {
    "id": "TRX-2024-00982",
    "status": "failed",
    "amount": 125500,
    "currency": "IDR",
    "customer": {
      "name": "Nadia Pratama",
      "email": "nadia@example.com"
    },
    "items": [
      { "sku": "ST-002", "name": "Studio Headphones", "qty": 2 }
    ]
  }
}`

const sampleXmlB = `<transaction><id>TRX-2024-00982</id><status>failed</status><amount currency="IDR">125500</amount><customer><name>Nadia Pratama</name><email>nadia@example.com</email></customer><items><item sku="ST-002" qty="2">Studio Headphones</item></items></transaction>`

const sampleJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJUUlgtMjAyNC0wMDk4MSIsIm5hbWUiOiJOYWRpYSBQcmF0YW1hIiwiaWF0IjoxNzI2NzE2ODAwfQ.A5FYhBjXuKBNhbMojljKKVHh9ovpi6EtrQ5n7SfQ8nE`
const sampleSql = `select t.id, t.amount, t.status from transactions t where t.status = 'success' and t.amount > 1000 order by t.created_at desc;`
const samplePlsql = `declare v_total number; begin select sum(amount) into v_total from transactions; if v_total > 0 then dbms_output.put_line('Total: ' || v_total); else dbms_output.put_line('No rows'); end if; end;`

const sampleYaml = `transaction:
  id: TRX-2024-00981
  status: success
  amount: 125000
  currency: IDR
  customer:
    name: Nadia Pratama
    email: nadia@example.com`

const sampleMockTemplate = `{
  "id": "@uuid",
  "name": "@name",
  "email": "@email",
  "city": "@city",
  "active": "@bool",
  "amount": "@number",
  "createdAt": "@date",
  "contacts": ["@email", "@city", "@name"],
  "scores": [3, "@number"]
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

const SQL_KEYWORDS = ['SELECT','FROM','WHERE','INSERT','INTO','VALUES','SET','UPDATE','DELETE','CREATE','ALTER','DROP','TABLE','VIEW','INDEX','AS','AND','OR','NOT','NULL','IS','IN','BETWEEN','LIKE','EXISTS','JOIN','INNER','LEFT','RIGHT','FULL','OUTER','CROSS','ON','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','DISTINCT','UNION','ALL','CASE','WHEN','THEN','ELSE','END','PRIMARY','FOREIGN','KEY','REFERENCES','DEFAULT','UNIQUE','CHECK','CONSTRAINT','COMMIT','ROLLBACK','BEGIN','TRANSACTION','GRANT','REVOKE','ASC','DESC','TYPE','INT','INTEGER','VARCHAR','CHAR','TEXT','DATE','DATETIME','TIMESTAMP','DECIMAL','NUMERIC','BOOLEAN','BIGINT','SMALLINT','FLOAT','DOUBLE','BLOB','CLOB','SERIAL','ADD','COLUMN','NUMBER']

const PLSQL_KEYWORDS = ['DECLARE','EXCEPTION','FUNCTION','PROCEDURE','PACKAGE','BODY','CURSOR','LOOP','FOR','WHILE','IF','ELSIF','THEN','RETURN','RAISE','TRIGGER','SEQUENCE','SYNONYM','PRAGMA','CONSTANT','OPEN','FETCH','CLOSE','GOTO','EXIT','CONTINUE','VARIABLE','EXECUTE','IMMEDIATE','TRUNCATE','MERGE','MATCHED','USING','RETURNING','RECORD','PLS_INTEGER','SUBTYPE','NUMBER']

function formatSql(source: string, plsql: boolean) {
  const keywords = new Set([...SQL_KEYWORDS, ...(plsql ? PLSQL_KEYWORDS : [])])
  if (!source.trim()) return ''
  const strings: string[] = []
  let mask = ''
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === "'" || ch === '"') {
      const quote = ch
      let end = i + 1
      while (end < source.length && source[end] !== quote) end += 1
      strings.push(source.slice(i, end + 1))
      mask += `\u0001${strings.length - 1}\u0001`
      i = end
    } else mask += ch
  }
  const tokens = mask.replace(/[();,]/g, ' $& ').split(/\s+/).filter(Boolean)
  const isStr = (t: string) => /^\u0001\d+\u0001$/.test(t)
  const resolve = (t: string) => t.replace(/\u0001(\d+)\u0001/g, (_m, n) => strings[+n] ?? _m)
  const block = new Set(['SELECT','INSERT','UPDATE','DELETE','REPLACE','INTO','VALUES','SET','FROM','WHERE','GROUP','HAVING','ORDER','UNION','RETURNING','USING','MATCHED','BEGIN','DECLARE','IF','ELSIF','ELSE','LOOP','WHILE','CASE','WHEN'])
  const joinKw = new Set(['INNER','LEFT','RIGHT','FULL','OUTER','CROSS','JOIN'])
  let depth = 0
  const parenStack: { sub: boolean }[] = []
  const out: string[] = []
  let cur = ''
  const addWord = (w: string) => { if (!cur.trim()) cur = w; else if (cur.endsWith('(') || cur.endsWith(' ')) cur += w; else cur += ' ' + w }
  const subCount = () => parenStack.filter(f => f.sub).length
  const emit = () => { const s = cur.trim(); if (s) out.push('  '.repeat(subCount()) + s); cur = '' }
  for (const raw of tokens) {
    const upper = raw.toUpperCase()
    const word = isStr(raw) ? resolve(raw) : keywords.has(upper) ? upper : resolve(raw)
    if (word === '(') {
      const isSub = /(?:IN|EXISTS|ANY|ALL)$/i.test(cur) || /\($/.test(cur.trimEnd())
      cur = cur.trimEnd() + (isSub ? ' ' : '') + '('
      parenStack.push({ sub: isSub })
      depth += 1
    } else if (word === ')') {
      cur = cur.trimEnd()
      const flag = parenStack.pop()
      depth = Math.max(0, depth - 1)
      if (flag?.sub) { emit(); out.push('  '.repeat(subCount()) + ')') } else cur += ')'
    } else if (word === ';') {
      if (cur.trim()) { cur = cur.trimEnd() + ';'; emit() } else { const last = out[out.length - 1]; if (last !== undefined) out[out.length - 1] = last.trimEnd() + ';' }
    } else if (word === ',') {
      if (depth === 0 && cur.trim()) emit(); else if (cur.trim()) cur = cur.trimEnd() + ', '
    } else if (word === 'END') {
      depth = Math.max(0, depth - 1); emit(); cur = 'END'
    } else if (block.has(word)) {
      const curUp = cur.trim().toUpperCase()
      if ((word === 'INTO' && curUp === 'INSERT') || (word === 'FROM' && curUp === 'DELETE')) addWord(word)
      else if (curUp === 'END' && (word === 'IF' || word === 'CASE' || word === 'LOOP')) addWord(word)
      else { emit(); cur = word }
    } else if (joinKw.has(word)) {
      if (cur.trim()) addWord(word)
    } else {
      addWord(word)
    }
  }
  emit()
  return out.join('\n')
}

function highlightSqlLines(source: string, plsql: boolean) {
  const keywords = new Set([...SQL_KEYWORDS, ...(plsql ? PLSQL_KEYWORDS : [])])
  const result: string[] = []
  let block = false
  for (const rawLine of source.split('\n')) {
    const line = rawLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    let html = ''
    let i = 0
    while (i < line.length) {
      if (block) {
        const end = line.indexOf('*/', i)
        if (end === -1) { html += `<span class="hl-comment">${line.slice(i)}</span>`; i = line.length; break }
        html += `<span class="hl-comment">${line.slice(i, end + 2)}</span>`
        i = end + 2
        block = false
        continue
      }
      const two = line.slice(i, i + 2)
      const ch = line[i]
      if (two === '--') {
        html += `<span class="hl-comment">${line.slice(i)}</span>`
        i = line.length
        break
      }
      if (two === '/*') {
        const end = line.indexOf('*/', i + 2)
        if (end === -1) {
          html += `<span class="hl-comment">${line.slice(i)}</span>`
          block = true
          i = line.length
          break
        }
        html += `<span class="hl-comment">${line.slice(i, end + 2)}</span>`
        i = end + 2
        continue
      }
      if (ch === "'" || ch === '"') {
        let j = i + 1
        while (j < line.length) {
          if (line[j] === ch) { if (line[j + 1] === ch) { j += 2; continue } break }
          j += 1
        }
        const end = j < line.length ? j + 1 : line.length
        html += `<span class="hl-string">${line.slice(i, end)}</span>`
        i = end
        continue
      }
      if (/[A-Za-z0-9_$]/.test(ch)) {
        let j = i
        while (j < line.length && /[A-Za-z0-9_$#]/.test(line[j])) j += 1
        const token = line.slice(i, j)
        const up = token.toUpperCase()
        if (keywords.has(up)) {
          html += `<span class="${up === 'NULL' ? 'hl-null' : up === 'TRUE' || up === 'FALSE' ? 'hl-bool' : 'hl-key'}">${token}</span>`
        } else if (/^\d+(?:\.\d+)?$/.test(token)) {
          html += `<span class="hl-number">${token}</span>`
        } else {
          html += token
        }
        i = j
        continue
      }
      html += ch
      i += 1
    }
    result.push(html)
  }
  return result
}

function cleanText(text: string, mode: string) {
  if (!text) return { value: '', removed: 0 }
  const value = mode === 'all' ? text.replace(/\s+/g, '') : mode === 'breaks' ? text.replace(/[\r\n]+/g, '') : mode === 'spaces' ? text.replace(/[ \t]+/g, '') : text.replace(/\s+/g, ' ').trim()
  return { value, removed: text.length - value.length }
}

const cleanModes = [
  { id: 'all', label: 'Remove all whitespace' },
  { id: 'breaks', label: 'Remove newlines' },
  { id: 'spaces', label: 'Remove spaces & tabs' },
  { id: 'collapse', label: 'Collapse whitespace' },
]

function compareText(a: string, b: string) {
  if (a === b) return { equal: true, lenA: a.length, lenB: b.length }
  const len = Math.min(a.length, b.length)
  let i = 0
  while (i < len && a[i] === b[i]) i += 1
  const beforeA = a.slice(0, i)
  const beforeB = b.slice(0, i)
  return { equal: false, index: i, lenA: a.length, lenB: b.length, prefix: i, lineA: beforeA.split('\n').length, colA: i - beforeA.lastIndexOf('\n'), lineB: beforeB.split('\n').length, colB: i - beforeB.lastIndexOf('\n'), nextA: a.slice(i, i + 45), nextB: b.slice(i, i + 45) }
}

type DiffSeg = { text: string; type: 'eq' | 'add' | 'del' }

function charDiff(a: string, b: string): DiffSeg[] {
  if (a === b) return [{ text: a, type: 'eq' }]
  const n = a.length; const m = b.length
  const max = Math.max(n, m)
  const limit = Math.min(max, 2000)
  if (limit < max) { const shortA = a.slice(0, limit); const shortB = b.slice(0, limit); return [...charDiff(shortA, shortB), { text: `… (${max - limit} chars truncated)`, type: 'eq' }] }
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const ops: DiffSeg[] = []; let i = n; let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { const ch = a[i - 1]; const last = ops[ops.length - 1]; if (last?.type === 'eq') last.text = ch + last.text; else ops.push({ text: ch, type: 'eq' }); i--; j-- }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { const ch = b[j - 1]; const last = ops[ops.length - 1]; if (last?.type === 'add') last.text = ch + last.text; else ops.push({ text: ch, type: 'add' }); j-- }
    else { const ch = a[i - 1]; const last = ops[ops.length - 1]; if (last?.type === 'del') last.text = ch + last.text; else ops.push({ text: ch, type: 'del' }); i-- }
  }
  return ops.reverse()
}

function diffHtml(a: string, b: string): { htmlA: string; htmlB: string } {
  const segments = charDiff(a, b)
  let htmlA = ''; let htmlB = ''
  for (const seg of segments) {
    const escaped = seg.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '↵')
    if (seg.type === 'eq') { htmlA += escaped; htmlB += escaped }
    else if (seg.type === 'del') { htmlA += `<span class="diff-del">${escaped}</span>` }
    else { htmlB += `<span class="diff-ins">${escaped}</span>` }
  }
  return { htmlA, htmlB }
}

function jsonToTs(source: string): string {
  const parsed = JSON.parse(source)
  const map = new Map<object, string>(); const queue: [object, string][] = []
  let isRoot = true
  const nameOf = (o: object) => { const existing = map.get(o); if (existing) return existing; const name = isRoot ? (isRoot = false, 'Root') : `Type${map.size}`; map.set(o, name); queue.push([o, name]); return name }
  const typeRef = (v: any): string => {
    if (v === null) return 'null'
    if (Array.isArray(v)) return `${v.length ? typeRef(v[0]) : 'unknown'}[]`
    if (typeof v === 'object') return nameOf(v)
    if (typeof v === 'boolean') return 'boolean'
    if (typeof v === 'number') return 'number'
    return 'string'
  }
  const walk = (v: any) => { if (Array.isArray(v)) { v.forEach(walk); return } if (v && typeof v === 'object') { nameOf(v); Object.values(v).forEach(walk) } }
  walk(parsed)
  const ident = (s: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s) ? s : JSON.stringify(s)
  const out: string[] = []
  for (const [obj, name] of queue) {
    const lines = Object.entries(obj).map(([k, v]) => `  ${ident(k)}${v === null ? '?' : ''}: ${typeRef(v)};`)
    out.push(`export interface ${name} {\n${lines.join('\n')}\n}`)
  }
  return out.join('\n\n')
}

function jsonToJava(source: string): string {
  const parsed = JSON.parse(source)
  const map = new Map<object, string>(); const queue: [object, string][] = []
  let isRoot = true
  const nameOf = (o: object) => { const existing = map.get(o); if (existing) return existing; const name = isRoot ? (isRoot = false, 'Root') : `Type${map.size}`; map.set(o, name); queue.push([o, name]); return name }
  const typeRef = (v: any): string => {
    if (v === null) return 'Object'
    if (Array.isArray(v)) return `List<${v.length ? typeRef(v[0]) : 'Object'}>`
    if (typeof v === 'object') return nameOf(v)
    if (typeof v === 'boolean') return 'boolean'
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'double'
    return 'String'
  }
  const walk = (v: any) => { if (Array.isArray(v)) { v.forEach(walk); return } if (v && typeof v === 'object') { nameOf(v); Object.values(v).forEach(walk) } }
  walk(parsed)
  const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s
  const boxed = (t: string) => t === 'int' ? 'Integer' : t === 'double' ? 'Double' : t === 'boolean' ? 'Boolean' : t
  const out: string[] = []
  for (const [obj, name] of queue) {
    const fields = Object.entries(obj).map(([k, v]) => {
      const t = typeRef(v)
      return `    private ${t} ${k};\n\n    public ${boxed(t)} get${cap(k)}() { return ${k}; }\n\n    public void set${cap(k)}(${t} ${k}) { this.${k} = ${k}; }`
    })
    out.push(`import java.util.List;\n\npublic class ${name} {\n${fields.join('\n\n')}\n}`)
  }
  return out.join('\n\n')
}

function jsonToKt(source: string): string {
  const parsed = JSON.parse(source)
  const map = new Map<object, string>(); const queue: [object, string][] = []
  let isRoot = true
  const nameOf = (o: object) => { const existing = map.get(o); if (existing) return existing; const name = isRoot ? (isRoot = false, 'Root') : `Type${map.size}`; map.set(o, name); queue.push([o, name]); return name }
  const typeRef = (v: any): string => {
    if (v === null) return 'Any?'
    if (Array.isArray(v)) return `List<${v.length ? typeRef(v[0]) : 'Any'}>`
    if (typeof v === 'object') return nameOf(v)
    if (typeof v === 'boolean') return 'Boolean'
    if (typeof v === 'number') return Number.isInteger(v) ? 'Int' : 'Double'
    return 'String'
  }
  const walk = (v: any) => { if (Array.isArray(v)) { v.forEach(walk); return } if (v && typeof v === 'object') { nameOf(v); Object.values(v).forEach(walk) } }
  walk(parsed)
  const ident = (s: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) ? s : `\`${s}\``
  const out: string[] = []
  for (const [obj, name] of queue) {
    const lines = Object.entries(obj).map(([k, v]) => `    val ${ident(k)}: ${typeRef(v)}`)
    out.push(`data class ${name}(\n${lines.join(',\n')}\n)`)
  }
  return out.join('\n\n')
}

function yamlKey(k: string) { return /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(k) ? k : JSON.stringify(k) }
function yamlScalar(v: string) { const t = v.trim(); if (!t) return "''"; if (/^[A-Za-z0-9_][A-Za-z0-9_ .:/-]*$/.test(t) && !['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~'].includes(t.toLowerCase())) return t; return JSON.stringify(v) }
function yamlInline(v: any): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return yamlScalar(v)
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) return `[${v.map(yamlInline).join(', ')}]`
  return '{}'
}
function toYaml(value: any): string {
  const rows = (v: any, depth: number): string[] => {
    const pad = '  '.repeat(depth)
    if (v === null) return [`${pad}null`]
    if (typeof v === 'string') return [`${pad}${yamlScalar(v)}`]
    if (typeof v === 'number') return [`${pad}${String(v)}`]
    if (typeof v === 'boolean') return [`${pad}${v ? 'true' : 'false'}`]
    if (Array.isArray(v)) {
      if (!v.length) return [`${pad}[]`]
      const out: string[] = []
      v.forEach(item => {
        if (item !== null && typeof item === 'object') {
          const entries = Object.entries(item); const [k0, v0] = entries[0] ?? [undefined, undefined]
          if (k0 === undefined) { out.push(`${pad}- {}`); return }
          if (v0 !== null && typeof v0 === 'object') { out.push(`${pad}- ${yamlKey(k0)}:`); rows(v0, depth + 2).forEach(l => out.push(l)) }
          else out.push(`${pad}- ${yamlKey(k0)}: ${yamlInline(v0)}`)
          entries.slice(1).forEach(([k, val]) => {
            if (val !== null && typeof val === 'object') { out.push(`${pad}  ${yamlKey(k)}:`); rows(val, depth + 2).forEach(l => out.push(l)) }
            else out.push(`${pad}  ${yamlKey(k)}: ${yamlInline(val)}`)
          })
        } else out.push(`${pad}- ${yamlInline(item)}`)
      })
      return out
    }
    const entries = Object.entries(v)
    if (!entries.length) return [`${pad}{}`]
    const out: string[] = []
    entries.forEach(([k, val]) => {
      if (val !== null && typeof val === 'object') { out.push(`${pad}${yamlKey(k)}:`); rows(val, depth + 1).forEach(l => out.push(l)) }
      else out.push(`${pad}${yamlKey(k)}: ${yamlInline(val)}`)
    })
    return out
  }
  return rows(value, 0).join('\n')
}

function parseYaml(source: string): any {
  const lines = source.split('\n').filter(l => { const t = l.trim(); return t !== '' && !t.startsWith('#') })
  let index = 0
  const ind = (l: string) => l.length - l.trimStart().length
  const scalar = (t: string): any => {
    const s = t.trim()
    if (!s) return ''
    if (s === 'null' || s === '~') return null
    if (s === 'true') return true
    if (s === 'false') return false
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
    if (s.startsWith('"') && s.endsWith('"') && s.length > 1) return s.slice(1, -1)
    if (s.startsWith("'") && s.endsWith("'") && s.length > 1) return s.slice(1, -1)
    if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).split(',').map(x => scalar(x)).filter(x => x !== '')
    return s
  }
  const node = (min: number): any => {
    const line = lines[index]
    if (!line || ind(line) < min) return null
    const start = ind(line)
    if (line.trim().startsWith('-')) {
      const arr: any[] = []
      while (index < lines.length) {
        const l = lines[index]
        if (ind(l) < start) break
        if (ind(l) === start && l.trim().startsWith('-')) {
          const rest = l.trim().slice(1).trim()
          index++
          if (rest) {
            const ci = rest.indexOf(':')
            if (ci > 0) {
              const k = scalar(rest.slice(0, ci).trim()); const v = rest.slice(ci + 1).trim()
              const obj: any = {}
              if (v) obj[k] = scalar(v)
              else if (index < lines.length && ind(lines[index]) > start) obj[k] = node(start + 2)
              else obj[k] = ''
              arr.push(obj)
            } else arr.push(scalar(rest))
          } else arr.push(node(start + 1))
        } else index++
      }
      return arr
    }
    const ci = line.indexOf(':')
    if (ci > 0) {
      const obj: any = {}
      const depth = start
      while (index < lines.length) {
        const l = lines[index]
        if (ind(l) < depth) break
        if (ind(l) !== depth) { index++; continue }
        const t = l.trim()
        if (t.startsWith('-') || !t.includes(':')) { index++; continue }
        const sep = t.indexOf(':')
        const k = scalar(t.slice(0, sep).trim()); const v = t.slice(sep + 1).trim()
        index++
        if (v) obj[k] = scalar(v)
        else if (index < lines.length && ind(lines[index]) > depth) obj[k] = node(depth + 1)
        else obj[k] = ''
      }
      return obj
    }
    index++
    return scalar(line)
  }
  return node(0)
}

function escapeXml(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function jsonToXmlString(value: any, name: string): string {
  const attrs = value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value).filter(([k]) => k.startsWith('@')).map(([k, v]) => ` ${k.slice(1)}="${escapeXml(String(v))}"`).join('') : ''
  if (value === null) return `<${name}${attrs}/>`
  if (Array.isArray(value)) return value.map(item => item && typeof item === 'object' && !Array.isArray(item) ? Object.entries(item).filter(([k]) => !k.startsWith('@') && k !== '#text').map(([k, v]) => jsonToXmlString(v, k)).join('') : `<${name}${attrs}>${escapeXml(String(item))}</${name}>`).join('')
  if (typeof value === 'object') {
    const text = value['#text']
    const inner = Object.entries(value).filter(([k]) => !k.startsWith('@') && k !== '#text').map(([k, v]) => jsonToXmlString(v, k)).join('')
    if (text != null && text !== '') {
      if (inner) return `<${name}${attrs}>${escapeXml(String(text))}${inner}</${name}>`
      return `<${name}${attrs}>${escapeXml(String(text))}</${name}>`
    }
    if (inner) return `<${name}${attrs}>${inner}</${name}>`
    return `<${name}${attrs}/>`
  }
  return `<${name}${attrs}>${escapeXml(String(value))}</${name}>`
}

function jsonToCsv(source: string): string {
  const data = JSON.parse(source)
  const rows = Array.isArray(data) ? data : [data]
  if (!rows.length) return ''
  const keys = Array.from(new Set(rows.flatMap(r => r && typeof r === 'object' ? Object.keys(r) : [])))
  if (!keys.length) return ''
  const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return [keys.join(','), ...rows.map(r => keys.map(k => esc((r as Record<string, unknown>)[k])).join(','))].join('\n')
}
function csvLine(text: string): string[] {
  const out: string[] = []; let cur = ''; let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false } else cur += ch }
    else if (ch === '"') inQ = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}
function csvToJson(source: string): string {
  const lines = source.split('\n').filter(l => l.trim())
  if (!lines.length) return ''
  const header = csvLine(lines[0]).map(h => h.trim())
  const rows = lines.slice(1).map(line => { const cells = csvLine(line); const obj: Record<string, string> = {}; header.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim() }); return obj })
  return JSON.stringify(rows, null, 2)
}

function buildCurl(method: string, url: string, headersText: string, body: string): string {
  const parts = [`curl --request ${method.toUpperCase()}`]
  if (url) parts.push(`--url "${url}"`)
  headersText.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const sep = line.indexOf(':')
    if (sep > 0) parts.push(`--header "${line.slice(0, sep).trim()}: ${line.slice(sep + 1).trim()}"`)
  })
  if (body) parts.push(`--data-raw '${body.replace(/'/g, "'\\''")}'`)
  return parts.join(' \\\n  ')
}

function parseUrl(url: string): { parts: { label: string; value: string }[]; error: string } {
  try {
    const u = new URL(url)
    const parts: { label: string; value: string }[] = [
      { label: 'Protocol', value: u.protocol.replace(':', '') },
      { label: 'Host', value: u.hostname },
      { label: 'Port', value: u.port || '(default)' },
      { label: 'Path', value: u.pathname },
      { label: 'Hash', value: u.hash.replace(/^#/, '') || '(none)' },
    ]
    const query = Array.from(u.searchParams.entries())
    if (query.length) parts.push({ label: 'Query', value: query.map(([k, v]) => `${k} = ${v}`).join('\n') })
    return { parts, error: '' }
  } catch {
    return { parts: [], error: 'Invalid URL' }
  }
}

function parseHeadersText(text: string): { key: string; value: string }[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf(':'); return i > 0 ? { key: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { key: l, value: '' } })
}

const HASH_ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
async function hashText(text: string, algo: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}
async function hmacText(text: string, secret: string, algo: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: algo }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('')
}

const OID_LABEL: Record<string, string> = { '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.8': 'ST', '2.5.4.7': 'L', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber', '1.2.840.113549.1.9.1': 'emailAddress', '2.5.4.42': 'GN', '2.5.4.4': 'SN' }
function parseCert(pem: string): { subject: string; issuer: string; notBefore: string; notAfter: string; serial: string; error: string } {
  const empty = { subject: '', issuer: '', notBefore: '', notAfter: '', serial: '', error: '' }
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  if (!body) return { ...empty, error: 'No PEM data found — paste a certificate (BEGIN CERTIFICATE)' }
  let bytes: Uint8Array
  try { bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0)) } catch { return { ...empty, error: 'Invalid Base64 in PEM body' } }
  const rd = (off: number): { tag: number; length: number; start: number; end: number } => {
    const tag = bytes[off]; let p = off + 1
    const lenByte = bytes[p]; p++
    let length = 0
    if (lenByte & 0x80) { const n = lenByte & 0x7f; for (let i = 0; i < n; i++) { length = length * 256 + bytes[p + i] } p += n } else length = lenByte
    return { tag, length, start: p, end: p + length }
  }
  const children = (node: { start: number; end: number }) => {
    const out: { tag: number; length: number; start: number; end: number }[] = []
    let off = node.start
    while (off < node.end) { const n = rd(off); out.push(n); off = n.end }
    return out
  }
  const content = (n: { start: number; length: number }) => bytes.subarray(n.start, n.start + n.length)
  const oidString = (n: { start: number; length: number }) => {
    const b = content(n)
    if (!b.length) return '?'
    let oid = `${Math.floor(b[0] / 40)}.${b[0] % 40}`; let v = 0
    for (let i = 1; i < b.length; i++) { v = v * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { oid += '.' + v; v = 0 } }
    return oid
  }
  const strVal = (n: { start: number; length: number }) => { try { return new TextDecoder().decode(content(n)) } catch { return '' } }
  const nameString = (seq: { start: number; end: number } | undefined) => {
    if (!seq) return ''
    return children(seq).map(set => {
      const pair = children(set)[0]
      if (!pair) return ''
      const parts = children(pair)
      if (parts.length < 2) return ''
      return `${OID_LABEL[oidString(parts[0])] ?? oidString(parts[0])}=${strVal(parts[1])}`
    }).join(', ')
  }
  const fixTime = (s: string) => s.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(Z)?$/, (_m, yy, MM, dd, hh, mm, ss) => `20${yy}-${MM}-${dd} ${hh}:${mm}:${ss} UTC`)
  try {
    const root = rd(0)
    const rootKids = children(root)
    if (rootKids.length < 3) return { ...empty, error: 'Not a valid X.509 certificate (expected 3 top-level elements)' }
    const tbs = children(rootKids[0])
    if (tbs.length < 6) return { ...empty, error: 'Unsupported certificate structure (need version 3)' }
    return {
      subject: nameString(tbs[5]),
      issuer: nameString(tbs[3]),
      notBefore: fixTime(strVal(children(tbs[4])[0])),
      notAfter: fixTime(strVal(children(tbs[4])[1])),
      serial: Array.from(content(tbs[1])).map(b => b.toString(16).padStart(2, '0')).join(''),
      error: '',
    }
  } catch { return { ...empty, error: 'Failed to parse certificate' } }
}

function uuidV4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}
function uuids(count: number): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(uuidV4())
  return out.join('\n')
}

const RS_SETS: { id: string; label: string; chars: string }[] = [
  { id: 'lower', label: 'a-z', chars: 'abcdefghijklmnopqrstuvwxyz' },
  { id: 'upper', label: 'A-Z', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { id: 'digits', label: '0-9', chars: '0123456789' },
  { id: 'symbols', label: '!@#$', chars: '!@#$%^&*()_+-=[]{}|;:,.<>?' },
]
function randomStrings(length: number, count: number, opts: string): string {
  let chars = ''
  const active = opts.split(',').filter(Boolean)
  RS_SETS.forEach(set => { if (active.includes(set.id)) chars += set.chars })
  if (!chars) return 'Select at least one character set'
  const out: string[] = []
  for (let n = 0; n < Math.max(1, count); n++) { let s = ''; for (let i = 0; i < Math.max(1, length); i++) s += chars[Math.floor(Math.random() * chars.length)]; out.push(s) }
  return out.join('\n')
}

const MOCK_POOL: Record<string, () => any> = {
  '@name': () => ['Nadia Pratama', 'Rizki Abimanyu', 'Ayu Lestari', 'Bagas Saputra', 'Siti Rahma', 'Dimas Anggara'][Math.floor(Math.random() * 6)],
  '@email': () => `user${Math.floor(Math.random() * 9000 + 1000)}@example.com`,
  '@uuid': () => uuidV4(),
  '@number': () => Math.floor(Math.random() * 1000),
  '@bool': () => Math.random() > 0.5,
  '@date': () => new Date(Date.now() - Math.floor(Math.random() * 3e10)).toISOString(),
  '@city': () => ['Bandung', 'Jakarta', 'Surabaya', 'Yogyakarta', 'Denpasar'][Math.floor(Math.random() * 5)],
}
function mockFill(value: any): any {
  if (typeof value === 'string') { const f = MOCK_POOL[value]; return f ? f() : value }
  if (Array.isArray(value)) {
    if (!value.length) return []
    if (typeof value[0] === 'number' && value.length === 2) { const out: any[] = []; for (let i = 0; i < value[0]; i++) out.push(mockFill(value[1])); return out }
    return value.map(v => mockFill(v))
  }
  if (value && typeof value === 'object') { const o: Record<string, any> = {}; Object.entries(value).forEach(([k, v]) => { o[k] = mockFill(v) }); return o }
  return value
}

const tsPresets = [
  { label: 'yyyy-MM-dd HH:mm:ss', value: 'yyyy-MM-dd HH:mm:ss' },
  { label: 'yyyy-MM-dd HH:mm', value: 'yyyy-MM-dd HH:mm' },
  { label: 'yyyy-MM-dd', value: 'yyyy-MM-dd' },
  { label: 'dd/MM/yyyy HH:mm:ss', value: 'dd/MM/yyyy HH:mm:ss' },
  { label: 'HH:mm:ss', value: 'HH:mm:ss' },
  { label: 'hh:mm:ss aa', value: 'hh:mm:ss aa' },
  { label: 'ISO 8601', value: 'ISO' },
]

const pad2 = (n: number) => String(n).padStart(2, '0')

function formatTimestamp(date: Date, pattern: string) {
  if (pattern === 'ISO') return date.toISOString()
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    MM: pad2(date.getMonth() + 1),
    dd: pad2(date.getDate()),
    HH: pad2(date.getHours()),
    hh: pad2(date.getHours() % 12 || 12),
    mm: pad2(date.getMinutes()),
    ss: pad2(date.getSeconds()),
    SSS: String(date.getMilliseconds()).padStart(3, '0'),
    aa: date.getHours() < 12 ? 'AM' : 'PM',
  }
  let out = pattern
  Object.entries(tokens).forEach(([key, value]) => { out = out.split(key).join(value) })
  return out
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

function xmlToJsonSource(source: string): string {
  const tree = parseXmlTree(source)
  if (!tree) throw new Error('Invalid XML')
  return JSON.stringify({ [tree.name]: tree.value }, null, 2)
}

const GROUPS: { name: string; ids: Tool[] }[] = [
  { name: 'FORMAT', ids: ['formatter', 'base64', 'sql', 'plsql'] },
  { name: 'TEXT', ids: ['regex', 'clean', 'timestamp', 'compare'] },
  { name: 'COMPARE', ids: ['jsondiff', 'xmldiff'] },
  { name: 'CONVERT', ids: ['j2ts', 'j2java', 'j2kt', 'yaml', 'jsonxml', 'csv'] },
  { name: 'API', ids: ['curl', 'url', 'headers'] },
  { name: 'SECURITY', ids: ['jwt', 'hash', 'hmac', 'cert'] },
  { name: 'GENERATE', ids: ['uuid', 'randstr', 'mock'] },
]
const ALL_TOOLS: Tool[] = GROUPS.flatMap(g => g.ids)

const TOOLS: Record<Tool, { label: string; title: string; desc: string; icon: ReactNode }> = {
  formatter: { label: 'JSON/XML', title: 'JSON & XML Formatter', desc: 'Beautify, minify and inspect JSON or XML', icon: <Code2 size={16} /> },
  base64: { label: 'Base64', title: 'Base64 Encoder / Decoder', desc: 'Encode or decode text to and from Base64', icon: <Binary size={16} /> },
  sql: { label: 'SQL', title: 'SQL Formatter', desc: 'Beautify and syntax-highlight SQL queries', icon: <Database size={16} /> },
  plsql: { label: 'PL/SQL', title: 'PL/SQL Formatter', desc: 'Beautify and syntax-highlight PL/SQL blocks', icon: <Database size={16} /> },
  regex: { label: 'Regex', title: 'Regex Tester', desc: 'Test and debug regular expressions live', icon: <Braces size={16} /> },
  clean: { label: 'Clean text', title: 'Clean Text', desc: 'Remove whitespace and newlines from text', icon: <Scissors size={16} /> },
  timestamp: { label: 'Timestamp', title: 'Timestamp Generator', desc: 'Generate timestamps in common formats', icon: <Clock size={16} /> },
  compare: { label: 'String compare', title: 'String Compare', desc: 'Compare two strings with a character-level diff', icon: <FileText size={16} /> },
  jsondiff: { label: 'JSON Diff', title: 'JSON Diff', desc: 'Compare two JSON documents side by side', icon: <FileDiff size={16} /> },
  xmldiff: { label: 'XML Diff', title: 'XML Diff', desc: 'Compare two XML documents side by side', icon: <FileDiff size={16} /> },
  j2ts: { label: 'JSON → TS', title: 'JSON → TypeScript', desc: 'Generate TypeScript interfaces from JSON', icon: <Code2 size={16} /> },
  j2java: { label: 'JSON → Java', title: 'JSON → Java', desc: 'Generate Java POJO classes from JSON', icon: <Coffee size={16} /> },
  j2kt: { label: 'JSON → Kotlin', title: 'JSON → Kotlin', desc: 'Generate Kotlin data classes from JSON', icon: <Code2 size={16} /> },
  yaml: { label: 'JSON ↔ YAML', title: 'JSON ↔ YAML', desc: 'Convert between JSON and YAML', icon: <ArrowLeftRight size={16} /> },
  jsonxml: { label: 'JSON ↔ XML', title: 'JSON ↔ XML', desc: 'Convert between JSON and XML', icon: <ArrowLeftRight size={16} /> },
  csv: { label: 'JSON ↔ CSV', title: 'JSON ↔ CSV', desc: 'Convert between JSON and CSV', icon: <Table size={16} /> },
  curl: { label: 'cURL', title: 'cURL Builder', desc: 'Generate cURL commands from request fields', icon: <Terminal size={16} /> },
  url: { label: 'URL', title: 'URL Tool', desc: 'Parse, encode and decode URLs', icon: <Link size={16} /> },
  headers: { label: 'Headers', title: 'HTTP Headers', desc: 'Parse and format HTTP headers', icon: <List size={16} /> },
  jwt: { label: 'JWT decoder', title: 'JWT Decoder', desc: 'Decode JWT header, payload and signature', icon: <KeyRound size={16} /> },
  hash: { label: 'Hash', title: 'Hash Generator', desc: 'Compute SHA-1, SHA-256, SHA-384 or SHA-512', icon: <Hash size={16} /> },
  hmac: { label: 'HMAC', title: 'HMAC Signer', desc: 'HMAC-sign text with a secret key', icon: <KeyRound size={16} /> },
  cert: { label: 'Certificate', title: 'Certificate Inspector', desc: 'Inspect the fields of an X.509 certificate', icon: <ShieldCheck size={16} /> },
  uuid: { label: 'UUID', title: 'UUID Generator', desc: 'Generate UUID v4 identifiers', icon: <Dices size={16} /> },
  randstr: { label: 'Random string', title: 'Random String Generator', desc: 'Generate random strings from charsets', icon: <Dices size={16} /> },
  mock: { label: 'Mock JSON', title: 'Mock JSON Generator', desc: 'Generate mock JSON data from a schema', icon: <Boxes size={16} /> },
}

function AppTool({ theme, setTheme, tool, onSelectTool, children }: { theme: 'light' | 'dark'; setTheme: (value: 'light' | 'dark') => void; tool: Tool; onSelectTool: (value: Tool) => void; children: ReactNode }) {
  return <main className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}><nav className="topbar"><div className="brand"><span className="brand-mark">T</span><span>Tinker</span></div><div className="topbar-tools"><span className="tool-name">{TOOLS[tool].label}</span><span className="topbar-divider" /><button className="theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button><div className="avatar">D</div></div></nav><div className="workspace"><aside className="sidebar"><div className="sidebar-label">TOOLS</div>{GROUPS.map(group => <div key={group.name}><div className="sidebar-label group-label">{group.name}</div>{group.ids.map(id => <button key={id} className={`tool-item ${tool === id ? 'active' : ''}`} onClick={() => onSelectTool(id)}>{TOOLS[id].icon}<span>{TOOLS[id].label}</span></button>)}</div>)}</aside><section className="content">{children}</section></div></main>
}

function ToolHead({ title, desc, children }: { title: string; desc: string; children?: ReactNode }) {
  return <div className="content-head"><div><h1>{title}</h1>{desc && <div className="tool-desc">{desc}</div>}</div>{children && <div className="content-head-actions">{children}</div>}</div>
}

function ToolBar({ action, icon, onAction, clear, onClear, output, children }: { action?: string; icon?: ReactNode; onAction?: () => void; clear?: string; onClear?: () => void; output: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const bytes = new TextEncoder().encode(output).length
  const lines = output ? output.split('\n').length : 0
  const doCopy = async () => { if (!output) return; await navigator.clipboard?.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1200) }
  const doDownload = () => { if (!output) return; const blob = new Blob([output], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'tinker-output.txt'; a.click(); URL.revokeObjectURL(url) }
  return <div className="toolbar">{onAction && action && <button className="primary-button" onClick={onAction}>{icon}{action}</button>}{children}{clear && onClear && <button className="outline-button" onClick={onClear}><RotateCcw size={14} /> {clear}</button>}<div className="toolbar-spacer" /><button className="outline-button" onClick={doCopy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button><button className="outline-button" onClick={doDownload}><Download size={14} /> Download</button><span className="meta-text">Lines: {lines} · Size: {bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`}</span></div>
}

function IoPanel({ icon, title, label, value, onChange, onClear, placeholder, actions }: { icon: ReactNode; title: string; label?: string; value: string; onChange: (v: string) => void; onClear: () => void; placeholder?: string; actions?: ReactNode }) {
  return <section className="panel"><div className="panel-head"><div className="panel-title">{icon}<h2>{title}</h2>{label && <span className="format-label">{label}</span>}</div><div className="panel-actions">{actions}<button className="quiet-button" onClick={onClear} aria-label={`Clear ${title}`}><RotateCcw size={14} /></button></div></div><div className="plain-editor-wrap"><textarea className="plain-editor" spellCheck={false} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={title} /></div><div className="panel-foot"><span className="meta-text">{value.length} characters</span></div></section>
}

function OutPanel({ icon, title, label, foot, children, style, className }: { icon: ReactNode; title: string; label?: string; foot?: ReactNode; children: ReactNode; style?: CSSProperties; className?: string }) {
  return <section className={`panel ${className ?? ''}`} style={style}><div className="panel-head"><div className="panel-title">{icon}<h2>{title}</h2>{label && <span className="format-label">{label}</span>}</div></div><div className="result-body">{children}</div>{foot ? <div className="panel-foot">{foot}</div> : null}</section>
}

function TreeNode({ name, value, depth = 0 }: { name: string; value: any; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const branch = value && typeof value === 'object'
  const entries = branch ? Object.entries(value) : []
  return <div className="tree-node" style={{ marginLeft: depth * 16 }}><div className="tree-line" onClick={() => branch && setOpen(!open)}>{branch ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="tree-dot" />}<span className="key">{name}</span>{branch && <span className="muted">{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</span>}{!branch && <><span className="colon">:</span><span className={typeof value === 'number' ? 'number' : value === null ? 'null' : 'string'}>{typeof value === 'string' ? `"${value}"` : String(value)}</span></>}</div>{branch && open && entries.map(([key, child]) => <TreeNode key={key} name={Array.isArray(value) ? String(key) : key} value={child} depth={depth + 1} />)}</div>
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
  const [base64Mode, setBase64Mode] = usePersist<'encode' | 'decode'>('tinker:b64mode', 'encode')
  const [base64Input, setBase64Input] = usePersist('tinker:b64input', 'Hello, Tinker')
  const [base64Copied, setBase64Copied] = useState(false)
  const [jwtInput, setJwtInput] = usePersist('tinker:jwt', sampleJwt)
  const [jwtCopied, setJwtCopied] = useState(false)
  const [regexPattern, setRegexPattern] = usePersist('tinker:regexpattern', '\\b(TRX|ST)-\\d+\\b|\\b\\d{4,}\\b')
  const [regexFlags, setRegexFlags] = usePersist('tinker:regexflags', 'g')
  const [regexText, setRegexText] = usePersist('tinker:regextext', 'Order TRX-2024-001 and ST-1001 shipped. Total 125000 IDR.\nReferensi: TRX-2024-00812')
  const [cmpA, setCmpA] = usePersist('tinker:cmpA', sampleJson)
  const [cmpB, setCmpB] = usePersist('tinker:cmpB', sampleXml)
  const [cleanInput, setCleanInput] = usePersist('tinker:cleaninput', '')
  const [cleanMode, setCleanMode] = usePersist('tinker:cleanmode', 'all')
  const [cleanCopied, setCleanCopied] = useState(false)
  const [tsDate, setTsDate] = usePersist('tinker:tsdate', '')
  const [tsTime, setTsTime] = usePersist('tinker:tstime', '')
  const [tsPattern, setTsPattern] = usePersist('tinker:tspattern', 'yyyy-MM-dd HH:mm:ss')
  const [tsCopied, setTsCopied] = useState(false)
  const [sqlInput, setSqlInput] = usePersist('tinker:sqlinput', sampleSql)
  const [sqlCopied, setSqlCopied] = useState(false)
  const [plSqlInput, setPlSqlInput] = usePersist('tinker:plsqlinput', samplePlsql)
  const [plCopied, setPlCopied] = useState(false)
  const [jdA, setJdA] = usePersist('tinker:jda', sampleJson)
  const [jdB, setJdB] = usePersist('tinker:jdb', sampleJsonB)
  const [xdA, setXdA] = usePersist('tinker:xda', sampleXml)
  const [xdB, setXdB] = usePersist('tinker:xdb', sampleXmlB)
  const [j2tsIn, setJ2tsIn] = usePersist('tinker:j2ts', sampleJson)
  const [j2javaIn, setJ2javaIn] = usePersist('tinker:j2java', sampleJson)
  const [j2ktIn, setJ2ktIn] = usePersist('tinker:j2kt', sampleJson)
  const [yamlIn, setYamlIn] = usePersist('tinker:yaml', sampleYaml)
  const [yamlMode, setYamlMode] = usePersist<'to' | 'from'>('tinker:yamlmode', 'to')
  const [jxmlIn, setJxmlIn] = usePersist('tinker:jxml', sampleJson)
  const [jxmlMode, setJxmlMode] = usePersist<'json' | 'xml'>('tinker:jxmlmode', 'json')
  const [csvIn, setCsvIn] = usePersist('tinker:csv', JSON.stringify([{ id: 1, name: 'Nadia', status: 'success' }, { id: 2, name: 'Rizki', status: 'failed' }], null, 2))
  const [csvMode, setCsvMode] = usePersist<'json' | 'csv'>('tinker:csvmode', 'json')
  const [curMethod, setCurMethod] = usePersist('tinker:curmethod', 'POST')
  const [curUrl, setCurUrl] = usePersist('tinker:cururl', 'https://api.example.com/v1/transactions')
  const [curHeaders, setCurHeaders] = usePersist('tinker:curheaders', 'Authorization: Bearer token\nContent-Type: application/json')
  const [curBody, setCurBody] = usePersist('tinker:curbody', JSON.stringify({ transactionId: 'TRX-2024-00981' }, null, 2))
  const [urlIn, setUrlIn] = usePersist('tinker:url', 'https://api.example.com/v2/orders?status=success&limit=25#summary')
  const [urlMode, setUrlMode] = usePersist<'parse' | 'encode' | 'decode'>('tinker:urlmode', 'parse')
  const [hdrsIn, setHdrsIn] = usePersist('tinker:headers', 'Authorization: Bearer token\nContent-Type: application/json\nX-Request-Id: 5f8d2c1e')
  const [hashInput, setHashInput] = usePersist('tinker:hashinput', 'The quick brown fox jumps over the lazy dog')
  const [hmacInput, setHmacInput] = usePersist('tinker:hmacinput', 'The quick brown fox jumps over the lazy dog')
  const [hmacSecret, setHmacSecret] = usePersist('tinker:hmacsecret', 'secret-key')
  const [hmacAlgo, setHmacAlgo] = usePersist('tinker:hmacalgo', 'SHA-256')
  const [certIn, setCertIn] = usePersist('tinker:cert', '')
  const [uuidCount, setUuidCount] = usePersist('tinker:uuidcount', 4)
  const [rsLength, setRsLength] = usePersist('tinker:rslen', '16')
  const [rsCount, setRsCount] = usePersist('tinker:rscount', '5')
  const [rsOpts, setRsOpts] = usePersist('tinker:rsopts', 'lower,upper,digits')
  const [mockIn, setMockIn] = usePersist('tinker:mockin', sampleMockTemplate)
  const [mockOut, setMockOut] = useState<string>(() => { try { return JSON.stringify(mockFill(JSON.parse(sampleMockTemplate)), null, 2) } catch { return '' } })
  const [uuidTick, setUuidTick] = useState(0)
  const [rsTick, setRsTick] = useState(0)

  useEffect(() => {
    const raw = loadCache('tinker:drafts')
    if (raw) { try { const parsed = JSON.parse(raw); setDrafts({ JSON: typeof parsed.JSON === 'string' ? parsed.JSON : sampleJson, XML: typeof parsed.XML === 'string' ? parsed.XML : sampleXml }) } catch { /* ignore */ } }
    if (loadCache('tinker:format') === 'XML') setFormat('XML')
    const toolCache = loadCache('tinker:tool')
    if (toolCache && (ALL_TOOLS as string[]).includes(toolCache)) setTool(toolCache as Tool)
    if (loadCache('tinker:theme') === 'light') setTheme('light')
  }, [])
  useEffect(() => saveCache('tinker:drafts', JSON.stringify(drafts)), [drafts])
  useEffect(() => saveCache('tinker:format', format), [format])
  useEffect(() => saveCache('tinker:tool', tool), [tool])
  useEffect(() => saveCache('tinker:theme', theme), [theme])

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
  const cleanOut = useMemo(() => cleanText(cleanInput, cleanMode), [cleanInput, cleanMode])
  const copyClean = async () => { await navigator.clipboard?.writeText(cleanOut.value); setCleanCopied(true); setTimeout(() => setCleanCopied(false), 1500) }
  const cmp = useMemo(() => compareText(cmpA, cmpB), [cmpA, cmpB])
  const diff = useMemo(() => cmp.equal ? null : diffHtml(cmpA, cmpB), [cmpA, cmpB, cmp.equal])
  const jdCmp = useMemo(() => compareText(jdA, jdB), [jdA, jdB])
  const jdDiff = useMemo(() => jdCmp.equal ? null : diffHtml(jdA, jdB), [jdA, jdB, jdCmp.equal])
  const xdCmp = useMemo(() => compareText(xdA, xdB), [xdA, xdB])
  const xdDiff = useMemo(() => xdCmp.equal ? null : diffHtml(xdA, xdB), [xdA, xdB, xdCmp.equal])
  const tsDateObj = useMemo(() => {
    const d = new Date()
    if (tsDate) d.setFullYear(Number(tsDate.slice(0, 4)), Number(tsDate.slice(5, 7)) - 1, Number(tsDate.slice(8, 10)))
    if (tsTime) { const parts = tsTime.split(':'); d.setHours(Number(parts[0]), Number(parts[1] || 0), 0, 0) }
    return d
  }, [tsDate, tsTime])
  const tsValue = useMemo(() => formatTimestamp(tsDateObj, tsPattern), [tsDateObj, tsPattern])
  const stampNow = () => { const d = new Date(); setTsDate(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`); setTsTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`) }
  const copyTs = async () => { await navigator.clipboard?.writeText(tsValue); setTsCopied(true); setTimeout(() => setTsCopied(false), 1500) }
  const sqlLines = useMemo(() => highlightSqlLines(sqlInput, false), [sqlInput])
  const plSqlLines = useMemo(() => highlightSqlLines(plSqlInput, true), [plSqlInput])
  const tsOut = useMemo(() => { try { return { value: jsonToTs(j2tsIn), error: '' } } catch (e) { return { value: '', error: e instanceof Error ? e.message : 'Invalid JSON' } } }, [j2tsIn])
  const javaOut = useMemo(() => { try { return { value: jsonToJava(j2javaIn), error: '' } } catch (e) { return { value: '', error: e instanceof Error ? e.message : 'Invalid JSON' } } }, [j2javaIn])
  const ktOut = useMemo(() => { try { return { value: jsonToKt(j2ktIn), error: '' } } catch (e) { return { value: '', error: e instanceof Error ? e.message : 'Invalid JSON' } } }, [j2ktIn])
  const yamlOut = useMemo(() => { try { return { value: yamlMode === 'to' ? toYaml(JSON.parse(yamlIn)) : (JSON.stringify(parseYaml(yamlIn), null, 2) ?? ''), error: '' } } catch (e) { return { value: '', error: e instanceof Error ? e.message : 'Conversion failed' } } }, [yamlIn, yamlMode])
  const jxmlOut = useMemo(() => { try { return { value: jxmlMode === 'json' ? jsonToXmlString(JSON.parse(jxmlIn), 'root') : xmlToJsonSource(jxmlIn), error: '' } } catch (e) { return { value: '', error: e instanceof Error ? e.message : 'Conversion failed' } } }, [jxmlIn, jxmlMode])
  const csvOut = useMemo(() => { try { return { value: csvMode === 'json' ? jsonToCsv(csvIn) : csvToJson(csvIn), error: '' } } catch (e) { return { value: '', error: e instanceof Error ? e.message : 'Conversion failed' } } }, [csvIn, csvMode])
  const curlOut = useMemo(() => buildCurl(curMethod, curUrl, curHeaders, curBody).trim(), [curMethod, curUrl, curHeaders, curBody])
  const urlRes = useMemo(() => parseUrl(urlIn), [urlIn])
  const urlTransformed = useMemo(() => { try { return urlMode === 'encode' ? encodeURIComponent(urlIn) : decodeURIComponent(urlIn) } catch { return '' } }, [urlIn, urlMode])
  const hdrs = useMemo(() => parseHeadersText(hdrsIn), [hdrsIn])
  const hdrsJson = useMemo(() => JSON.stringify(Object.fromEntries(hdrs.map(h => [h.key, h.value])), null, 2), [hdrs])
  const certInfo = useMemo(() => parseCert(certIn), [certIn])
  const uuidOut = useMemo(() => uuids(Number(uuidCount)), [uuidCount, uuidTick])
  const rndOut = useMemo(() => randomStrings(Number(rsLength), Number(rsCount), rsOpts), [rsLength, rsCount, rsOpts, rsTick])
  const genMock = () => { try { setMockOut(JSON.stringify(mockFill(JSON.parse(mockIn)), null, 2)) } catch { setMockOut('') } }

  const [hashAll, setHashAll] = useState<Record<string, string>>({})
  useEffect(() => { if (!hashInput) { setHashAll({}); return } let live = true; Promise.all(HASH_ALGOS.map(async a => [a, await hashText(hashInput, a)] as const)).then(rows => { if (live) setHashAll(Object.fromEntries(rows)) }).catch(() => { if (live) setHashAll({}) }); return () => { live = false } }, [hashInput])
  const [hmacOut, setHmacOut] = useState('')
  useEffect(() => { if (!hmacInput || !hmacSecret) { setHmacOut(''); return } let live = true; hmacText(hmacInput, hmacSecret, hmacAlgo).then(v => { if (live) setHmacOut(v) }).catch(() => { if (live) setHmacOut('') }); return () => { live = false } }, [hmacInput, hmacSecret, hmacAlgo])

  const renderSqlTool = (plsql: boolean) => {
    const val = plsql ? plSqlInput : sqlInput
    const update = (v: string) => plsql ? setPlSqlInput(v) : setSqlInput(v)
    const copiedFlag = plsql ? plCopied : sqlCopied
    const setCopiedFlag = plsql ? setPlCopied : setSqlCopied
    const copySql = async () => { await navigator.clipboard?.writeText(val); setCopiedFlag(true); setTimeout(() => setCopiedFlag(false), 1500) }
    const syncScroll = (e: UIEvent<HTMLTextAreaElement>) => { const t = e.currentTarget; const overlay = t.previousElementSibling as HTMLElement | null; const gutter = t.parentElement?.previousElementSibling as HTMLElement | null; if (overlay) { overlay.scrollTop = t.scrollTop; overlay.scrollLeft = t.scrollLeft } if (gutter) gutter.scrollTop = t.scrollTop }
    const rendered = (plsql ? plSqlLines : sqlLines).map((html, index) => <div key={index} className="code-line" dangerouslySetInnerHTML={{ __html: html }} />)
    const meta = TOOLS[plsql ? 'plsql' : 'sql']
    return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={meta.title} desc={meta.desc} /><div className="panels"><section className="panel editor-panel"><div className="panel-head"><div className="panel-title"><Database size={16} /><h2>Editor</h2><span className="format-label">{plsql ? 'PL/SQL' : 'SQL'}</span></div><div className="panel-actions"><button className="quiet-button" onClick={() => update('')} aria-label="Clear editor"><RotateCcw size={14} /></button></div></div><div className="editor-wrap"><div className="line-numbers">{val.split('\n').map((_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div><div className="code-editor"><pre aria-hidden="true">{rendered}</pre><textarea spellCheck={false} value={val} onChange={e => update(e.target.value)} onScroll={syncScroll} className="editor" wrap="soft" aria-label={plsql ? 'PL/SQL editor' : 'SQL editor'} /></div></div><div className="panel-foot"><span className="meta-text">{val.length} characters</span></div></section><section className="panel inspector-panel"><div className="panel-head"><div className="panel-title"><Check size={16} /><h2>Tokenized</h2></div><div className="panel-actions"><button className="quiet-button" onClick={copySql}>{copiedFlag ? <Check size={14} /> : <Copy size={14} />} {copiedFlag ? 'Copied' : 'Copy'}</button></div></div><div className="inspector-body">{val ? <pre className="raw-view" dangerouslySetInnerHTML={{ __html: (plsql ? plSqlLines : sqlLines).join('\n') }} /> : <div className="empty-state">Enter a SQL query</div>}</div><div className="panel-foot inspector-status"><span className="status-dot" /><span className="meta-text">{plsql ? 'PL/SQL' : 'SQL'} syntax</span></div></section></div><ToolBar action="Beautify" icon={<Wand2 size={14} />} onAction={() => update(formatSql(val, plsql))} clear="Clear" onClear={() => update('')} output={val}><button className="outline-button" onClick={() => update(val.replace(/\s+/g, ' ').trim())}><Minimize2 size={14} /> Minify</button></ToolBar></AppTool>
  }

  const renderCompareTool = (a: string, setA: (v: string) => void, b: string, setB: (v: string) => void, equal: boolean, lenA: number, lenB: number, diffRes: { htmlA: string; htmlB: string } | null, title: string, desc: string) => {
    return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={title} desc={desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><FileText size={16} /><h2>String A</h2></div><button className="quiet-button" onClick={() => setA('')} aria-label="Clear A"><RotateCcw size={14} /></button></div><div className="plain-editor-wrap"><textarea value={a} onChange={event => setA(event.target.value)} className="plain-editor" spellCheck={false} aria-label="String A" /></div><div className="panel-foot"><span className="meta-text">{a.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><FileText size={16} /><h2>String B</h2></div><button className="quiet-button" onClick={() => setB('')} aria-label="Clear B"><RotateCcw size={14} /></button></div><div className="plain-editor-wrap"><textarea value={b} onChange={event => setB(event.target.value)} className="plain-editor" spellCheck={false} aria-label="String B" /></div><div className="panel-foot"><span className="meta-text">{b.length} characters</span></div></section><OutPanel icon={<Check size={16} />} title="Result" style={{ gridColumn: '1 / -1' }} foot={<><span className={`status-dot ${equal ? '' : 'error'}`} /><span className="meta-text">{equal ? 'Equal' : 'Different'}</span></>}>{equal ? <div className="diagnostic ok" style={{ marginBottom: 0 }}><div className="diagnostic-icon"><Check size={16} /></div><div><strong>Strings are identical</strong><p>{lenA} characters on line 1 &middot; no differences found</p></div></div> : <div className="diff-view">{diffRes && <><div className="diff-section"><div className="diff-label">String A — original</div><pre className="raw-view diff-pane" dangerouslySetInnerHTML={{ __html: diffRes.htmlA }} /></div><div className="diff-section"><div className="diff-label">String B — modified</div><pre className="raw-view diff-pane" dangerouslySetInnerHTML={{ __html: diffRes.htmlB }} /></div></>}</div>}</OutPanel></div><ToolBar action="Swap A ↔ B" icon={<ArrowLeftRight size={14} />} onAction={() => { const t = a; setA(b); setB(t) }} clear="Clear both" onClear={() => { setA(''); setB('') }} output={a} /></AppTool>
  }

  const renderCodeGen = (icon: ReactNode, label: string, source: string, update: (v: string) => void, out: { value: string; error: string }) => (
    <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS[tool].title} desc={TOOLS[tool].desc} /><div className="panels"><IoPanel icon={icon} title="JSON input" label={label} value={source} onChange={update} onClear={() => update('')} placeholder="Paste JSON" /><OutPanel icon={<Code2 size={16} />} title="Output"><>{out.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Invalid JSON</strong><p>{out.error}</p></div></div> : <pre className="raw-view">{out.value}</pre>}</></OutPanel></div><ToolBar action="Beautify JSON" icon={<Wand2 size={14} />} onAction={() => { try { update(JSON.stringify(JSON.parse(source), null, 2)) } catch { /* live diagnostics */ } }} clear="Clear" onClear={() => update('')} output={out.value} /></AppTool>
  )

  if (tool === 'base64') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.base64.title} desc={TOOLS.base64.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Binary size={16} /><h2>Input</h2><span className="format-label">{base64Mode === 'encode' ? 'TEXT' : 'BASE64'}</span></div><div className="panel-actions"><div className="format-switch"><button className={base64Mode === 'encode' ? 'selected' : ''} onClick={() => setBase64Mode('encode')}>Encode</button><button className={base64Mode === 'decode' ? 'selected' : ''} onClick={() => setBase64Mode('decode')}>Decode</button></div><button className="quiet-button" onClick={() => setBase64Input('')} aria-label="Clear input"><RotateCcw size={14} /></button></div></div><div className="plain-editor-wrap"><textarea value={base64Input} onChange={event => setBase64Input(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Base64 input" placeholder={base64Mode === 'encode' ? 'Type text to encode' : 'Paste Base64 to decode'} /></div><div className="panel-foot"><span className="meta-text">{base64Input.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Code2 size={16} /><h2>Result</h2></div></div><div className="result-body">{base64Result.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>{base64Result.error}</strong><p>Check the input and try again.</p></div></div> : <pre className="raw-view">{base64Result.value}</pre>}</div><div className="panel-foot"><span className={`status-dot ${base64Result.error ? 'error' : ''}`} /><span className="meta-text">{base64Result.error ? 'Invalid input' : 'Ready'}</span></div></section></div><ToolBar clear="Clear" onClear={() => setBase64Input('')} output={base64Result.value} /></AppTool>
  if (tool === 'jwt') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.jwt.title} desc={TOOLS.jwt.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><KeyRound size={16} /><h2>Token</h2></div><button className="quiet-button" onClick={() => setJwtInput('')} aria-label="Clear token"><RotateCcw size={14} /></button></div><div className="plain-editor-wrap"><textarea value={jwtInput} onChange={event => setJwtInput(event.target.value)} className="plain-editor" spellCheck={false} aria-label="JWT token" placeholder="Paste a JWT token here" /></div><div className="panel-foot"><span className="meta-text">{jwtInput.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Fingerprint size={16} /><h2>Decoded</h2></div></div><div className="inspector-body">{jwtDecoded.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Unable to decode JWT</strong><p>{jwtDecoded.error}</p></div></div> : <><div className="section-label">HEADER</div><pre className="raw-view">{JSON.stringify(jwtDecoded.header, null, 2)}</pre><div className="section-label">PAYLOAD</div><pre className="raw-view">{JSON.stringify(jwtDecoded.payload, null, 2)}</pre><div className="section-label">SIGNATURE</div><div className="sig-text">{jwtDecoded.signature}</div></>}</div><div className="panel-foot inspector-status"><span className={`status-dot ${jwtDecoded.error ? 'error' : ''}`} /><span className="meta-text">{jwtDecoded.error ? 'Invalid token' : 'Valid JWT structure'}</span></div></section></div><ToolBar output={jwtDecoded.error ? '' : JSON.stringify({ header: jwtDecoded.header, payload: jwtDecoded.payload }, null, 2)} /></AppTool>
  if (tool === 'regex') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.regex.title} desc={TOOLS.regex.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Braces size={16} /><h2>Pattern</h2><span className="format-label">/{regexPattern}/{regexFlags}</span></div><button className="quiet-button" onClick={() => setRegexPattern('')} aria-label="Clear pattern"><RotateCcw size={14} /></button></div><div className="regex-inputs"><input className="plain-input" value={regexPattern} onChange={event => setRegexPattern(event.target.value)} spellCheck={false} aria-label="Regex pattern" placeholder="Enter regex pattern" /><div className="flag-row">{[['g', 'Global'], ['i', 'Ignore case'], ['m', 'Multiline'], ['s', 'Dotall'], ['u', 'Unicode'], ['y', 'Sticky']].map(([flag, label]) => <button key={flag} className={`flag-button ${regexFlags.includes(flag) ? 'on' : ''}`} onClick={() => toggleFlag(flag)}>{label}</button>)}</div></div><div className="panel-head"><div className="panel-title"><Braces size={16} /><h2>Test string</h2></div><button className="quiet-button" onClick={() => setRegexText('')} aria-label="Clear test string"><RotateCcw size={14} /></button></div><div className="plain-editor-wrap"><textarea value={regexText} onChange={event => setRegexText(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Test string" /></div><div className="panel-foot"><span className="meta-text">{regexText.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Check size={16} /><h2>Matches</h2></div></div><div className="inspector-body">{regexResult.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Invalid regex</strong><p>{regexResult.error}</p></div></div> : regexText ? <><div className="match-summary">{regexResult.matches.length} match{regexResult.matches.length === 1 ? '' : 'es'}</div><pre className="raw-view match-preview">{regexPreview}</pre>{regexResult.matches.map((match, index) => <div key={index} className="match-row"><span className="match-index">#{index + 1} · {match.index}</span><span className="match-value">{match.value}</span></div>)}</> : <div className="empty-state">Enter text to scan</div>}</div><div className="panel-foot inspector-status"><span className={`status-dot ${regexResult.error ? 'error' : ''}`} /><span className="meta-text">{regexResult.error ? 'Invalid pattern' : regexResult.matches.length ? `${regexResult.matches.length} found` : 'No matches'}</span></div></section></div><ToolBar output={regexText} /></AppTool>
  if (tool === 'compare') return renderCompareTool(cmpA, setCmpA, cmpB, setCmpB, cmp.equal, cmp.lenA, cmp.lenB, diff, TOOLS.compare.title, TOOLS.compare.desc)
  if (tool === 'jsondiff') return renderCompareTool(jdA, setJdA, jdB, setJdB, jdCmp.equal, jdCmp.lenA, jdCmp.lenB, jdDiff, TOOLS.jsondiff.title, TOOLS.jsondiff.desc)
  if (tool === 'xmldiff') return renderCompareTool(xdA, setXdA, xdB, setXdB, xdCmp.equal, xdCmp.lenA, xdCmp.lenB, xdDiff, TOOLS.xmldiff.title, TOOLS.xmldiff.desc)
  if (tool === 'clean') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.clean.title} desc={TOOLS.clean.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Scissors size={16} /><h2>Input</h2></div><button className="quiet-button" onClick={() => setCleanInput('')} aria-label="Clear input"><RotateCcw size={14} /></button></div><div className="plain-editor-wrap"><textarea value={cleanInput} onChange={event => setCleanInput(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Clean text input" placeholder="Paste text to clean" /></div><div className="panel-foot"><span className="meta-text">{cleanInput.length} characters</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Wand2 size={16} /><h2>Result</h2></div></div><div className="result-body"><div className="flag-row" style={{ padding: '0 0 12px' }}>{cleanModes.map(mode => <button key={mode.id} className={`flag-button ${cleanMode === mode.id ? 'on' : ''}`} onClick={() => setCleanMode(mode.id)}>{mode.label}</button>)}</div>{cleanInput ? <pre className="raw-view">{cleanOut.value || '(empty result)'}</pre> : null}</div><div className="panel-foot"><span className={`status-dot ${cleanOut.removed ? '' : 'error'}`} /><span className="meta-text">{cleanOut.removed} characters removed</span></div></section></div><ToolBar clear="Clear" onClear={() => setCleanInput('')} output={cleanOut.value} /></AppTool>
  if (tool === 'timestamp') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.timestamp.title} desc={TOOLS.timestamp.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Clock size={16} /><h2>Settings</h2></div><div className="panel-actions"><button className="quiet-button" onClick={stampNow} aria-label="Use current time"><Clock size={14} /> Now</button></div></div><div className="result-body"><div className="section-label">DATE</div><input type="date" className="plain-input" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8 }} value={tsDate} onChange={event => setTsDate(event.target.value)} aria-label="Date" /><div className="section-label">TIME</div><input type="time" className="plain-input" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} value={tsTime} onChange={event => setTsTime(event.target.value)} aria-label="Time" /><div className="section-label">PATTERN</div><select className="plain-input" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8, background: 'var(--surface)' }} value={tsPattern} onChange={event => setTsPattern(event.target.value)}>{tsPresets.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</select><input className="plain-input" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} value={tsPattern === 'ISO' ? 'ISO' : tsPattern} onChange={event => setTsPattern(event.target.value)} spellCheck={false} aria-label="Custom pattern" /></div><div className="panel-foot"><span className="meta-text">Empty date / time uses current</span></div></section><section className="panel"><div className="panel-head"><div className="panel-title"><Clock size={16} /><h2>Result</h2></div></div><div className="result-body"><div className="section-label">FORMATTED</div><pre className="raw-view">{tsValue}</pre><div className="section-label">UNIX SECONDS</div><div className="sig-text">{Math.floor(tsDateObj.getTime() / 1000)}</div><div className="section-label">UNIX MILLISECONDS</div><div className="sig-text">{tsDateObj.getTime()}</div><div className="section-label">ISO 8601</div><div className="sig-text">{tsDateObj.toISOString()}</div></div><div className="panel-foot inspector-status"><span className="status-dot" /><span className="meta-text">{tsDateObj.toString().slice(0, 24)}</span></div></section></div><ToolBar output={tsValue} /></AppTool>
  if (tool === 'j2ts') return renderCodeGen(<FileJson size={16} />, 'TypeScript', j2tsIn, setJ2tsIn, tsOut)
  if (tool === 'j2java') return renderCodeGen(<Coffee size={16} />, 'Java', j2javaIn, setJ2javaIn, javaOut)
  if (tool === 'j2kt') return renderCodeGen(<Code2 size={16} />, 'Kotlin', j2ktIn, setJ2ktIn, ktOut)
  if (tool === 'yaml') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.yaml.title} desc={TOOLS.yaml.desc} /><div className="panels"><IoPanel icon={<Braces size={16} />} title="Input" label={yamlMode === 'to' ? 'JSON' : 'YAML'} value={yamlIn} onChange={setYamlIn} onClear={() => setYamlIn('')} placeholder={yamlMode === 'to' ? 'Paste JSON' : 'Paste YAML'} actions={<div className="format-switch"><button className={yamlMode === 'to' ? 'selected' : ''} onClick={() => setYamlMode('to')}>JSON → YAML</button><button className={yamlMode === 'from' ? 'selected' : ''} onClick={() => setYamlMode('from')}>YAML → JSON</button></div>} /><OutPanel icon={<Code2 size={16} />} title="Output" label={yamlMode === 'to' ? 'YAML' : 'JSON'}>{yamlOut.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Unable to convert</strong><p>{yamlOut.error}</p></div></div> : <pre className="raw-view">{yamlOut.value}</pre>}</OutPanel></div><ToolBar output={yamlOut.value} /></AppTool>
  if (tool === 'jsonxml') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.jsonxml.title} desc={TOOLS.jsonxml.desc} /><div className="panels"><IoPanel icon={<Braces size={16} />} title="Input" label={jxmlMode === 'json' ? 'JSON' : 'XML'} value={jxmlIn} onChange={setJxmlIn} onClear={() => setJxmlIn('')} placeholder={jxmlMode === 'json' ? 'Paste JSON' : 'Paste XML'} actions={<div className="format-switch"><button className={jxmlMode === 'json' ? 'selected' : ''} onClick={() => setJxmlMode('json')}>JSON → XML</button><button className={jxmlMode === 'xml' ? 'selected' : ''} onClick={() => setJxmlMode('xml')}>XML → JSON</button></div>} /><OutPanel icon={<Code2 size={16} />} title="Output" label={jxmlMode === 'json' ? 'XML' : 'JSON'}>{jxmlOut.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Unable to convert</strong><p>{jxmlOut.error}</p></div></div> : <pre className="raw-view">{jxmlOut.value}</pre>}</OutPanel></div><ToolBar output={jxmlOut.value} /></AppTool>
  if (tool === 'csv') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.csv.title} desc={TOOLS.csv.desc} /><div className="panels"><IoPanel icon={<Table size={16} />} title="Input" label={csvMode === 'json' ? 'JSON' : 'CSV'} value={csvIn} onChange={setCsvIn} onClear={() => setCsvIn('')} placeholder={csvMode === 'json' ? 'Paste JSON array' : 'Paste CSV'} actions={<div className="format-switch"><button className={csvMode === 'json' ? 'selected' : ''} onClick={() => setCsvMode('json')}>JSON → CSV</button><button className={csvMode === 'csv' ? 'selected' : ''} onClick={() => setCsvMode('csv')}>CSV → JSON</button></div>} /><OutPanel icon={<Table size={16} />} title="Output" label={csvMode === 'json' ? 'CSV' : 'JSON'}>{csvOut.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Unable to convert</strong><p>{csvOut.error}</p></div></div> : <pre className="raw-view">{csvOut.value}</pre>}</OutPanel></div><ToolBar output={csvOut.value} /></AppTool>
  if (tool === 'curl') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.curl.title} desc={TOOLS.curl.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Terminal size={16} /><h2>Request</h2></div></div><div className="regex-inputs"><div className="flag-row" style={{ padding: '12px 20px 0' }}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <button key={m} className={`flag-button ${curMethod === m ? 'on' : ''}`} onClick={() => setCurMethod(m)}>{m}</button>)}</div><input className="plain-input" value={curUrl} onChange={event => setCurUrl(event.target.value)} placeholder="https://api.example.com/v1/endpoint" spellCheck={false} aria-label="URL" /><div className="panel-head"><div className="panel-title"><List size={16} /><h2>Headers</h2></div></div><div className="plain-editor-wrap"><textarea value={curHeaders} onChange={event => setCurHeaders(event.target.value)} className="plain-editor" style={{ minHeight: 120 }} spellCheck={false} placeholder="Authorization: Bearer token" aria-label="Headers" /></div><div className="panel-head"><div className="panel-title"><FileText size={16} /><h2>Body</h2></div></div><div className="plain-editor-wrap"><textarea value={curBody} onChange={event => setCurBody(event.target.value)} className="plain-editor" style={{ minHeight: 160 }} spellCheck={false} placeholder='{"key": "value"}' aria-label="Body" /></div></div></section><OutPanel icon={<Terminal size={16} />} title="cURL command">{curlOut ? <pre className="raw-view">{curlOut}</pre> : <div className="empty-state">Fill in the request fields</div>}</OutPanel></div><ToolBar clear="Reset" onClear={() => { setCurUrl(''); setCurHeaders(''); setCurBody('') }} output={curlOut} /></AppTool>
  if (tool === 'url') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.url.title} desc={TOOLS.url.desc} /><div className="panels"><IoPanel icon={<Link size={16} />} title="URL" value={urlIn} onChange={setUrlIn} onClear={() => setUrlIn('')} placeholder="https://api.example.com/v2/orders?x=1" actions={<div className="format-switch"><button className={urlMode === 'parse' ? 'selected' : ''} onClick={() => setUrlMode('parse')}>Parse</button><button className={urlMode === 'encode' ? 'selected' : ''} onClick={() => setUrlMode('encode')}>Encode</button><button className={urlMode === 'decode' ? 'selected' : ''} onClick={() => setUrlMode('decode')}>Decode</button></div>} /><OutPanel icon={<Link size={16} />} title={urlMode === 'parse' ? 'Components' : urlMode === 'encode' ? 'Encoded' : 'Decoded'}>{urlMode === 'parse' ? (urlRes.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Invalid URL</strong><p>Enter a URL with a scheme (https://...)</p></div></div> : urlRes.parts.map(p => <div key={p.label} className="match-row"><span className="match-index">{p.label}</span><span className="match-value">{p.value}</span></div>)) : <pre className="raw-view">{urlTransformed}</pre>}</OutPanel></div><ToolBar output={urlMode === 'parse' ? JSON.stringify(urlRes.parts) : urlTransformed} /></AppTool>
  if (tool === 'headers') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.headers.title} desc={TOOLS.headers.desc} /><div className="panels"><IoPanel icon={<List size={16} />} title="Headers" value={hdrsIn} onChange={setHdrsIn} onClear={() => setHdrsIn('')} placeholder={'Authorization: Bearer token\nContent-Type: application/json'} /><OutPanel icon={<List size={16} />} title="Parsed">{hdrsIn.trim() ? <>{hdrs.map(h => <div key={`${h.key}-${h.value}`} className="match-row"><span className="match-index">{h.key}</span><span className="match-value">{h.value}</span></div>)}<div className="section-label">AS JSON</div><pre className="raw-view">{hdrsJson}</pre></> : <div className="empty-state">Enter headers as Key: Value lines</div>}</OutPanel></div><ToolBar output={hdrsJson} /></AppTool>
  if (tool === 'hash') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.hash.title} desc={TOOLS.hash.desc} /><div className="panels"><IoPanel icon={<Hash size={16} />} title="Input" value={hashInput} onChange={setHashInput} onClear={() => setHashInput('')} /><OutPanel icon={<Hash size={16} />} title="Digests">{hashInput.trim() ? HASH_ALGOS.map(algo => <div key={algo} className="match-row"><span className="match-index">{algo}</span><span className="match-value">{hashAll[algo] ?? '…'}</span></div>) : <div className="empty-state">Enter text to hash</div>}</OutPanel></div><ToolBar output={HASH_ALGOS.map(algo => `${hashAll[algo] ?? ''}`).join('\n')} /></AppTool>
  if (tool === 'hmac') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.hmac.title} desc={TOOLS.hmac.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><KeyRound size={16} /><h2>Input</h2></div><div className="panel-actions"><div className="format-switch">{HASH_ALGOS.map(algo => <button key={algo} className={hmacAlgo === algo ? 'selected' : ''} onClick={() => setHmacAlgo(algo)}>{algo}</button>)}</div><button className="quiet-button" onClick={() => { setHmacInput(''); setHmacSecret('') }} aria-label="Clear"><RotateCcw size={14} /></button></div></div><div className="plain-editor-wrap"><textarea value={hmacInput} onChange={event => setHmacInput(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Message" placeholder="Message to sign" /></div><div className="panel-head"><div className="panel-title"><KeyRound size={16} /><h2>Secret key</h2></div></div><div className="plain-editor-wrap"><textarea value={hmacSecret} onChange={event => setHmacSecret(event.target.value)} className="plain-editor" spellCheck={false} aria-label="Secret key" placeholder="Secret" /></div></section><OutPanel icon={<KeyRound size={16} />} title="HMAC">{hmacOut ? <pre className="raw-view">{hmacOut}</pre> : <div className="empty-state">Enter a message and secret</div>}</OutPanel></div><ToolBar output={hmacOut} /></AppTool>
  if (tool === 'cert') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.cert.title} desc={TOOLS.cert.desc} /><div className="panels"><IoPanel icon={<ShieldCheck size={16} />} title="Certificate (PEM)" value={certIn} onChange={setCertIn} onClear={() => setCertIn('')} placeholder={'-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----'} /><OutPanel icon={<ShieldCheck size={16} />} title="Fields">{certInfo.error ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Could not parse certificate</strong><p>{certInfo.error}</p></div></div> : <>{[{ label: 'Subject', value: certInfo.subject }, { label: 'Issuer', value: certInfo.issuer }, { label: 'Valid from', value: certInfo.notBefore }, { label: 'Valid to', value: certInfo.notAfter }, { label: 'Serial', value: certInfo.serial }].map(row => <div key={row.label} className="match-row"><span className="match-index">{row.label}</span><span className="match-value">{row.value}</span></div>)}</>}</OutPanel></div><ToolBar output={JSON.stringify({ subject: certInfo.subject, issuer: certInfo.issuer, notBefore: certInfo.notBefore, notAfter: certInfo.notAfter, serial: certInfo.serial }, null, 2)} /></AppTool>
  if (tool === 'uuid') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.uuid.title} desc={TOOLS.uuid.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Dices size={16} /><h2>Settings</h2></div></div><div className="result-body"><div className="section-label">COUNT</div><select className="plain-input" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }} value={uuidCount} onChange={event => setUuidCount(Number(event.target.value))}>{[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></div></section><OutPanel icon={<Dices size={16} />} title="Generated UUIDs"><pre className="raw-view">{uuidOut}</pre></OutPanel></div><ToolBar action="Regenerate" icon={<Wand2 size={14} />} onAction={() => setUuidTick(t => t + 1)} output={uuidOut} /></AppTool>
  if (tool === 'randstr') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.randstr.title} desc={TOOLS.randstr.desc} /><div className="panels"><section className="panel"><div className="panel-head"><div className="panel-title"><Dices size={16} /><h2>Settings</h2></div></div><div className="result-body"><div className="section-label">LENGTH</div><input className="plain-input" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8 }} type="number" min={1} max={256} value={rsLength} onChange={event => setRsLength(event.target.value)} aria-label="Length" /><div className="section-label">COUNT</div><input className="plain-input" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} type="number" min={1} max={50} value={rsCount} onChange={event => setRsCount(event.target.value)} aria-label="Count" /><div className="flag-row">{RS_SETS.map(set => <button key={set.id} className={`flag-button ${rsOpts.includes(set.id) ? 'on' : ''}`} onClick={() => setRsOpts(prev => prev.includes(set.id) ? prev.split(',').filter(x => x !== set.id).join(',') : [prev, set.id].filter(Boolean).join(','))}>{set.label}</button>)}</div></div></section><OutPanel icon={<Dices size={16} />} title="Random strings"><pre className="raw-view">{rndOut}</pre></OutPanel></div><ToolBar action="Regenerate" icon={<Wand2 size={14} />} onAction={() => setRsTick(t => t + 1)} output={rndOut} /></AppTool>
  if (tool === 'mock') return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.mock.title} desc={TOOLS.mock.desc} /><div className="panels"><IoPanel icon={<Boxes size={16} />} title="Schema" value={mockIn} onChange={setMockIn} onClear={() => setMockIn('')} placeholder='{"name": "@name"}' /><OutPanel icon={<Boxes size={16} />} title="Generated JSON">{mockOut ? <pre className="raw-view">{mockOut}</pre> : <div className="empty-state">Invalid schema</div>}</OutPanel></div><ToolBar action="Generate" icon={<Wand2 size={14} />} onAction={genMock} output={mockOut} /></AppTool>
  if (tool === 'sql') return renderSqlTool(false)
  if (tool === 'plsql') return renderSqlTool(true)
  return <AppTool theme={theme} setTheme={setTheme} tool={tool} onSelectTool={setTool}><ToolHead title={TOOLS.formatter.title} desc={TOOLS.formatter.desc} /><div className="panels"><section className="panel editor-panel"><div className="panel-head"><div className="panel-title"><Code2 size={16} /><h2>Editor</h2><span className="format-label">{format}</span></div><div className="panel-actions"><div className="format-switch"><button className={format === 'JSON' ? 'selected' : ''} onClick={() => setFormat('JSON')}><FileJson size={15} /> JSON</button><button className={format === 'XML' ? 'selected' : ''} onClick={() => setFormat('XML')}><FileCode2 size={15} /> XML</button></div><button className="quiet-button" onClick={() => setInput('')} aria-label="Clear editor"><RotateCcw size={14} /></button></div></div><div className="editor-wrap"><div className="line-numbers">{lines.map((_, i) => <span key={i} className={diagnostic?.line === i + 1 ? 'number-error' : ''}>{String(i + 1).padStart(2, '0')}</span>)}</div><div className="code-editor"><pre aria-hidden="true">{editorLines}</pre><textarea spellCheck={false} value={input} onChange={e => setInput(e.target.value)} onScroll={e => { const t = e.currentTarget; const overlay = t.previousElementSibling as HTMLElement | null; const gutter = t.parentElement?.previousElementSibling as HTMLElement | null; if (overlay) { overlay.scrollTop = t.scrollTop; overlay.scrollLeft = t.scrollLeft } if (gutter) gutter.scrollTop = t.scrollTop }} className="editor" wrap="soft" aria-label={`${format} editor`} /></div></div><div className="panel-foot"><span className="meta-text">{input.length} characters</span>{diagnostic && <span className="error-inline">Line {diagnostic.line}, col {diagnostic.column}</span>}</div></section><section className="panel inspector-panel"><div className="panel-head"><div className="panel-title"><Code2 size={16} /><h2>Inspector</h2></div></div><div className="tabs"><button className={activeTab === 'tree' ? 'active' : ''} onClick={() => setActiveTab('tree')}>Tree</button><button className={activeTab === 'raw' ? 'active' : ''} onClick={() => setActiveTab('raw')}>Raw</button></div><div className="inspector-body">{diagnostic ? <div className="diagnostic"><div className="diagnostic-icon"><AlertTriangle size={16} /></div><div><strong>Unable to parse {format}</strong><p>{diagnostic.message}</p><button onClick={() => { setActiveTab('raw'); document.querySelector<HTMLTextAreaElement>('.editor')?.focus() }}>Go to line {diagnostic.line}<span>:{diagnostic.column}</span></button></div></div> : activeTab === 'tree' ? treeRoot ? <TreeNode name={treeRoot.name} value={treeRoot.value} /> : <div className="empty-state">Enter a valid {format} payload</div> : <pre className="raw-view">{input}</pre>}</div><div className="panel-foot inspector-status"><span className={`status-dot ${diagnostic ? 'error' : ''}`} /><span className="meta-text">{diagnostic ? `Invalid ${format}` : `Valid ${format}`}</span></div></section></div><ToolBar action="Beautify" icon={<Wand2 size={14} />} onAction={pretty} clear="Clear" onClear={() => setInput('')} output={input}><button className="outline-button" onClick={minify}><Minimize2 size={14} /> Minify</button></ToolBar></AppTool>
}