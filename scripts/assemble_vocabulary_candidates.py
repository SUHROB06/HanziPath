#!/usr/bin/env python3
"""Assemble a local, review-only HSK vocabulary candidate file.

This deliberately does not create SQL or write to Supabase. Every sourced or
draft translation remains unverified, and the catalog rights gate stays pending.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "vocabulary-candidates"
SNAPSHOT_DIR = DATA_DIR / "source-snapshots"
OUTPUT = DATA_DIR / "hsk20-hsk30-2025-candidate.csv"
BACKLOG = DATA_DIR / "translation-backlog.csv"
REVIEW_QUEUE = DATA_DIR / "translation-review-queue.csv"
MANIFEST = DATA_DIR / "source-snapshot-manifest.json"

INPUTS = {
    "hearmandarin": SNAPSHOT_DIR / "hearmandarin-hsk-2025-and-2015.json",
    "zitou": SNAPSHOT_DIR / "zitou-hsk-uz-ru.csv",
    "hanzibook": SNAPSHOT_DIR / "hanzibook-hsk2025-ru.csv",
}

# Explicitly marked AI translation drafts for currently uncovered lower-level
# entries. These are derived from the English gloss and remain unverified.
AI_DRAFTS = {
    "因为……所以……": ("потому что … поэтому …", "chunki … shuning uchun …"),
    "虽然……但是……": ("хотя … но …", "garchi … bo‘lsa-da, … lekin …"),
    "踢足球": ("играть в футбол", "futbol o‘ynamoq"),
    "不但……而且……": ("не только … но и …", "nafaqat …, balki …"),
    "刮风": ("дуть (о ветре)", "shamol esmoq"),
    "只有……才……": ("только если …, тогда …", "faqat … bo‘lsagina …"),
    "黄河": ("Хуанхэ; Жёлтая река", "Xuanxe; Sariq daryo"),
    "百分之": ("процент", "foiz"),
    "弹钢琴": ("играть на пианино", "pianino chalmoq"),
    "冰激凌": ("мороженое", "muzqaymoq"),
    "拼音": ("пиньинь; романизация китайского языка", "pinyin; xitoycha tovushlarni lotin harflarida yozish tizimi"),
    "迟早": ("рано или поздно", "ertami-kechmi"),
    "粗糙": ("грубый; шероховатый; неотделанный", "dag‘al; g‘adir-budur; qo‘pol"),
    "后背": ("спина; задняя сторона", "orqa; orqa tomon"),
    "名胜古迹": ("исторические и культурные достопримечательности", "tarixiy obidalar va diqqatga sazovor joylar"),
    "模特": ("модель; манекенщик/манекенщица", "model; kiyim namoyish qiluvchi"),
}

# Additional AI-assisted drafts. Existing sourced translations still take
# precedence unless an explicit correction is recorded below.
_DRAFT_ROWS = """
电子书|электронная книга|elektron kitob
红绿灯|светофор|svetofor
检票|проверять билеты|chiptalarni tekshirmoq
袋子|сумка; пакет|sumka; paket
动车|скоростной поезд|tezyurar poyezd
换乘|пересаживаться; пересадка|transportni almashtirmoq; boshqa transportga o‘tmoq
聚餐|вместе обедать или ужинать|birga ovqatlanmoq
入住|заселяться; регистрироваться при заселении|mehmonxonaga joylashmoq; ro‘yxatdan o‘tmoq
扫码|сканировать QR-код|QR-kodni skanerlamoq
身|тело; счётное слово для комплекта одежды|tana; kiyim to‘plami uchun hisob so‘zi
使馆|посольство|elchixona
售票员|билетёр; кассир|chipta sotuvchi
网购|покупать в интернете; онлайн-покупки|internet orqali xarid qilmoq; onlayn xarid
线上|онлайн; в сети|onlayn; internetda
线下|офлайн; вне сети|oflayn; internetdan tashqarida
纸巾|бумажная салфетка|qog‘oz salfetka
转发|пересылать; делиться публикацией|qayta yubormoq; ulashmoq
自习|самостоятельно заниматься|mustaqil shug‘ullanmoq
池|пруд; бассейн|hovuz
充值|пополнить счёт|hisobni to‘ldirmoq
点赞|поставить отметку «нравится»|layk bosmoq
电商|электронная торговля|elektron savdo
非洲|Африка|Afrika
改天|в другой раз; как-нибудь|boshqa kuni; keyinroq
各行各业|все профессии и отрасли|barcha kasb va sohalar
贵姓|как ваша фамилия?|familiyangiz nima?
降水|осадки; выпадать (об осадках)|yog‘ingarchilik; yog‘moq
久远|давний; далёкий по времени|qadimiy; uzoq o‘tmishdagi
客服|служба поддержки; обслуживание клиентов|mijozlarga xizmat ko‘rsatish
派出所|местный полицейский участок|mahalliy ichki ishlar bo‘limi
轻重|тяжесть; степень серьёзности|og‘irlik; jiddiylik darajasi
人际|межличностный|shaxslararo
商家|продавец; торговец|sotuvchi; savdogar
上传|загружать (в интернет)|internetga yuklamoq
生肖|животное китайского зодиака; знак китайского календаря|muchal hayvoni; Xitoy taqvimi belgisi
省份|провинция|viloyat
甜品|десерт|shirinlik; desert
退还|возвращать; возмещать|qaytarib bermoq
相册|фотоальбом|fotoalbom
雪糕|мороженое; эскимо|muzqaymoq
邮寄|отправлять по почте|pochta orqali yubormoq
油条|ю тяо; жареная полоска теста|youtiao; yog‘da qovurilgan xamir
语文|китайский язык и литература (школьный предмет)|xitoy tili va adabiyoti (maktab fani)
运费|стоимость доставки; почтовые расходы|yetkazib berish haqi
职场|рабочая среда; профессиональная сфера|ish muhiti; kasbiy soha
北美洲|Северная Америка|Shimoliy Amerika
倍增|удваиваться; увеличиваться вдвое|ikki baravar oshmoq
不得|нельзя; не следует|mumkin emas; lozim emas
材质|материал; фактура материала|material; materialning tuzilishi
插座|электрическая розетка|elektr rozetkasi
产出|производить; выпускать продукцию|ishlab chiqarmoq; mahsulot yaratmoq
场次|количество сеансов (мероприятия, фильма)|seanslar soni
撤回|отзывать; забирать обратно|qaytarib olmoq
出力|прилагать усилия; помогать физически|kuch sarflamoq; yordam bermoq
存储|хранить; сохранять данные|saqlamoq; ma’lumotni saqlab qo‘ymoq
打卡|отмечаться на работе; отмечать посещение|ishga kelganini qayd etmoq; belgi qo‘ymoq
大幅|значительно; в большом масштабе|sezilarli darajada; katta miqyosda
大洋洲|Океания|Okeaniya
点击|нажимать; щёлкнуть мышью|bosmoq; sichqoncha bilan chertmoq
店铺|магазин; торговая точка|do‘kon; savdo nuqtasi
定制|изготавливать на заказ; настраивать|buyurtma asosida tayyorlamoq; moslashtirmoq
动漫|аниме и манга; мультфильмы и комиксы|anime va manga; multfilm va komikslar
对接|стыковать; согласовывать взаимодействие|ulamoq; hamkorlikni muvofiqlashtirmoq
多才多艺|разносторонне одарённый|ko‘p qirrali iste’dodli
法定|установленный законом; предусмотренный законом|qonun bilan belgilangan
放飞|выпускать в полёт|uchirib yubormoq
肺炎|пневмония|zotiljam; pnevmoniya
分级|классифицировать; распределять по уровням|darajalarga ajratmoq; tasniflamoq
分期|поэтапно; выплачивать в рассрочку|bosqichma-bosqich; bo‘lib-bo‘lib to‘lamoq
高端|высокого класса; премиальный|yuqori darajali; premium
寒冬|холодная зима; суровая зима|qahraton qish
好不|очень; чрезвычайно (в устойчивых выражениях)|juda; nihoyatda (iboralar tarkibida)
花朵|цветок|gul
滑行|скользить; двигаться скольжением|sirpanmoq; sirg‘alib harakatlanmoq
击败|победить; нанести поражение|mag‘lub etmoq; yengmoq
加倍|удваивать; вдвое больше|ikki baravar qilmoq; ikki hissa
家居|дом и домашний быт; предметы для дома|uy-ro‘zg‘or; uy jihozlari
较为|сравнительно; относительно|nisbatan
精准|точный; прицельный|aniq; puxta
兰花|орхидея|orxideya
乐于|охотно; быть готовым что-либо делать|bajonidil; mamnuniyat bilan
历年|за прошедшие годы; из года в год|yillar davomida; yildan yilga
链接|ссылка; связывать|havola; bog‘lamoq
两极|два полюса; крайние полюса|ikki qutb; qarama-qarshi qutblar
录用|принимать на работу|ishga qabul qilmoq
蚂蚁|муравей|chumoli
免税|без налога; освобождённый от налога|soliqdan ozod; bojsiz
民宿|гостевой дом; домашняя гостиница|mehmon uyi; oilaviy mehmonxona
南极洲|Антарктида|Antarktida
南美洲|Южная Америка|Janubiy Amerika
农田|пахотная земля; сельскохозяйственные угодья|ekin maydoni; qishloq xo‘jaligi yeri
扑灭|тушить; ликвидировать (пожар)|o‘chirmoq; bartaraf etmoq
清扫|подметать; убирать|supurmoq; tozalamoq
热度|популярность; уровень нагрева|mashhurlik; harorat darajasi
热议|бурно обсуждать; горячее обсуждение|qizg‘in muhokama qilmoq; qizg‘in munozara
人山人海|огромная толпа; море людей|ulkan olomon; odamlar dengizidek ko‘p
赛事|соревнование; спортивное событие|musobaqa; sport tadbiri
上进|стремиться к успеху; добиваться прогресса|olg‘a intilmoq; muvaffaqiyatga erishishga intilmoq
摄像头|веб-камера; видеокамера|veb-kamera; videokamera
生命力|жизненная сила; жизнеспособность|hayotiy kuch; yashovchanlik
诗词|стихи; поэзия|she’rlar; nazm
实时|в реальном времени|real vaqt rejimida
书画|живопись и каллиграфия|rassomlik va xattotlik
数字化|оцифровывать; цифровизация|raqamlashtirmoq; raqamlashtirish
水流|течение воды; поток|suv oqimi
提取|извлекать; снимать (деньги)|ajratib olmoq; yechib olmoq
听觉|слух; слуховое восприятие|eshitish; eshitish qobiliyati
退税|возврат налога|soliqni qaytarish
外甥|племянник (сын сестры)|opa-singilning o‘g‘li; jiyan
万物|всё сущее; все вещи|butun borliq; barcha narsalar
微小|крошечный; очень маленький|juda kichik; mitti
围棋|го (китайская настольная игра)|go (xitoy stol o‘yini)
味觉|вкус; вкусовое восприятие|ta’m bilish; ta’m sezgisi
乌龟|черепаха|toshbaqa
洗漱|умыться и почистить зубы|yuvinmoq va tishlarni tozalamoq
下单|оформить заказ|buyurtma bermoq
下线|выйти из сети; снять с производства|tarmoqdan chiqmoq; ishlab chiqarishdan olib tashlamoq
现存|существующий; имеющийся в наличии|mavjud; bor
现货|товар в наличии|omborda mavjud mahsulot
心底|глубина души; в глубине сердца|qalb tubi; yurak tubida
新媒体|новые медиа|yangi media
新能源|новая энергия; новые источники энергии|yangi energiya; yangi energiya manbalari
袖子|рукав|yeng
血型|группа крови|qon guruhi
易于|легко; быть склонным к|oson; moyil bo‘lmoq
有劲|энергичный; сильный|serg‘ayrat; kuchli
元宵|юаньсяо; сладкие шарики из клейкого риса|yuanxiao; yopishqoq guruchdan tayyorlangan shirin sharchalar
占比|доля; процентное соотношение|ulush; foizdagi nisbat
阵雨|кратковременный дождь; ливень|qisqa muddatli yomg‘ir; jala
侄子|племянник (сын брата)|aka-ukaning o‘g‘li; jiyan
种地|заниматься земледелием|dehqonchilik qilmoq
中暑|получить тепловой удар; тепловой удар|issiq urmoq; issiq urishi
主播|ведущий; интернет-стример|boshlovchi; internet strimeri
自律|самодисциплина; самоконтроль|o‘zini boshqarish; o‘z-o‘zini nazorat qilish
鄙视|презирать; презрение|mensimaslik; nafrat bilan qarash
拨|отодвигать; группа людей (счётное слово)|surmoq; siljitmoq; odamlar guruhi uchun hisob so‘zi
波涛|морские волны; валы|ulkan to‘lqinlar; dengiz to‘lqinlari
巢穴|логово; гнездо|ini; uya
衬托|подчёркивать; служить фоном|ajratib ko‘rsatmoq; fon bo‘lib xizmat qilmoq
迟钝|медлительный; тугой (о реакции)|sust; sekin fahmlaydigan
炊烟|дым из кухонных труб|oshxona mo‘risidan chiqayotgan tutun
慈善|благотворительность; милосердный|xayriya; mehr-shafqatli
从容|спокойный; невозмутимый|xotirjam; bosiq
方圆|окрестности; в пределах определённого радиуса|atrof; ma’lum radius doirasida
废寝忘食|забывать о сне и еде от усердия|uyqu va ovqatni unutib astoydil ishlamoq
抚摸|ласково гладить; поглаживать|silamoq; mehr bilan siypalamoq
俯视|смотреть сверху вниз; обозревать сверху|yuqoridan qaramoq
呼唤|звать; окликать|chaqirmoq; chorlamoq
钙|кальций|kalsiy
晃|сверкать; ослеплять|yaltiramoq; ko‘zini qamashtirmoq
花蕾|бутон|g‘uncha
荤|мясное блюдо; невегетарианская пища|go‘shtli taom; go‘shtli ovqat
将就|обходиться тем, что есть; мириться|boriga qanoat qilmoq; ko‘nmoq
侥幸|по счастливой случайности; случайно повезло|tasodifan omad kelmoq; baxtli tasodif
节制|умеренность; ограничивать себя|me’yorni saqlamoq; o‘zini tiyib turmoq
锦上添花|украсить и без того хорошее; сделать ещё лучше|yaxshiga yanada yaxshilik qo‘shmoq
敬业|преданный своему делу|o‘z ishiga fidoyi
倔强|упрямый; несгибаемый|qaysar; o‘jar
君子|благородный человек; джентльмен|oliyjanob inson
砍伐|рубить деревья|daraxtlarni kesmoq
侃侃而谈|говорить уверенно и свободно|ishonch bilan ravon gapirmoq
克制|сдерживать; обуздывать|o‘zini tiyib turmoq; jilovlamoq
哭泣|плакать; рыдать|yig‘lamoq; ko‘z yoshi to‘kmoq
枯萎|увядший; засохший|so‘lgan; qurigan
苦涩|горький и терпкий|achchiq va taxir
宽容|снисходительный; терпимый|bag‘rikeng; kechirimli
矿产|полезные ископаемые|foydali qazilmalar
狼吞虎咽|жадно наброситься на еду|ovqatni ochko‘zlarcha yemoq
冷落|игнорировать; заброшенный|e’tiborsiz qoldirmoq; huvillagan
礼尚往来|на добро отвечать добром|yaxshilikka yaxshilik bilan javob qaytarmoq
力求|стараться изо всех сил; добиваться|bor kuchi bilan intilmoq; erishishga urinmoq
冒犯|обидеть; оскорбить|xafa qilmoq; haqoratlamoq
瞄准|прицеливаться; нацеливаться|nishonga olmoq
藐视|презирать; смотреть свысока|mensimaslik; past nazar bilan qaramoq
明智|мудрый; благоразумный|oqilona; dono
南辕北辙|действовать вопреки своей цели|maqsadiga zid ravishda ish tutmoq
逆行|двигаться против потока; идти в обратном направлении|qarama-qarshi yo‘nalishda harakatlanmoq
平庸|заурядный; посредственный|o‘rtamiyona; oddiy
启蒙|давать начальные знания; просвещать|boshlang‘ich bilim bermoq; ma’rifat bermoq
窍门|хитрость; полезный приём|usul; foydali yo‘l
骚扰|беспокоить; домогаться|bezovta qilmoq; tinchlik bermaslik
尚且|даже; ещё|hatto; ham
失事|потерпеть аварию; попасть в происшествие|avariyaga uchramoq; falokat yuz bermoq
首饰|украшения; ювелирные изделия|taqinchoqlar; zargarlik buyumlari
疏远|отдаляться; держаться на расстоянии|uzoqlashmoq; aloqani sovutmoq
索取|требовать; запрашивать|talab qilmoq; so‘rab olmoq
陶醉|быть очарованным; упиваться|maftun bo‘lmoq; zavqlanmoq
讨好|стараться понравиться; угождать|ko‘nglini olish; yoqishga urinmoq
体裁|жанр|janr
通货膨胀|инфляция|inflyatsiya
通缉|объявить в розыск|qidiruvga bermoq
吞吞吐吐|говорить запинаясь и уклончиво|tutilib va ikkilanib gapirmoq
唾弃|отвергать с презрением|nafrat bilan rad etmoq
蔚蓝|лазурный; ярко-голубой|moviy; lojuvard rang
无辜|невиновный; невинный|aybsiz; gunohsiz
陷阱|ловушка; западня|tuzoq
撇|отбрасывать; левая наклонная черта|otib yubormoq; chapga tushuvchi chiziq
潇洒|непринуждённый и уверенный|erkin va dadil
心甘情愿|охотно; с полной готовностью|chin dildan rozi; bajonidil
汹涌|бурно вздыматься; бушевать|jo‘shib to‘lqinlanmoq; quturmoq
喧哗|шумный; шуметь|shovqinli; shovqin qilmoq
悬殊|резко различаться; огромная разница|keskin farq qilmoq; katta tafovut
炫耀|хвастаться; выставлять напоказ|maqtanmoq; ko‘z-ko‘z qilmoq
鸦雀无声|мёртвая тишина|jimjitlik; chumchuq uchsa bilinadigan sukunat
岳母|тёща|qaynona
招标|объявлять тендер|tender e’lon qilmoq
震撼|потрясать; шокировать|larzaga solmoq; qattiq ta’sirlantirmoq
正宗|подлинный; аутентичный|haqiqiy; asl
之际|во время; в момент|vaqtida; paytida
直径|диаметр|diametr
执着|настойчивый; целеустремлённый|qat’iyatli; maqsadga intiluvchan
主义|изм; учение; идеология|izm; ta’limot; mafkura
滋润|увлажнять; хорошо жить|namlamoq; farovon yashamoq
斑|пятно; отметина|dog‘; belgi
摊|раскладывать; лоток; счётное слово для луж|yoymoq; savdo rastasi; ko‘lmaklar uchun hisob so‘zi
儒家|конфуцианство; конфуцианцы|konfutsiychilik; konfutsiychilar
涮火锅|готовить продукты в хот-поте; есть хот-пот|hotpotda pishirmoq; hotpot yemoq
烟花爆竹|фейерверки и петарды|mushaklar va petardalar
致力|посвящать себя; прилагать усилия|bag‘ishlanmoq; bor kuchini sarflamoq
天赋|талант; дарование|tug‘ma qobiliyat; iste’dod
削|срезать; чистить ножом|archmoq; pichoq bilan kesib olmoq
坠|падать; свалиться|tushmoq; qulamoq
挨家挨户|ходить из дома в дом|uyma-uy yurmoq
哀求|умолять; упрашивать|yolvorib so‘ramoq
癌|рак; злокачественная опухоль|saraton; xavfli o‘sma
爱慕|питать любовь; восхищаться|sevmoq; mahliyo bo‘lmoq
碍事|мешать; быть помехой|xalaqit bermoq; to‘sqinlik qilmoq
艾滋病|СПИД|OITS
安定|стабильный; успокаивать|barqaror; tinchlantirmoq
安抚|успокаивать; утешать|tinchlantirmoq; yupatmoq
安眠药|снотворное|uyqu dorisi
安稳|спокойный; устойчивый|osoyishta; barqaror
安心|спокойный; быть спокойным|xotirjam; ko‘ngli tinch
安逸|комфортный; беззаботный|rohatli; tashvishsiz
暗地里|тайно; скрытно|yashirincha; pinhona
按理|по идее; по справедливости|mantiqan; aslida
按钮|кнопка|tugma
按说|обычно; по идее|odatda; mantiqan
暗中|тайно; втайне|yashirincha; pinhona
凹|вогнутый; впалый|botiq; ichkariga botgan
傲|гордый; надменный|mag‘rur; kekkaygan
傲慢|высокомерный; надменный|manman; takabbur
八成|восемьдесят процентов; скорее всего|sakson foiz; ehtimol
八卦|сплетни; сплетничать|g‘iybat; g‘iybat qilmoq
芭蕾|балет|balet
巴掌|ладонь; пощёчина|kaft; tarsaki
把柄|ручка; компромат|dastak; ayblov uchun asos
靶子|мишень|nishon
坝|плотина; дамба|to‘g‘on
罢免|отстранить от должности|lavozimidan ozod qilmoq
罢休|сдаться; отказаться|voz kechmoq; taslim bo‘lmoq
霸占|захватить; завладеть силой|zo‘rlik bilan egallab olmoq
百般|всеми возможными способами|har qanday yo‘l bilan; turli usullar bilan
百分比|процент; процентное соотношение|foiz; foiz nisbati
百合|лилия|liliya
百科全书|энциклопедия|ensiklopediya
摆平|уладить; разрешить|hal qilmoq; tartibga solmoq
摆设|украшение; предмет обстановки|bezak; uy jihozi
柏树|кипарис|sarv
拜会|нанести официальный визит|rasmiy tashrif buyurmoq
拜见|нанести почтительный визит|hurmat yuzasidan tashrif buyurmoq
扳|тянуть; оттягивать|tortmoq; qayirmoq
碑|памятник; стела|yodgorlik; bitiktosh
背负|нести на себе; взваливать на себя|zimmasiga olmoq; ko‘tarib yurmoq
悲欢离合|радости и горести; встречи и расставания|quvonch va qayg‘u; uchrashuv va ayriliq
悲痛|скорбеть; быть глубоко опечаленным|chuqur qayg‘urmoq; qattiq xafa bo‘lmoq
卑微|низкий; ничтожный|past; arzimas
备|готовить; подготавливать|tayyorlamoq
备课|готовиться к уроку|darsga tayyorlanmoq
背面|обратная сторона|orqa tomoni
背影|вид со спины; фигура со спины|orqadan ko‘rinish; orqa tomondan ko‘rinayotgan qomat
备战|готовиться к войне; готовиться к соревнованию|urushga tayyorlanmoq; musobaqaga tayyorlanmoq
奔赴|поспешить к; отправиться в|tomon shoshilmoq; yo‘l olmoq
本分|долг; обязанности|burch; vazifa
本色|природные качества; истинная сущность|tabiiy xislatlar; asl tabiat
本性|натура; природные инстинкты|tabiat; tug‘ma xususiyatlar
本意|первоначальное намерение; истинный смысл|asl niyat; haqiqiy ma’no
奔|направляться к; устремляться|tomon yo‘l olmoq; shoshilmoq
笨蛋|дурак; глупец|ahmoq; tentak
笨重|тяжёлый; громоздкий|og‘ir; beso‘naqay
绷|натягивать; напрягать|tarang tortmoq; taranglashtirmoq
绷带|бинт; повязка|bint; bog‘lam
逼近|приближаться; подступать|yaqinlashmoq; bostirib kelmoq
逼真|реалистичный; правдоподобный|hayotdagidek; ishonarli
比比皆是|встречается повсюду|hamma joyda uchraydi
笔墨|письменные принадлежности; письменный стиль|qalam va siyoh; yozish uslubi
比试|соревноваться; помериться мастерством|bellashmoq; mahoratini sinash
必不可少|совершенно необходимый|juda zarur; albatta kerak
壁画|настенная роспись; фреска|devoriy rasm; freska
壁垒|крепостная стена; барьер|istehkom; to‘siq
碧绿|изумрудно-зелёный; густо-зелёный|to‘q yashil; zumrad rang
避难|искать убежище; укрываться|panoh topmoq; boshpana izlamoq
避让|уступать дорогу; уклоняться|yo‘l bermoq; chetlab o‘tmoq
毕生|всю жизнь; на протяжении жизни|umr bo‘yi; butun hayoti davomida
避暑|спасаться от летней жары|yozgi issiqdan panoh topmoq
编程|программирование; программировать|dasturlash; dastur yozmoq
编号|нумеровать; присваивать номер|raqamlamoq; raqam bermoq
编剧|писать сценарий; сценарист|ssenariy yozmoq; ssenariynavis
编排|составлять; располагать в порядке|tartibga solmoq; tuzmoq
边远|отдалённый; удалённый|olis; chekka
编造|выдумывать; фабриковать|to‘qib chiqarmoq; uydirmoq
贬值|обесцениваться; снижаться в цене|qadrsizlanmoq; qiymati tushmoq
伯伯|дядя (старший брат отца)|amaki (otaning akasi)
伯父|дядя (старший брат отца)|amaki (otaning akasi)
驳回|отклонить; отвергнуть|rad etmoq; qaytarib yubormoq
博学|эрудированный; учёный|bilimdon; ilmli
博弈|игра; состязание|o‘yin; bellashuv
不算|не считаться; не засчитываться|hisoblanmaslik; inobatga olinmaslik
不当|неподходящий; ненадлежащий|nomunosib; noto‘g‘ri
不定|неопределённый; непостоянный|noaniq; o‘zgaruvchan
不动产|недвижимость|ko‘chmas mulk
不力|неэффективный; недостаточный|samarasiz; yetarli emas
不妙|дело обстоит плохо; нехорошо|yaxshi emas; ish chatoq
不慎|неосторожный; по неосторожности|ehtiyotsiz; ehtiyotsizlik bilan
不下|не менее; как минимум|kamida; ...dan kam emas
不肖|недостойный; непутёвый|nomunosib; yaramas
不屑|считать ниже своего достоинства|o‘ziga ep ko‘rmaslik; arzimaydi deb bilmoq
不懈|неустанный; неослабный|tinimsiz; astoydil
不厌其烦|не уставать от хлопот; не считать хлопоты обременительными|erinmay; tashvishdan charchamaslik
不亚于|не уступать; быть не хуже|qolishmaslik; kam bo‘lmaslik
不翼而飞|бесследно исчезнуть|izsiz yo‘qolmoq
不亦乐乎|чрезвычайно; очень|juda; nihoyatda
不正之风|нездоровая тенденция; дурная практика|nosog‘lom tendensiya; noto‘g‘ri odat
捕获|поймать; захватить|tutmoq; qo‘lga olmoq
补给|снабжать; снабжение|ta’minlamoq; ta’minot
捕食|охотиться; питаться добычей|ov qilmoq; o‘lja bilan oziqlanmoq
哺育|вскармливать; выращивать|boqmoq; voyaga yetkazmoq
不经意|невзначай; не обращая внимания|bexosdan; e’tibor bermay
不予|не предоставлять; не давать|bermaslik; taqdim etmaslik
不准|не разрешать; запретить|ruxsat bermaslik; taqiqlamoq
不耻下问|не стесняться учиться у тех, кто знает меньше|bilimi kamroq kishidan so‘rashdan uyalmay o‘rganmoq
不辞而别|уйти, не попрощавшись|xayrlashmay ketmoq
不得而知|оставаться неизвестным|noma’lum bo‘lib qolmoq
不乏|немало; в достатке|kam emas; yetarlicha
不法|незаконный; противоправный|noqonuniy; qonunga xilof
不服|не соглашаться; отказываться подчиняться|rozi bo‘lmaslik; bo‘ysunmaslik
不及|уступать; не достигать|yetmaslik; qolishmaslik
部件|деталь; компонент|detal; tarkibiy qism
不假思索|не раздумывая; не задумываясь|o‘ylab o‘tirmay; o‘ylamasdan
不解|не понимать; недоумевать|tushunmaslik; hayron bo‘lmoq
不景气|застой; спад деловой активности|turg‘unlik; iqtisodiy pasayish
不可或缺|необходимый; незаменимый|zarur; ajralmas
差额|разница; недостающая сумма|farq; yetishmayotgan miqdor
插曲|побочное событие; эпизод|qo‘shimcha voqea; epizod
插手|вмешиваться|aralashmoq
插图|иллюстрация|illyustratsiya; rasm
插嘴|перебивать; встревать в разговор|gapni bo‘lmoq; suhbatga aralashmoq
查处|расследовать и принять меры|tekshirib, chora ko‘rmoq
察觉|заметить; осознать|sezmoq; payqamoq
察看|осмотреть; внимательно проверить|ko‘zdan kechirmoq; sinchiklab tekshirmoq
查明|выяснить; установить|aniqlamoq; ma’lum qilmoq
掺|смешивать; разбавлять|aralashtirmoq; suyultirmoq
缠|обвивать; обматывать|o‘ramoq; chirmamoq
铲|лопата; копать лопатой|belkurak; belkurak bilan qazimoq
产权|право собственности|mulk huquqi
阐释|объяснять; толковать|tushuntirmoq; izohlamoq
产物|продукт; результат|mahsulot; natija
产业链|производственная цепочка; цепочка создания стоимости|ishlab chiqarish zanjiri; qiymat yaratish zanjiri
产值|стоимость произведённой продукции|ishlab chiqarilgan mahsulot qiymati
常理|здравый смысл; обычная логика|sog‘lom fikr; odatiy mantiq
长期以来|в течение долгого времени|uzoq vaqt davomida
常人|обычный человек|oddiy odam
常态|нормальное состояние; обычное положение|me’yoriy holat; odatiy vaziyat
长效|длительный эффект; долговременный|uzoq muddatli ta’sir; uzoq ta’sir qiluvchi
长征|долгий поход; длительное путешествие|uzoq yurish; uzoq safar
长足|значительный (о прогрессе)|salmoqli; sezilarli (taraqqiyot haqida)
畅谈|свободно беседовать|bemalol suhbatlashmoq
超标|превышать норму|me’yordan oshib ketmoq
超前|опережать своё время|o‘z davridan oldinda bo‘lmoq
抄袭|заниматься плагиатом; списывать|plagiat qilmoq; ko‘chirmachilik qilmoq
嘲弄|насмехаться; подтрунивать|mazax qilmoq; ustidan kulmoq
潮水|приливная волна; морской прилив|dengiz suvining ko‘tarilishi; to‘lqin
车间|цех; мастерская|ishlab chiqarish sexi; ustaxona
扯|тянуть; рвать; менять тему разговора|tortmoq; yirtmoq; mavzuni o‘zgartirmoq
撤|убрать; отозвать|olib tashlamoq; qaytarib olmoq
彻夜|всю ночь; ночь напролёт|tun bo‘yi; butun tun
沉甸甸|тяжёлый|og‘ir
沉浸|погрузиться; быть поглощённым|sho‘ng‘imoq; berilib ketmoq
沉迷|увлечься; пристраститься|berilib ketmoq; mukkasidan ketmoq
沉睡|крепко спать|qattiq uxlamoq
沉稳|спокойный; уравновешенный|bosiq; vazmin
趁机|воспользоваться случаем|fursatdan foydalanmoq
宠爱|баловать; нежно любить|erkalatmoq; mehr bilan yaxshi ko‘rmoq
抽查|проводить выборочную проверку|tanlab tekshirmoq
抽签|тянуть жребий; проводить жеребьёвку|qur’a tashlamoq; qur’a o‘tkazmoq
抽样|брать образец; выборка|namuna olmoq; tanlama
仇|ненависть; вражда|nafrat; adovat
稠|густой; плотный|quyuq; zich
筹|планировать; изыскивать средства|rejalashtirmoq; mablag‘ topmoq
筹办|организовывать; устраивать|tashkil qilmoq; uyushtirmoq
筹措|изыскивать средства|mablag‘ topmoq
仇恨|ненавидеть; ненависть|nafratlanmoq; nafrat
筹划|планировать; разрабатывать план|rejalashtirmoq; reja tuzmoq
筹集|собирать средства|mablag‘ yig‘moq
筹码|козырь; разменная фишка|ustunlik; savdolashuv vositasi
愁眉苦脸|выглядеть озабоченным и несчастным|tashvishli va g‘amgin ko‘rinmoq
仇人|враг; недруг|dushman; gina saqlagan odam
瞅|посмотреть; взглянуть|qaramoq; ko‘z tashlamoq
丑陋|уродливый; безобразный|xunuk; ko‘rimsiz
丑闻|скандал; позорный случай|janjal; sharmandali voqea
出厂|выйти с завода; сойти с конвейера|zavoddan chiqmoq; zavodda ishlab chiqarilmoq
出丑|опозориться; выставить себя в смешном виде|sharmanda bo‘lmoq; kulgili ahvolga tushmoq
出发点|исходная точка; мотив|boshlang‘ich nuqta; sabab
出局|выбыть из соревнования|musobaqadan chiqib ketmoq
出具|выдать; оформить (документ)|bermoq; hujjat rasmiylashtirmoq
出口成章|говорить красноречиво|ravon va chiroyli gapirmoq
出任|занять должность|lavozimni egallamoq
出人意料|неожиданный; вопреки ожиданиям|kutilmagan; kutganidan boshqacha
出手|предпринять действие; потратить деньги|harakat qilmoq; pul sarflamoq
出头|выделиться; выбраться из затруднения; чуть больше|ko‘zga tashlanmoq; qiyinchilikdan chiqmoq; biroz ortiq
出土|быть обнаруженным при раскопках|qazishmalar paytida topilmoq
出征|отправиться в поход; выступить в военный поход|harbiy yurishga jo‘namoq
出众|выдающийся; выделяющийся|ajralib turadigan; ajoyib
初衷|первоначальное намерение|asl niyat; dastlabki maqsad
出资|вложить средства; финансировать|mablag‘ ajratmoq; moliyalashtirmoq
出走|уйти из дома; сбежать|uydan ketib qolmoq; qochib ketmoq
锄|мотыга; копать мотыгой|ketmon; ketmon bilan chopmoq
橱窗|витрина|vitrina
除去|убрать; исключить; кроме|olib tashlamoq; istisno qilmoq
除外|исключить; за исключением|istisno qilmoq; bundan mustasno
处方|рецепт (врача)|shifokor retsepti
储量|запасы; оставшееся количество|zaxira; qolgan miqdor
赐教|просветить; оказать честь советом (вежл.)|maslahat bermoq; bilimingiz bilan o‘rtoqlashmoq (hurmat bilan)
次日|на следующий день|keyingi kuni
刺绣|вышивать; вышивка|kashta tikmoq; kashtachilik
刺眼|ослепительный; режущий глаза|ko‘zni qamashtiradigan; ko‘zga tashlanadigan
葱|зелёный лук|ko‘k piyoz
丛林|джунгли; чаща|changalzor; qalin o‘rmon
从头|заново; с самого начала|boshidan; qaytadan
凑|собирать вместе; наскрести; придвинуться|yig‘moq; jamlamoq; yaqinlashmoq
凑巧|как раз; случайно повезло|tasodifan; baxtiga
粗暴|грубый; жестокий|qo‘pol; dag‘al
粗略|приблизительный; поверхностный|taxminiy; yuzaki
粗心大意|небрежный; невнимательный|beparvo; e’tiborsiz
促成|способствовать; содействовать|amalga oshishiga ko‘maklashmoq
簇拥|окружить толпой|to‘da bo‘lib o‘rab olmoq
催促|торопить; подгонять|shoshiltirmoq; tezlatmoq
摧毁|разрушить; уничтожить|vayron qilmoq; yo‘q qilmoq
催眠|усыплять; гипнотизировать|uyqu keltirmoq; gipnoz qilmoq
璀璨|сияющий; яркий|porloq; charaqlagan
翠绿|изумрудно-зелёный|zumrad yashil
存活|выжить; уцелеть|tirik qolmoq; omon qolmoq
存货|товарные запасы; складской остаток|tovar zaxirasi; ombordagi qoldiq
存心|намеренно; умышленно|ataylab; qasddan
存折|сберегательная книжка|omonat daftarchasi
挫败|сорвать; расстроить (планы)|barbod qilmoq; rejasini buzmoq
错别字|опечатка; неправильно написанный иероглиф|xato yozilgan ieroglif; imlo xatosi
错觉|иллюзия; ложное впечатление|noto‘g‘ri tasavvur; xayol
措手不及|застать врасплох|tayyorgarliksiz qoldirmoq
错位|сместиться; оказаться не на своём месте|o‘rnidan siljimoq; noto‘g‘ri joylashmoq
错综复杂|запутанный и сложный|chigal va murakkab
搭乘|ехать на (транспорте)|(transportga) minib bormoq
搭建|строить; сооружать|qurmoq; barpo etmoq
达标|соответствовать установленному стандарту|belgilangan me’yorga mos kelmoq
打下手|помогать; быть помощником|yordam bermoq; ko‘makchi bo‘lmoq
打岔|перебивать; менять тему разговора|gapni bo‘lmoq; mavzuni o‘zgartirmoq
打倒|свергнуть; повалить|ag‘darmoq; yiqitmoq
打赌|держать пари; спорить на что-либо|garov o‘ynamoq; bahslashmoq
打盹儿|дремать; вздремнуть|mizg‘ib olmoq; mudramoq
打搅|беспокоить; тревожить|bezovta qilmoq; xalaqit bermoq
打捞|поднимать со дна; спасать из воды|suvdan olib chiqmoq; qutqarib olmoq
打磨|шлифовать; полировать|sayqallamoq; silliqlamoq
当之无愧|вполне заслуженный; безусловно достойный|to‘la munosib; shubhasiz loyiq
当众|публично; при всех|ommaviy tarzda; hammaning oldida
当晚|в тот же вечер|o‘sha kechasi
荡漾|колыхаться; идти рябью|chayqalmoq; to‘lqinlanmoq
当真|принимать всерьёз|jiddiy qabul qilmoq
导火索|фитиль; повод для конфликта|pilik; mojaroning boshlanish sababi
倒塌|обрушиться; рухнуть|qulab tushmoq
盗|воровать; вор|o‘g‘irlamoq; o‘g‘ri
道别|попрощаться|xayrlashmoq
稻草|рисовая солома|sholi somoni
倒计时|обратный отсчёт|teskari sanoq
道具|реквизит|sahna buyumi; rekvizit
悼念|скорбеть; чтить память|xotirlab motam tutmoq
倒数|считать в обратном порядке|teskari sanamoq
到头来|в конце концов; в итоге|oxir-oqibat; natijada
倒退|отступать; двигаться назад|orqaga qaytmoq; ortga ketmoq
到位|быть на месте; точно; как следует|joyida bo‘lmoq; aniq; keraklicha
德才兼备|сочетать нравственность и талант|odob va iste’dodni o‘zida mujassam etmoq
得当|уместный; надлежащий|o‘rinli; munosib
得失|приобретения и потери; выгоды и убытки|yutuq va yo‘qotishlar; foyda va zarar
得手|добиться успеха; удачно получиться|muvaffaqiyat qozonmoq; ko‘ngildagidek chiqmoq
得体|уместный; соответствующий случаю|vaziyatga mos; odobli
得心应手|умело; легко справляться|mahorat bilan; qiynalmay uddalamoq
得益|извлечь пользу; получить выгоду|foyda ko‘rmoq; naf olmoq
得意扬扬|самодовольный; чрезвычайно довольный собой|o‘zidan juda mamnun; kekkaygan
登场|выйти на сцену; появиться|sahnaga chiqmoq; paydo bo‘lmoq
登顶|достичь вершины; подняться на вершину|cho‘qqiga chiqmoq; cho‘qqiga yetmoq
灯泡|электрическая лампочка|elektr lampochka
凳子|табурет; низкий стул|taburetka; past kursi
堤|дамба; насыпь|damba; qirg‘oq to‘g‘oni
低调|скромный; сдержанный; неброский|kamtar; bosiq; ko‘zga tashlanmaydigan
提防|остерегаться; быть настороже|ehtiyot bo‘lmoq; ogoh turmoq
低谷|спад; низшая точка|pasayish davri; eng quyi nuqta
低估|недооценивать|past baholamoq
低落|унылый; подавленный|tushkun; ruhi tushgan
低迷|застой; спад; вялый|turg‘unlik; pasayish; sust
低下|низкий; опускать|past; tushirmoq
嘀咕|бормотать; тихо ворчать|ming‘irlamoq; past ovozda g‘udranmoq
笛子|бамбуковая флейта|bambuk nay
抵|сопротивляться; компенсировать; достигнуть|qarshilik ko‘rsatmoq; qoplamoq; yetib bormoq
跌幅|снижение; величина падения|pasayish miqdori; tushish darajasi
叠|складывать; накладывать|taxlamoq; ustma-ust qo‘ymoq
碟|блюдо; тарелка|likopcha; idish
迭起|возникать один за другим|ketma-ket yuz bermoq
钉子|гвоздь|mix
顶多|максимум; самое большее|ko‘pi bilan; eng ko‘pi
顶级|высший класс; первоклассный|eng yuqori darajali; oliy toifadagi
顶尖|вершина; ведущий; лучший|eng zo‘r; yetakchi; cho‘qqi
钉|прибивать гвоздём; забивать гвоздь|mix qoqmoq; mix bilan mahkamlamoq
订购|заказать; оформить заказ|buyurtma bermoq; buyurtma qilmoq
定金|задаток; предоплата|zakalat; avans
定居|поселиться; обосноваться|o‘rnashib yashamoq; ko‘chib joylashmoq
订立|заключить (договор)|shartnoma tuzmoq
定律|закон; закономерность|qonun; qonuniyat
定论|окончательное заключение; окончательный вывод|qat’iy xulosa; yakuniy qaror
定向|ориентировать; направлять; направленный|yo‘naltirmoq; yo‘nalishli
定心丸|то, что успокаивает; успокоительное|ko‘ngilni tinchlantiradigan narsa; taskin
订阅|подписаться; оформить подписку|obuna bo‘lmoq; obunani rasmiylashtirmoq
定做|изготовить на заказ|buyurtma asosida tayyorlamoq
丢脸|опозориться; потерять лицо|sharmanda bo‘lmoq; obro‘sini yo‘qotmoq
丢弃|выбросить; отбросить|tashlab yubormoq; uloqtirmoq
东奔西走|мотаться; постоянно разъезжать|u yoqdan bu yoqqa yugurmoq; tinimsiz qatnamoq
董事|член совета директоров|direktorlar kengashi a’zosi
懂事|понятливый; рассудительный|gapga tushunadigan; aqlli
董事会|совет директоров|direktorlar kengashi
动不动|то и дело; при каждом случае|tez-tez; har safar
动感|ощущение движения; динамичность|harakat hissi; jo‘shqinlik
动工|начать работу; приступить к строительству|ishni boshlamoq; qurilishni boshlamoq
栋梁|опора; столп общества|tayanch; jamiyat ustuni
动弹|шевельнуться; двинуться|qimirlamoq; siljimoq
动向|тенденция; направление развития|yo‘nalish; rivojlanish tendensiyasi
动用|использовать; задействовать|ishlatmoq; safarbar qilmoq
兜售|бойко продавать; навязывать товар|ko‘chada sotmoq; tovarni tiqishtirmoq
抖|дрожать; трясти|qaltiramoq; silkitmoq
陡|крутой; обрывистый|tik; jarlikdek keskin
斗|драться; бороться|urishmoq; kurashmoq
逗留|задержаться; побыть некоторое время|biroz qolmoq; vaqtincha turmoq
斗志|боевой дух; воля к борьбе|kurash ruhi; jangovar ruh
豆子|бобы; фасоль|dukkakli don; loviya
都会|большой город; мегаполис|katta shahar; megapolis
恩情|доброта; оказанная милость|yaxshilik; ko‘rsatilgan mehr
耳光|пощёчина|tarsaki
耳目一新|освежающий; создающий приятное ощущение новизны|yangicha; ko‘ngilni yangilaydigan
耳熟能详|настолько знакомый, что можно подробно пересказать|shunchalik tanishki, batafsil aytib bera olmoq
发酵|бродить; ферментировать|achimoq; fermentatsiyadan o‘tmoq
发掘|раскапывать; обнаруживать|qazib ochmoq; kashf etmoq
发愣|смотреть в растерянности; застыть|hang-mang bo‘lib qaramoq; qotib qolmoq
发热|иметь жар; нагреваться|isitmalamoq; qizimoq
发泄|дать выход чувствам; выплеснуть эмоции|his-tuyg‘ularini chiqarib yubormoq; dardini to‘kmoq
发芽|прорастать; давать ростки|unib chiqmoq; nish urmoq
发扬光大|развивать и приумножать; прославлять|rivojlantirib keng yoymoq; shuhratini oshirmoq
发源|брать начало; возникать|boshlanmoq; kelib chiqmoq
发源地|место происхождения; исток|kelib chiqqan joy; manba
发作|вспыхнуть; обостриться (о болезни)|xuruj qilmoq; zo‘raymoq
乏力|слабый; обессиленный|holsiz; kuchsiz
阀门|клапан; вентиль|klapan; ventil
法则|закон; правило|qonun; qoida
法治|верховенство закона; правовое государство|qonun ustuvorligi; huquqiy boshqaruv
发型|причёска; стиль причёски|soch turmagi
帆|парус|yelkan
帆船|парусник; парусная лодка|yelkanli kema; yelkanli qayiq
翻番|удвоиться; увеличиться вдвое|ikki baravar oshmoq
翻来覆去|ворочаться; переворачиваться|u yoqdan bu yoqqa ag‘darilmoq
翻身|перевернуться; повернуться|ag‘darilmoq; o‘girilib olmoq
翻天覆地|потрясающий; коренным образом изменить|tubdan o‘zgartiruvchi; hamma narsani ostin-ustin qilmoq
翻新|обновить; отремонтировать|yangilamoq; ta’mirlab yangilamoq
繁多|многочисленный и разнообразный|ko‘p va xilma-xil
烦闷|унылый; подавленный|g‘amgin; ko‘ngli xira
繁衍|размножаться; распространяться|ko‘paymoq; tarqalmoq
繁杂|многочисленный и разнообразный; сложный|ko‘p va xilma-xil; murakkab
烦躁|раздражённый; беспокойный|bezovta; jahldor
繁重|тяжёлый; обременительный|og‘ir; mashaqqatli
反差|контраст; резкое различие|keskin farq; tafovut
返还|вернуть; возместить|qaytarib bermoq; qoplab bermoq
反击|контратаковать; нанести ответный удар|qarshi hujum qilmoq; javob zarba bermoq
反弹|отскочить; подпрыгнуть|qaytib sakramoq; sapchimoq
反省|анализировать свои поступки; задуматься над собой|o‘zini tahlil qilmoq; xatti-harakatini ko‘rib chiqmoq
犯愁|тревожиться; беспокоиться|tashvishlanmoq; xavotir olmoq
饭碗|миска для риса; источник средств к существованию|guruch kosasi; tirikchilik manbai
方向盘|руль|rul
粪便|кал; испражнения|najas; chiqindi
份额|доля; часть|ulush; qism
奋力|изо всех сил; изо всех усилий|bor kuchi bilan; astoydil
分外|особенно; чрезвычайно|ayniqsa; nihoyatda
奋勇|отважно; смело|mardonavor; jasorat bilan
风波|переполох; волнения; осложнения|g‘alva; mojaro; notinchlik
风采|обаяние; грациозная осанка|joziba; kelishgan qomat
风餐露宿|ночевать под открытым небом; жить в тяжёлых условиях|ochiq havoda tunamoq; og‘ir sharoitda yashamoq
风吹雨打|подвергаться непогоде; переносить лишения|tabiat sinovlariga uchramoq; qiyinchilik ko‘rmoq
封顶|накрыть крышу; установить верхний предел|tom yopmoq; eng yuqori chegarani belgilamoq
风范|манера держаться; пример для подражания|o‘zini tutish tarzi; namuna
风和日丽|ясная и солнечная погода|ochiq va quyoshli ob-havo
丰厚|щедрый; обильный|mo‘l-ko‘l; saxiy
峰回路转|неожиданный поворот событий|voqealarning kutilmagan burilishi
风景线|примечательный вид; живописная линия|ko‘zga tashlanadigan manzara; go‘zal ko‘rinish
风浪|ветер и волны; бурное море|shamol va to‘lqinlar; dengiz to‘lqini
风流|утончённый; романтичный|maftunkor; romantik
风貌|облик; характерный стиль|qiyofa; o‘ziga xos ko‘rinish
蜂蜜|мёд|asal
封面|обложка|muqova
风情|очарование; местные обычаи|joziba; mahalliy urf-odatlar
风沙|песок, поднимаемый ветром; песчаная буря|shamol uchirgan qum; qum bo‘roni
风尚|обычай; мода; тенденция|urf; moda; yo‘nalish
风水|фэншуй|fengshui
丰硕|обильный; плодотворный|mo‘l; serhosil; samarali
风云|ветер и облака; бурные перемены|shamol va bulutlar; notinch o‘zgarishlar
风雨无阻|несмотря на ветер и дождь; при любой погоде|ob-havoga qaramay; har qanday sharoitda
风筝|воздушный змей|varrak
疯子|сумасшедший; безумец|jinni; telba
缝|шить; зашивать|tikmoq; chok solmoq
缝合|сшить; соединить швом|tikib birlashtirmoq; chok solmoq
缝|шов; стык|chok; tutashgan joy
凤凰|феникс|Feniks; afsonaviy qush
凤毛麟角|чрезвычайно редкий; единичный|juda kam; noyob
敷|наносить; намазывать; распределять|surmoq; yoymoq
孵化|высиживать; выводить; инкубировать|tuxum ochirmoq; inkubatsiya qilmoq
肤浅|поверхностный; неглубокий|yuzaki; chuqur emas
扶持|поддерживать; помогать|qo‘llab-quvvatlamoq; yordam bermoq
浮动|плавать; колебаться; изменяться|suzmoq; o‘zgarib turmoq; tebranmoq
俘获|захватить; пленить|asirga olmoq; qo‘lga tushirmoq
干部|кадр; руководящий работник|kadr; rahbar xodim
干事|администратор; исполнительный работник|ma’mur; ish yurituvchi
缸|чан; большой кувшин|katta idish; ko‘za
纲要|план; основные положения|reja; asosiy qoidalar
港|порт; гавань|bandargoh; port
高额|крупный; большой (о сумме)|katta miqdordagi; yirik
高昂|высокий; дорогой|baland; qimmat
高傲|высокомерный; надменный|kekkaygan; takabbur
高调|демонстративный; громкий|ko‘z-ko‘z qiladigan; shov-shuvli
高贵|благородный; знатный|olijanob; asil
高见|мудрое мнение (вежл.)|oqilona fikr (hurmat bilan)
高空|большая высота; высоко в воздухе|balandlik; havoda yuqorida
高龄|преклонный возраст|keksa yosh; yoshi ulug‘lik
高血压|высокое кровяное давление|yuqori qon bosimi
高雅|изысканный; утончённый|nafis; didli
高压|высокое давление; высокое напряжение|yuqori bosim; yuqori kuchlanish
搞鬼|проказничать; строить козни|ayyorlik qilmoq; fitna uyushtirmoq
搞笑|смешной; смешить|kulgili; kuldirmoq
告|сообщать; объявлять|aytmoq; xabar bermoq
告示|объявление; извещение|e’lon; bildirishnoma
告知|уведомить; сообщить|xabardor qilmoq; ma’lum qilmoq
告状|пожаловаться; подать иск|shikoyat qilmoq; sudga murojaat qilmoq
戈壁|пустыня Гоби|Gobi cho‘li
歌剧|опера|opera
搁浅|сесть на мель; застопориться|sayozlikda qolib ketmoq; to‘xtab qolmoq
歌舞|пение и танцы|qo‘shiq va raqs
歌谣|народная песня; баллада|xalq qo‘shig‘i; ballada
搁置|отложить; приостановить|keyinga qoldirmoq; vaqtincha to‘xtatmoq
格格不入|несовместимый; не вписываться|mos kelmaydigan; muhitga singisha olmaslik
阁楼|чердак; мансарда|chordoq; mansarda
格子|клетка; клетчатый узор|katak; katakli naqsh
个案|отдельный случай; индивидуальный случай|alohida holat; yakka holat
个头儿|размер; рост|o‘lcham; bo‘y-bast
根基|основа; фундамент|asos; poydevor
跟进|следить за ходом; продолжать работу|kuzatib bormoq; davom ettirmoq
根治|полностью излечить; устранить навсегда|butunlay davolamoq; batamom bartaraf etmoq
耕|пахать; обрабатывать землю|yer haydamoq; yerga ishlov bermoq
更改|изменить; исправить|o‘zgartirmoq; tuzatmoq
更衣室|раздевалка; гардеробная|kiyinish xonasi; yechinish xonasi
耕耘|пахать и возделывать; усердно трудиться|yer haydab ekin yetishtirmoq; astoydil mehnat qilmoq
共同体|сообщество; общность|hamjamiyat; birlashma
共性|общая черта; общие свойства|umumiy xususiyat; mushtaraklik
勾|привлекать; ставить галочку; вычёркивать|jalb qilmoq; belgi qo‘ymoq; o‘chirib tashlamoq
钩|крючок; цеплять крючком|ilgak; ilgak bilan ilib olmoq
勾勒|очертить; набросать контур|konturini chizmoq; qoralama chizmoq
够呛|невыносимый; очень тяжёлый|chidab bo‘lmas; juda qiyin
构想|замысел; задумать|g‘oya; o‘ylab topmoq
孤零零|совсем один; одинокий|yolg‘iz; bir o‘zi
孤陋寡闻|малообразованный; несведущий|kam ma’lumotli; tajribasiz
估算|оценить; приблизительно подсчитать|taxminan hisoblamoq; chamalamoq
骨骼|скелет; костная система|skelet; suyaklar tuzilishi
古籍|древние книги; классические тексты|qadimiy kitoblar; mumtoz matnlar
骨架|каркас; скелет|karkas; skelet
古今中外|во все времена и повсюду|barcha davr va joylarda
股民|инвестор на фондовом рынке|fond bozori investori; aksiya savdogari
古朴|простой и неброский; старинный|sodda va bezaksiz; qadimiy
骨气|стойкость; чувство собственного достоинства|matonat; oriyat
谷物|зерновые культуры; злаки|don ekinlari; don mahsulotlari
骨折|сломать кость; перелом|suyagi sinmoq; suyak sinishi
故|причина; поэтому; следовательно|sabab; shu bois; demak
雇|нанимать; нанять|yollamoq; ishga olmoq
固化|затвердеть; закрепить|qotmoq; mustahkamlamoq
顾及|учитывать; принимать во внимание|hisobga olmoq; e’tibor bermoq
顾名思义|как следует из названия|nomidan ko‘rinib turganidek
顾全大局|учитывать общую ситуацию и интересы|umumiy vaziyat va manfaatlarni hisobga olmoq
雇员|работник; сотрудник|xodim; ishchi
雇主|работодатель|ish beruvchi
瓜分|разделить; поделить между собой|bo‘lib olmoq; taqsimlamoq
刮目相看|взглянуть с новым уважением|yangicha hurmat bilan qaramoq
瓜子|семечки; семена дыни|urug‘; qovun urug‘i
寡妇|вдова|beva
挂钩|соединить; связать; крючок|bog‘lamoq; ulashmoq; ilgak
挂念|беспокоиться; думать с тревогой|xavotir olmoq; ko‘ngli bezovta bo‘lmoq
挂失|заявить об утере|yo‘qolganini xabar qilmoq
乖巧|смышлёный; послушный|aqlli; itoatkor
怪物|чудовище; монстр|maxluq; mahluq
怪异|странный; необычный|g‘alati; noodatiy
官兵|офицеры и солдаты|ofitserlar va askarlar
棺材|гроб|tobut
观测|наблюдать; проводить наблюдения|kuzatmoq; o‘lchab kuzatmoq
国有|государственный; находящийся в государственной собственности|davlatga qarashli; davlat mulki bo‘lgan
裹|завернуть; обернуть|o‘ramoq; o‘rab qo‘ymoq
果真|действительно; и правда|rostdan; haqiqatan
过意不去|чувствовать неловкость; считать себя виноватым|noqulay his qilmoq; o‘zini aybdor sezmoq
过半|больше половины|yarmidan ko‘pi
过不去|не пройти; придираться; не давать покоя|o‘ta olmaslik; joniga tegmoq; tinch qo‘ymaslik
过错|ошибка; вина|xato; ayb
过道|проход; коридор|yo‘lak; koridor
过关|пройти проверку; выдержать испытание|sinovdan o‘tmoq; tekshiruvdan o‘tmoq
过境|транзит; проехать через страну|tranzit; mamlakat hududidan o‘tmoq
过量|чрезмерный; сверх нормы|me’yordan ortiq; haddan ziyod
过剩|избыток; излишек|ortiqcha; ortiqcha miqdor
过头|чрезмерный; переборщить|haddan oshgan; me’yoridan ortiq
过往|проходить; прошлое|o‘tib ketmoq; o‘tmish
过硬|надёжный; прочный; на высоком уровне|mustahkam; puxta; yuqori darajadagi
海盗|пират; морской разбойник|qaroqchi; dengiz qaroqchisi
海量|огромный объём; великодушие|katta miqdor; bag‘rikenglik
海绵|морская губка; губка|dengiz gubkasi; gubka
海滩|пляж; морской берег|plyaj; dengiz sohili
海豚|дельфин|delfin
海峡|пролив|bo‘g‘oz
海啸|цунами|sunami
海运|морская перевозка; морские грузоперевозки|dengiz orqali tashish; dengiz yuk tashuvi
海藻|морские водоросли|dengiz o‘tlari; suv o‘tlari
害虫|вредное насекомое; вредитель|zararli hasharot; zararkunanda
骇人听闻|шокирующий; потрясающий|dahshatli; eshitgan odamni larzaga soladigan
酣畅|вволю; свободно и непринуждённо|to‘yib; erkin va bemalol
憨厚|простодушный и честный|sodda va halol; samimiy
酣睡|крепко спать|qattiq uxlamoq
函|письмо; конверт|xat; konvert
寒带|полярный пояс; холодная зона|qutbiy mintaqa; sovuq hudud
涵盖|охватывать; включать в себя|qamrab olmoq; o‘z ichiga olmoq
含蓄|сдержанный; выраженный намёком|vazmin; bilvosita ifodalangan
汉服|традиционная одежда народа Хань|Han xalqining an’anaviy kiyimi
汗马功劳|большие заслуги; военные подвиги|katta xizmatlar; jangdagi jasorat
夯实|утрамбовать; укрепить основу|zichlamoq; asosini mustahkamlamoq
航海|мореплавание; плавать по морю|dengizda suzmoq; dengizchilik
行家|знаток; специалист|bilimdon; mutaxassis
行情|рыночная ситуация; конъюнктура рынка|bozor vaziyati; bozor kon’yunkturasi
航天员|космонавт; астронавт|kosmonavt; astronavt
黑客|хакер|xaker
黑马|тёмная лошадка; неожиданный фаворит|qora ot; kutilmagan kuchli nomzod
黑名单|чёрный список|qora ro‘yxat
横向|горизонтальный; поперечный|gorizontal; ko‘ndalang
恒星|звезда (астрономия)|yulduz
轰|грохотать; прогонять|gumburlamoq; haydab yubormoq
烘焙|печь; выпекать; обжаривать|pishirmoq; qovurmoq
烘干|высушить нагреванием|isitib quritmoq
哄堂大笑|весь зал разразился смехом|hamma baravariga kulib yubordi
烘托|подчёркивать на фоне; оттенять|fon bo‘lib ajratib ko‘rsatmoq
轰炸|бомбить; подвергать бомбардировке|bombardimon qilmoq
红火|процветающий; оживлённый|gullab-yashnagan; qizg‘in
红利|дивиденд; бонус|dividend; qo‘shimcha daromad
洪亮|громкий и ясный; звонкий|jarangdor; baland va tiniq
红扑扑|румяный; раскрасневшийся|qip-qizil; qizarib ketgan
红润|румяный; розоватый|qizil tusli; rangdor
红薯|батат; сладкий картофель|batat; shirin kartoshka
弘扬|развивать и распространять; поддерживать|rivojlantirib targ‘ib qilmoq; qo‘llab-quvvatlamoq
后备|запасной; резерв|zaxira; ehtiyot uchun
后备箱|багажник автомобиля|avtomobil yukxonasi
厚道|добрый и честный; порядочный|oqko‘ngil; halol
后盾|поддержка; опора|tayanch; qo‘llab-quvvatlash
后世|последующие поколения; потомки|keyingi avlodlar; avlodlar
后台|кулисы; закулисье; покровитель|sahna orti; homiy
后续|последующий; дальнейший|keyingi; davomiy
候选人|кандидат|nomzod
后裔|потомок; наследник|avlod; zurriyot
后遗症|последствия болезни; осложнения|asoratlar; kasallikdan keyingi oqibatlar
呼|звать; окликать|chaqirmoq; ovoz bermoq
呼救|звать на помощь|yordam so‘rab chaqirmoq
忽冷忽热|то холодно, то жарко; переменчивый|goh sovuq, goh issiq; o‘zgaruvchan
呼声|голос; призыв; общественное требование|ovoz; talab; chaqiriq
呼应|откликаться; соответствовать|javob bermoq; mos kelmoq
忽悠|обмануть; одурачить|aldamoq; laqillatmoq
糊|намазывать; приклеивать|surmoq; yopishtirmoq
胡闹|безобразничать; устраивать сцену|to‘polon qilmoq; beboshlik qilmoq
胡思乱想|предаваться беспорядочным фантазиям|har xil narsalarni xayol qilmoq; behuda o‘ylamoq
互补|дополнять друг друга|bir-birini to‘ldirmoq
护理|ухаживать; осуществлять уход|parvarish qilmoq; qaramoq
花卉|цветы и декоративные растения|gullar va manzarali o‘simliklar
晃荡|раскачиваться; шататься|chayqalmoq; tebranmoq
挥舞|размахивать; взмахивать|silkitmoq; havoda o‘ynatmoq
回归|вернуться; возвратиться к|qaytmoq; qayta tiklanmoq
回合|раунд; ход|raund; navbat
回馈|отблагодарить; обратная связь|minnatdorchilik bildirmoq; fikr-mulohaza
回落|снизиться; упасть|pasaymoq; tushmoq
回升|снова подняться; восстановиться|qayta ko‘tarilmoq; tiklanmoq
回首|оглянуться; вспомнить прошлое|ortga qaramoq; o‘tmishni eslamoq
回味|послевкусие; смаковать воспоминания|ta’m qolishi; xotiralarni zavq bilan eslamoq
回想|вспоминать; припоминать|yodga olmoq; eslamoq
回忆录|мемуары; книга воспоминаний|xotiralar kitobi; memuar
毁坏|повредить; разрушить|buzmoq; shikastlamoq
会场|место собрания; зал заседаний|yig‘ilish joyi; majlislar zali
汇合|соединиться; слиться|qo‘shilmoq; birlashmoq
汇集|собрать; сосредоточить|to‘plamoq; jamlamoq
汇聚|собираться вместе; сходиться|jamlanmoq; bir joyga to‘planmoq
会面|встретиться; встреча|uchrashmoq; uchrashuv
绘声绘色|яркий и живой; образно описывать|jonli va obrazli; yorqin tasvirlamoq
会意|понять без слов; понять намёк|aytilmasdan tushunmoq; ishorani anglamoq
会诊|врачебный консилиум|shifokorlar maslahatlashuvi; konsilium
绘制|рисовать; чертить|chizmoq; chizib tayyorlamoq
婚纱|свадебное платье|kelinlik ko‘ylagi
豁|рискнуть всем; пожертвовать; прорезать|hammasini tikmoq; qurbon qilmoq; yorib ochmoq
豁出去|пойти на риск; поставить всё на карту|tavakkal qilmoq; hammasini tikmoq
活期|текущий; бессрочный (счёт)|muddatsiz; talab qilib olinadigan (hisob)
火爆|взрывной; оживлённый; жаркий|jo‘shqin; qizg‘in; gavjum
火候|степень нагрева; подходящий момент|pishirish darajasi; qulay vaqt
火花|искра|uchqun
火炬|факел|mash’al
火辣辣|обжигающий; жгучий; острый|kuydiradigan; achchiq; keskin
火热|жаркий; горячий; пылкий|jo‘shqin; qizg‘in; qaynoq
火山|вулкан|vulqon
伙食|питание; еда|ovqat; taom
火速|срочно; с максимальной скоростью|zudlik bilan; juda tez
豁达|великодушный; открытый|kengfe’l; bag‘rikeng
或多或少|более или менее|ozmi-ko‘pmi; u yoki bu darajada
祸害|бедствие; причинять вред|ofat; zarar yetkazmoq
获悉|узнать; получить сведения|xabar topmoq; bilib olmoq
货运|грузовые перевозки|yuk tashish
积|накапливать; копить|to‘plamoq; yig‘moq
处事|вести дела; решать повседневные вопросы|ishlarni yuritmoq; kundalik masalalarni hal qilmoq
触动|тронуть; затронуть; вызвать отклик|ta’sir qilmoq; ko‘ngliga tegmoq
触觉|осязание; чувство прикосновения|teginish sezgisi; paypaslash hissi
矗立|возвышаться; стоять высоко|qad rostlab turmoq; baland ko‘tarilib turmoq
触摸|трогать; прикасаться|ushlab ko‘rmoq; tegmoq
触目惊心|потрясающий; ужасающий при виде|dahshatli; ko‘rganda larzaga soladigan
揣测|догадываться; предполагать|taxmin qilmoq; faraz qilmoq
揣摩|вникать; пытаться понять|chuqur anglashga urinmoq; tushunib yetmoq
踹|пнуть ногой|tepmoq
穿梭|сновать туда-сюда; курсировать|u yoqdan bu yoqqa qatnamoq; qatnab turmoq
穿着|одежда; наряд|kiyim; libos
传奇|легенда; сказание|afsona; rivoyat
传人|передавать; преемник; потомок|yetkazmoq; davomchi; avlod
传闻|слух; молва|mish-mish; gap-so‘z
喘|задыхаться; тяжело дышать|hansiramoq; og‘ir nafas olmoq
喘息|перевести дыхание; передышка|nafas rostlamoq; qisqa tanaffus
串门|зайти в гости; наведаться|mehmonga kirib o‘tmoq; yo‘qlab kelmoq
创伤|рана; травма|jarohat; shikast
床位|койко-место|yotoq o‘rni; karavot joyi
创始人|основатель; создатель|asoschi; tashkil etuvchi
垂|свисать; опускаться вниз|osilib turmoq; pastga tushmoq
捶|колотить; бить кулаком|mushtlamoq; urmoq
垂头丧气|понурый; удручённый|boshi egilgan; ruhi tushgan
醇厚|насыщенный и мягкий (о вкусе/аромате)|to‘q va mayin (ta’m yoki hid haqida)
纯朴|простой и искренний|sodda va samimiy
淳朴|простой и честный; добродушный|sodda va halol; oqko‘ngil
蠢|глупый; недалёкий|ahmoq; esi past
戳|тыкать; колоть|tiqmoq; sanchmoq
绰号|прозвище; кличка|laqab
辞|увольняться; прощаться|ishdan ketmoq; xayrlashmoq
辞呈|заявление об увольнении|iste’fo arizasi
磁铁|магнит|magnit
辞退|уволить; отстранить от работы|ishdan bo‘shatmoq
雌性|самка; женский пол у животных|urg‘ochi; hayvonlarning urg‘ochi jinsi
此起彼伏|возникать одно за другим; то подниматься, то спадать|birin-ketin yuzaga kelmoq; ko‘tarilib-pasayib turmoq
赐|даровать; пожаловать|in’om etmoq; ato qilmoq
刺耳|режущий слух; резкий|quloqqa yoqimsiz; keskin
刺骨|пронизывающий до костей (о холоде)|suyakdan o‘tadigan (sovuq haqida)
打消|рассеять; отбросить (сомнения/мысль)|bartaraf qilmoq; fikridan qaytarmoq
大大咧咧|беззаботный; непринуждённый|beparvo; o‘zini erkin tutadigan
大公无私|бескорыстный; беспристрастный|xolis; shaxsiy manfaatni ko‘zlamaydigan
大街小巷|улицы и переулки; повсюду в городе|katta-kichik ko‘chalar; shaharning hamma joyi
大惊小怪|поднимать шум из-за пустяка|arzimas narsadan shov-shuv ko‘tarmoq
大局|общая обстановка; положение в целом|umumiy vaziyat; katta manzara
大名鼎鼎|знаменитый; широко известный|mashhur; nomi keng tanilgan
大片|блокбастер; обширная территория|katta film; keng hudud
大气|атмосфера; величественный, внушительный|atmosfera; salobatli; ko‘rkam
大数据|большие данные|katta hajmdagi ma’lumotlar; big data
逮|ловить; хватать|ushlamoq; tutmoq
雕|вырезать; гравировать|o‘ymoq; naqsh o‘ymoq
滋生|размножаться; порождать|ko‘paymoq; keltirib chiqarmoq
辩||bahslashmoq; munozara qilmoq
辨别|различать; распознавать|farqlamoq; ajratmoq
便饭|простая домашняя еда; обычная трапеза|oddiy uy taomi; kundalik ovqat
变革|преобразовать; провести коренную реформу|tub o‘zgarish qilmoq; isloh qilmoq
变幻莫测|непредсказуемо меняться; быть переменчивым|oldindan aytib bo‘lmaydigan tarzda o‘zgarmoq; o‘zgaruvchan bo‘lmoq
变通|проявить гибкость; приспособиться к обстоятельствам|moslashuvchan bo‘lmoq; sharoitga moslashmoq
便携式|портативный; переносной|ko‘chma; olib yuriladigan
变异|изменчивость; мутация|o‘zgarish; mutatsiya
标||belgi; nishon
标榜|выставлять напоказ; хвастаться|ko‘z-ko‘z qilmoq; maqtanmoq
标签|ярлык; этикетка|yorliq; etiketka
标识|обозначение; опознавательный знак|belgi; aniqlovchi nishon
标示|указывать; обозначать|ko‘rsatmoq; belgilamoq
标语|лозунг; плакат|shior; plakat
标致|привлекательный; красивый|ko‘rkam; chiroyli
表白|признаться в чувствах; объясниться|his-tuyg‘ularini izhor qilmoq; o‘zini tushuntirmoq
表述|формулировать; выражать|ifodalamoq; bayon qilmoq
表率|пример; образец для подражания|namuna; ibrat
别具匠心|оригинальный; искусно задуманный|o‘ziga xos; mahorat bilan o‘ylangan
别看|хотя; пусть вас не обманывает видимость|qaramay; ko‘rinishiga aldanmang
别说|не говоря уже о; тем более|u yoqda tursin; gapirmasa ham bo‘ladi
彬彬有礼|учтивый; обходительный|odobli; xushmuomala
缤纷|яркий; пёстрый; разнообразный|rang-barang; xilma-xil
濒危|находящийся под угрозой исчезновения|yo‘qolib ketish xavfi ostida
冰棍儿|фруктовый лёд; мороженое на палочке|tayoqchali muzqaymoq; mevali muz
冰山一角|верхушка айсберга|aysbergning uchi
冰天雪地|ледяной мир; снег и лёд повсюду|muz va qor bilan qoplangan yer
秉承|следовать традиции; придерживаться указаний|davom ettirmoq; ko‘rsatmalarga rioya qilmoq
秉持|придерживаться; отстаивать|qat’iy tutmoq; himoya qilmoq
并发症|осложнения|asoratlar
并购|слияние и поглощение; приобрести компанию|qo‘shib olish; kompaniyani sotib olish
并肩|плечом к плечу; бок о бок|yelkama-yelka; yonma-yon
病历|история болезни; медицинская карта|kasallik tarixi; tibbiy karta
并行|идти параллельно; выполняться одновременно|parallel ravishda yurmoq; bir vaqtda bajarilmoq
病症|заболевание; симптомы|kasallik; alomatlar
剥夺|лишить; отнять|mahrum qilmoq; tortib olmoq
波及|затронуть; распространиться на|ta’sir qilmoq; tarqalmoq
拨款|выделить средства; ассигновать|mablag‘ ajratmoq
波澜|волны; волнение|to‘lqinlar; hayajon
波折|перипетии; трудности|mashaqqatlar; qiyinchiliklar
不了了之|замять дело; оставить нерешённым|ishni oxiriga yetkazmaslik; ochiq qoldirmoq
不平|неровный; возмущённый|notekis; norozi; norozilik bildirmoq
不容|не позволять; не терпеть|yo‘l qo‘ymaslik; toqat qilmaslik
步入|вступить в; войти в|kirib bormoq; qadam qo‘ymoq
部首|ключ иероглифа|ieroglif kaliti
不以为然|считать неверным; не соглашаться|noto‘g‘ri deb hisoblamoq; qo‘shilmaslik
不由自主|невольно; помимо воли|beixtiyor; o‘z ixtiyorisiz
不约而同|одновременно прийти к одному решению|oldindan kelishmasdan bir xil ish qilmoq
不折不扣|полностью; стопроцентно|to‘liq; mutlaqo
不知不觉|незаметно; неосознанно|sezmay; o‘z-o‘zidan
不知所措|растеряться; не знать, как поступить|gangib qolmoq; nima qilishni bilmay qolmoq
猜想|предполагать; догадываться|taxmin qilmoq; faraz qilmoq
裁||kesib olmoq; bichmoq
裁定|постановить; вынести решение|qaror chiqarmoq; hukm qilmoq
财经|финансы и экономика|moliya va iqtisod
裁决|вынести решение; разрешить спор|qaror chiqarmoq; nizoni hal qilmoq
财力|финансовые ресурсы|moliyaviy imkoniyatlar
采||termoq; yig‘moq
采矿|добывать руду; вести горные работы|ruda qazib olmoq; konchilik qilmoq
采摘|срывать; собирать|uzmoq; terib olmoq
菜肴|блюдо; приготовленная еда|taom; pishirilgan ovqat
参见|см. также; обращаться к|shuningdek qarang; murojaat qilmoq
残||vayron qilmoq; yo‘q qilmoq
残缺|повреждённый; неполный|shikastlangan; to‘liq bo‘lmagan
惨白|мертвенно-бледный|oqarib ketgan; juda rangsiz
惨痛|горький; тяжёлый (об опыте)|achchiq; og‘ir (tajriba)
惨重|тяжёлый; катастрофический|og‘ir; halokatli
沧桑|превратности судьбы; большие перемены|hayot sinovlari; katta o‘zgarishlar
苍蝇|муха|pashsha
藏匿|прятать; скрываться|yashirmoq; berkinmoq
藏品|экспонат; коллекционный предмет|eksponat; kolleksiya buyumi
草丛|заросли; густая трава|chakalakzor; qalin o‘t-o‘lan
草坪|газон; лужайка|maysazor; chimzor
草药|лекарственные травы|dorivor o‘simliklar
测算|измерять и вычислять; рассчитывать|o‘lchab hisoblamoq; hisob-kitob qilmoq
侧重|делать упор; уделять особое внимание|asosiy e’tibor qaratmoq; alohida urg‘u bermoq
蹭||ishqalanmoq; tegib o‘tmoq
差错|ошибка; промах|xato; kamchilik
趁早|как можно скорее; пока не поздно|iloji boricha tezroq; kech bo‘lmasidan
呈|преподносить; принимать вид|taqdim etmoq; ko‘rinish olmoq
成才|стать способным; добиться успеха|qobiliyatli bo‘lib yetishmoq; muvaffaqiyatga erishmoq
成家|создать семью; стать специалистом|oila qurmoq; mutaxassis bo‘lmoq
成家立业|создать семью и построить карьеру|oila qurib, kasbini yo‘lga qo‘ymoq
承接|принять; перенять; взять на себя|qabul qilmoq; davom ettirmoq; zimmasiga olmoq
城墙|городская стена; крепостная стена|shahar devori; qal’a devori
成全|помочь кому-либо осуществить намерение|birovning niyatini amalga oshirishiga yordam bermoq
成群结队|группами; толпами|guruh-guruh bo‘lib; to‘da bo‘lib
成型|сформироваться; придать форму|shakllanmoq; shakl bermoq
诚意|искренность; добрые намерения|samimiylik; ezgu niyat
承载|нести; выдерживать нагрузку|ko‘tarmoq; yukni ko‘tarib turmoq
逞强|строить из себя сильного; бахвалиться|o‘zini kuchli ko‘rsatmoq; maqtanmoq
痴呆|глупый; слабоумный|ahmoq; aqli zaif
吃喝玩乐|наслаждаться едой, выпивкой и развлечениями|yeb-ichib, maishat qilib yashamoq
痴迷|быть одержимым; увлечься до самозабвения|mukkasidan ketmoq; qattiq berilib ketmoq
痴心|глубокая привязанность; преданная любовь|kuchli mehr; sadoqatli sevgi
持||ushlamoq; tutmoq
迟迟|медлить; долго не решаться|kechiktirmoq; uzoq vaqt jur’at qilmaslik
驰名|прославиться; быть известным|mashhur bo‘lmoq; nom qozonmoq
持平|оставаться на одном уровне; сохраняться без изменений|bir darajada qolmoq; o‘zgarmasdan turmoq
持之以恒|упорно продолжать; проявлять настойчивость|qat’iyat bilan davom ettirmoq; sabotli bo‘lmoq
尺度|масштаб; критерий; допустимый предел|mezon; o‘lchov; chegara
耻辱|позор; унижение|sharmandalik; tahqir
耻笑|высмеивать; насмехаться|ustidan kulmoq; mazax qilmoq
充||to‘ldirmoq; vazifasini bajarmoq
充斥|быть переполненным; изобиловать|to‘lib-toshmoq; haddan ortiq ko‘p bo‘lmoq
冲刺|финишировать; сделать рывок|marraga intilmoq; tez yugurmoq
憧憬|мечтать; с нетерпением ждать|orzu qilmoq; intiqlik bilan kutmoq
冲浪|заниматься сёрфингом|serfing qilmoq
冲洗|промывать; ополаскивать|chaymoq; yuvib tashlamoq
充裕|изобильный; достаточный|mo‘l; yetarli
冲撞|столкнуться; налететь; проявить неуважение|to‘qnashmoq; urilib ketmoq; hurmatsizlik qilmoq
重重|слой за слоем; многократно|qatlam-qatlam; ko‘p marta
重返|вернуться; снова отправиться|qaytmoq; yana borib kelmoq
重合|совпасть; наложиться|mos tushmoq; ustma-ust tushmoq
崇尚|почитать; ценить; проповедовать|e’zozlamoq; qadrlamoq; targ‘ib qilmoq
重申|вновь подтвердить; повторно заявить|qayta tasdiqlamoq; yana bayon qilmoq
重现|вновь появиться; восстановить|qayta paydo bo‘lmoq; qayta tiklamoq
宠||erkalatmoq; avaylamoq
藏身|укрыться; спрятаться|pana topmoq; yashirinmoq
操控|управлять; контролировать|boshqarmoq; nazorat qilmoq
斑点|пятно; крапинка|dog‘; nuqta
颁奖|вручать награду; награждать|mukofot topshirmoq; taqdirlamoq
斑马线|пешеходный переход|piyodalar o‘tish joyi
搬迁|переселиться; переместить|ko‘chib o‘tmoq; ko‘chirmoq
板块|плита; блок; тектоническая плита|plita; blok; tektonik plita
版权|авторское право|mualliflik huquqi
扮|наряжаться; изображать|rol o‘ynamoq; qiyofaga kirmoq; kiyinmoq
伴|партнёр; спутник|hamroh; sherik
拌|смешивать|aralashtirmoq
绊|споткнуться; поставить подножку|qoqilmoq; chalmoq
半边天|половина неба; женщины|osmonning yarmi; ayollar
半岛|полуостров|yarimorol
半导体|полупроводник|yarimo‘tkazgich
绊脚石|камень преткновения; помеха|to‘siq; qiyinchilik
半径|радиус|radius
半数|половина; половинная часть|yarmi; yarim qism
半信半疑|сомневаться; верить наполовину|shubhalanmoq; yarim ishonmoq
伴奏|аккомпанировать; аккомпанемент|jo‘r bo‘lmoq; jo‘rlik
帮手|помощник|yordamchi; ko‘makchi
绑|связывать; привязывать|bog‘lamoq; mahkamlamoq
煲|кастрюля для медленного приготовления; томить на слабом огне|qozon; past olovda dimlab pishirmoq
剥|чистить; снимать кожуру|archmoq; po‘stini olmoq
褒贬|хвалить и критиковать; оценивать|maqtamoq va tanqid qilmoq; baho bermoq
包罗万象|всеобъемлющий; охватывающий всё|hamma narsani qamrab olgan; keng qamrovli
包容|быть терпимым; прощать; вмещать|bag‘rikeng bo‘lmoq; kechirmoq; sig‘dirmoq
包扎|перевязать; обвязать|bog‘lamoq; bint bilan o‘ramoq
宝库|сокровищница; кладезь|xazina; boy manba
堡垒|крепость; бастион|qal’a; istehkom
饱满|полный; налитый; энергичный|to‘la; pishib yetilgan; jo‘shqin
保鲜|сохранять свежесть|yangiligini saqlamoq
保佑|благословлять; оберегать|duo qilmoq; asramoq
宝藏|сокровище; клад|xazina; yashirin boylik
豹|леопард; барс|qoplon; bars
报案|заявить в полицию; сообщить о происшествии|huquq-tartibot organlariga xabar bermoq
报废|списать; признать негодным|hisobdan chiqarmoq; yaroqsiz deb topmoq
暴风骤雨|буря; шторм; бурный натиск|bo‘ron; jala; shiddatli hujum
暴利|сверхприбыль; огромная прибыль|o‘ta katta foyda; mo‘may daromad
爆满|переполненный; забитый до отказа|liq to‘la; odamga to‘lib ketgan
暴躁|вспыльчивый; раздражительный|jahldor; tez achchiqlanadigan
爆竹|петарда; хлопушка|petarda; mushak
瑕疵|дефект; изъян|nuqson; kamchilik
辖区|территория юрисдикции; административный район|vakolat doirasidagi hudud; ma’muriy hudud
狭小|узкий; тесный|tor; siqiq
狭义|узкое значение; в узком смысле|tor ma’no; tor ma’noda
下半场|второй тайм; вторая половина состязания|ikkinchi bo‘lim; musobaqaning ikkinchi yarmi
下场|судьба; исход (обычно неблагоприятный)|taqdir; yakun (odatda noxush)
下达|отдавать распоряжение; передавать на нижний уровень|buyruq bermoq; quyi bosqichga yetkazmoq
下跌|падать; снижаться|pasaymoq; tushmoq
吓唬|пугать; запугивать|qo‘rqitmoq; vahimaga solmoq
下滑|скользить вниз; снижаться|pastga sirpanmoq; pasaymoq
下级|подчинённый; нижестоящий уровень|bo‘ysunuvchi; quyi daraja
下令|приказать; отдать распоряжение|buyurmoq; farmoyish bermoq
下落|местонахождение; дальнейшая судьба|qayerdaligi; keyingi taqdiri
吓人|страшный; пугающий|qo‘rqinchli; vahimali
下手|приступить; взяться за дело|ishga kirishmoq; qo‘l urmoq
下台|уйти с должности; сойти со сцены|lavozimidan ketmoq; sahnadan tushmoq
下调|снизить; скорректировать вниз|pasaytirmoq; quyi tomonga tuzatmoq
下行|двигаться вниз по течению; поезд вниз; передавать распоряжение сверху вниз|oqim bo‘ylab pastga yurmoq; pastga qarab ketadigan poyezd; yuqoridan quyi bo‘g‘inga ko‘rsatma bermoq
下意识|подсознание; бессознательно|ongsizlik; beixtiyor
下游|нижнее течение реки; нижняя часть|daryoning quyi oqimi; quyi qism
下坠|падать; опускаться|tushmoq; pastga qulamoq
掀|поднимать; откидывать|ko‘tarmoq; ochib tashlamoq
仙鹤|краснощёкий журавль|qizil tojli turna
鲜活|живой; яркий; свежий (о продуктах)|jonli; yorqin; yangi (oziq-ovqat haqida)
先例|прецедент; пример из прошлого|pretsedent; avvalgi namuna
鲜美|свежий и вкусный|yangi va mazali
仙女|фея; небесная дева|pari; samoviy qiz
先天|врождённое; природные задатки|tug‘ma xususiyat; tabiiy qobiliyat
鲜血|кровь|qon
嫌弃|презирать; сторониться|mensimaslik; o‘zini olib qochmoq
闲置|оставлять без использования; простаивать|foydalanmay turmoq; bekor yotmoq
显而易见|очевидный; само собой разумеющийся|aniq-ravshan; o‘z-o‘zidan ayon
显赫|именитый; прославленный|nomdor; shuhrat qozongan
显露|проявляться; становиться видимым|namoyon bo‘lmoq; ko‘rinib qolmoq
显示器|монитор; устройство отображения|monitor; tasvirni ko‘rsatuvchi qurilma
显微镜|микроскоп|mikroskop
鲜为人知|малоизвестный; известный немногим|kam tanilgan; ozchilikka ma’lum
显现|появляться; становиться заметным|paydo bo‘lmoq; ko‘zga tashlanmoq
显性|видимый; доминантный (о гене)|ko‘rinadigan; dominant (gen haqida)
显眼|заметный; бросающийся в глаза|ko‘zga tashlanadigan; yaqqol
陷|проваливаться; застревать|botib qolmoq; tiqilib qolmoq
馅|начинка|masalliq; nachinka
限定|ограничивать; устанавливать предел|cheklamoq; chegaralamoq
现任|нынешний; занимающий должность в настоящее время|amaldagi; hozir lavozimda bo‘lgan
线条|линия; очертание|chiziq; kontur
现行|действующий; ныне применяемый|amaldagi; hozir qo‘llanilayotgan
镶|инкрустировать; вставлять|naqshlab o‘rnatmoq; qistirib joylamoq
相伴|сопровождать друг друга; быть вместе|bir-biriga hamroh bo‘lmoq; birga bo‘lmoq
相继|поочерёдно; один за другим|navbatma-navbat; ketma-ket
相近|близкий; схожий|yaqin; o‘xshash
香料|пряность; специя|ziravor; maza beruvchi qo‘shimcha
乡亲|земляки; местные жители|yurtdoshlar; mahalliy aholi
相识|знакомиться; знакомый|tanishmoq; tanish odam
相提并论|ставить на одну доску; упоминать наравне|bir qatorga qo‘ymoq; tenglab tilga olmoq
相通|быть связанным; сообщаться|bog‘langan bo‘lmoq; tutashmoq
乡下|сельская местность; деревня|qishloq joy; qishloq
香油|кунжутное масло|kunjut yog‘i
相遇|встретиться; повстречаться|uchrashmoq; duch kelmoq
相约|договориться о встрече|uchrashishga kelishmoq
祥和|благополучный и мирный; спокойный|osoyishta va tinch; farovon
详尽|подробный и исчерпывающий|batafsil va to‘liq
享|наслаждаться; пользоваться|bahramand bo‘lmoq; foydalanmoq
享用|наслаждаться; пользоваться благами|bahramand bo‘lmoq; ne’matlardan foydalanmoq
享有|обладать; пользоваться (правом/репутацией)|ega bo‘lmoq; (huquq yoki obro‘dan) foydalanmoq
橡胶|резина; каучук|rezina; kauchuk
相貌|черты лица; внешность|yuz-ko‘rinish; tashqi qiyofa
像样|приличный; достойный; как следует|durust; munosib; ko‘ngildagidek
消|рассеиваться; исчезать; устранять|tarqalmoq; yo‘qolmoq; bartaraf etmoq
销|сбывать; продавать; аннулировать|sotmoq; bekor qilmoq
消沉|подавленный; унылый|tushkun; xafa
消磨|изнашивать; коротать (время)|yemirmoq; (vaqtni) o‘tkazmoq
消遣|развлекаться; коротать время|ko‘ngil yozmoq; vaqt o‘tkazmoq
萧条|запустелый; унылый; экономический спад|kimsasiz; tushkun; iqtisodiy pasayish
嚣张|наглый; заносчивый|surbet; manman
小菜一碟|пустяковое дело; пара пустяков|juda oson ish; hech gap emas
小丑|клоун|masxaraboz
小看|недооценивать; смотреть свысока|mensimaslik; past nazar bilan qaramoq
小康|умеренно зажиточный; обеспеченный|o‘rtacha farovon; to‘q
小品|миниатюра; короткая сценка|kichik sahna asari; qisqa sahna ko‘rinishi
小人|подлец; низкий человек|pastkash; razil odam
小提琴|скрипка|skripka
效仿|подражать; копировать|taqlid qilmoq; nusxa olmoq
孝敬|почитать и заботиться о родителях|ota-onani e’zozlamoq va g‘amxo‘rlik qilmoq
效力|эффективность; служить (кому-либо)|samaradorlik; xizmat qilmoq
邪||yovuz; razil
挟持|удерживать силой; взять в заложники|zo‘rlik bilan ushlab turmoq; garovga olmoq
协定|соглашение; договор|bitim; kelishuv
邪恶|злой; зловещий|yovuz; qabih
携手|объединиться; работать сообща|birlashmoq; hamkorlik qilmoq
协同|взаимодействовать; координировать|hamkorlik qilmoq; muvofiqlashtirmoq
协作|сотрудничать; координировать работу|hamkorlik qilmoq; ishni muvofiqlashtirmoq
写照|изображение; характерное отражение|tasvir; o‘ziga xos aks
泄|протекать; просачиваться; разглашать|sizib chiqmoq; oshkor qilmoq
泻|хлестать; изливаться; диарея|quyilib oqmoq; ich ketishi
卸|разгружать; снимать, сбрасывать|yukni tushirmoq; yechmoq
泄漏|утечка; протекать|sizib chiqish; oqib chiqmoq
泄密|разглашать секрет; утечка информации|sirni oshkor qilmoq; ma’lumot sizishi
卸任|оставить должность; уйти с поста|lavozimini tark etmoq; mansabdan ketmoq
卸载|разгружать; удалять программу|yukni tushirmoq; dasturni o‘chirib tashlamoq
心安理得|со спокойной совестью; без угрызений совести|vijdoni xotirjam; ko‘ngli to‘q
心病|душевное беспокойство; больное место|ko‘ngil g‘ashligi; nozik masala
心肠|сердце; характер; душевный склад|ko‘ngil; fe’l-atvor
新潮|модный; современный|zamonaviy; urfdagi
薪酬|оплата труда; вознаграждение|ish haqi; mukofot puli
新春|Новый год; начало весны|yangi yil; bahor boshi
心慌|тревожиться; быть растерянным|xavotirlanmoq; sarosimaga tushmoq
心急如焚|сгорать от тревоги; места себе не находить|qattiq xavotirlanmoq; ich-etini yemoq
心灵手巧|умелый и ловкий; золотые руки|qo‘li gul; epchil
芯片|микросхема; чип|mikrosxema; chip
新奇|необычный; новый и интересный|noodatiy; yangi va qiziqarli
心声|сокровенное желание; голос сердца|dildagi gap; qalb istagi
新生|новый; новорождённый; первокурсник|yangi; yangi tug‘ilgan; birinchi kurs talabasi
心事|забота; тревога; сокровенные мысли|tashvish; ko‘ngildagi gap
新式|новый фасон; современный тип|yangi uslub; zamonaviy tur
新手|новичок; начинающий|yangi boshlovchi; tajribasiz kishi
心思|мысли; намерения; душевные силы|fikrlar; niyat; ko‘ngil
心酸|горько; щемящее чувство|alamli; ko‘ngilni ezadigan tuyg‘u
辛酸|горести; тяготы; горький|mashaqqatlar; alam; achchiq
欣喜|радостный; обрадоваться|xursand; quvonmoq
心想事成|пусть всё задуманное сбудется|barcha niyatlar amalga oshsin
心胸|широта души; душевный склад|qalb kengligi; ko‘ngil
心意|намерение; добрые чувства; знак внимания|niyat; ezgu munosabat; e’tibor belgisi
信贷|кредит; кредитование|kredit; qarz berish
信件|письмо; корреспонденция|xat; yozishma
兴奋剂|стимулятор; допинг|qo‘zg‘atuvchi modda; doping
星级|звёздный рейтинг; категория по числу звёзд|yulduzlar reytingi; yulduz darajasi
兴建|строить; возводить|qurmoq; barpo etmoq
星球|небесное тело; планета|osmon jismi; sayyora
兴盛|процветать; процветание|ravnaq topmoq; gullab-yashnash
星系|галактика; звёздная система|galaktika; yulduzlar tizimi
猩猩|орангутан; человекообразная обезьяна|orangutan; odamga o‘xshash maymun
星座|созвездие; знак зодиака|yulduz turkumi; burj
刑法|уголовное право|jinoyat huquqi
行使|осуществлять; пользоваться (правом)|amalga oshirmoq; (huquqdan) foydalanmoq
行星|планета|sayyora
形形色色|всевозможный; разнообразный|xilma-xil; har turli
形影不离|неразлучный; не отходить друг от друга|ajralmas; bir-biridan ayrilmas
醒目|броский; заметный|ko‘zga tashlanadigan; yaqqol
醒悟|осознать; прозреть|anglab yetmoq; hushyor tortmoq
幸存|выжить; уцелеть|omon qolmoq; tirik qolmoq
幸免|избежать беды по счастливой случайности|baxtli tasodif bilan balodan qutulmoq
姓氏|фамилия|familiya
兴致|настроение; интерес|kayfiyat; qiziqish
凶残|жестокий; кровожадный|shafqatsiz; vahshiy
凶狠|свирепый; жестокий|shafqatsiz; yovuz
凶猛|свирепый; яростный|vahshiy; shiddatli
胸有成竹|иметь ясный план; быть уверенным в задуманном|puxta reja tuzib qo‘ygan bo‘lmoq; rejasiga ishonmoq
雄性|мужской; самец|erkak jinsli; erkak hayvon
修补|чинить; латать|yamamoq; tuzatmoq
修长|стройный; длинный и изящный|uzun va nozik; kelishgan
休克|шок; потеря сознания|shok; hushdan ketish
羞愧|пристыженный; испытывать стыд|uyalgan; xijolat bo‘lgan
休眠|находиться в состоянии покоя; впадать в спячку|uyqu holatida bo‘lmoq; qishki uyquga ketmoq
休想|и не думай; даже не рассчитывай|xayoliga ham keltirma; umid qilma
修正|исправить; скорректировать|tuzatmoq; qayta ko‘rib chiqmoq
锈||zang; zanglamoq
嗅|нюхать; чуять|hidlamoq; hidini sezmoq
秀丽|красивый; живописный|chiroyli; go‘zal
秀美|изящный; красивый|nafis; go‘zal
袖手旁观|стоять сложа руки; оставаться безучастным|qo‘l qovushtirib qarab turmoq; befarq bo‘lmoq
须||shart; kerak; lozim
虚||bo‘sh; kuchsiz; soxta
虚构|выдумывать; сочинять|to‘qib chiqarmoq; uydirmoq
虚幻|иллюзорный; нереальный|xayoliy; haqiqiy bo‘lmagan
虚拟|виртуальный; вымышленный; моделировать|virtual; xayoliy; taqlid qilmoq
虚弱|слабый; ослабленный|zaif; nimjon
徐徐|медленно; постепенно|asta-sekin; sekin
许||ruxsat bermoq; ijozat bermoq
许愿|загадывать желание|tilak tilamoq
序||tartib; ketma-ketlik; so‘zboshi
续||davom ettirmoq; qayta boshlamoq
絮叨|многословный; болтливый|sergap; ezma
续航|запас хода; время автономной работы|yurish masofasi; batareyaning ishlash vaqti
序列|последовательность; ряд|ketma-ketlik; qator
序幕|пролог; вступление|muqaddima; boshlanish
旭日|восходящее солнце|chiqayotgan quyosh
宣称|заявлять; утверждать|da’vo qilmoq; bayon qilmoq
宣读|зачитывать вслух|ovoz chiqarib o‘qib bermoq
宣告|объявлять; провозглашать|e’lon qilmoq; bildirmoq
喧闹|шуметь; галдеть|shovqin qilmoq; g‘ala-g‘ovur qilmoq
宣泄|выплеснуть эмоции; дать выход чувствам|his-tuyg‘ularini to‘kib solmoq; ichidagini chiqarib yubormoq
宣言|декларация; заявление|deklaratsiya; bayonot
玄||sirli; jumboqli
玄机|тайна; скрытый смысл; хитрость|sir; yashirin ma’no; nozik jihat
旋涡|водоворот; вихрь|girdob; uyurma
悬崖|обрыв; крутая скала|jarlik; tik qoya
选民|избиратель|saylovchi
选项|вариант; пункт выбора|tanlov varianti; band
选用|выбирать для использования|tanlab ishlatmoq
削减|сократить; урезать|qisqartirmoq; kamaytirmoq
靴子|сапоги; ботинки|etik; botinka
学识|знания; эрудиция|bilim; ilm
学士|бакалавр; степень бакалавра|bakalavr; bakalavr darajasi
穴位|точка акупунктуры|akupunktura nuqtasi
学业|учёба; учебная деятельность|ta’lim; o‘qish
学子|учащийся; студент|o‘quvchi; talaba
雪山|заснеженная гора|qorli tog‘
血脉|кровеносные сосуды; родовая линия|qon tomirlari; nasl
血缘|кровное родство; происхождение|qon-qarindoshlik; nasl-nasab
熏||dudlamoq; tutatmoq
勋章|орден; медаль|orden; medal
旬|декада (10 дней); десять лет (о возрасте)|o‘n kunlik davr; yoshni ifodalashda o‘n yil
寻||qidirmoq; izlamoq
寻常|обычный; привычный|odatiy; oddiy
巡回|гастролировать; объезжать; обходить|gastrol qilmoq; aylanib chiqmoq
巡视|осматривать; инспектировать|ko‘zdan kechirmoq; tekshirmoq
训||tanbeh bermoq; o‘rgatmoq
驯|приручать; укрощать|qo‘lga o‘rgatmoq; yuvosh qilmoq
迅猛|стремительный; бурный|tez va shiddatli
逊色|уступать; быть хуже|pastroq bo‘lmoq; teng kelmaslik
押||garovga qo‘ymoq; hibsga olmoq; kuzatib bormoq
压倒|подавить; одолеть|yengib chiqmoq; bosib qo‘ymoq
丫头|девчонка; девушка (разг.)|qiz; qizaloq
压轴|кульминационный номер; заключительный номер|yakuniy muhim chiqish; final raqam
芽||kurtak; novda
哑||soqov; ovozi bo‘g‘iq
揠苗助长|поспешным усердием испортить дело|shoshqaloqlik bilan ishga ortiqcha aralashib, uni buzmoq
烟囱|дымоход; труба|mo‘ri; tutun quvuri
咽喉|горло; глотка|tomoq; halqum
烟火|дым и огонь; фейерверк|tutun va olov; mushakbozlik
延||uzaytirmoq; cho‘zmoq
沿岸|побережье; вдоль берега|qirg‘oq bo‘yi; sohil
言辞|слова; формулировки|so‘zlar; ifodalar
延缓|замедлить; отсрочить|sekinlashtirmoq; kechiktirmoq
严谨|строгий; тщательный|puxta; qat’iy
沿途|по пути; вдоль дороги|yo‘l bo‘ylab; yo‘l chetida
阎王|Яма; владыка ада|Yama; do‘zax hukmdori
延误|задержать; привести к опозданию|kechiktirmoq; o‘z vaqtida yetib bormaslikka sabab bo‘lmoq
沿线|вдоль линии; вдоль маршрута|chiziq bo‘ylab; yo‘nalish bo‘ylab
言行|слова и поступки; поведение|so‘z va ish; xulq-atvor
沿用|продолжать использовать|foydalanishda davom etmoq
掩耳盗铃|заниматься самообманом|o‘zini o‘zi aldamoq
眼红|завидовать; завистливый|hasad qilmoq; ichi qizimoq
演化|эволюционировать; развиваться|evolyutsiyalanmoq; rivojlanmoq
演技|актёрское мастерство; игра|aktyorlik mahorati; ijro
眼界|кругозор; поле зрения|dunyoqarash; ko‘rish maydoni
演练|отрабатывать; тренироваться|mashq qilmoq; amalda sinab ko‘rmoq
衍生|порождать; производить|keltirib chiqarmoq; hosil bo‘lmoq
演示|демонстрировать; показывать|namoyish qilmoq; ko‘rsatmoq
演说|речь; выступление|nutq; ma’ruza
咽||yutmoq
验|проверять; испытывать|tekshirmoq; sinab ko‘rmoq
厌烦|надоесть; устать от|joniga tegmoq; bezmoq
厌倦|устать от; пресытиться|zerikmoq; bezmoq
艳丽|яркий и красивый; роскошный|yorqin va go‘zal; hashamdor
燕子|ласточка|qaldirg‘och
秧歌|народный танец «Янге»|yangge xalq raqsi
扬||ko‘tarmoq; ko‘tarib chiqmoq
阳历|солнечный календарь|quyosh taqvimi
杨树|тополь|terak
阳性|положительный; мужской род|ijobiy; erkak jins
洋溢|переполнять; быть наполненным|jo‘shib turmoq; to‘lib-toshmoq
养活|содержать; прокормить|boqmoq; ta’minlamoq
养生|заботиться о здоровье; оздоровление|sog‘lom turmush tarzini yuritmoq; salomatlikni asrash
仰望|смотреть вверх; восхищаться|yuqoriga qaramoq; havas bilan qaramoq
养育|воспитывать; растить|tarbiyalamoq; voyaga yetkazmoq
养殖|разводить; выращивать|boqmoq; yetishtirmoq
样本|образец; проба|namuna
邀||taklif qilmoq
妖怪|чудовище; демон|maxluq; jin
窑||xumdon; sopol pishirish pechi
摇篮|колыбель|beshik
摇摇欲坠|шаткий; вот-вот рухнуть|qimirlab turgan; qulash arafasida
药材|лекарственное сырьё; лекарственные травы|dorivor xomashyo; shifobaxsh giyohlar
药方|рецепт; назначение лекарства|dori retsepti
要害|жизненно важное место; уязвимое место|hayotiy muhim joy; zaif nuqta
要紧|важный; срочный|muhim; shoshilinch
要领|суть; основные положения|mohiyat; asosiy jihatlar
要强|стремиться быть лучше; честолюбивый|o‘zini ko‘rsatishga intilmoq; tirishqoq
椰子|кокосовая пальма; кокос|kokos palmasi; kokos
野餐|пикник; прогулка с едой|piknik; tabiat qo‘ynida ovqatlanish
野兽|дикий зверь|yovvoyi hayvon
夜班|ночная смена|tungi smena
业绩|достижения; результаты работы|yutuqlar; ish natijalari
液晶|жидкий кристалл; жидкокристаллический дисплей|suyuq kristall; suyuq kristalli ekran
夜校|вечерняя школа; вечерние курсы|kechki maktab; kechki kurslar
夜宵|поздний ужин; ночной перекус|kechki ovqat; tungi tamaddi
夜以继日|днём и ночью; круглосуточно трудиться|kecha-yu kunduz; tinimsiz ishlamoq
依||suyanmoq; bog‘liq bo‘lmoq
依附|зависеть; примыкать; искать покровительства|qaram bo‘lmoq; yoniga qo‘shilmoq
医务|медицинская работа; медицинская служба|tibbiy ish; tibbiy xizmat
一线|передовая; первая линия|oldingi saf; birinchi chiziq
依依不舍|не хотеть расставаться; расставаться с сожалением|ayrilishni istamaslik; sog‘inib xayrlashmoq
仪表|внешний вид; измерительный прибор|tashqi ko‘rinish; o‘lchov asbobi
一并|вместе; одновременно; заодно|birgalikda; bir vaqtda; qo‘shib
疑点|сомнительный момент; повод для сомнения|shubhali jihat; shubha uchun asos
一动不动|неподвижно; не шевелясь|qimirlamay; qotib turib
一概|все без исключения; сплошь|barchasi; istisnosiz
一概而论|сваливать всё в одну кучу; подходить ко всему одинаково|hamma narsani bir xil baholamoq; farqiga bormaslik
一晃|пролететь в мгновение ока|ko‘z ochib yumguncha o‘tmoq
移交|передавать; сдавать|topshirmoq; o‘tkazib bermoq
一技之长|особый навык; сильная сторона|muayyan mahorat; kuchli tomon
宜居|пригодный и удобный для жизни|yashash uchun qulay
遗漏|упустить; пропустить|e’tibordan chetda qoldirmoq; tushirib qoldirmoq
疑虑|сомнения; тревога|shubha; xavotir
一面|одна сторона; одна поверхность|bir tomon; bir yuza
遗弃|бросить; оставить|tashlab ketmoq; voz kechmoq
怡然自得|довольный и спокойный; наслаждаться покоем|mamnun va xotirjam; rohatlanmoq
宜人|приятный; благоприятный|yoqimli; qulay
一事无成|ничего не добиться; потерпеть полную неудачу|hech narsaga erishmaslik; butunlay muvaffaqiyatsiz bo‘lmoq
遗体|останки; тело умершего|marhumning jasadi; qoldiqlar
遗忘|забыть; позабыть|unutmoq; yoddan chiqarmoq
一味|упорно; без разбора; только и делать, что...|tinimsiz; farqiga bormay; faqat ... qilmoq
遗物|вещи покойного; реликвии|marhumdan qolgan buyumlar; yodgorliklar
移植|пересадить; трансплантировать|ko‘chirib o‘tkazmoq; transplantatsiya qilmoq
遗嘱|завещание|vasiyatnoma
矣||klassik xitoy tilidagi yakunlovchi yuklama (hozirgi 了 ga o‘xshash)
倚||suyanmoq; tayanmoq
以身作则|показывать пример собственным поведением|o‘z xulqi bilan namuna ko‘rsatmoq
以至于|до такой степени, что; настолько, что|shu darajadaki; natijada
议||fikr bildirmoq; muhokama qilmoq
译||tarjima qilmoq
溢||toshmoq; oshib ketmoq
议程|повестка дня|kun tartibi
一成不变|неизменный; застывший|o‘zgarmas; bir holatda qolgan
一筹莫展|зайти в тупик; не знать, что предпринять|boshi qotmoq; nima qilishni bilmay qolmoq
一干二净|полностью; подчистую; без остатка|butunlay; izsiz; qoldirmay
义工|волонтёр; добровольная работа|ko‘ngilli; ko‘ngilli mehnat
一鼓作气|одним махом; единым порывом|bir zarbda; bir g‘ayrat bilan
一经|как только; сразу после того как|bilanoq; ...gan zahoti
一举|одним действием; одним махом|bir harakat bilan; bir yo‘la
一举一动|каждое движение; каждый поступок|har bir harakat; har bir qadam
异口同声|в один голос; хором|bir ovozdan; jo‘r bo‘lib
易拉罐|банка с отрывным язычком|ochiladigan tilchali banka
一揽子|всеобъемлющий; комплексный|kompleks; keng qamrovli
屹立|возвышаться; стоять непоколебимо|qad ko‘tarmoq; mustahkam turmoq
一连|подряд; без перерыва|ketma-ket; uzluksiz
一连串|целая череда; последовательность|birin-ketin kelgan qator; ketma-ketlik
一毛不拔|крайне скупой; не дать ни копейки|o‘ta ziqna; bir tiyin ham bermaslik
疫苗|вакцина|vaksina
一旁|в стороне; сбоку|chetda; yon tomonda
一声不吭|молчать; не произнести ни слова|indamaslik; bir og‘iz ham gapirmaslik
一手|самостоятельно; одним человеком; умение|mustaqil ravishda; bir o‘zi; mahorat
一塌糊涂|полный беспорядок; из рук вон плохо|to‘liq tartibsizlik; juda yomon ahvolda
一体|единое целое; неразделимый|yaxlit bir butun; ajralmas
一头|очертя голову; голова; счётное слово для крупного скота|shartta; bosh; yirik chorva uchun hisob so‘zi
亿万|десятки и сотни миллионов; бесчисленное множество|yuz millionlab; behisob miqdor
意味|значение; смысл|ma’no; mazmun
一无所有|не иметь ничего; остаться без всего|hech narsasi yo‘q bo‘lmoq; hammasidan ayrilmoq
一无所知|ничего не знать; быть совершенно неосведомлённым|hech narsani bilmaslik; mutlaqo bexabar bo‘lmoq
异想天开|предаваться фантазиям; нелепая затея|xayolparastlik qilmoq; bema’ni g‘oya
一心|всем сердцем; целиком сосредоточиться|butun qalbi bilan; diqqatini jamlamoq
异性|противоположный пол|qarama-qarshi jins
一心一意|всем сердцем; целиком и полностью|butun qalbi bilan; chin dildan
一言不发|не произнести ни слова; промолчать|bir og‘iz ham gapirmaslik; indamaslik
抑扬顿挫|ритм речи с чередованием подъёмов и спадов|nutq ohangining ko‘tarilib-pasayishi; ifodali ritm
一言一行|каждое слово и каждый поступок|har bir so‘z va har bir xatti-harakat
异议|возражение; несогласие|e’tiroz; norozilik
一应俱全|есть всё необходимое; полностью укомплектованный|hamma kerakli narsa mavjud; to‘liq jihozlangan
抑郁|подавленный; угнетённый|tushkun; ruhan ezilgan
抑郁症|клиническая депрессия; депрессивное расстройство|klinik depressiya; depressiv buzilish
一早|рано утром|erta tongda
一针见血|попасть в точку; сказать прямо и по существу|gapning lo‘nda va aniq joyini aytmoq; nishonga urmoq
阴暗|мрачный; тёмный|qorong‘i; ma’yus
因地制宜|учитывать местные условия; подстраивать меры|mahalliy sharoitga moslash; chorani shunga qarab belgilash
阴历|лунный календарь|oy taqvimi
殷勤|услужливый; предупредительный|xushmuomala; iltifotli
因人而异|различаться в зависимости от человека|odamdan odamga farq qilmoq
阴性|отрицательный; женский (грам.)|manfiy; ayol jinsiga oid
银幕|киноэкран|kino ekrani
瘾||qaramlik; mukkasidan ketish
隐含|подразумевать; скрыто содержать|yashirin ma’noni anglatmoq; ichiga olmoq
引荐|рекомендовать; представить кому-либо|tavsiya qilmoq; tanishtirib qo‘ymoq
引经据典|ссылаться на классиков; приводить цитаты|klassiklarga murojaat qilmoq; iqtibos keltirmoq
引领|вести; направлять|yetaklamoq; yo‘l ko‘rsatmoq
隐情|скрытые обстоятельства; тайное намерение|yashirin holat; pinhon niyat
引人入胜|захватывающий; увлекательный|maftunkor; qiziqarli
引人注目|привлекать внимание; броский|e’tiborni tortadigan; ko‘zga tashlanadigan
隐形|невидимый; скрытый|ko‘rinmas; yashirin
隐性|скрытый; рецессивный|yashirin; retsessiv
引诱|заманивать; соблазнять|aldab jalb qilmoq; vasvasaga solmoq
印章|печать; штамп|muhr; tamg‘a
印证|подтверждать; служить доказательством|tasdiqlamoq; dalil bo‘lmoq
鹰|орёл; ястреб|burgut; qirg‘iy
应有尽有|есть всё необходимое; полный ассортимент|hamma kerakli narsa bor; to‘liq tanlov
荧光|флуоресценция; люминесцентное свечение|flyuorestsensiya; nur taratish
迎合|угождать; подстраиваться|ko‘nglini topmoq; moslashmoq
赢家|победитель|g‘olib
营救|спасать; вызволять|qutqarmoq; ozod qilmoq
营利|извлекать прибыль; заниматься коммерцией|foyda ko‘rmoq; daromad olish
营销|маркетинг; продвижение товаров|marketing; savdoni rag‘batlantirish
营造|создавать; формировать|yaratmoq; shakllantirmoq
影像||tasvir; tasvir yozuvi
硬朗|крепкий; бодрый (о пожилом человеке)|baquvvat; tetik (keksalar haqida)
硬盘|жёсткий диск|qattiq disk
涌||otilib chiqmoq; oqib kelmoq
永久|вечный; постоянный|abadiy; doimiy
勇往直前|смело идти вперёд|dadil olg‘a bormoq
用意|намерение; замысел|niyat; maqsad
忧愁|печальный; тревожный|g‘amgin; xavotirli
忧虑|беспокоиться; тревожиться|xavotirlanmoq; tashvishlanmoq
悠闲|непринуждённый; беззаботный|bemalol; xotirjam
优雅|изящный; элегантный|nafis; ko‘rkam
邮编|почтовый индекс|pochta indeksi
游船|прогулочный катер|sayr kemasi
油画|масляная живопись; картина маслом|moybo‘yoq rasmi
尤为|особенно; в особенности|ayniqsa; xususan
犹豫不决|нерешительный; колебаться|ikkilanmoq; qat’iyatsiz
邮政|почта; почтовая служба|pochta; pochta xizmati
由衷|искренне; от всего сердца|chin dildan; samimiy
有待|ещё предстоит; подлежит рассмотрению|hali qilinishi kerak; ko‘rib chiqilishi lozim
有的放矢|действовать целенаправленно|aniq maqsad bilan ish tutmoq
友人|друг|do‘st
友善|дружелюбный; доброжелательный|do‘stona; xushmuomala
有声有色|яркий; живой|jonli; yorqin
有望|иметь надежду; перспективный|umid bor; istiqbolli
有幸|иметь счастье; посчастливиться|baxtiga; nasib qilmoq
有意|намереваться; намеренно|niyat qilmoq; ataylab
有朝一日|однажды; когда-нибудь|bir kun kelib; qachondir
诱饵|приманка|xo‘rak; o‘lja
诱发|вызывать; провоцировать|keltirib chiqarmoq; qo‘zg‘atmoq
诱人|привлекательный; соблазнительный|jozibali; maftunkor
淤泥|ил; осадок|loyqa; balchiq
余||ortiqcha; qolgan qismi
渔船|рыбацкая лодка; рыболовное судно|baliqchi qayig‘i; baliq ovlash kemasi
余地|пространство для манёвра; запас возможностей|imkoniyat; harakat uchun joy
愚公移山|настойчивостью можно свернуть горы; легенда о Юй-гуне, передвинувшем горы|qat’iyat bilan tog‘ni ham ko‘chirish mumkin; tog‘ni ko‘chirgan Yu-gun rivoyati
逾期|просроченный; просрочить срок|muddati o‘tgan; muddatdan kechikmoq
愉悦|радостный; приятный|quvonchli; yoqimli
与否|ли; или нет|yoki yo‘qligi
与时俱进||zamon bilan hamnafas bo‘lmoq
与众不同||boshqalardan ajralib turmoq; o‘ziga xos
预感|предчувствие; предчувствовать|oldindan sezish; bashorat qilmoq
预告|предварительно объявить; анонс|oldindan e’lon qilmoq; anons
愈合|зажить; срастись|bitmoq; tuzalmoq
愈加|ещё больше; тем более|yanada; tobora ko‘proq
预见|предвидеть; предсказать|oldindan ko‘rmoq; bashorat qilmoq
预警|предупредить заранее; раннее предупреждение|oldindan ogohlantirmoq; erta ogohlantirish
郁闷|унылый; подавленный; досадовать|tushkun; siqilgan; xafa bo‘lmoq
遇难|погибнуть; потерпеть бедствие|halok bo‘lmoq; falokatga uchramoq
预示|предвещать; указывать на|darak bermoq; ishora qilmoq
预售|предварительная продажа; продавать заранее|oldindan sotuv; oldindan sotmoq
遇险|попасть в опасность; оказаться в беде|xavfga duch kelmoq; mushkul ahvolga tushmoq
愈演愈烈|разгораться всё сильнее; обостряться|tobora kuchaymoq; keskinlashmoq
寓意|мораль; скрытый смысл|ibrat; yashirin ma’no
冤||nohaqlik; adolatsizlik
渊源|происхождение; истоки|kelib chiqish; ildizlar
原创|оригинальный; создать самостоятельно|o‘ziga xos; mustaqil yaratmoq
缘分|судьбоносная связь; предопределённость|taqdir rishtasi; nasib
元老|ветеран; старейшина|faxriy; oqsoqol
园区|индустриальный или технологический парк|sanoat yoki texnologiya parki
源头|исток; источник|manba; boshlanish nuqtasi
原型|прототип; архетип|prototip; arxetip
源源不断|непрерывным потоком; поступать без конца|tinimsiz oqim; uzluksiz kelib turmoq
源远流长|иметь долгую историю; уходить корнями в далёкое прошлое|uzoq tarixga ega; ildizi uzoqqa borib taqalmoq
原汁原味|аутентичный; сохраняющий первоначальный вкус|asl; o‘z holicha saqlangan
原装|оригинальный; заводской комплектации|original; zavodda ishlab chiqarilgan
远见|дальновидность; предвидение|uzoqni ko‘ra bilish; farosat
远近闻名|широко известный; знаменитый повсюду|uzoq-yaqinga mashhur; hamma joyda tanilgan
怨恨|ненавидеть; затаить обиду|gina qilmoq; nafratlanmoq
怨气|обида; недовольство|xafagarchilik; norozilik
院士|академик; член национальной академии|akademik; milliy akademiya a’zosi
怨言|жалоба; недовольство|shikoyat; norozilik
曰||demoq (klassik uslubda)
约定俗成|устоявшийся благодаря обычаю и общему соглашению|kelishuv va urf-odat orqali shakllangan
悦耳|приятный на слух|quloqqa yoqimli
越发|всё больше; ещё сильнее|tobora; yanada
越过|пересечь; перейти через|oshmoq; kesib o‘tmoq
阅览|читать; просматривать|o‘qimoq; ko‘zdan kechirmoq
阅历|жизненный опыт; пережить|hayotiy tajriba; boshdan kechirmoq
晕头转向|растерянный; потерявший ориентацию|gangib qolgan; nima qilishini bilmay qolgan
陨石|метеорит|meteorit
运筹帷幄|разрабатывать стратегию; руководить действиями|strategiyani puxta rejalamoq; ishlarni boshqarmoq
孕妇|беременная женщина|homilador ayol
蕴含|заключать в себе; содержать|o‘z ichiga olmoq; mujassam etmoq
运河|канал|kanal
韵味|особое очарование; колорит|o‘ziga xos joziba; tarovat
运转|работать; функционировать; вращаться|ishlamoq; faoliyat yuritmoq; aylanmoq
杂乱无章|хаотичный; беспорядочный|tartibsiz; pala-partish
栽||ekmoq; ko‘chat o‘tqazmoq
栽赃|подбросить улики; оговорить|soxta dalil qo‘ymoq; tuhmat qilmoq
再度|снова; ещё раз|yana; qaytadan
在所难免|неизбежный; этого не избежать|muqarrar; bundan qochib bo‘lmaydi
载体|носитель; средство передачи|tashuvchi; uzatish vositasi
再现|воссоздать; вновь проявиться|qayta yaratmoq; yana namoyon bo‘lmoq
在职|работать; быть при должности|ishlayotgan; lavozimida bo‘lgan
暂||vaqtincha; hozircha
赞不绝口|без конца хвалить; восхищаться|tinimsiz maqtamoq; qoyil qolmoq
赞许|одобрять; похвалить|ma’qullamoq; maqtamoq
葬||ko‘mmoq; dafn qilmoq
葬礼|похороны; погребальная церемония|dafn marosimi
糟粕|отбросы; ненужная часть|chiqindi; keraksiz qism
凿||iskana; o‘ymoq
枣||unabi mevasi; xitoy xurmosi
早年|в прежние годы; много лет назад|avvalgi yillarda; ancha oldin
早日|поскорее; в ближайшее время|tez orada; iloji boricha tez
灶|плита; очаг|o‘choq; plita
造福|приносить пользу; служить благу|foyda keltirmoq; manfaatiga xizmat qilmoq
造价|стоимость строительства|qurilish qiymati
造假|подделывать; фальсифицировать|qalbakilashtirmoq; soxtalashtirmoq
造就|сформировать; воспитать; создать|shakllantirmoq; tarbiyalamoq
增收|увеличить доходы|daromadni oshirmoq
增速|темпы роста; ускорить темпы|o‘sish sur’ati; tezligini oshirmoq
扎根|пустить корни; укорениться|ildiz otmoq
闸||shlyuz; to‘g‘on; suv qopqog‘i
眨眼|моргать; моргнуть|ko‘zini yummoq; kiprik qoqmoq
榨||siqmoq; sharbatini yoki yog‘ini chiqarmoq
债务|долг; задолженность|qarz; qarzdorlik
沾||namlamoq; tegib ketmoq
占卜|гадать; предсказывать|fol ochmoq; bashorat qilmoq
斩||boshini kesmoq; qatl etmoq
盏||chiroq uchun hisob so‘zi
辗转|ворочаться; переходить из рук в руки|u yoqdan bu yoqqa ag‘darilmoq; qo‘ldan qo‘lga o‘tmoq
蘸||botirib olmoq
绽放|расцвести; распуститься|gullamoq; ochilmoq
站立|стоять; находиться стоя|tik turmoq
占用|занимать; использовать|egallamoq; foydalanmoq
张灯结彩|украсить фонарями и гирляндами|chiroq va bezaklar bilan bezamoq
张贴|вывешивать; расклеивать|e’lonni osmoq; yopishtirmoq
张扬|броский; показной|ko‘z-ko‘z qiladigan; dabdabali
掌舵|стоять у руля; управлять судном|rulda turmoq; kemani boshqarmoq
涨幅|величина роста; прирост|o‘sish miqdori; o‘sish foizi
掌管|руководить; заведовать|boshqarmoq; mas’ul bo‘lmoq
长相|внешность; наружность|tashqi ko‘rinish
胀||shishmoq; kengaymoq
招揽|привлекать клиентов; набирать заказы|mijozlarni jalb qilmoq; buyurtmalarni yig‘moq
招募|набирать; вербовать|ishga jalb qilmoq; yollamoq
招牌|вывеска; фирменная марка|peshlavha; mashhur mahsulot
朝三暮四|непостоянный; менять решения|beqaror; fikrini tez-tez o‘zgartiradigan
招商|привлекать инвестиции|investorlarni jalb qilmoq
招数|приём; ход; уловка|usul; hiyla; harakat
朝夕相处|постоянно быть вместе; общаться каждый день|kecha-yu kunduz birga bo‘lmoq
罩||qoplamoq; yopmoq
照办|выполнить указание; поступить согласно распоряжению|ko‘rsatmaga amal qilmoq; bajarish
召集|созывать; собирать|yig‘moq; chaqirmoq
照例|как обычно; по заведённому порядку|odatdagidek; qoida bo‘yicha
照射|освещать; облучать|yoritmoq; nurlantirmoq
肇事|стать виновником происшествия; устроить инцидент|hodisaga sabab bo‘lmoq; janjal chiqarmoq
兆头|предзнаменование; примета|alomat; nishona
遮||to‘smoq; berkitmoq; pana qilmoq
遮盖|прикрывать; скрывать|yopmoq; yashirmoq
折叠|складывать; сгибать|buklamoq; taxlamoq
折合|пересчитывать; переводить в эквивалент|aylantirib hisoblamoq; tenglashtirmoq
哲理|философская идея; мудрость|falsafiy g‘oya; hikmat
折射||nurni sindirmoq; bilvosita aks ettirmoq
珍藏|бережно хранить; ценное собрание|avaylab saqlamoq; qimmatli to‘plam
侦查|проводить расследование; разыскивать|surishtirmoq; tergov qilmoq
针锋相对|резко противостоять; отвечать ударом на удар|keskin qarama-qarshi turmoq; zarbaga zarba bilan javob bermoq
针灸|иглоукалывание и прижигание|igna bilan davolash va kuydirish
真空|вакуум; пустота|vakuum; bo‘shliq
真情|искренние чувства; истинное положение|samimiy tuyg‘ular; haqiqiy vaziyat
珍视|дорожить; высоко ценить|qadrlamoq; yuksak baholamoq
真心|искренне; от всего сердца|chin dildan; samimiylik
珍重|дорожить; ценить|avaylab asramoq; qadrlamoq
枕|подушка; положить голову|yostiq; boshini qo‘ymoq
诊所|клиника; кабинет врача|klinika; shifokor qabulxonasi
震||silkinmoq; tebranmoq
震荡|колебаться; сотрясаться; испытывать потрясение|tebranmoq; silkinmoq; o‘zgarib turmoq
震动|трясти; сотрясать|silkitmoq; tebratmoq
阵营|лагерь; фракция|lager; guruh
振作|собраться; воспрянуть духом|o‘zini qo‘lga olmoq; ruhlanmoq
征||yurishga chiqmoq; hujum qilmoq; undirmoq
蒸||bug‘lanmoq; bug‘da pishirmoq
争辩|спорить; доказывать|bahslashmoq; tortishmoq
争分夺秒|дорожить каждой минутой; спешить|har bir soniyani qadrlamoq; vaqt bilan bellashmoq
争光|прославить; принести честь|sharaf keltirmoq; nomini ulug‘lamoq
征集|собирать; объявить сбор|yig‘moq; to‘plamoq
症结|суть проблемы; корень проблемы|muammoning ildizi; asosiy muammo
争相|наперебой; стремиться быть первым|talashib; hammadan oldin intilmoq
争执|спор; конфликт|bahs; tortishuv
整合||birlashtirmoq; uyg‘unlashtirmoq
整洁|опрятный; аккуратный|ozoda; saranjom
拯救|спасать; выручать|qutqarmoq; najot bermoq
整数|целое число|butun son
正能量|позитивная энергия; положительный настрой|ijobiy energiya; ko‘tarinki ruh
证券|ценные бумаги; акции и облигации|qimmatli qog‘ozlar; aksiya va obligatsiyalar
证人|свидетель|guvoh
正视|смотреть в лицо; прямо взглянуть|yuzma-yuz qaramoq; tan olmoq
正直|честный; прямой|halol; to‘g‘riso‘z
知己|близкий друг; родственная душа|yaqin do‘st; sirdosh
支架|подставка; опора; подпорка|tirgak; tayanch; taglik
芝麻|кунжут|kunjut
知识分子|интеллигент; интеллектуал|ziyoli; intellektual
肢体|конечности; тело|tana a’zolari; qo‘l-oyoqlar
知足|довольствоваться имеющимся|boriga qanoat qilmoq; shukr qilmoq
职称|профессиональное звание; должность|kasbiy unvon; lavozim
直达|прямой; без пересадок; достигать напрямую|to‘g‘ridan-to‘g‘ri yetib borish; bekatlarsiz
执法|обеспечивать соблюдение закона; применять закон|qonunni ijro etmoq; qonun bajarilishini ta’minlamoq
直观|наглядный; непосредственно воспринимаемый|ko‘rgazmali; bevosita seziladigan
直觉|интуиция|sezgi; ichki tuyg‘u
值钱|ценный; дорогой|qimmatli; qimmat
直视|смотреть прямо; пристально смотреть|tik qaramoq; yuziga qaramoq
直辖市|город центрального подчинения|markaziy hukumatga bo‘ysunuvchi shahar
执意|упорно настаивать; твёрдо намереваться|qat’iy turib olmoq; niyatidan qaytmaslik
直至|вплоть до; до самого|qadar; gacha
纸币|бумажные деньги; банкнота|qog‘oz pul; banknota
止步|остановиться; прекратить движение|to‘xtamoq; yurishni to‘xtatmoq
指点|указать; подсказать|ko‘rsatmoq; maslahat bermoq
指教|дать совет; наставить|maslahat bermoq; yo‘l ko‘rsatmoq
指控|обвинять; предъявить обвинение|ayblamoq; ayblov qo‘ymoq
指南|руководство; путеводитель|qo‘llanma; sayohat yo‘riqnomasi
纸上谈兵|рассуждать о войне на бумаге; пустое теоретизирование|quruq nazariya; amalda sinamasdan gapirish
指手画脚|размахивать руками; командовать другими|qo‘lini o‘ynatmoq; boshqalarga buyruq bermoq
指纹|отпечаток пальца|barmoq izi
指向|указывать на; направлять; направление|ishora qilmoq; yo‘naltirmoq; yo‘nalish
指引|направлять; вести|yo‘l ko‘rsatmoq; yetaklamoq
旨在|иметь целью; предназначаться для|maqsad qilmoq; uchun mo‘ljallangan
致||yetkazmoq; sabab bo‘lmoq
置||joylashtirmoq; sotib olmoq
至此|к этому моменту; до сих пор|shu paytgacha; shu yerga kelib
质地|текстура; фактура|tuzilish; faktura
致富|разбогатеть; обогатиться|boyimoq; boyib ketmoq
滞后|отставать; запаздывать|ortda qolmoq; kechikmoq
致敬|приветствовать; отдавать честь|salom bermoq; hurmat bajo keltirmoq
致命|смертельный; роковой|halokatli; o‘limga olib keladigan
稚嫩|юный и нежный; незрелый|yosh va nozik; tajribasiz
质朴|простой; естественный; незатейливый|sodda; tabiiy; kamtarona
质问|расспрашивать; требовать объяснений|so‘roq qilmoq; izoh talab qilmoq
窒息|задыхаться; удушье|bo‘g‘ilmoq; nafas qisishi
志向|стремление; цель|intilish; maqsad
治愈|вылечить; исцелить|davolamoq; tuzatmoq
终端|терминал; конечный пункт|terminal; oxirgi nuqta
终极|конечный; предельный|yakuniy; eng yuqori
终结|завершиться; прекратить|tugamoq; yakunlamoq
终生|всю жизнь; пожизненный|bir umr; umrbod
中途|на полпути; в середине пути|yo‘lning yarmida; o‘rtasida
中性|нейтральный; средний род|betaraf; neytral
中叶|середина эпохи; середина века|davr o‘rtasi; asr o‘rtalari
中庸|золотая середина; умеренность|mo‘tadillik; oltin o‘rtalik
忠于|быть верным; хранить верность|sodiq bo‘lmoq; vafodor bo‘lmoq
忠贞|преданный; верный|sadoqatli; vafodor
中止|приостановить; прекратить|to‘xtatib turmoq; bekor qilmoq
仲裁|арбитраж; урегулировать спор|arbitraj; nizoni hal qilmoq
重创|нанести тяжёлый урон; сильно повредить|og‘ir zarar yetkazmoq; qattiq shikastlamoq
重量级|тяжеловес; важный; влиятельный|og‘ir vazn toifasi; muhim; nufuzli
重任|ответственная задача; тяжёлая обязанность|mas’uliyatli vazifa; og‘ir majburiyat
重型|тяжёлый; крупногабаритный|og‘ir; katta hajmli
重用|назначить на важный пост; доверять|muhim lavozimga tayinlamoq; ishonch bildirmoq
众志成城|единство воли создаёт неприступную крепость|hamjihatlik mustahkam qal’a yaratadi
重中之重|самое важное; первостепенная задача|eng muhim; birinchi darajali masala
周岁|полный год; возраст в полных годах|to‘liq bir yil; to‘lgan yosh
周旋|взаимодействовать; лавировать; противостоять|muomala qilmoq; yo‘l topmoq; kurashmoq
皱||burishmoq; ajin tushmoq
骤然|внезапно; резко|to‘satdan; birdan
朱红|ярко-красный; киноварь|qizil; kinovar
诸如此类|и тому подобное; такого рода вещи|va shunga o‘xshash; shu kabi narsalar
竹竿|бамбуковый шест|bambuk tayoq
逐一|по очереди; один за другим|birma-bir; ketma-ket
主编|главный редактор|bosh muharrir
主打|делать основным; специализироваться|asosiy mahsulot qilib tanlamoq; ixtisoslashmoq
主力|основная сила; главный состав|asosiy kuch; bosh tarkib
主人公|главный герой|bosh qahramon
主题曲|заглавная песня; главная музыкальная тема|asosiy qo‘shiq; bosh musiqiy mavzu
嘱托|поручить; доверить|topshiriq bermoq; ishonib topshirmoq
主页|главная страница|bosh sahifa
主宰|господствовать; управлять|hukmronlik qilmoq; boshqarmoq
注||diqqatni jamlamoq; quymoq; kiritmoq
筑||qurmoq; bunyod etmoq
贮藏|запасать; хранить|zaxiralamoq; saqlamoq
著称|прославиться как; быть известным как|sifatida tanilmoq; nom chiqarmoq
住处|жильё; место проживания|turar joy; yashash joyi
注定|суждено; обречён|taqdirga bitilgan; mahkum
住户|жильцы; домохозяйство|xonadon; yashovchilar
助力|помогать; содействовать|yordam bermoq; ko‘maklashmoq
助威|подбадривать; болеть за|qo‘llab-quvvatlamoq; muxlislik qilmoq
注销|аннулировать; снять с учёта|bekor qilmoq; ro‘yxatdan chiqarmoq
蛀牙|кариес; разрушенный зуб|tish chirishi; kariyes
驻足|остановиться; задержаться|to‘xtamoq; bir zumga turib qolmoq
爪子|лапа; когти|panja; changal
专柜|специализированная стойка; фирменный отдел|maxsus savdo rastasi; firma bo‘limi
专栏|специальная рубрика; колонка|maxsus rukn; ustun
专卖|продавать исключительно; монополизировать продажу|faqat sotmoq; savdoni monopoliyalashtirmoq
专人|специально назначенное лицо|maxsus tayinlangan xodim
专项|специальный проект; целевое направление|maxsus loyiha; maqsadli yo‘nalish
专职|штатная должность; работа на полную ставку|shtatdagi lavozim; to‘liq stavkali ish
专制|автократический; деспотичный; самодержавие|avtokratik; mustabid; yakka hokimlik
专著|монография|monografiya
转播|ретранслировать; ретрансляция|qayta uzatmoq; retranslyatsiya
转型|преобразоваться; перейти к новой модели|o‘zgarib yangi shaklga o‘tmoq
转眼|в мгновение ока|ko‘z ochib yumguncha
转载|перепечатать; разместить повторно|qayta nashr etmoq; qayta joylamoq
转折点|поворотный момент|burilish nuqtasi
撰写|писать; составлять текст|yozmoq; matn tuzmoq
转悠|бродить; слоняться|aylanib yurmoq; kezmoq
桩||qoziq; ustun; ishlar uchun hisob so‘zi
装扮|украшать; наряжаться|bezamoq; kiyinib olmoq
庄园|поместье; усадьба|qo‘rg‘on; katta yer-mulk
壮||baquvvat; qudratli; mustahkam
壮大|укреплять; расширять; увеличиваться|kuchaytirmoq; kengaytirmoq; ulg‘aymoq
撞击|ударять; сталкиваться|urmoq; to‘qnashmoq
状元|лучший выпускник императорского экзамена; первый в списке|imperatorlik imtihonida eng yuqori o‘rin olgan; yetakchi
追赶|догонять; гнаться|quvib yetmoq; ortidan yugurmoq
追捧|восторженно поддерживать; боготворить|haddan tashqari olqishlamoq; muxlislik qilmoq
追溯|проследить до; восходить к|ildizini aniqlamoq; kelib chiqishiga nazar solmoq
追随|следовать; идти за|ergashmoq; izidan bormoq
追尾|столкнуться сзади; ехать слишком близко|orqadan urib yubormoq; juda yaqin yurmoq
追问|допытываться; настойчиво расспрашивать|qayta-qayta so‘ramoq; surishtirmoq
追逐|преследовать; гнаться за|quvmoq; ortidan yugurmoq
追踪|отслеживать; выслеживать|kuzatmoq; izidan yurmoq
坠落|упасть; рухнуть|qulamoq; tushib ketmoq
准许|разрешить; позволить|ruxsat bermoq; ijozat bermoq
拙劣|неумелый; неуклюжий; плохой|no‘noq; beso‘naqay; sifatsiz
捉迷藏|играть в прятки|bekinmachoq o‘ynamoq
着力|приложить усилия; сосредоточиться на|kuch sarflamoq; e’tiborni qaratmoq
着落|местонахождение; куда направить или пристроить|qayerdaligi; qayerga joylashtirish
酌情|с учётом обстоятельств; по своему усмотрению|vaziyatni hisobga olib; o‘z ixtiyoriga ko‘ra
灼热|палящий; обжигающе горячий|jazirama; kuydiradigan issiq
着实|действительно; весьма|rostdan ham; juda
着眼|сосредоточиться на; исходить из|e’tiborni qaratmoq; nuqtai nazardan qaramoq
茁壮|здоровый и крепкий; мощно расти|sog‘lom va baquvvat; yaxshi o‘smoq
兹||ushbu; hozir
资本主义|капитализм; капиталистический строй|kapitalizm; kapitalistik tuzum
资历|стаж; квалификация; опыт|ish staji; malaka; tajriba
资讯|информация; сведения|ma’lumot; axborot
资质|квалификация; документы, подтверждающие право|malaka; ruxsat hujjatlari
籽|семя; зерно|urug‘; don
子弟|дети; молодое поколение|farzandlar; yosh avlod
子孙|потомки; потомство|avlodlar; zurriyot
自称|называть себя; именоваться|o‘zini ... deb atamoq; nomlanmoq
自费|за свой счёт; самофинансирование|o‘z hisobidan; o‘zini o‘zi moliyalashtirish
自负|брать на себя ответственность; быть уверенным в себе|mas’uliyatni o‘z zimmasiga olmoq; o‘ziga ishongan
自负|самонадеянный; высокомерный|o‘ziga bino qo‘ygan; manman
字迹|почерк|yozuv; husnixat
自立|быть самостоятельным; обеспечивать себя|mustaqil bo‘lmoq; o‘zini ta’minlamoq
自理|заботиться о себе; самообслуживание|o‘ziga qaramoq; o‘z-o‘ziga xizmat qilish
自强不息|неустанно совершенствоваться; стремиться к лучшему|tinmay o‘zini rivojlantirmoq; kamolotga intilmoq
自然而然|естественно; само собой|tabiiy ravishda; o‘z-o‘zidan
自然界|природа; естественный мир|tabiat; tabiiy dunyo
自如|свободно; непринуждённо|bemalol; erkin
自始至终|от начала до конца|boshidan oxirigacha
自首|сдаться властям; явиться с повинной|o‘z ixtiyori bilan taslim bo‘lmoq; aybini tan olmoq
字体|шрифт; начертание|shrift; yozuv shakli
自卫|самооборона; защищаться|o‘zini himoya qilish; mudofaa
自相矛盾|противоречить самому себе|o‘ziga o‘zi zid bo‘lmoq
自行|самостоятельно; по собственной инициативе|mustaqil ravishda; o‘z xohishi bilan
字眼|формулировка; слово|ifoda; so‘z
自以为是|считать себя всегда правым; самоуверенный|o‘zini doim haq deb bilmoq; o‘zboshimcha
自责|винить себя|o‘zini ayblamoq
自治区|автономный район|muxtor hudud
自尊|самоуважение; достоинство|o‘zini hurmat qilish; qadr-qimmat
宗||holatlar va bitimlar uchun hisob so‘zi
综艺|эстрада; развлекательные программы|estrada; ko‘ngilochar dasturlar
总额|общая сумма; итоговая стоимость|umumiy summa; jami qiymat
纵观|всесторонне обозреть; рассмотреть в целом|keng ko‘lamda ko‘rib chiqmoq
纵然||garchi; shunday bo‘lsa-da
纵容|потворствовать; закрывать глаза; баловать|yo‘l qo‘ymoq; ko‘z yumib turmoq; erkalatmoq
纵深|глубина; глубинное пространство|chuqurlik; ichki masofa
走过场|формально отбыть; сделать для галочки|shunchaki rasmiyatchilik uchun qilmoq
走弯路|идти окольным путём; тратить время на неверный способ|aylanma yo‘ldan yurmoq; noto‘g‘ri usul bilan vaqt yo‘qotmoq
走势|тенденция; динамика|tendensiya; rivojlanish yo‘nalishi
走投无路|быть в безвыходном положении|chorasiz qolmoq; chiqish yo‘lini topolmaslik
走向|направление; курс|yo‘nalish; rivojlanish yo‘li
奏效|дать результат; сработать|samara bermoq; natija ko‘rsatmoq
足不出户|не выходить из дома|uydan chiqmaslik
足迹|следы; отпечатки ног|izlar; oyoq izi
足智多谋|находчивый; изобретательный|topqir; tadbirkor
祖传|переданный предками; наследственный|ajdodlardan qolgan; meros
祖籍|родные места предков|ajdodlarning vatani; kelib chiqish joyi
组建|создать; сформировать|tuzmoq; tashkil etmoq
阻力|сопротивление; препятствие|qarshilik; to‘siq
组装|собирать; монтировать|yig‘moq; montaj qilmoq
祖宗|предки; прародители|ajdodlar; ota-bobolar
钻空子|воспользоваться лазейкой|bo‘shliqdan foydalanmoq; qoidani aylanib o‘tmoq
罪魁祸首|главный виновник; зачинщик; основная причина бедствия|asosiy aybdor; bosh tashabbuskor; falokatning sababi
尊贵|почитаемый; уважаемый|aziz; hurmatli
遵照|следовать; согласно указанию|rioya qilmoq; ko‘rsatmaga muvofiq
左顾右盼|оглядываться по сторонам|atrofga alanglamoq; chap-o‘ngga qaramoq
作对|противостоять; мешать|qarshi chiqmoq; xalaqit bermoq
作客|гостить; быть в гостях|mehmon bo‘lmoq; mehmon bo‘lib turmoq
作料|приправа; специи|ziravor; ta’m beruvchi qo‘shimcha
坐落|располагаться; находиться|joylashmoq; o‘rin olmoq
座谈|проводить беседу; неформальная дискуссия|davra suhbati o‘tkazmoq; norasmiy muhokama
作物|сельскохозяйственная культура; урожай|ekin; qishloq xo‘jaligi mahsuloti
做证|свидетельствовать; дать показания|guvohlik bermoq; ko‘rsatma bermoq
无边无际|бескрайний; безграничный|cheksiz; bepoyon
无不|все без исключения; каждый|istisnosiz hamma; har bir kishi
无敌|непобедимый; не имеющий соперников|yengilmas; raqibi yo‘q
无故|без причины; беспричинно|sababsiz; bekorga
无关紧要|неважный; не имеющий значения|muhim emas; ahamiyatsiz
无话可说|нечего сказать; не найти слов|aytadigan gapi yo‘q; so‘z topolmaslik
无家可归|бездомный; не имеющий куда пойти|uysiz; borar joyi yo‘q
无价之宝|бесценное сокровище|bebaho xazina
无济于事|не помочь; оказаться бесполезным|foyda bermaslik; befoyda bo‘lib chiqmoq
无可厚非|не стоит слишком сурово осуждать; это объяснимо|qattiq qoralashga asos yo‘q; tushunsa bo‘ladi
无力|бессильный; не имеющий сил|kuchsiz; ojiz
无理|неразумный; несправедливый|mantiqsiz; adolatsiz
无论如何|в любом случае; несмотря ни на что|har qanday holatda; nima bo‘lsa ham
无能|неспособный; некомпетентный|qobiliyatsiz; layoqatsiz
无情|бессердечный; безжалостный|bag‘ritosh; shafqatsiz
无穷|бесконечный; неисчерпаемый|cheksiz; tuganmas
无私|бескорыстный; самоотверженный|xolis; fidoyi
无所事事|не иметь занятий; бездельничать|qiladigan ishi bo‘lmaslik; bekor yurmoq
无所作为|ничего не добиваться; не проявлять инициативы|hech narsaga erishmaslik; tashabbus ko‘rsatmaslik
无条件|безусловный; без оговорок|shartsiz; hech qanday shartlarsiz
无线|беспроводной; радиосвязь|simsiz; radioaloqa
无形|невидимый; неосязаемый; незаметно|ko‘rinmas; nomoddiy; sezilmasdan
无须|не нужно; нет необходимости|kerak emas; zarurati yo‘q
无意|не иметь намерения; невольно|niyat qilmagan; beixtiyor
无缘|не иметь возможности; не быть связанным|imkoniyati bo‘lmaslik; aloqasi bo‘lmaslik
捂|накрыть рукой; заглушить|qo‘li bilan yopmoq; ovozini bo‘g‘moq
五官|пять органов чувств в традиционной китайской медицине|an’anaviy xitoy tabobatidagi besh sezgi a’zosi
五花八门|самый разнообразный; всевозможный|juda xilma-xil; turli-tuman
五湖四海|все уголки страны; повсюду|mamlakatning barcha hududlari; hamma joy
武力|военная сила; вооружённая мощь|harbiy kuch; qurolli qudrat
误导|ввести в заблуждение; дезинформировать|chalg‘itmoq; noto‘g‘ri ma’lumot bermoq
务工|работать наёмным рабочим; трудиться|yollanma ishchi bo‘lib ishlamoq; mehnat qilmoq
物力|материальные ресурсы|moddiy resurslar
物流|логистика; грузоперевозки|logistika; yuk tashish
误区|заблуждение; ошибочное представление|yanglish tushuncha; xato qarash
物色|подбирать; искать подходящего человека/предмет|tanlab izlamoq; munosib odam/buyumni qidirmoq
物证|вещественное доказательство|ashyoviy dalil
物种|вид; биологический вид|tur; biologik tur
稀|редкий; разреженный|siyrak; kam
稀罕|редкий; драгоценный|noyob; qadrli
熄火|погаснуть; заглохнуть|o‘chmoq; motor to‘xtab qolmoq
犀利|острый; проницательный|o‘tkir; ziyrak
奚落|насмехаться; язвительно высмеивать|mazax qilmoq; achchiq kinoya bilan kulmoq
吸纳|принимать; привлекать; поглощать|qabul qilmoq; jalb qilmoq; singdirmoq
稀奇|необычный; редкостный|g‘ayrioddiy; noyob
稀少|редкий; малочисленный|kam; oz sonli
嬉笑|играть и смеяться; хихикать|o‘ynab-kulmoq; qiqirlab kulmoq
熙熙攘攘|оживлённый; многолюдный и шумный|gavjum; shovqinli va odamga to‘la
息息相关|тесно связанный; неразрывно связанный|chambarchas bog‘liq; uzviy bog‘langan
稀有|редкий; необычный|noyob; kamyob
锡纸|фольга; оловянная фольга|folga; qalay folgasi
席|место; банкет; счётное слово для банкетов|o‘rin; ziyofat; ziyofatlar uchun hisob so‘zi
席位|место; кресло|o‘rin; joy
喜出望外|неожиданно обрадоваться; быть вне себя от радости|kutilmaganda xursand bo‘lmoq; quvonchdan o‘zini yo‘qotmoq
洗涤|стирать; промывать|yuvmoq; chaymoq
喜好|предпочтение; любить что-либо|yoqtirish; afzal ko‘rish
喜酒|свадебный пир; свадебное угощение|to‘y ziyofati; to‘y taomi
洗礼|крещение; посвящение; испытание|cho‘qintirish; sinov; yangi tajriba
喜怒哀乐|радость, гнев, печаль и счастье; эмоции|quvonch, g‘azab, qayg‘u va baxt; his-tuyg‘ular
喜庆|праздничный; радостное событие|bayramona; quvonchli voqea
喜糖|свадебные сладости для гостей|to‘yda mehmonlarga ulashiladigan shirinlik
喜洋洋|сияющий от радости; очень радостный|quvonchdan porlab turgan; juda xursand
细腻|тонкий и изящный; утончённый; тщательный|nozik va nafis; didli; puxta
细微|крошечный; едва заметный|juda kichik; zo‘rg‘a seziladigan
虾|креветка|krevetka
万能|универсальный; всемогущий|universal; hamma narsaga qodir
万万|ни в коем случае; совершенно|hech qachon; mutlaqo
万无一失|безошибочный; гарантированный|xatosiz; kafolatlangan
汪洋|бескрайний; безбрежный (о воде)|cheksiz; bepoyon (suv haqida)
王朝|династия|sulola
王国|королевство; царство|qirollik; saltanat
王牌|козырь; сильная сторона|kozir; kuchli jihat
亡羊补牢|исправить ошибку с опозданием; лучше поздно, чем никогда|xatoni kech bo‘lsa ham tuzatmoq; hechdan ko‘ra kech yaxshi
网点|филиал; торговая точка|filial; savdo shoxobchasi
网民|пользователь интернета; интернет-пользователь|internet foydalanuvchisi
往日|прошлые дни; былые времена|o‘tgan kunlar; avvalgi davr
旺|процветающий; благополучный|gullab-yashnagan; farovon
旺季|пик сезона; оживлённый сезон|mavsum avji; gavjum mavsum
旺盛|бурный; энергичный; процветающий|jo‘shqin; g‘ayratli; gullab-yashnagan
望远镜|телескоп; бинокль|teleskop; durbin
微|слегка; чуть-чуть|biroz; salgina
危及|подвергать опасности; угрожать|xavf ostiga qo‘ymoq; tahdid qilmoq
危急|критический; опасный|tang; xavfli
微妙|тонкий; деликатный; едва заметный|nozik; murakkab; zo‘rg‘a seziladigan
微弱|слабый; едва заметный|kuchsiz; zo‘rg‘a seziladigan
威慑|сдерживать угрозой; устрашать|qo‘rqitib tiyib turmoq; tahdid bilan to‘xtatmoq
微生物|микроорганизм|mikroorganizm
微微|слегка; чуть-чуть; едва заметный|biroz; sal; zo‘rg‘a seziladigan
微型|миниатюрный; небольшого размера|mitti; kichik o‘lchamli
唯|только; единственный|faqat; yagona
围观|собраться вокруг и смотреть|atrofga yig‘ilib tomosha qilmoq
围墙|ограда; периметральная стена|devor; tashqi devor
维权|защищать свои права|o‘z huquqlarini himoya qilmoq
为人|вести себя; человеческие качества|o‘zini tutmoq; insoniy fazilatlar
唯有|только; лишь|faqat; xolos
违约|нарушить договор; не выполнить обязательства|shartnomani buzmoq; majburiyatni bajarmaslik
违章|нарушать правила; действовать не по регламенту|qoidani buzmoq; tartibga rioya qilmaslik
纬度|широта|geografik kenglik
尾气|выхлопные газы|chiqindi gazlar
尾声|эпилог; заключительная часть|yakuniy qism; so‘nggi sahna
萎缩|увядать; сокращаться|so‘lmoq; qisqarmoq
委婉|тактичный; деликатный|muloyim; nozik
委员会|комитет; комиссия|qo‘mita; komissiya
伪装|маскироваться; притворяться; маскировка|niqoblanmoq; o‘zini ... qilib ko‘rsatmoq; niqob
味精|глутамат натрия|natriy glutamati; ta’m kuchaytirgich
慰劳|поблагодарить за усилия; утешить|mehnati uchun tashakkur bildirmoq; tasalli bermoq
卫视|спутниковое телевидение|sun’iy yo‘ldosh televideniyesi
畏缩|струсить; съёжиться от страха|qo‘rqib ortga chekinmoq; cho‘chimoq
喂养|кормить; выкармливать|boqmoq; oziqlantirmoq
未知数|неизвестная величина; неопределённость|noma’lum miqdor; noaniqlik
位子|место; сиденье|joy; o‘rindiq
温差|перепад температуры|harorat farqi
温度计|термометр|termometr
温泉|горячий источник|issiq buloq
温室|теплица; оранжерея|issiqxona; oranjereya
温习|повторять; освежать знания|takrorlamoq; bilimni yangilamoq
温馨|тёплый и уютный|iliq va shinam
瘟疫|чума; эпидемия|o‘lat; epidemiya
文|письмо; письменность; текст|yozuv; yozma shakl; matn
文盲|неграмотный; неграмотность|savodsiz; savodsizlik
文人|учёный; литератор; человек литературы|olim; adib; adabiyot vakili
蚊帐|противомоскитная сетка|chivin to‘ri
蚊子|комар|chivin
稳固|прочный; устойчивый|mustahkam; barqaror
吻合|точно совпадать; соответствовать|aniq mos kelmoq; muvofiq tushmoq
稳健|стабильный; надёжный; рассудительный|barqaror; ishonchli; bosiq
紊乱|беспорядочный; хаотичный|tartibsiz; chalkash
稳妥|надёжный; благоразумный|ishonchli; oqilona
稳重|сдержанный; серьёзный; надёжный|bosiq; jiddiy; ishonchli
卧|лежать; лечь|yotmoq; yotib olmoq
污秽|грязный; нечистый|iflos; nopok
屋檐|карниз крыши; свес крыши|tomning qirrasi; tom soyaboni
呜咽|всхлипывать; рыдать|hiqillab yig‘lamoq; ko‘z yosh to‘kmoq
头头是道|говорить ясно и логично; всё изложить по порядку|aniq va mantiqiy gapirmoq; tartib bilan bayon qilmoq
头衔|звание; титул; должность|unvon; titul; lavozim
透彻|глубокий; исчерпывающий; проникновенный|chuqur; batafsil; teran
透气|проветривать; дышать свежим воздухом|shamollatmoq; toza havodan nafas olmoq
透支|превысить кредитный лимит; перерасходовать|kredit limitidan oshirmoq; ortiqcha sarflamoq
凸|выпуклый; выступающий|qavariq; bo‘rtib chiqqan
突击|внезапная атака; срочно выполнить|to‘satdan hujum; shoshilinch bajarmoq
突破口|брешь; прорыв; отправная точка|teshik; yorib o‘tish joyi; boshlang‘ich nuqta
突如其来|внезапный; неожиданный|to‘satdan yuz bergan; kutilmagan
突兀|резкий; внезапный; высокий и выступающий|keskin; to‘satdan; baland va bo‘rtib chiqqan
凸显|выделяться; становиться заметным; подчёркивать|ko‘zga tashlanmoq; yaqqol bo‘lmoq; ta’kidlamoq
涂|наносить; покрывать краской|surmoq; bo‘yoq bilan qoplamoq
徒步|пешком; пеший|piyoda; piyoda yurish
徒劳|напрасный; тщетно трудиться|befoyda; behuda mehnat qilmoq
屠杀|резня; массово убивать|qirg‘in; ommaviy o‘ldirmoq
图形|фигура; диаграмма; график|shakl; diagramma; grafik
图纸|чертёж; проектный план|chizma; loyiha rejasi
吐槽|ворчать; язвительно шутить|nolimoq; kinoya bilan hazillashmoq
土生土长|родиться и вырасти на месте|shu yerda tug‘ilib o‘smoq
团伙|банда; преступная группа|to‘da; jinoiy guruh
团聚|воссоединиться; собраться вместе|qayta birlashmoq; jam bo‘lmoq
团员|участник; член группы|guruh a’zosi; jamoa a’zosi
推崇|высоко ценить; почитать|yuksak qadrlamoq; e’zozlamoq
推断|делать вывод; заключать|xulosa chiqarmoq; taxmin qilmoq
推敲|тщательно взвешивать слова; обдумывать|so‘zlarni sinchiklab tanlamoq; puxta o‘ylamoq
推算|рассчитывать; вычислять|hisoblamoq; hisoblab chiqmoq
推卸|уклоняться от ответственности; перекладывать вину|mas’uliyatdan qochmoq; aybni boshqalarga yuklamoq
推选|избрать; выдвинуть кандидатуру|saylamoq; nomzod ko‘rsatmoq
推移|проходить (о времени); развиваться|o‘tmoq (vaqt); rivojlanmoq
颓废|упадочный; подавленный|tushkun; tanazzulga yuz tutgan
退化|деградировать; вырождаться|tanazzulga uchramoq; yomonlashmoq
退回|вернуть; отослать обратно|qaytarmoq; orqaga yubormoq
退却|отступить; отойти назад|chekinmoq; orqaga qaytmoq
退让|уступить; отойти в сторону|yon bermoq; chetga chiqmoq
退缩|отступать; пасовать|ortga chekinmoq; qo‘rqib qolmoq
退役|уйти в отставку; завершить службу|xizmatdan bo‘shamoq; faoliyatini yakunlamoq
臀|ягодицы|dumba
托付|поручить; доверить|topshirmoq; ishonib topshirmoq
脱节|разъединиться; оторваться; потерять связь|uzilib qolmoq; aloqani yo‘qotmoq
脱口而出|вырваться (о словах); выпалить|og‘zidan chiqib ketmoq; beixtiyor aytib yubormoq
拖累|обременять; тянуть назад|og‘irlik qilmoq; ortga tortmoq
脱落|отпасть; выпасть|tushib ketmoq; uzilib tushmoq
拖欠|задолжать; просрочить платеж|qarzdor bo‘lib qolmoq; to‘lovni kechiktirmoq
脱身|освободиться; вырваться|qutulib chiqmoq; xalos bo‘lmoq
脱颖而出|выделиться; превзойти остальных|boshqalardan ajralib chiqmoq; ustun bo‘lmoq
驮|нести на спине; везти вьюком|orqasida ko‘tarmoq; yuk qilib ortmoq
妥|подходящий; уместный|mos; o‘rinli
拓宽|расширить; расширять|kengaytirmoq; kengaymoq
唾液|слюна|so‘lak
拓展|расширять; развивать|kengaytirmoq; rivojlantirmoq
挖苦|язвительно говорить; высмеивать|kinoya qilmoq; mazax qilmoq
瓦|черепица; кровельная плитка|cherepitsa; tom yopish plitkasi
外号|прозвище|laqab
外籍|иностранное гражданство; иностранный|chet el fuqaroligi; xorijiy
外贸|внешняя торговля|tashqi savdo
外貌|внешность; наружность|tashqi ko‘rinish; qiyofa
外星人|инопланетянин|o‘zga sayyoralik
外援|иностранная помощь; внешняя поддержка|xorijiy yordam; tashqi ko‘mak
外在|внешний; наружный|tashqi; ko‘rinadigan
完好|целый; неповреждённый|butun; shikastlanmagan
玩耍|играть; развлекаться|o‘ynamoq; hordiq chiqarmoq
丸子|шарик; мясная фрикаделька|dumaloq shakl; go‘shtli frikadelka
挽|тянуть; оттянуть|tortmoq; qayirmoq
晚年|поздние годы жизни; старость|umrining so‘nggi yillari; keksalik
晚期|поздний период; терминальная стадия|kechki davr; so‘nggi bosqich
晚霞|закатное зарево; вечерние облака|shom shu’lasi; kechki bulutlar
体制|система; организационное устройство; структура|tizim; tashkiliy tuzilma; tuzilish
体质|телосложение; физическое состояние|jismoniy tuzilish; salomatlik holati
剃|брить; сбривать|soqol olmoq; qirib tashlamoq
替补|заменить; запасной игрок|o‘rnini bosmoq; zaxira o‘yinchi
替换|заменить; поменять|almashtirmoq; o‘rnini bosmoq
天长地久|вечный; длиться, как небо и земля|mangu; osmon va yer kabi davomli
天敌|естественный враг; хищник|tabiiy dushman; yirtqich
天地|небо и земля; мир|osmon va yer; olam
天鹅|лебедь|oqqush
天分|природный талант; дарование|tug‘ma iste’dod; qobiliyat
添加剂|добавка; присадка|qo‘shimcha modda; qo‘shimcha
天经地义|совершенно правильный; само собой разумеющийся|mutlaqo to‘g‘ri; o‘z-o‘zidan ayon
天平|весы|tarozi
天桥|надземный пешеходный переход|yerusti piyodalar ko‘prigi
天使|ангел|farishta
天线|антенна|antenna
天性|природа; врождённый характер|tabiat; tug‘ma fe’l
填补|восполнить пробел; заполнить нехватку|bo‘shliqni to‘ldirmoq; yetishmovchilikni qoplamoq
填充|заполнить; наполнить|to‘ldirmoq; to‘ldirib qo‘ymoq
田间|в поле; полевой|dalada; dala
甜美|сладкий; приятный|shirin; yoqimli
甜蜜|сладкий; счастливый и нежный|shirin; baxtli va mehrli
田园|поля и сады; сельская местность; пастораль|dala va bog‘lar; qishloq joyi; pastoral manzara
调侃|поддразнивать; насмехаться|hazillashib tegajog‘lik qilmoq; mazax qilmoq
调控|регулировать и контролировать|tartibga solmoq va nazorat qilmoq
条例|положение; правило; постановление|nizom; qoida; qaror
调试|отлаживать; тестировать|sozlab tekshirmoq; sinovdan o‘tkazmoq
跳槽|сменить работу; перейти на другое место|ishini o‘zgartirmoq; boshqa ishga o‘tmoq
跳动|пульсировать; биться|urib turmoq; dukillamoq
跳伞|прыгать с парашютом|parashyut bilan sakramoq
眺望|смотреть вдаль с высоты|baland joydan uzoqqa qaramoq
贴切|точный; подходящий|aniq; mos
帖子|открытка; приглашение; интернет-публикация|otkritka; taklifnoma; internetdagi post
听从|слушаться; подчиняться; прислушаться|quloq solmoq; bo‘ysunmoq; maslahatga amal qilmoq
停放|припарковать; оставить на стоянке|park qilmoq; to‘xtash joyida qoldirmoq
停业|закрыть предприятие; приостановить работу|faoliyatni to‘xtatmoq; ishni vaqtincha yopmoq
通畅|свободный; беспрепятственный|ravon; to‘siqsiz
通车|открыть движение; открыть дорогу для транспорта|transport harakatini ochmoq; yo‘lni qatnovga ochmoq
通告|объявить; официальное уведомление|e’lon qilmoq; rasmiy bildirishnoma
通顺|гладкий; связный (о тексте/речи)|ravon; mantiqan bog‘langan (matn/nutq)
通通|все; целиком|hammasi; butunlay
通宵|всю ночь; всю ночь напролёт|tun bo‘yi; butun tun
同比|сравнивать с тем же периодом прошлого года|o‘tgan yilning shu davri bilan taqqoslamoq
同步|синхронизировать; одновременно|sinxronlashtirmoq; bir vaqtda
同等|равный; наравне с|teng; bilan barobar
同感|такое же чувство; разделять чьи-либо чувства|bir xil tuyg‘u; hislariga sherik bo‘lmoq
同伙|сообщник; партнёр по преступлению|sherik; jinoyatdagi hamtovog‘i
同盟|союз; альянс|ittifoq; alyans
同仁|коллега; сослуживец|hamkasb; birga ishlaydigan kishi
同舟共济|держаться вместе в трудные времена|qiyin paytda bir-birini qo‘llab turmoq
捅|тыкать; проткнуть|tiqmoq; teshib yubormoq
筒|трубка; цилиндр|nay; silindr
统筹|планировать в целом; координировать|umumiy rejalashtirmoq; muvofiqlashtirmoq
痛心|огорчённый; глубоко переживать|qattiq xafa; yurakdan qayg‘urmoq
偷窥|подглядывать; тайком наблюдать|poylab qaramoq; yashirincha kuzatmoq
偷懒|бездельничать; лениться|dangasalamoq; ishyoqmaslik qilmoq
投奔|искать убежища у; обратиться за приютом|...dan panoh izlamoq; boshpana so‘rab bormoq
投放|вложить; запустить; выпустить на рынок|joylashtirmoq; ishga tushirmoq; bozorga chiqarmoq
投稿|отправить статью для публикации|maqolani nashr uchun yubormoq
头号|номер один; первоклассный|birinchi raqamli; eng yuqori
投射|бросать; проецировать|uloqtirmoq; proyeksiya qilmoq
投身|посвятить себя; активно включиться|o‘zini bag‘ishlamoq; faol kirishmoq
头条|главная новость; заголовок первой полосы|asosiy yangilik; birinchi sahifa sarlavhasi
算盘|счёты|cho‘t
算账|свести счёты; рассчитаться; поквитаться|hisob-kitob qilmoq; o‘ch olmoq
虽说|хотя; пусть и|garchi; ... bo‘lsa-da
随处可见|встречаться повсюду|har yerda uchramoq
随机|случайный; в зависимости от обстоятельств|tasodifiy; vaziyatga qarab
随时随地|в любое время и в любом месте|istalgan vaqtda va istalgan joyda
随心所欲|делать всё, что душе угодно|ko‘ngli tusaganini qilmoq
损人利己|добиваться выгоды за счёт других|boshqalarga zarar yetkazib, o‘ziga foyda keltirmoq
缩|сокращаться; отступать|qisqarmoq; chekinmoq
缩减|сократить; уменьшить|qisqartirmoq; kamaytirmoq
缩水|сжиматься; уменьшаться в объёме|kichraymoq; hajmi kamaymoq
缩影|микрокосм; краткое отражение|mikrokosm; qisqa aks
锁定|заблокировать; зафиксировать|qulflamoq; belgilab qo‘ymoq
所属|принадлежность; относиться к|tegishlilik; ...ga qarashli
琐碎|мелкий; незначительный; пустяковый|mayda; arzimas; ahamiyatsiz
所作所为|поступки и поведение; действия|xatti-harakatlari; qilgan ishlari
胎|счётное слово для родов и помётов; плод|tug‘ruq va hayvon bolalari uchun hisob so‘zi; homila
胎儿|неродившийся ребёнок; плод|tug‘ilmagan bola; homila
太极|Великий Предел; высший принцип китайской философии|Oliy Qutb; Xitoy falsafasidagi oliy tamoyil
太平|мирный; спокойный; без тревог|tinch; osoyishta; tashvishsiz
态势|ситуация; положение; обстановка|vaziyat; holat; ahvol
贪|жадничать; алчный; жадный до чего-либо|ochko‘zlik qilmoq; ochko‘z; ...ga o‘ch
瘫|парализованный; быть парализованным|falaj; falaj bo‘lmoq
贪吃|обжора; любящий поесть|ochko‘z; ovqatni yaxshi ko‘radigan
坛|алтарь; помост; круг/сообщество (в сфере)|mehrob; supa; (sohadagi) davra
痰|мокрота; харкота|balg‘am
谈及|упоминать; говорить о|tilga olmoq; haqida gapirmoq
坦诚|откровенный; искренний|ochiqko‘ngil; samimiy
坦克|танк|tank
坦然|спокойный; невозмутимый|xotirjam; bezovta bo‘lmagan
坦言|сказать откровенно|ochiq aytmoq; rostini aytmoq
毯子|одеяло; плед|adyol; pled
炭|древесный уголь|yog‘och ko‘miri
探|исследовать; изучать|o‘rganmoq; tekshirmoq
探究|исследовать; глубоко изучать|tadqiq qilmoq; chuqur o‘rganmoq
探亲|навестить семью; поехать домой к родным|oilasini yo‘qlamoq; uyiga yaqinlarini ko‘rgani bormoq
探求|искать; стремиться найти|izlamoq; topishga intilmoq
探险|исследовать; отправиться в экспедицию|tadqiq qilmoq; ekspeditsiyaga chiqmoq
堂|зал; счётное слово для учебных занятий|zal; dars mashg‘ulotlari uchun hisob so‘zi
糖尿病|сахарный диабет|qandli diabet
淌|капать; стекать|tomchilamoq; oqib tushmoq
掏腰包|заплатить из собственного кармана|o‘z cho‘ntagidan to‘lamoq
淘|промывать; мыть|chaymoq; yuvmoq
逃生|спасаться бегством; спасать свою жизнь|jon saqlab qochmoq; hayotini qutqarib qolmoq
逃亡|бежать; скрываться бегством|qochib ketmoq; qochib yashirinmoq
陶冶|воспитывать; формировать характер|tarbiyalamoq; xarakterini shakllantirmoq
讨|просить; выпрашивать|so‘ramoq; tilanmoq
特此|настоящим; этим письмом (офиц.)|ushbu orqali; mazkur xat bilan (rasmiy)
特例|особый случай; исключение|alohida holat; istisno
特权|привилегия; особое право|imtiyoz; alohida huquq
特邀|специально пригласить; особое приглашение|maxsus taklif qilmoq; maxsus taklif
特制|специально изготовленный; особого изготовления|maxsus tayyorlangan; alohida ishlab chiqarilgan
特质|характерная черта; особое качество|o‘ziga xos xususiyat; alohida fazilat
腾|освободить место; расчистить|joy bo‘shatmoq; bo‘shatib qo‘ymoq
藤蔓|лиана; вьющаяся лоза|chirmashib o‘sadigan tok; liana
剔除|исключить; удалить|chiqarib tashlamoq; rad etmoq
梯子|лестница|narvon
提及|упомянуть|tilga olmoq
提名|выдвинуть кандидатуру; номинировать|nomzod qilib ko‘rsatmoq; nominatsiya qilmoq
提速|ускорить; увеличить скорость|tezlashtirmoq; tezlikni oshirmoq
提心吊胆|быть в тревоге; сильно бояться|xavotirda bo‘lmoq; qattiq qo‘rqmoq
体能|физическая подготовка; выносливость; сила|jismoniy tayyorgarlik; chidamlilik; kuch
体魄|телосложение; крепкое тело|jismoniy tuzilish; baquvvat tana
体态|фигура; осанка|qomat; tana tuzilishi
拴|привязывать; связывать|bog‘lamoq; arqon bilan bog‘lamoq
霜|иней; морозный налёт|qirov; muz qatlami
双边|двусторонний; между двумя сторонами|ikki tomonlama; ikki taraf o‘rtasida
双重|двойной; двоякий|ikki karra; ikki xil
双向|двусторонний; двунаправленный|ikki tomonlama; ikki yo‘nalishli
双赢|выигрыш для обеих сторон; взаимная выгода|har ikki tomon uchun manfaatli; o‘zaro foyda
水产|водная продукция; рыбная продукция|suv va dengiz mahsulotlari; baliq mahsulotlari
水滴石穿|постоянное усилие преодолевает любые трудности|tinimsiz harakat har qanday qiyinchilikni yengadi
水晶|хрусталь; кристалл|billur; kristall
水落石出|правда раскрылась; всё стало ясно|haqiqat yuzaga chiqdi; hammasi oydinlashdi
水汽|водяной пар|suv bug‘i
水土|вода и почва; местные природные условия|suv va tuproq; mahalliy tabiiy sharoit
水域|воды; водная территория|suv havzasi; suv hududi
水源|источник воды; водный источник|suv manbai; suv keladigan manba
水涨船高|расти вместе с общей тенденцией|umumiy tendensiya bilan birga ko‘tarilmoq
水准|уровень; стандарт|daraja; me’yor
睡袋|спальный мешок|uyqu qopi
税收|налогообложение; сбор налогов|soliqqa tortish; soliq yig‘imi
税务|налоговое дело; налоговая служба|soliq ishlari; soliq xizmati
顺差|положительное сальдо; торговый профицит|ijobiy saldo; savdo profitsiti
顺畅|гладкий; беспрепятственный|ravon; to‘siqsiz
顺从|подчиняться; повиноваться|bo‘ysunmoq; itoat qilmoq
顺理成章|логичный; закономерный|mantiqiy; qonuniy ravishda kelib chiqadigan
顺路|по пути; заодно|yo‘l-yo‘lakay; yo‘li tushganda
顺其自然|пустить всё на самотёк; пусть идёт своим чередом|tabiiy holiga qo‘ymoq; o‘z yo‘liga qo‘yib bermoq
顺势|действуя по инерции; пользуясь моментом|oqimga qarab ish tutmoq; vaziyatdan foydalanmoq
顺手|попутно; легко и удобно|yo‘l-yo‘lakay; oson va qulay
顺心|довольный; по душе|ko‘ngli to‘q; ko‘ngliga yoqadigan
顺延|перенести на более поздний срок|keyinroqqa surmoq; muddatini uzaytirmoq
顺应|соответствовать; приспосабливаться|moslashmoq; muvofiq kelmoq
说不上|не суметь сказать; не заслуживающий упоминания|ayta olmaslik; tilga olishga arzimas
说谎|лгать; говорить неправду|yolg‘on gapirmoq
说情|просить за кого-либо; ходатайствовать|birov uchun iltimos qilmoq; shafoat qilmoq
硕果|крупное достижение; весомый результат|katta yutuq; salmoqli natija
丝|шёлк; шёлковая нить|ipak; ipak ip
私家车|личный автомобиль|shaxsiy avtomobil
司空见惯|обычное явление; никого не удивляет|odatdagi hol; hech kimni ajablantirmaydi
私立|частный; негосударственный|xususiy; nodavlat
思前想后|тщательно всё обдумать|hammasini yaxshilab o‘ylab ko‘rmoq
私事|личные дела|shaxsiy ishlar
私下|в частном порядке; наедине|xususiy ravishda; yakkama-yakka
私营|частный; находящийся в частной собственности|xususiy; shaxsiy mulkdagi
私有|частная собственность; частный|xususiy mulk; xususiy
死心|потерять надежду; отказаться от мысли|umidini uzmoq; fikridan qaytmoq
似曾相识|казаться знакомым; чувство дежавю|tanishdek tuyulmoq; deja vu hissi
四方|во все стороны; повсюду|har tomonga; hamma joyda
伺机|ждать удобного случая|qulay fursatni kutmoq
饲料|корм для животных|hayvonlar yemi
四面八方|со всех сторон; отовсюду|har tomondan; har yoqdan
似是而非|кажется верным, но на деле неверно|to‘g‘ridek ko‘rinadi, ammo aslida noto‘g‘ri
四通八达|доступный со всех сторон; разветвлённый|har tomondan borish mumkin; tarmoqlangan
松弛|расслабленный; ослабить|bo‘shashgan; bo‘shashtirmoq
松懈|ослабить усилия; расслабиться; небрежный|susaytirmoq; bo‘shashmoq; e’tiborsiz
耸立|возвышаться; выситься|qad ko‘tarmoq; baland turmoq
怂恿|подстрекать; подбивать|ig‘vo qilmoq; gij-gijlamoq
送别|проводить; попрощаться перед отъездом|kuzatib qo‘ymoq; yo‘l oldidan xayrlashmoq
搜查|обыскать; провести поиск|qidirib tekshirmoq; tintuv o‘tkazmoq
搜救|поисково-спасательные работы|qidiruv-qutqaruv ishlari
搜寻|искать; разыскивать|qidirmoq; izlamoq
酥|рассыпчатый; слоёный|uvada bo‘ladigan; qat-qat
俗|вульгарный; пошлый|qo‘pol; bachkana
俗称|обычно называться; просторечное название|odatda shunday atalmoq; xalq orasidagi nom
俗语|пословица; народное выражение|maqol; xalqona ibora
素|простой; вегетарианский; элемент|oddiy; go‘shtsiz; unsur
素不相识|быть совершенно незнакомыми|mutlaqo notanish bo‘lmoq
素材|исходный материал; материал для творчества|dastlabki material; ijod uchun manba
诉苦|жаловаться; изливать свои обиды|shikoyat qilmoq; dardini to‘kmoq
诉求|требование; добиваться чего-либо|talab; biror narsani talab qilmoq
诉说|рассказывать; поведать|so‘zlab bermoq; bayon qilmoq
素养|культура; образованность; личные качества|madaniy saviya; bilimlilik; shaxsiy fazilatlar
诉诸|обращаться к; прибегнуть к|murojaat qilmoq; ...ga tayanmoq
蒜|чеснок|sarimsoq
算计|рассчитывать; строить козни|hisoblamoq; hiyla rejalashtirmoq
士气|боевой дух; моральный настрой|jangovar ruh; ma’naviy kayfiyat
世人|люди; весь свет|odamlar; butun xalq
适时|своевременный; подходящий по времени|o‘z vaqtida; paytiga mos
试探|прощупывать; осторожно выяснять|sinab ko‘rmoq; ehtiyotkorlik bilan aniqlamoq
势头|импульс; тенденция; развитие|sur’at; tendensiya; rivojlanish yo‘nalishi
事务所|агентство; бюро; контора|idora; byuro; xizmat ko‘rsatish idorasi
试行|опробовать; ввести в пробном порядке|sinab ko‘rmoq; tajriba tariqasida joriy qilmoq
事宜|дела; вопросы; соответствующие меры|ishlar; masalalar; tegishli choralar
市值|рыночная капитализация|bozor kapitallashuvi
柿子|хурма|xurmo
收复|отвоевать; вернуть (территорию)|qaytarib olmoq; (hududni) qayta egallamoq
收割|собирать урожай; жать|hosilni yig‘ib olmoq; o‘rmoq
收敛|сдерживаться; ограничивать; сходиться|o‘zini tiyish; cheklamoq; yaqinlashmoq
收留|приютить; предоставить убежище|boshpana bermoq; panohiga olmoq
收买|подкупить; купить на свою сторону|pora bermoq; o‘z tomoniga og‘dirmoq
收视率|рейтинг просмотров; телевизионный рейтинг|tomosha reytingi; televideniye reytingi
收支|доходы и расходы|daromad va xarajatlar
手册|справочник; руководство|qo‘llanma; ma’lumotnoma
首创|впервые создать; положить начало|birinchi bo‘lib yaratmoq; asos solmoq
手动|ручной; вручную|qo‘lda boshqariladigan; qo‘lda
首付|первоначальный взнос|boshlang‘ich to‘lov
首府|столица автономного района|avtonom hudud markazi
守候|ждать; дежурить в ожидании|kutmoq; poylab turmoq
手脚|руки и ноги; движения; уловка|qo‘l-oyoq; harakatlar; makr
手帕|носовой платок|ro‘molcha
首批|первая партия; первая группа|birinchi partiya; ilk guruh
手枪|пистолет|to‘pponcha
手头|под рукой; личные финансы|qo‘l ostida; shaxsiy mablag‘
手腕|запястье; ловкость; умение|bilak; uddaburonlik; mahorat
守信|держать слово; быть надёжным|va’dasida turmoq; ishonchli bo‘lmoq
手掌|ладонь|kaft
守株待兔|пассивно ждать удачи; надеяться на случай|omadni kutib bekor o‘tirmoq; tasodifga umid bog‘lamoq
受宠若惊|быть ошеломлённым оказанной честью|ko‘rsatilgan e’tibordan hayratda qolmoq
受挫|потерпеть неудачу; столкнуться с препятствием|muvaffaqiyatsizlikka uchramoq; to‘siqqa duch kelmoq
受害|пострадать; стать жертвой|zarar ko‘rmoq; jabrlanuvchiga aylanmoq
受害人|потерпевший; жертва|jabrlanuvchi; qurbon
受贿|получить взятку; брать взятки|pora olmoq; pora olgan bo‘lmoq
受惊|испугаться; быть напуганным|cho‘chib ketmoq; qo‘rqib ketmoq
受苦|страдать; терпеть лишения|azob chekmoq; qiyinchilikka chidamoq
受理|принять к рассмотрению; обработать заявление|ko‘rib chiqish uchun qabul qilmoq; arizani ko‘rib chiqmoq
受骗|быть обманутым|aldanmoq
授权|уполномочить; предоставить полномочия|vakolat bermoq; huquq bermoq
受益|получить пользу; извлечь выгоду|foyda ko‘rmoq; naf olmoq
受益匪浅|извлечь большую пользу|katta foyda olmoq
梳|расчёсывать; расчёска|taramoq; taroq
疏导|расчищать; направлять поток; помогать справиться|tozalab ochmoq; oqimni yo‘naltirmoq; yengishga ko‘maklashmoq
梳理|расчёсывать; приводить в порядок|taramoq; tartibga keltirmoq
枢纽|узел; транспортный узел|markaz; transport uzeli
抒情|выражать чувства; лирический|hislarni ifodalamoq; lirik
疏散|эвакуировать; рассредоточить|evakuatsiya qilmoq; tarqatib joylashtirmoq
疏通|прочистить; разблокировать|ochib tozalamoq; to‘siqni olib tashlamoq
输血|переливание крови|qon quyish
输液|капельница; внутривенное вливание|tomchilatib dori yuborish; vena orqali suyuqlik quyish
舒展|развернуть; потянуться; расправиться|yoymoq; cho‘zilmoq; yozilmoq
赎|выкупить; искупить|qaytarib sotib olmoq; gunohini yuvmoq
曙光|первые лучи рассвета; заря|tongning ilk nurlari; subhidam
属相|животное китайского зодиака по году рождения|tug‘ilgan yiliga ko‘ra muchal hayvoni
属性|свойство; атрибут|xususiyat; atribut
数一数二|быть среди лучших; один из первых|eng yaxshilar qatorida bo‘lmoq; eng oldingilardan
树干|ствол дерева|daraxt tanasi
数据库|база данных|ma’lumotlar bazasi
竖立|установить вертикально; воздвигнуть|tik o‘rnatmoq; qad ko‘tartirmoq
树梢|верхушка дерева|daraxt uchi
束手无策|быть беспомощным перед кризисом|inqiroz qarshisida chorasiz qolmoq
树荫|тень дерева|daraxt soyasi
刷新|обновить; побить рекорд|yangilamoq; rekordni yangilamoq
耍赖|вести себя бесстыдно; увиливать|uyatsizlarcha ish tutmoq; qochib qutulmoq
衰减|ослабевать; затухать|susaymoq; pasaymoq
摔跤|споткнуться и упасть; борьба|qoqilib yiqilmoq; kurash
衰竭|отказать (об органе); истощиться|ishdan chiqmoq (a’zo); holdan toyish
衰落|приходить в упадок; ухудшаться|tanazzulga yuz tutmoq; yomonlashmoq
衰弱|слабый; ослабеть|zaif; kuchsizlanmoq
审视|внимательно рассмотреть; изучить|sinchiklab ko‘rib chiqmoq; tekshirmoq
肾|почка|buyrak
渗|просачиваться; сочиться|sizib o‘tmoq; sizib chiqmoq
生产线|производственная линия; сборочный конвейер|ishlab chiqarish liniyasi; yig‘uv konveyeri
声称|утверждать; заявлять|da’vo qilmoq; bayon qilmoq
升华|сублимироваться; возвыситься|sublimatsiyalanmoq; yuksalmoq
生命线|линия жизни; жизненно важная опора|hayot chizig‘i; hayotiy tayanch
生怕|бояться; опасаться|qo‘rqmoq; xavotir olmoq
生平|жизнь; биография|hayoti; tarjimai holi
生前|при жизни (об умершем)|hayotligida (marhum haqida)
生死|жизнь и смерть; вопрос жизни и смерти|hayot va mamot; hayot-mamot masalasi
声望|репутация; престиж|obro‘; nufuz
生涯|карьера; жизненный путь|faoliyat yo‘li; hayot yo‘li
生硬|жёсткий; неловкий; неестественный|qattiq; noqulay; tabiiy bo‘lmagan
省事|упростить дело; избавить от хлопот|ishni osonlashtirmoq; ovora qilmaslik
胜出|выйти победителем; оказаться лучшим|g‘olib bo‘lib chiqmoq; eng yaxshi bo‘lmoq
盛大|торжественный; грандиозный|tantanali; ulkan
盛会|торжественное собрание; грандиозное мероприятие|tantanali yig‘in; katta tadbir
盛气凌人|высокомерный и властный; подавлять других|kekkaygan va zo‘ravon; boshqalarga bosim o‘tkazadigan
胜任|справиться с задачей; быть компетентным|vazifani uddalamoq; layoqatli bo‘lmoq
盛夏|середина лета; разгар лета|yoz o‘rtasi; yoz avj pallasi
圣贤|мудрец; святой мудрец|donishmand; avliyo
盛宴|пир; роскошный банкет|ziyofat; dabdabali bazm
失传|быть утраченным; выйти из употребления|yo‘qolib ketmoq; unutilmoq
湿地|водно-болотные угодья|botqoqli hudud; nam yer
施工|вести строительные работы|qurilish ishlarini olib bormoq
失控|выйти из-под контроля|nazoratdan chiqmoq
失利|потерпеть поражение; проиграть|mag‘lub bo‘lmoq; yutqazmoq
失礼|вести себя невежливо; невежливость|odobsizlik qilmoq; odobsizlik
失灵|сломаться; перестать работать|buzilmoq; ishlamay qolmoq
失落|чувствовать потерю; разочароваться; потерять|yo‘qotish hissini tuyish; hafsalasi pir bo‘lmoq; yo‘qotmoq
失明|ослепнуть; потерять зрение|ko‘r bo‘lib qolmoq; ko‘rish qobiliyatini yo‘qotmoq
失态|потерять самообладание; забыть о приличиях|o‘zini tuta olmay qolmoq; odobni unutmoq
失效|утратить силу; стать недействительным; истечь|kuchini yo‘qotmoq; amal qilmay qolmoq; muddati tugamoq
施行|осуществлять; применять на практике|amalga oshirmoq; amalda qo‘llamoq
施压|оказывать давление|bosim o‘tkazmoq
师长|учитель; командир дивизии|ustoz; diviziya qo‘mondoni
师资|квалифицированный преподавательский состав|malakali o‘qituvchilar tarkibi
时隔|после перерыва; спустя некоторое время|oradan vaqt o‘tgach; tanaffusdan so‘ng
实地|на месте; непосредственно на местности|joyida; bevosita hududda
时段|временной интервал; период времени|vaqt oralig‘i; vaqt davri
时好时坏|то хорошо, то плохо|ba’zan yaxshi, ba’zan yomon
实话实说|говорить правду; сказать как есть|haqiqatni aytmoq; boricha gapirmoq
时空|время и пространство|vaqt va makon
实况|прямая трансляция; реальные события|jonli efir; haqiqiy voqealar
食宿|питание и проживание|ovqat va turar joy
实体|сущность; материальный объект|mohiyat; moddiy obyekt
实物|материальный предмет; реальная вещь|moddiy buyum; haqiqiy narsa
屎|фекалии; кал|najas; axlat
使唤|командовать кем-либо; помыкать|buyruq bermoq; o‘z xizmatida ishlatmoq
史无前例|беспрецедентный в истории|tarixda misli ko‘rilmagan
使者|посланник; представитель|elchi; vakil
势不可当|неудержимый; его невозможно остановить|to‘xtatib bo‘lmaydigan; yengib bo‘lmas
视察|инспектировать; осматривать|tekshirmoq; ko‘zdan kechirmoq
市场经济|рыночная экономика|bozor iqtisodiyoti
世故|опытный и практичный; умудрённый жизнью|tajribali va amaliyotchi; hayot ko‘rgan
嗜好|увлечение; пристрастие|qiziqish; moyillik
侍候|служить; ухаживать|xizmat qilmoq; parvarish qilmoq
世间|мир; этот свет|dunyo; bu olam
视角|перспектива; точка зрения; угол обзора|nuqtai nazar; qarash burchagi; ko‘rish burchagi
适量|умеренное количество; подходящая доза|me’yoriy miqdor; mos doza
筛查|проверять; проводить скрининг|saralab tekshirmoq; skriningdan o‘tkazmoq
山川|горы и реки|tog‘lar va daryolar
煽动|подстрекать; разжигать|ig‘vo qilmoq; gij-gijlamoq
山岭|горный хребет; гряда|tog‘ tizmasi; qir
山寨|подделка; контрафакт; горная крепость|qalbaki mahsulot; soxta nusxa; tog‘ qal’asi
善|добрый; хороший|yaxshi; ezgu
膳食|питание; рацион|ovqatlanish; taomnoma
赡养|содержать; обеспечивать пожилых родителей|boqmoq; keksa ota-onasini ta’minlamoq
善意|добрая воля; доброжелательность|xayrixohlik; yaxshi niyat
伤残|получить инвалидность; быть искалеченным|nogiron bo‘lib qolmoq; mayib bo‘lmoq
商贩|торговец; продавец|savdogar; sotuvchi
伤感|грустный; сентиментальный|g‘amgin; ta’sirchan
商贾|купец; торговец|savdogar; tijoratchi
伤痕|шрам; след раны|chandiq; yara izi
商机|деловая возможность; шанс для бизнеса|biznes imkoniyati; tijorat fursati
伤势|состояние травмы; тяжесть ранения|jarohat holati; jarohatning og‘irligi
商讨|обсуждать; вести переговоры|muhokama qilmoq; maslahatlashmoq
商议|обсуждать; договариваться|muhokama qilmoq; kelishib olmoq
商用|коммерческий; для бизнеса|tijoriy; biznes uchun
赏识|ценить; признавать чьи-либо способности|qadrlamoq; qobiliyatini tan olmoq
尚|ещё; всё ещё|hali; hanuz
上半场|первая половина матча или соревнования|o‘yin yoki musobaqaning birinchi yarmi
上报|доложить начальству; сообщить наверх|rahbariyatga xabar bermoq; yuqoriga bildirmoq
上层|верхний слой; верхушка|yuqori qatlam; tepa qism
上场|выйти на сцену; выйти на поле|sahnaga chiqmoq; maydonga tushmoq
上岗|приступить к работе; заступить на пост|ishga kirishmoq; lavozimga kirishmoq
上火|разозлиться; вспылить|jahli chiqmoq; achchiqlanmoq
上空|небо над чем-либо; воздушное пространство|ustidagi osmon; havo hududi
上司|начальник; руководитель|boshliq; rahbar
上诉|подать апелляцию; обжаловать|apellyatsiya bermoq; shikoyat qilmoq
上调|повысить; поднять уровень|ko‘tarmoq; oshirmoq
尚未|ещё не; пока не|hali ... emas; hozircha yo‘q
上限|верхний предел; потолок|yuqori chegara; eng ko‘p miqdor
上行|идти вверх/против течения; подать по инстанции|yuqoriga ko‘tarilmoq/oqimga qarshi yurmoq; yuqori idoraga yubormoq
上映|показывать фильм; выходить на экран|film namoyish qilmoq; ekranga chiqmoq
稍后|чуть позже; немного спустя|birozdan so‘ng; keyinroq
烧毁|сжечь; уничтожить огнём|yoqib yubormoq; olovda yo‘q qilmoq
稍稍|немного; слегка|biroz; sal
少不了|не обойтись без; необходимый|busiz bo‘lmaydi; zarur
少女|девушка; молодая женщина|qiz; yosh ayol
奢望|несбыточная надежда; чрезмерное желание|amalga oshishi qiyin umid; ortiqcha istak
设|установить; создать|o‘rnatmoq; tashkil qilmoq
设定|установить; задать; настройка|belgilamoq; sozlamoq; sozlama
设法|попытаться; найти способ|urinib ko‘rmoq; yo‘lini topmoq
社会主义|социализм|sotsializm
社交|общение; социальные контакты|muloqot; ijtimoiy aloqalar
涉猎|поверхностно изучать; бегло просматривать книги|qisman o‘rganmoq; kitoblarni ko‘zdan kechirmoq
社团|общество; клуб; объединение|jamiyat; klub; uyushma
涉嫌|подозреваться; быть подозреваемым в|gumon ostida bo‘lmoq; ...da gumon qilinmoq
申办|подать заявку на проведение; ходатайствовать|o‘tkazish uchun ariza bermoq; murojaat qilmoq
身不由己|не иметь возможности поступить по своей воле|o‘z xohishiga ko‘ra ish tuta olmaslik
身价|стоимость; ценность; общественное положение|qiymat; qadr; ijtimoiy mavqe
申领|подать заявление на получение|olish uchun ariza bermoq
深切|глубоко прочувствованный; искренний|chuqur his qilingan; samimiy
深情|глубокое чувство; сильная любовь|chuqur tuyg‘u; kuchli muhabbat
身躯|тело; туловище|tana; gavda
深入人心|глубоко укорениться в сердцах людей|odamlar qalbiga chuqur singmoq
伸手|протянуть руку; потянуться рукой|qo‘l uzatmoq; qo‘l cho‘zmoq
深思|глубоко обдумывать; размышлять|chuqur o‘ylamoq; mushohada qilmoq
申诉|подать жалобу; обжаловать|shikoyat qilmoq; arz bermoq
深邃|глубокий; бездонный|chuqur; tubsiz
伸缩|выдвигаться и втягиваться; гибкий|cho‘zilib-qisqarmoq; moslashuvchan
身影|силуэт; фигура|siluet; qomat
深造|продолжить образование; углублённо учиться|ta’limni davom ettirmoq; chuqur o‘rganmoq
伸张|отстаивать; защищать (справедливость/право)|adolatni qaror toptirmoq; huquqni himoya qilmoq
身子|тело; туловище|tana; gavda
审|проверять; рассматривать; допрашивать|tekshirmoq; ko‘rib chiqmoq; so‘roq qilmoq
审定|рассмотреть и утвердить; окончательно одобрить|ko‘rib chiqib tasdiqlamoq; yakuniy ma’qullamoq
审核|проверить; провести аудит|tekshirmoq; auditdan o‘tkazmoq
审计|аудировать; аудит|audit qilmoq; audit
审批|рассмотреть и утвердить|ko‘rib chiqib tasdiqlamoq
热衷|увлекаться; страстно интересоваться|berilib ketmoq; juda qiziqmoq
人次|число посещений/участий; единица учёта посетителей|tashriflar/ishtiroklar soni; odam qatnovi hisobi
人品|характер; нравственные качества|xarakter; axloqiy fazilatlar
人气|популярность; известность|mashhurlik; ommaboplik
人情|человеческие чувства; услуга; отношения между людьми|insoniy hislar; iltifot; odamlar o‘rtasidagi munosabat
人身|человек; личность; тело человека|inson; shaxs; inson tanasi
人手|рабочая сила; персонал|ishchi kuchi; xodimlar
人文|гуманитарные науки; гуманитарная культура|gumanitar fanlar; insoniyat madaniyati
人选|кандидат; подходящий человек|nomzod; munosib kishi
人缘儿|популярность; хорошие отношения с людьми|odamlar orasida obro‘; yaxshi munosabatlar
人造|искусственный; созданный человеком|sun’iy; inson tomonidan yaratilgan
忍心|иметь сердце сделать что-либо; решиться (на жестокий поступок)|ko‘ngli bo‘lib qilmoq; (shafqatsiz ishga) jur’at etmoq
任期|срок полномочий; срок пребывания в должности|vakolat muddati; lavozimda ishlash muddati
韧性|прочность; упругость; стойкость|chidamlilik; egiluvchanlik; matonat
认证|аутентифицировать; сертификация|tasdiqlamoq; sertifikatlash
任职|занимать должность; работать на посту|lavozimni egallamoq; lavozimda ishlamoq
日复一日|день за днём; изо дня в день|kun sayin; kundan-kunga
日趋|день ото дня; постепенно становиться|kun sayin; asta-sekin ... bo‘lib bormoq
融|таять; плавиться; смешиваться|erimoq; suyuqlanmoq; qo‘shilmoq
容光焕发|сияющий здоровьем; полный сил|sog‘ligi yuzidan bilinib turadigan; tetik
荣获|быть удостоенным; получить почётную награду|taqdirlanmoq; faxriy mukofot olmoq
容许|разрешить; допустить|ruxsat bermoq; yo‘l qo‘ymoq
容颜|лицо; цвет лица; внешность|yuz; yuz rangi; tashqi ko‘rinish
荣耀|слава; почёт|shon-sharaf; izzat
融资|финансирование; привлечение средств|moliyalashtirish; mablag‘ jalb qilish
冗长|длинный и утомительный; многословный|uzun va zerikarli; sergap
如痴如醉|быть очарованным; быть словно в упоении|maftun bo‘lmoq; zavqdan o‘zini yo‘qotmoq
如期|в срок; согласно расписанию|o‘z vaqtida; jadvalga muvofiq
如实|как есть; правдиво|boricha; rostini aytib
如意|как хочется; к чьему-либо удовлетворению|ko‘ngildagidek; xohlaganidek
如愿以偿|добиться исполнения желания|orzuiga yetmoq; istagini amalga oshirmoq
入场|войти на площадку; вход|maydonga kirmoq; kirish
入场券|входной билет|kirish chiptasi
入侵|вторгнуться; вторжение|bostirib kirmoq; bosqin
入手|начать с; приступить к|...dan boshlamoq; kirishmoq
软弱|слабый; безвольный|zaif; irodasiz
软实力|мягкая сила|yumshoq kuch
瑞雪|своевременный снег; снег к добру|o‘z vaqtida yog‘gan qor; barakali qor
润|влажный; увлажнять|nam; namlamoq
弱势|слабое положение; уязвимая группа|zaif mavqe; himoyaga muhtoj guruh
弱项|слабая сторона; слабая область|zaif jihat; sust soha
赛车|участвовать в автогонках; гоночный автомобиль|avtopoygada qatnashmoq; poyga mashinasi
赛季|спортивный сезон|sport mavsumi
赛跑|соревноваться в беге; беговая гонка|yugurish musobaqasi; poyga yugurishi
三番五次|много раз; снова и снова|ko‘p marta; qayta-qayta
三维|трёхмерный; 3D|uch o‘lchamli; 3D
散落|рассыпаться; падать вразброс|sochilib ketmoq; tarqoq tushmoq
桑拿|сауна|sauna
丧生|погибнуть; лишиться жизни|halok bo‘lmoq; jon bermoq
骚乱|беспорядки; устроить волнения|tartibsizlik; g‘alayon ko‘tarmoq
扫除|убирать; вычищать; устранять|tozalamoq; supurmoq; bartaraf qilmoq
扫墓|ухаживать за могилой; посещать кладбище|qabrni ziyorat qilmoq; qabrni tozalamoq
扫兴|испортить настроение; разочаровать|kayfiyatni buzmoq; hafsalani pir qilmoq
扫帚|метла; веник|supurgi
僧人|буддийский монах|buddaviy rohib
纱|пряжа; марля; муслин|ip; doka; muslin mato
杀害|убить; совершить убийство|o‘ldirmoq; qotillik qilmoq
沙龙|салон; творческая встреча|salon; ijodiy uchrashuv
杀手|убийца; киллер|qotil; yollanma qotil
傻瓜|дурак; глупец|ahmoq; esi past
筛|сито; просеивать|elak; elamoq
倾家荡产|разориться; потерять всё семейное состояние|butun oilaviy boyligini yo‘qotmoq; xonavayron bo‘lmoq
清静|тихий; спокойный|sokin; osoyishta
青睐|благоволить; проявлять интерес|ma’qul ko‘rmoq; qiziqish bildirmoq
清凉|прохладный; свежий|salqin; yoqimli
轻蔑|презрительный; презирать|nafrat bilan qarash; mensimaslik
倾诉|излить душу; доверительно рассказать|dardini to‘kib solmoq; dildan gapirmoq
青铜器|бронзовое изделие; древний бронзовый артефакт|bronza buyum; qadimiy bronza yodgorlik
轻微|незначительный; лёгкий|yengil; arzimas
倾销|сбрасывать товары на рынок; демпинговать|bozorga arzon narxda ko‘p mahsulot chiqarmoq; demping qilmoq
清新|свежий и чистый|toza va musaffo
轻型|лёгкий; облегчённого типа|yengil; yengil turdagi
情不自禁|не суметь сдержаться|o‘zini tiyolmaslik
情调|атмосфера; настроение|muhit; kayfiyat
情怀|чувства; душевные переживания|his-tuyg‘ular; qalb kechinmalari
情结|психологический комплекс; сильная привязанность|ruhiy kechinma; kuchli bog‘lanish
情境|ситуация; обстановка|vaziyat; sharoit
情侣|влюблённая пара; возлюбленные|sevishgan juftlik; oshiq-ma’shuqlar
情人|любовник; возлюбленный|sevgili; oshiq
情商|эмоциональный интеллект|hissiy intellekt
情谊|дружба; тёплые отношения|do‘stlik; samimiy munosabat
情愿|быть готовым; предпочесть|rozi bo‘lmoq; afzal ko‘rmoq
庆典|торжество; празднование|tantana; bayram
庆贺|поздравлять; праздновать|tabriklamoq; nishonlamoq
庆幸|радоваться; быть довольным, что всё обошлось|xursand bo‘lmoq; ish yaxshi tugaganidan quvonmoq
囚犯|заключённый; узник|mahbus; tutqun
求同存异|искать общее, сохраняя различия|farqlarni saqlagan holda umumiylik izlamoq
求学|учиться; получать образование|ta’lim olmoq; o‘qimoq
求医|обратиться за медицинской помощью|tibbiy yordam so‘rab murojaat qilmoq
求证|искать доказательства; проверить|dalil izlamoq; tekshirmoq
驱动|приводить в движение; управлять|harakatga keltirmoq; boshqarmoq
区间|интервал; диапазон; участок маршрута|oraliq; diapazon; yo‘l qismi
区区|незначительный; всего лишь|arzimas; atigi
曲线|кривая; линия изгиба|egri chiziq; burilish chizig‘i
趋于|стремиться к; иметь тенденцию|...ga intilmoq; moyil bo‘lmoq
取而代之|заменить собой; занять чьё-либо место|o‘rnini egallamoq; almashtirmoq
取材|подбирать материал; собирать материал для творчества|material tanlamoq; ijod uchun material yig‘moq
取经|учиться на чужом опыте; отправиться за советом|boshqalarning tajribasidan o‘rganmoq; maslahat olishga bormoq
取决|зависеть от; определяться|...ga bog‘liq bo‘lmoq; bilan belgilanmoq
取暖|согреться; обогреться|isinmoq; o‘zini isitmoq
取胜|победить; одержать победу|g‘alaba qozonmoq; yutmoq
取笑|поддразнивать; высмеивать|masxara qilmoq; ustidan kulmoq
曲艺|традиционные китайские народные сценические искусства|an’anaviy xitoy xalq sahna san’atlari
去除|удалить; устранить|olib tashlamoq; bartaraf qilmoq
去处|место; пункт назначения|joy; boradigan manzil
去向|местонахождение; куда направился|qayerdaligi; qayerga ketgani
圈子|круг; сообщество|doira; davra
拳|кулак|musht
全方位|всесторонний; всеобъемлющий|har tomonlama; keng qamrovli
拳击|бокс|boks
全能|всесторонний; всемогущий|ko‘p qirrali; hamma ishni eplay oladigan
全身心|всем сердцем и душой|butun qalbi va vujudi bilan
诠释|интерпретировать; объяснить смысл|talqin qilmoq; ma’nosini tushuntirmoq
权限|объём полномочий; права доступа|vakolat doirasi; kirish huquqlari
全心全意|всем сердцем; целиком и полностью|butun qalbi bilan; chin dildan
劝告|советовать; увещевать|maslahat bermoq; pand-nasihat qilmoq
劝说|уговаривать; убеждать|ko‘ndirmoq; ishontirmoq
劝阻|отговаривать; отсоветовать|qaytarmoq; qilmaslikka undamoq
缺失|отсутствие; нехватка|yo‘qlik; yetishmovchilik
确凿|неоспоримый; достоверный|shubhasiz; ishonchli
确诊|подтвердить диагноз|tashxisni tasdiqlamoq
燃放|зажигать; запускать (фейерверки)|yoqmoq; (salyutni) uchirmoq
燃气|топливный газ|yoqilg‘i gazi
燃油|жидкое топливо; мазут|suyuq yoqilg‘i; mazut
饶|простить; пощадить|kechirmoq; ayamoq
绕行|объехать; обойти; двигаться по орбите|aylanib o‘tmoq; chetlab o‘tmoq; orbita bo‘ylab harakatlanmoq
绕远儿|пойти длинной дорогой; сделать крюк|uzoqroq yo‘ldan bormoq; aylanma yo‘l qilmoq
惹|провоцировать; раздражать|jahlini chiqarmoq; qo‘zg‘atmoq
热潮|волна энтузиазма; подъём|ishtiyoq to‘lqini; ko‘tarilish
热带|тропики; тропический пояс|tropiklar; tropik mintaqa
热腾腾|горячий и дымящийся|qaynoq va bug‘ chiqib turgan
热销|хорошо продаваться; пользоваться спросом|yaxshi sotilmoq; talabgir bo‘lmoq
迁|переехать; переместить|ko‘chmoq; ko‘chirmoq
千变万化|бесчисленные перемены; постоянно меняющийся|behisob o‘zgarishlar; tinimsiz o‘zgarib turadigan
牵挂|беспокоиться; переживать за кого-либо|xavotir olmoq; kimnidir o‘ylab tashvishlanmoq
千军万马|тысячи воинов и коней; могучая сила|minglab askar va otlar; ulkan kuch
千钧一发|критический момент; чрезвычайно опасное положение|hal qiluvchi lahza; nihoyatda xavfli vaziyat
牵涉|вовлекать; затрагивать|jalb qilmoq; aloqador bo‘lmoq
牵头|возглавить; взять инициативу на себя|boshchilik qilmoq; tashabbusni qo‘lga olmoq
迁移|переместиться; мигрировать|ko‘chib o‘tmoq; ko‘chirmoq
千姿百态|великое разнообразие форм и видов|shakl va ko‘rinishlarning behisob xilma-xilligi
前辈|старший; предшественник|katta avlod vakili; o‘tmishdosh
钱财|деньги и имущество; богатство|pul va mol-mulk; boylik
前程|будущие перспективы; будущее|kelajak istiqboli; kelajak
虔诚|благочестивый; искренне верующий|dindor; chin dildan e’tiqod qiluvchi
潜伏|таиться; скрываться|yashirinib yotmoq; pinhon bo‘lmoq
前赴后继|идти вперёд волна за волной|to‘lqin-to‘lqin bo‘lib oldinga intilmoq
潜能|потенциал; скрытые способности|salohiyat; yashirin qobiliyat
前任|предшественник; бывший|o‘tmishdosh; sobiq
潜入|погрузиться; проникнуть тайно|sho‘ng‘imoq; yashirincha kirmoq
前所未有|беспрецедентный; невиданный прежде|misli ko‘rilmagan; ilgari bo‘lmagan
前台|стойка регистрации; приёмная|qabul peshtaxtasi; qabulxona
潜艇|подводная лодка|suvosti kemasi
前无古人|не имеющий прецедентов в прошлом|o‘tmishda misli bo‘lmagan
前夕|канун; накануне|arafasi; arafada
前线|передовая; линия фронта|front chizig‘i; oldingi saf
潜心|сосредоточиться целиком; посвятить себя|butun diqqatini jamlamoq; o‘zini bag‘ishlamoq
前沿|передний край; передовая позиция|oldingi chiziq; yetakchi mavqe
潜在|потенциальный; скрытый|ehtimoliy; yashirin
浅显|понятный; доступный для понимания|tushunarli; anglash oson
欠缺|недоставать; нехватка|yetishmaslik; kamchilik
欠条|долговая расписка|qarz tilxati
歉意|извинение; сожаление|uzr; afsus
腔|полость; мелодия; тон|bo‘shliq; kuy; ohang
枪毙|расстрелять; казнить через расстрел|otib o‘ldirmoq; otuvga hukm qilmoq
强加|навязать; принудительно возложить|majburan yuklamoq; zo‘rlab qabul qildirmoq
强劲|сильный; мощный|kuchli; qudratli
强项|сильная сторона; специальность|kuchli jihat; ixtisos
强行|насильно; принудительно|majburan; zo‘rlab
强硬|жёсткий; твёрдый|qat’iy; keskin
强占|захватить силой; насильно занять|kuch bilan egallamoq; zo‘rlab bosib olmoq
抢夺|выхватить; захватить; разграбить|tortib olmoq; egallamoq; talamoq
抢眼|бросающийся в глаза; эффектный|ko‘zga tashlanadigan; ko‘rkam
敲诈|вымогать; шантажировать|tovlamachilik qilmoq; shantaj qilmoq
憔悴|изнурённый и бледный|holdan toygan va rangsiz
巧合|совпадение; совпасть случайно|tasodif; tasodifan mos kelmoq
撬|поддеть; вскрыть рычагом|richag bilan ko‘tarmoq; zo‘rlab ochmoq
切除|иссечь; удалить хирургически|kesib olib tashlamoq; jarrohlik yo‘li bilan olib tashlamoq
切磋|обмениваться опытом; совершенствовать мастерство вместе|tajriba almashmoq; mahoratini birga oshirmoq
切割|разрезать; резать на части|kesmoq; bo‘laklarga ajratmoq
切换|переключить; перейти к другой сцене|almashtirmoq; boshqa sahnaga o‘tmoq
且|и; а также|va; shuningdek
切记|обязательно запомнить; твёрдо помнить|albatta yodda tutmoq; yaxshilab eslab qolmoq
切忌|ни в коем случае не делать; избегать|hech qachon qilmaslik; saqlanmoq
窃取|украсть; похитить|o‘g‘irlamoq; yashirincha olib qo‘ymoq
切身|непосредственный; лично затрагивающий|bevosita; shaxsan taalluqli
惬意|довольный; испытывать удовлетворение|mamnun; ko‘ngli to‘q
侵害|посягать; наносить ущерб|tajovuz qilmoq; zarar yetkazmoq
亲和力|дружелюбие; способность располагать к себе|samimiylik; odamlarni o‘ziga jalb qilish qobiliyati
亲近|близкий; сблизиться|yaqin; yaqinlashmoq
侵权|нарушить права; нарушение прав|huquqni buzmoq; huquqbuzarlik
亲生|биологический (о ребёнке/родителе)|biologik (farzand/ota-ona haqida)
亲手|собственными руками; лично|o‘z qo‘li bilan; shaxsan
侵占|вторгнуться и захватить; присвоить|bostirib egallamoq; o‘zlashtirib olmoq
勤工俭学|работать во время учёбы; совмещать работу и учёбу|o‘qish bilan birga ishlamoq; ishlab o‘qish
勤快|прилежный; трудолюбивый|tirishqoq; mehnatsevar
琴棋书画|четыре искусства китайского учёного: музыка, го, каллиграфия и живопись|xitoy ziyolisining to‘rt san’ati: musiqa, go, xattotlik va rassomlik
寝室|спальня; комната в общежитии|yotoqxona xonasi; yotoq xona
清脆|звонкий и чистый (о звуке)|jarangdor va tiniq (tovush haqida)
清单|список; перечень предметов|ro‘yxat; buyumlar ro‘yxati
倾倒|опрокинуть; очаровать|ag‘darmoq; maftun qilmoq
平价|доступный по цене; умеренная стоимость|hamyonbop; o‘rtacha narx
瓶颈|узкое место; препятствие развитию|tor joy; rivojlanishga to‘siq
评判|оценивать; выносить суждение|baholamoq; hukm chiqarmoq
平日|обычные дни; обычно|oddiy kunlar; odatda
评审|оценивать; экспертная оценка|baholamoq; ekspert bahosi
萍水相逢|случайно встретиться незнакомцам|notanishlar tasodifan uchrashib qolmoq
评委|член жюри; судья конкурса|hakamlar hay’ati a’zosi; tanlov hakami
平息|утихнуть; успокоиться|tinchimoq; bosilmoq
凭证|подтверждение; документальное доказательство|tasdiq; hujjatli dalil
泼冷水|охладить чей-либо пыл; лишить энтузиазма|ishtiyoqini so‘ndirmoq; hafsalasini pir qilmoq
破案|раскрыть уголовное дело|jinoyat ishini ochmoq
破除|устранить; разрушить (предрассудки/препятствия)|bartaraf qilmoq; yo‘qotmoq (xurofot/to‘siqni)
破解|взломать; расшифровать; разгадать|buzib ochmoq; shifrini yechmoq; topmoq
破旧|ветхий; обветшалый|eski; xarob
破裂|лопнуть; разорваться; трещина|yorilmoq; uzilmoq; yoriq
破灭|разрушиться; рухнуть (о надежде/мечте)|barbod bo‘lmoq; puchga chiqmoq (umid/orzu)
迫使|вынудить; принудить|majbur qilmoq; zo‘rlamoq
破碎|разбить вдребезги; раздробить|parchalab yubormoq; chil-chil qilmoq
扑克|покер; игральные карты|poker; karta o‘yini
铺路|мостить дорогу; прокладывать путь|yo‘l yotqizmoq; yo‘l ochmoq
扑面而来|обрушиться на чувства; ударить в лицо|yuzga urilgandek ta’sir qilmoq; sezgilarga birdan ta’sir etmoq
菩萨|бодхисаттва|bodhisattva
谱|нотная запись; схема; диаграмма|nota yozuvi; sxema; diagramma
沏|заваривать чай|choy damlamoq
漆|краска; лак|bo‘yoq; lak
期盼|надеяться; с нетерпением ждать|umid qilmoq; intizor bo‘lmoq
蹊跷|странный; подозрительный|g‘alati; shubhali
欺诈|обманывать; мошенничество|aldamoq; firibgarlik
七嘴八舌|все говорят одновременно; оживлённое обсуждение|hamma birvarakayiga gapirmoq; qizg‘in muhokama
祈祷|молиться; молитва|ibodat qilmoq; duo
奇观|чудесное зрелище; необычайное явление|ajoyib manzara; g‘aroyib hodisa
崎岖|ухабистый; пересечённый (о местности)|notekis; adir-budur (yer haqida)
奇特|необычный; своеобразный|g‘ayrioddiy; o‘ziga xos
起步|начать движение; сделать первый шаг|yo‘lga tushmoq; ilk qadamni qo‘ymoq
起程|отправиться в путь|yo‘lga chiqmoq
启迪|просвещать; вдохновлять на размышления|ma’rifat bermoq; fikrlashga undamoq
起劲|энергичный; с большим энтузиазмом|g‘ayratli; katta ishtiyoq bilan
起跑线|стартовая линия|start chizig‘i
乞求|умолять; просить милостыню|yolvormoq; sadaqa so‘ramoq
乞讨|просить милостыню|tilanchilik qilmoq; sadaqa so‘ramoq
启用|начать использовать; ввести в эксплуатацию|foydalana boshlamoq; ishga tushirmoq
气愤|возмущённый; негодовать|g‘azablangan; qattiq ranjigan
气管|дыхательное горло; трахея|nafas nayi; traxeya
契机|благоприятная возможность; шанс|qulay imkoniyat; fursat
迄今|до сих пор; по сей день|hozirgacha; shu kungacha
器具|инструмент; принадлежность|asbob; jihoz
气流|воздушный поток; течение воздуха|havo oqimi
气馁|пасть духом; унывать|ruhi tushmoq; tushkunlikka tushmoq
气派|величественный; внушительный вид|salobatli; ko‘rkam ko‘rinish
气泡|пузырёк; воздушный пузырь|pufakcha; havo pufagi
弃权|отказаться от права; воздержаться от голосования|huquqidan voz kechmoq; ovoz berishdan tiyilmoq
气息|дыхание; запах; аромат|nafas; hid; ifor
器械|оборудование; аппаратура|jihozlar; apparatura
契约|договор; соглашение|shartnoma; kelishuv
器重|высоко ценить; доверять|yuksak baholamoq; ishonmoq
恰如其分|уместный; в самый раз|o‘rinli; ayni muddao
拍板|иметь решающий голос; принять окончательное решение|hal qiluvchi so‘zni aytmoq; yakuniy qaror qabul qilmoq
拍卖|продавать на аукционе; аукцион|auksionda sotmoq; auksion
排查|проверить; выявить неисправность|tekshirib chiqmoq; nosozlikni aniqlamoq
牌照|лицензия; регистрационный номер|litsenziya; ro‘yxat raqami
攀|взбираться; карабкаться|tirmashib chiqmoq; ko‘tarilmoq
攀升|неуклонно расти; подниматься|barqaror o‘smoq; ko‘tarilmoq
盘算|обдумывать; рассчитывать; планировать|o‘ylab ko‘rmoq; hisoblamoq; rejalashtirmoq
盼|надеяться; ждать с нетерпением|umid qilmoq; intizor bo‘lmoq
判处|приговорить; назначить наказание|hukm chiqarmoq; jazo tayinlamoq
判定|определить; вынести решение|aniqlamoq; qaror chiqarmoq
叛逆|восстать; бунтовать; мятежный|isyon ko‘tarmoq; qarshi chiqmoq; isyonkor
旁人|другие люди; окружающие|boshqa odamlar; atrofdagilar
螃蟹|краб|qisqichbaqa
胖乎乎|пухленький; упитанный|to‘lachadan kelgan; semizroq
刨|копать; рыть|qazimoq; kovlamoq
跑龙套|играть маленькую роль; быть статистом|kichik rol o‘ynamoq; ommaviy sahnada qatnashmoq
胚胎|эмбрион; зародыш|embrion; homila
佩戴|носить; надевать (украшение/знак)|taqib yurmoq; taqmoq (taqinchoq/belgi)
配方|рецепт; формула|retsept; formula
配件|комплектующая деталь; аксессуар|ehtiyot qism; aksessuar
配角|роль второго плана; второстепенный персонаж|ikkinchi darajali rol; yordamchi qahramon
配音|озвучивание; дубляж|ovoz berish; dublyaj
喷泉|фонтан|favvora
抨击|резко критиковать; атаковать|keskin tanqid qilmoq; hujum qilmoq
烹调|готовить; кулинария|ovqat pishirmoq; pazandachilik
棚|навес; сарай|bostirma; omborxona
蓬勃|бурный; процветающий|jo‘shqin; gullab-yashnayotgan
鹏程万里|блестящее будущее; большие перспективы|porloq kelajak; katta istiqbol
澎湃|бурлить; бушевать; захлёстывать|jo‘sh urmoq; to‘lqinlanmoq; qamrab olmoq
膨胀|расширяться; раздуваться|kengaymoq; shishmoq
捧场|прийти поддержать; оказать поддержку|qo‘llab-quvvatlash uchun kelmoq; dalda bermoq
碰钉子|получить отказ; встретить отпор|rad javobini olmoq; qarshilikka uchramoq
碰巧|случайно; как раз|tasodifan; ayni paytda
披露|раскрыть; обнародовать|oshkor qilmoq; ommaga e’lon qilmoq
脾|селезёнка|taloq
匹配|совпадать; соответствовать; совместимый|mos kelmoq; muvofiq; mos
僻静|уединённый; тихий|kimsasiz; sokin
媲美|сравняться; быть сопоставимым|tenglashmoq; taqqoslash mumkin bo‘lmoq
偏爱|особенно любить; отдавать предпочтение|alohida yoqtirmoq; afzal ko‘rmoq
篇幅|объём; длина текста|hajm; matn uzunligi
偏离|отклониться; отойти от|chetlashmoq; ...dan og‘moq
偏旁|боковой или составной элемент иероглифа|ieroglifning yon yoki tarkibiy qismi
偏向|склоняться к; пристрастие; тенденция|moyil bo‘lmoq; tarafkashlik; moyillik
偏远|отдалённый; труднодоступный|olis; borish qiyin
片子|фильм; кинолента|film; kino tasmasi
片段|фрагмент; отрывок|parcha; bo‘lak
漂泊|скитаться; бродить без постоянного места|sarson yurmoq; bir joyda muqim yashamaslik
飘浮|плавать в воздухе; парить|havoda suzmoq; muallaq turmoq
漂流|плыть по течению; дрейфовать; сплав|oqim bo‘ylab suzmoq; oqib ketmoq; rafting
票房|кассовые сборы; доход от продажи билетов|chipta savdosidan tushgan tushum
拼接|соединить; сшить; смонтировать|birlashtirmoq; ulab tikmoq; montaj qilmoq
频频|часто; неоднократно|tez-tez; qayta-qayta
贫穷|бедный; нищий|kambag‘al; qashshoq
品位|вкус; чувство стиля|did; uslubni his qilish
品味|пробовать на вкус; смаковать; вкус|tatib ko‘rmoq; lazzatlanmoq; did
聘|нанимать; принимать на работу|ishga olmoq; yollamoq
聘任|назначить на должность; нанять|lavozimga tayinlamoq; ishga olmoq
聘用|нанять; принять на работу|ishga yollamoq; ishga qabul qilmoq
屏蔽|экранировать; блокировать|to‘smoq; bloklamoq
平淡|обычный; невыразительный|oddiy; ta’sirsiz
评定|оценить; определить рейтинг|baholamoq; darajasini belgilamoq
平房|одноэтажный дом; бунгало|bir qavatli uy; hovli uy
平和|мягкий; спокойный; мирный|muloyim; sokin; tinch
木偶|марионетка; кукла|qo‘g‘irchoq
目中无人|высокомерный; смотреть на всех свысока|manman; barchaga mensimay qaraydigan
呐喊|кричать; взывать; призывный клич|baqirmoq; hayqirmoq; chorlovchi nido
纳入|включить; принять в состав|tarkibiga kiritmoq; qabul qilmoq
纳税|платить налоги|soliq to‘lamoq
纳税人|налогоплательщик|soliq to‘lovchi
乃|таким образом; итак|demak; shunday qilib
奶酪|сыр|pishloq
乃至|и даже; вплоть до|hatto; ...gacha
耐|выдерживать; переносить|chidamoq; bardosh bermoq
耐人寻味|заставляющий задуматься; глубокий по смыслу|o‘ylantiradigan; chuqur ma’noli
难处|трудность; затруднение|qiyinchilik; mushkul holat
难得一见|редко встречающийся; редкость|kamdan-kam uchraydigan; noyob
男方|сторона жениха; сторона мужа|kuyov tomoni; er tomoni
南瓜|тыква|qovoq
难关|трудность; серьёзное препятствие|qiyinchilik; jiddiy to‘siq
难为情|смущённый; неловко|uyalgan; noqulay ahvolda
难以置信|невероятный; трудно поверить|ishonish qiyin; aql bovar qilmaydigan
挠|чесать; царапать|qashimoq; tirnamoq
脑海|сознание; мысли|ong; xayol
恼羞成怒|разозлиться от стыда и унижения|uyat va xo‘rlikdan jahli chiqmoq
闹事|устраивать беспорядки; создавать проблемы|tartibsizlik chiqarmoq; mojaro keltirib chiqarmoq
内存|память компьютера; оперативная память|kompyuter xotirasi; tezkor xotira
内行|знаток; специалист|bilimdon; mutaxassis
内向|замкнутый; сдержанный|kamgap; odamovi
内需|внутренний спрос|ichki talab
内脏|внутренние органы|ichki a’zolar
能耗|энергопотребление|energiya sarfi
能耐|способность; умение|qobiliyat; mahorat
能人|способный человек; талантливый специалист|qobiliyatli kishi; iste’dodli mutaxassis
泥泞|грязный; илистый|loyqa; balchiqli
泥潭|трясина; болото|botqoq; balchiq
泥土|земля; почва|yer; tuproq
拟|составлять проект; подражать|loyiha tuzmoq; taqlid qilmoq
逆|противоположный; обратный|teskari; qarama-qarshi
逆境|невзгоды; трудные обстоятельства|qiyinchiliklar; og‘ir sharoit
匿名|анонимный; без указания имени|anonim; ismi ko‘rsatilmagan
黏|липкий; клейкий|yopishqoq; yelimdek
年报|годовой отчёт|yillik hisobot
年画|новогодняя народная картина|Yangi yil xalq rasmi
年均|среднегодовой; среднее за год|yillik o‘rtacha; yil davomida o‘rtacha
年轮|годичное кольцо дерева|daraxtning yillik halqasi
年迈|пожилой; преклонного возраста|yoshi ulug‘; keksa
年限|срок в годах; возрастной предел|yillar muddati; yosh chegarasi
年薪|годовая зарплата|yillik maosh
撵|выгнать; прогнать|haydab chiqarmoq; quvib yubormoq
念念不忘|постоянно помнить; не забывать|doimo yodda saqlamoq; unutmaslik
念头|мысль; идея|fikr; g‘oya
娘|мать; мама|ona; aya
酿造|варить; производить напиток брожением|achitib ichimlik tayyorlamoq; fermentatsiya qilmoq
鸟巢|птичье гнездо|qush uyasi
尿|мочиться; мочеиспускание|siydik qilmoq; siyish
凝结|сгущаться; конденсироваться|quyuqlashmoq; kondensatsiyalanmoq
纽带|связь; связующее звено|aloqa; bog‘lovchi rishta
纽扣|пуговица|tugma
扭曲|искривлять; искажать|buzib ko‘rsatmoq; qiyshaytirmoq
扭头|повернуть голову|boshini burmoq
农场|ферма; сельскохозяйственное хозяйство|ferma; dehqonchilik xo‘jaligi
农民工|трудовой мигрант; рабочий из деревни|mehnat muhojiri; qishloqdan kelgan ishchi
浓缩|концентрировать; концентрат|quyuqlashtirmoq; konsentrat
浓郁|насыщенный; густой (о запахе/вкусе)|to‘q; kuchli (hid yoki ta’m haqida)
浓重|густой; насыщенный; сильный|quyuq; to‘q; kuchli
弄虚作假|мошенничать; подделывать факты|firibgarlik qilmoq; faktlarni soxtalashtirmoq
女方|сторона невесты|kelin tomoni
女婿|зять; муж дочери|kuyov; qizining eri
暖烘烘|приятно тёплый|yoqimli iliq
诺言|обещание|va’da
秘方|секретный рецепт|maxfiy retsept
秘诀|секрет; секретный приём|sir; maxfiy usul
蜜月|медовый месяц|asal oyi
免不了|неизбежный; этого не избежать|muqarrar; bundan qochib bo‘lmaydi
免除|освободить; избавить; отменить|ozod qilmoq; xalos etmoq; bekor qilmoq
缅怀|почтить память; с теплотой вспоминать|xotirasini e’zozlamoq; mehr bilan eslamoq
腼腆|застенчивый; робкий|uyatchan; tortinchoq
免职|освободить от должности; уволить|lavozimidan ozod qilmoq; ishdan bo‘shatmoq
面红耳赤|покраснеть от гнева или волнения|g‘azab yoki hayajondan qizarib ketmoq
面孔|лицо|yuz
面面俱到|учесть всё; охватить все стороны|hamma jihatni hisobga olmoq; barcha tomonlarni qamrab olmoq
面目全非|измениться до неузнаваемости|tanib bo‘lmaydigan darajada o‘zgarmoq
苗|росток; побег|nihol; maysa
苗头|первые признаки; намёк на развитие|ilk belgilar; boshlanish alomati
庙|храм; святилище|ibodatxona; ziyoratgoh
庙会|ярмарка при храме; храмовый праздник|ibodatxona yarmarkasi; ma’bad bayrami
灭绝|вымереть; исчезнуть|qirilib ketmoq; yo‘qolib ketmoq
民办|частный; негосударственный|xususiy; nodavlat
民居|жилые дома; традиционные жилища|turar joylar; an’anaviy uylar
民生|средства к существованию; жизнь народа|tirikchilik; xalq turmushi
民事|гражданское дело; гражданско-правовой|fuqarolik ishi; fuqarolik-huquqiy
民营|частный; управляемый частным сектором|xususiy; xususiy sektor boshqaruvidagi
鸣|кричать; издавать звук (о птице)|qichqirmoq; ovoz chiqarmoq (qush haqida)
名贵|знаменитый и ценный; редкий|mashhur va qimmatli; noyob
铭记|запечатлеть в памяти; помнить|xotirasiga muhrlamoq; yodda saqlamoq
明朗|светлый и ясный; очевидный; прямой|yorug‘ va ravshan; aniq; ochiqko‘ngil
名利|слава и выгода; известность и прибыль|shuhrat va foyda; nom va manfaat
明媚|яркий и прекрасный|yorqin va go‘zal
名声|репутация; известность|obro‘; shuhrat
名言|изречение; известная цитата|hikmatli so‘z; mashhur iqtibos
名著|знаменитое произведение; классика|mashhur asar; mumtoz adabiyot
魔法|магия; волшебство|sehr; jodu
蘑菇|гриб|qo‘ziqorin
魔力|магическая сила; очарование|sehrli kuch; maftunkorlik
磨炼|закалить; тренировать себя трудностями|chiniqtirmoq; qiyinchiliklarda o‘zini tarbiyalamoq
磨难|испытание; тяжёлое испытание|sinov; og‘ir sinov
磨损|изнашиваться; износ|eskirmoq; yeyilish
抹|намазать; счётное слово для мазков цвета|surmoq; rang chiziqlari uchun hisob so‘zi
墨|тушь; чернила|siyoh; xitoy tush’i
莫大|величайший; огромный|eng katta; nihoyatda ulkan
莫非|неужели?; возможно ли, что…?|nahotki?; ... bo‘lishi mumkinmi?
茉莉|жасмин|yasmin
没落|приходить в упадок; упадок|tanazzulga yuz tutmoq; tanazzul
默默无闻|неизвестный; не привлекающий внимания|noma’lum; ko‘zga tashlanmaydigan
默契|молчаливое взаимопонимание; согласованность|so‘zsiz tushunish; hamjihatlik
漠然|равнодушный; безразличный|befarq; loqayd
末日|судный день; последний день|qiyomat kuni; oxirgi kun
谋害|замышлять убийство; погубить|o‘ldirishni rejalashtirmoq; halok qilmoq
谋划|планировать; обдумывать замысел|rejalashtirmoq; puxta o‘ylamoq
谋取|добиваться; стремиться получить|qo‘lga kiritishga intilmoq; erishmoq
谋生|зарабатывать на жизнь|tirikchilik qilmoq; kun ko‘rmoq
亩|мера площади; около 1/15 гектара|yer maydoni o‘lchovi; taxminan gektarning 1/15 qismi
牡丹|древовидный пион|daraxtsimon pion
拇指|большой палец|bosh barmoq
幕|занавес; экран; акт пьесы|parda; ekran; pyesa pardasi
墓碑|надгробный камень|qabr toshi
目不转睛|не отрывать глаз|ko‘z uzmay qaramoq
牧场|пастбище; ранчо|yaylov; chorvachilik fermasi
目瞪口呆|остолбенеть от изумления|hayratdan dong qotmoq
墓地|кладбище; могила|qabriston; qabr
幕后|за кулисами; за сценой|sahna ortida; yashirin ravishda
木匠|плотник; столяр|duradgor; yog‘och ustasi
募捐|собирать пожертвования; сбор средств|xayriya yig‘moq; mablag‘ to‘plamoq
牧民|пастух; скотовод|cho‘pon; chorvador
抡|размахивать; взмахнуть|silkitmoq; havoda o‘ynatmoq
轮换|чередоваться; сменять друг друга|navbat bilan almashmoq; bir-birini almashtirmoq
伦理|этика; нравственные принципы|axloqshunoslik; axloqiy tamoyillar
论述|рассуждать; излагать; трактат|muhokama qilmoq; bayon etmoq; risola
萝卜|редька; дайкон|turp; daikon
螺丝|винт; шуруп|vint; burama mix
裸|голый; обнажённый|yalang‘och
裸露|быть открытым; обнажённый; неприкрытый|ochiq qolmoq; yalang‘och; yopilmagan
裸体|обнажённый; нагой|yalang‘och; kiyimsiz
落差|перепад высоты; разрыв; различие|balandlik farqi; tafovut; farq
落户|обосноваться; зарегистрировать место жительства|joylashib olmoq; yashash joyini ro‘yxatdan o‘tkazmoq
麻将|маджонг|majiang
麻辣|острый и обжигающий (о вкусе)|achchiq va tilni uvushtiradigan (ta’m)
马后炮|запоздалая мера; комментарий задним числом|kechikkan chora; voqeadan keyingi gap
马力|лошадиная сила; единица мощности двигателя|ot kuchi; dvigatel quvvati o‘lchovi
马桶|унитаз; туалетная чаша|unitaz; hojatxona idishi
埋藏|зарыть; похоронить|ko‘mmoq; yerga ko‘mib qo‘ymoq
埋头苦干|с головой уйти в работу|ishga sho‘ng‘ib, tinmay mehnat qilmoq
脉络|артерии и вены; взаимосвязи; структура|arteriya va venalar; o‘zaro bog‘lanishlar; tuzilma
瞒|скрывать от кого-либо; утаивать|kimdandir yashirmoq; sir tutmoq
满怀|быть полным чувств; всем сердцем|his-tuyg‘ularga to‘la bo‘lmoq; chin dildan
漫|затопить; разлиться через край|suv bosmoq; toshib ketmoq
漫游|путешествовать; странствовать|sayohat qilmoq; kezib yurmoq
忙活|быть очень занятым; хлопотать|juda band bo‘lmoq; yugur-yugur qilmoq
忙乱|суетливый и растерянный|shoshqaloq va sarosimaga tushgan
矛头|направление атаки; острие копья|hujum nishoni; nayza uchi
冒昧|смелый; дерзкий; позволительный (о поступке)|dadil; jur’atli; nojoiz bo‘lsa-da qilingan
茂密|густой; пышный|qalin; zich o‘sgan
没劲|не иметь сил; скучный|kuchi yo‘q; zerikarli
眉开眼笑|сиять от радости; улыбаться во весь рот|quvonchdan yuz-ko‘zi kulmoq
没完没了|бесконечный; без конца и края|tugamas; oxiri yo‘q
没准儿|неизвестно; возможно|aniq emas; balki
美德|добродетель; высокая нравственность|fazilat; yuksak axloq
美化|приукрашивать; украшать|bezamoq; go‘zallashtirmoq
美学|эстетика|estetika
美誉|доброе имя; хорошая репутация|yaxshi nom; obro‘
美中不足|маленький недостаток в остальном прекрасной вещи|mukammal narsadagi kichik kamchilik
美滋滋|очень довольный; счастливый|juda mamnun; baxtiyor
闷|душный; спертый (о воздухе)|dim; bo‘g‘iq (havo haqida)
闷热|душный и жаркий; знойный|dim va issiq; jazirama
门槛|порог; барьер для вступления|ostona; kirish talabi
门路|способ; связи; нужные знакомства|usul; aloqa; kerakli tanishlar
萌发|прорастать; зарождаться|unib chiqmoq; paydo bo‘la boshlamoq
朦胧|тусклый; расплывчатый; нечёткий|xira; noaniq; ravshan bo‘lmagan
盟友|союзник|ittifoqchi
猛然|внезапно; неожиданно|birdan; kutilmaganda
梦幻|мечта; фантастический|orzu; xayoliy
梦寐以求|желать даже во сне; страстно мечтать|hatto tushida ham orzu qilmoq; juda qattiq istamoq
谜|загадка|topishmoq; jumboq
谜底|ответ на загадку|topishmoqning javobi
迷恋|быть очарованным; увлечься|maftun bo‘lmoq; berilib ketmoq
谜团|загадка; тайна|jumboq; sir
密布|густо покрывать; быть усеянным|zich qoplamoq; qalin joylashmoq
寥寥无几|совсем немного; единицы|juda oz; sanoqli
疗效|лечебный эффект; эффективность лечения|davolovchi ta’sir; davolash samarasi
了结|уладить; завершить|hal qilmoq; yakunlamoq
料理|заниматься; готовить; кухня|ish yuritmoq; ovqat pishirmoq; oshxona
咧嘴|широко улыбнуться; оскалиться|og‘zini katta ochib kulmoq; tishini ko‘rsatmoq
裂缝|трещина; щель|yoriq; darz
裂痕|трещина; след разрыва|yoriq; darz izi
猎人|охотник|ovchi
烈日|палящий солнечный зной|jazirama quyosh
劣势|недостаток; слабая сторона|kamchilik; zaif tomon
烈士|мученик; павший герой|shahid; halok bo‘lgan qahramon
猎物|добыча; жертва охоты|o‘lja; ovlangan hayvon
劣质|низкого качества; некачественный|sifatsiz; past sifatli
拎|нести в руке; поднять|qo‘lda ko‘tarmoq; ko‘tarib olmoq
临|сталкиваться с; находиться перед|duch kelmoq; oldida turmoq
临街|выходить на улицу; располагаться у улицы|ko‘chaga qaragan; ko‘cha bo‘yida joylashgan
临近|приближаться; быть рядом|yaqinlashmoq; yaqin joylashgan bo‘lmoq
灵|ловкий; действенный; дух|chaqqon; ta’sirchan; ruh
灵机一动|внезапно пришла блестящая идея|birdan zo‘r fikr xayoliga kelmoq
灵巧|ловкий; искусный|chaqqon; mohir
零售|розничная торговля; продавать в розницу|chakana savdo; chakana sotmoq
零碎|разрозненный; мелкие вещи|tarqoq; mayda-chuyda narsalar
聆听|внимательно слушать|diqqat bilan tinglamoq
灵通|быть хорошо осведомлённым; быстрый|xabardor; tezkor
领队|руководить группой; лидер группы|guruhni boshqarmoq; guruh rahbari
领军|возглавлять; ведущий|boshchilik qilmoq; yetakchi
领略|испытать; оценить; насладиться|boshdan kechirmoq; qadrlamoq; zavqlanmoq
领事|консул|konsul
领养|усыновить; взять под опеку|farzandlikka olmoq; vasiylikka olmoq
溜达|прогуливаться; гулять|sayr qilmoq; aylanib yurmoq
流畅|плавный; беглый|ravon; silliq
流派|школа мысли; жанр|fikriy oqim; janr
流逝|проходить; течь (о времени)|o‘tmoq; (vaqt) o‘tib ketmoq
流失|вымывать; утрачивать; утечка|yuvib ketmoq; yo‘qotmoq; sizib chiqish
流水|текущая вода; поток|oqayotgan suv; oqim
流淌|течь; струиться|oqmoq; sharillab oqmoq
流向|направление течения|oqim yo‘nalishi
留心|быть осторожным; обращать внимание|ehtiyot bo‘lmoq; e’tibor bermoq
流血|кровоточить; истекать кровью|qonamoq; qon yo‘qotmoq
留意|обращать внимание; быть внимательным|e’tibor bermoq; diqqatli bo‘lmoq
流域|речной бассейн|daryo havzasi
流转|переходить из рук в руки; циркулировать|qo‘ldan-qo‘lga o‘tmoq; aylanmoq
柳树|ива|tol daraxti
遛|прогуливаться; выгуливать|sayr qilmoq; aylantirib kelmoq
聋|глухой|kar
龙头|кран; водопроводный кран|jo‘mrak; suv krani
笼子|клетка|qafas
笼统|общий; расплывчатый|umumiy; noaniq
露面|показаться на публике; появиться|ko‘rinish bermoq; paydo bo‘lmoq
炉子|печь; плита|pech; plita
鲁莽|безрассудный; импульсивный|o‘ylamay ish qiladigan; shoshqaloq
卤味|мясо или продукты, тушённые в соевом соусе со специями|soya sousi va ziravorlarda dimlangan go‘sht yoki mahsulot
鹿|олень|kiyik
路段|участок дороги|yo‘l qismi
路径|путь; маршрут|yo‘l; marshrut
露天|на открытом воздухе; под открытым небом|ochiq havoda; osmon ostida
路途|дорога; путь|yo‘l; safar
露营|разбить лагерь; кемпинг|chodir tikib dam olmoq; lager
路子|метод; способ|usul; yo‘l
屡|неоднократно; снова и снова|qayta-qayta; ko‘p marta
缕|счётное слово для прядей и тонких струй|tolalar va ingichka oqimlar uchun hisob so‘zi
屡屡|снова и снова; неоднократно|qayta-qayta; ko‘p marta
绿地|зелёная зона; озеленённый участок|yashil hudud; ko‘kalamzor joy
绿洲|оазис|voha
孪生|близнецы; двойня|egizaklar
卵|яйцо|tuxum
乱七八糟|хаотичный; беспорядочный|tartibsiz; pala-partish
略|краткий; вкратце|qisqa; qisqacha
老字号|магазин или бренд с давней историей|uzoq tarixga ega do‘kon yoki brend
涝|затопленный; пострадавший от наводнения|suv bosgan; toshqindan zarar ko‘rgan
乐此不疲|наслаждаться занятием и не уставать|bir ishni zavq bilan qilib, charchamaslik
乐园|рай; парк развлечений|jannat; ko‘ngilochar bog‘
勒|затянуть; туго стянуть ремнём|mahkam bog‘lamoq; kamar bilan siqmoq
雷同|совпадать; быть слишком похожим|bir xil bo‘lmoq; haddan tashqari o‘xshash
累赘|лишний; обременительный; обуза|ortiqcha; noqulay; yuk
累计|подсчитать общую сумму; накопленный итог|jami hisoblamoq; yig‘ilgan umumiy miqdor
累积|накапливать; накопление|to‘plamoq; jamg‘arish
棱角|углы и грани; резкость характера|qirra va burchaklar; fe’lning keskinligi
冷冻|замораживать; заморозка|muzlatmoq; muzlatish
冷门|непопулярная область; неожиданный победитель|kam tanilgan soha; kutilmagan g‘olib
冷漠|холодный и безучастный; равнодушный|sovuqqon va befarq; loqayd
冷战|холодная война|sovuq urush
离谱儿|возмутительный; совершенно выходящий за рамки|haddan tashqari; me’yordan butunlay chetga chiqqan
离奇|странный; необычайный|g‘alati; hayratlanarli
礼服|парадная одежда; церемониальный костюм|rasmiy libos; tantanali kiyim
理会|обратить внимание; принять во внимание|e’tibor bermoq; inobatga olmoq
礼品|подарок|sovg‘a
理事|член совета; управляющий|kengash a’zosi; boshqaruvchi
礼仪|этикет; правила поведения|odob qoidalari; marosim tartibi
鲤鱼|карп|karp balig‘i
立案|зарегистрировать; возбудить дело|ro‘yxatga olmoq; ish ochmoq
利弊|преимущества и недостатки|afzalliklar va kamchiliklar
力不从心|не хватать сил сделать то, что хочется|xohlagan ishini qilishga kuchi yetmaslik
历程|ход; путь; этапы развития|kechish; yo‘l; rivojlanish bosqichlari
立法|принимать законы; законодательство|qonun qabul qilmoq; qonunchilik
立方米|кубический метр|kub metr
立功|совершить заслугу; оказать важную услугу|xizmat ko‘rsatmoq; muhim hissa qo‘shmoq
历届|все предыдущие созывы/сессии|oldingi barcha chaqiriqlar/sessiyalar
莅临|прибыть; посетить (почтит.)|tashrif buyurmoq; kelmoq (hurmat shakli)
历时|длиться; продолжаться в течение|davom etmoq; ... vaqt davom etmoq
利索|проворный; ловкий; аккуратный|chaqqon; epchil; ozoda
励志|стремиться к цели с решимостью; мотивирующий|maqsadga qat’iyat bilan intilmoq; ruhlantiruvchi
连贯|связный; последовательно соединять|izchil; uzviy bog‘lamoq
廉价|дешёвый; недорогой|arzon; qimmat bo‘lmagan
连连|неоднократно; снова и снова|qayta-qayta; takroran
连绵|непрерывно простираться; тянуться без перерыва|uzluksiz cho‘zilmoq; davom etmoq
连任|быть переизбранным; занимать должность ещё один срок|qayta saylanmoq; lavozimda yana bir muddat qolmoq
怜惜|жалеть; относиться с сочувствием|rahmi kelmoq; achinmoq
连夜|той же ночью; не откладывая до утра|shu kechaning o‘zida; tonggacha qoldirmay
廉正|честный и неподкупный|halol va poraxo‘rlikdan yiroq
帘子|занавеска; штора|parda
莲子|семена лотоса|lotus urug‘i
脸颊|щека|yonoq
炼|рафинировать; очищать|tozalamoq; qayta ishlamoq
恋恋不舍|не хотеть расставаться; уходить с сожалением|ayrilgisi kelmaslik; afsus bilan ketmoq
良|хороший; добрый|yaxshi; ezgu
凉爽|прохладный и освежающий|salqin va yoqimli
良性|положительный; доброкачественный|yaxshi xulqli; zararsiz (o‘sma haqida)
两口子|супруги; муж и жена|er-xotin; juftlik
两栖|амфибийный; земноводный|amfibiyaga oid; suvda ham quruqlikda ham yashaydigan
两下子|пару раз; настоящее мастерство; приём|bir-ikki marta; haqiqiy mahorat; usul
两翼|оба крыла; два фланга|ikkala qanot; ikki qanot
亮点|яркий момент; сильная сторона|yorqin jihat; kuchli tomon
量化|количественно оценить; количественный|miqdoriy baholamoq; miqdoriy
亮丽|яркий и красивый|yorqin va chiroyli
亮相|появиться на публике; дебютировать|omma oldida ko‘rinish bermoq; debyut qilmoq
潦草|небрежный; неразборчивый (о почерке)|beparvo yozilgan; o‘qish qiyin (yozuv haqida)
疗法|метод лечения; терапия|davolash usuli; terapiya
扣留|задержать; удерживать|ushlab turmoq; hibsga olmoq
扣人心弦|захватывающий; волнующий|hayajonli; kishini o‘ziga rom etadigan
扣押|задержать; арестовать имущество|hibsga olmoq; mol-mulkni xatlamoq
窟窿|дыра; отверстие|teshik; kovak
哭笑不得|не знать, смеяться или плакать|kulishni ham, yig‘lashni ham bilmay qolmoq
苦难|страдания; бедствия|azob-uqubat; kulfat
苦恼|огорчённый; измученный тревогой|tashvishlangan; bezovta
苦笑|вынужденно улыбнуться; горькая улыбка|majburan jilmaymoq; achchiq tabassum
苦心|кропотливые усилия; старания|tinimsiz mehnat; sa’y-harakat
库存|запасы; складские остатки|zaxira; ombordagi mahsulot
酷似|поразительно походить|juda o‘xshamoq
夸大|преувеличивать|bo‘rttirib ko‘rsatmoq
夸夸其谈|хвастливо рассуждать; много говорить без дела|maqtanib gapirmoq; quruq safsata sotmoq
夸耀|хвастаться; кичиться|maqtanmoq; o‘zini ko‘z-ko‘z qilmoq
垮|рухнуть; обрушиться|qulamoq; yiqilmoq
跨度|протяжённость; диапазон|qamrov; ko‘lam
跨国|транснациональный; международный|transmilliy; xalqaro
跨越|пересечь; преодолеть; выйти за пределы|kesib o‘tmoq; yengib o‘tmoq; chegaradan oshmoq
宽泛|широкий; обширный по охвату|keng; qamrovi katta
宽厚|снисходительный; великодушный|bag‘rikeng; ko‘ngli keng
宽恕|простить; простить вину|kechirmoq; gunohidan o‘tmoq
宽松|просторный; свободный; мягкий|keng; bo‘sh; yumshoq
款项|денежные средства; сумма платежа|mablag‘; to‘lov summasi
狂欢|пировать; шумно веселиться|bayram qilmoq; xursandchilik qilmoq
狂热|фанатичный; исступлённый|mutaassib; jazavaga tushgan
框|рама; рамка|rom; ramka
矿藏|полезные ископаемые; минеральные ресурсы|foydali qazilmalar; mineral zaxiralar
亏本|нести убытки; работать в убыток|zarar ko‘rmoq; zarar bilan ishlamoq
捆|связывать; связка (счётное слово)|bog‘lamoq; bog‘lam (hisob so‘zi)
困惑|растерянный; озадаченный|hayron; boshi qotgan
困境|трудное положение; тупик|qiyin ahvol; tang vaziyat
扩|расширять; увеличивать|kengaytirmoq; kattalashtirmoq
阔绰|расточительный; живущий на широкую ногу|isrofgarchilik qiladigan; dabdabali yashaydigan
扩建|расширить строительство; пристроить|qurilishni kengaytirmoq; qo‘shimcha bino qurmoq
拉动|тянуть; стимулировать рост|tortmoq; o‘sishni rag‘batlantirmoq
啦啦队|группа поддержки; команда чирлидеров|dalda beruvchi muxlislar jamoasi
拉链|молния (застёжка)|fermuar; kiyim ilgagi
拉拢|переманить; привлечь на свою сторону|o‘z tomoniga og‘dirmoq; jalb qilmoq
蜡|воск; свеча|mum; sham
腊月|двенадцатый месяц лунного календаря|oy taqvimining o‘n ikkinchi oyi
来宾|гость; посетитель|mehmon; tashrif buyuruvchi
来电|входящий звонок; позвонить; мгновенная симпатия|kiruvchi qo‘ng‘iroq; telefon qilmoq; bir ko‘rishda yoqtirib qolish
来访|нанести визит; посетить|tashrif buyurmoq; ko‘rgani kelmoq
来回|совершить поездку туда и обратно; туда-сюда|borib-kelmoq; u yoqdan bu yoqqa
来龙去脉|полная последовательность событий; причины и последствия|voqealarning to‘liq kechishi; sabab va oqibatlar
来年|следующий год|kelasi yil
来之不易|доставшийся с большим трудом|qiyinchilik bilan qo‘lga kiritilgan
栏杆|перила; ограждение|panjara; tutqich
蓝图|чертёж; план|loyiha chizmasi; reja
揽|взять на себя; обнять|zimmasiga olmoq; quchoqlamoq
缆车|канатная дорога; фуникулёр|osma yo‘l; kanatli transport
懒得|не хотеть утруждать себя; неохота|ovora bo‘lishni istamaslik; erinmoq
滥用|злоупотреблять; использовать неправомерно|suiiste’mol qilmoq; noto‘g‘ri foydalanmoq
朗诵|выразительно читать вслух|ifodali qilib ovoz chiqarib o‘qimoq
牢记|крепко запомнить; помнить|yaxshilab yodda saqlamoq; eslab qolmoq
牢牢|крепко; прочно|mahkam; mustahkam
劳累|усталый; утомлённый|charchagan; holdan toygan
劳务|трудовые услуги; рабочая сила|mehnat xizmati; ishchi kuchi
老伴儿|супруг/супруга (о пожилой паре)|keksa er-xotinning umr yo‘ldoshi
老大|старший ребёнок в семье|oiladagi katta farzand
老化|стареть; изнашиваться|eskirmoq; qarimoq
老人家|почтительное обращение к пожилому человеку|keksa kishiga hurmat bilan murojaat
恐慌|паника; паниковать|vahima; vahimaga tushmoq
恐龙|динозавр|dinozavr
控告|обвинить; предъявить обвинение|ayblamoq; ayblov qo‘ymoq
抠|ковырять; скупой|kovlamoq; ziqna
口岸|торговый порт; пограничный переход|savdo porti; chegara o‘tish joyi
口碑|общественная репутация; молва|jamoatchilik orasidagi obro‘; el og‘zidagi gap
口才|красноречие; дар речи|so‘zamollik; notiqlik qobiliyati
口吃|заикаться; заикание|duduqlanmoq; duduqlanish
口径|версия; позиция; линия поведения|qarash; nuqtai nazar; yo‘nalish
口令|устная команда; пароль|og‘zaki buyruq; parol
口哨儿|свист; свисток|hushtak; hushtak chalish
口水|слюна|so‘lak
口头禅|любимое словечко; присказка|tez-tez ishlatiladigan ibora; odatiy gap
口香糖|жевательная резинка|saqich
口罩|маска; защитная маска|niqob; himoya niqobi
口子|отверстие; щель|teshik; yoriq
扣除|вычесть; удержать|ayirib tashlamoq; ushlab qolmoq
开动|запустить; начать работу|ishga tushirmoq; ishni boshlamoq
开发区|зона развития; промышленная зона|rivojlanish hududi; sanoat zonasi
开发商|застройщик; девелопер|quruvchi kompaniya; developer
开工|начать работу; приступить к строительству|ishni boshlamoq; qurilishni boshlamoq
开垦|осваивать целину; распахивать новые земли|yangi yerlarni o‘zlashtirmoq; yerni haydamoq
开天辟地|беспрецедентный; первый в своём роде|misli ko‘rilmagan; o‘ziga xos birinchi
开庭|начать судебное заседание|sud majlisini boshlamoq
开销|расходы; оплачивать|xarajat; to‘lamoq
开张|открыться для бизнеса; начать торговлю|savdoni boshlamoq; ish boshlamoq
楷模|образец; пример для подражания|namuna; ibrat
凯旋|вернуться с победой; триумфально возвратиться|g‘alaba bilan qaytmoq; tantanali qaytmoq
堪称|достойно называться; можно назвать|deb atashga arziydi; ... deyish mumkin
看护|ухаживать; быть сиделкой/медсестрой|parvarish qilmoq; hamshiralik qilmoq
看守|охранять; сторожить|qo‘riqlamoq; nazorat qilmoq
坎坷|ухабистый; трудный и тернистый|notekis; mashaqqatli va og‘ir
看台|трибуна; зрительская площадка|tribuna; tomoshabinlar joyi
抗衡|соперничать; противостоять|raqobatlashmoq; qarshi turmoq
抗拒|сопротивляться; противиться|qarshilik ko‘rsatmoq; bosh tortmoq
抗生素|антибиотик|antibiotik
抗争|сопротивляться; бороться|qarshilik ko‘rsatmoq; kurashmoq
考查|изучать; проверять; оценивать|o‘rganmoq; tekshirmoq; baholamoq
考量|рассмотреть; взвесить; принять во внимание|ko‘rib chiqmoq; o‘lchab ko‘rmoq; hisobga olmoq
苛刻|строгий; суровый; чрезмерно требовательный|qattiqqo‘l; shafqatsiz; ortiqcha talabchan
壳|скорлупа; оболочка|qobiq; po‘choq
可悲|прискорбный; печальный|achinarli; qayg‘uli
可不是|именно так; совершенно верно|xuddi shunday; to‘ppa-to‘g‘ri
可乘之机|удобная возможность для злоупотребления; лазейка|foydalanib qolish mumkin bo‘lgan qulay fursat; bo‘shliq
可耻|постыдный; позорный|uyatli; sharmandali
可贵|ценный; похвальный|qadrli; tahsinga loyiq
可谓|по праву можно назвать; можно сказать|haqli ravishda ... deyish mumkin; desa bo‘ladi
可想而知|само собой разумеется; нетрудно представить|o‘z-o‘zidan ayon; tasavvur qilish qiyin emas
可疑|подозрительный|shubhali
客房|гостевая комната; номер для гостей|mehmon xonasi; mehmonxona xonasi
刻画|изображать; описывать|tasvirlamoq; ifodalamoq
客机|пассажирский самолёт|yo‘lovchi samolyoti
客流|пассажиропоток|yo‘lovchilar oqimi
克隆|клонировать; клон|klonlamoq; klon
刻意|намеренно; тщательно|ataylab; sinchiklab
客运|пассажирские перевозки|yo‘lovchi tashish
刻舟求剑|действовать по устаревшему плану, не учитывая перемены|vaziyat o‘zgarganini hisobga olmay, eskicha yo‘l tutmoq
恳求|умолять; настойчиво просить|yolvormoq; qat’iy iltimos qilmoq
空荡荡|совершенно пустой|butunlay bo‘sh
空间站|космическая станция|kosmik stansiya
空难|авиакатастрофа|samolyot halokati
空前|беспрецедентный; невиданный ранее|misli ko‘rilmagan; ilgari kuzatilmagan
举棋不定|колебаться; не решаться сделать ход|ikkilanmoq; qadam tashlashga jur’at etolmaslik
举一反三|по одному примеру понять остальное; учиться по аналогии|bir misoldan umumiy xulosa chiqarmoq; o‘xshatish orqali o‘rganmoq
举止|манеры; поведение|xulq-atvor; o‘zini tutish
举重|тяжёлая атлетика|og‘ir atletika
剧变|резко измениться; резкое изменение|keskin o‘zgarmoq; keskin o‘zgarish
巨额|огромная сумма; колоссальный объём|ulkan summa; juda katta miqdor
聚焦|сосредоточить внимание; фокусироваться|diqqatni jamlamoq; fokuslanmoq
剧目|театральная постановка; репертуарное произведение|sahna asari; repertuar asari
剧情|сюжет; развитие событий|syujet; voqealar rivoji
巨人|гигант; великан|ulkan odam; dev
巨头|магнат; крупный руководитель|magnat; yirik rahbar
捐献|пожертвовать; сделать дар|ehson qilmoq; xayriya bermoq
卷入|быть втянутым; оказаться вовлечённым|aralashib qolmoq; jalb etilmoq
绝技|непревзойдённое мастерство; уникальный навык|beqiyos mahorat; noyob ko‘nikma
绝迹|исчезнуть; вымереть|yo‘qolib ketmoq; qirilib ketmoq
崛起|стремительно подняться; возвыситься|tez ko‘tarilmoq; yuksalmoq
诀窍|секрет; хитрость; приём|sir; usul; hiyla
决议|резолюция; постановление|qaror; rezolyutsiya
绝缘|изолировать; быть отрезанным от|izolyatsiya qilmoq; ...dan uzilib qolmoq
抉择|выбрать; сделать выбор|tanlamoq; qaror qilmoq
角逐|состязаться; бороться за первенство|bellashmoq; ustunlik uchun kurashmoq
倔|упрямый; грубоватый|qaysar; qo‘polroq
均|равный; одинаковый|teng; bir xil
军官|офицер|ofitser
均衡|сбалансированный; равновесие|muvozanatli; muvozanat
俊|красивый; привлекательный (о мужчине)|kelishgan; chiroyli (erkak haqida)
竣工|завершить строительство; завершение проекта|qurilishni tugatmoq; loyihani yakunlash
骏马|породистая лошадь; скакун|zotdor ot; tulpor
俊俏|красивый и обаятельный|chiroyli va maftunkor
开办|открыть; основать (учреждение)|ochmoq; tashkil etmoq (muassasa)
开场|начать; начало представления|boshlamoq; tomosha boshlanishi
开场白|вступительное слово; пролог|kirish so‘zi; muqaddima
敬而远之|держаться на почтительном расстоянии|hurmat saqlagan holda uzoqroq turmoq
境地|обстоятельства; положение|vaziyat; ahvol
净化|очищать; очищение|tozalamoq; poklamoq
竞技|соревноваться в спорте; спортивное состязание|sportda bellashmoq; sport musobaqasi
境内|в пределах границ; внутри страны|chegaralar ichida; mamlakat ichida
敬佩|уважать и восхищаться|hurmat qilmoq va qoyil qolmoq
敬请|просим; пожалуйста (вежл.)|iltimos qilamiz; marhamat (hurmat shakli)
境外|за пределами страны; за границей|mamlakat tashqarisida; xorijda
敬畏|благоговеть; испытывать почтительный страх|ehtirom bilan qo‘rqmoq; chuqur hurmat qilmoq
竞相|соревнуясь друг с другом; наперегонки|bir-biri bilan bellashib; poygalashib
敬意|уважение; почтение|hurmat; ehtirom
境遇|обстоятельства; жизненное положение|sharoit; hayotiy ahvol
径直|прямо; напрямую|to‘g‘ridan-to‘g‘ri; bevosita
静止|неподвижный; неподвижность|harakatsiz; tinch holat
敬重|глубоко уважать|chuqur hurmat qilmoq
窘迫|стеснённый в средствах; затруднительное положение; смущённый|mablag‘dan qiynalgan; mushkul ahvol; noqulay tortgan
揪|схватить; ухватить|changallamoq; ushlab olmoq
纠缠|запутаться; приставать; надоедать|chigallashmoq; tinchlik bermaslik; jig‘iga tegmoq
酒楼|ресторан; китайская харчевня|restoran; xitoy taomlari oshxonasi
久违|давно не виделись|ko‘rishmaganimizga ancha bo‘ldi
久仰|давно хотел с вами познакомиться (вежл.)|siz bilan anchadan beri tanishishni istardim (hurmat shakli)
就餐|обедать; принимать пищу|ovqatlanmoq; taom yemoq
就此|на этом; в связи с этим|shu bilan; shu munosabat bilan
就地|на месте; на месте происшествия|shu joyning o‘zida; joyida
就任|вступить в должность|lavozimga kirishmoq
救死扶伤|спасать умирающих и лечить раненых|jon berayotganlarni qutqarmoq va yaradorlarni davolamoq
就绪|быть готовым; быть подготовленным|tayyor bo‘lmoq; shay bo‘lmoq
就医|обратиться за медицинской помощью|tibbiy yordamga murojaat qilmoq
就诊|обратиться к врачу; прийти на приём|shifokor qabuliga bormoq; ko‘rikdan o‘tmoq
救治|лечить пациента; оказывать неотложную помощь|bemorni davolamoq; shoshilinch yordam ko‘rsatmoq
就座|занять место; сесть|joyiga o‘tirmoq; o‘tirib olmoq
居安思危|думать об опасности в благополучные времена|tinch zamonda ham xavfni o‘ylamoq
居高不下|оставаться упорно высоким (о ценах/показателях)|(narx/ko‘rsatkich) yuqori darajada saqlanib qolmoq
居于|занимать (место/положение); находиться в состоянии|(o‘rin/mavqeni) egallamoq; holatda bo‘lmoq
举报|сообщить о нарушении; заявить|xabar bermoq; ma’lum qilmoq
举措|мера; шаг|chora; qadam
节衣缩食|экономить на одежде и еде|kiyim-kechak va ovqatdan tejamoq
解救|спасти; выручить|qutqarmoq; yordam bermoq
解渴|утолить жажду|chanqoqni qondirmoq
解脱|освободиться от тревог; избавиться от|tashvishlardan xalos bo‘lmoq; qutulmoq
解围|снять осаду; выручить из затруднительного положения|qamaldan chiqarmoq; mushkul vaziyatdan qutqarmoq
解析|анализировать; разбирать|tahlil qilmoq; tahlil etmoq
解约|расторгнуть договор; прекратить соглашение|shartnomani bekor qilmoq; kelishuvni to‘xtatmoq
界定|определить; установить границы|ta’riflamoq; chegaralarini belgilamoq
介入|вмешаться; принять участие|aralashmoq; ishtirok etmoq
届时|к тому времени; когда наступит срок|o‘sha paytda; vaqti kelganda
借条|расписка о займе; долговая расписка|qarz tilxati; qarz olingani haqidagi tilxat
界线|разделительная линия; граница; предел|ajratish chizig‘i; chegara; me’yor
介意|придавать значение; возражать|ahamiyat bermoq; qarshi bo‘lmoq
借用|одолжить; использовать для другой цели|qarzga olmoq; boshqa maqsadda foydalanmoq
介于|находиться между; располагаться между|orasida bo‘lmoq; ... o‘rtasida joylashmoq
筋|мышца; сухожилие|mushak; pay
禁不住|не сдержаться; не выдержать|o‘zini tiyolmaslik; chiday olmaslik
紧凑|компактный; плотный|ixcham; zich
锦旗|шёлковое знамя; почётный вымпел|ipak bayroq; faxriy tug‘
紧缺|дефицитный; в нехватке|taqchil; yetishmayotgan
紧缩|сокращать; ужимать; урезать|qisqartirmoq; tejab kamaytirmoq
尽早|как можно раньше|imkon qadar erta
劲|сила; мощь|kuch; quvvat
进程|ход событий; процесс|voqealar rivoji; jarayon
晋级|перейти в следующий ранг; повысить уровень|keyingi bosqichga o‘tmoq; darajasi ko‘tarilmoq
禁忌|табу; запрет|taqiq; tabu
进军|двинуться; наступать; выйти на рынок|yurish qilmoq; hujumga o‘tmoq; bozorga chiqmoq
尽情|вволю; сколько душе угодно|ko‘ngli tusaganicha; bemalol
进取|инициативность; стремление к успеху|tashabbuskorlik; muvaffaqiyatga intilish
禁区|запретная зона; закрытая территория|taqiqlangan hudud; yopiq zona
尽头|конец; край|oxiri; chekka
进修|продолжить обучение; пройти курсы повышения квалификации|o‘qishni davom ettirmoq; malaka oshirish kursidan o‘tmoq
经|проходить через; пересекать|orqali o‘tmoq; kesib o‘tmoq
鲸|кит|kit
精彩纷呈|блестящий и разнообразный; полный ярких моментов|ajoyib va rang-barang; yorqin voqealarga boy
经度|долгота|uzunlik; geografik uzunlik
精度|точность; степень точности|aniqlik; aniqlik darajasi
惊慌|панический; испуганный|vahimaga tushgan; qo‘rqqan
惊慌失措|потерять голову от страха|qo‘rquvdan o‘zini yo‘qotmoq
荆棘|чертополох и колючки; препятствия|tikanli o‘tlar; to‘siqlar
经久不息|долго не прекращаться|uzoq vaqt tinmaslik
精练|сжатый; лаконичный|ixcham; lo‘nda
经贸|экономика и торговля|iqtisodiyot va savdo
精妙|изысканный; тонкий|nafis; nozik
精明|проницательный; сметливый|ziyrak; fahmli
精疲力竭|совершенно измотанный; обессиленный|butunlay holdan toygan; kuchsizlangan
精巧|изящный; тонкий; искусно сделанный|nafis; nozik; mohirona ishlangan
精神病|психическое расстройство; психическое заболевание|ruhiy buzilish; ruhiy kasallik
经受|пережить; вынести; подвергнуться|boshdan kechirmoq; chidamoq; duch kelmoq
精髓|суть; квинтэссенция|mohiyat; eng muhim qism
惊叹|восхищённо воскликнуть|hayrat bilan xitob qilmoq
惊天动地|потрясающий мир; грандиозный|dunyoni larzaga soladigan; ulkan
精细|тонкий; тщательный; детальный|nozik; puxta; batafsil
惊吓|испугать; напугать|qo‘rqitmoq; cho‘chitmoq
惊险|опасный и захватывающий; напряжённый|xavfli va hayajonli; keskin
惊心动魄|захватывающий дух; потрясающий|yurakni hapriqtiradigan; larzaga soladigan
晶莹|искрящийся и прозрачный|yaltirab turgan va tiniq
精英|элита; лучшие представители|elita; eng saralari
精湛|виртуозный; совершенный; мастерский|yuksak mahoratli; mukammal; mohirona
井底之蛙|человек с узким кругозором; лягушка на дне колодца|dunyoqarashi tor odam; quduq tubidagi qurbaqa
警戒|предупреждать; быть начеку|ogohlantirmoq; hushyor turmoq
警犬|служебная собака; полицейская собака|xizmat iti; politsiya iti
警示|предупреждать; предостерегать|ogohlantirmoq; ehtiyot bo‘lishga chaqirmoq
警钟|тревожный колокол; предупреждение|xavf qo‘ng‘irog‘i; ogohlantirish
竟|неожиданно; вопреки ожиданиям|kutilmaganda; kutilganiga qaramay
敬|уважать; вежливо преподнести|hurmat qilmoq; odob bilan taqdim etmoq
接二连三|один за другим; подряд|ketma-ket; birin-ketin
接班|сменить дежурство; занять чьё-либо место|smenani qabul qilmoq; birovning o‘rnini egallamoq
接班人|преемник; наследник должности|voris; lavozim davomchisi
皆大欢喜|к всеобщей радости и удовлетворению|barchani xursand qiladigan; hammaga ma’qul
街坊|соседство; соседи по району|mahalla; qo‘ni-qo‘shnilar
接轨|соединиться; интегрироваться|tutashmoq; integratsiyalashmoq
阶级|класс; общественный слой|sinf; ijtimoiy qatlam
接济|оказать материальную помощь|moddiy yordam ko‘rsatmoq
接见|принять кого-либо; провести приём|qabul qilmoq; uchrashuv o‘tkazmoq
接力|эстафета; сменять друг друга|estafeta; navbatma-navbat almashtirmoq
接纳|принять в группу; принять|guruhga qabul qilmoq; qabul qilmoq
揭示|раскрыть; выявить|ochib bermoq; aniqlamoq
接手|принять дело; взять на себя|ishni qabul qilib olmoq; zimmasiga olmoq
接替|сменить; заменить|o‘rnini egallamoq; almashtirmoq
阶梯|лестница; ступени|zinapoya; pog‘onalar
揭晓|объявить публично; раскрыть|ommaga e’lon qilmoq; oshkor qilmoq
劫|бедствие; ограбить|falokat; talon-toroj qilmoq
截|отрезать; отсечь; счётное слово для отрезков|kesmoq; uzib olmoq; bo‘laklar uchun hisob so‘zi
洁白|ослепительно белый; чистейший|oppoq; juda toza
劫持|похитить; захватить|o‘g‘irlab ketmoq; garovga olmoq
节俭|бережливый; экономный|tejamkor; iqtisodli
洁净|чистый; опрятный|toza; ozoda
捷径|короткий путь; кратчайший путь|qisqa yo‘l; eng yaqin yo‘l
竭力|изо всех сил; изо всех возможностей|bor kuchi bilan; qo‘lidan kelganicha
节气|солнечный сезон китайского календаря|Xitoy taqvimidagi quyosh mavsumi
截然不同|совершенно разный; резко отличающийся|butunlay boshqacha; keskin farq qiladigan
结识|познакомиться; завести знакомство|tanishmoq; tanishuv orttirmoq
见外|держаться чересчур официально; считать чужим|haddan tashqari rasmiy muomala qilmoq; begona deb bilmoq
间隙|промежуток; перерыв|oraliq; tanaffus
见效|давать результат; приносить эффект|natija bermoq; samara ko‘rsatmoq
间歇|делать паузу; прерывистый; периодический|tanaffus qilmoq; uzlukli; davriy
见证|свидетельствовать; свидетель; доказательство|guvohlik bermoq; guvoh; dalil
健壮|крепкий; здоровый и сильный|baquvvat; sog‘lom va kuchli
姜|имбирь|zanjabil
僵|жёсткий; окоченевший|qotib qolgan; harakatsiz
僵化|закостенеть; стать негибким|qotib qolmoq; moslashuvchanligini yo‘qotmoq
僵局|тупик; безвыходное положение|boshi berk ko‘cha; tang vaziyat
江山|реки и горы; страна (поэт.)|daryolar va tog‘lar; yurt (badiiy)
奖杯|кубок; призовая чаша|kubok; sovrin
讲理|убеждать доводами; быть разумным|dalil bilan ishontirmoq; oqilona bo‘lmoq
奖项|награда; номинация|mukofot; nominatsiya
焦|подгоревший; обугленный|kuygan; qoraygan
交锋|сойтись в поединке; столкнуться|to‘qnashmoq; yuzma-yuz kelmoq
交付|передать; сдать|topshirmoq; topshirib bermoq
娇惯|баловать; изнеживать|erkalatib yubormoq; ayab katta qilmoq
交互|взаимодействие; интерактивный|o‘zaro ta’sir; interaktiv
交集|пересекаться; пересечение|kesishmoq; kesishma
交界|граничить; общая граница|chegaradosh bo‘lmoq; umumiy chegara
交接|передавать; принимать дела|topshirmoq; ishni qabul qilib olmoq
交纳|уплачивать; вносить (плату)|to‘lamoq; (to‘lovni) topshirmoq
胶囊|капсула|kapsula
交情|дружба; личные отношения|do‘stlik; yaqin munosabat
礁石|риф; скала под водой|rif; suv ostidagi qoya
交替|чередоваться; сменять друг друга|almashib turmoq; bir-birining o‘rnini egallamoq
交头接耳|шептаться; говорить друг другу на ухо|shivirlashmoq; quloqqa gapirmoq
交响乐|симфония; симфоническая музыка|simfoniya; simfonik musiqa
郊游|поехать на прогулку за город|shahar tashqarisiga sayrga chiqmoq
焦躁|тревожный; раздражённый|bezovta; asabiy
交织|переплетаться; сплетаться|chirmashmoq; o‘zaro tutashmoq
嚼|жевать|chaynamoq
绞|скручивать; выкручивать|buramoq; siqib buramoq
搅|мешать; беспокоить|aralashtirmoq; bezovta qilmoq
缴|сдавать; передавать; уплачивать|topshirmoq; bermoq; to‘lamoq
脚踏实地|реалистичный; основательный и серьёзный|haqiqiy; puxta va jiddiy
矫正|исправлять; корректировать|to‘g‘rilamoq; tuzatmoq
叫板|бросить вызов; вступить в противостояние|chaqiriq tashlamoq; qarshi chiqmoq
轿车|легковой автомобиль; седан|yengil avtomobil; sedan
叫好|одобрительно аплодировать; приветствовать|olqishlamoq; qarsak bilan ma’qullamoq
较劲|соревноваться; мериться силами|bellashmoq; kuch sinashmoq
教科书|учебник|darslik
教条|догма; доктрина; догматический|aqida; ta’limot; aqidaparast
祭奠|совершать поминальный обряд; поминать умершего|xotirlash marosimini o‘tkazmoq; marhumni yod etmoq
忌妒|ревновать; завидовать|rashk qilmoq; hasad qilmoq
继父|отчим|o‘gay ota
记号|знак; отметка|belgi; nishon
忌口|воздерживаться от определённой пищи; соблюдать диету|ayrim taomlardan tiyilmoq; parhez tutmoq
剂量|доза|doza
继母|мачеха|o‘gay ona
纪念碑|памятник|yodgorlik
纪实|документальный; запись реальных событий|hujjatli; haqiqiy voqealar bayoni
祭祀|приносить жертвы богам или предкам; обряд жертвоприношения|xudolar yoki ajdodlarga qurbonlik keltirmoq; qurbonlik marosimi
绩效|результативность; эффективность работы|ish samaradorligi; natijadorlik
记忆犹新|оставаться свежим в памяти|xotirada hali ham yorqin saqlanmoq
家教|семейное воспитание; частный репетитор|oilaviy tarbiya; xususiy repetitor
佳节|праздник; праздничный день|bayram; bayram kuni
加紧|усилить; ускорить; активизировать|kuchaytirmoq; tezlashtirmoq; jadallashtirmoq
家境|материальное положение семьи|oilaning moddiy ahvoli
嘉年华|карнавал|karnaval
家禽|домашняя птица; птица для разведения|uy parrandasi; boqiladigan parranda
家世|происхождение семьи; семейное положение|oila kelib chiqishi; oilaviy nasl-nasab
家用|для домашнего использования; расходы на хозяйство|uyda foydalanish uchun; uy-ro‘zg‘or xarajatlari
家政|ведение домашнего хозяйства|uy xo‘jaligini yuritish
加之|к тому же; кроме того|bundan tashqari; ustiga-ustak
家族|семья; род; клан|oila; urug‘; sulola
假定|предполагать; допустить|faraz qilmoq; deb qabul qilmoq
假冒|выдавать себя за; подделывать|o‘zini ... deb ko‘rsatmoq; qalbakilashtirmoq
驾|управлять транспортом; классификатор для повозок|transportni boshqarmoq; aravalar uchun hisob so‘zi
架势|поза; стойка; манера держаться|qomat; turish holati; o‘zini tutish uslubi
价位|ценовой диапазон; уровень цен|narx oralig‘i; narx darajasi
驾驭|управлять; вести; овладеть|boshqarmoq; haydamoq; egallamoq
价值观|система ценностей|qadriyatlar tizimi
嫁妆|приданое|sep
架子|полка; важный вид; высокомерие|tokcha; kekkaygan ko‘rinish; manmanlik
兼|совмещать; выполнять одновременно|birga olib bormoq; bir vaqtning o‘zida bajarmoq
煎熬|мучиться; страдать|qiynalmoq; azob chekmoq
监察|надзирать; контролировать|nazorat qilmoq; tekshirib turmoq
肩负|нести на себе; взять на себя ответственность|zimmasiga olmoq; mas’uliyatni ko‘tarmoq
兼顾|учитывать одновременно; соблюдать баланс|bir vaqtning o‘zida hisobga olmoq; muvozanatni saqlamoq
监管|надзирать; осуществлять контроль|nazorat qilmoq; boshqarib turmoq
坚果|орехи|yong‘oqlar
监护|опекать; быть опекуном|vasiylik qilmoq; vasiy bo‘lmoq
监控|наблюдать; контролировать|kuzatmoq; nazorat qilmoq
歼灭|уничтожить; истребить|qirib tashlamoq; yo‘q qilmoq
兼任|совмещать должности|bir necha lavozimni birga egallamoq
兼容|совместимый; совместимость|mos keladigan; muvofiqlik
坚守|твёрдо держаться; стойко защищать|mahkam turmoq; qat’iy himoya qilmoq
艰险|трудный и опасный|qiyin va xavfli
坚信|твёрдо верить|qat’iy ishonmoq
奸诈|коварный; вероломный|makkor; xoin
检察|проверять; проводить надзор|tekshirmoq; nazorat olib bormoq
简称|сокращённое название; сокращённо называться|qisqartirilgan nom; qisqacha atalmoq
简短|краткий; короткий|qisqa; ixcham
减负|снизить нагрузку; облегчить бремя|yukni kamaytirmoq; mas’uliyatni yengillashtirmoq
剪辑|монтировать; редактировать|montaj qilmoq; tahrirlamoq
简洁|лаконичный; краткий и ясный|lo‘nda; qisqa va aniq
简练|сжатый; лаконичный|ixcham; lo‘nda
减免|снизить или отменить (плату/налог)|kamaytirmoq yoki bekor qilmoq (to‘lov/soliqni)
减退|ослабевать; идти на спад|susaymoq; pasaymoq
简易|простой и удобный|sodda va qulay
贱|дешёвый; низкий; презренный|arzon; past; qadrsiz
间断|прерываться; быть прерывистым|uzilib qolmoq; uzlukli bo‘lmoq
见利忘义|забыть о принципах ради выгоды|foyda uchun prinsiplaridan voz kechmoq
健美|здоровый и красивый; фитнес|sog‘lom va chiroyli; fitnes
见仁见智|у каждого своё мнение|har kimning o‘z fikri bor; fikrlar turlicha
鉴赏|ценить; разбираться в искусстве|qadrlamoq; san’atni tushunmoq
见识|знания и кругозор; испытать на собственном опыте|bilim va dunyoqarash; o‘z tajribasida ko‘rmoq
建树|внести вклад; добиться значительных результатов|hissa qo‘shmoq; muhim yutuqlarga erishmoq
基本功|основные навыки; базовая подготовка|asosiy ko‘nikmalar; boshlang‘ich tayyorgarlik
机舱|салон самолёта|samolyot saloni
基层|низовой уровень; базовое звено|quyi pog‘ona; boshlang‘ich bo‘g‘in
激荡|бурно колыхаться; бушевать|jo‘shqin harakatlanmoq; to‘lqinlanmoq
积淀|накопленный слой; накопленный опыт и знания|to‘plangan qatlam; orttirilgan tajriba va bilim
肌肤|кожа; кожный покров|teri; badan terisi
激光|лазер|lazer
激化|обострять; усиливать|keskinlashtirmoq; kuchaytirmoq
激活|активировать; привести в действие|faollashtirmoq; ishga tushirmoq
基建|капитальное строительство; инфраструктурное строительство|kapital qurilish; infratuzilma qurilishi
基金会|фонд; благотворительный фонд|fond; xayriya jamg‘armasi
激起|вызывать; пробуждать (чувство)|uyg‘otmoq; qo‘zg‘atmoq (hisni)
激素|гормон|gormon
畸形|деформированный; аномальный|shakli buzilgan; g‘ayritabiiy
积蓄|копить; сбережения|jamg‘armoq; jamg‘arma
基于|основываться на; исходя из|...ga asoslanmoq; ...dan kelib chiqib
积攒|копить понемногу|oz-ozdan yig‘moq
激增|резко возрастать; стремительно расти|keskin ko‘paymoq; tez sur’atda oshmoq
基准|эталон; критерий; контрольная точка|mezon; andoza; tayanch ko‘rsatkich
即|а именно; то есть|ya’ni; aynan
急促|торопливый; стремительный; учащённый|shoshilinch; tezlashgan; tez-tez
极度|чрезвычайно; крайне|nihoyatda; juda
集会|собираться; собрание; митинг|yig‘ilmoq; yig‘ilish; miting
即可|этого достаточно; и тогда можно|shu yetarli; shunda mumkin
极力|изо всех сил; всеми средствами|bor kuchi bilan; har qanday yo‘l bilan
急迫|срочный; неотложный|shoshilinch; kechiktirib bo‘lmaydigan
汲取|извлекать; черпать|olmoq; o‘zlashtirmoq
即日|в тот же день; в ближайшие дни|shu kunning o‘zida; yaqin kunlarda
即时|немедленно; в реальном времени|darhol; ayni vaqtda
集市|рынок; базар|bozor
棘手|щекотливый; трудный; сложный|nozik; qiyin; murakkab
集思广益|объединить усилия и воспользоваться коллективной мудростью|fikrlarni jamlab, umumiy tajribadan foydalanmoq
吉他|гитара|gitara
吉祥物|талисман; маскот|ramz; maskot
急性|острый; внезапный (о болезни)|o‘tkir; to‘satdan yuzaga keladigan (kasallik)
急于|стремиться; торопиться сделать что-либо|...ga intilmoq; shoshilmoq
急中生智|проявить находчивость в критической ситуации|qiyin vaziyatda topqirlik ko‘rsatmoq
集装箱|контейнер|konteyner
集资|собирать средства; привлекать капитал|mablag‘ yig‘moq; kapital jalb qilmoq
脊梁|позвоночник; хребет; опора|umurtqa; tayanch
挤压|сдавливать; сжимать|siqmoq; bosib siqmoq
计|считать; рассчитывать|hisoblamoq; sanamoq
忌|избегать; воздерживаться|saqlanmoq; tiyilmoq
剂|лекарственное средство; доза лекарства|dori vositasi; dori dozasi
继|продолжать; следовать за|davom ettirmoq; ortidan kelmoq
祭|приносить жертву; совершать жертвоприношение|qurbonlik keltirmoq; qurbonlik marosimini o‘tkazmoq
暨|и; а также|va; shuningdek
继而|затем; после этого|so‘ng; shundan keyin
计策|план; стратегия; хитрый замысел|reja; strategiya; ayyorona tadbir
花纹|узор; рисунок|naqsh; bezak
花样|узор; фасон; разновидность|naqsh; uslub; tur
划不来|невыгодно; не стоит того|foydasiz; bunga arzimaydi
划得来|выгодно; стоит того|foydali; arziydi
滑稽|смешной; комичный|kulgili; hajviy
哗然|поднять шум; вызвать всеобщее возмущение|shov-shuv ko‘tarmoq; umumiy norozilik uyg‘otmoq
划算|выгодный; стоящий своих денег|foydali; puliga arziydigan
滑梯|горка (на детской площадке)|sirpanchiq (bolalar maydonchasida)
画册|альбом с иллюстрациями|rasmli albom
画龙点睛|добавить решающую завершающую деталь|yakunlovchi muhim jihatni qo‘shmoq
化身|воплощение; перевоплотиться|timsol; qiyofasiga kirmoq
划时代|эпохальный; имеющий историческое значение|davrni belgilovchi; tarixiy ahamiyatga ega
化险为夷|превратить опасность в безопасность; благополучно выйти из беды|xavfni bartaraf etmoq; kulfatdan eson-omon chiqmoq
话语|слова; речь|so‘zlar; nutq
怀抱|обнимать; лелеять; объятия|quchoqlamoq; ko‘nglida asramoq; quchoq
怀旧|испытывать ностальгию; ностальгический|sog‘inmoq; o‘tmishni qo‘msash
槐树|софора; дерево софора|sofora daraxti
欢呼|радостно приветствовать; ликовать|xursand bo‘lib olqishlamoq; quvonmoq
欢聚|радостно собраться вместе|xursand bo‘lib jam bo‘lmoq
欢快|весёлый; жизнерадостный|quvnoq; xushchaqchaq
欢声笑语|радостные возгласы и смех|quvonchli qiyqiriqlar va kulgi
环比|сравнение с предыдущим периодом|oldingi davr bilan taqqoslash
环球|вокруг света; всемирный|butun dunyo bo‘ylab; jahon miqyosida
环绕|окружать; обводить вокруг|o‘rab turmoq; aylantirib chiqmoq
缓|медленный; замедлять|sekin; sekinlashtirmoq
焕发|сиять; излучать; оживиться|porlamoq; nur sochmoq; jonlanmoq
幻觉|иллюзия; галлюцинация|xayoliy tasavvur; gallyutsinatsiya
唤起|пробудить; вызвать (чувство/воспоминание)|uyg‘otmoq; (his/xotirani) jonlantirmoq
换取|получить в обмен|evaziga olmoq; almashtirib olmoq
焕然一新|полностью преобразиться; совершенно новый|butunlay yangilanmoq; mutlaqo yangi
唤醒|разбудить; пробудить|uyg‘otmoq; uyg‘otib yubormoq
幻影|призрак; мираж|sharpa; sarob
荒|пустынный; заброшенный; запустить (землю)|kimsasiz; tashlandiq; (yerni) qarovsiz qoldirmoq
荒诞|абсурдный; нелепый|bema’ni; aqlga sig‘maydigan
慌乱|растерянный; суматошный|sarosimaga tushgan; betartib
皇宫|императорский дворец|imperator saroyi
皇上|император (почтительное обращение)|imperator (hurmat bilan murojaat)
皇室|императорская семья; королевский дом|imperator oilasi; qirollik xonadoni
谎话|ложь; неправда|yolg‘on; haqiqatga to‘g‘ri kelmaydigan gap
谎言|ложь; обман|yolg‘on; aldov
好歹|хорошее и плохое; по крайней мере; всё-таки|yaxshi-yomon; hech bo‘lmasa; baribir
好受|чувствовать себя лучше; легче переносить|o‘zini yaxshiroq his qilmoq; yengilroq o‘tkazmoq
好说|легко договориться; без проблем|kelishish oson; muammo yo‘q
好心|доброта; доброе сердце|mehribonlik; yaxshi qalb
好意|доброе намерение; добрая воля|yaxshi niyat; xayrixohlik
好在|к счастью; хорошо, что|yaxshiyamki; baxtga ko‘ra
耗|тратить; расходовать; расточать|sarflamoq; isrof qilmoq
号称|называться; претендовать на звание|deb atalmoq; ... deb da’vo qilmoq
浩瀚|необъятный; безбрежный|behisob; bepoyon
浩劫|катастрофа; бедствие|falokat; kulfat
好胜|стремиться к победе; соревновательный|g‘alabaga intiluvchan; raqobatni yoqtiradigan
耗时|занимать время; отнимать много времени|vaqt olmoq; ko‘p vaqt talab qilmoq
呵护|заботиться; беречь; лелеять|g‘amxo‘rlik qilmoq; asramoq; avaylamoq
核|косточка; ядро плода|danak; meva mag‘zi
核查|проверить; провести инспекцию|tekshirmoq; nazoratdan o‘tkazmoq
合唱|петь хором; хоровое пение|xor bo‘lib kuylamoq; xor qo‘shig‘i
何等|какой; насколько (воскл.)|qanday; naqadar
核电站|атомная электростанция|atom elektr stansiyasi
核对|сверить; проверить|solishtirib tekshirmoq; tekshirmoq
和好|помириться; примирение|yarashmoq; yarashish
荷花|лотос|nilufar; lotus
合计|подсчитать сумму; в общей сложности|jami hisoblamoq; umumiy hisobda
何苦|зачем так мучиться?; к чему лишние хлопоты?|nega shuncha qiynalmoq?; ortiqcha ovora bo‘lishning nima keragi bor?
禾苗|всходы злаков; молодые ростки риса|donli ekin nihollari; yosh sholi ko‘chatlari
核能|ядерная энергия|yadro energiyasi
河畔|берег реки; прибрежье|daryo bo‘yi; qirg‘oq
和平共处|мирно сосуществовать|tinch-totuv yashamoq
和尚|буддийский монах|buddaviy rohib
核实|проверить; подтвердить достоверность|tekshirib tasdiqlamoq; aniqligini tekshirmoq
核桃|грецкий орех|grek yong‘og‘i
核武器|ядерное оружие|yadro quroli
何止|не только; гораздо больше, чем|nafaqat; ...dan ancha ortiq
合资|совместно инвестировать; совместное предприятие|birgalikda sarmoya kiritmoq; qo‘shma korxona
喝彩|аплодировать; одобрительно кричать|olqishlamoq; qarsak chalmoq
贺电|поздравительная телеграмма|tabrik telegrammasi
鹤立鸡群|выделяться на фоне остальных; быть явно лучше|boshqalardan yaqqol ajralib turmoq; hammadan ustun bo‘lmoq
赫然|поразительный; бросающийся в глаза; шокирующий|hayratlanarli; ko‘zga yaqqol tashlanadigan; dahshatli
贺信|поздравительное письмо|tabrik xati
惯性|инерция|inersiya
光顾|посетить; зайти (вежлив.)|tashrif buyurmoq; kirib o‘tmoq (hurmat shakli)
光环|ореол; нимб|nur halqasi; gardish
光缆|оптоволоконный кабель|optik tolali kabel
光明磊落|открытый и честный; прямой|ochiqko‘ngil va halol; to‘g‘riso‘z
光泽|блеск; глянец|jilo; yaltiroqlik
广义|широкое значение; в широком смысле|keng ma’no; keng ma’noda
龟|черепаха|toshbaqa
瑰宝|драгоценность; сокровище|bebaho boylik; xazina
归结|подвести итог; свести к|xulosa qilmoq; ...ga borib taqalmoq
归来|вернуться; возвратиться|qaytib kelmoq; qaytmoq
闺女|дочь (разг.)|qiz farzand; qizim (so‘zlashuvda)
归属|принадлежать; принадлежность|tegishli bo‘lmoq; mansublik
归宿|конечное пристанище; место, куда возвращаются|so‘nggi manzil; qaytib boriladigan joy
归于|относиться к; быть отнесённым к|tegishli bo‘lmoq; ...ga taalluqli bo‘lmoq
轨迹|траектория; путь|trayektoriya; yo‘l
诡计|хитрость; уловка|hiyla; nayrang
贵宾|почётный гость; VIP|faxriy mehmon; VIP
桂花|цветы османтуса|osmantus gullari
滚动|катиться; перекатываться|dumalanmoq; yumalamoq
国徽|государственный герб|davlat gerbi
国土|территория страны; государственная земля|mamlakat hududi; davlat yerlari
国学|традиционная китайская учёность; классические китайские науки|an’anaviy xitoy ilmi; mumtoz xitoyshunoslik
航运|морские и речные перевозки; судоходство|dengiz va daryo yuk tashuvi; kema qatnovi
好比|быть подобным; словно|o‘xshamoq; xuddi ...dek
供需|спрос и предложение|talab va taklif
供养|содержать; обеспечивать родителей|boqmoq; ota-onasini ta’minlamoq
供应链|цепочка поставок|ta’minot zanjiri
公用|общественный; общий|jamoatga oid; umumiy
公约|конвенция; соглашение|konvensiya; bitim
工整|аккуратный; тщательно выполненный|ozoda; puxta bajarilgan
公职|государственная служба; государственная должность|davlat xizmati; davlat lavozimi
拱|сложить руки в приветственном жесте|qo‘llarni qovushtirib salom bermoq
供奉|поклоняться; приносить подношения|sig‘inmoq; nazr keltirmoq
共识|общее понимание; консенсус|umumiy tushuncha; konsensus
观感|впечатление; впечатления от увиденного|taassurot; ko‘rganidan olgan taassurot
关节|сустав; ключевой момент|bo‘g‘im; muhim nuqta
官吏|чиновник; государственный служащий|amaldor; davlat xizmatchisi
官僚|бюрократ; бюрократический|byurokrat; byurokratik
观摩|наблюдать и перенимать опыт|kuzatib o‘rganmoq; tajriba almashmoq
关切|проявлять заботу; беспокоиться|g‘amxo‘rlik ko‘rsatmoq; xavotirlanmoq
关税|таможенная пошлина|bojxona boji
关头|решающий момент; критическая точка|hal qiluvchi payt; muhim palla
观望|занять выжидательную позицию|kuzatib turmoq; kutish holatida bo‘lmoq
管家|дворецкий; управляющий домом|uy boshqaruvchisi; uy xizmatchisi
管教|воспитывать; дисциплинировать|tarbiyalamoq; tartibga o‘rgatmoq
管用|действенный; полезный|foydali; samara beradigan
惯|привыкнуть; избаловать|ko‘nikmoq; erkalatib yubormoq
灌|поливать; орошать; вливать|sug‘ormoq; quyib to‘ldirmoq
贯穿|проходить через; пронизывать|kesib o‘tmoq; boshidan oxirigacha qamrab olmoq
灌输|внушать; прививать (идеи)|singdirmoq; ongiga joylamoq
贯通|соединять; проходить насквозь|birlashtirmoq; butunlay kesib o‘tmoq
哽咽|задыхаться от волнения; всхлипывать|hayajondan ovozi bo‘g‘ilmoq; hiqillab yig‘lamoq
耿直|прямой; честный; откровенный|to‘g‘riso‘z; halol; ochiqko‘ngil
弓|лук|kamon
功|достижение; заслуга; работа (физ.)|yutuq; xizmat; ish (fizikada)
攻|атаковать; нападать|hujum qilmoq
供|предоставлять; снабжать|ta’minlamoq; yetkazib bermoq
公办|государственный; муниципальный|davlatga qarashli; davlat tomonidan boshqariladigan
功臣|заслуженный деятель; герой; главный участник успеха|xizmat ko‘rsatgan kishi; qahramon; muvaffaqiyatga katta hissa qo‘shgan odam
功底|базовая подготовка; владение основами|asosiy tayyorgarlik; poydevor ko‘nikmalar
攻读|изучать специальность; получать учёную степень|mutaxassislik bo‘yicha o‘qimoq; ilmiy daraja olmoq
公费|за государственный счёт|davlat hisobidan
攻关|решить ключевую проблему; преодолеть трудность|muhim muammoni hal qilmoq; qiyinchilikni yengmoq
工会|профсоюз|kasaba uyushmasi
工匠|ремесленник; мастер|hunarmand; usta
工科|инженерные науки; техническая специальность|muhandislik fanlari; texnik mutaxassislik
公款|государственные/общественные средства|davlat mablag‘i; jamoat puli
公立|государственный; общественный|davlatga qarashli; jamoat
功力|мастерство; умение|mahorat; uquv
功利|практическая польза; материальная выгода|amaliy foyda; moddiy manfaat
功率|мощность|quvvat
公墓|общественное кладбище|jamoat qabristoni
供暖|обеспечивать отопление|isitish bilan ta’minlamoq
公仆|государственный служащий; общественный деятель|davlat xizmatchisi; xalq xizmatkori
公顷|гектар|gektar
供求|спрос и предложение|talab va taklif
公示|обнародовать; официально объявить|oshkor qilmoq; rasman e’lon qilmoq
公事|служебные дела; официальные обязанности|xizmat ishlari; rasmiy vazifalar
攻势|наступление; атака|hujum; hujumkor harakat
宫廷|императорский двор; дворцовый|imperator saroyi; saroyga oid
恭维|льстить; делать комплимент|xushomad qilmoq; maqtov aytmoq
浮力|плавучесть; выталкивающая сила|suzish kuchi; ko‘taruvchi kuch
服饰|одежда и украшения; одеяние|kiyim-kechak va bezaklar; libos
服务器|сервер|server
浮现|всплывать; возникать в сознании|xayolga kelmoq; ko‘z oldida gavdalanmoq
浮躁|легкомысленный и нетерпеливый; суетливый|yengiltak va sabrsiz; betoqat
俯首|склонить голову; подчиниться|bosh egmoq; bo‘ysunmoq
抚恤|выплатить пособие семье погибшего|halok bo‘lgan kishining oilasiga nafaqa bermoq
斧子|топор|bolta
附|прикреплять; прилагать|biriktirmoq; ilova qilmoq
赴|направляться; отправляться|yo‘l olmoq; bormoq
腹|живот; брюшная полость|qorin; qorin bo‘shlig‘i
副本|копия; подземелье в компьютерной игре|nusxa; kompyuter o‘yinidagi zindon
复查|повторно проверить; повторное обследование|qayta tekshirmoq; takroriy ko‘rik
附带|дополнительный; сопутствующий|qo‘shimcha; birga keladigan
复发|возобновиться; рецидивировать|qaytalanmoq; yana avj olmoq
富含|содержать в большом количестве|ko‘p miqdorda saqlamoq
富豪|богач; состоятельный и влиятельный человек|boy-badavlat va nufuzli kishi
复合|соединить; составной; помириться|birlashtirmoq; qo‘shma; yarashmoq
附加|добавочный; прилагать дополнительно|qo‘shimcha; qo‘shimcha ravishda biriktirmoq
富强|богатый и могущественный|boy va qudratli
富翁|богач; состоятельный человек|badavlat kishi; boy
复原|восстановить; выздороветь|tiklamoq; sog‘aymoq
负重|нести тяжёлую ношу|og‘ir yuk ko‘tarmoq
富足|зажиточный; достаток|to‘q yashaydigan; farovonlik
改版|переработать текущее издание; обновить версию|joriy nashrni qayta ishlamoq; versiyani yangilamoq
改动|изменить; внести поправку|o‘zgartirmoq; tuzatish kiritmoq
改观|измениться внешне; пересмотреть взгляд|ko‘rinishi o‘zgarmoq; fikrini qayta ko‘rib chiqmoq
改日|в другой день; как-нибудь позже|boshqa kuni; keyinroq
改邪归正|исправиться; встать на правильный путь|yomon yo‘ldan qaytmoq; to‘g‘ri yo‘lga tushmoq
概|в общем; в целом; без исключения|umuman; umumiy holda; istisnosiz
概况|общая ситуация; краткий обзор|umumiy vaziyat; qisqacha ma’lumot
概论|общий обзор; очерк|umumiy sharh; qisqacha bayon
干戈|оружие; война; вооружённая борьба|qurol-yarog‘; urush; qurolli kurash
干枯|засохший; высохнуть|qurib qolgan; qurimoq
感触|переживания и мысли; впечатление|his-kechinmalar va fikrlar; taassurot
感恩|быть благодарным|minnatdor bo‘lmoq
赶赴|поспешить; срочно отправиться|shoshilmoq; zudlik bilan yo‘l olmoq
感叹|вздыхать с чувством; сожалеть|his bilan xo‘rsinmoq; afsuslanmoq
感悟|осознать; прийти к пониманию|anglab yetmoq; tushunib olmoq
感性|чувственный; эмоциональный|hissiy; tuyg‘uga asoslangan
房地产|недвижимость; рынок недвижимости|ko‘chmas mulk; ko‘chmas mulk bozori
防护|защищать; защита|himoya qilmoq; himoya
防火墙|межсетевой экран; брандмауэр|tarmoqlararo ekran; xavfsizlik devori
防卫|защищаться; обороняться|himoyalanmoq; mudofaa qilmoq
防汛|борьба с наводнениями; защита от паводков|suv toshqiniga qarshi kurash; toshqindan himoya
仿|подражать; имитировать|taqlid qilmoq; o‘xshatmoq
仿真|моделировать; симуляция|modellashtirmoq; simulyatsiya
仿制|копировать; изготовить по образцу|nusxa ko‘chirmoq; namunaga qarab yasamoq
放过|пощадить; отпустить; простить|ayamoq; qo‘yib yubormoq; kechirmoq
放宽|ослабить; смягчить требования|yengillashtirmoq; talablarni yumshatmoq
放水|спустить воду; намеренно проиграть матч|suvni oqizib yubormoq; ataylab yutqazmoq
放肆|безудержный; дерзкий; наглый|tiyib bo‘lmaydigan; surbet; beadab
放映|показывать фильм; проецировать|film namoyish qilmoq; proyeksiya qilmoq
放置|положить; разместить|qo‘ymoq; joylashtirmoq
放纵|потворствовать; распускать; давать волю|erk bermoq; o‘z holiga tashlab qo‘ymoq
非但|не только|nafaqat
非得|обязательно; непременно|albatta; shart
飞碟|летающая тарелка|uchar likopcha
非凡|необыкновенный; выдающийся|g‘ayrioddiy; ajoyib
绯闻|скандальная любовная связь; пикантный слух|shov-shuvli ishqiy mojaro; mish-mish
肥料|удобрение|o‘g‘it
废|отменить; упразднить|bekor qilmoq; tugatmoq
沸沸扬扬|быть на слуху; шумно обсуждаться|hammaning og‘zida bo‘lmoq; shovqin bilan muhokama qilinmoq
费劲|требовать усилий; быть трудным|ko‘p kuch talab qilmoq; qiyin bo‘lmoq
费力|затрачивать много сил; трудоёмкий|ko‘p kuch sarflamoq; mehnattalab
废品|лом; бракованная продукция; отходы|temir-tersak; nuqsonli mahsulot; chiqindi
废弃|выбросить; отказаться от; забросить|tashlab yubormoq; voz kechmoq
废物|мусор; отходы|chiqindi; keraksiz narsa
分担|делить; разделять (обязанности/тяготы)|bo‘lishmoq; (vazifa/yukni) taqsimlamoq
分发|раздавать; распространять|tarqatmoq; ulashmoq
芬芳|ароматный; благоухание|xushbo‘y; yoqimli hid
分割|разделить; разрезать на части|bo‘lmoq; qismlarga ajratmoq
分化|расщепляться; разделяться|bo‘linmoq; ajralmoq
分支|ветвь; филиал; ответвление|tarmoq; bo‘lim; irmoq
坟|могила; могильный холм|qabr; mozor
焚烧|сжигать; сжечь|yoqib yubormoq; kuydirmoq
粉丝|вермишель из бобов мунг|mosh kraxmalidan tayyorlangan vermishel
粪|навоз; помёт|go‘ng; tezak
敦厚|искренний и добрый; честный|samimiy va mehribon; halol
炖|тушить; долго варить на медленном огне|dimlab pishirmoq; past olovda uzoq qaynatmoq
多年来|на протяжении многих лет|ko‘p yillar davomida
多边|многосторонний|ko‘p tomonlama
多心|слишком подозрительный; мнительный|ortiqcha shubhalanuvchi; ko‘ngli nozik
夺冠|стать чемпионом; завоевать чемпионство|chempion bo‘lmoq; chempionlikni qo‘lga kiritmoq
夺魁|занять первое место; одержать победу|birinchi o‘rinni egallamoq; g‘alaba qozonmoq
鹅|гусь|g‘oz
额度|лимит; квота|limit; kvota
讹诈|вымогать; шантажировать|tovlamachilik qilmoq; shantaj qilmoq
恶|злой; дурной|yovuz; yomon
噩耗|печальная весть; известие о чьей-либо смерти|qayg‘uli xabar; birovning vafoti haqidagi xabar
恶性|злокачественный; вредоносный|xavfli; yomon sifatli (kasallik/shish)
恶意|злой умысел; злонамеренность|yomon niyat; g‘araz
鳄鱼|крокодил; аллигатор|timsoh
厄运|несчастье; злой рок|baxtsizlik; qora taqdir
恶作剧|розыгрыш; проказа|hazil; sho‘xlik
恩爱|нежные и любящие отношения (между супругами)|er-xotin o‘rtasidagi mehr-muhabbat
防盗|защита от кражи; предотвращать кражи|o‘g‘irlikdan himoya; o‘g‘irlikning oldini olish
掉头|развернуться; сделать разворот|orqaga burilmoq; qayrilib olmoq
吊销|аннулировать; отозвать (лицензию/разрешение)|bekor qilmoq; qaytarib olmoq (litsenziya/ruxsatnomani)
爹|папа; отец|dada; ota
独|один; в одиночестве|yolg‘iz; bir o‘zi
独家|эксклюзивный; единственный в своём роде|eksklyuziv; faqat bir manbaga tegishli
独身|холостой/незамужняя; жить одному|bo‘ydoq; yolg‘iz yashamoq
读物|материал для чтения; книга для чтения|o‘qish materiali; mutolaa uchun kitob
独一无二|единственный в своём роде; уникальный|yagona; betakror
短暂|кратковременный; недолгий|qisqa muddatli; oz vaqt davom etadigan
断裂|разломаться; треснуть|sinmoq; yorilmoq
段落|абзац; отрывок|xatboshi; parcha
断然|решительно; категорически|qat’iy ravishda; keskin
断章取义|выхватить слова из контекста|gapni kontekstdan uzib olmoq
堆砌|нагромождать; перенасыщать (текст)|uyib tashlamoq; matnni ortiqcha bezamoq
兑|обменивать; разменивать|almashtirmoq; mayda pulga almashtirmoq
对岸|противоположный берег|qarshi qirg‘oq
对白|диалог; реплики персонажей|dialog; qahramonlar suhbati
对得起|оправдать; быть достойным доверия; не подвести|ishonchni oqlamoq; pand bermaslik
对流|конвекция; конвективное движение|konveksiya; issiqlik oqimi
对牛弹琴|говорить не тому, кто способен понять|tushunmaydigan odamga gapirmoq
队形|строй; построение|saf; tizilish
对弈|играть в го или шахматы|go yoki shaxmat o‘ynamoq
对症下药|назначить подходящее лечение; принять верные меры|mos davo qo‘llamoq; to‘g‘ri chora ko‘rmoq
对峙|стоять друг против друга; противостоять|qarama-qarshi turmoq; yuzma-yuz turmoq
敦促|настойчиво побуждать; призывать|qat’iy undamoq; da’vat qilmoq
底层|нижний этаж; нижний слой|pastki qavat; quyi qatlam
抵触|противоречить; вступать в конфликт|zid kelmoq; qarama-qarshilikka kirishmoq
抵挡|сопротивляться; сдерживать|qarshilik ko‘rsatmoq; to‘smoq
底线|нижний предел; крайняя граница|eng quyi chegara; so‘nggi chiziq
抵消|компенсировать; свести на нет|qoplamoq; ta’sirini yo‘qqa chiqarmoq
抵押|заложить; дать в залог|garovga qo‘ymoq
抵御|отражать; противостоять|qarshi turmoq; himoyalanmoq
底蕴|глубинное содержание; культурная основа|ichki mazmun; madaniy asos
底子|основа; фундамент; исходный уровень|asos; poydevor; boshlang‘ich daraja
地段|район; участок местности|hudud; joy
帝国|империя|imperiya
递交|передать; подать (документ)|topshirmoq; taqdim etmoq (hujjat)
地下水|подземные воды|yerosti suvlari
第一手|из первых рук; непосредственный|bevosita olingan; birinchi qo‘ldan
地狱|ад|do‘zax
弟子|ученик; последователь; ученик мастера|shogird; izdosh
颠倒黑白|искажать правду; выдавать чёрное за белое|haqiqatni buzib ko‘rsatmoq; oqni qora demoq
巅峰|вершина; пик|cho‘qqi; eng yuqori nuqta
颠覆|свергнуть; опрокинуть; перевернуть|ag‘darmoq; tubdan o‘zgartirmoq
典范|образец; пример для подражания|namuna; ibrat
点火|зажечь; поджечь|yoqmoq; o‘t qo‘ymoq
点评|комментировать; краткий отзыв|izoh bermoq; qisqa sharh
点子|идея; точка|g‘oya; nuqta
垫底|занять последнее место; перекусить заранее|oxirgi o‘rinni egallamoq; oldindan yengil tamaddi qilmoq
淀粉|крахмал|kraxmal
殿堂|дворец; величественный зал|saroy; muhtasham zal
电网|электросеть|elektr tarmog‘i
电线|электрический провод|elektr simi
电信|телекоммуникации; связь|telekommunikatsiya; aloqa
电讯|телекоммуникации; телефонная/телеграфная связь|telekommunikatsiya; telefon-telegraf aloqasi
垫子|подстилка; подушка|to‘shama; yostiqcha
刁难|умышленно затруднять; придираться|ataylab qiyinchilik tug‘dirmoq; tirnoq ostidan kir qidirmoq
雕像|скульптура; статуя|haykal; haykaltaroshlik asari
凋谢|увядать; отцветать|so‘lmoq; gullashdan qolmoq
调度|диспетчеризировать; распределять ресурсы|dispetcherlik qilmoq; resurslarni taqsimlamoq
掉队|отстать; выпасть из группы|ortda qolmoq; guruhdan ajralib qolmoq
大同小异|почти одинаковый; отличаться лишь в мелочах|deyarli bir xil; mayda jihatlarda farq qilmoq
大为|весьма; значительно|juda; ancha
大雁|дикий гусь|yovvoyi g‘oz
大有可为|иметь большие перспективы; быть многообещающим|katta istiqbolga ega bo‘lmoq; umidli bo‘lmoq
大宗|крупная партия; большой объём|katta partiya; yirik hajm
带队|руководить группой; вести команду|guruhga boshchilik qilmoq; jamoani yetaklamoq
怠工|умышленно работать спустя рукава; саботировать работу|ishni ataylab sustlashtirmoq; ish sur’atini pasaytirmoq
代号|кодовое имя; условное обозначение|kod nomi; shartli belgi
代理人|представитель; агент|vakil; agent
带路|показать дорогу; провести|yo‘l ko‘rsatmoq; boshlab bormoq
带头|возглавить; подать пример|bosh bo‘lmoq; namuna ko‘rsatmoq
代言|выступать представителем; рекламировать от чьего-либо имени|vakil sifatida chiqmoq; reklama qilmoq
单边|односторонний|bir tomonlama
单薄|тонкий; хрупкий; слабый|yupqa; nimjon; zaif
担当|взять на себя ответственность|mas’uliyatni o‘z zimmasiga olmoq
单方面|односторонний; с одной стороны|bir tomonlama; faqat bir tarafdan
担负|нести; брать на себя (обязанности)|zimmasiga olmoq; ko‘tarmoq (mas’uliyatni)
耽搁|задержать; отсрочить|kechiktirmoq; ushlab qolmoq
单价|цена за единицу|bir dona narxi; birlik narxi
单身|не состоящий в браке; одинокий|bo‘ydoq; turmush qurmagan
胆量|смелость; храбрость|jasorat; dadillik
淡化|ослабить; сделать менее заметным|susaytirmoq; ahamiyatini kamaytirmoq
但愿|хотелось бы; если бы только|qaniydi; umid qilamanki
担子|груз на коромысле; ноша; бремя|yelkadagi yuk; mas’uliyat; tashvish
当即|немедленно; сразу же|darhol; shu zahoti
当机立断|решительно и быстро принять решение|tez va qat’iy qaror qabul qilmoq
当日|в тот же день; в этот день|o‘sha kuni; shu kuni
"""
for _line in _DRAFT_ROWS.strip().splitlines():
    _headword, _ru, _uz = _line.split("|", 2)
    AI_DRAFTS[_headword] = (_ru, _uz)

AI_DRAFTS_BY_GLOSS = {
    ("麻", "má", "numb or tingling; rough and coarse"): ("онемевший; шероховатый; грубый", "uvishgan; dag‘al; qo‘pol"),
    ("麻", "má", "hemp"): ("конопля; пенька", "kanop; kanop tolasi"),
    ("码", "mǎ", "measure word for matters; yard; size (of clothing)"): ("код; ярд; размер одежды", "kod; yard; kiyim o‘lchami"),
    ("码", "mǎ", "to stack; to pile up"): ("складывать стопкой; штабелировать", "ustma-ust taxlamoq; uyib qo‘ymoq"),
    ("自负", "zìfù", "to take sole responsibility; to think highly of oneself"): ("брать на себя ответственность; быть самоуверенным", "mas’uliyatni o‘z zimmasiga olmoq; o‘ziga ishongan"),
    ("自负", "zìfù", "conceited"): ("самонадеянный; заносчивый", "o‘ziga bino qo‘ygan; manman"),
}

AI_DRAFTS_BY_READING = {
    ("缝", "féng"): ("шить; зашивать", "tikmoq; chok solmoq"),
    ("缝", "fèng"): ("шов; стык", "chok; tutashgan joy"),
    ("揣", "chuāi"): ("засунуть; положить в карман или пазуху", "solmoq; cho‘ntak yoki qo‘yniga qo‘ymoq"),
    ("闷", "mēn"): ("душный; спертый (о воздухе)", "dim; bo‘g‘iq (havo haqida)"),
    ("闷", "mèn"): ("скучающий; подавленный", "zerikkan; dili siqilgan"),
    ("呛", "qiāng"): ("поперхнуться; закашляться", "tiqilib qolmoq; yo‘talib yubormoq"),
    ("呛", "qiàng"): ("раздражать; вызывать удушье (о дыме/парах)", "achishtirmoq; bo‘g‘moq (tutun yoki bug‘)"),
    ("担", "dān"): ("взять на себя; нести (обязанности)", "zimmasiga olmoq; ko‘tarmoq (vazifani)"),
    ("担", "dàn"): ("дань (мера веса, около 50 кг); груз на коромысле", "dan (taxminan 50 kg og‘irlik o‘lchovi); yelkadagi yuk"),
}

# A few exact-reading source matches conflict with the English gloss. Keep the
# corrected meaning as a visible draft rather than silently inheriting it.
AI_CORRECTIONS_BY_READING = {
    ("港", "gǎng"): ("порт; гавань", "bandargoh; port"),
    ("筹", "chóu"): ("планировать; изыскивать средства", "rejalashtirmoq; mablag‘ topmoq"),
    ("坝", "bà"): ("плотина; дамба", "to‘g‘on; damba"),
    ("钉", "dìng"): ("забивать гвоздь", "mix qoqmoq"),
    ("缝", "fèng"): ("шов; стык", "chok; tutashgan joy"),
    ("豁", "huō"): ("рискнуть всем; пожертвовать; прорезать", "hammasini tikmoq; qurbon qilmoq; yorib ochmoq"),
    ("创", "chuàng"): ("создавать; основывать", "yaratmoq; asos solmoq"),
    ("担", "dàn"): ("дан (мера веса, около 50 кг); груз на коромысле", "dan (taxminan 50 kg og‘irlik o‘lchovi); yelkadagi yuk"),
    ("斗", "dòu"): ("драться; бороться", "urishmoq; kurashmoq"),
    ("充", "chōng"): ("наполнять; служить в качестве", "to‘ldirmoq; vazifasini bajarmoq"),
    ("订金", "dìngjīn"): ("задаток; предоплата", "bo‘nak; oldindan to‘lov"),
    ("勾", "gōu"): ("привлекать; ставить галочку; вычёркивать", "jalb qilmoq; belgi qo‘ymoq; ustidan chizmoq"),
    ("故", "gù"): ("причина; поэтому", "sabab; shu bois; demak"),
    ("惯", "guàn"): ("привыкший; баловать", "ko‘nikkan; erkalatmoq"),
    ("海量", "hǎiliàng"): ("огромное количество; щедрость; способность много выпить", "juda katta miqdor; saxovat; ko‘p ichimlik ko‘tara olish"),
    ("轰", "hōng"): ("грохотеть; греметь; прогнать", "gumburlamoq; gursillatmoq; haydab yubormoq"),
    ("晃", "huǎng"): ("ослеплять; мелькнуть перед глазами", "ko‘zni qamashtirmoq; lip etib ko‘rinmoq"),
    ("晃", "huàng"): ("качаться; раскачиваться", "tebranmoq; chayqalmoq"),
    ("滑梯", "huátī"): ("горка (на детской площадке)", "bolalar sirpanchig‘i"),
    ("继", "jì"): ("продолжать; следовать за", "davom ettirmoq; ortidan kelmoq"),
    ("积淀", "jīdiàn"): ("накопленные отложения; накопленный опыт и знания", "to‘plangan qatlam; orttirilgan tajriba va bilim"),
    ("急促", "jícù"): ("торопливый; стремительный; учащённый", "shoshilinch; shiddatli; tezlashgan"),
    ("经", "jīng", "to pass through"): ("проходить через; пересекать", "orqali o‘tmoq; kesib o‘tmoq"),
    ("劫", "jié", "a calamity; to rob"): ("бедствие; грабить", "falokat; talon-taroj qilmoq"),
    ("脚踏实地", "jiǎotāshídì", "realistic; steady and serious"): ("практичный; основательный и серьёзный", "amaliy; puxta va jiddiy"),
    ("竭力", "jiélì", "with all one's might; to the utmost"): ("изо всех сил; всеми возможными средствами", "bor kuchi bilan; qo‘lidan kelganicha"),
    ("抠", "kōu", "to pick; stingy"): ("ковырять; выковыривать; скупой", "kovlamoq; ziqna"),
    ("揽", "lǎn"): ("взять на себя; обнять", "zimmasiga olmoq; quchoqlamoq"),
    ("拉链", "lāliàn"): ("молния (застёжка); застёжка-молния", "fermuar; kiyim zamogi"),
    ("勒", "lēi"): ("затянуть ремнём; туго стянуть", "mahkam bog‘lamoq; kamar bilan siqmoq"),
    ("闷", "mèn"): ("скучающий; подавленный", "zerikkan; dili siqilgan"),
    ("灵", "líng"): ("ловкий; действенный; дух", "chaqqon; samarali; ruh"),
    ("漫", "màn"): ("затоплять; переполняться; разливаться", "suv bosmoq; toshib ketmoq"),
    ("拟", "nǐ"): ("составлять проект; подражать", "loyiha tuzmoq; taqlid qilmoq"),
    ("抹", "mǒ"): ("намазывать; размазывать; счётное слово для цветных мазков", "surkamoq; surtmoq; rangli chiziq uchun hisob so‘zi"),
    ("幕", "mù"): ("занавес; экран; акт пьесы", "parda; ekran; pyesa akti"),
    ("刨", "páo"): ("копать; раскапывать", "qazimoq; kovlamoq"),
    ("呛", "qiàng"): ("щипать; вызывать кашель и удушье (о дыме или парах)", "achishtirmoq; bo‘g‘moq (tutun yoki bug‘)"),
    ("腔", "qiāng", "cavity; tune"): ("полость; мелодия; интонация", "bo‘shliq; kuy; ohang"),
    ("筛", "shāi"): ("сито; просеивать", "elak; elamoq"),
    ("纱", "shā"): ("пряжа; марля; муслин", "ip; doka; muslin mato"),
    ("世故", "shìgu"): ("опытный; умудрённый жизнью", "tajribali; hayot ko‘rgan"),
    ("素", "sù"): ("простой; вегетарианский; элемент", "oddiy; go‘shtsiz; unsur"),
    ("摊", "tān"): ("раскладывать; счётное слово для луж и торговых лотков", "yoymoq; ko‘lmak va savdo rastalari uchun hisob so‘zi"),
    ("坛", "tán"): ("алтарь; помост; круг (в определённой сфере)", "mehrob; supa; (sohadagi) davra"),
    ("顺理成章", "shùnlǐ-chéngzhāng"): ("логично вытекающий; закономерный", "mantiqan kelib chiqadigan; tabiiy ravishda yuz beradigan"),
    ("顺势", "shùnshì"): ("пользуясь общей тенденцией; попутно", "vaziyatga mos ravishda; fursatdan foydalanib"),
    ("帖子", "tiězi"): ("карточка; приглашение; публикация в интернете", "taklifnoma; qog‘oz kartochka; internetdagi post"),
    ("条例", "tiáolì"): ("правила; постановление; нормативный документ", "nizom; qoida; me’yoriy hujjat"),
    ("席", "xí"): ("циновка; место; банкет; счётное слово для банкетов", "bo‘yra; o‘rin; ziyofat; ziyofatlar uchun hisob so‘zi"),
    ("陷", "xiàn"): ("застрять; провалиться; утонуть", "botib qolmoq; tiqilib qolmoq"),
    ("消", "xiāo"): ("утихать; исчезать; устранять", "tarqalmoq; yo‘qolmoq; bartaraf etmoq"),
    ("销", "xiāo"): ("продавать; сбывать; аннулировать", "sotmoq; bekor qilmoq"),
    ("仙鹤", "xiānhè"): ("краснокоронный журавль; японский журавль", "qizil tojli turna"),
    ("折射", "zhéshè"): ("преломлять (свет)", "nurni sindirmoq"),
    ("真心", "zhēnxīn"): ("искренность; от всего сердца", "chin dildan; samimiylik"),
    ("致", "zhì"): ("посылать; вызывать", "yubormoq; sabab bo‘lmoq"),
    ("置", "zhì"): ("размещать; помещать; покупать", "joylashtirmoq; sotib olmoq"),
    ("中止", "zhōngzhǐ"): ("приостанавливать; прерывать; прекращать", "vaqtincha to‘xtatmoq; uzib qo‘ymoq; davom ettirmaslik"),
    ("皱", "zhòu"): ("морщить; морщиться; сморщиваться", "burishtirmoq; burishmoq; ajin tushmoq"),
    ("注", "zhù"): ("сосредоточивать; вливать; вносить", "diqqatni jamlamoq; quymoq; kiritmoq"),
    ("筑", "zhù"): ("строить; возводить", "qurmoq; bunyod etmoq"),
    ("宗", "zōng"): ("счётное слово для дел, случаев и сделок", "holatlar va bitimlar uchun hisob so‘zi"),
    ("好不", "hǎobù"): ("вовсе не; чрезвычайно; очень (в зависимости от контекста)", "umuman ... emas; nihoyatda; juda (kontekstga qarab)"),
    ("大幅", "dàfú"): ("крупного формата; значительно", "yirik formatli; sezilarli darajada"),
    ("煲", "bāo"): ("кастрюля для медленного приготовления; томить на медленном огне", "qozon; past olovda dimlab pishirmoq"),
    ("下线", "xiàxiàn"): ("выйти из сети; сойти с производственной линии", "tarmoqdan chiqmoq; ishlab chiqarish liniyasidan tushmoq"),
    ("拨", "bō"): ("отодвигать; перемещать; счётное слово для групп людей", "surmoq; siljitmoq; odamlar guruhi uchun hisob so‘zi"),
    ("插曲", "chāqǔ"): ("музыкальная вставка; эпизод; побочное событие", "musiqiy tanaffus; epizod; qo‘shimcha voqea"),
    ("查明", "chámíng"): ("выяснить; установить после расследования", "tekshirib aniqlamoq; aniqlab olmoq"),
    ("扯", "chě"): ("тянуть; рвать; менять тему разговора", "tortmoq; yirtmoq; mavzuni o‘zgartirmoq"),
    ("押", "yā"): ("закладывать; задерживать; конвоировать под охраной", "garovga qo‘ymoq; hibsga olmoq; qo‘riqlab olib bormoq"),
    ("哑", "yǎ"): ("немой; охрипший", "soqov; ovozi bo‘g‘iq"),
    ("咽", "yàn"): ("глотать", "yutmoq"),
    ("扬", "yáng"): ("поднимать; вздымать", "ko‘tarmoq; ko‘tarib chiqmoq"),
    ("训", "xùn"): ("делать выговор; обучать", "tanbeh bermoq; o‘rgatmoq"),
    ("要强", "yàoqiáng"): ("стремиться к успеху; честолюбивый", "muvaffaqiyatga intiluvchan; o‘zini ko‘rsatishga intilmoq"),
    ("余", "yú"): ("излишек; остаток", "ortiqcha; qolgan qismi"),
    ("涌", "yǒng"): ("хлынуть; бить ключом", "otilib chiqmoq; oqib kelmoq"),
    ("盏", "zhǎn"): ("счётное слово для ламп", "chiroq uchun hisob so‘zi"),
}

AI_CORRECTIONS_BY_GLOSS = {
    ("麻", "má", "numb or tingling; rough and coarse"): ("онемевший; шероховатый; грубый", "uvishgan; dag‘al; qo‘pol"),
    ("码", "mǎ", "measure word for matters; yard; size (of clothing)"): ("счётное слово; ярд; размер одежды", "hisob so‘zi; yard; kiyim o‘lchami"),
    ("码", "mǎ", "to stack; to pile up"): ("складывать стопкой; штабелировать", "ustma-ust taxlamoq; uyib qo‘ymoq"),
    ("痴呆", "chīdāi", "stupid"): ("глупый; недалёкий", "ahmoq; befahm"),
    ("大片", "dàpiàn", "blockbuster movie; wide expanse"): ("блокбастер; обширная территория", "blokbaster; keng hudud"),
    ("刺眼", "cìyǎn", "dazzling; glaring"): ("слепящий; режущий глаза", "ko‘zni qamashtiradigan; ko‘zga qattiq tashlanadigan"),
    ("慈善", "císhàn", "benevolent"): ("благотворительный; милосердный", "xayriya qiluvchi; mehr-shafqatli"),
    ("风情", "fēngqíng", "charm; amorous feelings; local customs"): ("очарование; влюблённые чувства; местные обычаи", "joziba; ishqiy hislar; mahalliy urf-odatlar"),
    ("俘获", "fúhuò", "to capture"): ("захватить; пленить", "asirga olmoq; tutib olmoq"),
    ("浮力", "fúlì", "buoyancy"): ("выталкивающая сила; плавучесть", "ko‘taruvchi kuch; suyuqlikning ko‘tarish kuchi"),
    ("征", "zhēng", "to go on an expedition; to attack; to levy"): ("отправляться в поход; нападать; взимать (налоги)", "yurishga chiqmoq; hujum qilmoq; undirib olmoq"),
    ("争执", "zhēngzhí", "to dispute"): ("спорить; оспаривать", "bahslashmoq; tortishmoq"),
    ("足智多谋", "zúzhì-duōmóu", "resourceful"): ("находчивый; изобретательный", "uddaburon; ziyrak"),
    ("博弈", "bóyì", "to play a game; game; contest"): ("играть; игра; состязание", "o‘ynamoq; o‘yin; bellashuv"),
}


FIELDS = [
    "entry_key", "simplified", "traditional", "pinyin", "pinyin_numeric",
    "part_of_speech_en", "meaning_en", "meaning_en_source", "meaning_en_status",
    "meaning_ru", "meaning_ru_source", "meaning_ru_source_key", "meaning_ru_status",
    "meaning_uz", "meaning_uz_source", "meaning_uz_source_key", "meaning_uz_status",
    "hsk20_level", "hsk30_level", "hsk30_sequence", "membership_status",
    "rights_status", "review_notes",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def pinyin_key(value: str | None) -> str:
    return re.sub(r"[\s·'’‐‑-]", "", (value or "").lower())


def word_key(headword: str, pinyin: str | None) -> tuple[str, str]:
    return headword.strip(), pinyin_key(pinyin)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    for path in INPUTS.values():
        if not path.is_file():
            raise SystemExit(f"Missing licensed source snapshot: {path}")

    hmd = json.loads(INPUTS["hearmandarin"].read_text(encoding="utf-8"))
    zitou_rows = read_csv(INPUTS["zitou"])
    hanzibook_rows = read_csv(INPUTS["hanzibook"])

    zitou_by_key = {word_key(row["simplified"], row["pinyin"]): row for row in zitou_rows}
    zitou_by_headword = {row["simplified"]: row for row in zitou_rows}
    hanzibook_ru_rows = [
        row for row in hanzibook_rows
        if re.search(r"[А-Яа-яЁё]", row.get("meaning", ""))
    ]
    hanzibook_by_key = {word_key(row["hanzi"], row["pinyin"]): row for row in hanzibook_ru_rows}
    hanzibook_by_headword = {row["hanzi"]: row for row in hanzibook_ru_rows}

    output_rows: list[dict[str, str]] = []
    backlog_rows: list[dict[str, str]] = []
    counts: Counter[str] = Counter()

    for source_row in hmd["words"]:
        simplified = source_row["simplified"]
        pinyin = source_row["pinyin"]
        key = word_key(simplified, pinyin)
        ai_draft = AI_DRAFTS_BY_GLOSS.get(
            (simplified, pinyin, source_row.get("gloss_en", "")),
            AI_DRAFTS_BY_READING.get((simplified, pinyin), AI_DRAFTS.get(simplified)),
        )
        ai_correction = AI_CORRECTIONS_BY_GLOSS.get(
            (simplified, pinyin, source_row.get("gloss_en", "")),
            AI_CORRECTIONS_BY_READING.get((simplified, pinyin)),
        )
        zitou_exact = zitou_by_key.get(key)
        zitou_headword = zitou_by_headword.get(simplified)
        hb_exact = hanzibook_by_key.get(key)
        hb_headword = hanzibook_by_headword.get(simplified)

        review_notes: list[str] = []
        ru = ""
        ru_source = ""
        ru_source_key = ""
        ru_status = "missing"
        if ai_correction:
            ru = ai_correction[0]
            ru_source = "AI correction draft"
            ru_source_key = f"{simplified}|{pinyin}"
            ru_status = "ai_draft_unverified"
            review_notes.append("Draft corrects a conflicting source gloss; verify both readings and meanings.")
            counts["ru_ai_draft"] += 1
        elif zitou_exact and zitou_exact.get("russian", "").strip():
            ru = zitou_exact["russian"].strip()
            ru_source = "Zitou"
            ru_source_key = f"{simplified}|{zitou_exact['pinyin']}"
            ru_status = "source_unverified"
            counts["ru_zitou_exact"] += 1
        elif hb_exact and hb_exact.get("meaning", "").strip():
            ru = hb_exact["meaning"].strip()
            ru_source = "HanziBook"
            ru_source_key = f"{simplified}|{hb_exact['pinyin']}"
            ru_status = "source_unverified"
            counts["ru_hanzibook_exact"] += 1
        elif zitou_headword and zitou_headword.get("russian", "").strip():
            ru = zitou_headword["russian"].strip()
            ru_source = "Zitou"
            ru_source_key = f"{simplified}|{zitou_headword['pinyin']}"
            ru_status = "source_unverified_reading_review"
            review_notes.append("Russian source pinyin differs; confirm the sense before use.")
            counts["ru_headword_only"] += 1
        elif hb_headword and hb_headword.get("meaning", "").strip():
            ru = hb_headword["meaning"].strip()
            ru_source = "HanziBook"
            ru_source_key = f"{simplified}|{hb_headword['pinyin']}"
            ru_status = "source_unverified_reading_review"
            review_notes.append("Russian source pinyin differs; confirm the sense before use.")
            counts["ru_headword_only"] += 1
        elif ai_draft:
            ru = ai_draft[0]
            ru_source = "AI translation draft"
            ru_source_key = f"{simplified}|{pinyin}"
            ru_status = "ai_draft_unverified"
            counts["ru_ai_draft"] += 1
        else:
            counts["ru_missing"] += 1

        uz = ""
        uz_source = ""
        uz_source_key = ""
        uz_status = "missing"
        if ai_correction:
            uz = ai_correction[1]
            uz_source = "AI correction draft"
            uz_source_key = f"{simplified}|{pinyin}"
            uz_status = "ai_draft_unverified"
            counts["uz_ai_draft"] += 1
        elif zitou_exact and zitou_exact.get("uzbek", "").strip():
            uz = zitou_exact["uzbek"].strip()
            uz_source = "Zitou"
            uz_source_key = f"{simplified}|{zitou_exact['pinyin']}"
            uz_status = "source_unverified"
            counts["uz_zitou_exact"] += 1
        elif zitou_headword and zitou_headword.get("uzbek", "").strip():
            uz = zitou_headword["uzbek"].strip()
            uz_source = "Zitou"
            uz_source_key = f"{simplified}|{zitou_headword['pinyin']}"
            uz_status = "source_unverified_reading_review"
            review_notes.append("Uzbek source pinyin differs; confirm the sense before use.")
            counts["uz_headword_only"] += 1
        elif ai_draft:
            uz = ai_draft[1]
            uz_source = "AI translation draft"
            uz_source_key = f"{simplified}|{pinyin}"
            uz_status = "ai_draft_unverified"
            counts["uz_ai_draft"] += 1
        else:
            counts["uz_missing"] += 1

        hsk20_level = str(source_row.get("hsk2_level") or "")
        raw_hsk30 = source_row.get("hsk3_band")
        hsk30_level = "7-9" if raw_hsk30 == 7 else (str(raw_hsk30 or ""))
        output_row = {
            "entry_key": source_row["id"],
            "simplified": simplified,
            "traditional": source_row.get("traditional") or "",
            "pinyin": pinyin,
            "pinyin_numeric": source_row.get("pinyin_num") or "",
            "part_of_speech_en": source_row.get("pos_en") or "",
            "meaning_en": source_row.get("gloss_en") or "",
            "meaning_en_source": "HearMandarin",
            "meaning_en_status": "source_unverified",
            "meaning_ru": ru,
            "meaning_ru_source": ru_source,
            "meaning_ru_source_key": ru_source_key,
            "meaning_ru_status": ru_status,
            "meaning_uz": uz,
            "meaning_uz_source": uz_source,
            "meaning_uz_source_key": uz_source_key,
            "meaning_uz_status": uz_status,
            "hsk20_level": hsk20_level,
            "hsk30_level": hsk30_level,
            "hsk30_sequence": str(source_row.get("hsk3_seq") or ""),
            "membership_status": "unverified",
            "rights_status": "pending",
            "review_notes": " ".join(review_notes),
        }
        output_rows.append(output_row)

        for locale, text, status in (("ru", ru, ru_status), ("uz", uz, uz_status)):
            if not text:
                backlog_rows.append({
                    "entry_key": source_row["id"],
                    "simplified": simplified,
                    "pinyin": pinyin,
                    "meaning_en": source_row.get("gloss_en") or "",
                    "locale_needed": locale,
                    "hsk20_level": hsk20_level,
                    "hsk30_level": hsk30_level,
                    "translation_status": status,
                })

    review_rows = [
        row for row in output_rows
        if row["meaning_ru_status"] == "ai_draft_unverified"
        or row["meaning_uz_status"] == "ai_draft_unverified"
    ]

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(output_rows)

    with BACKLOG.open("w", encoding="utf-8-sig", newline="") as handle:
        fields = [
            "entry_key", "simplified", "pinyin", "meaning_en", "locale_needed",
            "hsk20_level", "hsk30_level", "translation_status",
        ]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(backlog_rows)

    with REVIEW_QUEUE.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(review_rows)

    snapshot_metadata = {
        "assembled_at": "2026-11-06",
        "candidate_rows": len(output_rows),
        "candidate_file_sha256": sha256(OUTPUT),
        "backlog_rows": len(backlog_rows),
        "review_queue_rows": len(review_rows),
        "review_queue_sha256": sha256(REVIEW_QUEUE),
        "counts": dict(sorted(counts.items())),
        "sources": {
            name: {
                "file": path.relative_to(ROOT).as_posix(),
                "sha256": sha256(path),
            }
            for name, path in INPUTS.items()
        },
    }
    MANIFEST.write_text(json.dumps(snapshot_metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(snapshot_metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
