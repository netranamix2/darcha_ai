import type { Channel, StaffMember, Ticket, TicketDepartment } from '../types'
import { topics } from './chat'

export const staff = [
  { id: 'staff-dilnoza', name: 'Dilnoza Karimova', department: 'higher', is_current: true },
  { id: 'staff-javlon', name: 'Javlon Rahimov', department: 'higher' },
  { id: 'staff-madina', name: 'Madina Aliyeva', department: 'schools' },
  { id: 'staff-nargiza', name: 'Nargiza Xolmatova', department: 'attestation' },
  { id: 'staff-aziz', name: 'Aziz Qodirov', department: 'regional' },
] satisfies StaffMember[]

export const currentStaff = staff[0]

export function departmentFor(topic: string, text = ''): TicketDepartment {
  if (topic === topics.certification.label) return 'attestation'
  if (topic === topics.uniform.label) return 'schools'
  if (Object.values(topics).some(({ label }) => label === topic)) return 'higher'
  if (/universitet|institut|oliygoh|\botm\b|университет|институт|\bвуз/iu.test(text)) return 'higher'
  if (/maktab|мактаб|школ/iu.test(text)) return 'schools'
  return 'regional'
}

interface TicketExample {
  department: TicketDepartment
  topic: string
  region: string | null
  channel: Channel
  priority: Ticket['priority']
  summary: string
  text: string
  answer: string
  flags?: string[]
}

export const ticketExamples = [
  {
    department: 'higher', topic: topics.restoration.label, region: 'Samarqand viloyati', channel: 'web', priority: 'high',
    summary: 'Universitet oʻqishni qayta tiklash arizasini izohsiz rad etgan.',
    text: 'Universitet akademik taʼtildan keyin oʻqishimni qayta tiklashni rad etdi. Dekanat yozma sabab bermadi. Shikoyatimni koʻrib chiqishingizni soʻrayman.',
    answer: 'Universitetdan rad etish qarorining yozma nusxasini soʻrang. Ariza sanasi va roʻyxat raqamini yuborsangiz, qabul jarayonini tekshiramiz.',
    flags: ['personal_data'],
  },
  {
    department: 'attestation', topic: topics.certification.label, region: 'Namangan viloyati', channel: 'telegram', priority: 'high',
    summary: 'Oʻqituvchining attestatsiya natijasi chiqqan, malaka toifasi belgilanmagan.',
    text: 'Attestatsiya imtihonidan oʻtdim, lekin kabinetimda malaka toifasi belgilanmagan. Maktab buxgalteriyasi sertifikat paydo boʻlishini kutyapti.',
    answer: 'Attestatsiya bayonnomasi va ariza raqamini yuboring. Markaz qoʻyilgan ball bilan elektron sertifikat yozuvini solishtirib chiqadi.',
  },
  {
    department: 'higher', topic: topics.contract.label, region: 'Toshkent shahri', channel: 'instagram', priority: 'normal',
    summary: 'Kontrakt toʻlovi oʻtkazilgan, lekin talaba kabinetida qarz qolgan.',
    text: 'Kontraktning ikkinchi qismini bankdan toʻladim, shunga qaramay kabinetim qarz koʻrsatyapti. Buxgalteriya va bank bir-biriga yuboryapti.',
    answer: 'Bank cheki va shartnoma raqamini oliygohning hisob-kitob boʻlimiga yuboring. Toʻlov tushumi bilan talabaning shaxsiy hisobi taqqoslanadi.',
  },
  {
    department: 'schools', topic: 'Maktab direktori yuzasidan shikoyat', region: 'Buxoro viloyati', channel: 'telegram', priority: 'high',
    summary: 'Ota-ona maktab direktori majburiy yigʻim talab qilganidan shikoyat qildi.',
    text: 'Maktab direktori taʼmirlash uchun ota-onalardan pul yigʻishni talab qilyapti. Toʻlamagan oʻquvchini tadbirga qoʻymasliklarini aytishdi.',
    answer: 'Xabar sanasini va yigʻim haqidagi eʼlonni yuboring. Hududiy taʼlim boʻlimi maktab maʼmuriyatidan izoh soʻraydi.',
    flags: ['minor', 'fraud'],
  },
  {
    department: 'regional', topic: 'Maktab transporti', region: 'Jizzax viloyati', channel: 'web', priority: 'normal',
    summary: 'Olis mahalladagi oʻquvchilar uchun avtobus qatnovi qisqartirilgan.',
    text: 'Qishlogʻimizdan maktabga boradigan avtobus endi haftasiga ikki marta keladi. Bolalar darsga ikki kilometr piyoda boryapti.',
    answer: 'Mahalla nomi va avvalgi qatnov jadvalini yozib yuboring. Tuman masʼullariga amaldagi jadvalni tekshirish uchun soʻrov yuboriladi.',
  },
  {
    department: 'higher', topic: topics.transfer.label, region: 'Qoraqalpogʻiston Respublikasi', channel: 'telegram', priority: 'normal',
    summary: 'Transfer arizasiga transkript yuklangan, tizim hujjatni koʻrsatmayapti.',
    text: 'Nukusdagi oliygohdan boshqa OTMga oʻtish uchun transkript yukladim. Tizim arizani hujjatsiz qabul qilganini koʻrsatyapti.',
    answer: 'Yuklangan fayl turi va ariza raqamini yuboring. Arizaga ilova qilingan fayllar roʻyxati portal yozuvi bilan tekshiriladi.',
    flags: ['personal_data'],
  },
  {
    department: 'attestation', topic: topics.certification.label, region: 'Navoiy viloyati', channel: 'web', priority: 'normal',
    summary: 'Pedagog attestatsiya apellyatsiyasi holatini bilmoqchi.',
    text: 'Attestatsiya ballim boʻyicha apellyatsiya yubordim. Ikki haftadan beri arizaning holati yangilanmadi, qachon javob boʻladi?',
    answer: 'Apellyatsiya raqami va yuborilgan sanani koʻrsating. Markaz arizani koʻrib chiqish jarayonini aniqlab, natija xabarini joʻnatadi.',
  },
  {
    department: 'schools', topic: 'Maktabga qabul', region: 'Qashqadaryo viloyati', channel: 'instagram', priority: 'normal',
    summary: 'Oʻquvchi maktabga qabul roʻyxatida koʻrinmagan.',
    text: 'Farzandimni birinchi sinfga roʻyxatdan oʻtkazdim, lekin maktab yuborgan roʻyxatda familiyasi yoʻq. Ariza qabul qilingan edi.',
    answer: 'Qabul arizasining raqamini maktab maʼmuriyatiga yuboring. Elektron roʻyxat bilan qabul qaydnomasi tekshiriladi.',
    flags: ['minor'],
  },
  {
    department: 'regional', topic: 'Hududiy boʻlim murojaati', region: 'Surxondaryo viloyati', channel: 'telegram', priority: 'low',
    summary: 'Hududiy boʻlimga yuborilgan murojaat javobsiz qolgan.',
    text: 'Tuman taʼlim boʻlimiga maktabdagi isitish masalasi boʻyicha yozdim. Qabul raqami berildi, lekin keyin hech qanday xabar kelmadi.',
    answer: 'Hududiy boʻlim bergan roʻyxat raqamini yuboring. Masʼul xodim murojaatning harakatini qaydnoma orqali tekshiradi.',
  },
  {
    department: 'higher', topic: topics.restoration.label, region: 'Fargʻona viloyati', channel: 'web', priority: 'low',
    summary: 'Talabadan ayni bir hujjatni qayta yuborish soʻralgan.',
    text: 'Oʻqishni qayta tiklash arizasiga akademik maʼlumotnoma biriktirganman. OTM uni qayta olib kelishni soʻradi, sababini tushuntirmadi.',
    answer: 'Ariza ilovasini va universitet xabari nusxasini yuboring. Maʼlumotnoma tarkibi talab etilgan hujjatlar roʻyxati bilan solishtiriladi.',
  },
  {
    department: 'higher', topic: topics.contract.label, region: 'Sirdaryo viloyati', channel: 'telegram', priority: 'normal',
    summary: 'Talaba yangilangan kontrakt summasidagi farqni aniqlashtirmoqchi.',
    text: 'Yangi kontrakt nusxasida toʻlov summasi oldingisidan yuqori chiqdi. Shartnoma ilovasida bu farq koʻrsatilmagan.',
    answer: 'Shartnomaning ikkala nusxasi va toʻlov jadvalini yuboring. Moliya boʻlimi farq sababini tekshiradi va hisob-kitobni taqdim etadi.',
  },
  {
    department: 'schools', topic: 'Maktab direktori yuzasidan shikoyat', region: 'Xorazm viloyati', channel: 'instagram', priority: 'normal',
    summary: 'Ota-ona maktab direktori qabul vaqtiga oid tartibdan shikoyat qilgan.',
    text: 'Maktab direktoriga sinfdagi nizoni tushuntirish uchun uch marta keldim. Qabul jadvali eʼlon qilingan, ammo meni hech kim qabul qilmadi.',
    answer: 'Qabul jadvali suratini va tashrif sanalarini yuboring. Tuman taʼlim boʻlimi uchrashuv vaqtini maktab bilan muvofiqlashtiradi.',
  },
  {
    department: 'attestation', topic: topics.certification.label, region: 'Andijon viloyati', channel: 'telegram', priority: 'low',
    summary: 'Elektron sertifikatda pedagogning lavozimi notoʻgʻri yozilgan.',
    text: 'Attestatsiyadan keyin olgan sertifikatimda lavozimim xato yozilgan. Tuzatish uchun qayerga ariza berishim kerak?',
    answer: 'Sertifikat raqami va lavozimni tasdiqlovchi buyruq nusxasini yuboring. Markaz maʼlumotni qayd daftariga solishtiradi.',
  },
  {
    department: 'regional', topic: 'Taʼlim muassasasiga kirish', region: null, channel: 'web', priority: 'normal',
    summary: 'Oʻquv markazi pandusdan foydalanish imkonini cheklagan.',
    text: 'Oʻquv markazi binosining pandusli kirish eshigi qulflanadi. Bir necha marta maʼmuriyatga aytdim, lekin masala hal boʻlmadi.',
    answer: 'Muassasa manzili va muammo kuzatilgan vaqtlarni yozing. Hududiy boʻlim binoga kirish holatini tekshiradi.',
  },
  {
    department: 'higher', topic: topics.restoration.label, region: 'Toshkent viloyati', channel: 'web', priority: 'high',
    summary: 'Oʻqishni qayta tiklash toʻgʻrisida yozma qaror yuborilmagan.',
    text: 'Oʻqishni qayta tiklash soʻrovimga faqat telefon orqali rad javobi berishdi. Yozma qarorni ikki marta soʻradim, hanuz olmadi.',
    answer: 'Ariza nusxasi va ogʻzaki bildirishnoma sanasini yuboring. Universitetdan yozma qaror va uning asoslari soʻraladi.',
  },
  {
    department: 'regional', topic: 'Maktab direktori yuzasidan shikoyat', region: 'Samarqand viloyati', channel: 'telegram', priority: 'high',
    summary: 'Hududiy boʻlim maktab boshqaruvi boʻyicha shikoyatga javob bermagan.',
    text: 'Maktab rahbariyati ota-onalar bilan uchrashuvni bir necha bor bekor qildi. Hududiy boʻlimga shikoyat qildim, javob kelmadi.',
    answer: 'Hududiy boʻlimga berilgan murojaat raqamini yuboring. Maktab bilan uchrashuv rejasini va murojaatga javob holatini aniqlashtiramiz.',
  },
] satisfies TicketExample[]

export function similarResolvedTickets(ticket: Ticket, entries: Iterable<Ticket>): Ticket['similar_cases'] {
  const score = (other: Ticket) => other.topic === ticket.topic ? 2 : Number(other.department === ticket.department)
  return Array.from(entries)
    .filter((other) => other.id !== ticket.id && other.status === 'answered' && other.final_answer)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .map(({ number, summary, final_answer }) => ({ number, summary, answer: final_answer ?? undefined }))
}
