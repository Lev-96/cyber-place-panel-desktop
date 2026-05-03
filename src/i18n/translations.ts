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
  "pcs.title": { en: "PCs", ru: "ПК", am: "Համակարգիչներ" },
  "pcs.register": { en: "+ Register device", ru: "+ Зарегистрировать устройство", am: "+ Գրանցել սարք" },
  "pcs.editDevice": { en: "Edit device", ru: "Редактировать устройство", am: "Խմբագրել սարքը" },
  "pcs.newDevice": { en: "Register new device", ru: "Зарегистрировать устройство", am: "Գրանցել նոր սարք" },
  "pcs.kind": { en: "Device type", ru: "Тип устройства", am: "Սարքի տեսակը" },
  "pcs.kindPc": { en: "PC (with agent)", ru: "ПК (с агентом)", am: "ՀՀ (գործակալով)" },
  "pcs.kindPs": { en: "PlayStation / console", ru: "PlayStation / консоль", am: "PlayStation / կոնսոլ" },
  "pcs.psHint": { en: "No agent runs on a console — billing-only device: timer + cost.", ru: "На консоль агент не ставится — это билинг-устройство: только таймер и расчёт стоимости.", am: "Կոնսոլի վրա գործակալ չի տեղադրվում — միայն ժամանաչափ և գումար:" },
  "pcs.label": { en: "Label (e.g. PC #5)", ru: "Метка (напр. PC #5)", am: "Պիտակ (օր. PC #5)" },
  "pcs.macHint": { en: "Used only for Wake-on-LAN. The PC connects via the agent app paired with the token.", ru: "Используется только для Wake-on-LAN. ПК подключается через агент с токеном, не через MAC.", am: "Օգտագործվում է միայն Wake-on-LAN-ի համար:" },
  "pcs.placeId": { en: "Linked place id (optional)", ru: "ID места (необязательно)", am: "Տեղի ID (ընտրովի)" },
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
  "bookingDetails.reschedule": { en: "Reschedule", ru: "Перенести", am: "Տեղափոխել" },
  "bookingDetails.cancel": { en: "Cancel", ru: "Отменить", am: "Չեղարկել" },
  "bookingDetails.rate": { en: "Rate branch", ru: "Оценить филиал", am: "Գնահատել մասնաճյուղը" },
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
  "settings.autoByLang": { en: "Auto (by language)", ru: "Авто (по языку)", am: "Ավտոմատ (լեզվով)" },
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

  // Branch form
  "branch.titleNew": { en: "New branch", ru: "Новый филиал", am: "Նոր մասնաճյուղ" },
  "branch.titleEdit": { en: "Edit branch", ru: "Редактировать филиал", am: "Խմբագրել մասնաճյուղը" },
  "branch.address": { en: "Address", ru: "Адрес", am: "Հասցե" },
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
  "pos.card": { en: "Card", ru: "Карта", am: "Քարտ" },
  "pos.balance": { en: "Member balance", ru: "Баланс клиента", am: "Անդամի մնացորդ" },
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
  "booking.rescheduleId": { en: "Reschedule booking", ru: "Перенести бронь", am: "Տեղափոխել ամրագրումը" },
  "booking.rescheduleMinutes": { en: "Rescheduled minutes (delay)", ru: "Сдвиг в минутах", am: "Փոխանցում րոպեներով" },
  "booking.rescheduleHint": { en: "Positive = later, negative = earlier (if backend allows).", ru: "Положительное = позже, отрицательное = раньше.", am: "Դրականը = ավելի ուշ, բացասականը = ավելի շուտ:" },
  "booking.reschedule": { en: "Reschedule", ru: "Перенести", am: "Տեղափոխել" },
  "booking.reschedEnterNumber": { en: "Enter a number", ru: "Введите число", am: "Մուտքագրեք թիվ" },
  "booking.rateBranchTitle": { en: "Rate branch", ru: "Оценить филиал", am: "Գնահատել մասնաճյուղը" },
  "booking.stars": { en: "Stars", ru: "Звёзды", am: "Աստղեր" },
  "booking.commentOpt": { en: "Comment (optional)", ru: "Комментарий (необязательно)", am: "Մեկնաբանություն (ընտրովի)" },
  "booking.sending": { en: "Sending…", ru: "Отправка…", am: "Ուղարկվում է…" },
  "booking.submitRating": { en: "Submit rating", ru: "Отправить оценку", am: "Ուղարկել գնահատականը" },

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
};

export const t = (key: string, lang: Lang): string => {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
};
