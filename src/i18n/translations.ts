export type Lang = "en" | "ru" | "am";

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
  "label.price": { en: "Price", ru: "Цена", am: "Գին" },
  "label.balance": { en: "Balance", ru: "Баланс", am: "Մնացորդ" },
  "label.name": { en: "Name", ru: "Имя", am: "Անուն" },
  "label.phone": { en: "Phone", ru: "Телефон", am: "Հեռախոս" },

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
