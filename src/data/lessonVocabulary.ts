import type { CourseLevel, CourseSystem } from './curriculum'

export type LessonVocabularyEntry = {
  stage: CourseLevel
  systems: CourseSystem[]
  hanzi: string
  pinyin: string
  ru: string
  en: string
  uz: string
}

// Original HanziPath teaching vocabulary, written for course activities.
// Stage labels describe our learning sequence; they do not assert official HSK membership.
// RU/UZ glosses are draft translations and need a fluent human review before release.
const rows = `
1|你好|nǐ hǎo|привет|hello|salom
1|谢谢|xièxie|спасибо|thank you|rahmat
1|再见|zàijiàn|до свидания|goodbye|xayr
1|请|qǐng|пожалуйста; просить|please; to invite|iltimos; taklif qilmoq
1|对不起|duìbuqǐ|извините|sorry|kechirasiz
1|没关系|méi guānxi|ничего страшного|it does not matter|hechqisi yo‘q
1|早上|zǎoshang|утро|morning|ertalab
1|上午|shàngwǔ|до полудня|forenoon|tushgacha
1|中午|zhōngwǔ|полдень|noon|tush payti
1|下午|xiàwǔ|после полудня|afternoon|tushdan keyin
1|晚上|wǎnshang|вечер|evening|kechqurun
1|今天|jīntiān|сегодня|today|bugun
1|明天|míngtiān|завтра|tomorrow|ertaga
1|昨天|zuótiān|вчера|yesterday|kecha
1|星期|xīngqī|неделя; день недели|week|hafta
1|月份|yuèfèn|месяц календаря|calendar month|kalendar oyi
1|年份|niánfèn|год; годовой период|year; calendar year|yil
1|现在|xiànzài|сейчас|now|hozir
1|分钟|fēnzhōng|минута|minute|daqiqa
1|时候|shíhou|момент; время|time; moment|payt
1|学校|xuéxiào|школа|school|maktab
1|学生|xuésheng|ученик; студент|student|o‘quvchi; talaba
1|老师|lǎoshī|учитель|teacher|o‘qituvchi
1|同学|tóngxué|одноклассник; однокурсник|classmate|sinfdosh; kursdosh
1|汉语|Hànyǔ|китайский язык|Chinese language|xitoy tili
1|中文|Zhōngwén|китайский язык; китайский текст|Chinese language; Chinese text|xitoy tili; xitoycha matn
1|学习|xuéxí|учиться; изучать|to study|o‘rganmoq
1|课本|kèběn|учебник|textbook|darslik
1|汉字|Hànzì|китайский иероглиф|Chinese character|xitoy ieroglifi
1|名字|míngzi|имя|name|ism
1|姓|xìng|фамилия|surname|familiya
1|朋友|péngyou|друг|friend|do‘st
1|家人|jiārén|члены семьи|family members|oila a’zolari
1|爸爸|bàba|папа|father; dad|dada
1|妈妈|māma|мама|mother; mom|ona
1|哥哥|gēge|старший брат|older brother|aka
1|姐姐|jiějie|старшая сестра|older sister|opa
1|弟弟|dìdi|младший брат|younger brother|uka
1|妹妹|mèimei|младшая сестра|younger sister|singil
1|人|rén|человек|person|odam
1|这里|zhèlǐ|здесь|here|bu yerda
1|那里|nàlǐ|там|there|u yerda
1|哪儿|nǎr|где; куда|where|qayer; qayerga
1|这个|zhège|этот; это|this one|bu
1|那个|nàge|тот; то|that one|u
1|什么|shénme|что; какой|what|nima; qanday
1|谁|shéi|кто|who|kim
1|有|yǒu|иметь; быть в наличии|to have; there is|bor bo‘lmoq; ega bo‘lmoq
1|没有|méiyǒu|не иметь; нет|not have; there is not|yo‘q; ega emas
1|喜欢|xǐhuan|нравиться; любить|to like|yoqtirmoq
2|早饭|zǎofàn|завтрак|breakfast|nonushta
2|午饭|wǔfàn|обед|lunch|tushlik
2|晚饭|wǎnfàn|ужин|dinner|kechki ovqat
2|米饭|mǐfàn|варёный рис|cooked rice|pishirilgan guruch
2|面条|miàntiáo|лапша|noodles|ugra
2|饺子|jiǎozi|пельмени цзяоцзы|dumplings|chuchvara
2|鸡蛋|jīdàn|яйцо|egg|tuxum
2|苹果|píngguǒ|яблоко|apple|olma
2|西瓜|xīguā|арбуз|watermelon|tarvuz
2|牛奶|niúnǎi|молоко|milk|sut
2|茶水|cháshuǐ|чай; чайная вода|tea|choy
2|菜单|càidān|меню|menu|menyu
2|口味|kǒuwèi|вкус; вкусовое предпочтение|taste; flavor|ta’m
2|好吃|hǎochī|вкусный (о еде)|tasty|mazali
2|饿|è|голодный|hungry|och
2|渴|kě|испытывать жажду|thirsty|chanqagan
2|餐厅|cāntīng|ресторан; столовая|restaurant|restoran; oshxona
2|超市|chāoshì|супермаркет|supermarket|supermarket
2|商店|shāngdiàn|магазин|shop|do‘kon
2|买|mǎi|покупать|to buy|sotib olmoq
2|卖|mài|продавать|to sell|sotmoq
2|便宜|piányi|недорогой|inexpensive|arzon
2|贵|guì|дорогой|expensive|qimmat
2|价格|jiàgé|цена|price|narx
2|零钱|língqián|мелочь; небольшие деньги|small change|mayda pul
2|付款|fùkuǎn|оплачивать|to pay|to‘lamoq
2|现金|xiànjīn|наличные деньги|cash|naqd pul
2|衣服|yīfu|одежда|clothes|kiyim
2|颜色|yánsè|цвет|color|rang
2|大小|dàxiǎo|размер; величина|size|o‘lcham
2|试穿|shìchuān|примерять одежду|to try on|kiyib ko‘rmoq
2|天气|tiānqì|погода|weather|ob-havo
2|下雨|xiàyǔ|идёт дождь|to rain|yomg‘ir yog‘moq
2|下雪|xiàxuě|идёт снег|to snow|qor yog‘moq
2|晴天|qíngtiān|солнечная погода|sunny weather|quyoshli ob-havo
2|刮风|guāfēng|дует ветер|to be windy|shamol esmoq
2|冷|lěng|холодный|cold|sovuq
2|热|rè|жаркий; горячий|hot|issiq
2|春天|chūntiān|весна|spring|bahor
2|夏天|xiàtiān|лето|summer|yoz
2|秋天|qiūtiān|осень|autumn|kuz
2|冬天|dōngtiān|зима|winter|qish
2|公共汽车|gōnggòng qìchē|автобус|bus|avtobus
2|地铁|dìtiě|метро|subway|metro
2|火车站|huǒchēzhàn|железнодорожная станция|train station|temir yo‘l vokzali
2|机场|jīchǎng|аэропорт|airport|aeroport
2|走路|zǒulù|идти пешком|to walk|piyoda yurmoq
2|附近|fùjìn|поблизости|nearby|yaqin atrofda
3|身体|shēntǐ|тело; здоровье|body; health|tana; sog‘liq
3|健康|jiànkāng|здоровье; здоровый|health; healthy|sog‘liq; sog‘lom
3|感冒|gǎnmào|простудиться; простуда|to catch a cold; cold|shamollamoq; shamollash
3|发烧|fāshāo|иметь жар|to have a fever|isitmasi chiqmoq
3|药|yào|лекарство|medicine|dori
3|医院|yīyuàn|больница|hospital|shifoxona
3|医生|yīshēng|врач|doctor|shifokor
3|休息|xiūxi|отдыхать; отдых|to rest; rest|dam olmoq; dam
3|运动|yùndòng|заниматься спортом; движение|to exercise; sport|sport bilan shug‘ullanmoq; harakat
3|游泳|yóuyǒng|плавать|to swim|suzmoq
3|跑步|pǎobù|бегать|to run|yugurmoq
3|比赛|bǐsài|соревнование|competition|musobaqa
3|赢|yíng|побеждать|to win|yutmoq
3|输|shū|проигрывать|to lose|yutqazmoq
3|练习|liànxí|тренироваться; упражнение|to practice; exercise|mashq qilmoq; mashq
3|认真|rènzhēn|старательный; серьёзно|serious; conscientious|jiddiy; tirishqoq
3|容易|róngyì|лёгкий; легко|easy|oson
3|困难|kùnnan|трудный; трудность|difficult; difficulty|qiyin; qiyinchilik
3|办法|bànfǎ|способ; решение|method; solution|usul; yechim
3|决定|juédìng|решать; решение|to decide; decision|qaror qilmoq; qaror
3|打算|dǎsuàn|планировать; план|to plan; plan|rejalashtirmoq; reja
3|准备|zhǔnbèi|готовиться; подготовить|to prepare|tayyorlanmoq; tayyorlamoq
3|迟到|chídào|опоздать|to be late|kechikmoq
3|准时|zhǔnshí|вовремя; пунктуальный|on time; punctual|o‘z vaqtida; punktual
3|已经|yǐjīng|уже|already|allaqachon
3|刚才|gāngcái|только что|just now|hozirgina
3|后来|hòulái|позже; впоследствии|later; afterward|keyin; keyinchalik
3|以前|yǐqián|раньше; прежде|before; formerly|oldin; avval
3|以后|yǐhòu|после; в будущем|after; in the future|keyin; kelajakda
3|突然|tūrán|внезапно|suddenly|to‘satdan
3|终于|zhōngyú|наконец|finally|nihoyat
3|附近|fùjìn|поблизости|nearby|yaqin atrofda
3|地图|dìtú|карта|map|xarita
3|方向|fāngxiàng|направление|direction|yo‘nalish
3|左边|zuǒbian|левая сторона; слева|left side; on the left|chap tomon; chapda
3|右边|yòubian|правая сторона; справа|right side; on the right|o‘ng tomon; o‘ngda
3|一直|yìzhí|всё время; прямо|all along; straight|doimo; to‘g‘ri
3|拐弯|guǎiwān|поворачивать; поворот|to turn; turn|burilmoq; burilish
3|过马路|guò mǎlù|переходить дорогу|to cross the road|yo‘lni kesib o‘tmoq
3|旅行|lǚxíng|путешествовать; поездка|to travel; trip|sayohat qilmoq; sayohat
3|护照|hùzhào|паспорт|passport|pasport
3|行李|xíngli|багаж|luggage|yuk
3|预订|yùdìng|бронировать|to reserve|band qilmoq
3|宾馆|bīnguǎn|гостиница|hotel|mehmonxona
3|照相|zhàoxiàng|фотографировать|to take a photo|suratga olmoq
3|风景|fēngjǐng|пейзаж; вид|scenery|manzara
3|文化|wénhuà|культура|culture|madaniyat
3|习惯|xíguàn|привычка; привыкать|habit; to get used to|odat; ko‘nikmoq
3|关心|guānxīn|заботиться; интересоваться|to care about|g‘amxo‘rlik qilmoq
3|放心|fàngxīn|не волноваться; быть спокойным|to feel relieved|xotirjam bo‘lmoq
4|报名|bàomíng|записываться; регистрация|to sign up; registration|ro‘yxatdan o‘tmoq; ro‘yxatdan o‘tish
4|申请|shēnqǐng|подавать заявление|to apply|ariza bermoq
4|面试|miànshì|собеседование|interview|suhbat
4|工作经验|gōngzuò jīngyàn|опыт работы|work experience|ish tajribasi
4|同事|tóngshì|коллега|colleague|hamkasb
4|经理|jīnglǐ|менеджер; управляющий|manager|menejer; boshqaruvchi
4|会议|huìyì|совещание; встреча|meeting|yig‘ilish
4|意见|yìjiàn|мнение; предложение|opinion; suggestion|fikr; taklif
4|建议|jiànyì|советовать; совет|to suggest; suggestion|maslahat bermoq; maslahat
4|讨论|tǎolùn|обсуждать; обсуждение|to discuss; discussion|muhokama qilmoq; muhokama
4|计划|jìhuà|план; планировать|plan; to plan|reja; rejalashtirmoq
4|安排|ānpái|организовать;安排|to arrange|tashkil qilmoq
4|完成|wánchéng|завершить|to complete|tugatmoq
4|检查|jiǎnchá|проверять; проверка|to check; inspection|tekshirmoq; tekshiruv
4|问题|wèntí|вопрос; проблема|question; problem|savol; muammo
4|原因|yuányīn|причина|reason|sabab
4|结果|jiéguǒ|результат|result|natija
4|影响|yǐngxiǎng|влиять; влияние|to influence; effect|ta’sir qilmoq; ta’sir
4|负责|fùzé|отвечать за; ответственный|to be responsible for|javobgar bo‘lmoq
4|帮助|bāngzhù|помогать; помощь|to help; help|yordam bermoq; yordam
4|联系|liánxì|связываться; связь|to contact; contact|bog‘lanmoq; aloqa
4|通知|tōngzhī|сообщать; уведомление|to notify; notice|xabardor qilmoq; bildirishnoma
4|消息|xiāoxi|сообщение; новость|message; news|xabar; yangilik
4|邮件|yóujiàn|электронное письмо|email|elektron xat
4|地址|dìzhǐ|адрес|address|manzil
4|号码|hàomǎ|номер|number|raqam
4|方便|fāngbiàn|удобный; удобно|convenient|qulay
4|麻烦|máfan|затруднение; хлопотный|trouble; troublesome|ovora; noqulay
4|准时|zhǔnshí|точно вовремя|punctual|o‘z vaqtida
4|迟到|chídào|опаздывать|to be late|kechikmoq
4|加班|jiābān|работать сверхурочно|to work overtime|qo‘shimcha ishlamoq
4|休假|xiūjià|брать отпуск|to take leave|ta’til olmoq
4|工资|gōngzī|зарплата|salary|maosh
4|收入|shōurù|доход|income|daromad
4|费用|fèiyòng|расходы; плата|cost; expense|xarajat; to‘lov
4|节约|jiéyuē|экономить; беречь|to save; economize|tejamoq
4|浪费|làngfèi|тратить впустую; расточительство|to waste|isrof qilmoq
4|质量|zhìliàng|качество|quality|sifat
4|服务|fúwù|обслуживание; обслуживать|service; to serve|xizmat; xizmat ko‘rsatmoq
4|顾客|gùkè|покупатель; клиент|customer|mijoz
4|退货|tuìhuò|вернуть товар|to return goods|tovarni qaytarmoq
4|换|huàn|менять; обменивать|to change; exchange|almashtirmoq
4|合适|héshì|подходящий|suitable|mos
4|选择|xuǎnzé|выбирать; выбор|to choose; choice|tanlamoq; tanlov
4|比较|bǐjiào|сравнивать; сравнительно|to compare; relatively|taqqoslamoq; nisbatan
4|尤其|yóuqí|особенно|especially|ayniqsa
4|虽然|suīrán|хотя|although|garchi
4|不过|búguò|однако; но|however; but|biroq; ammo
5|目标|mùbiāo|цель|goal|maqsad
5|机会|jīhuì|возможность|opportunity|imkoniyat
5|经验|jīngyàn|опыт|experience|tajriba
5|能力|nénglì|способность; умение|ability|qobiliyat
5|提高|tígāo|повышать; улучшать|to improve; raise|oshirmoq; yaxshilamoq
5|进步|jìnbù|прогресс; продвигаться|progress; to improve|taraqqiyot; rivojlanmoq
5|努力|nǔlì|стараться; усердный|to work hard; diligent|harakat qilmoq; tirishqoq
5|成功|chénggōng|успех; преуспеть|success; to succeed|muvaffaqiyat; muvaffaqiyat qozonmoq
5|失败|shībài|неудача; потерпеть неудачу|failure; to fail|muvaffaqiyatsizlik; muvaffaqiyatsizlikka uchramoq
5|信心|xìnxīn|уверенность|confidence|ishonch
5|耐心|nàixīn|терпение; терпеливый|patience; patient|sabr; sabrli
5|习惯|xíguàn|привычка|habit|odat
5|适应|shìyìng|приспосабливаться|to adapt|moslashmoq
5|改变|gǎibiàn|изменять; изменение|to change; change|o‘zgartirmoq; o‘zgarish
5|保持|bǎochí|сохранять; поддерживать|to maintain|saqlamoq
5|继续|jìxù|продолжать|to continue|davom ettirmoq
5|放弃|fàngqì|отказываться; бросать|to give up|voz kechmoq
5|考虑|kǎolǜ|обдумывать; учитывать|to consider|o‘ylab ko‘rmoq
5|判断|pànduàn|судить; оценивать|to judge; assess|baholamoq
5|理解|lǐjiě|понимать; понимание|to understand; understanding|tushunmoq; tushuncha
5|解释|jiěshì|объяснять; объяснение|to explain; explanation|tushuntirmoq; izoh
5|说明|shuōmíng|разъяснять; пояснение|to explain; explanation|izohlamoq; tushuntirish
5|证明|zhèngmíng|доказывать; доказательство|to prove; proof|isbotlamoq; isbot
5|发现|fāxiàn|обнаруживать; открытие|to discover; discovery|aniqlamoq; kashfiyot
5|研究|yánjiū|исследовать; исследование|to research; research|tadqiq qilmoq; tadqiqot
5|调查|diàochá|изучать; опрос|to investigate; survey|tekshirmoq; so‘rov
5|资料|zīliào|материалы; данные|materials; data|materiallar; ma’lumotlar
5|信息|xìnxī|информация|information|axborot
5|知识|zhīshi|знание|knowledge|bilim
5|内容|nèiróng|содержание|content|mazmun
5|重点|zhòngdiǎn|основной пункт; акцент|key point; focus|asosiy nuqta; e’tibor
5|方法|fāngfǎ|метод; способ|method|usul
5|过程|guòchéng|процесс|process|jarayon
5|机会|jīhuì|шанс; возможность|chance; opportunity|imkon; imkoniyat
5|条件|tiáojiàn|условие|condition|shart
5|要求|yāoqiú|требовать; требование|to require; requirement|talab qilmoq; talab
5|标准|biāozhǔn|стандарт|standard|standart
5|规则|guīzé|правило|rule|qoida
5|法律|fǎlǜ|закон; право|law|qonun; huquq
5|安全|ānquán|безопасность; безопасный|safety; safe|xavfsizlik; xavfsiz
5|危险|wēixiǎn|опасность; опасный|danger; dangerous|xavf; xavfli
5|责任|zérèn|ответственность|responsibility|mas’uliyat
5|权利|quánlì|право; полномочие|right; authority|huquq; vakolat
5|尊重|zūnzhòng|уважать; уважение|to respect; respect|hurmat qilmoq; hurmat
5|信任|xìnrèn|доверять; доверие|to trust; trust|ishonmoq; ishonch
5|关系|guānxi|отношения; связь|relationship; connection|munosabat; aloqa
5|合作|hézuò|сотрудничать; сотрудничество|to cooperate; cooperation|hamkorlik qilmoq; hamkorlik
5|竞争|jìngzhēng|конкурировать; конкуренция|to compete; competition|raqobatlashmoq; raqobat
5|影响|yǐngxiǎng|влиять; влияние|to affect; influence|ta’sir qilmoq; ta’sir
5|结果|jiéguǒ|итог; результат|outcome; result|yakun; natija
5|因此|yīncǐ|поэтому; вследствие этого|therefore|shu sababli
5|同时|tóngshí|одновременно; в то же время|at the same time|bir vaqtning o‘zida
6|社会|shèhuì|общество|society|jamiyat
6|城市|chéngshì|город|city|shahar
6|农村|nóngcūn|сельская местность|rural area|qishloq joy
6|人口|rénkǒu|население|population|aholi
6|环境|huánjìng|окружающая среда; условия|environment|atrof-muhit; sharoit
6|污染|wūrǎn|загрязнять; загрязнение|to pollute; pollution|ifloslantirmoq; ifloslanish
6|空气|kōngqì|воздух|air|havo
6|资源|zīyuán|ресурсы|resources|resurslar
6|能源|néngyuán|энергия; энергетические ресурсы|energy|energiya manbalari
6|节能|jiénéng|экономить энергию|to save energy|energiyani tejamoq
6|保护|bǎohù|защищать; охранять|to protect|himoya qilmoq
6|自然|zìrán|природа; естественный|nature; natural|tabiat; tabiiy
6|森林|sēnlín|лес|forest|o‘rmon
6|海洋|hǎiyáng|океан|ocean|okean
6|动物|dòngwù|животное|animal|hayvon
6|植物|zhíwù|растение|plant|o‘simlik
6|气候|qìhòu|климат|climate|iqlim
6|变化|biànhuà|изменяться; изменение|to change; change|o‘zgarmoq; o‘zgarish
6|人口增长|rénkǒu zēngzhǎng|рост населения|population growth|aholi o‘sishi
6|公共|gōnggòng|общественный; публичный|public|jamoat; ommaviy
6|交通|jiāotōng|транспорт; движение|transport; traffic|transport; qatnov
6|道路|dàolù|дорога|road|yo‘l
6|堵车|dǔchē|пробка на дороге|traffic jam|tirbandlik
6|建设|jiànshè|строить; строительство|to build; construction|qurmoq; qurilish
6|发展|fāzhǎn|развивать; развитие|to develop; development|rivojlantirmoq; rivojlanish
6|经济|jīngjì|экономика; экономический|economy; economic|iqtisod; iqtisodiy
6|贸易|màoyì|торговля|trade|savdo
6|市场|shìchǎng|рынок|market|bozor
6|产品|chǎnpǐn|продукт; изделие|product|mahsulot
6|技术|jìshù|технология; техника|technology; technique|texnologiya; texnika
6|科学|kēxué|наука; научный|science; scientific|fan; ilmiy
6|教育|jiàoyù|образование; обучать|education; to educate|ta’lim; ta’lim bermoq
6|医疗|yīliáo|медицинская помощь|medical care|tibbiy yordam
6|文化活动|wénhuà huódòng|культурное мероприятие|cultural activity|madaniy tadbir
6|传统|chuántǒng|традиция; традиционный|tradition; traditional|an’ana; an’anaviy
6|现代|xiàndài|современный; современность|modern; contemporary|zamonaviy; zamonaviy davr
6|历史|lìshǐ|история|history|tarix
6|新闻|xīnwén|новости|news|yangiliklar
6|媒体|méitǐ|средства массовой информации|media|ommaviy axborot vositalari
6|互联网|hùliánwǎng|интернет|internet|internet
6|网站|wǎngzhàn|веб-сайт|website|veb-sayt
6|密码|mìmǎ|пароль|password|parol
6|数据|shùjù|данные|data|ma’lumotlar
6|隐私|yǐnsī|частная жизнь; конфиденциальность|privacy|shaxsiy hayot; maxfiylik
6|个人|gèrén|личный; человек|personal; individual|shaxsiy; kishi
6|公共服务|gōnggòng fúwù|общественные услуги|public services|jamoat xizmatlari
6|改变|gǎibiàn|менять; перемена|to change; change|o‘zgartirmoq; o‘zgarish
6|面对|miànduì|сталкиваться; лицом к|to face|duch kelmoq
6|解决|jiějué|решать (проблему)|to solve|hal qilmoq
6|措施|cuòshī|мера; шаг|measure; step|chora; qadam
6|效果|xiàoguǒ|эффект; результат|effect; result|samara; natija
6|长期|chángqī|долгосрочный; длительный срок|long-term|uzoq muddatli
7|学术|xuéshù|академический; наука|academic; scholarship|akademik; ilm-fan
7|理论|lǐlùn|теория|theory|nazariya
7|概念|gàiniàn|понятие; концепция|concept|tushuncha; konsepsiya
7|定义|dìngyì|определять; определение|to define; definition|ta’riflamoq; ta’rif
7|范畴|fànchóu|категория; область|category; domain|toifa; soha
7|体系|tǐxì|система; структура|system|tizim
7|结构|jiégòu|структура|structure|tuzilma
7|机制|jīzhì|механизм|mechanism|mexanizm
7|模式|móshì|модель; схема|model; pattern|model; namuna
7|特征|tèzhēng|характерная черта|characteristic|xususiyat
7|现象|xiànxiàng|явление|phenomenon|hodisa
7|本质|běnzhì|сущность; суть|essence|mohiyat
7|趋势|qūshì|тенденция|trend|tendensiya
7|因素|yīnsù|фактор|factor|omil
7|变量|biànliàng|переменная|variable|o‘zgaruvchi
7|数据分析|shùjù fēnxī|анализ данных|data analysis|ma’lumotlar tahlili
7|样本|yàngběn|образец; выборка|sample|namuna; tanlanma
7|证据|zhèngjù|доказательство; свидетельство|evidence|dalil
7|假设|jiǎshè|гипотеза; предполагать|hypothesis; to assume|gipoteza; faraz qilmoq
7|结论|jiélùn|вывод; заключение|conclusion|xulosa
7|论证|lùnzhèng|аргументировать; обоснование|to argue; argumentation|asoslamoq; dalillash
7|方法论|fāngfǎlùn|методология|methodology|metodologiya
7|研究者|yánjiūzhě|исследователь|researcher|tadqiqotchi
7|文献|wénxiàn|научная литература; источники|literature; sources|ilmiy adabiyot; manbalar
7|引用|yǐnyòng|цитировать; ссылка|to cite; citation|iqtibos keltirmoq; havola
7|观点|guāndiǎn|точка зрения|viewpoint|nuqtai nazar
7|论点|lùndiǎn|тезис|thesis; argument|tezis; dalil
7|反驳|fǎnbó|опровергать; возражение|to refute; rebuttal|rad etmoq; e’tiroz
7|推理|tuīlǐ|рассуждать; вывод|reasoning; inference|mantiqiy fikrlash; xulosa
7|逻辑|luójí|логика; логический|logic; logical|mantiq; mantiqiy
7|相关|xiāngguān|связанный; взаимосвязь|related; correlation|bog‘liq; o‘zaro aloqa
7|差异|chāyì|различие|difference|farq
7|相似|xiāngsì|похожий; сходство|similar; similarity|o‘xshash; o‘xshashlik
7|范围|fànwéi|диапазон; сфера|range; scope|ko‘lam; doira
7|条件|tiáojiàn|условие|condition|shart
7|限制|xiànzhì|ограничивать; ограничение|to limit; limitation|cheklamoq; cheklov
7|有效|yǒuxiào|действительный; эффективный|valid; effective|haqiqiy; samarali
7|可靠|kěkào|надёжный|reliable|ishonchli
7|准确|zhǔnquè|точный|accurate|aniq
7|客观|kèguān|объективный|objective|obyektiv
7|主观|zhǔguān|субъективный|subjective|subyektiv
7|复杂|fùzá|сложный; комплексный|complex|murakkab
7|简化|jiǎnhuà|упрощать; упрощение|to simplify; simplification|soddalashtirmoq; soddalashtirish
7|评估|pínggū|оценивать; оценка|to evaluate; evaluation|baholamoq; baholash
7|解释力|jiěshìlì|объяснительная сила|explanatory power|izohlash quvvati
7|可重复|kě chóngfù|воспроизводимый|reproducible|takrorlanadigan
7|学科|xuékē|учебная дисциплина; отрасль науки|discipline; field|fan sohasi
7|跨学科|kuà xuékē|междисциплинарный|interdisciplinary|fanlararo
7|框架|kuàngjià|рамки; концептуальная схема|framework|asos; konseptual tuzilma
7|摘要|zhāiyào|аннотация; краткое изложение|abstract; summary|annotatsiya; qisqacha mazmun
8|治理|zhìlǐ|управление; регулирование|governance|boshqaruv; tartibga solish
8|政策|zhèngcè|политика; мера государства|policy|siyosat; davlat chorasi
8|制度|zhìdù|институт; система правил|system; institution|tizim; qoidalar majmui
8|机构|jīgòu|учреждение; организация|institution; organization|muassasa; tashkilot
8|公共利益|gōnggòng lìyì|общественный интерес|public interest|jamoat manfaati
8|公民|gōngmín|гражданин|citizen|fuqaro
8|参与|cānyù|участвовать; участие|to participate; participation|ishtirok etmoq; ishtirok
8|代表|dàibiǎo|представлять; представитель|to represent; representative|vakillik qilmoq; vakil
8|协商|xiéshāng|согласовывать; консультации|to consult; negotiate|maslahatlashmoq; kelishuv
8|共识|gòngshí|общее понимание; консенсус|consensus|umumiy kelishuv
8|透明度|tòumíngdù|прозрачность|transparency|shaffoflik
8|问责|wènzé|подотчётность; привлечение к ответственности|accountability|hisobdorlik; javobgarlikka tortish
8|监管|jiānguǎn|надзор; регулирование|supervision; regulation|nazorat; tartibga solish
8|执行|zhíxíng|исполнять; выполнение|to implement; execution|bajarmoq; ijro
8|评估机制|pínggū jīzhì|механизм оценки|evaluation mechanism|baholash mexanizmi
8|资源分配|zīyuán fēnpèi|распределение ресурсов|resource allocation|resurslarni taqsimlash
8|公平|gōngpíng|справедливый; справедливость|fair; fairness|adolatli; adolat
8|平等|píngděng|равенство; равный|equality; equal|tenglik; teng
8|包容|bāoróng|инклюзивность; включать|inclusion; to include|qamrov; o‘z ichiga olmoq
8|弱势群体|ruòshì qúntǐ|уязвимые группы|vulnerable groups|himoyaga muhtoj guruhlar
8|社会保障|shèhuì bǎozhàng|социальная защита|social security|ijtimoiy himoya
8|公共卫生|gōnggòng wèishēng|общественное здравоохранение|public health|jamoat salomatligi
8|教育机会|jiàoyù jīhuì|образовательные возможности|educational opportunities|ta’lim imkoniyatlari
8|城乡|chéngxiāng|город и деревня; городской и сельский|urban and rural|shahar va qishloq
8|地区差距|dìqū chājù|региональный разрыв|regional gap|hududlar o‘rtasidagi tafovut
8|流动|liúdòng|перемещаться; мобильность|to move; mobility|harakatlanmoq; harakatchanlik
8|迁移|qiānyí|миграция; перемещение|migration; relocation|migratsiya; ko‘chish
8|就业|jiùyè|трудоустройство; занятость|employment|bandlik; ishga joylashish
8|失业|shīyè|безработица; быть без работы|unemployment; to be unemployed|ishsizlik; ishsiz qolmoq
8|劳动力|láodònglì|рабочая сила|labor force|ishchi kuchi
8|人口结构|rénkǒu jiégòu|структура населения|population structure|aholi tarkibi
8|老龄化|lǎolínghuà|старение населения|population aging|aholining qarishi
8|可持续|kě chíxù|устойчивый; долгосрочный|sustainable|barqaror
8|可持续发展|kě chíxù fāzhǎn|устойчивое развитие|sustainable development|barqaror rivojlanish
8|生态|shēngtài|экология; экологический|ecology; ecological|ekologiya; ekologik
8|风险|fēngxiǎn|риск|risk|xavf
8|韧性|rènxìng|устойчивость; способность восстанавливаться|resilience|bardoshlilik
8|危机|wēijī|кризис|crisis|inqiroz
8|应急|yìngjí|экстренное реагирование|emergency response|favqulodda choralar
8|公共安全|gōnggòng ānquán|общественная безопасность|public safety|jamoat xavfsizligi
8|隐私保护|yǐnsī bǎohù|защита конфиденциальности|privacy protection|maxfiylikni himoya qilish
8|数据治理|shùjù zhìlǐ|управление данными|data governance|ma’lumotlarni boshqarish
8|数字化|shùzìhuà|цифровизация|digitalization|raqamlashtirish
8|自动化|zìdònghuà|автоматизация|automation|avtomatlashtirish
8|人工智能|réngōng zhìnéng|искусственный интеллект|artificial intelligence|sun’iy intellekt
8|算法|suànfǎ|алгоритм|algorithm|algoritm
8|偏见|piānjiàn|предвзятость; предубеждение|bias; prejudice|tarafkashlik; noto‘g‘ri qarash
8|公平性|gōngpíngxìng|справедливость; беспристрастность|fairness|adolatlilik
8|影响评估|yǐngxiǎng pínggū|оценка воздействия|impact assessment|ta’sirni baholash
8|权衡|quánhéng|взвешивать; компромисс|to weigh; trade-off|muvozanatni baholamoq; murosa
8|利益相关者|lìyì xiāngguānzhě|заинтересованные стороны|stakeholders|manfaatdor tomonlar
9|认识论|rènshílùn|эпистемология; теория познания|epistemology|epistemologiya; bilish nazariyasi
9|本体论|běntǐlùn|онтология|ontology|ontologiya
9|范式|fànshì|парадигма|paradigm|paradigma
9|辩证|biànzhèng|диалектический; диалектика|dialectical; dialectics|dialektik; dialektika
9|因果关系|yīnguǒ guānxi|причинно-следственная связь|causal relationship|sabab-oqibat munosabati
9|相关性|xiāngguānxìng|корреляция; взаимосвязь|correlation|korrelyatsiya; o‘zaro bog‘liqlik
9|内在|nèizài|внутренний; присущий|inherent; internal|ichki; xos
9|外在|wàizài|внешний; внешний фактор|external; outward|tashqi
9|抽象|chōuxiàng|абстрактный; абстрагировать|abstract; to abstract|mavhum; mavhumlashtirmoq
9|具体|jùtǐ|конкретный; конкретно|concrete; specific|aniq; muayyan
9|普遍|pǔbiàn|всеобщий; повсеместный|universal; widespread|umumiy; keng tarqalgan
9|特殊|tèshū|особый; специфический|special; specific|alohida; o‘ziga xos
9|悖论|bèilùn|парадокс|paradox|paradoks
9|矛盾|máodùn|противоречие; противоречивый|contradiction; contradictory|ziddiyat; qarama-qarshi
9|张力|zhānglì|напряжение; противоречивая динамика|tension|taranglik
9|边界|biānjiè|граница; предел|boundary|chegara
9|阐释|chǎnshì|интерпретировать; толкование|to interpret; interpretation|talqin qilmoq; talqin
9|诠释|quánshì|толковать; интерпретация|to interpret; interpretation|sharhlamoq; sharh
9|语境|yǔjìng|контекст|context|kontekst
9|话语|huàyǔ|дискурс; речь|discourse|diskurs; nutq
9|叙事|xùshì|повествование; нарратив|narrative|hikoya; narrativ
9|隐喻|yǐnyù|метафора|metaphor|metafora
9|象征|xiàngzhēng|символ; символизировать|symbol; to symbolize|ramz; ramziy ma’no
9|身份认同|shēnfèn rèntóng|идентичность; самоопределение|identity|o‘zlikni anglash; identifikatsiya
9|价值观|jiàzhíguān|система ценностей|values|qadriyatlar
9|伦理|lúnlǐ|этика; нравственный|ethics; ethical|etika; axloqiy
9|正当性|zhèngdàngxìng|легитимность; обоснованность|legitimacy|qonuniylik; asoslanganlik
9|合法性|héfǎxìng|законность; легитимность|legality; legitimacy|qonuniylik
9|自主|zìzhǔ|самостоятельный; автономия|autonomous; autonomy|mustaqil; mustaqillik
9|依赖|yīlài|зависеть; зависимость|to depend on; dependence|bog‘liq bo‘lmoq; qaramlik
9|协同|xiétóng|координировать; синергия|to coordinate; synergy|muvofiqlashtirmoq; hamkorlik
9|互补|hùbǔ|взаимодополнять|complementary|bir-birini to‘ldiruvchi
9|转型|zhuǎnxíng|трансформировать; переход|to transform; transition|o‘zgartirmoq; o‘tish
9|重构|chónggòu|перестраивать; реконструкция|to reconstruct; reconstruction|qayta qurmoq; qayta qurish
9|演变|yǎnbiàn|эволюционировать; эволюция|to evolve; evolution|rivojlanmoq; evolyutsiya
9|路径|lùjìng|путь; траектория|pathway; trajectory|yo‘l; trayektoriya
9|机制设计|jīzhì shèjì|проектирование механизмов|mechanism design|mexanizmni loyihalash
9|制度安排|zhìdù ānpái|институциональное устройство|institutional arrangement|institutsional tuzilma
9|资源配置|zīyuán pèizhì|распределение ресурсов|resource allocation|resurslarni taqsimlash
9|边际效应|biānjì xiàoyìng|предельный эффект|marginal effect|chegaraviy ta’sir
9|外部性|wàibùxìng|внешний эффект; экстерналия|externality|tashqi ta’sir
9|公共品|gōnggòngpǐn|общественное благо|public good|jamoat ne’mati
9|博弈|bóyì|стратегическое взаимодействие; игра|strategic interaction; game|strategik o‘zaro ta’sir; o‘yin
9|博弈论|bóyìlùn|теория игр|game theory|o‘yinlar nazariyasi
9|均衡|jūnhéng|равновесие|equilibrium|muvozanat
9|激励|jīlì|стимулировать; стимул|to incentivize; incentive|rag‘batlantirmoq; rag‘bat
9|约束|yuēshù|ограничивать; ограничение|to constrain; constraint|cheklamoq; cheklov
9|不确定性|bùquèdìngxìng|неопределённость|uncertainty|noaniqlik
9|敏感性|mǐngǎnxìng|чувствительность|sensitivity|sezgirlik
9|稳健性|wěnjiànxìng|устойчивость; робастность|robustness|barqarorlik
9|可解释性|kě jiěshìxìng|объяснимость|explainability|izohlash mumkinligi
9|可审计性|kě shěnjìxìng|возможность аудита|auditability|audit qilish imkoniyati
9|问责制|wènzézhì|система подотчётности|accountability system|hisobdorlik tizimi
9|多元|duōyuán|многообразный; плюрализм|plural; diverse|ko‘p xil; xilma-xil
9|包容性|bāoróngxìng|инклюзивность|inclusiveness|qamrovchanlik
9|代际|dàijì|межпоколенческий|intergenerational|avlodlararo
9|长期视角|chángqī shìjiǎo|долгосрочная перспектива|long-term perspective|uzoq muddatli nuqtai nazar
9|综合评估|zōnghé pínggū|комплексная оценка|comprehensive assessment|kompleks baholash
9|政策影响|zhèngcè yǐngxiǎng|влияние политики|policy impact|siyosat ta’siri
9|理论框架|lǐlùn kuàngjià|теоретическая основа|theoretical framework|nazariy asos
9|实证研究|shízhèng yánjiū|эмпирическое исследование|empirical research|empirik tadqiqot
9|跨领域|kuà lǐngyù|междисциплинарный; межотраслевой|cross-disciplinary|sohalararo
9|学术规范|xuéshù guīfàn|академические нормы|academic standards|akademik me’yorlar
`.trim()

export const lessonVocabulary: LessonVocabularyEntry[] = rows.split('\n').map((line, index) => {
  const [stageValue, hanzi, pinyin, ru, en, uz] = line.split('|')
  const stage = Number(stageValue) as CourseLevel
  if (!stage || !hanzi || !pinyin || !ru || !en || !uz) {
    throw new Error(`Invalid lesson vocabulary row ${index + 1}`)
  }
  return {
    stage,
    systems: stage <= 6 ? ['2.0', '3.0'] : ['3.0'],
    hanzi,
    pinyin,
    ru,
    en,
    uz,
  }
})

