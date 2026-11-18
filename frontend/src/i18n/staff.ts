import type { Language } from './locales'

const latin = {
  'staff.role.operator': 'Operator',
  'staff.role.specialist': 'Mutaxassis',
  'staff.role.manager': 'Rahbar',
  'staff.demo': 'Demo hisoblar',
  'staff.demo.operator': 'Qoralamalarni tasdiqlaydi',
  'staff.demo.specialist': 'Tiketlarga javob beradi',
  'staff.demo.manager': 'Hisobot va tahlil',
  'staff.switchAccount': 'Rolni almashtirish',
  'staff.otherAccount': 'Boshqa hisob bilan kirish',
  'staff.demoPick': 'Demo uchun rolni tanlang — bir bosishda kirasiz.',
  'staff.faq': 'FAQ hisoboti',
  'staff.readOnlyNote': 'Bu boʻlim siz uchun faqat koʻrish rejimida.',
} as const

export const staffMessages = {
  'uz-latn': latin,
  'uz-cyrl': {
    'staff.role.operator': 'Оператор',
    'staff.role.specialist': 'Мутахассис',
    'staff.role.manager': 'Раҳбар',
    'staff.demo': 'Демо ҳисоблар',
    'staff.demo.operator': 'Қораламаларни тасдиқлайди',
    'staff.demo.specialist': 'Тикетларга жавоб беради',
    'staff.demo.manager': 'Ҳисобот ва таҳлил',
    'staff.switchAccount': 'Ролни алмаштириш',
    'staff.otherAccount': 'Бошқа ҳисоб билан кириш',
    'staff.demoPick': 'Демо учун ролни танланг — бир босишда кирасиз.',
    'staff.faq': 'FAQ ҳисоботи',
    'staff.readOnlyNote': 'Бу бўлим сиз учун фақат кўриш режимида.',
  },
  ru: {
    'staff.role.operator': 'Оператор',
    'staff.role.specialist': 'Специалист',
    'staff.role.manager': 'Руководитель',
    'staff.demo': 'Демо-аккаунты',
    'staff.demo.operator': 'Утверждает черновики',
    'staff.demo.specialist': 'Отвечает на тикеты',
    'staff.demo.manager': 'Отчёты и аналитика',
    'staff.switchAccount': 'Сменить роль',
    'staff.otherAccount': 'Войти с другим аккаунтом',
    'staff.demoPick': 'Выберите роль для демо — вход в один клик.',
    'staff.faq': 'Отчёт по частым вопросам',
    'staff.readOnlyNote': 'Этот раздел доступен вам только для чтения.',
  },
} satisfies Record<Language, Record<keyof typeof latin, string>>
