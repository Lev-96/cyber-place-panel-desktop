export type Lang = "en" | "ru" | "am";

/**
 * Substitute `{0}`, `{1}`, … placeholders in a translated string with the
 * caller's values. Lets us keep dynamic-text translations in one piece
 * (e.g. "Delete '{0}'?") instead of splitting them at language boundaries
 * — which would otherwise force grammars where the verb-noun-modifier
 * order doesn't match between en/ru/am.
 */
export const fmt = (template: string, ...args: (string | number)[]): string =>
  template.replace(/\{(\d+)\}/g, (m, idx) => {
    const i = Number(idx);
    return i >= 0 && i < args.length ? String(args[i]) : m;
  });

export const LANGUAGES: Array<{ code: Lang; name: string }> = [
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
  { code: "am", name: "Հայերեն" },
];

type Dict = Record<string, { en: string; ru: string; am: string }>;

export const TRANSLATIONS: Dict = {
  // Navigation
  "nav.dashboard": { en: "Dashboard", ru: "Панель", am: "Վահանակ" },
  "nav.branches": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "nav.myBranch": { en: "My branch", ru: "Мой филиал", am: "Իմ մասնաճյուղը" },
  "nav.map": { en: "Map", ru: "Карта", am: "Քարտեզ" },
  "nav.bookings": { en: "Bookings", ru: "Бронирования", am: "Ամրագրումներ" },
  "nav.scan": { en: "Scan / Confirm", ru: "Сканировать", am: "Սկանավորել" },
  "nav.tournaments": { en: "Tournaments", ru: "Турниры", am: "Մրցաշարեր" },
  "nav.games": { en: "Games", ru: "Игры", am: "Խաղեր" },
  "nav.services": { en: "Services", ru: "Сервисы", am: "Ծառայություններ" },
  "nav.companies": { en: "Companies", ru: "Компании", am: "Ընկերություններ" },
  "nav.revenue": { en: "Revenue", ru: "Выручка", am: "Եկամուտ" },
  "nav.expenses": { en: "Expenses", ru: "Расходы", am: "Ծախսեր" },
  "nav.myCompany": {
    en: "My company",
    ru: "Моя компания",
    am: "Իմ ընկերությունը",
  },
  "nav.managers": { en: "Managers", ru: "Менеджеры", am: "Մենեջերներ" },
  "nav.notifications": {
    en: "Notifications",
    ru: "Уведомления",
    am: "Ծանուցումներ",
  },
  "nav.settings": { en: "Settings", ru: "Настройки", am: "Կարգավորումներ" },
  "nav.signOut": { en: "Sign out", ru: "Выйти", am: "Ելք" },

  // Auth
  "auth.signIn": { en: "Sign in", ru: "Войти", am: "Մուտք" },
  "auth.email": { en: "Email", ru: "Email", am: "Էլ. հասցե" },
  "auth.password": { en: "Password", ru: "Пароль", am: "Գաղտնաբառ" },
  "auth.forgot": {
    en: "Forgot password?",
    ru: "Забыли пароль?",
    am: "Մոռացե՞լ եք",
  },

  // Common actions
  "action.save": { en: "Save", ru: "Сохранить", am: "Պահպանել" },
  "action.cancel": { en: "Cancel", ru: "Отмена", am: "Չեղարկել" },
  "action.edit": { en: "Edit", ru: "Изменить", am: "Խմբագրել" },
  "action.delete": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "action.add": { en: "Add", ru: "Добавить", am: "Ավելացնել" },
  "action.create": { en: "Create", ru: "Создать", am: "Ստեղծել" },
  "action.start": { en: "Start", ru: "Старт", am: "Մեկնարկ" },
  "action.stop": { en: "Stop", ru: "Стоп", am: "Կանգ" },
  "action.confirm": { en: "Confirm", ru: "Подтвердить", am: "Հաստատել" },
  "action.refresh": { en: "Refresh", ru: "Обновить", am: "Թարմացնել" },
  "action.close": { en: "Close", ru: "Закрыть", am: "Փակել" },

  // Sessions
  "session.start": { en: "Start session", ru: "Старт сессии", am: "Սկսել նիստը" },
  "session.addItem": { en: "Add service / item", ru: "Добавить услугу/товар", am: "Ավելացնել ծառայություն" },
  "session.search": { en: "Search by name…", ru: "Поиск по названию…", am: "Որոնում անունով…" },
  "session.noProducts": { en: "No products in this branch yet. Add a custom item below.", ru: "В этом филиале ещё нет товаров. Добавь произвольную позицию ниже.", am: "Այս մասնաճյուղում ապրանքներ չկան: Ավելացրու ձեռքով գրառում:" },
  "session.customItem": { en: "Or a custom item", ru: "Или произвольная позиция", am: "Կամ ձեռքով գրառում" },
  "session.itemName": { en: "Name (e.g. Lays)", ru: "Название (например, Лейс)", am: "Անվանում (օր. Լեյս)" },
  "session.itemPrice": { en: "Price", ru: "Цена", am: "Գին" },
  "session.added": { en: "Added", ru: "Добавлено", am: "Ավելացված է" },
  "session.checkoutTitle": { en: "Close session", ru: "Закрыть сессию", am: "Փակել նիստը" },
  "session.checkoutDone": { en: "Receipt closed", ru: "Чек закрыт", am: "Հաշիվը փակված է" },
  "session.timePlayed": { en: "Time played", ru: "Время игры", am: "Խաղի ժամանակը" },
  "session.tariff": { en: "Tariff", ru: "Тариф", am: "Սակագին" },
  "session.totalDue": { en: "Total to pay", ru: "Итого к оплате", am: "Ընդամենը վճարման" },
  "session.confirmStop": { en: "Confirm and close", ru: "Подтвердить и закрыть", am: "Հաստատել և փակել" },
  "session.closing": { en: "Closing…", ru: "Закрываем…", am: "Փակվում է…" },
  "session.fillNamePrice": { en: "Provide a name and price", ru: "Укажите название и цену", am: "Նշեք անվանումը և գինը" },
  "session.fixedTariff": { en: "Fixed tariff", ru: "Фиксированный тариф", am: "Ֆիքսված սակագին" },
  "session.openByHour": { en: "By hour (open)", ru: "По часам (открытая)", am: "Ժամով (բաց)" },
  "session.tariffField": { en: "Tariff", ru: "Тариф", am: "Սակագին" },
  "session.hourlyRate": { en: "Hourly rate", ru: "Ставка за час", am: "Ժամային սակագին" },
  "session.openHint": { en: "Time counts up. Cost is pro-rated by minute.", ru: "Время идёт вверх. Сумма считается пропорционально.", am: "Ժամանակը հաշվվում է աճողաբար: Գումարը հաշվվում է համամասնորեն:" },
  "session.noPackages": { en: "No time packages yet. Add one on the «Branch prices» page.", ru: "Пакетов пока нет. Добавь на странице «Цены филиала».", am: "Փաթեթներ դեռ չկան: Ավելացնել «Մասնաճյուղի գները» էջում:" },
  "session.choosePackage": { en: "Choose a tariff", ru: "Выберите тариф", am: "Ընտրեք սակագինը" },
  "session.enterRate": { en: "Enter hourly rate", ru: "Укажите ставку за час", am: "Նշեք ժամային սակագինը" },
  "notifications.branchSubscribedTitle": {
    en: "New subscriber",
    ru: "Новый подписчик",
    am: "Նոր բաժանորդ",
  },
  "notifications.tournamentJoinedTitle": {
    en: "New tournament player",
    ru: "Новый участник турнира",
    am: "Մրցաշարի նոր խաղացող",
  },
  "notifications.branchSubscribedHeadline": {
    en: "Congratulations — new subscriber",
    ru: "Поздравляем — новый подписчик",
    am: "Շնորհավորում ենք — նոր բաժանորդ",
  },
  "notifications.branchSubscribedBody": {
    en: "subscribed to your branch",
    ru: "подписался на ваш филиал",
    am: "բաժանորդագրվեց ձեր մասնաճյուղին",
  },
  "notifications.tournamentJoinedHeadline": {
    en: "Congratulations — new tournament player",
    ru: "Поздравляем — новый участник турнира",
    am: "Շնորհավորում ենք — մրցաշարի նոր խաղացող",
  },
  "notifications.tournamentJoinedBody": {
    en: "joined the tournament",
    ru: "участвует в турнире",
    am: "միացավ մրցաշարին",
  },
  "registrations.title": {
    en: "Participants",
    ru: "Участники",
    am: "Մասնակիցներ",
  },
  "registrations.searchPlaceholder": {
    en: "Filter by first or last name",
    ru: "Поиск по имени или фамилии",
    am: "Որոնել ըստ անվան կամ ազգանվան",
  },
  "registrations.confirmRemove": {
    en: "Remove this registration?",
    ru: "Удалить эту регистрацию?",
    am: "Ջնջե՞լ այս գրանցումը:",
  },
  "registrations.empty": {
    en: "No registrations yet.",
    ru: "Регистраций пока нет.",
    am: "Գրանցումներ դեռ չկան:",
  },
  "registrations.noMatches": {
    en: "No matches.",
    ru: "Совпадений не найдено.",
    am: "Համընկնումներ չեն գտնվել:",
  },
  "registrations.rolePlayer": {
    en: "Player",
    ru: "Игрок",
    am: "Խաղացող",
  },
  "registrations.roleGuest": {
    en: "Guest",
    ru: "Гость",
    am: "Հյուր",
  },
  "session.noAssignedRate": {
    en: "No price configured for this PC's place. Set one on the «Branch prices» page first.",
    ru: "Для места этого PC не задана цена. Сначала установите её на странице «Цены филиала».",
    am: "Այս PC-ի տեղի համար գին սահմանված չէ: Սահմանեք այն «Մասնաճյուղի գները» էջում:",
  },
  "session.free": { en: "Free", ru: "Свободно", am: "Ազատ" },
  "session.reserved": { en: "Reserved", ru: "Зарезервировано", am: "Ամրագրված" },
  "session.toastNewBooking": { en: "New booking", ru: "Новое бронирование", am: "Նոր ամրագրում" },
  "session.toastBookingExtended": { en: "Booking extended", ru: "Бронь продлена", am: "Ամրագրումը երկարացվել է" },
  "session.addService": { en: "+ service", ru: "+ услуга", am: "+ ծառայություն" },
  "session.boardTitle": { en: "Sessions", ru: "Сессии", am: "Նիստեր" },
  "session.posNote": { en: "items", ru: "поз.", am: "միավոր" },
  "session.products": { en: "Products", ru: "Товары", am: "Ապրանքներ" },
  "session.services": { en: "Services", ru: "Услуги", am: "Ծառայություններ" },
  "session.removeItemTitle": { en: "Remove item", ru: "Удалить позицию", am: "Հեռացնել տողը" },
  "pcs.title": { en: "Computers", ru: "Компьютеры", am: "Համակարգիչներ" },
  "pcs.register": { en: "+ Register computer", ru: "+ Зарегистрировать компьютер", am: "+ Գրանցել համակարգիչ" },
  "pcs.editDevice": { en: "Edit computer", ru: "Редактировать компьютер", am: "Խմբագրել համակարգիչը" },
  "pcs.newDevice": { en: "Register computer", ru: "Зарегистрировать компьютер", am: "Գրանցել համակարգիչ" },
  "pcs.kind": { en: "Device type", ru: "Тип устройства", am: "Սարքի տեսակը" },
  "pcs.kindPc": { en: "PC (with agent)", ru: "ПК (с агентом)", am: "ՀՀ (գործակալով)" },
  "pcs.kindPs": { en: "PlayStation / console", ru: "PlayStation / консоль", am: "PlayStation / կոնսոլ" },
  "pcs.psHint": { en: "No agent runs on a console — billing-only device: timer + cost.", ru: "На консоль агент не ставится — это билинг-устройство: только таймер и расчёт стоимости.", am: "Կոնսոլի վրա գործակալ չի տեղադրվում — միայն ժամանաչափ և գումար:" },
  "pcs.label": { en: "Label (e.g. PC #5)", ru: "Метка (напр. PC #5)", am: "Պիտակ (օր. PC #5)" },
  "pcs.macHint": { en: "Used only for Wake-on-LAN. The PC connects via the agent app paired with the token.", ru: "Используется только для Wake-on-LAN. ПК подключается через агент с токеном, не через MAC.", am: "Օգտագործվում է միայն Wake-on-LAN-ի համար:" },
  "pcs.placeId": { en: "Linked place", ru: "Связанное место", am: "Կապված տեղ" },
  "pcs.placeRequired": { en: "Linked place is required.", ru: "Связанное место обязательно.", am: "Կապված տեղը պարտադիր է:" },
  "pcs.placeNone": { en: "— none —", ru: "— нет —", am: "— չկա —" },
  "pcs.placeEmpty": {
    en: "No places in this branch yet. Add places first to link this device to one.",
    ru: "В этом филиале ещё нет мест. Сначала создайте места, чтобы связать с ними устройство.",
    am: "Այս մասնաճյուղում տեղեր դեռ չկան: Նախ ավելացրեք տեղեր, որպեսզի կապեք սարքը դրանց հետ:",
  },
  "pcs.placeOption": {
    en: "№{0} · {1} · {2}",
    ru: "№{0} · {1} · {2}",
    am: "№{0} · {1} · {2}",
  },
  // Price-tier selector — replaces the old free-text hourly_rate input
  // so PCs draw their price from the branch matrix and can't drift.
  "pcs.tierLabel": { en: "Price tier", ru: "Тариф", am: "Սակագին" },
  "pcs.tierPickPlace": { en: "Select a place first — its tariff appears here.", ru: "Сначала выберите место — его тариф появится здесь.", am: "Սկզբում ընտրեք տեղը — դրա սակագինը կհայտնվի այստեղ:" },
  "pcs.tierPlaceholder": { en: "Choose a tier…", ru: "Выберите тариф…", am: "Ընտրեք սակագինը…" },
  "pcs.tierNoPrices": {
    en: "Branch prices are not configured yet. Set them in Tariffs first, then come back.",
    ru: "Цены филиала ещё не настроены. Сначала задайте их в «Тарифах», потом вернитесь сюда.",
    am: "Մասնաճյուղի գները դեռ կարգավորված չեն: Սկզբում սահմանեք դրանք «Սակագներ»-ում:",
  },
  "pcs.tierEmpty": { en: "no price set", ru: "цена не задана", am: "գին նշված չէ" },
  "pcs.tierOverwrite": {
    en: "Current rate differs from the selected tier — saving will overwrite it.",
    ru: "Текущая цена не совпадает с выбранным тарифом — сохранение перезапишет её.",
    am: "Ընթացիկ սակագինը տարբերվում է ընտրված սակագնից — պահպանումը կփոխարինի այն:",
  },
  "pcs.tier.pcStandard":  { en: "Standard",     ru: "Стандарт",     am: "Ստանդարտ" },
  "pcs.tier.pcVip":       { en: "VIP",          ru: "VIP",          am: "VIP" },
  "pcs.tier.ps4Standard": { en: "PS4 Standard", ru: "PS4 Стандарт", am: "PS4 Ստանդարտ" },
  "pcs.tier.ps4Vip":      { en: "PS4 VIP",      ru: "PS4 VIP",      am: "PS4 VIP" },
  "pcs.tier.ps5Standard": { en: "PS5 Standard", ru: "PS5 Стандарт", am: "PS5 Ստանդարտ" },
  "pcs.tier.ps5Vip":      { en: "PS5 VIP",      ru: "PS5 VIP",      am: "PS5 VIP" },
  "service.edit": { en: "Edit service", ru: "Редактировать услугу", am: "Խմբագրել ծառայությունը" },
  "service.new": { en: "New service", ru: "Новая услуга", am: "Նոր ծառայություն" },
  "service.nameEn": { en: "Name (EN)", ru: "Название (EN)", am: "Անվանում (EN)" },
  "service.nameRu": { en: "Name (RU)", ru: "Название (RU)", am: "Անվանում (RU)" },
  "service.nameAm": { en: "Name (AM)", ru: "Название (AM)", am: "Անվանում (AM)" },
  "service.price": { en: "Price (in base currency)", ru: "Цена (в базовой валюте)", am: "Գին (հիմնական արժույթով)" },
  "service.logo": { en: "Logo (optional)", ru: "Логотип (необязательно)", am: "Լոգո (ընտրովի)" },
  "time.hourShort": { en: "h", ru: "ч", am: "ժ" },
  "time.minShort": { en: "min", ru: "мин", am: "ր" },

  // Live board statuses (grammatical forms: short adjectives where natural)
  "live.title": { en: "Live", ru: "В реальном времени", am: "Իրական ժամանակում" },
  "live.updated": { en: "updated", ru: "обновлено", am: "թարմացված է" },
  "live.failedLoad": { en: "Failed to load live data", ru: "Не удалось загрузить данные", am: "Չհաջողվեց բեռնել տվյալները" },
  "live.total": { en: "Total", ru: "Всего", am: "Ընդամենը" },
  "live.till": { en: "till", ru: "до", am: "մինչ" },
  "live.from": { en: "from", ru: "с", am: "ից" },
  "place.free": { en: "Free", ru: "Свободно", am: "Ազատ" },
  "place.busy": { en: "Busy", ru: "Занято", am: "Զբաղված" },
  "place.reserved": { en: "Reserved", ru: "Зарезервировано", am: "Ամրագրված" },
  "place.maintenance": { en: "Maintenance", ru: "На обслуживании", am: "Սպասարկման մեջ" },

  // Branch hub tiles
  "hub.invalidId": { en: "Invalid branch id.", ru: "Неверный идентификатор филиала.", am: "Մասնաճյուղի սխալ ID:" },
  "hub.tile.sessions": { en: "Sessions", ru: "Сессии", am: "Նիստեր" },
  "hub.tile.sessionsHint": { en: "Start / stop · billing", ru: "Старт / стоп · биллинг", am: "Մեկնարկ / ավարտ · վճարում" },
  "hub.tile.pos": { en: "POS", ru: "Касса", am: "Դրամարկղ" },
  "hub.tile.posHint": { en: "Sell drinks & snacks", ru: "Продажа напитков и снеков", am: "Ըմպելիք և խորտիկներ" },
  "hub.tile.shift": { en: "Shift", ru: "Смена", am: "Հերթափոխ" },
  "hub.tile.shiftHint": { en: "Open / close · Z-report", ru: "Открыть / закрыть · Z-отчёт", am: "Բացել / փակել · Z-հաշվետվություն" },
  "hub.tile.members": { en: "Members", ru: "Клиенты", am: "Անդամներ" },
  "hub.tile.membersHint": { en: "Cards & deposits", ru: "Карты и депозиты", am: "Քարտեր և ավանդներ" },
  "hub.tile.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "hub.tile.placesHint": { en: "Bookable seats · games", ru: "Места для бронирования · игры", am: "Ամրագրման տեղեր · խաղեր" },
  "hub.tile.pcs": { en: "PCs", ru: "ПК", am: "Համակարգիչներ" },
  "hub.tile.pcsHint": { en: "Agent registration", ru: "Регистрация агента", am: "Գործակալի գրանցում" },
  "hub.tile.prices": { en: "Branch prices", ru: "Цены филиала", am: "Մասնաճյուղի գները" },
  "hub.tile.pricesHint": { en: "Hourly rates per place type", ru: "Ставки за час по типам мест", am: "Ժամային սակագներ ըստ տեղի տեսակի" },
  "hub.tile.subscribers": { en: "Subscribers", ru: "Подписчики", am: "Բաժանորդներ" },
  "hub.tile.subscribersHint": {
    en: "Players following branch announcements",
    ru: "Игроки, подписанные на филиал",
    am: "Մասնաճյուղին հետևող խաղացողներ",
  },
  "subscribers.title": { en: "Branch subscribers", ru: "Подписчики филиала", am: "Մասնաճյուղի բաժանորդներ" },
  "subscribers.total": { en: "Total", ru: "Всего", am: "Ընդամենը" },
  "subscribers.searchPlaceholder": {
    en: "Filter by first or last name",
    ru: "Поиск по имени или фамилии",
    am: "Որոնել ըստ անվան կամ ազգանվան",
  },
  "subscribers.empty": {
    en: "No subscribers yet.",
    ru: "Подписчиков пока нет.",
    am: "Բաժանորդներ դեռ չկան:",
  },
  "subscribers.noMatches": {
    en: "No matches.",
    ru: "Совпадений не найдено.",
    am: "Համընկնումներ չեն գտնվել:",
  },
  "hub.tile.products": { en: "Products", ru: "Товары", am: "Ապրանքներ" },
  "hub.tile.productsHint": { en: "POS catalog", ru: "Каталог кассы", am: "Դրամարկղի կատալոգ" },
  "hub.tile.services": { en: "Services", ru: "Услуги", am: "Ծառայություններ" },
  "hub.tile.servicesHint": { en: "What this branch offers", ru: "Что предлагает филиал", am: "Մասնաճյուղի առաջարկները" },
  "hub.tile.managers": { en: "Managers", ru: "Менеджеры", am: "Մենեջերներ" },
  "hub.tile.managersHint": { en: "Branch staff", ru: "Сотрудники филиала", am: "Մասնաճյուղի անձնակազմ" },
  "hub.tile.tournaments": { en: "Tournaments", ru: "Турниры", am: "Մրցաշարեր" },
  "hub.tile.tournamentsHint": { en: "Events", ru: "События", am: "Միջոցառումներ" },
  "hub.tile.settings": { en: "Settings", ru: "Настройки", am: "Կարգավորումներ" },
  "hub.tile.settingsHint": { en: "Address · pricing · hours", ru: "Адрес · цены · часы", am: "Հասցե · գներ · ժամեր" },
  "hub.branchFallback": { en: "Branch", ru: "Филиал", am: "Մասնաճյուղ" },

  // Login
  "login.title": { en: "Sign in", ru: "Вход", am: "Մուտք" },
  "login.passwordPlaceholder": { en: "••••••••", ru: "••••••••", am: "••••••••" },
  "login.signingIn": { en: "Signing in…", ru: "Вход…", am: "Մուտք…" },
  "login.failed": { en: "Login failed", ru: "Не удалось войти", am: "Մուտքը ձախողվեց" },
  "login.invalidCredentials": { en: "Wrong email or password", ru: "Неверный логин или пароль", am: "Սխալ էլ. հասցե կամ գաղտնաբառ" },

  // Sessions history
  "history.title": { en: "Sessions history", ru: "История сессий", am: "Սեանսների պատմություն" },
  "history.from": { en: "From", ru: "С", am: "Սկսած" },
  "history.to": { en: "To", ru: "По", am: "Մինչև" },
  "history.today": { en: "Today", ru: "Сегодня", am: "Այսօր" },
  "history.yesterday": { en: "Yesterday", ru: "Вчера", am: "Երեկ" },
  "history.month": { en: "This month", ru: "Текущий месяц", am: "Ընթացիկ ամիս" },
  "history.backToBoard": { en: "Back to board", ru: "К доске сессий", am: "Վերադառնալ սեանսներին" },
  "history.sumSessions": { en: "Sessions", ru: "Сессии", am: "Սեանսներ" },
  "history.sumTotal": { en: "Total revenue", ru: "Выручка", am: "Ընդհանուր եկամուտ" },
  "history.sumTime": { en: "Time revenue", ru: "За время", am: "Ժամանակի դիմաց" },
  "history.sumItemsRevenue": { en: "Items revenue", ru: "Товары · сумма", am: "Ապրանքների գումար" },
  "history.sumItemsQty": { en: "Items sold", ru: "Продано позиций", am: "Վաճառվել է" },
  "history.topItems": { en: "Top items", ru: "Топ позиций", am: "Լավագույն դիրքեր" },
  "history.empty": { en: "No sessions in this range.", ru: "В выбранном периоде нет сессий.", am: "Ընտրված ժամանակահատվածում սեանսներ չկան:" },
  "history.timeCost": { en: "Time", ru: "За время", am: "Ժամանակի դիմաց" },
  "history.itemsTotal": { en: "Items", ru: "Товары", am: "Ապրանքներ" },
  "history.total": { en: "Total", ru: "Итог", am: "Ընդհանուր" },
  "history.modeOpen": { en: "By the hour", ru: "Почасовая", am: "Ժամային" },
  "history.modeFixed": { en: "Package", ru: "Пакет", am: "Փաթեթ" },
  "history.status.active": { en: "Active", ru: "Активна", am: "Ակտիվ" },
  "history.status.stopped": { en: "Closed", ru: "Закрыта", am: "Փակված" },
  "history.status.expired": { en: "Expired", ru: "Истекла", am: "Ժամկետանց" },

  // Branch places admin (CRUD seats per branch)
  "branchPlaces.title": { en: "Places", ru: "Места", am: "Տեղեր" },
  "branchPlaces.intro": { en: "A place is a bookable seat (e.g. PC #1, PS5 VIP #2). Each place gets games linked.", ru: "Место — это место для бронирования (например, ПК №1, PS5 VIP №2). К каждому месту привязываются игры.", am: "Տեղը ամրագրվող նստատեղ է (օր.՝ PC #1, PS5 VIP #2): Յուրաքանչյուր տեղին կապվում են խաղեր:" },
  "branchPlaces.new": { en: "+ New place", ru: "+ Новое место", am: "+ Նոր տեղ" },
  "branchPlaces.confirmDelete": { en: "Delete place #{0}?", ru: "Удалить место №{0}?", am: "Ջնջե՞լ #{0} տեղը:" },
  "branchPlaces.empty": { en: "No places yet. Click 'New place' to add the first one.", ru: "Мест ещё нет. Нажмите «Новое место», чтобы добавить первое.", am: "Տեղեր դեռ չկան: Սեղմեք «Նոր տեղ»՝ առաջինը ավելացնելու համար:" },
  "branchPlaces.games": { en: "game(s)", ru: "игр", am: "խաղ" },
  "branchPlaces.status.active": { en: "active", ru: "активно", am: "ակտիվ" },
  "branchPlaces.status.inactive": { en: "inactive", ru: "неактивно", am: "ոչ ակտիվ" },

  // Booking details page
  "bookingDetails.title": { en: "Booking", ru: "Бронирование", am: "Ամրագրում" },
  "bookingDetails.status": { en: "Status", ru: "Статус", am: "Կարգավիճակ" },
  "bookingDetails.status.pending": { en: "Pending", ru: "Ожидание", am: "Սպասում" },
  "bookingDetails.status.confirmed": { en: "Confirmed", ru: "Подтверждено", am: "Հաստատված" },
  "bookingDetails.status.cancelled": { en: "Cancelled", ru: "Отменено", am: "Չեղարկված" },
  "bookingDetails.status.rescheduled": { en: "Rescheduled", ru: "Перенесено", am: "Տեղափոխված" },
  "bookingDetails.code": { en: "Code", ru: "Код", am: "Կոդ" },
  "bookingDetails.company": { en: "Company", ru: "Компания", am: "Ընկերություն" },
  "bookingDetails.branch": { en: "Branch", ru: "Филиал", am: "Մասնաճյուղ" },
  "bookingDetails.game": { en: "Game", ru: "Игра", am: "Խաղ" },
  "bookingDetails.start": { en: "Start", ru: "Начало", am: "Սկիզբ" },
  "bookingDetails.duration": { en: "Duration", ru: "Длительность", am: "Տևողություն" },
  "bookingDetails.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "bookingDetails.endTime": { en: "End time", ru: "Окончание", am: "Ավարտ" },
  "bookingDetails.showCode": { en: "Show this code at branch", ru: "Покажите код в филиале", am: "Ցույց տվեք կոդը մասնաճյուղում" },
  "bookingDetails.cancel": { en: "Cancel", ru: "Отменить", am: "Չեղարկել" },
  "bookingDetails.minShort": { en: "min", ru: "мин", am: "ր" },

  // PCs management page
  "pcs.confirmDelete": { en: "Delete '{0}'? This cannot be undone.", ru: "Удалить «{0}»? Действие необратимо.", am: "Ջնջե՞լ «{0}»: Անդարձելի գործողություն:" },
  "pcs.confirmRotate": { en: "Rotate pairing token for '{0}'? The agent on this PC will stop working until updated.", ru: "Сменить токен сопряжения для «{0}»? Агент на этом ПК перестанет работать, пока его не обновят.", am: "Թարմացնե՞լ «{0}»-ի զուգակցման թոքենը: PC-ի գործակալը կդադարի աշխատել մինչև թարմացում:" },
  "pcs.macRequired": { en: "Set a MAC address on this PC before using Wake-on-LAN.", ru: "Сначала задайте MAC-адрес для этого ПК — без него Wake-on-LAN не сработает.", am: "Նախ նշեք PC-ի MAC հասցեն — առանց դրա Wake-on-LAN չի աշխատի:" },
  "pcs.packetsSent": { en: "Packets sent: {0}", ru: "Пакетов отправлено: {0}", am: "Փաթեթներ ուղարկվել են՝ {0}" },
  "pcs.errorsHeader": { en: "Errors:", ru: "Ошибки:", am: "Սխալներ՝" },
  "pcs.wolReminder": { en: "PC must have Wake-on-LAN enabled in BIOS and NIC settings, and be on the same LAN as this cashier.", ru: "На ПК должен быть включён Wake-on-LAN в BIOS и в настройках сетевой карты, и он должен быть в одной сети с кассой.", am: "PC-ի BIOS-ում և ցանցային քարտի կարգավորումներում պետք է միացված լինի Wake-on-LAN, և PC-ն պետք է լինի դրամարկղի հետ նույն ցանցում:" },
  "pcs.wakeFailed": { en: "Wake failed: {0}", ru: "Не удалось разбудить: {0}", am: "Արթնացման սխալ՝ {0}" },
  "pcs.howConnects": { en: "How a PC actually connects:", ru: "Как ПК подключается:", am: "Ինչպես PC-ն իրականում միանում է՝" },
  "pcs.connect.step1": { en: "Register the PC here — you get a pairing token.", ru: "Зарегистрируйте ПК — получите токен сопряжения.", am: "Գրանցեք PC-ն այստեղ — կստանաք զուգակցման թոքեն:" },
  "pcs.connect.step2": { en: "Install the agent on the PC and enter the PC ID + token.", ru: "Установите агента на ПК и введите ID и токен.", am: "Տեղադրեք գործակալը PC-ում և մուտքագրեք PC ID-ն և թոքենը:" },
  "pcs.connect.step3": { en: "The MAC address is optional — used only for Wake-on-LAN, not for authentication.", ru: "MAC-адрес опционален — нужен только для Wake-on-LAN, не для авторизации.", am: "MAC-հասցեն ոչ պարտադիր է — օգտագործվում է միայն Wake-on-LAN-ի համար, ոչ նույնականացման:" },
  "pcs.lastSeen": { en: "last seen", ru: "последний раз", am: "վերջին անգամ" },
  "pcs.notPaired": { en: "not paired yet — install agent", ru: "ещё не сопряжён — установите агента", am: "դեռ չզուգակցված — տեղադրեք գործակալը" },
  "pcs.sending": { en: "Sending…", ru: "Отправка…", am: "Ուղարկում…" },
  "pcs.wake": { en: "Wake", ru: "Разбудить", am: "Արթնացնել" },
  "pcs.getToken": { en: "Get token", ru: "Получить токен", am: "Ստանալ թոքեն" },
  "pcs.rotateToken": { en: "Rotate token", ru: "Сменить токен", am: "Թարմացնել թոքենը" },
  "pcs.empty": { en: "No PCs registered yet — click Register to add the first one.", ru: "ПК ещё не зарегистрированы — нажмите «Зарегистрировать», чтобы добавить первый.", am: "PC-ներ դեռ չեն գրանցվել — սեղմեք «Գրանցել»՝ առաջինը ավելացնելու համար:" },
  "pcs.statusInSession": { en: "In session", ru: "В сессии", am: "Սեանսում" },
  "pcs.statusOnline": { en: "Online", ru: "В сети", am: "Առցանց" },
  "pcs.statusOffline": { en: "Offline", ru: "Не в сети", am: "Անցանց" },

  // Shift panel — extends existing shift.* block above with strings the
  // ShiftPanel route needs in addition to the legacy minimal set.
  "shift.confirmClose": { en: "Close this shift? After close it cannot be modified.", ru: "Закрыть смену? После закрытия её нельзя изменить.", am: "Փակե՞լ հերթափոխը: Փակվելուց հետո չի կարելի փոփոխել:" },
  "shift.failed": { en: "Failed", ru: "Сбой", am: "Ձախողվեց" },
  "shift.openingCash": { en: "Opening cash", ru: "Касса на старте", am: "Մեկնարկային կանխիկ" },
  "shift.opening": { en: "Opening…", ru: "Открытие…", am: "Բացում…" },
  "shift.opened": { en: "Opened", ru: "Открыта", am: "Բացված" },
  "shift.sessionsRevenue": { en: "Sessions revenue", ru: "Выручка по сессиям", am: "Սեանսների եկամուտ" },
  "shift.ordersCash": { en: "Orders — cash", ru: "Заказы — наличные", am: "Պատվերներ — կանխիկ" },
  "shift.ordersCard": { en: "Orders — card", ru: "Заказы — карта", am: "Պատվերներ — քարտ" },
  "shift.ordersDeposit": { en: "Orders — deposit", ru: "Заказы — депозит", am: "Պատվերներ — ավանդ" },
  "shift.expectedCash": { en: "Expected cash drawer", ru: "Ожидаемая наличность", am: "Ակնկալվող կանխիկ" },
  "shift.grossTotal": { en: "Gross total", ru: "Итого выручка", am: "Ընդհանուր եկամուտ" },
  "shift.closeTitle": { en: "Close shift (Z-report)", ru: "Закрыть смену (Z-отчёт)", am: "Փակել հերթափոխը (Z-հաշվետվություն)" },
  "shift.declaredCash": { en: "Declared cash (counted)", ru: "Заявленные наличные (по факту)", am: "Հայտարարված կանխիկ (հաշվարկված)" },
  "shift.notes": { en: "Notes", ru: "Примечания", am: "Նշումներ" },
  "shift.closing": { en: "Closing…", ru: "Закрытие…", am: "Փակում…" },

  // Settings extras
  "settings.role": { en: "Role", ru: "Роль", am: "Դեր" },
  "settings.ratesNote": { en: "Stored prices are in AMD. We convert at fixed rates: 1 USD ≈ 400 AMD, 1 RUB ≈ 4.2 AMD. Sample: 1000 AMD =", ru: "Цены хранятся в драмах. Конвертация по фиксированному курсу: 1 USD ≈ 400 драм, 1 ₽ ≈ 4.2 драм. Пример: 1000 драм =", am: "Գները պահվում են դրամով: Փոխարկում ֆիքսված կուրսով: 1 USD ≈ 400 դրամ, 1 ₽ ≈ 4.2 դրամ: Օրինակ՝ 1000 դրամ =" },
  "settings.currentPassword": { en: "Current password", ru: "Текущий пароль", am: "Ընթացիկ գաղտնաբառ" },
  "settings.newPassword": { en: "New password", ru: "Новый пароль", am: "Նոր գաղտնաբառ" },
  "settings.confirmPassword": { en: "Confirm new password", ru: "Подтвердите новый пароль", am: "Հաստատեք նոր գաղտնաբառը" },
  "settings.passwordChanged": { en: "Password changed", ru: "Пароль изменён", am: "Գաղտնաբառը փոխվեց" },
  "settings.passwordsMismatch": { en: "Passwords do not match", ru: "Пароли не совпадают", am: "Գաղտնաբառերը չեն համընկնում" },
  "settings.updatePassword": { en: "Update password", ru: "Обновить пароль", am: "Թարմացնել գաղտնաբառը" },
  "settings.subscribed": { en: "Subscribed", ru: "Подписка оформлена", am: "Բաժանորդագրվել եք" },
  "settings.subscribeHint": { en: "Subscribe an email to product updates.", ru: "Подпишите email на обновления продукта.", am: "Բաժանորդագրվել հաղորդագրությունների:" },

  // Common
  "common.back": { en: "Back", ru: "Назад", am: "Հետ" },
  "common.open": { en: "Open →", ru: "Открыть →", am: "Բացել →" },
  "common.empty.branches": { en: "No branches yet.", ru: "Филиалов пока нет.", am: "Մասնաճյուղեր դեռ չկան:" },
  "common.empty.bookings": { en: "No bookings.", ru: "Бронирований нет.", am: "Ամրագրումներ չկան:" },
  "common.empty.tournaments": { en: "No tournaments.", ru: "Турниров нет.", am: "Մրցաշարեր չկան:" },
  "common.empty.games": { en: "No games.", ru: "Игр нет.", am: "Խաղեր չկան:" },
  "common.empty.companies": { en: "No companies.", ru: "Компаний нет.", am: "Ընկերություններ չկան:" },
  "common.empty.managers": { en: "No managers.", ru: "Менеджеров нет.", am: "Մենեջերներ չկան:" },
  "common.empty.notifications": { en: "No notifications right now.", ru: "Сейчас уведомлений нет.", am: "Ծանուցումներ չկան:" },
  "common.checking": { en: "Checking…", ru: "Проверяем…", am: "Ստուգում…" },
  "label.code": { en: "Code", ru: "Код", am: "Կոդ" },
  "label.status": { en: "Status", ru: "Статус", am: "Կարգավիճակ" },
  "label.date": { en: "Date", ru: "Дата", am: "Ամսաթիվ" },
  "label.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "label.company": { en: "Company", ru: "Компания", am: "Ընկերություն" },

  // Branches list / map
  "branchesList.title": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "branchesList.placesShort": { en: "places", ru: "места", am: "տեղեր" },
  "branchesList.servicesShort": { en: "services", ru: "услуги", am: "ծառայություններ" },
  "branchesMap.title": { en: "Branches map", ru: "Карта филиалов", am: "Մասնաճյուղերի քարտեզ" },
  "branchesMap.geoCount": { en: "of {total} branches geo-located", ru: "из {total} филиалов с координатами", am: "{total}-ից աշխարհագրականորեն տեղորոշված" },
  "branchesMap.noGeoTitle": { en: "No branches geo-located yet.", ru: "Координаты филиалов ещё не заданы.", am: "Մասնաճյուղերի կոորդինատներ դեռ չեն սահմանված:" },
  "branchesMap.noGeoHint": { en: "Open a branch → Edit → save with a pin on the map. The map will show all branches with non-zero coordinates.", ru: "Откройте филиал → Изменить → сохраните с меткой на карте. На карте появятся все филиалы с заданными координатами.", am: "Բացեք մասնաճյուղ → Խմբագրել → պահպանեք քարտեզի վրա կետով: Քարտեզում կհայտնվեն բոլոր մասնաճյուղերը:" },

  // Bookings
  "bookings.title": { en: "Bookings", ru: "Бронирования", am: "Ամրագրումներ" },
  "bookings.confirmTitle": { en: "Confirm booking by code", ru: "Подтверждение брони по коду", am: "Հաստատել ամրագրումը կոդով" },
  "bookings.enterCode": { en: "Enter customer's code", ru: "Введите код клиента", am: "Մուտքագրեք հաճախորդի կոդը" },
  "bookings.bookingCode": { en: "Booking code", ru: "Код бронирования", am: "Ամրագրման կոդ" },
  "bookings.codePlaceholder": { en: "e.g. 482931", ru: "напр. 482931", am: "օր. 482931" },
  "bookings.invalidCode": { en: "Invalid code", ru: "Неверный код", am: "Սխալ կոդ" },
  "bookings.confirmedOk": { en: "Confirmed ✓", ru: "Подтверждено ✓", am: "Հաստատված է ✓" },

  // Tournaments
  "tournaments.title": { en: "Tournaments", ru: "Турниры", am: "Մրցաշարեր" },
  "tournaments.scopeHint": { en: "Open a branch and click \"Tournaments\" to create one. Tournaments belong to a specific branch.", ru: "Откройте филиал и нажмите «Турниры», чтобы создать. Турниры привязаны к конкретному филиалу.", am: "Բացեք մասնաճյուղ և սեղմեք «Մրցաշարեր»՝ ստեղծելու համար: Մրցաշարը պատկանում է որոշակի մասնաճյուղի:" },
  "tournaments.new": { en: "+ New tournament", ru: "+ Новый турнир", am: "+ Նոր մրցաշար" },
  "tournaments.price": { en: "price", ru: "цена", am: "գին" },
  "tournaments.players": { en: "players", ru: "игроков", am: "խաղացողներ" },
  "tournaments.confirmDelete": { en: "Delete tournament", ru: "Удалить турнир", am: "Ջնջել մրցաշարը" },

  // Games
  "games.title": { en: "Games", ru: "Игры", am: "Խաղեր" },
  "games.new": { en: "+ New game", ru: "+ Новая игра", am: "+ Նոր խաղ" },
  "games.confirmDelete": { en: "Delete", ru: "Удалить", am: "Ջնջել" },

  // Services admin
  "servicesAdmin.title": { en: "Services", ru: "Услуги", am: "Ծառայություններ" },
  "servicesAdmin.subtitle": { en: "Global services available for branches to enable.", ru: "Глобальные услуги, которые филиалы могут включать у себя.", am: "Համընդհանուր ծառայություններ, որոնք մասնաճյուղերը կարող են ակտիվացնել:" },
  "servicesAdmin.new": { en: "+ New service", ru: "+ Новая услуга", am: "+ Նոր ծառայություն" },
  "servicesAdmin.confirmDelete": { en: "Delete service", ru: "Удалить услугу", am: "Ջնջել ծառայությունը" },

  // Recurring-services expense tracker (admin only)
  "expenses.title": { en: "Expenses", ru: "Расходы", am: "Ծախսեր" },
  "expenses.subtitle": { en: "Recurring services you pay for monthly (domain, Gmail Workspace, hosting…).", ru: "Регулярные сервисы, за которые ты платишь каждый месяц (домен, Gmail Workspace, хостинг…).", am: "Կրկնվող ծառայություններ, որոնց համար ամսական վճարում ես (դոմեն, Gmail Workspace, հոստինգ…):" },
  "expenses.new": { en: "+ New expense", ru: "+ Новый расход", am: "+ Նոր ծախս" },
  "expenses.edit": { en: "Edit expense", ru: "Редактировать расход", am: "Խմբագրել ծախսը" },
  "expenses.name": { en: "Service name", ru: "Название сервиса", am: "Ծառայության անունը" },
  "expenses.namePlaceholder": { en: "e.g. Domain (porkbun)", ru: "напр. Домен (porkbun)", am: "օր. Դոմեն (porkbun)" },
  "expenses.amount": { en: "Amount", ru: "Сумма", am: "Գումար" },
  "expenses.currency": { en: "Currency", ru: "Валюта", am: "Արժույթ" },
  "expenses.purchasedAt": { en: "Purchase date", ru: "Дата покупки", am: "Գնման ամսաթիվ" },
  "expenses.isActive": { en: "Active (count in monthly total)", ru: "Активен (учитывать в месячном итоге)", am: "Ակտիվ (հաշվել ամսական գումարում)" },
  "expenses.invalidForm": { en: "Fill in a name, a non-negative amount and a purchase date.", ru: "Укажи название, неотрицательную сумму и дату покупки.", am: "Լրացրու անունը, ոչ բացասական գումարը և գնման ամսաթիվը:" },
  "expenses.monthlyTotal": { en: "Monthly total", ru: "Итого в месяц", am: "Ամսական ընդամենը" },
  "expenses.perMonth": { en: "per month", ru: "в месяц", am: "ամսական" },
  "expenses.empty": { en: "No services tracked yet.", ru: "Пока нет добавленных сервисов.", am: "Դեռ ավելացված ծառայություններ չկան:" },
  "expenses.upcomingTitle": { en: "Upcoming charges (within 3 days)", ru: "Ближайшие платежи (в течение 3 дней)", am: "Մոտալուտ վճարումներ (3 օրվա ընթացքում)" },
  "expenses.dueToday": { en: "due today", ru: "платёж сегодня", am: "վճարումն այսօր է" },
  "expenses.dueIn": { en: "in", ru: "через", am: "ևս" },
  "expenses.overdue": { en: "overdue by", ru: "просрочено на", am: "ժամկետանց" },
  "expenses.markPaid": { en: "Paid", ru: "Заплатил", am: "Վճարված է" },
  "expenses.lastPaid": { en: "last paid", ru: "оплачено", am: "վերջին վճարում" },
  "expenses.openToPay": { en: "open to pay →", ru: "открыть, чтобы оплатить →", am: "բացել վճարելու համար →" },
  "expenses.dayShort": { en: "day", ru: "день", am: "օր" },
  "expenses.daysShort": { en: "days", ru: "дн.", am: "օր" },
  "expenses.nextDue": { en: "next charge", ru: "след. платёж", am: "հաջորդ վճարում" },
  "expenses.paused": { en: "paused", ru: "на паузе", am: "դադարեցված" },
  "expenses.confirmDelete": { en: "Delete expense", ru: "Удалить расход", am: "Ջնջել ծախսը" },
  "expenses.payLockedHint": { en: "Activates 3 days before the charge", ru: "Активна за 3 дня до платежа", am: "Ակտիվանում է վճարումից 3 օր առաջ" },
  "expenses.reminderPushTitle": { en: "Time to pay for a service", ru: "Пора оплатить сервис", am: "Ժամանակն է վճարել ծառայության համար" },
  "expenses.reminderToastMany": { en: "{n} services awaiting payment", ru: "{n} сервисов ждут оплаты", am: "{n} ծառայություն սպասում է վճարման" },
  "expenses.openExpenses": { en: "Open expenses", ru: "Открыть расходы", am: "Բացել ծախսերը" },

  // Companies / revenue
  "companiesList.title": { en: "Companies", ru: "Компании", am: "Ընկերություններ" },
  "companiesList.revenueLink": { en: "Revenue & commission →", ru: "Выручка и комиссия →", am: "Եկամուտ և միջնորդավճար →" },
  "companiesList.new": { en: "+ New company", ru: "+ Новая компания", am: "+ Նոր ընկերություն" },
  "companiesList.branchesShort": { en: "branches", ru: "филиалы", am: "մասնաճյուղեր" },
  "revenue.title": { en: "Revenue & commission", ru: "Выручка и комиссия", am: "Եկամուտ և միջնորդավճար" },
  "revenue.pickCompany": { en: "— pick a company —", ru: "— выберите компанию —", am: "— ընտրեք ընկերություն —" },
  "revenue.pickHint": { en: "Pick a company to see its monthly revenue and commission.", ru: "Выберите компанию, чтобы увидеть её месячную выручку и комиссию.", am: "Ընտրեք ընկերություն՝ ամսական եկամուտ և միջնորդավճար տեսնելու համար:" },
  "revenue.operationalTitle": { en: "Operational revenue (sessions + POS)", ru: "Операционная выручка (сессии + касса)", am: "Գործառնական եկամուտ (սեանս + դրամարկղ)" },
  "revenue.sourceSessions": { en: "Sessions", ru: "Сессии", am: "Սեանսներ" },
  "revenue.sourcePos": { en: "POS orders", ru: "Заказы кассы", am: "Դրամարկղի վաճառք" },
  "revenue.gross": { en: "Gross", ru: "Итого выручка", am: "Ընդհանուր" },
  "revenue.commissionPercent": { en: "Commission", ru: "Комиссия", am: "Միջնորդավճար" },
  "revenue.amountOwed": { en: "You owe us this period", ru: "К оплате за период", am: "Վճարման ենթակա ժամանակահատվածում" },
  "revenue.bookingsTitle": { en: "Bookings (advisory)", ru: "Брони (справочно)", am: "Ամրագրումներ (տեղեկատու)" },
  "revenue.bookingsHint": { en: "not billed", ru: "в счёт не идёт", am: "չի հաշվարկվում" },
  "revenue.period": { en: "Period", ru: "Период", am: "Ժամանակահատված" },
  "revenue.completedBookings": { en: "Completed bookings", ru: "Завершённые брони", am: "Ավարտված ամրագրումներ" },
  "revenue.amountDue": { en: "Implied amount", ru: "Расчётная сумма", am: "Հաշվարկային գումար" },
  "revenue.fromConfig": { en: "From company config", ru: "Из настроек компании", am: "Ընկերության կարգավորումներից" },
  "revenue.storedLocally": { en: "Stored locally on this device.", ru: "Хранится локально на этом устройстве.", am: "Պահված է տեղական այս սարքում:" },

  // Managers
  "managers.title": { en: "Managers", ru: "Менеджеры", am: "Մենեջերներ" },
  "managers.new": { en: "+ New manager", ru: "+ Новый менеджер", am: "+ Նոր մենեջեր" },
  "managers.branchLabel": { en: "branch", ru: "филиал", am: "մասնաճյուղ" },
  "managers.confirmRemove": { en: "Remove manager", ru: "Удалить менеджера", am: "Հեռացնել մենեջերին" },
  "action.remove": { en: "Remove", ru: "Удалить", am: "Հեռացնել" },

  // Notifications
  "notifications.title": { en: "Notifications", ru: "Уведомления", am: "Ծանուցումներ" },
  "notifications.companyOverdue": { en: "is overdue on payment", ru: "просрочила оплату", am: "ուշացրել է վճարումը" },
  "notifications.companyMustPayIn": { en: "must pay in", ru: "должна оплатить через", am: "պետք է վճարի" },
  "notifications.dayShort": { en: "day", ru: "день", am: "օր" },
  "notifications.daysShort": { en: "days", ru: "дн.", am: "օր" },
  "notifications.youOverdue": { en: "You are overdue on your Cyber Place payment", ru: "Вы просрочили оплату Cyber Place", am: "Դուք ուշացրել եք Cyber Place-ի վճարումը" },
  "notifications.youMustPayIn": { en: "you must pay Cyber Place — {pct}% commission", ru: "вам нужно оплатить Cyber Place — комиссия {pct}%", am: "դուք պետք է վճարեք Cyber Place՝ {pct}% միջնորդավճար" },
  "notifications.lastPaid": { en: "Last paid", ru: "Последний платёж", am: "Վերջին վճարում" },
  "notifications.neverPaid": { en: "Never paid", ru: "Не оплачивалось", am: "Չի վճարվել" },
  "notifications.due": { en: "Due", ru: "Срок", am: "Ժամկետ" },
  "notifications.owner": { en: "Owner", ru: "Владелец", am: "Սեփականատեր" },
  "notifications.newBookingTitle": { en: "New booking", ru: "Новое бронирование", am: "Նոր ամրագրում" },
  "notifications.bookingExtendedTitle": { en: "Booking extended", ru: "Бронь продлена", am: "Ամրագրումը երկարացվել է" },
  "notifications.bookingCancelledTitle": { en: "Booking cancelled", ru: "Бронь отменена", am: "Ամրագրումը չեղարկվել է" },
  // Cashier-floor copy for OS push notifications. Keeps the emoji
  // up front so a glance at the notification tray reads the kind
  // even before the body is parsed.
  "notifications.bookingCreatedPushTitle": {
    en: "🎉 You have a booking!",
    ru: "🎉 У вас есть бронирование!",
    am: "🎉 Դուք ունեք ամրագրում!",
  },
  "notifications.bookingCreatedPushBody": {
    en: "Player {name} booked place {places} at {company} {address}",
    ru: "Игрок {name} забронировал место {places} в {company} {address}",
    am: "Խաղացող {name}-ը ամրագրեց տեղ {places} {company} {address}-ում",
  },
  "notifications.bookingExtendedPushTitle": {
    en: "⏰ Booking extended",
    ru: "⏰ Время бронирования продлено",
    am: "⏰ Ամրագրումը երկարացվել է",
  },
  "notifications.bookingExtendedPushBody": {
    en: "Player {name} extended time by {minutes} {minShort} at {company} {address}",
    ru: "Игрок {name} продлил время на {minutes} {minShort} в {company} {address}",
    am: "Խաղացող {name}-ը երկարացրեց ժամանակը {minutes} {minShort}-ով {company} {address}-ում",
  },
  "notifications.bookingCancelledPushTitle": {
    en: "😢 Booking cancelled",
    ru: "😢 Бронирование отменено",
    am: "😢 Ամրագրումը չեղարկվել է",
  },
  "notifications.bookingCancelledPushBody": {
    en: "Sadly, player {name} cancelled place {places} at {company} {address}",
    ru: "К сожалению, игрок {name} отменил место {places} в {company} {address}",
    am: "Ցավոք, խաղացող {name}-ը չեղարկեց տեղ {places} {company} {address}-ում",
  },
  "notifications.guestFallback": { en: "Guest", ru: "Гость", am: "Հյուր" },
  "notifications.bookingPlaces": { en: "Place", ru: "Место", am: "Տեղ" },
  "notifications.bookingPlacesPlural": { en: "Places", ru: "Места", am: "Տեղեր" },
  "notifications.bookingMinShort": { en: "min", ru: "мин", am: "րոպե" },
  "notifications.openBoard": { en: "Open board", ru: "К сессиям", am: "Բացել տախտակը" },
  "notifications.markAllRead": { en: "Mark all as read", ru: "Отметить все прочитанными", am: "Նշել բոլորը կարդացած" },
  "notifications.unreadDot": { en: "Unread", ru: "Не прочитано", am: "Չկարդացված" },
  "notifications.bookingFeedTitle": { en: "Bookings", ru: "Бронирования", am: "Ամրագրումներ" },
  "notifications.billingFeedTitle": { en: "Billing", ru: "Биллинг", am: "Հաշվարկ" },
  "notifications.openBooking": { en: "Open", ru: "Открыть", am: "Բացել" },
  "notifications.bookingForDate": { en: "for", ru: "на", am: "—" },
  "notifications.deleteOne": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "notifications.clearAll": { en: "Clear all", ru: "Очистить все", am: "Մաքրել բոլորը" },
  "notifications.confirmClearAll": { en: "Delete all notifications? This cannot be undone.", ru: "Удалить все уведомления? Это действие нельзя отменить.", am: "Ջնջե՞լ բոլոր ծանուցումները։ Այս գործողությունը չի կարող չեղարկվել։" },

  // Generic form helpers
  "label.title": { en: "Title", ru: "Название", am: "Անվանում" },
  "label.description": { en: "Description", ru: "Описание", am: "Նկարագրություն" },
  "label.name": { en: "Name", ru: "Имя", am: "Անուն" },
  "label.email": { en: "Email", ru: "Email", am: "Էլ. հասցե" },
  "label.phone": { en: "Phone", ru: "Телефон", am: "Հեռախոս" },
  "label.price": { en: "Price", ru: "Цена", am: "Գին" },
  "label.duration": { en: "Duration", ru: "Длительность", am: "Տևողություն" },
  "label.platform": { en: "Platform", ru: "Платформа", am: "Հարթակ" },
  "label.startDate": { en: "Start date", ru: "Дата начала", am: "Մեկնարկի ամսաթիվ" },
  "label.endDate": { en: "End date", ru: "Дата окончания", am: "Ավարտի ամսաթիվ" },
  "label.amount": { en: "Amount", ru: "Сумма", am: "Գումար" },
  "label.reference": { en: "Reference (optional)", ru: "Описание (необязательно)", am: "Նկարագրություն (ընտրովի)" },
  "label.category": { en: "Category (optional)", ru: "Категория (необязательно)", am: "Կատեգորիա (ընտրովի)" },
  "label.optionalSuffix": { en: "(optional)", ru: "(необязательно)", am: "(ընտրովի)" },
  "label.cardCode": { en: "Card code", ru: "Код карты", am: "Քարտի կոդ" },
  "label.confirmPassword": { en: "Confirm password", ru: "Подтвердите пароль", am: "Հաստատեք գաղտնաբառը" },
  "label.number": { en: "Number", ru: "Номер", am: "Համար" },
  "label.type": { en: "Type", ru: "Тип", am: "Տեսակ" },
  "label.participantsLimit": { en: "Participants limit", ru: "Лимит участников", am: "Մասնակիցների սահման" },
  "label.game": { en: "Game", ru: "Игра", am: "Խաղ" },
  "label.pick": { en: "— pick —", ru: "— выберите —", am: "— ընտրեք —" },
  "form.errors.failedSave": { en: "Failed to save", ru: "Не удалось сохранить", am: "Չհաջողվեց պահպանել" },
  "form.errors.failed": { en: "Failed", ru: "Ошибка", am: "Սխալ" },

  // Game form
  "game.titleNew": { en: "New game", ru: "Новая игра", am: "Նոր խաղ" },
  "game.titleEdit": { en: "Edit game", ru: "Редактировать игру", am: "Խմբագրել խաղը" },
  "game.platformLocked": { en: "Platform cannot be changed after creation.", ru: "Платформу нельзя изменить после создания.", am: "Հարթակը հնարավոր չէ փոխել ստեղծումից հետո:" },

  // Tariff (TimePackage) form
  "tariff.titleNew": { en: "New tariff", ru: "Новый тариф", am: "Նոր սակագին" },
  "tariff.titleEdit": { en: "Edit tariff", ru: "Редактировать тариф", am: "Խմբագրել սակագինը" },
  "tariff.namePlaceholder": { en: "Name (e.g. 1 hour)", ru: "Название (напр. 1 час)", am: "Անվանում (օր. 1 ժամ)" },
  "tariff.nameEn": { en: "Name (English)", ru: "Название (английский)", am: "Անվանում (անգլերեն)" },
  "tariff.nameRu": { en: "Name (Russian)", ru: "Название (русский)", am: "Անվանում (ռուսերեն)" },
  "tariff.nameAm": { en: "Name (Armenian)", ru: "Название (армянский)", am: "Անվանում (հայերեն)" },
  "tariff.durationMin": { en: "Duration (minutes)", ru: "Длительность (минуты)", am: "Տևողություն (րոպե)" },
  "tariff.errors.duration": { en: "Duration must be a positive number", ru: "Длительность должна быть положительным числом", am: "Տևողությունը պետք է լինի դրական թիվ" },
  "tariff.errors.price": { en: "Price must be 0 or more", ru: "Цена должна быть 0 или больше", am: "Գինը պետք է լինի 0 կամ ավելի" },

  // Product form
  "product.titleNew": { en: "New product", ru: "Новый товар", am: "Նոր ապրանք" },
  "product.titleEdit": { en: "Edit product", ru: "Редактировать товар", am: "Խմբագրել ապրանքը" },
  "product.errors.price": { en: "Price must be a non-negative number", ru: "Цена должна быть неотрицательной", am: "Գինը չպետք է լինի բացասական" },

  // Manager form
  "manager.titleNew": { en: "New manager", ru: "Новый менеджер", am: "Նոր մենեջեր" },
  "manager.titleEdit": { en: "Edit manager", ru: "Редактировать менеджера", am: "Խմբագրել մենեջերին" },
  "manager.errors.companyMissing": { en: "Company not resolved yet — try again", ru: "Компания ещё не определена — попробуйте ещё раз", am: "Ընկերությունը դեռ չի հայտնաբերվել՝ կրկնեք" },

  // Member form
  "member.titleNew": { en: "New member", ru: "Новый клиент", am: "Նոր անդամ" },
  "member.titleEdit": { en: "Edit member", ru: "Редактировать клиента", am: "Խմբագրել անդամին" },

  // Topup
  "topup.title": { en: "Top up", ru: "Пополнить", am: "Համալրել" },
  "topup.balance": { en: "Current balance", ru: "Текущий баланс", am: "Ընթացիկ մնացորդ" },
  "topup.processing": { en: "Processing…", ru: "Обработка…", am: "Մշակում…" },
  "topup.errors.amount": { en: "Amount must be > 0", ru: "Сумма должна быть больше 0", am: "Գումարը պետք է լինի > 0" },

  // Place form
  "place.titleNew": { en: "New place", ru: "Новое место", am: "Նոր տեղ" },
  "place.titleEdit": { en: "Edit place", ru: "Редактировать место", am: "Խմբագրել տեղը" },
  "place.name": { en: "Place name (optional)", ru: "Название места (необязательно)", am: "Տեղի անվանումը (ընտրովի)" },
  "place.namePlaceholder": { en: "e.g. Corner PS5, Poker table", ru: "напр. Угловая PS5, Стол для покера", am: "օր. Անկյունային PS5, Պոկերի սեղան" },
  "place.gamesAvailable": { en: "Games available on this place", ru: "Доступные игры на этом месте", am: "Հասանելի խաղեր այս տեղում" },
  "place.noGamesPlatform": { en: "No games for", ru: "Нет игр для", am: "Խաղեր չկան" },
  "place.selected": { en: "selected", ru: "выбрано", am: "ընտրված" },
  "place.errors.number": { en: "Number must be a positive integer", ru: "Номер должен быть положительным целым числом", am: "Համարը պետք է լինի դրական ամբողջ թիվ" },

  // Tournament form
  "tournament.titleNew": { en: "New tournament", ru: "Новый турнир", am: "Նոր մրցաշար" },
  "tournament.titleEdit": { en: "Edit tournament", ru: "Редактировать турнир", am: "Խմբագրել մրցաշարը" },
  "tournament.errors.pickGame": { en: "Pick a game", ru: "Выберите игру", am: "Ընտրեք խաղ" },
  "tournament.errors.descRequired": { en: "Description is required", ru: "Укажите описание", am: "Նկարագրությունը պարտադիր է" },
  "tournament.errors.startRequired": { en: "Start date is required", ru: "Укажите дату начала", am: "Մեկնարկի ամսաթիվը պարտադիր է" },
  "tournament.errors.companyMissing": { en: "Branch is missing company id — reload and retry", ru: "У филиала нет компании — перезагрузите страницу", am: "Մասնաճյուղին ընկերություն չի կցված" },
  "tournament.branchLoadFailed": { en: "Branch load failed", ru: "Не удалось загрузить филиал", am: "Չհաջողվեց բեռնել մասնաճյուղը" },

  // Skill level (tournament create/edit select + list/detail chip)
  "tournament.skillLevel": { en: "Skill level", ru: "Уровень игры", am: "Խաղի մակարդակ" },
  "tournament.skillLevel.any":          { en: "Any",          ru: "Любой",          am: "Ցանկացած" },
  "tournament.skillLevel.beginner":     { en: "Beginner",     ru: "Новичок",        am: "Սկսնակ" },
  "tournament.skillLevel.intermediate": { en: "Intermediate", ru: "Средний",        am: "Միջին" },
  "tournament.skillLevel.professional": { en: "Professional", ru: "Профи",          am: "Պրոֆեսիոնալ" },

  // Verify-code section on the tournament detail page
  "registrations.verifyCodeTitle":      { en: "Verify player code", ru: "Подтвердить код игрока", am: "Հաստատել խաղացողի կոդը" },
  "registrations.verifyCodeHint":       { en: "Enter the 6-character code the player shows on their phone, or scan their QR.", ru: "Введите 6-значный код, который игрок показывает на телефоне, или отсканируйте QR.", am: "Մուտքագրեք 6 նիշանոց կոդը, որը խաղացողը ցույց է տալիս հեռախոսին, կամ սկանավորեք QR-ը:" },
  "registrations.verifyCodePlaceholder":{ en: "e.g. A3K9P2",       ru: "напр. A3K9P2",         am: "օր. A3K9P2" },
  "registrations.verifyButton":         { en: "Verify",            ru: "Подтвердить",          am: "Հաստատել" },
  "registrations.scanQrButton":         { en: "Scan QR",           ru: "Сканировать QR",       am: "Սկանավորել QR" },
  "registrations.verifySuccess":        { en: "Verified",          ru: "Подтверждено",         am: "Հաստատված է" },
  "registrations.verifyFailed":         { en: "Verification failed", ru: "Не удалось подтвердить", am: "Չհաջողվեց հաստատել" },
  "registrations.verifyAlready":        { en: "Already verified",  ru: "Уже подтверждено",     am: "Արդեն հաստատված է" },
  "registrations.verifiedBadge":        { en: "✓ Verified",        ru: "✓ Подтверждён",        am: "✓ Հաստատված" },
  "registrations.verifiedBy":           { en: "by",                ru: "—",                    am: "կողմից" },
  "registrations.pendingBadge":         { en: "Pending",           ru: "Ожидает",              am: "Սպասում է" },

  // Branch form
  "branch.titleNew": { en: "New branch", ru: "Новый филиал", am: "Նոր մասնաճյուղ" },
  "branch.titleEdit": { en: "Edit branch", ru: "Редактировать филиал", am: "Խմբագրել մասնաճյուղը" },
  "branch.address": { en: "Address", ru: "Адрес", am: "Հասցե" },
  "branch.addressPlaceholder": { en: "Your branch address", ru: "Ваш адрес филиала", am: "Ձեր մասնաճյուղի հասցեն" },
  "branchForm.suggestionsHint": { en: "Start typing — pick a real address from the list", ru: "Начните вводить — выберите реальный адрес из списка", am: "Սկսեք մուտքագրել — ընտրեք իրական հասցե ցանկից" },
  "branch.country": { en: "Country", ru: "Страна", am: "Երկիր" },
  "branch.city": { en: "City", ru: "Город", am: "Քաղաք" },
  "branch.coordinates": { en: "Coordinates (lat / lng)", ru: "Координаты (широта / долгота)", am: "Կոորդինատներ (լայն. / երկ.)" },
  "branch.logo": { en: "Logo (optional)", ru: "Логотип (необязательно)", am: "Լոգո (ընտրովի)" },

  // Company form
  "company.titleNew": { en: "New company", ru: "Новая компания", am: "Նոր ընկերություն" },
  "company.titleEdit": { en: "Edit company", ru: "Редактировать компанию", am: "Խմբագրել ընկերությունը" },
  "company.commission": { en: "Commission %", ru: "Комиссия %", am: "Միջնորդավճար %" },

  // Booking modals
  "booking.cancelTitle": { en: "Cancel booking", ru: "Отменить бронь", am: "Չեղարկել ամրագրումը" },
  "booking.cancelReason": { en: "Reason for cancellation", ru: "Причина отмены", am: "Չեղարկման պատճառը" },
  "booking.rescheduleTitle": { en: "Reschedule booking", ru: "Перенести бронь", am: "Տեղափոխել ամրագրումը" },
  "booking.newDate": { en: "New date", ru: "Новая дата", am: "Նոր ամսաթիվ" },
  "booking.newTime": { en: "New time", ru: "Новое время", am: "Նոր ժամ" },
  "booking.rateTitle": { en: "Rate this branch", ru: "Оцените филиал", am: "Գնահատեք մասնաճյուղը" },
  "booking.rating": { en: "Rating", ru: "Оценка", am: "Գնահատական" },
  "booking.review": { en: "Review (optional)", ru: "Отзыв (необязательно)", am: "Կարծիք (ընտրովի)" },

  // Pairing token modal
  "pairing.title": { en: "Pairing token", ru: "Токен сопряжения", am: "Զուգակցման տոկեն" },
  "pairing.copy": { en: "Copy", ru: "Копировать", am: "Պատճենել" },
  "pairing.copied": { en: "Copied!", ru: "Скопировано!", am: "Պատճենվել է!" },
  "pairing.hint": { en: "Use this token in the agent app on the gaming PC.", ru: "Используйте этот токен в агенте на игровом ПК.", am: "Օգտագործեք այս տոկենը խաղային ՀՀ-ի վրա:" },

  // Image upload
  "image.choose": { en: "Choose file", ru: "Выберите файл", am: "Ընտրել ֆայլ" },
  "image.remove": { en: "Remove", ru: "Удалить", am: "Հեռացնել" },

  // QR scanner
  "qr.start": { en: "Start camera", ru: "Включить камеру", am: "Միացնել տեսախցիկը" },
  "qr.stop": { en: "Stop camera", ru: "Выключить камеру", am: "Անջատել տեսախցիկը" },
  "qr.point": { en: "Point camera at the QR code", ru: "Наведите камеру на QR-код", am: "Ուղղեք տեսախցիկը QR կոդին" },

  // Forgot/Reset password
  "auth.forgotTitle": { en: "Forgot password", ru: "Восстановление пароля", am: "Մոռացված գաղտնաբառ" },
  "auth.resetTitle": { en: "Reset password", ru: "Сброс пароля", am: "Վերակայել գաղտնաբառը" },
  "auth.sendResetLink": { en: "Send reset link", ru: "Отправить ссылку", am: "Ուղարկել հղում" },
  "auth.backToLogin": { en: "Back to sign in", ru: "Вернуться к входу", am: "Վերադառնալ մուտքին" },
  "auth.resetSent": { en: "If the email exists, a reset link was sent.", ru: "Если email существует, ссылка отправлена.", am: "Եթե էլ. հասցեն գոյություն ունի, հղումն ուղարկվել է:" },

  // Member card / list / shifts / pos / booking details
  "members.title": { en: "Members", ru: "Клиенты", am: "Անդամներ" },
  "members.new": { en: "+ New member", ru: "+ Новый клиент", am: "+ Նոր անդամ" },
  "members.search": { en: "Search by name / phone / card…", ru: "Поиск по имени / телефону / карте…", am: "Որոնում անունով / հեռախոսով / քարտով…" },
  "members.balance": { en: "Balance", ru: "Баланс", am: "Մնացորդ" },
  "members.empty": { en: "No members yet.", ru: "Клиентов пока нет.", am: "Անդամներ դեռ չկան:" },
  "members.deposits": { en: "Deposits", ru: "Депозиты", am: "Ավանդներ" },
  "members.lastVisit": { en: "Last visit", ru: "Последний визит", am: "Վերջին այց" },

  "products.title": { en: "Products", ru: "Товары", am: "Ապրանքներ" },
  "products.new": { en: "+ New product", ru: "+ Новый товар", am: "+ Նոր ապրանք" },
  "products.empty": { en: "No products yet.", ru: "Товаров пока нет.", am: "Ապրանքներ դեռ չկան:" },

  "shift.title": { en: "Shift", ru: "Смена", am: "Հերթափոխ" },
  "shift.open": { en: "Open shift", ru: "Открыть смену", am: "Բացել հերթափոխը" },
  "shift.close": { en: "Close shift", ru: "Закрыть смену", am: "Փակել հերթափոխը" },
  "shift.openingFloat": { en: "Opening cash float", ru: "Сумма в кассе при открытии", am: "Բացման կանխիկ գումար" },
  "shift.closingCash": { en: "Closing cash counted", ru: "Подсчитанная сумма при закрытии", am: "Փակման հաշվարկած գումար" },
  "shift.summary": { en: "Z-report", ru: "Z-отчёт", am: "Z-հաշվետվություն" },
  "shift.noActive": { en: "No open shift right now.", ru: "Открытой смены нет.", am: "Բաց հերթափոխ չկա:" },

  "pos.title": { en: "POS terminal", ru: "Касса", am: "Դրամարկղ" },
  "pos.cart": { en: "Cart", ru: "Корзина", am: "Զամբյուղ" },
  "pos.cartEmpty": { en: "Cart is empty", ru: "Корзина пуста", am: "Զամբյուղը դատարկ է" },
  "pos.checkout": { en: "Checkout", ru: "Оплатить", am: "Վճարել" },
  "pos.payment": { en: "Payment method", ru: "Способ оплаты", am: "Վճարման եղանակ" },
  "pos.cash": { en: "Cash", ru: "Наличные", am: "Կանխիկ" },
  "pos.subtotal": { en: "Subtotal", ru: "Подытог", am: "Միջանկյալ" },
  "pos.total": { en: "Total", ru: "Итого", am: "Ընդամենը" },

  // Branch edit / open hours / prices page
  "branch.editTabs.info": { en: "Info", ru: "Инфо", am: "Տվյալներ" },
  // (legacy key still referenced by older translations of mail-out
  // texts; keep around with a neutral label.)
  "branch.editTabs.pricing": { en: "Prices", ru: "Цены", am: "Գներ" },
  "branch.prices.title": { en: "Branch prices", ru: "Цены филиала", am: "Մասնաճյուղի գները" },
  "branch.prices.standard": { en: "Standard", ru: "Стандарт", am: "Ստանդարտ" },
  "branch.prices.vip": { en: "VIP", ru: "VIP", am: "VIP" },
  "branch.prices.hint": {
    en: "Per-hour rate (AMD). Sessions and the mobile app bill from this matrix.",
    ru: "Ставка за час (драм). Сессии и мобильное приложение считают по этой таблице.",
    am: "Ժամային սակագինը (դրամ). Սեսիաներն ու հավելվածը հաշվարկում են այս աղյուսակից:",
  },
  "branch.prices.saved": { en: "Saved", ru: "Сохранено", am: "Պահպանված է" },
  "branch.prices.packagesSubtitle": { en: "Time packages", ru: "Тарифные пакеты", am: "Ժամանակային փաթեթներ" },
  "tariff.platform": { en: "Platform", ru: "Платформа", am: "Պլատֆորմա" },
  "tariff.platformAll": { en: "All platforms", ru: "Все платформы", am: "Բոլոր պլատֆորմները" },
  "tariff.discount.toggle": {
    en: "Add a time-windowed discount",
    ru: "Добавить скидку по времени",
    am: "Ավելացնել ժամային զեղչ",
  },
  "tariff.discount.hint": {
    en: "Discount applies on selected weekdays inside the window. Players see it on the duration picker only while active.",
    ru: "Скидка действует в выбранные дни недели и часы. Игроки видят её на экране выбора длительности только пока она активна.",
    am: "Զեղչը գործում է ընտրված շաբաթվա օրերին և ժամերին։ Խաղացողները տեսնում են այն տևողության էկրանում միայն ակտիվ ընթացքում։",
  },
  "tariff.discount.price": { en: "Discount price", ru: "Цена со скидкой", am: "Զեղչային գին" },
  "tariff.discount.startTime": { en: "Start time", ru: "Время начала", am: "Սկսի ժամ" },
  "tariff.discount.endTime": { en: "End time", ru: "Время окончания", am: "Ավարտի ժամ" },
  "tariff.discount.days": { en: "Weekdays", ru: "Дни недели", am: "Շաբաթվա օրեր" },
  "tariff.discount.tag": { en: "Promo:", ru: "Акция:", am: "Ակցիա՝" },
  "tariff.discount.activeNow": { en: "Active now", ru: "Сейчас активна", am: "Հիմա ակտիվ է" },
  "tariff.errors.discountPrice": {
    en: "Discount price must be 0 or more",
    ru: "Цена со скидкой должна быть 0 или больше",
    am: "Զեղչային գինը պետք է լինի 0 կամ ավելի",
  },
  "tariff.errors.discountTime": {
    en: "Enter a valid HH:MM time",
    ru: "Введите время в формате ЧЧ:ММ",
    am: "Մուտքագրեք ժամ HH:MM ձևաչափով",
  },
  "tariff.errors.discountDays": {
    en: "Select at least one weekday",
    ru: "Выберите хотя бы один день недели",
    am: "Ընտրեք առնվազն մեկ օր",
  },
  "branch.editTabs.hours": { en: "Working hours", ru: "Часы работы", am: "Աշխատանքային ժամեր" },
  "branch.editTabs.services": { en: "Services", ru: "Услуги", am: "Ծառայություններ" },
  "branch.weekday.mon": { en: "Mon", ru: "Пн", am: "Երկ" },
  "branch.weekday.tue": { en: "Tue", ru: "Вт", am: "Երք" },
  "branch.weekday.wed": { en: "Wed", ru: "Ср", am: "Չրք" },
  "branch.weekday.thu": { en: "Thu", ru: "Чт", am: "Հնգ" },
  "branch.weekday.fri": { en: "Fri", ru: "Пт", am: "Ուրբ" },
  "branch.weekday.sat": { en: "Sat", ru: "Сб", am: "Շաբ" },
  "branch.weekday.sun": { en: "Sun", ru: "Вс", am: "Կիր" },
  "branch.openTime": { en: "Open", ru: "Открытие", am: "Բացում" },
  "branch.closeTime": { en: "Close", ru: "Закрытие", am: "Փակում" },
  "branch.dayOff": { en: "Day off", ru: "Выходной", am: "Հանգստյան օր" },
  "branchForm.locationLabel": { en: "Location", ru: "Местоположение", am: "Տեղադրություն" },
  "branchForm.latitude": { en: "Latitude", ru: "Широта", am: "Լայնություն" },
  "branchForm.longitude": { en: "Longitude", ru: "Долгота", am: "Երկայնություն" },
  "branchForm.autoLocateHint": { en: "We auto-locate the address as you type. Click on the map to override the pin.", ru: "Адрес ищется автоматически по мере ввода. Кликните на карте, чтобы поставить точку вручную.", am: "Հասցեն գտնվում է ինքնաբերաբար: Սեղմեք քարտեզի վրա ձեռքով կետ դնելու համար:" },
  "branchForm.searching": { en: "Searching address…", ru: "Поиск адреса…", am: "Հասցեն որոնում…" },
  "branchForm.pinned": { en: "Pinned ✓", ru: "Точка установлена ✓", am: "Կետը նշված է ✓" },
  "branchForm.addrNotFound": { en: "Address not found — click the map to pick", ru: "Адрес не найден — кликните на карте", am: "Հասցեն չի գտնվել — սեղմեք քարտեզի վրա" },
  "branchForm.geoFailed": { en: "Geocoding failed — click the map to pick", ru: "Не удалось определить координаты — кликните на карте", am: "Կոորդինատների որոնումը ձախողվեց — սեղմեք քարտեզի վրա" },
  "branchForm.typeOrClick": { en: "Type address or click the map", ru: "Введите адрес или кликните на карте", am: "Մուտքագրեք հասցեն կամ սեղմեք քարտեզին" },
  "branchForm.selectedLocation": { en: "Selected location", ru: "Выбранная точка", am: "Ընտրված կետ" },
  "branchForm.pickLocationFirst": { en: "Pick a location on the map (or fill the address so it can be auto-located).", ru: "Укажите точку на карте (или заполните адрес для авто-определения).", am: "Ընտրեք կետ քարտեզի վրա (կամ լրացրեք հասցեն ինքնաբերաբար գտնելու համար):" },
  "branchForm.pickFromList": { en: "Pick a real address from the suggestions so the location is verified.", ru: "Выберите реальный адрес из подсказок, чтобы точка была подтверждена.", am: "Ընտրեք իրական հասցե ցանկից, որպեսզի կետը հաստատվի:" },
  "branchForm.cityRequired": { en: "City is required.", ru: "Укажите город.", am: "Քաղաքը պարտադիր է:" },
  "branchForm.cityFromAddress": { en: "Filled from the address", ru: "Заполняется из адреса", am: "Լրացվում է հասցեից" },
  "branchForm.invalidPhone": { en: "Enter a valid phone number for the selected country.", ru: "Введите корректный номер телефона для выбранной страны.", am: "Մուտքագրեք վավեր հեռախոսահամար ընտրված երկրի համար:" },

  // Company details page
  "company.invalidId": { en: "Invalid company id.", ru: "Неверный идентификатор компании.", am: "Ընկերության սխալ ID:" },
  "company.email": { en: "Email", ru: "Email", am: "Էլ. հասցե" },
  "company.phone": { en: "Phone", ru: "Телефон", am: "Հեռախոս" },
  "company.country": { en: "Country", ru: "Страна", am: "Երկիր" },
  "company.city": { en: "City", ru: "Город", am: "Քաղաք" },
  "company.description": { en: "Description", ru: "Описание", am: "Նկարագրություն" },
  "company.status": { en: "Status", ru: "Статус", am: "Կարգավիճակ" },
  "company.status.active": { en: "Active", ru: "Активна", am: "Ակտիվ" },
  "company.status.pending": { en: "Pending", ru: "Ожидание", am: "Սպասում" },
  "company.branches": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "company.edit": { en: "Edit company", ru: "Редактировать компанию", am: "Խմբագրել ընկերությունը" },
  "company.addBranch": { en: "+ Add branch", ru: "+ Добавить филиал", am: "+ Ավելացնել մասնաճյուղ" },
  "company.viewBranches": { en: "View branches", ru: "Открыть филиалы", am: "Տեսնել մասնաճյուղերը" },

  // Company form extras
  "company.step1": { en: "step 1/2", ru: "шаг 1/2", am: "քայլ 1/2" },
  "company.step2": { en: "step 2/2", ru: "шаг 2/2", am: "քայլ 2/2" },
  "company.owner": { en: "Owner", ru: "Владелец", am: "Սեփականատեր" },
  "company.section": { en: "Company", ru: "Компания", am: "Ընկերություն" },
  "company.ownerName": { en: "Owner full name", ru: "Имя владельца", am: "Սեփականատիրոջ անունը" },
  "company.ownerEmail": { en: "Owner email", ru: "Email владельца", am: "Սեփականատիրոջ էլ. հասցե" },
  "company.creatingOwner": { en: "Creating owner…", ru: "Создание владельца…", am: "Սեփականատերը ստեղծվում է…" },
  "company.next": { en: "Next", ru: "Далее", am: "Հաջորդը" },
  "company.back": { en: "← Back", ru: "← Назад", am: "← Հետ" },
  "company.create": { en: "Create company", ru: "Создать компанию", am: "Ստեղծել ընկերություն" },
  "company.name": { en: "Company name", ru: "Название компании", am: "Ընկերության անվանումը" },
  "company.tin": { en: "TIN", ru: "ИНН", am: "ՀՎՀՀ" },
  "company.website": { en: "Website", ru: "Веб-сайт", am: "Կայք" },
  "company.statusAdmin": { en: "Status (admin only)", ru: "Статус (только админ)", am: "Կարգավիճակ (միայն ադմին)" },
  "company.commissionAdmin": { en: "Commission % (admin only)", ru: "Комиссия % (только админ)", am: "Միջնորդավճար % (միայն ադմին)" },
  "company.commissionHint": { en: "Owner pays this percent of monthly gross revenue to Cyber Place.", ru: "Владелец платит этот процент с месячной выручки Cyber Place.", am: "Սեփականատերը վճարում է ամսական հասույթից այս տոկոսը Cyber Place-ին:" },
  "company.saving": { en: "Saving…", ru: "Сохранение…", am: "Պահպանվում է…" },
  "company.saved": { en: "Saved.", ru: "Сохранено.", am: "Պահպանված է:" },
  "company.logoRequired": { en: "Logo is required for a new company", ru: "Для новой компании нужен логотип", am: "Նոր ընկերության համար անհրաժեշտ է լոգո" },
  "company.ownerNotCreated": { en: "Owner user not created yet", ru: "Владелец ещё не создан", am: "Սեփականատերը դեռ չի ստեղծվել" },
  "company.replaceLogo": { en: "Replace logo (optional)", ru: "Заменить логотип (необязательно)", am: "Փոխել լոգոն (ընտրովի)" },
  "company.logo": { en: "Logo", ru: "Логотип", am: "Լոգո" },

  // Role labels — used by the sidebar user card chip and any other
  // surface that needs to render a humane name for `users.role`.
  "role.admin": { en: "Admin", ru: "Админ", am: "Ադմին" },
  "role.company_owner": { en: "Owner", ru: "Владелец", am: "Սեփականատեր" },
  "role.manager": { en: "Manager", ru: "Менеджер", am: "Մենեջեր" },

  // Pairing token modal
  "pairing.titleFor": { en: "Pairing token", ru: "Токен сопряжения", am: "Զուգակցման տոկեն" },
  "pairing.saveNow": { en: "Save this token now — it will not be shown again. You'll need it on the agent during PC setup, along with PC ID", ru: "Сохрани этот токен сейчас — он больше не будет показан. Он понадобится для настройки агента вместе с ID ПК", am: "Պահպանեք այս տոկենն այժմ — այն այլևս չի ցուցադրվի: Այն կպահանջվի գործակալի կարգավորման ժամանակ՝ ՀՀ ID-ի հետ" },
  "pairing.copyToken": { en: "Copy token", ru: "Скопировать токен", am: "Պատճենել տոկենը" },
  "pairing.iSaved": { en: "I saved it", ru: "Сохранил", am: "Պահպանեցի" },

  // Booking action modals
  "booking.cancelTitleId": { en: "Cancel booking", ru: "Отменить бронь", am: "Չեղարկել ամրագրումը" },
  "booking.cancelReasonField": { en: "Reason (optional, kept for your records)", ru: "Причина (необязательно)", am: "Պատճառ (ընտրովի)" },
  "booking.cancelReasonHint": { en: "Backend doesn't currently store reason — this stays in your local notes only.", ru: "Бэкенд пока не сохраняет причину — текст остаётся только в локальных заметках.", am: "Բեքենդը դեռ չի պահպանում պատճառը:" },
  "booking.keep": { en: "Keep booking", ru: "Оставить бронь", am: "Թողնել ամրագրումը" },
  "booking.cancelling": { en: "Cancelling…", ru: "Отмена…", am: "Չեղարկվում է…" },
  "booking.cancelDo": { en: "Cancel booking", ru: "Отменить бронь", am: "Չեղարկել ամրագրումը" },

  // QR scanner
  "qr.requesting": { en: "Requesting camera access…", ru: "Запрос доступа к камере…", am: "Տեսախցիկի թույլտվության հարցում…" },
  "qr.aim": { en: "Point the camera at the QR code on the customer's screen.", ru: "Наведите камеру на QR-код на экране клиента.", am: "Ուղղեք տեսախցիկը հաճախորդի էկրանի QR կոդին:" },
  "qr.stopScan": { en: "Stop scanning", ru: "Остановить сканирование", am: "Կանգնեցնել սկանավորումը" },
  "qr.deniedPrefix": { en: "Camera access denied", ru: "Доступ к камере запрещён", am: "Տեսախցիկի մուտքն արգելված է" },

  // Image upload
  "image.click": { en: "Click to upload", ru: "Нажмите, чтобы загрузить", am: "Սեղմեք բեռնելու համար" },
  "image.changeImage": { en: "Change image", ru: "Заменить изображение", am: "Փոխել պատկերը" },
  "image.chooseImage": { en: "Choose image", ru: "Выбрать изображение", am: "Ընտրել պատկեր" },
  "image.clear": { en: "Clear", ru: "Очистить", am: "Մաքրել" },
  "image.formatHint": { en: "PNG / JPG / WebP, ≤ 5 MB", ru: "PNG / JPG / WebP, ≤ 5 МБ", am: "PNG / JPG / WebP, ≤ 5 ՄԲ" },

  // Lists / actions
  "action.hide": { en: "Hide", ru: "Скрыть", am: "Թաքցնել" },
  "action.show": { en: "Show", ru: "Показать", am: "Ցույց տալ" },
  "action.activate": { en: "Activate", ru: "Включить", am: "Միացնել" },
  "action.deactivate": { en: "Deactivate", ru: "Выключить", am: "Անջատել" },
  "action.search": { en: "Search", ru: "Найти", am: "Որոնել" },
  "tariffs.title": { en: "Tariffs", ru: "Тарифы", am: "Սակագներ" },
  "tariffs.new": { en: "+ New tariff", ru: "+ Новый тариф", am: "+ Նոր սակագին" },
  "tariffs.empty": { en: "No tariffs yet. Add at least one to start sessions.", ru: "Тарифов пока нет. Добавьте хотя бы один.", am: "Սակագներ դեռ չկան: Ավելացրեք առնվազն մեկը:" },
  "tariffs.confirmDelete": { en: "Delete tariff", ru: "Удалить тариф", am: "Ջնջել սակագինը" },
  "products.confirmDelete": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "members.cardLabel": { en: "card", ru: "карта", am: "քարտ" },

  // Forgot/reset
  "forgot.successPrefix": { en: "If the email exists, a reset link has been sent.", ru: "Если email существует, ссылка на сброс отправлена.", am: "Եթե էլ. հասցեն գոյություն ունի, վերակայման հղումն ուղարկվել է:" },
  "forgot.toastSent": { en: "Password reset link sent to your email", ru: "Ссылка для сброса пароля отправлена на почту", am: "Գաղտնաբառի վերակայման հղումն ուղարկվել է ձեր էլ. փոստին" },
  "auth.sending": { en: "Sending…", ru: "Отправка…", am: "Ուղարկվում է…" },
  "reset.token": { en: "Reset token", ru: "Токен сброса", am: "Վերակայման տոկեն" },
  "reset.successDone": { en: "Password updated. You can now sign in.", ru: "Пароль обновлён. Можно войти.", am: "Գաղտնաբառը թարմացվել է: Կարող եք մուտք գործել:" },

  // Member card
  "memberCard.transactions": { en: "Transactions", ru: "Транзакции", am: "Գործարքներ" },
  "memberCard.noTx": { en: "No transactions yet.", ru: "Транзакций пока нет.", am: "Գործարքներ դեռ չկան:" },
  "memberCard.topup": { en: "Top up", ru: "Пополнение", am: "Համալրում" },
  "memberCard.spend": { en: "Spend", ru: "Списание", am: "Ծախս" },
  "memberCard.adjust": { en: "Adjust", ru: "Корректировка", am: "Շտկում" },

  // Branch hub tiles
  "tile.sessions": { en: "Sessions", ru: "Сессии", am: "Նիստեր" },
  "tile.pos": { en: "POS", ru: "Касса", am: "Դրամարկղ" },
  "tile.shift": { en: "Shift", ru: "Смена", am: "Հերթափոխ" },
  "tile.members": { en: "Members", ru: "Клиенты", am: "Հաճախորդներ" },
  "tile.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "tile.pcs": { en: "PCs", ru: "ПК", am: "Համակարգիչներ" },
  "tile.tariffs": { en: "Tariffs", ru: "Тарифы", am: "Սակագներ" },
  "tile.products": { en: "Products", ru: "Товары", am: "Ապրանքներ" },

  // Place statuses
  "status.free": { en: "Free", ru: "Свободно", am: "Ազատ" },
  "status.busy": { en: "Busy", ru: "Занято", am: "Զբաղված" },
  "status.reserved": { en: "Reserved", ru: "Забронировано", am: "Ամրագրված" },
  "status.maintenance": {
    en: "Maintenance",
    ru: "Обслуживание",
    am: "Սպասարկում",
  },
  "status.online": { en: "Online", ru: "Онлайн", am: "Առցանց" },
  "status.offline": { en: "Offline", ru: "Оффлайн", am: "Անջատված" },
  "status.in_session": { en: "In session", ru: "В сессии", am: "Նիստում" },

  // Settings
  "settings.account": { en: "Account", ru: "Аккаунт", am: "Հաշիվ" },
  "settings.changePassword": {
    en: "Change password",
    ru: "Сменить пароль",
    am: "Փոխել գաղտնաբառ",
  },
  "settings.language": { en: "Language", ru: "Язык", am: "Լեզու" },
  "settings.currency": {
    en: "Display currency",
    ru: "Валюта отображения",
    am: "Արժույթ",
  },
  "settings.newsletter": { en: "Newsletter", ru: "Рассылка", am: "Տեղեկագիր" },

  // Common labels
  "label.total": { en: "Total", ru: "Итого", am: "Ընդամենը" },
  "label.balance": { en: "Balance", ru: "Баланс", am: "Մնացորդ" },

  // Home page (from @Home.tsx)
  "home.welcomeBack": {
    en: "Welcome back,",
    ru: "С возвращением,",
    am: "Բարի վերադարձ,",
  },
  "home.companies": { en: "Companies", ru: "Компании", am: "Ընկերություններ" },
  "home.branches": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "home.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "home.bookings": { en: "Bookings", ru: "Бронирования", am: "Ամրագրումներ" },
  "home.activeBranches": {
    en: "Active branches",
    ru: "Активные филиалы",
    am: "Ակտիվ մասնաճյուղեր",
  },
  "home.todaysBookings": {
    en: "Today's bookings",
    ru: "Бронирования за сегодня",
    am: "Այսօրվա ամրագրումներ",
  },
  "home.upcoming": { en: "Upcoming", ru: "Предстоящие", am: "Առաջիկա" },
  "home.occupiedNow": {
    en: "Occupied now",
    ru: "Заняты сейчас",
    am: "Այժմ զբաղված",
  },
  "home.allPlaces": { en: "Places", ru: "Места", am: "Տեղեր" },

  "home.menu.branches": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "home.menu.branchesSub": {
    en: "Live, sessions, POS, members",
    ru: "Мониторинг, сеансы, касса, игроки",
    am: "Մոնիթորինգ, սեանսներ, դրամարկղ, խաղացողներ",
  },
  "home.menu.bookings": {
    en: "Bookings",
    ru: "Бронирования",
    am: "Ամրագրումներ",
  },
  "home.menu.bookingsSub": {
    en: "All bookings",
    ru: "Все бронирования",
    am: "Բոլոր ամրագրումները",
  },
  "home.menu.companies": {
    en: "Companies",
    ru: "Компании",
    am: "Ընկերություններ",
  },
  "home.menu.companiesSub": {
    en: "Commission & revenue",
    ru: "Комиссии и доход",
    am: "Կոմիստոն ու եկամուտ",
  },
  "home.menu.myBranch": {
    en: "My branch",
    ru: "Мой филиал",
    am: "Իմ մասնաճյուղը",
  },
  "home.menu.myBranchSub": {
    en: "Sessions, POS, shift, members",
    ru: "Сеансы, касса, смена, клиенты",
    am: "Սեանսներ, դրամարկղ, հերթափոխ, հաճախորդներ",
  },
  "home.menu.expenses": {
    en: "Expenses",
    ru: "Расходы",
    am: "Ծախսեր",
  },
  "home.menu.expensesSub": {
    en: "Recurring services you pay monthly",
    ru: "Регулярные сервисы, оплата ежемесячно",
    am: "Կրկնվող ծառայություններ, ամսական վճարում",
  },
  "home.menu.settings": {
    en: "Settings",
    ru: "Настройки",
    am: "Կարգավորումներ",
  },
  "home.menu.settingsSub": {
    en: "Account & password",
    ru: "Аккаунт и пароль",
    am: "Հաշիվ և գաղտնաբառ",
  },
  // Auto-update admin screen (admin-only sidebar entry + route).
  "nav.updates": {
    en: "App updates",
    ru: "Обн. приложения",
    am: "Հավելվածների թարմացումներ",
  },
  "nav.agentUpdates": {
    en: "Agent updates",
    ru: "Обновления агента",
    am: "Գործակալի թարմացումներ",
  },
  "agentUpdates.title": {
    en: "Kiosk agent updates",
    ru: "Обновления агента-киоска",
    am: "Կիոսկ-գործակալի թարմացումներ",
  },
  "agentUpdates.subtitle": {
    en: "Roll out a new version of the kiosk agent to every gaming PC in your branches. Updates download in the background and prompt the cashier on the lock screen.",
    ru: "Обновите версию агента на всех игровых ПК ваших филиалов. Обновление скачается фоном и предложит кассиру перезапустить на экране блокировки.",
    am: "Թարմացրեք գործակալի տարբերակը ձեր մասնաճյուղերի բոլոր խաղային համակարգիչներում: Թարմացումը կներբեռնվի և կհուշի կասսային:",
  },
  "agentUpdates.loading": {
    en: "Loading agent status…",
    ru: "Загрузка состояния агента…",
    am: "Բեռնվում է գործակալի վիճակը…",
  },
  "agentUpdates.currentVersion": {
    en: "Current version",
    ru: "Текущая версия",
    am: "Ընթացիկ տարբերակը",
  },
  "agentUpdates.latestVersion": {
    en: "Latest version",
    ru: "Новая версия",
    am: "Նոր տարբերակը",
  },
  "agentUpdates.upToDate": {
    en: "Every agent is up to date.",
    ru: "Все агенты обновлены.",
    am: "Բոլոր գործակալները թարմ են:",
  },
  "agentUpdates.hasUpdate": {
    en: "A newer version is available. Install it for every agent in your branches.",
    ru: "Доступна новая версия. Установите её на всех агентах ваших филиалов.",
    am: "Հասանելի է նոր տարբերակ: Տեղադրեք այն ձեր մասնաճյուղերի բոլոր գործակալներում:",
  },
  "agentUpdates.promoteBtn": {
    en: "Install new version on all agents and restart",
    ru: "Установить новую версию на всех агентах и перезапустить",
    am: "Տեղադրել նոր տարբերակը բոլոր գործակալներում և վերագործարկել",
  },
  "agentUpdates.promoting": {
    en: "Applying…",
    ru: "Применяем…",
    am: "Կիրառվում է…",
  },
  "agentUpdates.cannotPromote": {
    en: "Cannot apply — backend could not fetch the latest release from GitHub.",
    ru: "Не удалось применить — backend не смог получить релиз с GitHub.",
    am: "Չհաջողվեց կիրառել — backend-ը չի կարողացել ստանալ թողարկումը GitHub-ից:",
  },
  "agentUpdates.approvedVersion": {
    en: "Approved by administrator",
    ru: "Одобрено администратором",
    am: "Հաստատված է ադմինիստրատորի կողմից",
  },
  "agentUpdates.notApprovedYet": {
    en: "No update has been approved by an administrator yet. You will be able to roll it out to your branches once it is approved.",
    ru: "Администратор ещё не одобрил обновление. Как только он его одобрит, вы сможете применить его в своих филиалах.",
    am: "Ադմինիստրատորը դեռ չի հաստատել թարմացումը: Հաստատվելուց հետո դուք կկարողանաք կիրառել այն ձեր մասնաճյուղերում:",
  },
  "agentUpdates.venuePcs": {
    en: "PCs in your branches",
    ru: "ПК в ваших филиалах",
    am: "Համակարգիչներ ձեր մասնաճյուղերում",
  },
  "agentUpdates.applyBtn": {
    en: "Apply approved version to my branches",
    ru: "Применить одобренную версию в моих филиалах",
    am: "Կիրառել հաստատված տարբերակը իմ մասնաճյուղերում",
  },
  "agentUpdates.applied": {
    en: "Sent to your PCs. Each agent downloads in the background and prompts the cashier to restart.",
    ru: "Отправлено на ваши ПК. Каждый агент скачает обновление фоном и предложит кассиру перезапуск.",
    am: "Ուղարկվեց ձեր համակարգիչներին: Յուրաքանչյուր գործակալ ֆոնում կներբեռնի և կհուշի կասսային վերագործարկել:",
  },
  "agentUpdates.noVenuePcs": {
    en: "No PCs are registered in your branches yet.",
    ru: "В ваших филиалах пока нет зарегистрированных ПК.",
    am: "Ձեր մասնաճյուղերում դեռ գրանցված համակարգիչներ չկան:",
  },
  // ── CRUD toast messages (top-right notifications) ──────────────────────
  "toast.generic.created": { en: "Created successfully", ru: "Успешно создано", am: "Հաջողությամբ ստեղծվեց" },
  "toast.generic.updated": { en: "Updated successfully", ru: "Успешно изменено", am: "Հաջողությամբ թարմացվեց" },
  "toast.generic.deleted": { en: "Deleted successfully", ru: "Успешно удалено", am: "Հաջողությամբ ջնջվեց" },
  "toast.generic.error":   { en: "Something went wrong", ru: "Что-то пошло не так", am: "Ինչ-որ բան սխալ գնաց" },

  "toast.place.created": { en: "New place created", ru: "Новое место создано", am: "Նոր տեղ ստեղծվեց" },
  "toast.place.updated": { en: "Place updated", ru: "Место обновлено", am: "Տեղը թարմացվեց" },
  "toast.place.deleted": { en: "Place deleted", ru: "Место удалено", am: "Տեղը ջնջվեց" },

  "toast.pc.created": { en: "Device added", ru: "Устройство добавлено", am: "Սարքն ավելացվեց" },
  "toast.pc.updated": { en: "Device updated", ru: "Устройство обновлено", am: "Սարքը թարմացվեց" },
  "toast.pc.deleted": { en: "Device removed", ru: "Устройство удалено", am: "Սարքը հեռացվեց" },

  "toast.member.created": { en: "Member added", ru: "Клиент добавлен", am: "Հաճախորդն ավելացվեց" },
  "toast.member.updated": { en: "Member updated", ru: "Клиент обновлён", am: "Հաճախորդը թարմացվեց" },
  "toast.member.deleted": { en: "Member removed", ru: "Клиент удалён", am: "Հաճախորդը հեռացվեց" },

  "toast.product.created": { en: "Product created", ru: "Товар создан", am: "Ապրանքը ստեղծվեց" },
  "toast.product.updated": { en: "Product updated", ru: "Товар обновлён", am: "Ապրանքը թարմացվեց" },
  "toast.product.deleted": { en: "Product deleted", ru: "Товар удалён", am: "Ապրանքը ջնջվեց" },

  "toast.service.created": { en: "Service created", ru: "Услуга создана", am: "Ծառայությունը ստեղծվեց" },
  "toast.service.updated": { en: "Service updated", ru: "Услуга обновлена", am: "Ծառայությունը թարմացվեց" },
  "toast.service.deleted": { en: "Service deleted", ru: "Услуга удалена", am: "Ծառայությունը ջնջվեց" },

  "toast.manager.created": { en: "Manager created", ru: "Менеджер создан", am: "Մենեջերը ստեղծվեց" },
  "toast.manager.updated": { en: "Manager updated", ru: "Менеджер обновлён", am: "Մենեջերը թարմացվեց" },
  "toast.manager.deleted": { en: "Manager removed", ru: "Менеджер удалён", am: "Մենեջերը հեռացվեց" },

  "toast.company.created": { en: "Company created", ru: "Компания создана", am: "Ընկերությունը ստեղծվեց" },
  "toast.company.updated": { en: "Company updated", ru: "Компания обновлена", am: "Ընկերությունը թարմացվեց" },
  "toast.company.deleted": { en: "Company deleted", ru: "Компания удалена", am: "Ընկերությունը ջնջվեց" },

  "toast.branch.created": { en: "Branch created", ru: "Филиал создан", am: "Մասնաճյուղը ստեղծվեց" },
  "toast.branch.updated": { en: "Branch updated", ru: "Филиал обновлён", am: "Մասնաճյուղը թարմացվեց" },
  "toast.branch.deleted": { en: "Branch deleted", ru: "Филиал удалён", am: "Մասնաճյուղը ջնջվեց" },

  "toast.game.created": { en: "Game added", ru: "Игра добавлена", am: "Խաղն ավելացվեց" },
  "toast.game.updated": { en: "Game updated", ru: "Игра обновлена", am: "Խաղը թարմացվեց" },
  "toast.game.deleted": { en: "Game removed", ru: "Игра удалена", am: "Խաղը հեռացվեց" },

  "toast.tournament.created": { en: "Tournament created", ru: "Турнир создан", am: "Մրցաշարը ստեղծվեց" },
  "toast.tournament.updated": { en: "Tournament updated", ru: "Турнир обновлён", am: "Մրցաշարը թարմացվեց" },
  "toast.tournament.deleted": { en: "Tournament deleted", ru: "Турнир удалён", am: "Մրցաշարը ջնջվեց" },

  "updates.title": {
    en: "Desktop app updates",
    ru: "Обновления десктоп-приложений",
    am: "Աշխատասեղանի հավելվածների թարմացումներ",
  },
  "updates.checkBtn": {
    en: "Check for updates",
    ru: "Проверить наличие обновлений",
    am: "Ստուգել թարմացումները",
  },
  "updates.promoteBtn": {
    en: "Apply updates to all installations",
    ru: "Внести обновления во всех приложениях",
    am: "Կիրառել թարմացումները բոլոր ինստալյացիաներում",
  },
  "updates.checking": { en: "Checking…", ru: "Проверяем…", am: "Ստուգում…" },
  "updates.promoting": { en: "Applying…", ru: "Применяем…", am: "Կիրառվում է…" },
  "updates.noUpdates": { en: "All apps are up to date.", ru: "Обновлений нет.", am: "Բոլոր հավելվածները թարմ են:" },
  "updates.hasUpdates": {
    en: "Updates available — apply to roll out to all partner installations.",
    ru: "Доступны обновления — нажмите, чтобы применить их во всех инсталляциях у партнёров.",
    am: "Կան թարմացումներ — սեղմեք, որպեսզի կիրառեք բոլոր ինստալյացիաներում:",
  },
  "updates.appPanel": { en: "Staff panel", ru: "Десктоп для персонала", am: "Աշխատակազմի վահանակ" },
  "updates.appAgent": { en: "Kiosk agent", ru: "Агент-киоск", am: "Կիոսկ-գործակալ" },
  "updates.colCurrent": { en: "Current version", ru: "Текущая версия", am: "Ընթացիկ տարբերակը" },
  "updates.colAvailable": { en: "Latest on GitHub", ru: "Последняя на GitHub", am: "Վերջինը GitHub-ում" },
  "updates.colStatus": { en: "Status", ru: "Статус", am: "Կարգավիճակ" },
  "updates.statusUpToDate": { en: "Up to date", ru: "Актуально", am: "Թարմ է" },
  "updates.statusUpdateAvailable": { en: "Update available", ru: "Доступно обновление", am: "Հասանելի թարմացում" },
  "updates.statusNoPromoted": { en: "Not promoted yet", ru: "Не опубликовано", am: "Դեռ չի հրապարակվել" },
  "updates.statusError": { en: "Error", ru: "Ошибка", am: "Սխալ" },
  "updates.localTitle": { en: "This installation", ru: "Эта установка", am: "Այս ինստալյացիան" },
  "updates.localIdle": { en: "No active update operation.", ru: "Активного обновления нет.", am: "Ակտիվ թարմացում չկա:" },
  "updates.localChecking": { en: "Checking GitHub for a newer version…", ru: "Проверяем GitHub на новую версию…", am: "Ստուգում ենք GitHub-ը նոր տարբերակի համար…" },
  "updates.localAvailable": { en: "Found v{0}. Downloading…", ru: "Найдена v{0}. Загружаем…", am: "Գտնվեց v{0}. ներբեռնում…" },
  "updates.localDownloading": { en: "Downloading {0}%…", ru: "Загрузка {0}%…", am: "Ներբեռնում {0}%…" },
  "updates.localDownloaded": { en: "v{0} is ready — click Install & restart.", ru: "v{0} готова — нажмите «Установить и перезапустить».", am: "v{0}-ը պատրաստ է — սեղմեք «Տեղադրել և վերագործարկել»:" },
  "updates.localError": { en: "Error: {0}", ru: "Ошибка: {0}", am: "Սխալ՝ {0}" },
  "updates.installNow": { en: "Install & restart", ru: "Установить и перезапустить", am: "Տեղադրել և վերագործարկել" },
  "updates.toastTitle": {
    en: "New update available",
    ru: "Доступно новое обновление",
    am: "Հասանելի է նոր թարմացում",
  },
  "updates.toastPanel": {
    en: "You have a new update for your desktop app.",
    ru: "У вас есть новое обновление для вашего десктоп-приложения.",
    am: "Ձեր դեսքթոփ-հավելվածի համար նոր թարմացում կա:",
  },
  "updates.toastAgent": {
    en: "You have a new update for your kiosk locker.",
    ru: "У вас есть новое обновление для вашего блокировщика.",
    am: "Ձեր կիոսկ-արգելափակիչի համար նոր թարմացում կա:",
  },
  "updates.toastCta": {
    en: "Click to open the updates section",
    ru: "Нажмите, чтобы открыть раздел обновлений",
    am: "Սեղմեք՝ բացելու թարմացումների բաժինը",
  },
  "updates.readyModalTitle": {
    en: "New update installed",
    ru: "Установлено новое обновление",
    am: "Տեղադրվել է նոր թարմացում",
  },
  "updates.readyModalBody": {
    en: "Version {0} has been downloaded. Restart the app to finish the update.",
    ru: "Версия {0} загружена. Перезапустите приложение, чтобы завершить обновление.",
    am: "Տարբերակ {0}-ը ներբեռնված է: Վերագործարկեք հավելվածը՝ թարմացումն ավարտելու համար:",
  },
  "updates.readyModalRestart": {
    en: "Restart application",
    ru: "Перезапустить приложение",
    am: "Վերագործարկել հավելվածը",
  },
  "updates.cannotPromote": {
    en: "Cannot apply — backend could not fetch the latest release from GitHub. Check the GH_RELEASES_REPO_* env vars on the server.",
    ru: "Не удалось применить — backend не смог получить релиз с GitHub. Проверьте переменные GH_RELEASES_REPO_* на сервере.",
    am: "Չհաջողվեց կիրառել — backend-ը չի կարողացել ստանալ թողարկումը GitHub-ից:",
  },

  // ─── i18n audit fixes (2026-05-30): previously hardcoded strings ───
  "error.invalidBranchId": { en: "Invalid branch id.", ru: "Неверный ID филиала.", am: "Մասնաճյուղի սխալ ID:" },
  "error.invalidCompanyId": { en: "Invalid company id.", ru: "Неверный ID компании.", am: "Ընկերության սխալ ID:" },
  "error.invalidTournamentId": { en: "Invalid tournament id.", ru: "Неверный ID турнира.", am: "Մրցաշարի սխալ ID:" },
  "error.noCompanyLinked": { en: "No company linked to this account.", ru: "К этому аккаунту не привязана компания.", am: "Այս հաշվին ընկերություն կապված չէ:" },
  "branch.rating": { en: "Rating", ru: "Рейтинг", am: "Վարկանիշ" },

  // BranchEdit overview
  "branchEdit.title": { en: "Branch · {0}", ru: "Филиал · {0}", am: "Մասնաճյուղ · {0}" },
  "branchEdit.editInfo": { en: "Edit info", ru: "Изменить данные", am: "Խմբագրել տվյալները" },
  "branchEdit.confirmDelete": { en: "Delete this branch and all related data?", ru: "Удалить этот филиал и все связанные данные?", am: "Ջնջե՞լ այս մասնաճյուղը և բոլոր կապված տվյալները:" },

  // BranchServices screen
  "branchServices.title": { en: "Services · branch №{0}", ru: "Услуги · филиал №{0}", am: "Ծառայություններ · մասնաճյուղ №{0}" },
  "branchServices.instruction": { en: "Toggle which services this branch provides.", ru: "Отметьте, какие услуги предоставляет филиал.", am: "Նշեք, թե որ ծառայություններն է մատուցում մասնաճյուղը:" },
  "branchServices.empty": { en: "No services exist globally yet.", ru: "Глобальных услуг ещё нет.", am: "Գլոբալ ծառայություններ դեռ չկան:" },

  // CompanyBranches list
  "companyBranches.title": { en: "Branches of company №{0}", ru: "Филиалы компании №{0}", am: "№{0} ընկերության մասնաճյուղերը" },
  "companyBranches.back": { en: "← Back to company", ru: "← Назад к компании", am: "← Վերադառնալ ընկերություն" },
  "companyBranches.newBranch": { en: "+ New branch", ru: "+ Новый филиал", am: "+ Նոր մասնաճյուղ" },
  "companyBranches.empty": { en: "No branches yet for this company.", ru: "У этой компании ещё нет филиалов.", am: "Այս ընկերությունը դեռ մասնաճյուղեր չունի:" },

  // Working-hours form title
  "openDays.title": { en: "Working hours · {0}", ru: "Часы работы · {0}", am: "Աշխատանքային ժամեր · {0}" },

  // TournamentDetails rows
  "tournamentDetails.end": { en: "End", ru: "Конец", am: "Ավարտ" },
  "tournamentDetails.players": { en: "Players", ru: "Игроки", am: "Խաղացողներ" },

  // ErrorBoundary
  "errorBoundary.title": { en: "Something went wrong", ru: "Что-то пошло не так", am: "Ինչ-որ բան սխալ գնաց" },
  "errorBoundary.tryAgain": { en: "Try again", ru: "Повторить", am: "Կրկնել" },
  "errorBoundary.reload": { en: "Reload app", ru: "Перезапустить приложение", am: "Վերագործարկել հավելվածը" },

  // CommissionInput
  "commission.label": { en: "Commission percent", ru: "Процент комиссии", am: "Միջնորդավճարի տոկոս" },
  "commission.hint": { en: "0–100%. Stored locally on this device.", ru: "0–100%. Хранится локально на этом устройстве.", am: "0–100%: Պահվում է տեղում՝ այս սարքում:" },

  // PcForm
  "pcForm.macAddress": { en: "MAC address", ru: "MAC-адрес", am: "MAC հասցե" },

  // Emergency unlock PIN (BranchUnlockPinCard)
  "unlockPin.title": { en: "Emergency unlock PIN", ru: "PIN экстренного разблокирования", am: "Արտակարգ ապակողպման PIN" },
  "unlockPin.desc": { en: "The cashier can enter this PIN right on a locked PC if the link to the panel or server is lost. Works even offline. A 4–6 digit PIN.", ru: "Кассир сможет ввести этот PIN прямо на заблокированном ПК, если связь с панелью или сервером пропала. Работает даже офлайн. PIN из 4–6 цифр.", am: "Գանձապահը կարող է մուտքագրել այս PIN-ը անմիջապես կողպված ՀՀ-ի վրա, եթե կապը վահանակի կամ սերվերի հետ կորել է: Աշխատում է նույնիսկ օֆլայն: 4–6 թվանշանից PIN:" },
  "unlockPin.current": { en: "Current PIN", ru: "Текущий PIN", am: "Ընթացիկ PIN" },
  "unlockPin.notSet": { en: "PIN not set yet", ru: "PIN ещё не установлен", am: "PIN-ը դեռ սահմանված չէ" },
  "unlockPin.hide": { en: "Hide PIN", ru: "Скрыть PIN", am: "Թաքցնել PIN-ը" },
  "unlockPin.show": { en: "Show PIN", ru: "Показать PIN", am: "Ցույց տալ PIN-ը" },
  "unlockPin.change": { en: "Change PIN", ru: "Изменить PIN", am: "Փոխել PIN-ը" },
  "unlockPin.set": { en: "Set PIN", ru: "Установить PIN", am: "Սահմանել PIN" },
  "unlockPin.update": { en: "Update PIN", ru: "Обновить PIN", am: "Թարմացնել PIN-ը" },
  "unlockPin.newPlaceholder": { en: "New PIN", ru: "Новый PIN", am: "Նոր PIN" },
  "unlockPin.invalid": { en: "PIN must be 4–6 digits", ru: "PIN должен содержать 4–6 цифр", am: "PIN-ը պետք է լինի 4–6 թվանշան" },
  "unlockPin.saveFailed": { en: "Failed to save PIN", ru: "Не удалось сохранить PIN", am: "Չհաջողվեց պահպանել PIN-ը" },
  "unlockPin.setAt": { en: "Set · {0}", ru: "Установлен · {0}", am: "Սահմանված է · {0}" },
  "unlockPin.saved": { en: "Saved.", ru: "Сохранено.", am: "Պահպանված է:" },

  // CompanyBillingCard
  "billing.title": { en: "Billing", ru: "Оплата", am: "Վճարում" },
  "billing.markPaidConfirm": { en: "Mark {0} as paid? This shifts the next-due date by one month.", ru: "Отметить {0} как оплачено? Дата следующего платежа сдвинется на месяц.", am: "Նշե՞լ {0}-ը որպես վճարված: Հաջորդ վճարման ամսաթիվը կտեղափոխվի մեկ ամսով:" },
  "billing.notDeployed": { en: "Billing endpoints not deployed yet.", ru: "Эндпоинты оплаты ещё не развёрнуты.", am: "Վճարման endpoint-ները դեռ տեղադրված չեն:" },
  "billing.noInfo": { en: "No billing info.", ru: "Нет данных об оплате.", am: "Վճարման տվյալներ չկան:" },
  "billing.commissionRate": { en: "Commission rate", ru: "Ставка комиссии", am: "Միջնորդավճարի դրույք" },
  "billing.lastPaid": { en: "Last paid", ru: "Последняя оплата", am: "Վերջին վճարում" },
  "billing.nextDue": { en: "Next due", ru: "Следующий платёж", am: "Հաջորդ վճարում" },
  "billing.timeLeft": { en: "Time left", ru: "Осталось", am: "Մնացել է" },
  "billing.overdueBy": { en: "Overdue by {0} day(s)", ru: "Просрочено на {0} дн.", am: "Ուշացած {0} օրով" },
  "billing.daysLeft": { en: "{0} day(s) left", ru: "Осталось {0} дн.", am: "Մնացել է {0} օր" },
  "billing.adminReminder": { en: "⚠ Company {0} must pay for the program in {1} day(s).", ru: "⚠ Компания {0} должна оплатить программу через {1} дн.", am: "⚠ {0} ընկերությունը պետք է վճարի ծրագրի համար {1} օրից:" },
  "billing.ownerReminder": { en: "⚠ In {0} day(s) you must pay Cyber Place.", ru: "⚠ Через {0} дн. вам нужно оплатить Cyber Place.", am: "⚠ {0} օրից դուք պետք է վճարեք Cyber Place:" },
  "billing.adminOverdue": { en: "Company {0} is overdue. Status will switch to pending automatically.", ru: "Компания {0} просрочила оплату. Статус переключится на «ожидание» автоматически.", am: "{0} ընկերությունը ուշացրել է վճարումը: Կարգավիճակն ավտոմատ կփոխվի «սպասման»:" },
  "billing.ownerOverdue": { en: "Payment to Cyber Place is overdue. Your company status has been set to pending.", ru: "Оплата Cyber Place просрочена. Статус вашей компании переведён в «ожидание».", am: "Cyber Place-ի վճարումը ուշացած է: Ձեր ընկերության կարգավիճակը դրվել է «սպասման»:" },
  "billing.markPaidHint": { en: "Marking as paid sets last paid = now and next due = +1 month.", ru: "Отметка «оплачено» ставит последнюю оплату = сейчас и следующий платёж = +1 месяц.", am: "«Վճարված» նշումը սահմանում է վերջին վճարումը = հիմա, հաջորդը = +1 ամիս:" },
  "billing.markPaid": { en: "Mark as paid", ru: "Отметить оплаченным", am: "Նշել վճարված" },

  // PosTerminal
  "pos.paid": { en: "Paid {0} ({1})", ru: "Оплачено {0} ({1})", am: "Վճարված {0} ({1})" },
  "pos.checkoutFailed": { en: "Checkout failed", ru: "Не удалось провести оплату", am: "Վճարումը ձախողվեց" },
  "pos.noProducts": { en: "No active products. Add some in the Products page.", ru: "Нет активных товаров. Добавьте их на странице «Товары».", am: "Ակտիվ ապրանքներ չկան: Ավելացրեք դրանք «Ապրանքներ» էջում:" },
  "pos.processing": { en: "Processing…", ru: "Обработка…", am: "Մշակում…" },
  "pos.charge": { en: "Charge {0}", ru: "Списать {0}", am: "Գանձել {0}" },
  "pos.otherCategory": { en: "Other", ru: "Прочее", am: "Այլ" },
  "pos.terminalTab": { en: "Terminal", ru: "Терминал", am: "Տերմինալ" },
  "pos.historyTab": { en: "History", ru: "История", am: "Պատմություն" },
  "pos.histCount": { en: "Orders", ru: "Продажи", am: "Վաճառքներ" },
  "pos.histSum": { en: "Revenue", ru: "Выручка", am: "Հասույթ" },
  "pos.histEmpty": { en: "No orders in this period.", ru: "Нет продаж за выбранный период.", am: "Ընտրված ժամանակահատվածում վաճառքներ չկան:" },
  "pos.statusPaid": { en: "Paid", ru: "Оплачено", am: "Վճարված" },
  "pos.statusVoided": { en: "Voided", ru: "Отменён", am: "Չեղарկված" },
  "pos.cashier": { en: "Cashier", ru: "Кассир", am: "Գանձապահ" },
  "pos.shift": { en: "Shift", ru: "Смена", am: "Հերթափոխ" },

  // Company country picker + TIN validation
  "company.selectCountry": { en: "— select country —", ru: "— выберите страну —", am: "— ընտրեք երկիր —" },
  "tin.invalid": { en: "Invalid TIN for the selected country (e.g. {0})", ru: "Неверный ИНН для выбранной страны (например: {0})", am: "Սխալ ՀՎՀՀ ընտրված երկրի համար (օրինակ՝ {0})" },
  "tin.invalidGeneric": { en: "Invalid TIN format", ru: "Неверный формат ИНН", am: "ՀՎՀՀ-ի սխալ ձևաչափ" },
  "company.selectCountryFirst": { en: "Select a country first", ru: "Сначала выберите страну", am: "Սկզբում ընտրեք երկիր" },
};

export const t = (key: string, lang: Lang): string => {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
};

/**
 * Module-level mirror of the active language, kept in sync by
 * LanguageProvider. Lets non-hook call sites (e.g. the class-based
 * ErrorBoundary that lives outside the React tree the provider serves)
 * translate via `tActive(...)` without a context.
 */
let activeLang: Lang = "en";
export const setActiveLang = (l: Lang): void => {
  activeLang = l;
};
export const tActive = (key: string): string => t(key, activeLang);
