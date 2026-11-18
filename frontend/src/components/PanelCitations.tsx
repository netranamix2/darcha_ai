import type { Citation } from '../api/types'

export function PanelCitations({ citations }: { citations: Citation[] }) {
  return (
    <ul className="panel-citations">
      {citations.map(({ title, ref, url }, index) => (
        <li key={title + ref + index}>
          {/^https?:\/\//i.test(url)
            ? <a href={url} target="_blank" rel="noreferrer">{title}</a>
            : <span>{title}</span>}
          {ref && <span>{ref}</span>}
        </li>
      ))}
    </ul>
  )
}
