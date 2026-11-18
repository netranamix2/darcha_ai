import type { Language } from './locales'

const latin = {
  'staff.role.operator': 'Operator',
  'staff.role.specialist': 'Mutaxassis',
  'staff.role.manager': 'Rahbar',
  'staff.demo': 'Demo hisoblar',
  'staff.demo.operator': 'Qoralamalarni koʻrib chiqadi va tasdiqlaydi.',
  'staff.demo.specialist': 'Tiketlarga javob beradi.',
  'staff.demo.manager': 'Tahlil va hisobotlarni koʻradi.',
  'staff.switchAccount': 'Hisobni almashtirish',
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
    'staff.demo.operator': 'Қораламаларни кўриб чиқади ва тасдиқлайди.',
    'staff.demo.specialist': 'Тикетларга жавоб беради.',
    'staff.demo.manager': 'Таҳлил ва ҳисоботларни кўради.',
    'staff.switchAccount': 'Ҳисобни алмаштириш',
    'staff.faq': 'FAQ ҳисоботи',
    'staff.readOnlyNote': 'Бу бўлим сиз учун фақат кўриш режимида.',
  },
  ru: {
    'staff.role.operator': 'Оператор',
    'staff.role.specialist': 'Специалист',
    'staff.role.manager': 'Руководитель',
    'staff.demo': 'Демо-аккаунты',
    'staff.demo.operator': 'Проверяет и утверждает черновики.',
    'staff.demo.specialist': 'Отвечает на тикеты.',
    'staff.demo.manager': 'Смотрит аналитику и отчёты.',
    'staff.switchAccount': 'Сменить аккаунт',
    'staff.faq': 'Отчёт по частым вопросам',
    'staff.readOnlyNote': 'Этот раздел доступен вам только для чтения.',
  },
} satisfies Record<Language, Record<keyof typeof latin, string>>
