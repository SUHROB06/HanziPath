import type { Locale } from '../i18n'

export type ExamListeningQuestion = {
  level: number
  audio: string
  pinyin: string
  prompt: Record<Locale, string>
  options: string[]
  answer: string
  explanation: Record<Locale, string>
}

// Original practice dialogues and short monologues. They are not copied from
// official papers; each item tests a concrete detail rather than translation.
export const examListeningBank: ExamListeningQuestion[] = [
  {
    level: 1, audio: '你叫什么名字？我叫王明。', pinyin: 'Nǐ jiào shénme míngzi? Wǒ jiào Wáng Míng.',
    prompt: { ru: '男的叫什么名字？', en: 'What is the man’s name?', uz: 'Erkakning ismi nima?' },
    options: ['王明', '李华', '张伟'], answer: '王明',
    explanation: { ru: 'Он представился как 王明.', en: 'He introduces himself as 王明.', uz: 'U o‘zini 王明 deb tanishtirdi.' },
  },
  {
    level: 1, audio: '现在几点？现在三点。', pinyin: 'Xiànzài jǐ diǎn? Xiànzài sān diǎn.',
    prompt: { ru: 'Сколько сейчас времени?', en: 'What time is it now?', uz: 'Hozir soat necha?' },
    options: ['两点', '三点', '四点'], answer: '三点',
    explanation: { ru: 'В ответе сказано: сейчас три часа.', en: 'The reply says it is three o’clock.', uz: 'Javobda hozir soat uch ekani aytilgan.' },
  },
  {
    level: 1, audio: '你喜欢喝茶吗？我喜欢喝水，不喜欢喝茶。', pinyin: 'Nǐ xǐhuan hē chá ma? Wǒ xǐhuan hē shuǐ, bù xǐhuan hē chá.',
    prompt: { ru: 'Что человек предпочитает пить?', en: 'What does the speaker prefer to drink?', uz: 'So‘zlovchi nima ichishni afzal ko‘radi?' },
    options: ['水', '茶', '咖啡'], answer: '水',
    explanation: { ru: 'Говорящий прямо говорит, что любит пить воду, а не чай.', en: 'The speaker says they like water, not tea.', uz: 'So‘zlovchi choyni emas, suvni yoqtirishini aytadi.' },
  },
  {
    level: 2, audio: '你怎么去学校？我每天坐公共汽车去。', pinyin: 'Nǐ zěnme qù xuéxiào? Wǒ měitiān zuò gōnggòng qìchē qù.',
    prompt: { ru: 'Как человек добирается до школы?', en: 'How does the speaker get to school?', uz: 'So‘zlovchi maktabga qanday boradi?' },
    options: ['坐公共汽车', '骑自行车', '走路'], answer: '坐公共汽车',
    explanation: { ru: 'Он говорит, что каждый день едет на автобусе.', en: 'The speaker says they take the bus every day.', uz: 'U har kuni avtobusda borishini aytadi.' },
  },
  {
    level: 2, audio: '你买了几本书？我买了两本中文书和一本英语书。', pinyin: 'Nǐ mǎi le jǐ běn shū? Wǒ mǎi le liǎng běn Zhōngwén shū hé yì běn Yīngyǔ shū.',
    prompt: { ru: 'Сколько книг купил человек?', en: 'How many books did the person buy?', uz: 'So‘zlovchi nechta kitob sotib oldi?' },
    options: ['两本', '三本', '四本'], answer: '三本',
    explanation: { ru: 'Две книги на китайском и одна на английском — всего три.', en: 'Two Chinese books plus one English book makes three.', uz: 'Ikki xitoycha va bitta inglizcha kitob — jami uchta.' },
  },
  {
    level: 2, audio: '周末你想做什么？我想去公园打篮球。', pinyin: 'Zhōumò nǐ xiǎng zuò shénme? Wǒ xiǎng qù gōngyuán dǎ lánqiú.',
    prompt: { ru: 'Что человек собирается делать в выходные?', en: 'What does the speaker plan to do at the weekend?', uz: 'So‘zlovchi dam olish kunlari nima qilmoqchi?' },
    options: ['去公园打篮球', '在家看电影', '去商店买衣服'], answer: '去公园打篮球',
    explanation: { ru: 'Он планирует пойти в парк играть в баскетбол.', en: 'The speaker plans to play basketball in the park.', uz: 'U bog‘ga borib basketbol o‘ynamoqchi.' },
  },
  {
    level: 3, audio: '你昨天为什么没来上课？我感冒了，去医院看医生了。', pinyin: 'Nǐ zuótiān wèishénme méi lái shàngkè? Wǒ gǎnmào le, qù yīyuàn kàn yīshēng le.',
    prompt: { ru: 'Почему человек вчера не пришёл на занятие?', en: 'Why did the person miss class yesterday?', uz: 'So‘zlovchi kecha nima uchun darsga kelmadi?' },
    options: ['感冒了', '忘了时间', '要去旅行'], answer: '感冒了',
    explanation: { ru: 'Он простудился и ходил к врачу.', en: 'The speaker caught a cold and went to see a doctor.', uz: 'U shamollab, shifokorga borgan.' },
  },
  {
    level: 3, audio: '这件衣服怎么样？颜色不错，就是有点儿贵。', pinyin: 'Zhè jiàn yīfu zěnmeyàng? Yánsè búcuò, jiùshì yǒudiǎnr guì.',
    prompt: { ru: 'Что человек думает об одежде?', en: 'What does the speaker think about the clothes?', uz: 'So‘zlovchi kiyim haqida qanday fikrda?' },
    options: ['颜色不错，但是贵', '颜色不好，而且便宜', '大小合适，但是旧'], answer: '颜色不错，但是贵',
    explanation: { ru: 'Цвет нравится, но цена кажется высокой.', en: 'The color is nice, but the price is high.', uz: 'Rangi yaxshi, lekin narxi qimmat.' },
  },
  {
    level: 3, audio: '会议几点开始？原来九点，现在改到九点半。', pinyin: 'Huìyì jǐ diǎn kāishǐ? Yuánlái jiǔ diǎn, xiànzài gǎi dào jiǔ diǎn bàn.',
    prompt: { ru: 'Во сколько теперь начинается собрание?', en: 'What time does the meeting start now?', uz: 'Yig‘ilish endi soat nechada boshlanadi?' },
    options: ['九点', '九点半', '十点'], answer: '九点半',
    explanation: { ru: 'Время изменили с девяти на половину десятого.', en: 'The start time changed from nine to half past nine.', uz: 'Boshlanish vaqti to‘qqizdan to‘qqiz yarimga o‘zgargan.' },
  },
  {
    level: 4, audio: '你把报告发给经理了吗？我已经发了，不过还没收到回复。', pinyin: 'Nǐ bǎ bàogào fā gěi jīnglǐ le ma? Wǒ yǐjīng fā le, búguò hái méi shōudào huífù.',
    prompt: { ru: 'Что известно об отчёте?', en: 'What is true about the report?', uz: 'Hisobot haqida nima ma’lum?' },
    options: ['已经发出，还没有回复', '经理还没有收到', '需要重新写一份'], answer: '已经发出，还没有回复',
    explanation: { ru: 'Отчёт уже отправлен, но ответа пока нет.', en: 'The report has been sent, but no reply has arrived.', uz: 'Hisobot yuborilgan, ammo hali javob kelmagan.' },
  },
  {
    level: 4, audio: '地铁今天怎么这么慢？前面有一站正在维修，列车需要减速。', pinyin: 'Dìtiě jīntiān zěnme zhème màn? Qiánmiàn yǒu yí zhàn zhèngzài wéixiū, lièchē xūyào jiǎnsù.',
    prompt: { ru: 'Почему поезд метро едет медленнее?', en: 'Why is the subway train moving more slowly?', uz: 'Metro poyezdi nima uchun sekinroq harakatlanmoqda?' },
    options: ['前面车站正在维修', '今天乘客特别多', '列车出了故障'], answer: '前面车站正在维修',
    explanation: { ru: 'На одной из следующих станций идут ремонтные работы.', en: 'A station ahead is under maintenance.', uz: 'Oldindagi bekatlardan birida ta’mirlash ishlari ketmoqda.' },
  },
  {
    level: 4, audio: '你觉得这个方案怎么样？想法很好，但预算可能不够。', pinyin: 'Nǐ juéde zhège fāngàn zěnmeyàng? Xiǎngfǎ hěn hǎo, dàn yùsuàn kěnéng bú gòu.',
    prompt: { ru: 'Что вызывает сомнение у собеседника?', en: 'What concern does the speaker raise?', uz: 'Suhbatdosh nimadan xavotirda?' },
    options: ['预算可能不够', '时间已经来不及', '团队没有经验'], answer: '预算可能不够',
    explanation: { ru: 'Идея нравится, но бюджета может не хватить.', en: 'The idea is good, but the budget may be insufficient.', uz: 'G‘oya yaxshi, ammo budjet yetmasligi mumkin.' },
  },
  {
    level: 5, audio: '原定周五的活动因为天气原因推迟到下周一，已经报名的人不用重新登记。', pinyin: 'Yuándìng zhōuwǔ de huódòng yīnwèi tiānqì yuányīn tuīchí dào xià zhōuyī, yǐjīng bàomíng de rén búyòng chóngxīn dēngjì.',
    prompt: { ru: 'Что изменилось в расписании мероприятия?', en: 'What changed in the event schedule?', uz: 'Tadbir jadvalida nima o‘zgardi?' },
    options: ['改到下周一', '提前到周三', '仍然在周五举行'], answer: '改到下周一',
    explanation: { ru: 'Из-за погоды мероприятие перенесли с пятницы на следующий понедельник.', en: 'The event was moved from Friday to next Monday because of the weather.', uz: 'Ob-havo sababli tadbir jumadan keyingi dushanbaga ko‘chirildi.' },
  },
  {
    level: 5, audio: '公司这次招聘更看重实际项目经验，学历只是参考之一。', pinyin: 'Gōngsī zhè cì zhāopìn gèng kànzhòng shíjì xiàngmù jīngyàn, xuélì zhǐshì cānkǎo zhī yī.',
    prompt: { ru: 'Что компания считает особенно важным при найме?', en: 'What does the company value most in recruitment?', uz: 'Kompaniya ishga qabul qilishda nimani ko‘proq qadrlaydi?' },
    options: ['实际项目经验', '毕业学校的排名', '工作年限的长短'], answer: '实际项目经验',
    explanation: { ru: 'В объявлении подчёркивается практический опыт проектов.', en: 'The statement emphasizes hands-on project experience.', uz: 'Bayonotda amaliy loyiha tajribasi muhimligi ta’kidlangan.' },
  },
  {
    level: 5, audio: '虽然这项研究样本不大，但连续三次实验都得到了相近结果，因此团队准备扩大测试范围。', pinyin: 'Suīrán zhè xiàng yánjiū yàngběn bú dà, dàn liánxù sān cì shíyàn dōu dédào le xiāngjìn jiéguǒ, yīncǐ tuánduì zhǔnbèi kuòdà cèshì fànwéi.',
    prompt: { ru: 'Почему команда решила расширить исследование?', en: 'Why did the team decide to expand the study?', uz: 'Jamoa nima uchun tadqiqotni kengaytirishga qaror qildi?' },
    options: ['三次实验结果相近', '样本已经足够大', '研究经费突然增加'], answer: '三次实验结果相近',
    explanation: { ru: 'Три эксперимента дали похожие результаты, поэтому команда хочет проверить их на большей выборке.', en: 'Three experiments produced similar results, so the team wants to test on a larger sample.', uz: 'Uch tajriba o‘xshash natija berdi, shu sabab jamoa kattaroq namunada tekshirmoqchi.' },
  },
  {
    level: 6, audio: '报告没有把销量下降完全归因于价格上涨。调查显示，配送时间变长和售后服务不稳定同样影响了顾客的选择。', pinyin: 'Bàogào méiyǒu bǎ xiāoliàng xiàjiàng wánquán guīyīn yú jiàgé shàngzhǎng. Diàochá xiǎnshì, pèisòng shíjiān biàn cháng hé shòuhòu fúwù bù wěndìng tóngyàng yǐngxiǎng le gùkè de xuǎnzé.',
    prompt: { ru: 'Какой вывод точнее всего передаёт содержание отчёта?', en: 'Which statement best reflects the report?', uz: 'Qaysi xulosa hisobot mazmunini eng to‘g‘ri ifodalaydi?' },
    options: ['销量下降有多个原因', '价格是唯一原因', '顾客不再需要配送服务'], answer: '销量下降有多个原因',
    explanation: { ru: 'В отчёте названы три фактора: цена, доставка и качество послепродажного обслуживания.', en: 'The report identifies price, delivery time, and after-sales service as contributing factors.', uz: 'Hisobotda narx, yetkazib berish va sotuvdan keyingi xizmat omillari keltirilgan.' },
  },
  {
    level: 6, audio: '有人认为远程办公一定能提高效率，但实际情况取决于工作性质、团队沟通方式以及员工是否具备合适的工作环境。', pinyin: 'Yǒurén rènwéi yuǎnchéng bàngōng yídìng néng tígāo xiàolǜ, dàn shíjì qíngkuàng qǔjué yú gōngzuò xìngzhì, tuánduì gōutōng fāngshì yǐjí yuángōng shìfǒu jùbèi héshì de gōngzuò huánjìng.',
    prompt: { ru: 'Какова основная мысль высказывания?', en: 'What is the main point of the statement?', uz: 'Bayonotning asosiy mazmuni nima?' },
    options: ['远程办公效果取决于多种条件', '远程办公总是效率更高', '所有工作都适合在家完成'], answer: '远程办公效果取决于多种条件',
    explanation: { ru: 'Эффект удалённой работы зависит от нескольких условий, а не гарантирован автоматически.', en: 'Remote-work effectiveness depends on several conditions; it is not automatic.', uz: 'Masofaviy ish samarasi bir nechta shartga bog‘liq, u doim ham yuqori bo‘lavermaydi.' },
  },
  {
    level: 6, audio: '这项改革短期内增加了企业的调整成本，不过从长期来看，统一的流程减少了重复审核，也让不同部门之间的信息更容易共享。', pinyin: 'Zhè xiàng gǎigé duǎnqī nèi zēngjiā le qǐyè de tiáozhěng chéngběn, búguò cóng chángqī lái kàn, tǒngyī de liúchéng jiǎnshǎo le chóngfù shěnhé, yě ràng bùtóng bùmén zhījiān de xìnxī gèng róngyì gòngxiǎng.',
    prompt: { ru: 'Какой долгосрочный результат реформы назван в тексте?', en: 'Which long-term result of the reform is mentioned?', uz: 'Matnda islohotning qaysi uzoq muddatli natijasi aytilgan?' },
    options: ['减少重复审核并促进信息共享', '完全取消部门之间的沟通', '降低了改革初期的调整成本'], answer: '减少重复审核并促进信息共享',
    explanation: { ru: 'В долгосрочной перспективе единый процесс сокращает повторные проверки и облегчает обмен информацией.', en: 'Over time, standardized processes reduce duplicate reviews and improve information sharing.', uz: 'Uzoq muddatda yagona jarayon takroriy tekshiruvlarni kamaytirib, axborot almashinuvini yaxshilaydi.' },
  },
]
