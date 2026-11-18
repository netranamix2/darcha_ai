import PublicChat from '../components/chat/PublicChat'
import { PublicDocuments } from '../components/public/PublicDocuments'
import { PublicFooter } from '../components/public/PublicFooter'
import './public-home.css'

export default function PublicChatPage() {
  return (
    <div className="home">
      <PublicChat />
      <PublicDocuments />
      <PublicFooter />
    </div>
  )
}
