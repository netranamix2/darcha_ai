import { Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { WindowMark } from '../components/Brand'
import {
  Avatar, Badge, Button, Dialog, DialogClose, DialogContent, DialogTrigger, Drawer, DrawerContent, DrawerTrigger,
  Input, Kbd, Select, Skeleton, StatusDot, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, Toast, ToastProvider,
  ToastViewport, Tooltip, TooltipProvider,
} from '../components/ui'
import { chatMessages } from '../i18n/chat'
import { showcaseMessages } from '../i18n/showcase'
import { useT } from '../i18n/useT'
import './ui-page.css'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kit-section">
      <h2 className="kit-section__title">{title}</h2>
      <div className="kit-section__body">{children}</div>
    </section>
  )
}

export default function UiPage() {
  const t = useT(showcaseMessages)
  const tc = useT(chatMessages)
  const [region, setRegion] = useState('tashkentCity')
  const [toastOpen, setToastOpen] = useState(false)

  return (
    <ToastProvider label={t('ui.toast')}>
      <TooltipProvider>
        <div className="kit">
          <header className="kit__head">
            <WindowMark size={28} />
            <h1 className="kit__title">{t('ui.title')}</h1>
            <p className="kit__intro">{t('ui.intro')}</p>
          </header>

          <Section title={t('ui.buttons')}>
            <div className="kit-row">
              <Button>{t('ui.primary')}</Button>
              <Button variant="secondary">{t('ui.secondary')}</Button>
              <Button variant="ghost">{t('ui.ghost')}</Button>
              <Button loading>{t('ui.loading')}</Button>
              <Button variant="secondary" disabled>{t('ui.disabled')}</Button>
            </div>
            <div className="kit-row">
              <Button size="sm">{t('ui.primary')}</Button>
              <Button size="sm" variant="secondary">{t('ui.secondary')}</Button>
              <Button size="lg">{t('ui.primary')}</Button>
            </div>
          </Section>

          <Section title={t('ui.fields')}>
            <div className="kit-grid">
              <label className="kit-field">
                <span>{t('ui.inputLabel')}</span>
                <Input placeholder={t('ui.inputPlaceholder')} className="mono" />
              </label>
              <label className="kit-field">
                <span>{t('ui.selectLabel')}</span>
                <Select
                  aria-label={t('ui.selectLabel')}
                  value={region}
                  onValueChange={setRegion}
                  options={[
                    { value: 'tashkentCity', label: tc('conversation.regionTashkentCity') },
                    { value: 'samarkand', label: tc('conversation.regionSamarkand') },
                    { value: 'fergana', label: tc('conversation.regionFergana') },
                    { value: 'khorezm', label: tc('conversation.regionKhorezm') },
                  ]}
                />
              </label>
              <label className="kit-field kit-field--wide">
                <span className="sr-only">{t('ui.searchPlaceholder')}</span>
                <Input startIcon={<Search />} placeholder={t('ui.searchPlaceholder')} />
              </label>
              <label className="kit-field kit-field--wide">
                <span>{t('ui.textareaLabel')}</span>
                <Textarea placeholder={t('ui.textareaPlaceholder')} />
              </label>
            </div>
          </Section>

          <Section title={t('ui.tabs')}>
            <Tabs defaultValue="queue">
              <TabsList aria-label={t('ui.tabs')}>
                <TabsTrigger value="queue">{t('ui.tabQueue')}</TabsTrigger>
                <TabsTrigger value="all">{t('ui.tabAll')}</TabsTrigger>
                <TabsTrigger value="tickets">{t('ui.tabTickets')}</TabsTrigger>
              </TabsList>
              <TabsContent value="queue"><p className="kit-muted">{t('ui.tabQueueBody')}</p></TabsContent>
              <TabsContent value="all"><p className="kit-muted">{t('ui.tabAllBody')}</p></TabsContent>
              <TabsContent value="tickets"><p className="kit-muted">{t('ui.tabTicketsBody')}</p></TabsContent>
            </Tabs>
          </Section>

          <Section title={t('ui.status')}>
            <div className="kit-row">
              <StatusDot tone="ok">{t('ui.statusGreen')}</StatusDot>
              <StatusDot tone="warn">{t('ui.statusYellow')}</StatusDot>
              <StatusDot tone="danger">{t('ui.statusRed')}</StatusDot>
            </div>
            <div className="kit-row">
              <Badge tone="ok" dot>{t('ui.statusGreen')}</Badge>
              <Badge tone="warn" dot>{t('ui.statusYellow')}</Badge>
              <Badge tone="danger" dot>{t('ui.statusRed')}</Badge>
              <Badge tone="accent">{t('ui.badgeAccent')}</Badge>
              <Badge>{t('ui.badgeNeutral')}</Badge>
            </div>
          </Section>

          <Section title={t('ui.overlays')}>
            <div className="kit-row">
              <Tooltip content={t('ui.tooltipText')}>
                <Button variant="secondary">{t('ui.tooltip')}</Button>
              </Tooltip>
              <Dialog>
                <DialogTrigger asChild><Button variant="secondary">{t('ui.dialog')}</Button></DialogTrigger>
                <DialogContent
                  title={t('ui.dialogTitle')}
                  description={t('ui.dialogBody')}
                  closeLabel={t('ui.close')}
                  footer={(
                    <>
                      <DialogClose asChild><Button variant="secondary">{t('ui.cancel')}</Button></DialogClose>
                      <DialogClose asChild><Button>{t('ui.confirm')}</Button></DialogClose>
                    </>
                  )}
                />
              </Dialog>
              <Drawer>
                <DrawerTrigger asChild><Button variant="secondary">{t('ui.drawer')}</Button></DrawerTrigger>
                <DrawerContent title={t('ui.drawerTitle')} closeLabel={t('ui.close')}>
                  <p className="kit-muted">{t('ui.drawerBody')}</p>
                </DrawerContent>
              </Drawer>
              <Button variant="secondary" onClick={() => { setToastOpen(false); window.setTimeout(() => setToastOpen(true), 60) }}>
                {t('ui.toast')}
              </Button>
            </div>
          </Section>

          <Section title={t('ui.misc')}>
            <div className="kit-row">
              <Avatar initials="NK" name={t('ui.avatar')} size="sm" />
              <Avatar initials="NK" name={t('ui.avatar')} />
              <Avatar initials="NK" name={t('ui.avatar')} size="lg" />
              <span className="kit-keys"><Kbd>Enter</Kbd> {t('ui.keySend')}</span>
              <span className="kit-keys"><Kbd>Shift</Kbd><Kbd>Enter</Kbd> {t('ui.keyNewline')}</span>
              <WindowMark size={20} thinking />
            </div>
            <div className="kit-skeleton" aria-label={t('ui.skeleton')}>
              <Skeleton className="kit-skeleton__line" />
              <Skeleton className="kit-skeleton__line kit-skeleton__line--short" />
            </div>
          </Section>
        </div>
        <Toast open={toastOpen} onOpenChange={setToastOpen} variant="success" title={t('ui.toastTitle')} description={t('ui.toastBody')} closeLabel={t('ui.close')} />
        <ToastViewport label={t('ui.toast')} />
      </TooltipProvider>
    </ToastProvider>
  )
}
