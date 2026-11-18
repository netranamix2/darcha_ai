import type { Citation } from '../api/types'
import { chatMessages } from '../i18n/chat'
import { useT } from '../i18n/useT'
import './citation-footnotes.css'

function externalSource(value: string) {
  try {
    const url = new URL(value)
    const webUrl = url.protocol === 'https:' || url.protocol === 'http:'
    return webUrl && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

export function CitationFootnotes({ citations }: { citations: Citation[] }) {
  const t = useT(chatMessages)
  if (citations.length === 0) return null

  return (
    <ul className="citation-footnotes">
      {citations.map((citation, index) => {
        const url = externalSource(citation.url)
        const isLex = url?.hostname === 'lex.uz' || Boolean(url?.hostname.endsWith('.lex.uz'))
        return (
          <li className="citation-footnote" key={citation.url + citation.ref + index}>
            <cite>{citation.title}</cite>
            <div className="citation-footnote-meta">
              {citation.ref && <span className="citation-footnote-ref">{citation.ref}</span>}
              {url && (
                <a href={url.href} target="_blank" rel="noopener noreferrer">
                  {t(isLex ? 'conversation.lexLink' : 'conversation.sourceLink')}
                </a>
              )}
              {isLex && url?.protocol === 'https:' && (
                <span className="citation-footnote-verified"><span aria-hidden="true">✓</span> {t('conversation.checked')}</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
