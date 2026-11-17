import {
  ArrowRight,
  Bell,
  ChevronDown,
  CircleHelp,
  FileText,
  Globe2,
  Keyboard,
  Layers2,
  LayoutGrid,
  PanelTop,
  Rows3,
  Search,
  SlidersHorizontal,
  SquareMousePointer,
  TextCursorInput,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  Avatar,
  Button,
  Divider,
  Dropdown,
  DropdownContent,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownTrigger,
  GlassPanel,
  IconButton,
  Input,
  Kbd,
  Skeleton,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toast,
  ToastProvider,
  ToastViewport,
  Tooltip,
  TooltipProvider,
} from '../components/ui';
import { useT } from '../i18n/useT';
import './ui-page.css';

const sections = {
  surfaces: { id: 'ui-surfaces', label: 'ui.surfaces', icon: Layers2 },
  actions: { id: 'ui-actions', label: 'ui.actions', icon: SquareMousePointer },
  statuses: { id: 'ui-statuses', label: 'ui.statuses', icon: SlidersHorizontal },
  fields: { id: 'ui-fields', label: 'ui.fields', icon: TextCursorInput },
  navigation: { id: 'ui-navigation', label: 'ui.navigation', icon: LayoutGrid },
  feedback: { id: 'ui-feedback', label: 'ui.feedback', icon: Bell },
  identity: { id: 'ui-avatar', label: 'ui.avatar', icon: UserRound },
  keyboard: { id: 'ui-keyboard', label: 'ui.keyboard', icon: Keyboard },
} as const satisfies Record<string, { id: string; label: string; icon: LucideIcon }>;

const surfaceSamples = [
  { variant: 'default', label: 'ui.surfaceDefault', icon: PanelTop },
  { variant: 'elevated', label: 'ui.surfaceElevated', icon: Layers2 },
  { variant: 'subtle', label: 'ui.surfaceSubtle', icon: Rows3 },
] as const;

type ActionName = 'ui.primary' | 'ui.secondary' | 'ui.ghost' | 'ui.hover' | 'ui.focus';
type Section = (typeof sections)[keyof typeof sections];

function SampleSection({ section, children }: { section: Section; children: ReactNode }) {
  const t = useT();

  return (
    <section className="ui-sample" id={section.id} aria-labelledby={`${section.id}-label`}>
      <h2 id={`${section.id}-label`} className="ui-sample-title">{t(section.label)}</h2>
      {children}
    </section>
  );
}

function SurfaceSamples() {
  const t = useT();

  return (
    <SampleSection section={sections.surfaces}>
      <div className="ui-surface-grid">
        {surfaceSamples.map(({ variant, label, icon: Icon }) => (
          <GlassPanel className="ui-surface-preview" variant={variant} key={variant}>
            <span className="ui-surface-symbol" aria-hidden="true"><Icon size={20} /></span>
            <span>{t(label)}</span>
          </GlassPanel>
        ))}
      </div>
    </SampleSection>
  );
}

function ActionSamples({ onPress }: { onPress: (action: ActionName) => void }) {
  const t = useT();

  return (
    <SampleSection section={sections.actions}>
      <div className="ui-inline-samples">
        <Button onClick={() => onPress('ui.primary')}>
          {t('ui.primary')}
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button variant="secondary" onClick={() => onPress('ui.secondary')}>{t('ui.secondary')}</Button>
        <Button variant="ghost" onClick={() => onPress('ui.ghost')}>{t('ui.ghost')}</Button>
      </div>
      <Divider className="ui-sample-divider" />
      <div className="ui-inline-samples">
        <Button variant="primary" size="sm" data-preview-state="hover" onClick={() => onPress('ui.hover')}>
          {t('ui.hover')}
        </Button>
        <Button variant="secondary" size="sm" data-preview-state="focus" onClick={() => onPress('ui.focus')}>
          {t('ui.focus')}
        </Button>
        <Button variant="secondary" size="sm" disabled>{t('ui.disabled')}</Button>
        <Button variant="secondary" size="sm" loading>{t('ui.loading')}</Button>
      </div>
    </SampleSection>
  );
}

function StatusSamples() {
  const t = useT();

  return (
    <SampleSection section={sections.statuses}>
      <ul className="ui-status-list">
        <li><StatusPill level="green">{t('ui.statusGreen')}</StatusPill></li>
        <li><StatusPill level="yellow">{t('ui.statusYellow')}</StatusPill></li>
        <li><StatusPill level="red">{t('ui.statusRed')}</StatusPill></li>
      </ul>
    </SampleSection>
  );
}

function FieldSamples() {
  const t = useT();
  const [email, setEmail] = useState<string>();
  const emailValue = email ?? t('ui.invalidSample');
  const invalidEmail = emailValue.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(emailValue);

  return (
    <SampleSection section={sections.fields}>
      <div className="ui-field-grid">
        <div className="ui-field-sample">
          <label htmlFor="ui-subject">{t('ui.subject')}</label>
          <Input id="ui-subject" placeholder={t('ui.searchExample')} startIcon={<Search aria-hidden="true" />} />
        </div>
        <div className="ui-field-sample">
          <label htmlFor="ui-focus-field">{t('ui.focusField')}</label>
          <Input id="ui-focus-field" placeholder={t('ui.searchExample')} data-preview-state="focus" />
        </div>
        <div className="ui-field-sample">
          <label htmlFor="ui-channel">{t('ui.channel')}</label>
          <Input id="ui-channel" value={t('ui.web')} disabled />
        </div>
        <div className="ui-field-sample">
          <label htmlFor="ui-email">{t('ui.email')}</label>
          <Input
            id="ui-email"
            type="email"
            value={emailValue}
            aria-invalid={invalidEmail || undefined}
            aria-describedby={invalidEmail ? 'ui-email-error' : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {invalidEmail && <p id="ui-email-error" className="ui-field-error">{t('ui.emailError')}</p>}
        </div>
        <div className="ui-field-sample ui-field-wide">
          <label htmlFor="ui-message">{t('ui.message')}</label>
          <Textarea id="ui-message" rows={3} placeholder={t('ui.messagePlaceholder')} />
        </div>
      </div>
    </SampleSection>
  );
}

const tabSamples = [
  { id: 'all', label: 'ui.all', example: 'ui.allExample' },
  { id: 'new', label: 'ui.new', example: 'ui.newExample' },
  { id: 'closed', label: 'ui.closed', example: 'ui.closedExample' },
] as const;

const channels = [
  { label: 'ui.web', disabled: false },
  { label: 'ui.telegram', disabled: false },
  { label: 'ui.instagram', disabled: true },
] as const;

function NavigationSamples() {
  const t = useT();
  const [channel, setChannel] = useState<(typeof channels)[number]['label']>('ui.web');

  return (
    <SampleSection section={sections.navigation}>
      <div className="ui-navigation-grid">
        <div className="ui-sample-stack">
          <h3>{t('ui.tabs')}</h3>
          <Tabs defaultValue="all">
            <TabsList aria-label={t('ui.tabs')}>
              {tabSamples.map(({ id, label }) => (
                <TabsTrigger key={id} value={id}>{t(label)}</TabsTrigger>
              ))}
            </TabsList>
            {tabSamples.map(({ id, example }) => (
              <TabsContent key={id} value={id}>
                <div className="ui-tab-result">
                  <FileText size={17} aria-hidden="true" />
                  {t(example)}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
        <div className="ui-sample-stack">
          <h3>{t('ui.dropdown')}</h3>
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="secondary" aria-label={`${t('ui.chooseChannel')} · ${t(channel)}`}>
                <Globe2 aria-hidden="true" />
                {t(channel)}
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownTrigger>
            <DropdownContent align="start">
              <DropdownRadioGroup value={channel} onValueChange={(value) => {
                const selection = channels.find(({ label }) => label === value);
                if (selection) setChannel(selection.label);
              }}>
                {channels.map(({ label, disabled }) => (
                  <DropdownRadioItem key={label} value={label} disabled={disabled}>
                    {t(label)}
                  </DropdownRadioItem>
                ))}
              </DropdownRadioGroup>
            </DropdownContent>
          </Dropdown>
        </div>
        <div className="ui-sample-stack">
          <h3>{t('ui.tooltip')}</h3>
          <Tooltip content={t('ui.tooltipContent')}>
            <IconButton aria-label={t('ui.tooltipTrigger')} variant="secondary">
              <CircleHelp aria-hidden="true" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </SampleSection>
  );
}

function FeedbackSamples({ onPreview }: { onPreview: () => void }) {
  const t = useT();

  return (
    <SampleSection section={sections.feedback}>
      <div className="ui-feedback-grid">
        <div className="ui-sample-stack">
          <h3>{t('ui.toast')}</h3>
          <div className="ui-inline-samples">
            <Button onClick={onPreview} variant="secondary">
              <Bell aria-hidden="true" />
              {t('ui.showToast')}
            </Button>
          </div>
        </div>
        <div className="ui-sample-stack">
          <h3>{t('ui.skeleton')}</h3>
          <div className="ui-skeleton-preview" role="status" aria-label={t('ui.loading')}>
            <Skeleton className="ui-skeleton-avatar" />
            <div className="ui-skeleton-lines">
              <Skeleton className="ui-skeleton-heading" />
              <Skeleton className="ui-skeleton-detail" />
            </div>
          </div>
        </div>
      </div>
    </SampleSection>
  );
}

function IdentitySamples() {
  const t = useT();

  return (
    <SampleSection section={sections.identity}>
      <div className="ui-person-preview">
        <Avatar initials={t('ui.avatarInitials')} size="lg" />
        <div>
          <strong>{t('ui.avatarName')}</strong>
          <span>{t('ui.avatarRole')}</span>
        </div>
      </div>
    </SampleSection>
  );
}

function KeyboardSamples() {
  const t = useT();

  return (
    <SampleSection section={sections.keyboard}>
      <div className="ui-keyboard-samples">
        <div>
          <span>{t('ui.nextControl')}</span>
          <span><Kbd>{t('ui.keyTab')}</Kbd></span>
        </div>
        <div>
          <span>{t('ui.previousControl')}</span>
          <span><Kbd>{t('ui.keyShift')}</Kbd><Kbd>{t('ui.keyTab')}</Kbd></span>
        </div>
      </div>
    </SampleSection>
  );
}

type Notice = {
  id: number;
  open: boolean;
  action?: ActionName;
};

export default function UiPage() {
  const t = useT();
  const [notice, setNotice] = useState<Notice | null>(null);

  function showNotice(action?: ActionName) {
    setNotice((previous) => ({ id: (previous?.id ?? 0) + 1, open: true, action }));
  }

  return (
    <TooltipProvider>
      <ToastProvider label={t('ui.notifications')}>
        <div className="ui-catalogue">
          <header className="ui-catalogue-heading">
            <h1>{t('ui.title')}</h1>
            <p>{t('ui.intro')}</p>
          </header>
          <div className="ui-catalogue-layout">
            <aside className="ui-index">
              <nav aria-label={t('ui.sections')}>
                {Object.values(sections).map(({ id, label, icon: Icon }) => (
                  <a href={`#${id}`} key={id}><Icon size={16} aria-hidden="true" />{t(label)}</a>
                ))}
              </nav>
            </aside>
            <div className="ui-catalogue-samples">
              <SurfaceSamples />
              <div className="ui-samples-pair ui-actions-pair">
                <ActionSamples onPress={showNotice} />
                <StatusSamples />
              </div>
              <FieldSamples />
              <NavigationSamples />
              <FeedbackSamples onPreview={() => showNotice()} />
              <div className="ui-samples-pair">
                <IdentitySamples />
                <KeyboardSamples />
              </div>
            </div>
          </div>
        </div>
        {notice && (
          <Toast
            key={notice.id}
            open={notice.open}
            onOpenChange={(open) => setNotice((previous) => (
              previous?.id === notice.id ? { ...previous, open } : previous
            ))}
            title={t(notice.action ? 'ui.buttonPressed' : 'ui.toastTitle')}
            description={t(notice.action ?? 'ui.toastDescription')}
            closeLabel={t('ui.dismissToast')}
            variant={notice.action ? 'default' : 'success'}
          />
        )}
        <ToastViewport label={t('ui.notificationHotkey')} />
      </ToastProvider>
    </TooltipProvider>
  );
}
