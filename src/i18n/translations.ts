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

/**
 * `name` is the ENDONYM — the language's name in itself. That is what a person
 * scanning the picker recognises: someone who only reads Armenian cannot find
 * "Armenian" in a list, but finds "Հայերեն" instantly. `latin` is the English
 * name, shown underneath as a secondary line so the list is also navigable by
 * someone who doesn't read the script.
 *
 * Adding a language is one entry here plus one flag in `FlagIcon` — no other
 * file knows how many languages exist.
 */
export const LANGUAGES: Array<{ code: Lang; name: string; latin: string }> = [
  { code: "en", name: "English", latin: "English" },
  { code: "ru", name: "Русский", latin: "Russian" },
  { code: "am", name: "Հայերեն", latin: "Armenian" },
];

type Dict = Record<string, { en: string; ru: string; am: string }>;

export const TRANSLATIONS: Dict = {
  // Navigation
  "nav.dashboard": { en: "Dashboard", ru: "Панель", am: "Կառավարման էջ" },
  "nav.branches": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "nav.myBranch": { en: "My branch", ru: "Мой филиал", am: "Իմ մասնաճյուղը" },
  "nav.map": { en: "Map", ru: "Карта", am: "Քարտեզ" },
  "nav.bookings": { en: "Bookings", ru: "Бронирования", am: "Ամրագրումներ" },
  "nav.scan": { en: "Scan / Confirm", ru: "Сканировать", am: "Սկան / Հաստատում" },
  "nav.tournaments": { en: "Tournaments", ru: "Турниры", am: "Մրցաշարեր" },
  "nav.games": { en: "Games", ru: "Игры", am: "Խաղեր" },
  "nav.companies": { en: "Companies", ru: "Компании", am: "Ընկերություններ" },
  "nav.revenue": { en: "Revenue", ru: "Выручка", am: "Եկամուտ" },
  "nav.expenses": { en: "Expenses", ru: "Расходы", am: "Ծախսեր" },
  "nav.metrics": { en: "Metrics", ru: "Метрики", am: "Մետրիկա" },
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
    am: "Մոռացե՞լ եք գաղտնաբառը",
  },

  // Common actions
  "action.save": { en: "Save", ru: "Сохранить", am: "Պահպանել" },
  "action.continue": { en: "Continue", ru: "Продолжить", am: "Շարունակել" },
  "action.cancel": { en: "Cancel", ru: "Отмена", am: "Չեղարկել" },
  "action.retry": { en: "Retry", ru: "Повторить", am: "Կրկնել" },
  // A plain yes/no pair. Introduced for the place form's "is a 4th joystick
  // needed?" question, which is a question and not a toggle: a switch would
  // have to be labelled with what it does when it is ON, and "4th joystick"
  // beside a switch reads as "this seat has one".
  "action.yes": { en: "Yes", ru: "Да", am: "Այո" },
  "action.no": { en: "No", ru: "Нет", am: "Ոչ" },
  "action.edit": { en: "Edit", ru: "Изменить", am: "Խմբագրել" },
  "action.delete": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "action.add": { en: "Add", ru: "Добавить", am: "Ավելացնել" },
  "action.create": { en: "Create", ru: "Создать", am: "Ստեղծել" },
  "action.start": { en: "Start", ru: "Старт", am: "Սկսել" },
  "action.stop": { en: "Stop", ru: "Стоп", am: "Կանգնեցնել" },
  "action.confirm": { en: "Confirm", ru: "Подтвердить", am: "Հաստատել" },
  "action.refresh": { en: "Refresh", ru: "Обновить", am: "Թարմացնել" },
  "action.close": { en: "Close", ru: "Закрыть", am: "Փակել" },
  // For screen readers — controls that show only an icon or a spinner.
  "a11y.loading": { en: "Loading", ru: "Загрузка", am: "Բեռնվում է" },
  "a11y.increase": { en: "Increase", ru: "Увеличить", am: "Ավելացնել" },
  "a11y.decrease": { en: "Decrease", ru: "Уменьшить", am: "Պակասեցնել" },
  "a11y.pagination": { en: "Pages", ru: "Страницы", am: "Էջեր" },
  "a11y.prevPage": { en: "Previous page", ru: "Предыдущая страница", am: "Նախորդ էջ" },
  "a11y.nextPage": { en: "Next page", ru: "Следующая страница", am: "Հաջորդ էջ" },
  // The short date field's hint: day.month.year in each language's letters.
  "date.placeholderShort": { en: "dd.mm.yy", ru: "дд.мм.гг", am: "օօ.աա.տտ" },
  "company.commissionExample": { en: "e.g. 2", ru: "напр. 2", am: "օր. 2" },
  "updates.colApp": { en: "App", ru: "Приложение", am: "Հավելված" },
  "qr.tooLong": { en: "Too much data for a QR code", ru: "Слишком много данных для QR-кода", am: "QR կոդի համար տվյալները շատ են" },
  // Asked by every dialog before a close that would throw typed changes away
  // (the ×, a backdrop click, Escape). Answered with action.yes / action.no.
  "modal.leaveConfirm": {
    en: "Are you sure you want to leave?",
    ru: "Вы действительно хотите выйти?",
    am: "Իսկապե՞ս ուզում եք դուրս գալ։",
  },
  "action.back": { en: "Back", ru: "Назад", am: "Հետ" },

  // Sessions
  "session.start": { en: "Start session", ru: "Старт сессии", am: "Սկսել սեսիան" },
  // "Товар", not "позиция": what the cashier adds is a product off the shelf,
  // and the branch's own catalogue screen already calls them товары.
  // ── Support desk ───────────────────────────────────────────────────────
  "nav.supportHint": {
    en: "Message Cyber Place support",
    ru: "Связаться с поддержкой",
    am: "Կապվել աջակցության հետ",
  },
  // PlayStation discovery — phase one of the console integration. The wording
  // promises exactly what it does: it looks, it does not control.
  "ps5.discover.open": { en: "Find PlayStations", ru: "Найти PlayStation", am: "Գտնել PlayStation-ներ" },
  "ps5.discover.title": { en: "PlayStations on this network", ru: "PlayStation в этой сети", am: "PlayStation-ներն այս ցանցում" },
  "ps5.discover.hint": {
    en: "Scanned from this computer, not from the server.",
    ru: "Поиск идёт с этого компьютера, а не с сервера.",
    am: "Որոնումն այս համակարգչից է, ոչ թե սերվերից։",
  },
  "ps5.discover.none": {
    en: "Nothing answered. The consoles must be on the same network as this computer and switched on or resting.",
    ru: "Никто не ответил. Консоли должны быть в той же сети, что и этот компьютер, и быть включены или в режиме покоя.",
    am: "Ոչ մի սարք չպատասխանեց։ Կոնսոլները պետք է լինեն այս համակարգչի հետ նույն ցանցում և լինեն միացված կամ քնի ռեժիմում։",
  },
  "ps5.discover.probed": { en: "Looked at", ru: "Опрошено", am: "Հարցվել է" },
  "ps5.discover.scanning": { en: "Searching…", ru: "Ищем…", am: "Որոնում…" },
  "ps5.discover.rescan": { en: "Search again", ru: "Искать снова", am: "Որոնել կրկին" },
  "ps5.discover.desktopOnly": {
    en: "Console search works only in the desktop app.",
    ru: "Поиск консолей работает только в десктопном приложении.",
    am: "Կոնսոլների որոնումն աշխատում է միայն դեսքթոփ հավելվածում։",
  },
  "ps5.state.awake": { en: "On", ru: "Включена", am: "Միացված" },
  "ps5.state.rest": { en: "Resting", ru: "Режим покоя", am: "Քնի ռեժիմ" },
  "ps5.state.unreachable": { en: "Unreachable", ru: "Недоступна", am: "Անհասանելի" },
  "ps5.state.unknown": { en: "Unrecognised answer", ru: "Ответ не распознан", am: "Պատասխանը չի ճանաչվել" },
  // Binding a found console to the place it stands in. Owner-level wording:
  // this is arranging the venue, not running the shift.
  "ps5.bind.attach": { en: "Attach", ru: "Привязать", am: "Կապել" },
  "ps5.bind.detach": { en: "Detach", ru: "Отвязать", am: "Անջատել" },
  "ps5.bind.choosePlace": { en: "Choose a place…", ru: "Выберите место…", am: "Ընտրեք տեղը…" },
  "ps5.bind.noFreePlaces": {
    en: "Every console place already has one",
    ru: "У всех консольных мест уже есть приставка",
    am: "Բոլոր կոնսոլային տեղերն արդեն ունեն կոնսոլ",
  },
  // Not the same thing as the line above, and telling an owner "every console
  // place already has one" when the branch has no console place at all sends
  // them looking for a place that does not exist.
  // The places that already have a console — including ones whose console is
  // nowhere on this network, which is the only way to free them up again.
  "ps5.bound.title": { en: "Places with a console", ru: "Места с привязанной приставкой", am: "Կոնսոլով տեղեր" },
  "ps5.bound.here": { en: "on this network", ru: "в этой сети", am: "այս ցանցում" },
  "ps5.bound.elsewhere": {
    en: "not found on this network",
    ru: "в этой сети не найдена",
    am: "այս ցանցում չի գտնվել",
  },
  "ps5.bind.loadingPlaces": { en: "Loading places…", ru: "Загружаем места…", am: "Բեռնում ենք տեղերը…" },
  "ps5.bind.placesFailed": {
    en: "Could not load this branch's places",
    ru: "Не удалось загрузить места филиала",
    am: "Չհաջողվեց բեռնել մասնաճյուղի տեղերը",
  },
  "ps5.bind.retry": { en: "Retry", ru: "Повторить", am: "Կրկնել" },
  "ps5.bind.noConsolePlaces": {
    en: "This branch has no console place yet. Create one first",
    ru: "В филиале ещё нет консольного места. Сначала создайте его",
    am: "Մասնաճյուղում դեռ չկա կոնսոլային տեղ։ Նախ ստեղծեք այն",
  },
  // Shown on the sessions board beside a place whose console is bound. Kept to
  // one or two words: it shares a line with the platform and the tier.
  "ps5.tile.bound": { en: "Console", ru: "Приставка", am: "Կոնսոլ" },
  // The wake key itself, in the console finder.
  // Pairing: the whole thing, inside the panel.
  "ps5.pair.title": { en: "Pair with PlayStation", ru: "Сопряжение с PlayStation", am: "Զուգակցում PlayStation-ի հետ" },
  "ps5.pair.steps": {
    en: "Turn the console ON, then open Settings → System → Remote Play → Link Device and type the 8 digits it shows.",
    ru: "Включите приставку, откройте Настройки → Система → Дистанционное воспроизведение → «Привязать устройство» и введите показанные 8 цифр.",
    am: "Միացրեք կոնսոլը, բացեք Settings → System → Remote Play → Link Device և մուտքագրեք էկրանին երևացող 8 թվանշանը։",
  },
  "ps5.pair.pin": { en: "8 digits from the console", ru: "8 цифр с экрана приставки", am: "8 թվանշան կոնսոլի էկրանից" },
  // The way through when Sony's page refuses the embedded window.
  "ps5.pair.browser": {
    en: "Sign in through your browser instead",
    ru: "Войти через обычный браузер",
    am: "Փոխարենը մուտք գործել դիտարկիչով",
  },
  "ps5.pair.browserSteps": {
    en: "Sign in there, then copy the address of the page it lands on and paste it below.",
    ru: "Войдите там, затем скопируйте адрес страницы, на которую вас перекинуло, и вставьте сюда.",
    am: "Մուտք գործեք այնտեղ, ապա պատճենեք բացված էջի հասցեն և տեղադրեք ստորև։",
  },
  "ps5.pair.redirect": {
    en: "The address you were redirected to",
    ru: "Адрес, на который вас перекинуло",
    am: "Վերահղման էջի հասցեն",
  },
  "ps5.pair.start": { en: "Pair", ru: "Сопрячь", am: "Զուգակցել" },
  "ps5.pair.working": { en: "Pairing…", ru: "Сопрягаем…", am: "Զուգակցում…" },
  "ps5.pair.done": { en: "Paired. Waking and sleeping now work", ru: "Сопряжено. Пробуждение и сон работают", am: "Զուգակցված է։ Արթնացումն ու քունը աշխատում են" },
  "ps5.pair.error.CANCELLED": { en: "Sign-in was closed", ru: "Вход отменён", am: "Մուտքը չեղարկվեց" },
  "ps5.pair.error.NOT_AWAKE": {
    en: "The console must be switched ON to pair. It cannot be paired from rest",
    ru: "Для сопряжения приставка должна быть ВКЛЮЧЕНА. Из режима покоя не выйдет",
    am: "Զուգակցման համար կոնսոլը պետք է ՄԻԱՑՎԱԾ լինի։ Քնի ռեժիմից չի ստացվի",
  },
  "ps5.pair.error.BAD_PIN": {
    en: "The console did not accept that PIN. It expires, so take a fresh one",
    ru: "Приставка не приняла PIN. Он одноразовый, возьмите новый с её экрана",
    am: "Կոնսոլը չընդունեց PIN-ը։ Այն ժամանակավոր է, վերցրեք նորը",
  },
  "ps5.pair.error.NO_LOGIN": {
    en: "The PlayStation sign-in did not complete",
    ru: "Вход в аккаунт PlayStation не завершился",
    am: "PlayStation հաշվի մուտքը չավարտվեց",
  },
  "ps5.pair.error.UNREACHABLE": { en: "The console did not answer", ru: "Приставка не ответила", am: "Կոնսոլը չպատասխանեց" },
  "ps5.pair.error.FAILED": { en: "Pairing failed", ru: "Сопряжение не удалось", am: "Զուգակցումը ձախողվեց" },
  // The manual route stays for anyone who already holds a key.
  "ps5.key.title": { en: "Wake key", ru: "Ключ пробуждения", am: "Արթնացման բանալի" },
  "ps5.key.saved": { en: "Key saved on this computer", ru: "Ключ сохранён на этом компьютере", am: "Բանալին պահված է այս համակարգչում" },
  "ps5.key.placeholder": {
    en: "Remote Play registration key",
    ru: "Ключ регистрации Remote Play",
    am: "Remote Play գրանցման բանալի",
  },
  "ps5.key.save": { en: "Save key", ru: "Сохранить ключ", am: "Պահել բանալին" },
  "ps5.key.forget": { en: "Remove key", ru: "Удалить ключ", am: "Ջնջել բանալին" },
  "ps5.key.noKeystore": {
    en: "No OS keystore here. The key will work until the panel is closed, and is never written to disk",
    ru: "Хранилища ключей ОС здесь нет. Ключ будет работать до закрытия панели и на диск не записывается",
    am: "Այստեղ ՕՀ բանալիների պահոց չկա։ Բանալին կաշխատի մինչև վահանակի փակումը և սկավառակին չի գրվում",
  },
  "ps5.key.savedForRun": {
    en: "Key held until the panel is closed",
    ru: "Ключ действует до закрытия панели",
    am: "Բանալին գործում է մինչև վահանակի փակումը",
  },
  "ps5.key.test": { en: "Test wake", ru: "Проверить пробуждение", am: "Ստուգել արթնացումը" },
  "ps5.key.testSent": {
    en: "Signal sent. The console should wake within a few seconds",
    ru: "Сигнал отправлен. Приставка должна проснуться за несколько секунд",
    am: "Ազդանշանն ուղարկվեց։ Կոնսոլը պետք է արթնանա մի քանի վայրկյանում",
  },
  // The mistake this line exists to prevent: the eight digits on the console's
  // "Link Device" screen are a one-time PIN for pairing, not the key. The key is
  // what a Remote Play client is given once pairing completes, and the console
  // ignores a wake carrying anything else.
  "ps5.key.hint": {
    en: "NOT the 8-digit code on the console screen. That is a one-time pairing PIN. This is the registration key a Remote Play client receives after pairing. Stored encrypted on this computer, never sent to the server.",
    ru: "Это НЕ 8-значный код с экрана приставки. Тот код одноразовый, для сопряжения. Нужен ключ регистрации, который клиент Remote Play получает после сопряжения. Хранится зашифрованным на этом компьютере и на сервер не уходит.",
    am: "Սա կոնսոլի էկրանի 8-նիշանոց կոդը ՉԷ․ այն զուգակցման միանվագ PIN է։ Այստեղ պետք է գրանցման բանալին, որը Remote Play ծրագիրը ստանում է զուգակցումից հետո։ Պահվում է գաղտնագրված այս համակարգչում և սերվեր չի ուղարկվում։",
  },
  // The question the owner is asked when a console is on with no session.
  // Shown above the place, and only for an owner with more than one venue.
  "ps5.wake.branch": {
    en: "Branch",
    ru: "Филиал",
    am: "Մասնաճյուղ",
  },
  "ps5.wake.dialogTitle": {
    en: "A PlayStation is switched on",
    ru: "PlayStation включена",
    am: "PlayStation-ը միացված է",
  },
  "ps5.wake.dialogBody": {
    en: "There is no session on it. Did you switch it on yourself?",
    ru: "Активной сессии на ней нет. Вы включили её сами?",
    am: "Դրա վրա ակտիվ սեսիա չկա։ Ինքնե՞րդ եք միացրել։",
  },
  "ps5.wake.dialogCountdown": {
    en: "Goes back to rest in {s} s",
    ru: "Уйдёт в режим сна через {s} с",
    am: "{s} վրկ հետո կանցնի քնի ռեժիմի",
  },
  "ps5.wake.yes": { en: "Yes, that was me", ru: "Да, это я", am: "Այո, ես էի" },
  "ps5.wake.no": { en: "No", ru: "Нет", am: "Ոչ" },
  // Suspending the protection while somebody works on a console.
  "ps5.maintenance.title": { en: "Maintenance", ru: "Обслуживание", am: "Սպասարկում" },
  "ps5.maintenance.hint": {
    en: "While it lasts, this console may stay on without a session.",
    ru: "Пока оно длится, приставка может быть включена без сессии.",
    am: "Սպասարկման ընթացքում կոնսոլը կարող է միացված մնալ առանց սեսիայի։",
  },
  "ps5.maintenance.start": { en: "Suspend for an hour", ru: "Приостановить на час", am: "Կասեցնել մեկ ժամով" },
  "ps5.maintenance.stop": { en: "Resume protection", ru: "Вернуть защиту", am: "Վերականգնել պաշտպանությունը" },
  "ps5.maintenance.until": { en: "Suspended until {t}", ru: "Приостановлено до {t}", am: "Կասեցված է մինչև {t}" },
  // Lifecycle, as the board shows it.
  "ps5.lifecycle.WAKING": { en: "Waking…", ru: "Просыпается…", am: "Արթնանում է…" },
  "ps5.lifecycle.GOING_TO_REST": { en: "Going to rest…", ru: "Уходит в сон…", am: "Անցնում է քնի ռեժիմի…" },
  "ps5.lifecycle.UNEXPECTED_WAKE": { en: "On without a session", ru: "Включена без сессии", am: "Միացված է առանց սեսիայի" },
  "ps5.lifecycle.ERROR": { en: "Command failed", ru: "Команда не прошла", am: "Հրամանը ձախողվեց" },
  // What went wrong, in words an operator can act on.
  "ps5.error.NO_CREDENTIAL": {
    en: "No wake key for this console on this computer",
    ru: "На этом компьютере нет ключа пробуждения для этой приставки",
    am: "Այս համակարգչում չկա արթնացման բանալի այս կոնսոլի համար",
  },
  "ps5.error.BAD_CREDENTIAL": {
    en: "The wake key for this console is not valid",
    ru: "Ключ пробуждения этой приставки недействителен",
    am: "Այս կոնսոլի արթնացման բանալին վավեր չէ",
  },
  "ps5.error.DEVICE_NOT_FOUND": {
    en: "This console has not been seen on the network",
    ru: "Эту приставку не видно в сети",
    am: "Այս կոնսոլը ցանցում չի երևում",
  },
  "ps5.error.IN_USE": {
    en: "The console says a Remote Play session is already in use. Close it on the console or wait a moment",
    ru: "Приставка отвечает, что сессия Remote Play уже занята. Закройте её на приставке или подождите немного",
    am: "Կոնսոլի Remote Play սեսիան արդեն զբաղված է։ Փակեք այն կոնսոլի վրա կամ մի փոքր սպասեք",
  },
  "ps5.error.UNSUPPORTED_BY_TRANSPORT": {
    en: "This build cannot put a console to rest over the network",
    ru: "Эта сборка не умеет усыплять приставку по сети",
    am: "Այս տարբերակը չի կարող կոնսոլը քնեցնել ցանցով",
  },
  "ps5.error.WAKE_IGNORED": {
    en: "The console is ignoring the wake. Switch on \"Enable Turning On PS5 from Network\" in its Power Saving settings",
    ru: "Приставка игнорирует пробуждение. Включите на ней «Включение PS5 по сети» в настройках энергосбережения",
    am: "Կոնսոլն անտեսում է արթնացումը։ Միացրեք «Enable Turning On PS5 from Network» կարգավորումը Power Saving բաժնում",
  },
  "ps5.error.TRANSPORT_ERROR": {
    en: "Could not reach the console",
    ru: "Не удалось достучаться до приставки",
    am: "Չհաջողվեց կապ հաստատել կոնսոլի հետ",
  },
  // What the protocol does NOT offer, said once, where the owner sets things up.
  "ps5.sleep.impossible": {
    en: "A console cannot be put to rest over the network. Only woken. Use the console's own Power Saving timer for that.",
    ru: "Усыпить приставку по сети нельзя. Только разбудить. Для сна используйте таймер энергосбережения самой приставки.",
    am: "Կոնսոլը ցանցով քնեցնել հնարավոր չէ։ Միայն արթնացնել։ Քնի համար օգտագործեք կոնսոլի էներգախնայման ժամաչափը։",
  },
  "nav.support": { en: "Support", ru: "Поддержка", am: "Աջակցություն" },
  "support.title": { en: "Support", ru: "Поддержка", am: "Աջակցություն" },
  "support.intro": {
    en: "Write to the Cyber Place support team. Your company, branch and role travel with the message. There is nothing to fill in.",
    ru: "Напишите в поддержку Cyber Place. Компания, филиал и роль передаются вместе с сообщением. Заполнять ничего не нужно.",
    am: "Գրեք Cyber Place-ի աջակցության թիմին։ Ընկերությունը, մասնաճյուղը և դերը ինքնաշխատ կցվում են հաղորդագրությանը։ Ոչինչ լրացնել պետք չէ։",
  },
  "support.conversations": { en: "Conversations", ru: "Обращения", am: "Դիմումներ" },
  "support.noConversations": {
    en: "No requests yet. Start one below.",
    ru: "Обращений пока нет. Создайте первое ниже.",
    am: "Դիմումներ դեռ չկան։ Ստեղծեք առաջինը ներքևում։",
  },
  "support.newRequest": { en: "+ New request", ru: "+ Новое обращение", am: "+ Նոր դիմում" },
  "support.starting": { en: "Opening…", ru: "Открываем…", am: "Բացվում է…" },
  "support.pickConversation": {
    en: "Pick a conversation on the left.",
    ru: "Выберите обращение слева.",
    am: "Ընտրեք դիմումը ձախից։",
  },
  "support.emptyThread": {
    en: "Nothing here yet. Describe the problem and we will pick it up.",
    ru: "Здесь пока пусто. Опишите проблему, мы её получим.",
    am: "Այստեղ դեռ դատարկ է։ Նկարագրեք խնդիրը, և մենք կզբաղվենք դրանով։",
  },
  "support.placeholder": { en: "Write a message…", ru: "Напишите сообщение…", am: "Գրեք հաղորդագրություն…" },
  // Attachment rules, in the operator's words. Each names the actual limit
  // rather than saying "invalid file", because the only useful version of this
  // message is the one that says what to do differently.
  "support.file.tooLarge": {
    en: "Too large. Maximum per file: {0} MB",
    ru: "Файл слишком большой. Максимум на файл: {0} МБ",
    am: "Ֆայլը չափազանց մեծ է։ Առավելագույնը՝ {0} ՄԲ",
  },
  "support.file.empty": {
    en: "The file is empty. It may not have been read correctly",
    ru: "Файл пустой. Возможно, он не прочитался",
    am: "Ֆայլը դատարկ է։ Հնարավոր է՝ այն ճիշտ չի կարդացվել",
  },
  "support.file.tooMany": {
    en: "Too many files. Maximum: {0}",
    ru: "Слишком много файлов. Максимум: {0}",
    am: "Չափազանց շատ ֆայլ։ Առավելագույնը՝ {0}",
  },
  "support.file.totalTooLarge": {
    en: "The message is too heavy altogether. Maximum: {0} MB",
    ru: "Сообщение слишком тяжёлое целиком. Максимум: {0} МБ",
    am: "Ֆայլերի ընդհանուր չափը չափազանց մեծ է։ Առավելագույնը՝ {0} ՄԲ",
  },
  "support.file.fixBeforeSending": {
    en: "Remove the files marked in red to send this message.",
    ru: "Уберите отмеченные красным файлы, чтобы отправить сообщение.",
    am: "Հեռացրեք կարմիրով նշված ֆայլերը՝ հաղորդագրությունն ուղարկելու համար։",
  },
  "support.file.remove": { en: "Remove file", ru: "Убрать файл", am: "Հեռացնել ֆայլը" },
  "support.attach": { en: "Attach a file", ru: "Прикрепить файл", am: "Կցել ֆայլ" },
  "support.send": { en: "Send", ru: "Отправить", am: "Ուղարկել" },
  "support.retry": { en: "Retry", ru: "Повторить", am: "Կրկնել" },
  "support.sendFailed": {
    en: "The message was not sent.",
    ru: "Сообщение не отправлено.",
    am: "Հաղորդագրությունը չուղարկվեց։",
  },
  "support.state.sending": { en: "Sending…", ru: "Отправляется…", am: "Ուղարկվում է…" },
  "support.state.queued": {
    en: "Saved. Reaching support…",
    ru: "Сохранено. Доставляем в поддержку…",
    am: "Պահպանված է։ Ուղարկվում է աջակցությանը…",
  },
  "support.state.undelivered": {
    en: "Saved, but support has not received it yet",
    ru: "Сохранено, но поддержка ещё не получила",
    am: "Պահպանված է, բայց աջակցությունը դեռ չի ստացել",
  },
  "support.toast.title": { en: "New message from support", ru: "Новое сообщение от поддержки", am: "Նոր հաղորդագրություն աջակցությունից" },
  "support.toast.open": { en: "Open", ru: "Открыть", am: "Բացել" },
  "support.chooseBranch": { en: "Choose a branch", ru: "Выберите филиал", am: "Ընտրեք մասնաճյուղը" },
  "support.chooseBranchHint": {
    en: "Support requests are kept per branch, so the team sees which venue you are writing about.",
    ru: "Обращения ведутся по филиалам. Так поддержка сразу видит, о какой площадке речь.",
    am: "Դիմումները պահվում են ըստ մասնաճյուղերի, որպեսզի թիմը տեսնի, թե որ ակումբի մասին է խոսքը։",
  },
  "support.searchBranch": { en: "Search a branch…", ru: "Поиск филиала…", am: "Որոնել մասնաճյուղ…" },
  "support.noBranchMatches": { en: "No branches found", ru: "Филиалы не найдены", am: "Մասնաճյուղեր չեն գտնվել" },
  "support.branchChange": { en: "Change branch", ru: "Сменить филиал", am: "Փոխել մասնաճյուղը" },
  "support.openThread": { en: "Open the chat", ru: "Открыть чат", am: "Բացել զրույցը" },
  "support.role.company_owner": { en: "Owner", ru: "Владелец", am: "Սեփականատեր" },
  "support.role.manager": { en: "Manager", ru: "Менеджер", am: "Մենեջեր" },
  "support.role.admin": { en: "Admin", ru: "Админ", am: "Ադմին" },
  /* ── a live session's terms: joysticks, free, extra time, unlimited ──── */
  "session.options": { en: "Session options", ru: "Параметры сессии", am: "Սեսիայի կարգավորումներ" },
  "session.optionsShort": { en: "Options", ru: "Опции", am: "Կարգավորումներ" },
  "session.elapsedField": { en: "Running for", ru: "Идёт", am: "Տևում է" },
  "session.joystickNoPrice": { en: "price not set", ru: "цена не задана", am: "գինը սահմանված չէ" },
  "session.joysticks": { en: "Joysticks", ru: "Джойстики", am: "Ջոյսթիքներ" },
  // The tile's own controls. Distinct keys from the dialog's: on a 160px card
  // the words are a tooltip, not a button label, and they have to say WHICH
  // session the pad joins — a board shows a dozen at once.
  // Said out loud on the two presses. Green on the add, red on the removal —
  // the toaster's two kinds, so a cashier reading the corner of the screen
  // knows which way the seat moved without reading the words.
  "session.joystickAdded": { en: "Joystick added", ru: "Джойстик добавлен", am: "Ջոյսթիքն ավելացվեց" },
  "session.joystickRemoved": {
    en: "Joystick removed from this session",
    ru: "Джойстик снят с текущей сессии",
    am: "Ջոյսթիքը հանվեց այս սեսիայից",
  },
  "session.joysticksInSession": {
    en: "Joysticks in session:",
    ru: "Джойстиков в сессии:",
    am: "Ջոյսթիքներ սեսիայում՝",
  },
  // The card's own money line. "2 × 300 = 600" — a count and a flat fee, never
  // a rate and never anything that moves with the clock.
  "session.currentRate": { en: "Rate now", ru: "Тариф сейчас", am: "Ընթացիկ սակագին" },
  "session.perHourShort": { en: "/h", ru: "/ч", am: "/ժ" },
  "session.joysticksCost": { en: "Joysticks", ru: "Джойстики", am: "Ջոյսթիքներ" },
  "session.sessionCost": { en: "Session", ru: "Сессия", am: "Սեսիա" },
  "session.grandTotal": { en: "Total", ru: "Итого", am: "Ընդամենը" },
  "session.joystickAddHere": {
    en: "Add a joystick to this session",
    ru: "Добавить джойстик к текущей сессии",
    am: "Ավելացնել ջոյսթիք այս սեսիային",
  },
  "session.joystickRemoveHere": {
    en: "Remove the last joystick from this session",
    ru: "Убрать последний джойстик из текущей сессии",
    am: "Հեռացնել վերջին ջոյսթիքն այս սեսիայից",
  },
  "session.joystickAdd": { en: "Add a joystick", ru: "Добавить джойстик", am: "Ավելացնել ջոյսթիք" },
  "session.joystickRemove": { en: "Remove joystick #{0}", ru: "Убрать джойстик №{0}", am: "Հեռացնել №{0} ջոյսթիքը" },
  "session.joystickSlot": { en: "Joystick #{0}", ru: "Джойстик №{0}", am: "Ջոյսթիք №{0}" },
  // Why a pad that was in play costs nothing. Without it the 0 on the receipt
  // reads as a till that lost the charge.
  // Why a period that was in play is worth nothing: the pad was handed back,
  // so its fee came off. Without it the 0 on the receipt reads as a till that
  // lost the charge.
  "session.joystickReturned": {
    en: "returned, fee removed",
    ru: "вернули, цена снята",
    am: "վերադարձվել է, գինը հանվել է",
  },
  "session.joystickIncluded": {
    en: "Joystick #1 is part of the session",
    ru: "Джойстик №1 входит в сессию",
    am: "№1 ջոյսթիքը ներառված է սեսիայում",
  },
  "session.joystickMax": {
    en: "A PlayStation session takes at most 4 joysticks.",
    ru: "В сессии PlayStation может быть не больше 4 джойстиков.",
    am: "PlayStation-ի սեսիայում կարող է լինել առավելագույնը 4 ջոյսթիք։",
  },
  "session.joystickPsOnly": {
    en: "Extra joysticks apply to PlayStation places only.",
    ru: "Дополнительные джойстики доступны только для мест PlayStation.",
    am: "Լրացուցիչ ջոյսթիքները հասանելի են միայն PlayStation տեղերի համար։",
  },
  "session.joystickThisPlatform": {
    en: "This place is set up as “{0}”.",
    ru: "Это место заведено как «{0}».",
    am: "Այս տեղը գրանցված է որպես «{0}»։",
  },
  "session.joystickBilledFrom": {
    en: "A flat fee per joystick, added to the bill the moment it is handed out and taken off again when it is handed back. How long it is out makes no difference.",
    ru: "Фиксированная цена за джойстик: прибавляется к счёту сразу при добавлении и снимается при удалении. Время использования на цену не влияет.",
    am: "Ֆիքսված գին յուրաքանչյուր ջոյսթիքի համար՝ ավելացվում է հաշվին անմիջապես տալու պահին և հանվում վերադարձնելիս։ Օգտագործման տևողությունը գնի վրա չի ազդում։",
  },
  "session.addTime": { en: "Add time", ru: "Добавить время", am: "Ավելացնել ժամանակ" },
  "session.addMinutes": { en: "+{0} min", ru: "+{0} мин", am: "+{0} րոպե" },
  // A refusal that names the alternative. `{0}` is the time the next
  // reservation takes the seat, in 24-hour form like everything else here.
  "session.seatClaimedFrom": {
    en: "Reserved from {0}. You can extend up to then:",
    ru: "Забронировано с {0}. Продлить можно до этого времени:",
    am: "Ամրագրված է {0}-ից։ Կարող եք երկարաձգել մինչ այդ:",
  },
  "session.seatClaimed": {
    en: "This seat is reserved. You can still extend by:",
    ru: "Место забронировано. Продлить можно на:",
    am: "Այս տեղն ամրագրված է։ Դեռ կարող եք երկարաձգել:",
  },
  // …or move the player. The seat cannot give the time asked for, these can.
  "session.moveTitle": {
    en: "Finish on another place",
    ru: "Продолжить на другом месте",
    am: "Շարունակել այլ տեղում",
  },
  // `{0}` is the grant that was refused — the same one these seats can take.
  "session.moveHint": {
    en: "These places can take the full +{0} min. The session keeps its time, bill and products.",
    ru: "Эти места могут принять все +{0} мин. Сессия сохранит время, счёт и товары.",
    am: "Այս տեղերը կարող են ընդունել ամբողջ +{0} րոպեն։ Սեսիան պահպանում է ժամանակը, հաշիվը և ապրանքները։",
  },
  "session.moveHere": {
    en: "Move here",
    ru: "Перенести сюда",
    am: "Տեղափոխել այստեղ",
  },
  // Announced after the SERVER confirmed. `{0}` minutes, `{1}` the seat — a
  // cashier with a queue needs to know which session just moved.
  "session.timeAddedToast": {
    en: "+{0} min added to the session · {1}",
    ru: "Время +{0} мин добавлено к сессии · {1}",
    am: "+{0} րոպե ավելացվել է սեսիային · {1}",
  },
  // `{0}` the seat moved to, `{1}` the minutes granted there.
  "session.movedToast": {
    en: "Session continues on {0} · +{1} min",
    ru: "Сессия продолжается на {0} · +{1} мин",
    am: "Սեսիան շարունակվում է {0}-ում · +{1} րոպե",
  },
  // Why the seat cannot take it. `{0}` the seat, `{1}` when it is claimed.
  "session.moveWhyTitle": {
    en: "This place is already booked",
    ru: "Это место уже забронировано",
    am: "Այս տեղն արդեն ամրագրված է",
  },
  "session.moveWhyFrom": {
    en: "{0} is booked from {1}. The current session cannot continue here.",
    ru: "{0} забронировано с {1}. Продолжить текущую сессию на этом месте невозможно.",
    am: "{0}-ն ամրագրված է {1}-ից։ Ընթացիկ սեսիան այստեղ չի կարող շարունակվել։",
  },
  "session.moveWhy": {
    en: "{0} is booked. The current session cannot continue here.",
    ru: "{0} забронировано. Продолжить текущую сессию на этом месте невозможно.",
    am: "{0}-ն ամրագրված է։ Ընթացիկ սեսիան այստեղ չի կարող շարունակվել։",
  },
  "session.moveRequested": {
    en: "Extension: +{0} min",
    ru: "Продление: +{0} мин",
    am: "Երկարաձգում՝ +{0} րոպե",
  },
  // The seat the player is on now, opposite the one being offered. Two short
  // labels rather than a sentence: they sit either side of an arrow.
  "session.moveFromLabel": { en: "Now on", ru: "Сейчас на", am: "Այժմ՝" },
  "session.moveToLabel": { en: "Continue on", ru: "Продолжить на", am: "Շարունակել՝" },
  "session.moveToNothing": { en: "not chosen", ru: "не выбрано", am: "ընտրված չէ" },
  // The window a seat is free for. Spelled out rather than shown as a bare
  // interval so it cannot be read as the session's own end time.
  "session.moveFreeFor": {
    en: "Free {0} to {1}",
    ru: "Свободно с {0} до {1}",
    am: "Ազատ է {0}-ից մինչև {1}",
  },
  "session.moveAvailable": { en: "Available", ru: "Доступно", am: "Հասանելի" },
  // The seat went while the dialog was open. Not a fault, so not red.
  "session.moveTakenToast": {
    en: "Seat {0} is no longer free. Pick another one.",
    ru: "Место {0} больше недоступно. Выберите другое.",
    am: "{0} տեղն այլևս ազատ չէ։ Ընտրեք մեկ ուրիշը։",
  },
  "session.moveChosen": { en: "Chosen", ru: "Выбрано", am: "Ընտրված" },
  "session.moveConfirm": {
    en: "Continue on the selected place",
    ru: "Продолжить на выбранном месте",
    am: "Շարունակել ընտրված տեղում",
  },
  "session.moveNone": {
    en: "No free place can take this extension right now.",
    ru: "Сейчас нет свободного места, которое примет это продление.",
    am: "Այս պահին ազատ տեղ չկա այս երկարաձգման համար։",
  },
  // Manual entry, for the grant no preset covers. The unit matters more than
  // it looks: a cashier typing "2" means two hours far more often than two
  // minutes, and a number with no unit beside it is the kind of ambiguity that
  // ends with a seat sold for a fiftieth of what was meant.
  "session.timeManual": { en: "Enter manually", ru: "Ввести вручную", am: "Մուտքագրել ձեռքով" },
  // The price a session carries on at once its end is removed. Shown before the
  // switch rather than after, because it is the number the operator is agreeing
  // to and the moment to correct it is now.
  "session.unlimitedRate": { en: "Price per hour", ru: "Цена за час", am: "Գինը ժամում" },
  // The section reads differently once a session already has no end: there is
  // nothing left to decide, so it states the fact instead of offering a form.
  "session.unlimitedAlready": {
    en: "This session already has no end.",
    ru: "У этой сессии уже нет ограничения по времени.",
    am: "Այս սեսիան արդեն ժամանակի սահմանափակում չունի։",
  },
  // Shown INSTEAD of a figure when the server could derive none. A zero there
  // would read as "free from now on", a decision nobody made — and the server
  // refuses the switch in this same case.
  "session.unlimitedRateUnknown": {
    en: "No hourly price is set for this seat. Check the tariff settings.",
    ru: "Для этой приставки не задана цена за час. Проверьте настройки тарифа.",
    am: "Այս տեղի համար ժամային գին սահմանված չէ։ Ստուգեք սակագների կարգավորումները։",
  },
  // Says the rule out loud, because it is the question an operator asks and
  // getting it wrong the other way would be somebody's receipt.
  "session.unlimitedRateHint": {
    en: "Applies from now on. What has already been played keeps its own price.",
    ru: "Действует с этого момента. Уже сыгранное сохраняет свою цену.",
    am: "Գործում է այս պահից։ Արդեն խաղացածը պահպանում է իր գինը։",
  },
  "session.unlimitedRateInvalid": {
    en: "Enter a price greater than zero.",
    ru: "Введите цену больше нуля.",
    am: "Մուտքագրեք զրոյից մեծ գին։",
  },
  "session.timeAmount": { en: "Amount", ru: "Количество", am: "Քանակ" },
  "session.timeUnitMinutes": { en: "Minutes", ru: "Минуты", am: "Րոպե" },
  "session.timeUnitHours": { en: "Hours", ru: "Часы", am: "Ժամ" },
  // Says the resolved figure back before it is granted, because the mistake
  // this catches is a unit mistake and only the total makes one visible.
  "session.timeAddConfirm": { en: "Add {0} min", ru: "Добавить {0} мин", am: "Ավելացնել {0} րոպե" },
  "session.timeInvalid": {
    en: "Enter a whole number of minutes between 1 and 600.",
    ru: "Введите целое число минут от 1 до 600.",
    am: "Մուտքագրեք րոպեների ամբողջ թիվ՝ 1-ից 600։",
  },
  "session.timeAdded": { en: "{0} minutes added", ru: "Добавлено {0} минут", am: "Ավելացվեց {0} րոպե" },
  "session.timeNotApplicable": {
    en: "This session has no time limit, so there is nothing to extend.",
    ru: "У этой сессии нет ограничения по времени. Продлевать нечего.",
    am: "Այս սեսիան ժամանակի սահմանափակում չունի, երկարաձգելու բան չկա։",
  },
  "session.unlimited": { en: "Unlimited", ru: "Безлимит", am: "Անսահմանափակ" },
  "session.makeUnlimited": { en: "Switch to unlimited", ru: "Перевести на безлимит", am: "Անցնել անսահմանափակի" },
  // The GATE, distinct from the button that performs it. Two controls reading
  // the same words is ambiguous on screen and outright unusable to anything
  // selecting by name — a test, a screen reader, a keyboard user reading the
  // accessibility tree.
  "session.unlimitedGate": {
    en: "Switch to unlimited",
    ru: "Переключить на Безлимит",
    am: "Անցնել անսահմանափակի",
  },
  "session.unlimitedApply": {
    en: "Change fixed tariff to unlimited",
    ru: "Изменить фиксированный тариф на безлимитный",
    am: "Փոխել ֆիքսված սակագինն անսահմանափակով",
  },
  "session.unlimitedHint": {
    en: "The paid block stays; time past it is charged by the hour. Cannot be undone.",
    ru: "Оплаченный пакет остаётся, время сверх него считается по часам. Отменить нельзя.",
    am: "Վճարված փաթեթը մնում է, դրանից ավելի ժամանակը հաշվարկվում է ժամով։ Հետարկել հնարավոր չէ։",
  },
  "session.unlimitedConfirm": {
    en: "Switch this session to unlimited?",
    ru: "Перевести сессию на безлимит?",
    am: "Սեսիան դարձնե՞լ անսահմանափակ։",
  },
  // NOTE: `session.free` already means "this seat is available" on the board.
  // The bill-waiver keys are prefixed `freeBill` so the two can never collide.
  "session.freeBill": { en: "Free session", ru: "Бесплатная сессия", am: "Անվճար սեսիա" },
  "session.freeBillShort": { en: "Free", ru: "Бесплатно", am: "Անվճար" },
  "session.freeBillHint": {
    en: "The clock keeps running and the session still counts. Nobody pays.",
    ru: "Время продолжает идти и сессия остаётся в статистике. Просто никто не платит.",
    am: "Ժամանակը շարունակում է հաշվվել, սեսիան մնում է վիճակագրության մեջ։ Պարզապես ոչ ոք չի վճարում։",
  },
  "session.freeBillWaived": { en: "Waived: {0}", ru: "Списано: {0}", am: "Դուրս գրված՝ {0}" },
  "session.freeBillStartHint": {
    en: "This session will be started free. The timer runs, nothing is charged.",
    ru: "Сессия запустится бесплатной. Таймер идёт, счёт не начисляется.",
    am: "Սեսիան կսկսվի անվճար։ Ժամաչափն աշխատում է, գումար չի հաշվարկվում։",
  },
  "session.optionsClosedSession": {
    en: "This session is no longer active.",
    ru: "Сессия уже не активна.",
    am: "Սեսիան այլևս ակտիվ չէ։",
  },
  /* ── the ten-minute warning ───────────────────────────────────────────── */
  "session.endingSoonTitle": { en: "Session ending soon", ru: "Сессия скоро закончится", am: "Սեսիան շուտով կավարտվի" },
  "session.endingSoonBody": {
    en: "{place}. {minutes} min left. Add more time?",
    ru: "{place}. Осталось {minutes} мин. Добавить время?",
    am: "{place}։ Մնացել է {minutes} րոպե։ Ավելացնե՞լ ժամանակ։",
  },
  "session.endingSoonAction": { en: "Add time", ru: "Добавить время", am: "Ավելացնել ժամանակ" },
  "session.endingSoonDismiss": { en: "Dismiss", ru: "Закрыть", am: "Փակել" },
  "session.createProduct": { en: "New product", ru: "Создать товар", am: "Ստեղծել ապրանք" },
  "session.createProductHint": {
    en: "Not stocked yet? Create it. It joins the catalogue and this bill.",
    ru: "Товара ещё нет? Создайте. Он появится в каталоге и в этом счёте.",
    am: "Ապրանքը դեռ չկա՞։ Ստեղծեք։ Այն կհայտնվի կատալոգում և այս հաշվին։",
  },
  "session.removeFromBill": { en: "Remove from the bill", ru: "Убрать из счёта", am: "Հեռացնել հաշվից" },
  "session.removedOne": { en: "{0} removed", ru: "Товар «{0}» успешно удалён", am: "«{0}» ապրանքը հեռացվեց" },
  // The same moments for an additional item, said as what it is.
  "session.additionalGiven": { en: "Handed out: {0}.", ru: "Выдано: {0}.", am: "Տրված է՝ {0}։" },
  "session.additionalRemoved": {
    en: "Additional item «{0}» taken off the bill",
    ru: "Дополнительный предмет «{0}» убран из счёта",
    am: "«{0}» լրացուցիչ իրը հանվեց հաշվից",
  },
  "session.additionalRemoveConfirm": {
    en: "Take the additional item «{0}» off this bill?",
    ru: "Убрать дополнительный предмет «{0}» из счёта?",
    am: "Հանե՞լ «{0}» լրացուցիչ իրը հաշվից։",
  },
  "session.removeFailed": { en: "Could not remove the product.", ru: "Не удалось удалить товар.", am: "Չհաջողվեց հեռացնել ապրանքը։" },
  // Two ways to put something on a bill. The picker is the original and the
  // default; quick entry is for an order of five things, where finding each
  // one in a list is the slow part.
  "session.addMode": { en: "How to add", ru: "Способ добавления", am: "Ավելացնելու եղանակը" },
  "session.addModePicker": { en: "Choose from the list", ru: "Выбрать из списка", am: "Ընտրել ցանկից" },
  "session.addModeText": { en: "Type the order", ru: "Ввести списком", am: "Մուտքագրել տեքստով" },
  "session.quickEntry": { en: "Quick entry", ru: "Быстрый ввод", am: "Արագ մուտքագրում" },
  // Says what to do, not what a made-up order looks like: two product names a
  // venue may not even sell read as a format to copy rather than as an
  // instruction, and the line below already explains the format.
  "session.quickEntryPlaceholder": {
    en: "Enter the product name and the quantity",
    ru: "Введите название продукта и количество",
    am: "Մուտքագրեք ապրանքի անվանումը և քանակը",
  },
  "session.quickEntryHint": {
    en: "One product per line, with the quantity before or after the name. Nothing is added until you confirm.",
    ru: "По одному продукту в строке, количество до или после названия. Ничего не добавится, пока вы не подтвердите.",
    am: "Մեկ ապրանք՝ մեկ տողում, քանակը՝ անվանումից առաջ կամ հետո։ Ոչինչ չի ավելացվի, քանի դեռ չեք հաստատել։",
  },
  "session.quickEntryReading": { en: "Reading…", ru: "Разбираем…", am: "Վերծանում ենք…" },
  "session.quickEntryPreview": { en: "Will be added", ru: "Будет добавлено", am: "Կավելացվի" },
  "session.quickEntryTotal": { en: "Total", ru: "Итого", am: "Ընդամենը" },
  "session.quickEntryLine": { en: "Line “{0}”:", ru: "Строка «{0}»:", am: "«{0}» տողը՝" },
  // A typed line whose words fit several products: the operator picks one.
  "session.quickEntryPick": {
    en: "Which product is “{0}”?",
    ru: "Какой товар в строке «{0}»?",
    am: "Ո՞ր ապրանքն է «{0}» տողում",
  },
  // Reopens a list folded away with Escape.
  "session.quickEntryPickOpen": { en: "Choose", ru: "Выбрать", am: "Ընտրել" },
  "session.quickEntryPickPending": {
    en: "Choose the product in the highlighted lines ({0}) to continue.",
    ru: "Выберите товар в отмеченных строках ({0}), чтобы продолжить.",
    am: "Ընտրեք ապրանքը նշված տողերում ({0})՝ շարունակելու համար։",
  },
  "session.quickEntryCandidates": { en: "Did you mean: {0}", ru: "Возможно, вы имели в виду: {0}", am: "Հնարավոր է նկատի ունեիք՝ {0}" },
  "session.quickEntryConfirm": {
    en: "Add to this session",
    ru: "Добавить товар к этой сессии",
    am: "Ավելացնել այս սեսիային",
  },
  // ── the room's own extra on a running session ─────────────────────────
  // `{0}` is the word the OWNER typed on the place form — "chips", "cue",
  // "darts". Nothing here names a thing, which is the whole point: a room
  // invented tomorrow reads correctly without a key being added.
  "session.extraAdd": { en: "Add {0}", ru: "Добавить: {0}", am: "Ավելացնել՝ {0}" },
  // Pause / resume on the tile. A paused session is still ACTIVE — the seat
  // stays taken — only its clock and its bill hold still.
  "session.pause": { en: "Pause", ru: "Пауза", am: "Դադար" },
  "session.resume": { en: "Resume", ru: "Продолжить", am: "Շարունակել" },
  "session.pausedBadge": { en: "Paused", ru: "На паузе", am: "Դադարեցված" },
  // A pause the branch limits: the server resumes it by itself at {0}.
  "session.pausedUntil": { en: "Paused · until {0}", ru: "Пауза · до {0}", am: "Դադար · մինչև {0}" },
  // The toast after each of the three presses, naming the seat as its tile
  // does. Raised only once the server accepted the action.
  "session.toastPaused": { en: "Session paused · {0}", ru: "Сессия на паузе · {0}", am: "Սեսիան դադարեցված է · {0}" },
  "session.toastResumed": { en: "Session resumed · {0}", ru: "Сессия продолжена · {0}", am: "Սեսիան շարունակվեց · {0}" },
  "session.toastStopped": { en: "Session stopped · {0}", ru: "Сессия завершена · {0}", am: "Սեսիան ավարտվեց · {0}" },
  // «Переместить игрока» — a running session moved to another seat.
  "session.relocate": { en: "Move player", ru: "Переместить игрока", am: "Տեղափոխել խաղացողին" },
  // Short labels for the session CARD's action grid: one line each, so every
  // button is one height. The full sentence stays the button's accessible
  // name and tooltip (SessionCardAction), and every other screen keeps it.
  "session.card.addItem": { en: "+ Product", ru: "+ Товар", am: "+Ապրանք" },
  "session.card.addTime": { en: "+ Time", ru: "+ Время", am: "+Ժամանակ" },
  "session.card.relocate": { en: "Move", ru: "Пересадить", am: "Տեղափոխել" },
  "session.card.resume": { en: "Resume", ru: "Продолжить", am: "Վերսկսել" },
  "session.card.padAdd": { en: "+ Joystick", ru: "+ Джойстик", am: "+Ջոյսթիք" },
  "session.card.padRemove": { en: "− Joystick", ru: "− Джойстик", am: "−Ջոյսթիք" },
  "session.card.extraAdd": { en: "+ {0}", ru: "+ {0}", am: "+ {0}" },
  "session.card.extraReturn": { en: "Return {0}", ru: "Вернуть {0}", am: "Վերադարձ {0}" },
  "session.relocateCurrentRate": { en: "Current price:", ru: "Текущая цена:", am: "Ընթացիկ գինը՝" },
  "session.relocateSameRate": { en: "Same price", ru: "С той же ценой", am: "Նույն գնով" },
  "session.relocateOtherRate": { en: "Other places", ru: "Другие места", am: "Այլ տեղեր" },
  "session.relocateNone": {
    en: "No free place of this platform right now.",
    ru: "Сейчас нет свободных мест этой платформы.",
    am: "Այս պահին այս հարթակի ազատ տեղ չկա։",
  },
  // A seat a reservation cuts short: when it is booked, and how long is left.
  "session.relocateLimited": {
    en: "Booked from {0}, can play {1} min",
    ru: "Забронировано с {0}, играть можно {1} мин",
    am: "Ամրագրված է {0}-ից, կարելի է խաղալ {1} րոպե",
  },
  "session.relocateAcceptLimit": {
    en: "I understand: the session will end at {0}",
    ru: "Понимаю: сессия закончится в {0}",
    am: "Հասկանում եմ՝ սեսիան կավարտվի {0}-ին",
  },
  "session.relocateChangePrice": { en: "Change price", ru: "Изменить цену", am: "Փոխել գինը" },
  "session.relocateSummaryRate": {
    en: "From now on: {0}",
    ru: "С этого момента: {0}",
    am: "Այս պահից՝ {0}",
  },
  "session.relocateSummaryKept": {
    en: "Time already played keeps its price; items and joysticks move with the player.",
    ru: "Уже сыгранное время сохраняет свою цену; товары и джойстики переходят вместе с игроком.",
    am: "Արդեն խաղացած ժամանակը պահպանում է իր գինը․ ապրանքներն ու ջոյսթիքները տեղափոխվում են խաղացողի հետ։",
  },
  "session.relocateConfirm": { en: "Move", ru: "Переместить", am: "Տեղափոխել" },
  "session.relocatedToast": { en: "Player moved to {0}", ru: "Игрок перемещён на {0}", am: "Խաղացողը տեղափոխվեց՝ {0}" },
  // The green toast after a hand-out, in the room's own word — the pads say
  // "Джойстик добавлен" the same way.
  "session.extraAdded": { en: "Added: {0}", ru: "Добавлено: {0}", am: "Ավելացվեց՝ {0}" },
  // …and the RED one after it comes back, as a pad's removal toast is.
  "session.extraReturnedToast": { en: "Returned: {0}", ru: "Возвращено: {0}", am: "Վերադարձվեց՝ {0}" },
  "session.extraQty": { en: "How many ({0})", ru: "Количество ({0})", am: "Քանակը ({0})" },
  "session.extraPerHour": { en: "/h", ru: "/час", am: "/ժ" },
  "session.extraReturn": { en: "Return {0}", ru: "Вернуть: {0}", am: "Վերադարձնել՝ {0}" },
  "session.extraReturned": { en: "returned", ru: "возвращено", am: "վերադարձված" },
  "session.extraHourlyNote": {
    en: "Charged for every hour {0} stays with the player",
    ru: "Начисляется за каждый час, пока {0} у игрока",
    am: "Հաշվարկվում է ամեն ժամի համար, քանի դեռ {0} խաղացողի մոտ է",
  },
  "session.extraOnceNote": {
    en: "One charge for the session, whatever the count",
    ru: "Одна плата за сессию, независимо от количества",
    am: "Մեկ վճար սեսիայի համար՝ անկախ քանակից",
  },
  // The room's allowance, quoted on the hand-out that uses it. `{0}` is a
  // COUNT here, never the word for the thing: the sentence has to read for a
  // room invented tomorrow.
  "session.extraIncluded": {
    en: "The rate covers {0} per session, {1} left",
    ru: "Тариф покрывает {0} за сессию, осталось {1}",
    am: "Սակագինը ներառում է {0} մեկ սեսիայի համար, մնացել է {1}",
  },
  "session.extraPartFree": {
    en: "{0} of {1} free: covered by the rate",
    ru: "{0} из {1} бесплатно: входит в тариф",
    am: "{0}-ը {1}-ից անվճար է՝ ներառված է սակագնում",
  },
  "session.extraAllFree": {
    en: "Free: covered by the rate ({0})",
    ru: "Бесплатно: входит в тариф ({0})",
    am: "Անվճար՝ ներառված է սակագնում ({0})",
  },
  "session.addItem": { en: "Add a product", ru: "Добавить товар", am: "Ավելացնել ապրանք" },
  "session.availableProducts": { en: "Available products", ru: "Доступные товары", am: "Հասանելի ապրանքներ" },
  "session.addedProducts": { en: "Added products", ru: "Добавленные товары", am: "Ավելացված ապրանքներ" },
  "session.nothingAdded": {
    en: "Nothing added yet. Pick a product above.",
    ru: "Пока ничего не добавлено. Выберите товар выше.",
    am: "Դեռ ոչինչ ավելացված չէ։ Ընտրեք ապրանք վերևում։",
  },
  "session.noSearchMatches": { en: "Nothing matches that search.", ru: "Ничего не найдено.", am: "Ոչինչ չի գտնվել։" },
  "session.itemsTotal": { en: "Products total", ru: "Итого за товары", am: "Ընդամենը ապրանքների համար" },
  "session.decrease": { en: "One fewer", ru: "Убрать одну", am: "Մեկով պակաս" },
  "session.increase": { en: "One more", ru: "Добавить одну", am: "Մեկով ավելի" },
  "session.removeItem": { en: "Remove from the session", ru: "Удалить из сессии", am: "Հեռացնել սեսիայից" },
  // The dialog is a basket: nothing reaches the session until it is confirmed,
  // so the button says what confirming will do, and the count decides the word.
  "session.cartConfirmOne": {
    en: "Add the product to this session",
    ru: "Добавить товар к этой сессии",
    am: "Ավելացնել ապրանքն այս սեսիային",
  },
  "session.cartConfirmMany": {
    en: "Add the products to this session",
    ru: "Добавить товары к этой сессии",
    am: "Ավելացնել ապրանքներն այս սեսիային",
  },
  "session.adding": { en: "Adding…", ru: "Добавление…", am: "Ավելացվում է…" },
  "session.cartEmpty": {
    en: "Nothing selected yet. Pick a product above.",
    ru: "Пока ничего не выбрано. Выберите товар выше.",
    am: "Դեռ ոչինչ ընտրված չէ։ Ընտրեք ապրանք վերևում։",
  },
  "session.alreadyInSession": { en: "Already on the bill", ru: "Уже в сессии", am: "Արդեն հաշվին" },
  "session.addedOne": {
    en: "{0} × {1} added to the current session.",
    ru: "{0} × {1} успешно добавлен к текущей сессии.",
    am: "{0} × {1} ավելացվեց ընթացիկ սեսիային։",
  },
  "session.addedMany": {
    en: "Added to the current session: {0}.",
    ru: "Товары успешно добавлены к текущей сессии: {0}.",
    am: "Ավելացվեց ընթացիկ սեսիային՝ {0}։",
  },
  "session.addFailedOne": {
    en: "The product was not added to the current session.",
    ru: "Товар не добавлен к текущей сессии.",
    am: "Ապրանքը չավելացվեց ընթացիկ սեսիային։",
  },
  "session.addFailedMany": {
    en: "The products were not added to the current session.",
    ru: "Товары не добавлены к текущей сессии.",
    am: "Ապրանքները չավելացվեցին ընթացիկ սեսիային։",
  },
  "session.failReason": { en: "Reason: {0}", ru: "Причина: {0}", am: "Պատճառը՝ {0}" },
  "session.failUnknown": {
    en: "the server did not say why.",
    ru: "сервер не сообщил причину.",
    am: "սերվերը պատճառը չնշեց։",
  },
  "session.search": { en: "Search by name…", ru: "Поиск по названию…", am: "Որոնում անունով…" },
  "session.noProducts": { en: "No products in this branch yet. Create the first one below.", ru: "В этом филиале ещё нет товаров. Создайте первый ниже.", am: "Այս մասնաճյուղում ապրանքներ դեռ չկան։ Ստեղծեք առաջինը ներքևում։" },
  "session.added": { en: "Added", ru: "Добавлено", am: "Ավելացված է" },
  "session.checkoutTitle": { en: "Close session", ru: "Закрыть сессию", am: "Փակել սեսիան" },
  "session.checkoutDone": { en: "Receipt closed", ru: "Чек закрыт", am: "Հաշիվը փակված է" },
  "session.timePlayed": { en: "Time played", ru: "Время игры", am: "Խաղի ժամանակը" },
  "session.tariff": { en: "Tariff", ru: "Тариф", am: "Սակագին" },
  "session.totalDue": { en: "Total to pay", ru: "Итого к оплате", am: "Ընդամենը վճարելու" },
  "session.confirmStop": { en: "Confirm and close", ru: "Подтвердить и закрыть", am: "Հաստատել և փակել" },
  "session.closing": { en: "Closing…", ru: "Закрываем…", am: "Փակվում է…" },
  "session.fixedTariff": { en: "Fixed tariff", ru: "Фиксированный тариф", am: "Ֆիքսված սակագին" },
  "session.openByHour": { en: "By hour (open)", ru: "По часам (открытая)", am: "Ժամով (բաց)" },
  "session.tariffField": { en: "Tariff", ru: "Тариф", am: "Սակագին" },
  "session.hourlyRate": { en: "Hourly rate", ru: "Ставка за час", am: "Ժամային սակագին" },
  "session.editPrice": { en: "Change current price", ru: "Изменить текущую цену", am: "Փոխել ընթացիկ գինը" },
  "session.newHourlyRate": { en: "New price per hour", ru: "Новая цена за час", am: "Նոր գին մեկ ժամի համար" },
  "session.priceSaved": { en: "Saved", ru: "Сохранено", am: "Պահպանված է" },
  "session.savePriceHint": { en: "Save the new price, then press Start.", ru: "Сохраните новую цену, затем нажмите «Старт».", am: "Պահպանեք նոր գինը, ապա սեղմեք «Սկսել»։" },
  "session.groupComputers": { en: "Computer places", ru: "Места для компьютеров", am: "Համակարգիչների տեղեր" },
  "session.groupPs": { en: "PS places", ru: "Места для PS", am: "PS-ի տեղեր" },
  "session.groupOther": { en: "Other places", ru: "Другие места", am: "Այլ տեղեր" },
  "session.openHint": { en: "Time counts up. Cost is pro-rated by minute.", ru: "Время идёт вверх. Сумма считается пропорционально.", am: "Ժամանակը հաշվվում է աճողաբար։ Գումարը հաշվարկվում է ըստ րոպեների։" },
  "session.noPackages": { en: "No time packages yet. Add one on the «Branch prices» page.", ru: "Пакетов пока нет. Добавь на странице «Цены филиала».", am: "Ժամային փաթեթներ դեռ չկան։ Ավելացրեք «Մասնաճյուղի գները» էջում։" },
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
    en: "Congratulations. New subscriber",
    ru: "Поздравляем. Новый подписчик",
    am: "Շնորհավորում ենք։ Նոր բաժանորդ",
  },
  "notifications.branchSubscribedBody": {
    en: "subscribed to your branch",
    ru: "подписался на ваш филиал",
    am: "բաժանորդագրվեց ձեր մասնաճյուղին",
  },
  "notifications.tournamentJoinedHeadline": {
    en: "Congratulations. New tournament player",
    ru: "Поздравляем. Новый участник турнира",
    am: "Շնորհավորում ենք։ Մրցաշարի նոր խաղացող",
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
    am: "Ջնջե՞լ այս գրանցումը։",
  },
  // Under the question, for a VERIFIED player only (nobody else ever paid).
  // States the backend's rule (TournamentRefundService); whether a refund
  // happens is the server's decision, so this never promises one.
  "registrations.removeRefundNote": {
    en: "This player is verified. If the tournament has not ended yet, their entry fee is refunded and no longer counts in revenue.",
    ru: "Игрок подтверждён. Если турнир ещё не закончился, его взнос за участие возвращается и больше не учитывается в выручке.",
    am: "Խաղացողը հաստատված է։ Եթե մրցաշարը դեռ չի ավարտվել, նրա մասնակցության վճարը վերադարձվում է և այլևս չի հաշվվում եկամտում։",
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
    am: "Այս PC-ի տեղի համար գին սահմանված չէ։ Նախ սահմանեք այն «Մասնաճյուղի գները» էջում։",
  },
  "session.free": { en: "Free", ru: "Свободно", am: "Ազատ" },
  "session.reserved": { en: "Reserved", ru: "Зарезервировано", am: "Ամրագրված" },
  // Device (not seat) availability: the kiosk agent isn't connected, so the
  // machine can't be unlocked for a player and must not be billable either.
  "session.deviceOffline": { en: "Offline", ru: "Не в сети", am: "Անցանց" },
  "session.deviceOfflineHint": {
    en: "The device agent is not connected. A session cannot be started.",
    ru: "Агент устройства не подключён. Сессию начать нельзя.",
    am: "Սարքի Agent-ը միացված չէ։ Սեսիան հնարավոր չէ սկսել։",
  },
  "session.toastNewBooking": { en: "New booking", ru: "Новое бронирование", am: "Նոր ամրագրում" },
  "session.toastBookingExtended": { en: "Booking extended", ru: "Бронь продлена", am: "Ամրագրումը երկարաձգվել է" },
  // ── how the money was taken ─────────────────────────────────────────────
  // One answer, so radio buttons. Cash leads: it is the common case at a
  // counter and the default keeps an ordinary stop to one click.
  "session.payTitle": { en: "Payment method", ru: "Способ оплаты", am: "Վճարման եղանակ" },
  "session.payCash": { en: "Cash", ru: "Наличные", am: "Կանխիկ" },
  "session.payCard": { en: "Card", ru: "Карта", am: "Քարտ" },
  "session.payOther": { en: "Another method", ru: "Другой способ оплаты", am: "Այլ եղանակ" },
  "session.payOtherPlaceholder": { en: "For example, Idram", ru: "Например, Idram", am: "Օրինակ՝ Idram" },
  "session.payOtherRequired": {
    en: "Say which method it was.",
    ru: "Укажите, каким способом.",
    am: "Նշեք վճարման եղանակը։",
  },
  "session.boardTitle": { en: "Active Places", ru: "Активные места", am: "Ակտիվ տեղեր" },
  // How much of the room is in use. Counted off the tiles on screen, so the
  // line and the grid can never disagree.
  "session.boardCounts": {
    en: "{0} seats · {1} in use · {2} free",
    ru: "Всего {0} · Занято {1} · Свободно {2}",
    am: "Ընդամենը {0} · Զբաղված {1} · Ազատ {2}",
  },
  "session.dragToReorder": { en: "Drag to reorder", ru: "Перетащите, чтобы изменить порядок", am: "Քաշեք՝ դասավորությունը փոխելու համար" },
  "session.dragSectionHint": { en: "Drag to reorder sections", ru: "Перетащите, чтобы изменить порядок разделов", am: "Քաշեք՝ բաժինների դասավորությունը փոխելու համար" },
  "session.posNote": { en: "items", ru: "поз.", am: "միավոր" },
  "session.products": { en: "Products", ru: "Товары", am: "Ապրանքներ" },
  "session.removeItemTitle": { en: "Remove item", ru: "Удалить позицию", am: "Հեռացնել տողը" },
  "pcs.title": { en: "Computers", ru: "Компьютеры", am: "Համակարգիչներ" },
  "pcs.register": { en: "+ Register computer", ru: "+ Зарегистрировать компьютер", am: "+ Գրանցել համակարգիչ" },
  "pcs.editDevice": { en: "Edit computer", ru: "Редактировать компьютер", am: "Խմբագրել համակարգիչը" },
  "pcs.newDevice": { en: "Register computer", ru: "Зарегистрировать компьютер", am: "Գրանցել համակարգիչ" },
  "pcs.kind": { en: "Device type", ru: "Тип устройства", am: "Սարքի տեսակը" },
  "pcs.kindPc": { en: "PC (with agent)", ru: "ПК (с агентом)", am: "PC (Agent-ով)" },
  "pcs.kindPs": { en: "PlayStation / console", ru: "PlayStation / консоль", am: "PlayStation / կոնսոլ" },
  "pcs.psHint": { en: "No agent runs on a console. Billing-only device: timer + cost.", ru: "На консоль агент не ставится. Это билинг-устройство: только таймер и расчёт стоимости.", am: "Կոնսոլի վրա Agent չի տեղադրվում։ Միայն ժամաչափ և գումար։" },
  "pcs.label": { en: "Label (e.g. PC #5)", ru: "Метка (напр. PC #5)", am: "Պիտակ (օր. PC #5)" },
  "pcs.macHint": { en: "Used only for Wake-on-LAN. The PC connects via the agent app paired with the token.", ru: "Используется только для Wake-on-LAN. ПК подключается через агент с токеном, не через MAC.", am: "Օգտագործվում է միայն Wake-on-LAN-ի համար։ Համակարգիչը միանում է թոքենով զուգակցված Agent ծրագրի միջոցով։" },
  "pcs.placeId": { en: "Linked place", ru: "Связанное место", am: "Կապված տեղ" },
  "pcs.placeRequired": { en: "Linked place is required.", ru: "Связанное место обязательно.", am: "Կապված տեղը պարտադիր է։" },
  "pcs.placeNone": { en: "none", ru: "нет", am: "չկա" },
  "pcs.placeEmpty": {
    en: "No places in this branch yet. Add places first to link this device to one.",
    ru: "В этом филиале ещё нет мест. Сначала создайте места, чтобы связать с ними устройство.",
    am: "Այս մասնաճյուղում տեղեր դեռ չկան։ Նախ ավելացրեք տեղեր, որպեսզի սարքը կապեք դրանցից մեկին։",
  },
  "pcs.placeOption": {
    en: "№{0} · {1} · {2}",
    ru: "№{0} · {1} · {2}",
    am: "№{0} · {1} · {2}",
  },
  // Price-tier selector — replaces the old free-text hourly_rate input
  // so PCs draw their price from the branch matrix and can't drift.
  "pcs.tierLabel": { en: "Price tier", ru: "Тариф", am: "Սակագին" },
  "pcs.tierPickPlace": { en: "Select a place first. Its tariff appears here.", ru: "Сначала выберите место. Его тариф появится здесь.", am: "Նախ ընտրեք տեղը։ Դրա սակագինը կհայտնվի այստեղ։" },
  "pcs.tierPlaceholder": { en: "Choose a tier…", ru: "Выберите тариф…", am: "Ընտրեք սակագինը…" },
  "pcs.tierNoPrices": {
    en: "Branch prices are not configured yet. Set them in Tariffs first, then come back.",
    ru: "Цены филиала ещё не настроены. Сначала задайте их в «Тарифах», потом вернитесь сюда.",
    am: "Մասնաճյուղի գները դեռ կարգավորված չեն։ Նախ սահմանեք դրանք «Սակագներ» բաժնում, ապա վերադարձեք։",
  },
  "pcs.tierEmpty": { en: "no price set", ru: "цена не задана", am: "գին նշված չէ" },
  "pcs.tierOverwrite": {
    en: "Current rate differs from the selected tier. Saving will overwrite it.",
    ru: "Текущая цена не совпадает с выбранным тарифом. Сохранение перезапишет её.",
    am: "Ընթացիկ սակագինը տարբերվում է ընտրվածից։ Պահպանելիս այն կփոխարինվի։",
  },
  "pcs.tier.pcStandard":  { en: "Standard",     ru: "Стандарт",     am: "Ստանդարտ" },
  "pcs.tier.pcVip":       { en: "VIP",          ru: "VIP",          am: "VIP" },
  "pcs.tier.ps4Standard": { en: "PS4 Standard", ru: "PS4 Стандарт", am: "PS4 Ստանդարտ" },
  "pcs.tier.ps4Vip":      { en: "PS4 VIP",      ru: "PS4 VIP",      am: "PS4 VIP" },
  "pcs.tier.ps5Standard": { en: "PS5 Standard", ru: "PS5 Стандарт", am: "PS5 Ստանդարտ" },
  "pcs.tier.ps5Vip":      { en: "PS5 VIP",      ru: "PS5 VIP",      am: "PS5 VIP" },
  "time.hourShort": { en: "h", ru: "ч", am: "ժ" },
  "time.minShort": { en: "min", ru: "мин", am: "ր" },
  "time.secShort": { en: "s", ru: "сек", am: "վրկ" },

  // Live board statuses (grammatical forms: short adjectives where natural)
  "live.title": { en: "Live", ru: "В реальном времени", am: "Իրական ժամանակում" },
  "live.updated": { en: "updated", ru: "обновлено", am: "թարմացված է" },
  "live.failedLoad": { en: "Failed to load live data", ru: "Не удалось загрузить данные", am: "Չհաջողվեց բեռնել տվյալները" },
  "live.total": { en: "Total", ru: "Всего", am: "Ընդամենը" },
  "live.till": { en: "till", ru: "до", am: "մինչև" },
  "live.from": { en: "from", ru: "с", am: "սկսած" },
  "place.free": { en: "Free", ru: "Свободно", am: "Ազատ" },
  "place.busy": { en: "Busy", ru: "Занято", am: "Զբաղված" },
  "place.reserved": { en: "Reserved", ru: "Зарезервировано", am: "Ամրագրված" },
  "place.maintenance": { en: "Maintenance", ru: "На обслуживании", am: "Սպասարկման մեջ" },

  // Branch hub tiles
  "hub.invalidId": { en: "Invalid branch id.", ru: "Неверный идентификатор филиала.", am: "Մասնաճյուղի ID-ն սխալ է։" },
  "hub.tile.sessions": { en: "Active Places", ru: "Активные места", am: "Ակտիվ տեղեր" },
  "hub.tile.sessionsHint": { en: "Start / stop · billing", ru: "Старт / стоп · биллинг", am: "Մեկնարկ / ավարտ · վճարում" },
  "hub.tile.members": { en: "Members", ru: "Клиенты", am: "Հաճախորդներ" },
  "hub.tile.membersHint": { en: "Cards & deposits", ru: "Карты и депозиты", am: "Քարտեր և ավանդներ" },
  "hub.tile.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "hub.tile.placesHint": { en: "Bookable seats · games", ru: "Места для бронирования · игры", am: "Ամրագրման տեղեր · խաղեր" },
  "hub.tile.games": { en: "Games", ru: "Игры", am: "Խաղեր" },
  "hub.tile.gamesHint": { en: "This branch's game library", ru: "Библиотека игр филиала", am: "Մասնաճյուղի խաղերի գրադարան" },
  "hub.tile.pcs": { en: "PCs", ru: "ПК", am: "Համակարգիչներ" },
  "hub.tile.pcsHint": { en: "Agent registration", ru: "Регистрация агента", am: "Agent-ի գրանցում" },
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
  "hub.tile.products": { en: "Products", ru: "Товары", am: "Ապրանքներ" },
  "hub.tile.productsHint": { en: "Sold on the session bill", ru: "Продаются в счёт сессии", am: "Վաճառք սեսիայի հաշվում" },
  // Касса: selling at the counter with no gaming session (2026-09-24).
  "hub.tile.till": { en: "Till", ru: "Касса", am: "Դրամարկղ" },
  "hub.tile.tillHint": { en: "Sell products without a session", ru: "Продажа товаров без сессии", am: "Ապրանքների վաճառք առանց սեսիայի" },
  "till.title": { en: "Till", ru: "Касса", am: "Դրամարկղ" },
  "till.sell": { en: "Sell products", ru: "Продать товар", am: "Վաճառել ապրանք" },
  "till.sellTitle": { en: "Product sale", ru: "Продажа товара", am: "Ապրանքի վաճառք" },
  "till.sellConfirm": { en: "Sell", ru: "Продать", am: "Վաճառել" },
  "till.selling": { en: "Selling…", ru: "Продаём…", am: "Վաճառվում է…" },
  "till.sold": { en: "Sold: {0}", ru: "Продано: {0}", am: "Վաճառված է՝ {0}" },
  "till.total": { en: "Total", ru: "Итого", am: "Ընդամենը" },
  "till.today": { en: "Today's sales", ru: "Продажи за сегодня", am: "Այսօրվա վաճառքը" },
  "till.voided": { en: "voided", ru: "отменена", am: "չեղարկված" },
  "till.payDeposit": { en: "Member balance", ru: "Баланс участника", am: "Հաճախորդի հաշվեկշիռ" },
  "hub.tile.managers": { en: "Managers", ru: "Менеджеры", am: "Մենեջերներ" },
  "hub.tile.managersHint": { en: "Branch staff", ru: "Сотрудники филиала", am: "Մասնաճյուղի աշխատակազմ" },
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
  // The sign-in mosaic and the sign-in hold (2026-10-07), desktop and owner web.
  "captcha.title": { en: "Confirm you are a person", ru: "Подтвердите, что вы человек", am: "Հաստատեք, որ մարդ եք" },
  "captcha.hint": {
    en: "Tap two pieces to swap them, until the picture is whole.",
    ru: "Нажмите на два кусочка, чтобы поменять их местами, пока картинка не соберётся.",
    am: "Հպեք երկու կտորի՝ դրանց տեղերը փոխելու համար, մինչև նկարն ամբողջանա։",
  },
  "captcha.needed": {
    en: "Too many failed attempts. Put the mosaic together to continue.",
    ru: "Слишком много неудачных попыток. Соберите мозаику, чтобы продолжить.",
    am: "Չափազանց շատ անհաջող փորձեր։ Հավաքեք խճանկարը՝ շարունակելու համար։",
  },
  "captcha.refresh": { en: "New picture", ru: "Новая картинка", am: "Նոր նկար" },
  "captcha.tile": { en: "Piece {0}", ru: "Кусочек {0}", am: "Կտոր {0}" },
  "captcha.pickedHint": {
    en: "Now tap the piece to swap it with.",
    ru: "Теперь нажмите на кусочек, с которым поменять.",
    am: "Այժմ հպեք այն կտորին, որի հետ պետք է փոխել։",
  },
  "captcha.check": { en: "Check", ru: "Проверить", am: "Ստուգել" },
  "captcha.checking": { en: "Checking…", ru: "Проверяем…", am: "Ստուգում ենք…" },
  "captcha.solved": { en: "Done.", ru: "Готово.", am: "Պատրաստ է։" },
  "login.captchaPassed": {
    en: "Check passed. Make sure the email and password are right, then sign in.",
    ru: "Проверка пройдена. Проверьте email и пароль и нажмите «Вход».",
    am: "Ստուգումն անցավ։ Համոզվեք, որ էլ. փոստն ու գաղտնաբառը ճիշտ են, ապա մուտք գործեք։",
  },
  "captcha.wrong": {
    en: "The mosaic is not put together right. Here is a new picture, try again.",
    ru: "Мозаика собрана неправильно. Вот новая картинка, попробуйте ещё раз.",
    am: "Խճանկարը ճիշտ չի հավաքված։ Ահա նոր նկար, փորձեք կրկին։",
  },
  "captcha.loadFailed": {
    en: "The picture did not load. Check the connection and try again.",
    ru: "Картинка не загрузилась. Проверьте подключение и попробуйте ещё раз.",
    am: "Նկարը չբեռնվեց։ Ստուգեք կապը և փորձեք կրկին։",
  },
  "captcha.retry": { en: "Try again", ru: "Повторить", am: "Կրկնել" },
  "login.hold.locked": { en: "Sign-in is temporarily closed", ru: "Вход временно заблокирован", am: "Մուտքը ժամանակավորապես արգելափակված է" },
  "login.hold.throttled": { en: "Too many sign-in attempts", ru: "Слишком много попыток входа", am: "Չափազանց շատ մուտքի փորձեր" },
  "login.hold.retryIn": { en: "Try again in", ru: "Попробовать снова через", am: "Մինչև նոր փորձը մնացել է" },
  "login.hold.ready": {
    en: "You can try to sign in again.",
    ru: "Теперь можно попробовать войти снова.",
    am: "Այժմ կարող եք կրկին փորձել մուտք գործել։",
  },
  "login.forgetEmail": { en: "Forget this address", ru: "Забыть этот адрес", am: "Մոռանալ այս հասցեն" },

  // Switching to a manager account (owner only)
  "switchAccount.cta": { en: "Switch to another account", ru: "Переключиться на другой аккаунт", am: "Անցնել այլ հաշվի" },
  "switchAccount.title": { en: "Company accounts", ru: "Аккаунты компании", am: "Ընկերության հաշիվներ" },
  "switchAccount.filter": { en: "Search by name, email or branch", ru: "Поиск по имени, почте или филиалу", am: "Որոնում ըստ անվան, էլ. հասցեի կամ մասնաճյուղի" },
  "switchAccount.empty": { en: "No other accounts available yet", ru: "Других аккаунтов пока нет", am: "Այլ հաշիվներ դեռ չկան" },
  "switchAccount.noMatch": { en: "No account matches", ru: "Ничего не найдено", am: "Համընկնում չկա" },
  "switchAccount.unnamed": { en: "Unnamed account", ru: "Без имени", am: "Անանուն հաշիվ" },
  "switchAccount.passwordHint": { en: "Enter this account's password to continue as them.", ru: "Введите пароль этого аккаунта, чтобы войти под ним.", am: "Մուտքագրեք այս հաշվի գաղտնաբառը՝ նրա անունից շարունակելու համար։" },
  "switchAccount.signIn": { en: "Sign in to this account", ru: "Войти в этот аккаунт", am: "Մուտք գործել այս հաշիվ" },
  "switchAccount.forgot": { en: "Reset the password", ru: "Сбросить пароль", am: "Վերականգնել գաղտնաբառը" },
  "switchAccount.done": { en: "Signed in as {0}", ru: "Вы вошли как {0}", am: "Մուտք գործեցիք որպես {0}" },

  // Sessions history
  // "Sales history", not "Sessions history": the screen summarises what a
  // branch TOOK over a period — sessions closed, items sold, money — rather
  // than listing sessions as events. The old name sent people looking for a
  // log and made the revenue tiles beneath it read as a surprise.
  "history.title": { en: "Sales history", ru: "История торговли", am: "Վաճառքների պատմություն" },
  "history.from": { en: "From", ru: "С", am: "Սկսած" },
  "history.to": { en: "To", ru: "По", am: "Մինչև" },
  "history.today": { en: "Today", ru: "Сегодня", am: "Այսօր" },
  "history.yesterday": { en: "Yesterday", ru: "Вчера", am: "Երեկ" },
  "history.month": { en: "This month", ru: "Текущий месяц", am: "Ընթացիկ ամիս" },
  "history.backToBoard": { en: "Back to Active Places", ru: "К активным местам", am: "Վերադառնալ ակտիվ տեղերին" },
  "history.sumSessions": { en: "Sessions", ru: "Сессии", am: "Սեսիաներ" },
  "history.sumTotal": { en: "Total revenue", ru: "Выручка", am: "Ընդհանուր եկամուտ" },
  "history.sumTime": { en: "Time revenue", ru: "За время", am: "Ժամանակի դիմաց" },
  "history.sumItemsRevenue": { en: "Items revenue", ru: "Товары · сумма", am: "Ապրանքների գումար" },
  "history.sumItemsQty": { en: "Items sold", ru: "Продано позиций", am: "Վաճառված ապրանքներ" },
  "history.topItems": { en: "Top items", ru: "Топ позиций", am: "Ամենավաճառվածները" },
  "history.timeCost": { en: "Time", ru: "За время", am: "Ժամանակի դիմաց" },
  "history.itemsTotal": { en: "Items", ru: "Товары", am: "Ապրանքներ" },
  "history.total": { en: "Total", ru: "Итог", am: "Ընդհանուր" },
  /* ── the Prices screen's two new sections ─────────────────────────────── */
  "session.padChoose": { en: "Choose a joystick", ru: "Выберите джойстик", am: "Ընտրեք ջոյսթիք" },
  "session.padOption": { en: "Joystick #{0}", ru: "{0}-й джойстик", am: "Ջոյսթիք №{0}" },
  "session.padSharedOption": { en: "Joystick 3/4", ru: "Джойстик 3/4", am: "Ջոյսթիք 3/4" },
  "session.padFree": { en: "free", ru: "бесплатно", am: "անվճար" },
  "session.padNoPrice": { en: "no price set", ru: "цена не задана", am: "գինը սահմանված չէ" },
  "session.padNoneAvailable": {
    en: "No extra joysticks are offered at this branch",
    ru: "Нет доступных дополнительных джойстиков",
    am: "Այս մասնաճյուղում լրացուցիչ ջոյսթիքներ չեն տրամադրվում",
  },
  "session.padRemove": { en: "Take the last joystick back", ru: "Снять последний джойстик", am: "Հետ վերցնել վերջին ջոյսթիքը" },
  "joystickPrice.strategy": { en: "Joystick pricing", ru: "Стратегия джойстиков", am: "Ջոյսթիքների սակագին" },
  "joystickPrice.strategy.fixed": { en: "Fixed price", ru: "Фиксированная цена", am: "Ֆիքսված գին" },
  "joystickPrice.strategy.hourly": { en: "Changes the hourly rate", ru: "Изменение тарифа", am: "Փոխում է ժամավճարը" },
  "joystickPrice.appliesTo": { en: "Price applies to", ru: "Цена применяется к", am: "Գինը վերաբերում է" },

  "joystickPrice.appliesFallback": {
    en: "Nothing chosen yet, so every joystick from the {0} one onwards is charged, as before.",
    ru: "Пока ничего не выбрано, поэтому платными считаются джойстики начиная с {0}-го, как и раньше.",
    am: "Դեռ ոչինչ ընտրված չէ, ուստի վճարովի են {0}-րդից սկսած ջոյսթիքները, ինչպես նախկինում։",
  },
  "joystickPrice.freeNote": {
    en: "Extra joysticks are handed out for nothing. Each one is still a line on the bill, at zero.",
    ru: "Дополнительные джойстики выдаются бесплатно. Каждый всё равно попадает в счёт, по нулевой цене.",
    am: "Լրացուցիչ ջոյսթիքները տրվում են անվճար։ Յուրաքանչյուրը, միևնույն է, հաշվում առանձին տող է՝ զրո գնով։",
  },
  "joystickPrice.noneNote": {
    en: "Extra joysticks are not offered at this branch. The session card refuses to add one.",
    ru: "В этом филиале дополнительные джойстики не выдаются. Карточка сессии откажет в добавлении.",
    am: "Այս մասնաճյուղում լրացուցիչ ջոյսթիքներ չեն տրվում։ Սեսիայի քարտը թույլ չի տա ավելացնել։",
  },
  "joystickPrice.paidNeedsPrice": {
    en: "Enter the price, or choose Free or Not offered.",
    ru: "Укажите цену или выберите «Бесплатно» либо «Не выдаются».",
    am: "Նշեք գինը կամ ընտրեք «Անվճար» կամ «Չեն տրվում»։",
  },
  "joystickPrice.allIncluded": {
    en: "Every joystick a seat can hold is in the rate, so nothing here is ever charged.",
    ru: "Все джойстики места входят в тариф, поэтому здесь ничего не начисляется.",
    am: "Տեղի բոլոր ջոյսթիքները ներառված են սակագնում, ուստի այստեղից ոչինչ չի գանձվում։",
  },
  "joystickPrice.slot": { en: "Joystick #{0}", ru: "Джойстик №{0}", am: "Ջոյսթիք №{0}" },
  "session.padTaken": { en: "already in use", ru: "уже используется", am: "արդեն օգտագործվում է" },
  // The seat's ONE fee, already taken. A different thing from a venue that
  // hands pads out free, and a cashier has to be able to tell them apart.
  // The switch a "one payment" venue gets instead of the menu. The label says
  // what pressing it does AND what the seat is holding — on a tile this size a
  // separate state line would cost more room than it is worth.
  "session.padAddOne": { en: "Add joystick", ru: "Выдать джойстик", am: "Տալ ջոյսթիք" },
  "session.padRemoveOne": { en: "Remove joystick", ru: "Забрать джойстик", am: "Վերցնել ջոյսթիքը" },
  // One word. The figure beside it on the same line already says how much was
  // charged; what this adds is that the NEXT controller costs nothing.
  "session.padFeeTaken": {
    en: "paid",
    ru: "оплачено",
    am: "վճարված",
  },
  "joystickPrice.yes": { en: "Yes", ru: "Да", am: "Այո" },
  "joystickPrice.no": { en: "No", ru: "Нет", am: "Ոչ" },
  "joystickPrice.price3": { en: "Price of the 3rd joystick", ru: "Цена 3-го джойстика", am: "3-րդ ջոյսթիքի գին" },
  "joystickPrice.price4": { en: "Price of the 4th joystick", ru: "Цена 4-го джойстика", am: "4-րդ ջոյսթիքի գին" },
  "joystickPrice.priceShared": { en: "Price of the 3rd/4th joystick", ru: "Цена 3/4 джойстика", am: "3/4 ջոյսթիքի գին" },
  "joystickPrice.setupExplain.only3": {
    en: "This branch hands out three controllers. A fourth is not offered at all.",
    ru: "Филиал выдаёт три контроллера. Четвёртый не выдаётся вообще.",
    am: "Մասնաճյուղը տրամադրում է երեք ջոյսթիք։ Չորրորդը ընդհանրապես չի տրվում։",
  },
  "joystickPrice.setupExplain.separate": {
    en: "3 | 4: the third and the fourth joystick have their own prices.",
    ru: "3 | 4: 3-й и 4-й джойстики имеют собственные цены.",
    am: "3 | 4: 3-րդ և 4-րդ ջոյսթիքներն ունեն իրենց գները։",
  },
  "joystickPrice.setupExplain.shared": {
    en: "3/4: one price for an extra controller, whether it is the third or the fourth.",
    ru: "3/4: одна цена за дополнительный контроллер, будь он 3-м или 4-м.",
    am: "3/4: մեկ գին լրացուցիչ ջոյսթիքի համար՝ լինի այն երրորդը, թե չորրորդը։",
  },
  "joystickPrice.fourthNeedsPrice": {
    en: "Enter the fourth joystick's price, or answer No above.",
    ru: "Укажите цену 4-го джойстика или ответьте «Нет» выше.",
    am: "Նշեք 4-րդ ջոյսթիքի գինը կամ վերևում պատասխանեք «Ոչ»։",
  },
  // The owner's limit on one pause; at the limit the server resumes by itself.
  "pauseLimit.sectionTitle": { en: "Pause limit", ru: "Лимит паузы", am: "Դադարի սահմանաչափ" },
  "pauseLimit.label": { en: "Maximum pause", ru: "Максимальная пауза", am: "Առավելագույն դադար" },
  "pauseLimit.none": { en: "No limit", ru: "Без лимита", am: "Առանց սահմանաչափի" },
  "pauseLimit.hint": {
    en: "When a pause reaches this length, the session resumes by itself and billing continues. Leave empty for no limit. Applies to pauses started after saving.",
    ru: "Когда пауза достигает этой длины, сессия продолжается сама и оплата снова идёт. Если поле пустое, лимита нет. Действует на паузы, начатые после сохранения.",
    am: "Երբ դադարը հասնում է այս տևողությանը, սեսիան ինքնաբերաբար շարունակվում է, և վճարումը վերսկսվում է։ Դատարկ՝ առանց սահմանաչափի։ Կիրառվում է պահպանելուց հետո սկսված դադարների վրա։",
  },
  "pauseLimit.invalid": {
    en: "Enter whole minutes from 1 to {0}, or leave empty.",
    ru: "Введите целое число минут от 1 до {0} или оставьте пустым.",
    am: "Մուտքագրեք ամբողջ թիվ՝ 1-ից {0} րոպե, կամ թողեք դատարկ։",
  },
  "pauseLimit.saved": { en: "Pause limit saved", ru: "Лимит паузы сохранён", am: "Դադարի սահմանաչափը պահպանվեց" },
  "rounding.sectionTitle": { en: "Rounding the bill", ru: "Округление счёта", am: "Հաշվի կլորացում" },
  "rounding.hint": {
    en: "Time is always billed for the minutes actually played. This rounds the FINAL amount, once. A 45-minute session at 1500/h is 1125 before rounding.",
    ru: "Время всегда считается по фактически сыгранным минутам. Здесь округляется ИТОГОВАЯ сумма, один раз: 45 минут по 1500/час. Это 1125 до округления.",
    am: "Ժամանակը միշտ հաշվարկվում է փաստացի խաղացած րոպեներով։ Այստեղ կլորացվում է ՎԵՐՋՆԱԿԱՆ գումարը, մեկ անգամ. 45 րոպեն 1500/ժամ սակագնով 1125 է մինչև կլորացումը։",
  },
  "rounding.step": { en: "Round to", ru: "Округлять до", am: "Կլորացնել մինչև" },
  "rounding.stepNone": { en: "Do not round", ru: "Не округлять", am: "Չկլորացնել" },
  "rounding.mode": { en: "Direction", ru: "Направление", am: "Ուղղություն" },
  "rounding.mode.up": { en: "Up", ru: "Вверх", am: "Վերև" },
  "rounding.mode.nearest": { en: "Nearest", ru: "К ближайшему", am: "Դեպի մոտակա" },
  "rounding.mode.down": { en: "Down", ru: "Вниз", am: "Ներքև" },
  "rounding.example": { en: "Example: {0} → {1}", ru: "Пример: {0} → {1}", am: "Օրինակ՝ {0} → {1}" },
  "rounding.saved": { en: "Rounding saved", ru: "Округление сохранено", am: "Կլորացումը պահպանվեց" },
  "history.joysticks": { en: "Joysticks", ru: "Джойстики", am: "Ջոյսթիքներ" },
  // Attribution on a session row. Replaces the single "Opened by" this screen
  // used to carry: half the answer, because the venue's real question after a
  // long evening is who let the seat run and until WHEN — and a session that
  // crossed a shift change was closed by somebody else entirely.
  "history.startedBy": { en: "Started by", ru: "Запустил", am: "Սկսել է" },
  "history.endedBy": { en: "Ended by", ru: "Завершил", am: "Ավարտել է" },
  // Nobody pressed Stop: the kiosk agent expired the session when its paid
  // time ran out. Saying "-" would read as missing data rather than as the
  // answer, which is what it is.
  "history.endedAutomatically": { en: "Automatically", ru: "Автоматически", am: "Ավտոմատ" },
  // The session card (2026-09-26): its facts and its activity timeline.
  "history.timeLabel": { en: "Time", ru: "Время", am: "Ժամանակ" },
  "history.seatsLabel": { en: "Seats", ru: "Места", am: "Տեղեր" },
  "history.timelineLoading": { en: "Loading the history…", ru: "Загружаем историю…", am: "Բեռնում ենք պատմությունը…" },
  // `{0}` is how many events the folded card is not showing.
  "history.showMore": { en: "Show {0} more", ru: "Показать ещё {0}", am: "Ցույց տալ ևս {0}" },
  "history.collapse": { en: "Show less", ru: "Свернуть", am: "Ծալել" },
  // A resume nobody pressed: the server's, at the branch's pause limit.
  "history.autoResumeTitle": { en: "Resumed automatically", ru: "Автоматическое продолжение", am: "Ավտոմատ շարունակում" },
  "history.pauseLimitReason": { en: "At the pause limit", ru: "По лимиту паузы", am: "Դադարի սահմանաչափով" },
  // The staff filter (2026-09-26): whose actions the page shows.
  "history.actorLabel": { en: "Staff member", ru: "Сотрудник", am: "Աշխատակից" },
  "history.actorAll": { en: "All staff", ru: "Все сотрудники", am: "Բոլոր աշխատակիցները" },
  "history.noActions": {
    en: "No actions in the selected period.",
    ru: "Нет действий за выбранный период.",
    am: "Ընտրված ժամանակահատվածում գործողություններ չկան։",
  },
  // The timeline's scroll region, for a screen reader and the keyboard.
  "history.activityLabel": { en: "Activity", ru: "Действия", am: "Գործողություններ" },
  // The bill on a History card, laid out as a receipt (2026-09-26).
  // A product handed out with the seat, once per session (2026-09-27).
  // The Add Product dialog's section for them, and taking a line off a bill.
  "session.additionalTitle": { en: "Additional items", ru: "Дополнительные предметы", am: "Լրացուցիչ իրեր" },
  "session.additionalHint": {
    en: "Handed out once per session",
    ru: "Выдаётся один раз за сессию",
    am: "Տրվում է մեկ անգամ յուրաքանչյուր սեսիայում",
  },
  // The Add Product dialog's two sections.
  "session.addSections": { en: "What to add", ru: "Что добавить", am: "Ինչ ավելացնել" },
  "session.sectionProducts": { en: "Products", ru: "Товары", am: "Ապրանքներ" },
  "session.additionalRemove": { en: "Remove", ru: "Убрать", am: "Հանել" },
  "session.additionalChosen": { en: "Chosen: {0} · {1}", ru: "Выбрано: {0} · {1}", am: "Ընտրված է՝ {0} · {1}" },
  "session.additionalOnBill": { en: "Handed out", ru: "Уже выдано", am: "Արդեն տրված է" },
  "session.removeConfirm": {
    en: "Take «{0}» off this bill?",
    ru: "Удалить «{0}» из счёта?",
    am: "Հեռացնե՞լ «{0}»-ը հաշվից։",
  },
  "product.kindAdditionalShort": { en: "Additional item", ru: "Доп. предмет", am: "Լրացուցիչ իր" },
  "history.billTitle": { en: "Bill", ru: "Счёт", am: "Հաշիվ" },
  // Its columns, and the play-time row.
  "history.billItem": { en: "Item", ru: "Позиция", am: "Ապրանք" },
  "history.billQty": { en: "Qty", ru: "Кол-во", am: "Քանակ" },
  "history.billPrice": { en: "Price", ru: "Цена", am: "Գին" },
  "history.billSum": { en: "Amount", ru: "Сумма", am: "Գումար" },
  "history.billTime": { en: "Play time", ru: "Игровое время", am: "Խաղային ժամանակ" },
  "history.branch": { en: "Branch", ru: "Филиал", am: "Մասնաճյուղ" },
  "history.actionsEmpty": { en: "Nothing beyond the start.", ru: "Кроме старта. Ничего.", am: "Բացի սկսելուց՝ ոչինչ։" },
  "history.sumFree": { en: "Free sessions", ru: "Бесплатные сессии", am: "Անվճար սեսիաներ" },
  "history.sumWaived": { en: "Waived", ru: "Списано", am: "Դուրս գրված" },
  "history.action.started": { en: "Started the session", ru: "Начал сессию", am: "Սկսեց սեսիան" },
  "history.action.stopped": { en: "Stopped the session", ru: "Завершил сессию", am: "Ավարտեց սեսիան" },
  "history.action.joystick_added": { en: "Added a joystick", ru: "Добавил джойстик", am: "Ավելացրեց ջոյսթիք" },
  "history.action.joystick_removed": { en: "Removed a joystick", ru: "Убрал джойстик", am: "Հեռացրեց ջոյսթիք" },
  "history.action.time_added": { en: "Added time", ru: "Добавил время", am: "Ավելացրեց ժամանակ" },
  "history.action.made_unlimited": { en: "Switched to unlimited", ru: "Перевёл на безлимит", am: "Դարձրեց անսահմանափակ" },
  "history.action.paused": { en: "Paused the session", ru: "Поставил сессию на паузу", am: "Սեսիան դրեց դադարի" },
  "history.action.resumed": { en: "Resumed the session", ru: "Продолжил сессию", am: "Շարունակեց սեսիան" },
  "history.pausedFor": { en: "Paused for", ru: "Пауза длилась", am: "Դադարը տևեց" },
  "history.rateSetByHand": { en: "price set by hand", ru: "цена изменена вручную", am: "գինը փոխվել է ձեռքով" },
  "history.action.free_enabled": { en: "Made it free", ru: "Сделал бесплатной", am: "Դարձրեց անվճար" },
  "history.action.free_disabled": { en: "Made it paid again", ru: "Вернул оплату", am: "Կրկին դարձրեց վճարովի" },
  // The seat migration. Emitted by the server since the feature shipped; the
  // log had no label for it and printed the raw key.
  "history.action.moved": { en: "Moved the session", ru: "Перенёс сессию", am: "Տեղափոխեց սեսիան" },
  "history.action.item_added": { en: "Put it on the bill", ru: "Добавил в счёт", am: "Ավելացրեց հաշվին" },
  "history.action.item_removed": { en: "Took it off the bill", ru: "Убрал из счёта", am: "Հանեց հաշվից" },
  // Not a removal: the line stays on the bill with what it earned, and only
  // its clock stopped — the same distinction a returned pad carries.
  "history.action.item_returned": { en: "Took the item back", ru: "Принял предмет обратно", am: "Հետ ընդունեց իրը" },
  // ⚠️ The refusals. Named as attempts, because that is what they were: the
  // line that explains why a move follows it.
  "history.action.time_add_refused": {
    en: "Could not add time here",
    ru: "Не удалось продлить на этом месте",
    am: "Չհաջողվեց երկարաձգել այս տեղում",
  },
  "history.action.move_failed": {
    en: "The move did not go through",
    ru: "Перенос не состоялся",
    am: "Տեղափոխումը չկայացավ",
  },
  "history.seatBooked": {
    en: "the seat is booked in the app",
    ru: "место забронировано в приложении",
    am: "տեղն ամրագրված է հավելվածում",
  },
  "history.seatTaken": {
    en: "the seat was taken first",
    ru: "место успели занять",
    am: "տեղն արդեն զբաղեցված էր",
  },
  "history.itemsCount": { en: "Lines", ru: "Позиций", am: "Ապրանքներ" },
  "history.seatUnknown": { en: "Seat not recorded", ru: "Место не записано", am: "Տեղը գրանցված չէ" },
  "history.noRefundShort": { en: "no refund", ru: "без возврата", am: "առանց վերադարձի" },

  // ── what each line actually changed ──────────────────────────────────────
  // Written by the server into the event's `meta` and, until now, not read.
  "history.playedBeforeMove": {
    en: "Played before the move",
    ru: "Сыграно до переноса",
    am: "Խաղացել է տեղափոխումից առաջ",
  },
  "history.untilLabel": { en: "until", ru: "до", am: "մինչև" },
  // What the seat that was left had run up, as the server priced it at the
  // moment of the move. Unrecoverable afterwards: the session row describes
  // the NEW seat from then on.
  "history.totalBeforeMove": {
    en: "Bill before the move",
    ru: "Счёт до переноса",
    am: "Հաշիվը տեղափոխումից առաջ",
  },
  "history.padsNow": { en: "Joysticks now", ru: "Джойстиков стало", am: "Ջոյսթիքներ այժմ" },
  "history.padUnitPrice": { en: "Price for one", ru: "Цена за 1", am: "Մեկի գինը" },
  // ⚠️ Said in words. Taking a pad out of play refunds nothing, the amount on
  // the line is already 0, and silence there reads as an omission rather than
  // as the rule.
  "history.padNoRefund": { en: "Refund: 0", ru: "Возврат: 0", am: "Վերադարձ՝ 0" },
  "history.modeOpen": { en: "By the hour", ru: "Почасовая", am: "Ժամային" },
  "history.modeFixed": { en: "Package", ru: "Пакет", am: "Փաթեթ" },
  "history.status.active": { en: "Active", ru: "Активна", am: "Ակտիվ" },
  "history.status.stopped": { en: "Closed", ru: "Закрыта", am: "Փակված" },
  "history.status.expired": { en: "Expired", ru: "Истекла", am: "Ժամկետանց" },

  // Branch places admin (CRUD seats per branch)
  "branchPlaces.title": { en: "Places", ru: "Места", am: "Տեղեր" },
  "branchPlaces.intro": { en: "A place is a bookable seat (e.g. PC #1, PS5 VIP #2). Each place gets games linked.", ru: "Место. Это место для бронирования (например, ПК №1, PS5 VIP №2). К каждому месту привязываются игры.", am: "Տեղն ամրագրվող նստատեղ է (օր.՝ PC #1, PS5 VIP #2)։ Յուրաքանչյուր տեղին կապվում են խաղեր։" },
  "branchPlaces.new": { en: "+ New place", ru: "+ Новое место", am: "+ Նոր տեղ" },
  // Deleting a place takes the device that makes it billable and every session
  // recorded on that device. Two wordings, because a PC place owns a computer
  // the operator can see under "Computers" and a console place does not —
  // naming a section that will not change is how a warning stops being read.
  "branchPlaces.confirmDelete": {
    en: "Delete place #{0}?\n\nIts device and every session recorded on it will be deleted as well. This cannot be undone.",
    ru: "Удалить место №{0}?\n\nВместе с ним будут удалены его устройство и все записанные на нём сессии. Действие необратимо.",
    am: "Ջնջե՞լ #{0} տեղը։\n\nՆրա հետ կջնջվեն դրա սարքը և դրանում գրանցված բոլոր սեսիաները։ Գործողությունն անդարձելի է։",
  },
  "branchPlaces.confirmDeletePc": {
    en: "Delete place #{0}?\n\nIts computer will disappear from Computers, and every session recorded on it will be deleted as well. This cannot be undone.",
    ru: "Удалить место №{0}?\n\nСвязанный компьютер исчезнет из раздела «Компьютеры», а все записанные на нём сессии будут удалены. Действие необратимо.",
    am: "Ջնջե՞լ #{0} տեղը։\n\nԿապված համակարգիչը կվերանա «Համակարգիչներ» բաժնից, իսկ դրանում գրանցված բոլոր սեսիաները կջնջվեն։ Գործողությունն անդարձելի է։",
  },
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
  // A computer is not deleted on its own: it exists to serve one place, so the
  // place goes with it, and the place's sessions go with the place. The number
  // is in the text because "delete PC #4" and "delete place #4 too" are the
  // same action and the operator has to see the second half before confirming.
  "pcs.confirmDelete": {
    en: "Delete computer \u201c{0}\u201d?\n\nThe place it serves (#{1}) will be deleted with it, along with every session recorded on it. This cannot be undone.",
    ru: "Удалить компьютер «{0}»?\n\nВместе с ним будет удалено обслуживаемое место (№{1}) и все записанные на нём сессии. Действие необратимо.",
    am: "Ջնջե՞լ «{0}» համակարգիչը։\n\nՆրա հետ կջնջվի սպասարկվող տեղը (#{1}) և դրանում գրանցված բոլոր սեսիաները։ Գործողությունն անդարձելի է։",
  },
  // Same action for a device that serves no place — a legacy row from before
  // one-device-per-place. Nothing else goes with it, and saying so avoids
  // promising a cascade that will not happen.
  "pcs.confirmDeleteUnlinked": {
    en: "Delete computer \u201c{0}\u201d?\n\nEvery session recorded on it will be deleted as well. This cannot be undone.",
    ru: "Удалить компьютер «{0}»?\n\nВсе записанные на нём сессии будут удалены. Действие необратимо.",
    am: "Ջնջե՞լ «{0}» համակարգիչը։\n\nԴրանում գրանցված բոլոր սեսիաները կջնջվեն։ Գործողությունն անդարձելի է։",
  },
  "pcs.confirmRotate": { en: "Rotate pairing token for '{0}'? The agent on this PC will stop working until updated.", ru: "Сменить токен сопряжения для «{0}»? Агент на этом ПК перестанет работать, пока его не обновят.", am: "Թարմացնե՞լ «{0}»-ի զուգակցման թոքենը։ Այս PC-ի Agent-ը չի աշխատի, մինչև այն չթարմացնեք։" },
  "pcs.macRequired": { en: "Set a MAC address on this PC before using Wake-on-LAN.", ru: "Сначала задайте MAC-адрес для этого ПК. Без него Wake-on-LAN не сработает.", am: "Նախ նշեք PC-ի MAC հասցեն։ Առանց դրա Wake-on-LAN չի աշխատի։" },
  "pcs.packetsSent": { en: "Packets sent: {0}", ru: "Пакетов отправлено: {0}", am: "Ուղարկված փաթեթներ՝ {0}" },
  "pcs.errorsHeader": { en: "Errors:", ru: "Ошибки:", am: "Սխալներ՝" },
  "pcs.wolReminder": { en: "PC must have Wake-on-LAN enabled in BIOS and NIC settings, and be on the same LAN as this cashier.", ru: "На ПК должен быть включён Wake-on-LAN в BIOS и в настройках сетевой карты, и он должен быть в одной сети с кассой.", am: "PC-ի BIOS-ում և ցանցային քարտի կարգավորումներում պետք է միացված լինի Wake-on-LAN, և PC-ն պետք է լինի դրամարկղի հետ նույն ցանցում։" },
  "pcs.wakeFailed": { en: "Wake failed: {0}", ru: "Не удалось разбудить: {0}", am: "Արթնացման սխալ՝ {0}" },
  "pcs.howConnects": { en: "How a PC actually connects:", ru: "Как ПК подключается:", am: "Ինչպես PC-ն իրականում միանում է՝" },
  "pcs.connect.step1": { en: "Register the PC here. You get a pairing token.", ru: "Зарегистрируйте ПК. Получите токен сопряжения.", am: "Գրանցեք PC-ն այստեղ։ Կստանաք զուգակցման թոքեն։" },
  "pcs.connect.step2": { en: "Install the agent on the PC and enter the PC ID + token.", ru: "Установите агента на ПК и введите ID и токен.", am: "Տեղադրեք Agent-ը PC-ում և մուտքագրեք PC ID-ն ու թոքենը։" },
  "pcs.connect.step3": { en: "The MAC address is optional. Used only for Wake-on-LAN, not for authentication.", ru: "MAC-адрес опционален. Нужен только для Wake-on-LAN, не для авторизации.", am: "MAC-հասցեն պարտադիր չէ։ Պետք է միայն Wake-on-LAN-ի համար, ոչ թե նույնականացման։" },
  "pcs.lastSeen": { en: "last seen", ru: "последний раз", am: "վերջին անգամ" },
  "pcs.notPaired": { en: "not paired yet. Install agent", ru: "ещё не сопряжён. Установите агента", am: "դեռ զուգակցված չէ։ Տեղադրեք Agent-ը" },
  "pcs.sending": { en: "Sending…", ru: "Отправка…", am: "Ուղարկում…" },
  "pcs.wake": { en: "Wake", ru: "Разбудить", am: "Արթնացնել" },
  "pcs.getToken": { en: "Get token", ru: "Получить токен", am: "Ստանալ թոքեն" },
  "pcs.rotateToken": { en: "Rotate token", ru: "Сменить токен", am: "Թարմացնել թոքենը" },
  "pcs.statusInSession": { en: "In session", ru: "В сессии", am: "Սեսիայում" },
  "pcs.statusOnline": { en: "Online", ru: "В сети", am: "Առցանց" },
  "pcs.statusOffline": { en: "Offline", ru: "Не в сети", am: "Անցանց" },

  "action.failed": { en: "Failed", ru: "Сбой", am: "Ձախողվեց" },

  // Settings extras
  "settings.role": { en: "Role", ru: "Роль", am: "Դեր" },
  "settings.ratesNote": { en: "Stored prices are in AMD. We convert at fixed rates: 1 USD ≈ 400 AMD, 1 RUB ≈ 4.2 AMD. Sample: 1000 AMD =", ru: "Цены хранятся в драмах. Конвертация по фиксированному курсу: 1 USD ≈ 400 драм, 1 ₽ ≈ 4.2 драм. Пример: 1000 драм =", am: "Գները պահվում են դրամով։ Փոխարկում ֆիքսված կուրսով։ 1 USD ≈ 400 դրամ, 1 ₽ ≈ 4.2 դրամ։ Օրինակ՝ 1000 դրամ =" },
  "settings.currentPassword": { en: "Current password", ru: "Текущий пароль", am: "Ընթացիկ գաղտնաբառ" },
  "settings.newPassword": { en: "New password", ru: "Новый пароль", am: "Նոր գաղտնաբառ" },
  "settings.confirmPassword": { en: "Confirm new password", ru: "Подтвердите новый пароль", am: "Հաստատեք նոր գաղտնաբառը" },
  "settings.passwordChanged": { en: "Password changed", ru: "Пароль изменён", am: "Գաղտնաբառը փոխվեց" },
  "settings.passwordsMismatch": { en: "Passwords do not match", ru: "Пароли не совпадают", am: "Գաղտնաբառերը չեն համընկնում" },
  "settings.updatePassword": { en: "Update password", ru: "Обновить пароль", am: "Թարմացնել գաղտնաբառը" },
  "settings.subscribed": { en: "Subscribed", ru: "Подписка оформлена", am: "Բաժանորդագրվել եք" },
  "settings.subscribeHint": { en: "Subscribe an email to product updates.", ru: "Подпишите email на обновления продукта.", am: "Բաժանորդագրեք էլ. հասցեն ծրագրի թարմացումներին։" },

  // Common
  "common.back": { en: "Back", ru: "Назад", am: "Հետ" },
  "common.open": { en: "Open →", ru: "Открыть →", am: "Բացել →" },
  "common.checking": { en: "Checking…", ru: "Проверяем…", am: "Ստուգում…" },
  "label.code": { en: "Code", ru: "Код", am: "Կոդ" },
  "label.status": { en: "Status", ru: "Статус", am: "Կարգավիճակ" },
  "label.date": { en: "Date", ru: "Дата", am: "Ամսաթիվ" },
  "label.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "label.company": { en: "Company", ru: "Компания", am: "Ընկերություն" },

  // Branches list / map
  "branchesList.title": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "branchesList.placesShort": { en: "places", ru: "места", am: "տեղեր" },
  // The owner's create action in the list header (it was a sidebar entry).
  "branchesList.newBranch": { en: "+ New branch", ru: "+ Создать филиал", am: "+ Նոր մասնաճյուղ" },
  "branchesMap.title": { en: "Branches map", ru: "Карта филиалов", am: "Մասնաճյուղերի քարտեզ" },
  "branchesMap.geoCount": { en: "of {total} branches geo-located", ru: "из {total} филиалов с координатами", am: "/ {total} մասնաճյուղ ունի կոորդինատներ" },
  "branchesMap.noGeoTitle": { en: "No branches geo-located yet.", ru: "Координаты филиалов ещё не заданы.", am: "Մասնաճյուղերի կոորդինատներ դեռ չեն սահմանված։" },
  "branchesMap.noGeoHint": { en: "Open a branch → Edit → save with a pin on the map. The map will show all branches with non-zero coordinates.", ru: "Откройте филиал → Изменить → сохраните с меткой на карте. На карте появятся все филиалы с заданными координатами.", am: "Բացեք մասնաճյուղ → Խմբագրել → պահպանեք քարտեզի վրա կետով։ Քարտեզում կհայտնվեն կոորդինատներ ունեցող բոլոր մասնաճյուղերը։" },

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
  "tournaments.scopeHint": { en: "Open a branch and click \"Tournaments\" to create one. Tournaments belong to a specific branch.", ru: "Откройте филиал и нажмите «Турниры», чтобы создать. Турниры привязаны к конкретному филиалу.", am: "Բացեք մասնաճյուղ և սեղմեք «Մրցաշարեր»՝ ստեղծելու համար։ Մրցաշարը պատկանում է որոշակի մասնաճյուղի։" },
  "tournaments.new": { en: "+ New tournament", ru: "+ Новый турнир", am: "+ Նոր մրցաշար" },
  "tournaments.goToMyBranch": { en: "Go to my branch tournaments", ru: "Перейти к турнирам моего филиала", am: "Անցնել իմ մասնաճյուղի մրցաշարերին" },
  "tournaments.pickBranch": { en: "Choose a branch", ru: "Выберите филиал", am: "Ընտրեք մասնաճյուղ" },
  "tournaments.noBranch": { en: "No branch is assigned to your account.", ru: "К вашему аккаунту не привязан филиал.", am: "Ձեր հաշվին մասնաճյուղ կցված չէ։" },
  "tournaments.price": { en: "price", ru: "цена", am: "գին" },
  "tournaments.players": { en: "players", ru: "игроков", am: "խաղացողներ" },
  "tournaments.confirmDelete": { en: "Delete tournament", ru: "Удалить турнир", am: "Ջնջել մրցաշարը" },

  // Games
  "games.title": { en: "Games", ru: "Игры", am: "Խաղեր" },
  "games.new": { en: "+ New game", ru: "+ Новая игра", am: "+ Նոր խաղ" },
  "games.confirmDelete": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "branchGames.title": { en: "Branch games", ru: "Игры филиала", am: "Մասնաճյուղի խաղեր" },
  "branchGames.intro": { en: "Games attached to this branch", ru: "Игры, привязанные к этому филиалу", am: "Այս մասնաճյուղին կցված խաղեր" },

  // Recurring-services expense tracker (admin only)
  "expenses.title": { en: "Expenses", ru: "Расходы", am: "Ծախսեր" },
  "expenses.subtitle": { en: "Recurring services you pay for monthly (domain, Gmail Workspace, hosting…).", ru: "Регулярные сервисы, за которые ты платишь каждый месяц (домен, Gmail Workspace, хостинг…).", am: "Կրկնվող ծառայություններ, որոնց համար ամսական վճարում ես (դոմեն, Gmail Workspace, հոստինգ…)։" },
  "expenses.new": { en: "+ New expense", ru: "+ Новый расход", am: "+ Նոր ծախս" },
  "expenses.edit": { en: "Edit expense", ru: "Редактировать расход", am: "Խմբագրել ծախսը" },
  "expenses.name": { en: "Service name", ru: "Название сервиса", am: "Ծառայության անունը" },
  "expenses.namePlaceholder": { en: "e.g. Domain (porkbun)", ru: "напр. Домен (porkbun)", am: "օր. Դոմեն (porkbun)" },
  "expenses.amount": { en: "Amount", ru: "Сумма", am: "Գումար" },
  "expenses.currency": { en: "Currency", ru: "Валюта", am: "Արժույթ" },
  "expenses.purchasedAt": { en: "Purchase date", ru: "Дата покупки", am: "Գնման ամսաթիվ" },
  "expenses.isActive": { en: "Active (count in monthly total)", ru: "Активен (учитывать в месячном итоге)", am: "Ակտիվ (հաշվել ամսական գումարում)" },
  "expenses.invalidForm": { en: "Fill in a name, a non-negative amount and a purchase date.", ru: "Укажи название, неотрицательную сумму и дату покупки.", am: "Լրացրու անունը, ոչ բացասական գումարը և գնման ամսաթիվը։" },
  "expenses.monthlyTotal": { en: "Monthly total", ru: "Итого в месяц", am: "Ամսական ընդամենը" },
  "expenses.perMonth": { en: "per month", ru: "в месяц", am: "ամսական" },
  "expenses.upcomingTitle": { en: "Upcoming charges (within 3 days)", ru: "Ближайшие платежи (в течение 3 дней)", am: "Մոտալուտ վճարումներ (3 օրվա ընթացքում)" },
  "expenses.dueToday": { en: "due today", ru: "платёж сегодня", am: "վճարումն այսօր է" },
  "expenses.dueIn": { en: "in", ru: "через", am: "ևս" },
  "expenses.overdue": { en: "overdue by", ru: "просрочено на", am: "ուշացում՝" },
  "expenses.markPaid": { en: "Paid", ru: "Заплатил", am: "Նշել վճարված" },
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
  "revenue.pickCompany": { en: "pick a company", ru: "выберите компанию", am: "ընտրեք ընկերություն" },
  "revenue.pickHint": { en: "Pick a company to see its monthly revenue and commission.", ru: "Выберите компанию, чтобы увидеть её месячную выручку и комиссию.", am: "Ընտրեք ընկերություն՝ ամսական եկամուտ և միջնորդավճար տեսնելու համար։" },
  // The heading of the month's figures. It used to read "revenue from closed
  // sessions"; tournament entry fees are part of the takings now, so the
  // heading names the period rather than one of the sources.
  "revenue.summaryTitle": { en: "Revenue for the month", ru: "Выручка за месяц", am: "Ամսվա եկամուտը" },
  "revenue.closedSessions": { en: "Closed sessions", ru: "Закрытых сессий", am: "Փակված սեսիաներ" },
  "revenue.sourceSessions": { en: "Sessions", ru: "Сессии", am: "Սեսիաներ" },
  "revenue.sourcePos": { en: "POS orders", ru: "Заказы кассы", am: "Դրամարկղի վաճառք" },
  "revenue.tournamentEntries": { en: "Paid tournament entries", ru: "Оплаченных участий в турнирах", am: "Վճարված մասնակցություններ մրցաշարերում" },
  "revenue.sourceTournaments": { en: "Tournament entry fees", ru: "Взносы за участие в турнирах", am: "Մրցաշարերի մասնակցության վճարներ" },
  "revenue.totalRevenue": { en: "Total revenue", ru: "Общая выручка", am: "Ընդհանուր եկամուտ" },
  "revenue.cyberPlaceCommission": { en: "Cyber Place commission", ru: "Комиссия Cyber Place", am: "Cyber Place-ի միջնորդավճար" },
  "revenue.amountOwed": { en: "You owe us this period", ru: "К оплате за период", am: "Վճարման ենթակա գումար" },
  "revenue.ownerIncome": { en: "Owner income", ru: "Доход владельца", am: "Սեփականատիրոջ եկամուտ" },
  // Branch selector (shown only when the company has more than one branch).
  // "All branches" is the company card; a branch is the same card with that
  // branch's figures, and its title names the branch so a branch's figures
  // are never read as the company's.
  "revenue.branch": { en: "Branch", ru: "Филиал", am: "Մասնաճյուղ" },
  "revenue.allBranches": { en: "All branches", ru: "Все филиалы", am: "Բոլոր մասնաճյուղերը" },
  "revenue.branchSummaryTitle": { en: "Revenue for the month: {0}", ru: "Выручка за месяц: {0}", am: "Ամսվա եկամուտը՝ {0}" },
  "revenue.prevMonth": { en: "Previous month", ru: "Предыдущий месяц", am: "Նախորդ ամիս" },
  "revenue.nextMonth": { en: "Next month", ru: "Следующий месяц", am: "Հաջորդ ամիս" },
  "revenue.loadFailed": { en: "Couldn't load the revenue report.", ru: "Не удалось загрузить отчёт о выручке.", am: "Չհաջողվեց բեռնել եկամտի հաշվետվությունը։" },
  "revenue.retry": { en: "Retry", ru: "Повторить", am: "Կրկնել" },

  // Managers
  "managers.title": { en: "Managers", ru: "Менеджеры", am: "Մենեջերներ" },
  "managers.new": { en: "+ New manager", ru: "+ Новый менеджер", am: "+ Նոր մենեջեր" },
  "managers.branchLabel": { en: "branch", ru: "филиал", am: "մասնաճյուղ" },
  "managers.confirmRemove": { en: "Remove manager", ru: "Удалить менеджера", am: "Հեռացնել մենեջերին" },
  // Creating a manager from the sidebar screen, where no branch is implied by
  // the URL. One branch → no question is asked; several → the owner picks.
  "managers.pickBranch": { en: "Which branch?", ru: "Для какого филиала?", am: "Ո՞ր մասնաճյուղի համար" },
  "managers.pickBranchHint": {
    en: "The manager will be bound to the branch you choose and will only see that one.",
    ru: "Менеджер будет привязан к выбранному филиалу и увидит только его.",
    am: "Մենեջերը կկապվի ընտրված մասնաճյուղին և կտեսնի միայն այն։",
  },
  "managers.noBranches": {
    en: "You have no branches yet. Create one first, then add a manager to it.",
    ru: "У вас пока нет филиалов. Сначала создайте филиал, затем добавьте в него менеджера.",
    am: "Դուք դեռ մասնաճյուղ չունեք։ Նախ ստեղծեք մասնաճյուղ, ապա ավելացրեք մենեջեր։",
  },
  "action.remove": { en: "Remove", ru: "Удалить", am: "Հեռացնել" },

  // Notifications
  "notifications.title": { en: "Notifications", ru: "Уведомления", am: "Ծանուցումներ" },
  "notifications.companyOverdue": { en: "is overdue on payment", ru: "просрочила оплату", am: "ուշացրել է վճարումը" },
  "notifications.companyMustPayIn": { en: "must pay in", ru: "должна оплатить через", am: "պետք է վճարի, մնացել է" },
  "notifications.dayShort": { en: "day", ru: "день", am: "օր" },
  "notifications.daysShort": { en: "days", ru: "дн.", am: "օր" },
  "notifications.youOverdue": { en: "You are overdue on your Cyber Place payment", ru: "Вы просрочили оплату Cyber Place", am: "Դուք ուշացրել եք Cyber Place-ի վճարումը" },
  "notifications.youMustPayIn": { en: "you must pay Cyber Place. {pct}% commission", ru: "вам нужно оплатить Cyber Place. Комиссия {pct}%", am: "պետք է վճարեք Cyber Place-ին։ Միջնորդավճար՝ {pct}%" },
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
    am: "🎉 Նոր ամրագրում ունեք։",
  },
  "notifications.bookingCreatedPushBody": {
    en: "Player {name} booked place {places} at {company} {address}",
    ru: "Игрок {name} забронировал место {places} в {company} {address}",
    am: "Խաղացող {name}-ը ամրագրեց տեղ №{places}՝ {company}, {address}",
  },
  "notifications.bookingExtendedPushTitle": {
    en: "⏰ Booking extended",
    ru: "⏰ Время бронирования продлено",
    am: "⏰ Ամրագրումը երկարացվել է",
  },
  "notifications.bookingExtendedPushBody": {
    en: "Player {name} extended time by {minutes} {minShort} at {company} {address}",
    ru: "Игрок {name} продлил время на {minutes} {minShort} в {company} {address}",
    am: "Խաղացող {name}-ը երկարացրեց ժամանակը +{minutes} {minShort}՝ {company}, {address}",
  },
  "notifications.bookingCancelledPushTitle": {
    en: "😢 Booking cancelled",
    ru: "😢 Бронирование отменено",
    am: "😢 Ամրագրումը չեղարկվել է",
  },
  "notifications.bookingCancelledPushBody": {
    en: "Sadly, player {name} cancelled place {places} at {company} {address}",
    ru: "К сожалению, игрок {name} отменил место {places} в {company} {address}",
    am: "Ցավոք, խաղացող {name}-ը չեղարկեց տեղ №{places}՝ {company}, {address}",
  },
  "notifications.guestFallback": { en: "Guest", ru: "Гость", am: "Հյուր" },
  "notifications.bookingPlaces": { en: "Place", ru: "Место", am: "Տեղ" },
  "notifications.bookingPlacesPlural": { en: "Places", ru: "Места", am: "Տեղեր" },
  "notifications.bookingMinShort": { en: "min", ru: "мин", am: "րոպե" },
  "notifications.openBoard": { en: "Open Active Places", ru: "К активным местам", am: "Բացել ակտիվ տեղերը" },
  "notifications.markAllRead": { en: "Mark all as read", ru: "Отметить все прочитанными", am: "Նշել բոլորը որպես կարդացված" },
  "notifications.unreadDot": { en: "Unread", ru: "Не прочитано", am: "Չկարդացված" },
  "notifications.bookingFeedTitle": { en: "Bookings", ru: "Бронирования", am: "Ամրագրումներ" },
  "notifications.billingFeedTitle": { en: "Billing", ru: "Биллинг", am: "Հաշվարկ" },
  "notifications.openBooking": { en: "Open", ru: "Открыть", am: "Բացել" },
  "notifications.bookingForDate": { en: "for", ru: "на", am: "-" },
  "notifications.deleteOne": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "notifications.clearAll": { en: "Clear all", ru: "Очистить все", am: "Մաքրել բոլորը" },
  "notifications.confirmClearAll": { en: "Delete all notifications? This cannot be undone.", ru: "Удалить все уведомления? Это действие нельзя отменить.", am: "Ջնջե՞լ բոլոր ծանուցումները։ Սա հնարավոր չէ հետարկել։" },

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
  "label.participantsLimit": { en: "Participants limit", ru: "Лимит участников", am: "Մասնակիցների առավելագույն քանակ" },
  "label.game": { en: "Game", ru: "Игра", am: "Խաղ" },
  "label.pick": { en: "pick", ru: "выберите", am: "ընտրեք" },
  "form.errors.failedSave": { en: "Failed to save", ru: "Не удалось сохранить", am: "Չհաջողվեց պահպանել" },
  "form.errors.failed": { en: "Failed", ru: "Ошибка", am: "Սխալ" },

  // Game form
  "game.titleNew": { en: "New game", ru: "Новая игра", am: "Նոր խաղ" },
  "game.titleEdit": { en: "Edit game", ru: "Редактировать игру", am: "Խմբագրել խաղը" },
  "game.platformLocked": { en: "Platform cannot be changed after creation.", ru: "Платформу нельзя изменить после создания.", am: "Ստեղծելուց հետո հարթակը հնարավոր չէ փոխել։" },

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
  "product.titleNewAdditional": { en: "New additional item", ru: "Новый дополнительный предмет", am: "Նոր լրացուցիչ իր" },
  "product.titleEditAdditional": { en: "Edit additional item", ru: "Редактировать дополнительный предмет", am: "Խմբագրել լրացուցիչ իրը" },
  "product.titleEdit": { en: "Edit product", ru: "Редактировать товар", am: "Խմբագրել ապրանքը" },
  "product.errors.price": { en: "Price must be a non-negative number", ru: "Цена должна быть неотрицательной", am: "Գինը չպետք է լինի բացասական" },

  // Manager form
  "manager.titleNew": { en: "New manager", ru: "Новый менеджер", am: "Նոր մենեջեր" },
  "manager.titleEdit": { en: "Edit manager", ru: "Редактировать менеджера", am: "Խմբագրել մենեջերին" },
  "manager.errors.companyMissing": { en: "Company not resolved yet. Try again", ru: "Компания ещё не определена. Попробуйте ещё раз", am: "Ընկերությունը դեռ չի որոշվել։ Փորձեք կրկին։" },

  // Member form
  "member.titleNew": { en: "New member", ru: "Новый клиент", am: "Նոր հաճախորդ" },
  "member.titleEdit": { en: "Edit member", ru: "Редактировать клиента", am: "Խմբագրել հաճախորդին" },

  // Topup
  "topup.title": { en: "Top up", ru: "Пополнить", am: "Համալրել" },
  "topup.balance": { en: "Current balance", ru: "Текущий баланс", am: "Ընթացիկ մնացորդ" },
  "topup.processing": { en: "Processing…", ru: "Обработка…", am: "Մշակում…" },
  "topup.errors.amount": { en: "Amount must be > 0", ru: "Сумма должна быть больше 0", am: "Գումարը պետք է լինի 0-ից մեծ" },

  // Place form
  "place.titleNew": { en: "New place", ru: "Новое место", am: "Նոր տեղ" },
  "place.titleEdit": { en: "Edit place", ru: "Редактировать место", am: "Խմբագրել տեղը" },
  "place.name": { en: "Place name (optional)", ru: "Название места (необязательно)", am: "Տեղի անվանումը (ընտրովի)" },
  "place.namePlaceholder": { en: "e.g. Corner PS5, Poker table", ru: "напр. Угловая PS5, Стол для покера", am: "օր. Անկյունային PS5, Պոկերի սեղան" },
  "place.hourlyRate": { en: "Price per hour", ru: "Цена за час", am: "Մեկ ժամի գինը" },
  "place.customPlatformNote": { en: "Custom platform. Set its own price per hour (no branch tariff matrix).", ru: "Кастомная платформа. Задайте свою цену за час (без тарифной матрицы филиала).", am: "Հատուկ հարթակ։ Սահմանեք սեփական ժամային գինը (առանց մասնաճյուղի սակագների)։" },
  "platform.other": { en: "Other", ru: "Другое", am: "Այլ" },
  "platform.customPlaceholder": { en: "e.g. table-tennis, poker, vr", ru: "напр. table-tennis, poker, vr", am: "օր. table-tennis, poker, vr" },
  "place.gamesAvailable": { en: "Games available on this place", ru: "Доступные игры на этом месте", am: "Հասանելի խաղեր այս տեղում" },
  "place.noGamesPlatform": { en: "No games for", ru: "Нет игр для", am: "Խաղեր չկան՝" },
  "place.selected": { en: "selected", ru: "выбрано", am: "ընտրված" },
  "place.hasGames": { en: "Does this platform have games?", ru: "У этой платформы есть игры?", am: "Այս հարթակն ունի՞ խաղեր" },
  "place.hasGamesHint": { en: "Turn on to attach games; leave off for a games-free platform (e.g. table tennis).", ru: "Включите, чтобы прикрепить игры; оставьте выключенным для платформы без игр (напр. настольный теннис).", am: "Միացրեք՝ խաղեր կցելու համար։ Թողեք անջատված, եթե հարթակը խաղեր չունի (օր.՝ սեղանի թենիս)։" },
  "place.createGame": { en: "+ Create game", ru: "+ Создать игру", am: "+ Ստեղծել խաղ" },
  "place.errors.number": { en: "Number must be a positive integer", ru: "Номер должен быть положительным целым числом", am: "Համարը պետք է լինի դրական ամբողջ թիվ" },
  "place.errors.joystickPriceRequired": {
    en: "Name the price this place charges for an extra joystick, or set it to follow the branch.",
    ru: "Укажите цену, которую это место берёт за дополнительный джойстик, или выберите «Как в филиале».",
    am: "Նշեք այս տեղի լրացուցիչ ջոյսթիքի գինը կամ ընտրեք «Ինչպես մասնաճյուղում»։",
  },
  "place.errors.priceRequired": { en: "Set a price for this new platform", ru: "Задайте цену для новой платформы", am: "Սահմանեք գին այս նոր հարթակի համար" },
  "place.errors.nameRequired": { en: "Enter the platform name (English is required)", ru: "Введите наименование платформы (английское обязательно)", am: "Մուտքագրեք հարթակի անվանումը (անգլերենը պարտադիր է)" },
  "place.priceName": { en: "Platform name (наименование)", ru: "Наименование платформы", am: "Հարթակի անվանումը" },
  "place.priceLockedNote": { en: "This platform already has a branch price. It will be applied to this place.", ru: "Для этой платформы уже задана цена филиала. Она будет применена к этому месту.", am: "Այս հարթակի համար արդեն սահմանված է մասնաճյուղի գին։ Այն կկիրառվի այս տեղի համար։" },
  "place.tierUnpricedNote": { en: "This tier of the platform isn't priced yet. Set its rate once here.", ru: "Для этого тарифа платформы цена ещё не задана. Задайте её здесь один раз.", am: "Հարթակի այս սակագնի գինը դեռ սահմանված չէ։ Սահմանեք այն այստեղ՝ մեկ անգամ։" },
  "place.joystickPrice": { en: "Price per extra joystick", ru: "Цена дополнительного джойстика", am: "Լրացուցիչ ջոյսթիքի գին" },
  // This seat's own price per hour. Its own three keys rather than reusing
  // `place.hourlyRate`, which labels the box that prices a PLATFORM or a
  // sub-category: the two mean different things to an operator and only one of
  // them is ever on screen at a time.
  // The branch's tariff matrix, shown on a place as the price it inherits.
  "place.branchDefaultRate": { en: "Branch price", ru: "Цена филиала", am: "Մասնաճյուղի գինը" },
  "place.branchDefaultNote": {
    en: "This place bills at the branch price for its platform and tier. Set a price below to depart from it.",
    ru: "Место считается по цене филиала для его платформы и тарифа. Задайте цену ниже, чтобы отличаться от неё.",
    am: "Այս տեղի համար գործում է մասնաճյուղի գինը՝ ըստ հարթակի և սակագնի։ Այլ գին կիրառելու համար սահմանեք այն ստորև։",
  },
  // A price of zero is stored, shown, and never charged — the seat falls back
  // to the branch figure. The server refuses it; this is the same sentence.
  "place.zeroNotAPriceHint": {
    en: "A price of zero is not billed. Leave the box empty to use the branch price, or start a Free session to give the seat away.",
    ru: "Цена «0» не тарифицируется. Оставьте поле пустым, чтобы считать по цене филиала, или запустите бесплатную сессию, чтобы отдать место даром.",
    am: "0 գինը չի կիրառվում։ Թողեք դաշտը դատարկ՝ մասնաճյուղի գինը կիրառելու համար, կամ սկսեք անվճար սեսիա՝ տեղն անվճար տրամադրելու համար։",
  },
  "place.noBranchRateHint": {
    en: "The branch has no price for this platform and tier, so this place needs its own. Otherwise no session can be started on it.",
    ru: "У филиала нет цены для этой платформы и тарифа, поэтому месту нужна своя. Иначе сессию на нём не запустить.",
    am: "Մասնաճյուղն այս հարթակի և սակագնի համար գին չունի, ուստի այս տեղին պետք է սեփական գին։ Այլապես դրա վրա սեսիա հնարավոր չէ սկսել։",
  },
  "place.ownRate": { en: "Price for this place", ru: "Цена этого места", am: "Այս տեղի գինը" },
  "place.ownRateInherit": { en: "As set for the platform", ru: "Как у платформы", am: "Ինչպես հարթակի համար" },
  "place.ownRateNote": {
    en: "Left empty, this place bills at the price shown above. A value here applies to this place only.",
    ru: "Если поле пустое, место считается по цене выше. Значение здесь действует только для этого места.",
    am: "Եթե դաշտը դատարկ է, տեղը հաշվարկվում է վերևի գնով։ Այստեղի արժեքը գործում է միայն այս տեղի համար։",
  },
  "place.joystickStrategy": {
    en: "Extra joystick pricing",
    ru: "Тариф доп. джойстика",
    am: "Լրացուցիչ ջոյսթիքի սակագին",
  },
  "place.joystickChargeMode": {
    en: "When the fee is charged",
    ru: "Когда взимается плата",
    am: "Ե՞րբ է գանձվում վճարը",
  },
  // The two answers, spelled as what they DO. The screen used to print the
  // slot numbers "3" and "3/4" and left an operator to translate them into
  // money — which is exactly the translation they got wrong.
  "joystickPrice.chargeMode.each": {
    en: "Charged for every joystick handed out",
    ru: "Плата добавляется при каждом добавлении джойстика",
    am: "Վճարը գանձվում է յուրաքանչյուր տրված ջոյսթիքի համար",
  },
  "joystickPrice.chargeMode.once": {
    en: "One charge per session, however many are handed out",
    ru: "Единоразовая плата за доп. джойстики (1 раз за сессию)",
    am: "Մեկ վճար ամբողջ սեսիայի համար՝ անկախ ջոյսթիքների քանակից",
  },
  "place.joystickInherit": { en: "As in the branch", ru: "Как в филиале", am: "Ինչպես մասնաճյուղում" },
  // ⚠️ Says "the branch's rule" and names no SCREEN on purpose: the venue-wide
  // joystick section is gone, and its columns are only a fallback now. Sending
  // an operator to a page that no longer has the setting is worse than saying
  // nothing about where it lives.
  // WHICH extra pads a room charges for. The controllers by number, because
  // that is how a cashier hands them over; the seat's own two come with the
  // console and are never on this list.
  // The venue's own joystick fee, on Branch · Prices. The figure every room
  // inherits until it prices its own pads.
  "branchJoystick.sectionTitle": { en: "Joysticks", ru: "Джойстики", am: "Ջոյսթիքներ" },
  "branchJoystick.hint": {
    en: "What one extra joystick costs at this branch. Every place uses this until it sets a price of its own.",
    ru: "Сколько стоит один дополнительный джойстик в этом филиале. Все места считают по нему, пока не зададут свою цену.",
    am: "Որքան արժե մեկ լրացուցիչ ջոյսթիք այս մասնաճյուղում։ Բոլոր տեղերն օգտագործում են այս գինը, քանի դեռ չեն սահմանել իրենցը։",
  },
  // The toast after a save. It used to reach for `joystickPrice.saved`, which
  // went with the screen that owned it — so the bar showed the KEY itself.
  "branchJoystick.saved": {
    en: "Joystick price saved",
    ru: "Цена джойстика сохранена",
    am: "Ջոյսթիքի գինը պահպանված է",
  },
  "branchJoystick.unset": { en: "Not set", ru: "Не задано", am: "Սահմանված չէ" },
  "branchJoystick.priceRequired": {
    en: "Name the price for the joysticks you charge for.",
    ru: "Укажите цену джойстиков, за которые берёте плату.",
    am: "Նշեք ջոյսթիքների գինը, որոնց համար վճար եք վերցնում։",
  },
  "place.joystickFourthPrice": {
    en: "Price of the 4th joystick",
    ru: "Цена 4-го джойстика",
    am: "4-րդ ջոյսթիքի գին",
  },
  // The room's joystick section, as the form asks it since 2026-09-18: what
  // the room follows, then how it sells its own pads.
  // ── the room's own extra: chips, a cue, darts ──────────────────────────
  // Static labels only. The THING is named by the operator and travels as
  // data, so nothing here spells "chips": `{0}` is where their word lands.
  "place.extraItem": { en: "Extra item", ru: "Дополнительный предмет", am: "Լրացուցիչ իր" },
  "place.extraItemHint": {
    en: "What this place hands out besides the seat: chips, a cue, darts. Leave empty if there is nothing.",
    ru: "Что это место выдаёт помимо самого места: фишки, кий, дротики. Оставьте пустым, если ничего нет.",
    am: "Ինչ է տրամադրում այս տեղը բացի տեղից՝ ֆիշկաներ, կիյ, նետիկներ։ Թողեք դատարկ, եթե ոչինչ չկա։",
  },
  "place.extraItemName": { en: "Name", ru: "Название", am: "Անվանում" },
  "place.extraItemNamePlaceholder": { en: "Chips, cue, darts…", ru: "Фишки, кий, дротики…", am: "Ֆիշկաներ, կիյ, նետիկներ…" },
  "place.extraItemPrice": { en: "Price per item", ru: "Цена за штуку", am: "Գինը մեկ հատի համար" },
  "place.extraItemPayment": { en: "How it is charged", ru: "Как берётся плата", am: "Ինչպես է գանձվում վճարը" },
  "place.extraItemEach": {
    en: "Charged every time ({0} × count)",
    ru: "Плата за каждую единицу ({0} × количество)",
    am: "Վճար յուրաքանչյուր միավորի համար ({0} × քանակ)",
  },
  "place.extraItemOnce": {
    en: "One charge for the session ({0}), whatever the count",
    ru: "Единоразовая плата за {0} (1 раз за сессию)",
    am: "Մեկանգամյա վճար ({0})՝ սեսիայի համար, անկախ քանակից",
  },
  "place.extraItemStrategy": { en: "Tariff for {0}", ru: "Тариф: {0}", am: "Սակագին՝ {0}" },
  "place.extraItemStrategyFixed": {
    en: "FIXED PRICE (DEFAULT)",
    ru: "ФИКСИРОВАННАЯ ЦЕНА (ПО УМОЛЧАНИЮ)",
    am: "ՖԻՔՍՎԱԾ ԳԻՆ (ԿԱՆԽԱԴՐՎԱԾ)",
  },
  "place.extraItemIncluded": {
    en: "Included in the rate",
    ru: "Входит в тариф",
    am: "Ներառված է սակագնում",
  },
  "place.extraItemIncludedNote": {
    en: "How many {0} the rate already covers. The first ones on a session are free, everything past that is charged. Empty means every one is charged.",
    ru: "Сколько {0} уже входит в тариф. Первые за сессию бесплатны, всё сверх этого оплачивается. Пусто: оплачивается каждая единица.",
    am: "Քանի {0} արդեն ներառված է սակագնում։ Սեսիայի առաջինները անվճար են, դրանից ավելին վճարովի է։ Դատարկ՝ վճարվում է յուրաքանչյուրը։",
  },
  "place.extraItemMax": { en: "How many exist", ru: "\u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0432\u0441\u0435\u0433\u043e", am: "Ընդհանուր քանակ" },
  "place.extraItemMaxNote": {
    en: "How many of {0} this room owns. Beyond it a hand-out is refused rather than charged. Empty is no limit.",
    ru: "Сколько единиц «{0}» есть в этой комнате. Сверх этого выдача отклоняется, а не оплачивается. Если поле пустое, ограничения нет.",
    am: "Քանի «{0}» կա այս սենյակում։ Դրանից ավելի տրամադրելը մերժվում է, ոչ թե վճարվում։ Դատարկ՝ առանց սահմանափակման։",
  },
  "place.extraItemChargedUnits": { en: "Which are charged", ru: "\u041a\u0430\u043a\u0438\u0435 \u043f\u043b\u0430\u0442\u043d\u044b\u0435", am: "\u0548\u0580\u0578\u0576\u0584 \u0565\u0576 \u057e\u0573\u0561\u0580\u0578\u057e\u056b" },
  "place.extraItemChargedUnitsNote": {
    en: "Unit numbers, comma separated: “3,4” charges the third and fourth {0} and hands over every other one free. Empty lets the allowance above decide.",
    ru: "Номера единиц через запятую. При «3,4» третий и четвёртый «{0}» платные, остальные выдаются даром. Если поле пустое, решает число выше.",
    am: "Միավորների համարները՝ ստորակետով։ «3,4»՝ վճարովի են երրորդ և չորրորդ «{0}»-ը, մնացածը տրվում են անվճար։ Դատարկ՝ որոշում է վերևի թիվը։",
  },
  "place.extraItemModeFixed": { en: "Fixed price", ru: "\u0424\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0446\u0435\u043d\u0430", am: "\u0556\u056b\u0584\u057d\u057e\u0561\u056e \u0563\u056b\u0576" },
  "place.extraItemModeHourly": { en: "Per hour", ru: "\u0417\u0430 \u0447\u0430\u0441", am: "Ժամային" },
  "place.extraItemPriceNext": { en: "Each one after", ru: "\u041a\u0430\u0436\u0434\u044b\u0439 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439", am: "Յուրաքանչյուր հաջորդը" },
  "branchExtraItem.sectionTitle": { en: "The room's own extra", ru: "\u0414\u043e\u043f. \u043f\u0440\u0435\u0434\u043c\u0435\u0442 \u043a\u043e\u043c\u043d\u0430\u0442\u044b", am: "Սենյակի լրացուցիչ իրը" },
  "branchExtraItem.name": { en: "What the venue hands out", ru: "\u0427\u0442\u043e \u0432\u044b\u0434\u0430\u0451\u0442 \u0437\u0430\u0432\u0435\u0434\u0435\u043d\u0438\u0435", am: "Ինչ է տրամադրում ակումբը" },
  "branchExtraItem.pricingMode": { en: "Tariff", ru: "\u0422\u0430\u0440\u0438\u0444", am: "\u054d\u0561\u056f\u0561\u0563\u056b\u0576" },
  "branchExtraItem.chargeMode": { en: "Charged", ru: "\u041e\u043f\u043b\u0430\u0442\u0430", am: "\u054e\u0573\u0561\u0580\u0578\u0582\u0574" },
  "branchExtraItem.saved": { en: "Saved", ru: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e", am: "Պահպանվեց" },
  "branchExtraItem.priceRequired": {
    en: "Name it and price it, or leave both empty.",
    ru: "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0438 \u0446\u0435\u043d\u0443 \u0438\u043b\u0438 \u043e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043e\u0431\u0430 \u043f\u043e\u043b\u044f \u043f\u0443\u0441\u0442\u044b\u043c\u0438.",
    am: "Նշեք անվանումը և գինը կամ թողեք երկուսն էլ դատարկ։",
  },
  "branchExtraItem.hint": {
    en: "The venue's answer for the rooms that have not given one. A room with its own settings ignores this. Empty means every room decides for itself.",
    ru: "Ответ заведения для комнат, которые не ответили сами. Комната со своими настройками это игнорирует. Если поле пустое, каждая комната решает сама.",
    am: "Ակումբի կարգավորումը այն սենյակների համար, որոնք սեփականը չունեն։ Սեփական կարգավորումներով սենյակն այն անտեսում է։ Դատարկ՝ յուրաքանչյուր սենյակ ինքն է որոշում։",
  },
  "place.extraItemTariffChange": { en: "Tariff change", ru: "Изменение тарифа", am: "Սակագնի փոփոխություն" },
  "place.extraItemFixedNote": {
    en: "The price is charged as entered, per {0}.",
    ru: "Цена берётся как указано, за одну единицу: {0}.",
    am: "Գինը գանձվում է նշված չափով՝ յուրաքանչյուր միավորի համար ({0})։",
  },
  "place.extraItemHourlyNote": {
    en: "The price becomes an hourly rate: it is charged for every hour {0} stays with the player.",
    ru: "Цена становится почасовой: она начисляется за каждый час, пока {0} у игрока.",
    am: "Գինը դառնում է ժամային՝ այն հաշվարկվում է ամեն ժամի համար, քանի դեռ {0} խաղացողի մոտ է։",
  },
  "place.errors.extraPriceRequired": {
    en: "Give the extra item a price, or clear its name.",
    ru: "Укажите цену дополнительного предмета или очистите его название.",
    am: "Նշեք լրացուցիչ իրի գինը կամ մաքրեք դրա անվանումը։",
  },
  "place.joysticks": { en: "Joysticks", ru: "Джойстики", am: "Ջոյսթիքներ" },
  "place.joystickPayment": {
    en: "How extra joysticks are paid for",
    ru: "Способ оплаты дополнительных джойстиков",
    am: "Լրացուցիչ ջոյսթիքների վճարման եղանակը",
  },
  "place.joystickThirdPrice": {
    en: "Price of the 3rd joystick",
    ru: "Цена 3-го джойстика",
    am: "3-րդ ջոյսթիքի գին",
  },
  "place.joystickThirdPlaceholder": {
    en: "Enter the price of the 3rd joystick",
    ru: "Введите цену для 3-го джойстика",
    am: "Մուտքագրեք 3-րդ ջոյսթիքի գինը",
  },
  // Says what happens when it is left empty, because that IS the setting: the
  // server prices the fourth pad like the third for a null here.
  "place.joystickFourthPlaceholder": {
    en: "Same price as the 3rd joystick",
    ru: "Такая же цена, как у 3-го джойстика",
    am: "Նույն գինը, ինչ 3-րդ ջոյսթիքինը",
  },
  "place.joystickPairPrice": {
    en: "Price of the 3rd/4th joysticks",
    ru: "Цена 3/4 джойстиков",
    am: "3/4 ջոյսթիքների գին",
  },
  "place.joystickPairPlaceholder": {
    en: "Enter the price of the 3rd/4th joysticks",
    ru: "Введите цену для 3/4 джойстиков",
    am: "Մուտքագրեք 3/4 ջոյսթիքների գինը",
  },
  // The section title, deliberately NOT the same string as the option inside
  // it: a heading that repeats one of its own answers reads as that answer.
  "place.joystickTariffChange": {
    en: "Hourly rate change",
    ru: "Изменение тарифа",
    am: "Սակագնի փոփոխություն",
  },
  "place.joystickStrategyFixed": {
    en: "Fixed price (default)",
    ru: "Фиксированная цена (по умолчанию)",
    am: "Ֆիքսված գին (կանխադրված)",
  },
  // Shown only to a room carrying a shape this form no longer draws, so the
  // operator knows why its pads are billed the way they are.
  "place.joystickLegacySlotsNote": {
    en: "This place charges for one of the pads only, as set earlier. Choosing a payment method above replaces that.",
    ru: "Место берёт плату только за один из джойстиков: так было задано раньше. Выбор способа оплаты выше заменит эту настройку.",
    am: "Տեղը վճար է վերցնում միայն մեկ ջոյսթիքի համար՝ ինչպես նախկինում էր սահմանված։ Վերևում վճարման եղանակ ընտրելը կփոխարինի այդ կարգավորումը։",
  },
  "place.joystickScope": { en: "Charged joysticks", ru: "Платные джойстики", am: "Վճարովի ջոյսթիքներ" },
  "place.joystickScope.3": { en: "3rd only", ru: "Только 3-й", am: "Միայն 3-րդը" },
  "place.joystickScope.4": { en: "4th only", ru: "Только 4-й", am: "Միայն 4-րդը" },
  "place.joystickScope.3,4": { en: "3rd and 4th", ru: "3-й и 4-й", am: "3-րդը և 4-րդը" },
  "place.joystickBranchNote": {
    en: "This place charges what the branch charges. Change it in Branch, Prices.",
    ru: "Место берёт плату как филиал. Изменить можно в разделе «Филиал, Цены».",
    am: "Տեղը գանձում է այնպես, ինչպես մասնաճյուղը։ Փոփոխեք «Մասնաճյուղ, Գներ» բաժնում։",
  },
  "place.joystickOwnNote": {
    en: "The joysticks named above are charged at this price on this place. The rest are handed out free.",
    ru: "Джойстики, выбранные выше, стоят на этом месте эту цену. Остальные выдаются бесплатно.",
    am: "Վերևում նշված ջոյսթիքներն այս տեղում արժեն այս գինը։ Մնացածը տրվում են անվճար։",
  },
  // Multilingual platform-name widget (place form, custom platform).
  "platformName.placeholder": { en: "Name", ru: "Наименование", am: "Անվանում" },
  "platformName.enIdHint": { en: "used as the id", ru: "используется как идентификатор", am: "օգտագործվում է որպես ID" },
  "platformName.suggestions": { en: "Existing platforms", ru: "Существующие платформы", am: "Առկա հարթակներ" },
  // Custom-platform prices — read + edit block on the Branch prices page.
  "platformPrice.sectionTitle": { en: "Custom platform prices", ru: "Цены кастомных платформ", am: "Հատուկ հարթակների գներ" },
  "platformPrice.perHour": { en: "per hour", ru: "за час", am: "ժամը" },
  "platformPrice.managedInPlaces": { en: "Added automatically when you create a place on the platform (in Places). Click a name to rename it; edit the rates here.", ru: "Добавляются автоматически при создании места на платформе (в разделе Места). Нажмите на название, чтобы переименовать; цены изменяются здесь.", am: "Ավելացվում են ավտոմատ՝ հարթակում տեղ ստեղծելիս («Տեղեր» բաժնում)։ Սեղմեք անվան վրա՝ վերանվանելու համար։ Գները փոխվում են այստեղ։" },
  "platformPrice.titleEdit": { en: "Edit platform price", ru: "Редактировать цену платформы", am: "Խմբագրել հարթակի գինը" },
  "platformPrice.renameTitle": { en: "Rename platform", ru: "Изменить наименование платформы", am: "Վերանվանել հարթակը" },
  "platformPrice.renameHint": { en: "Click to rename", ru: "Нажмите, чтобы изменить наименование", am: "Սեղմեք վերանվանելու համար" },

  // Subplatforms — named, separately-priced sub-categories of a platform
  // ("PS5 + VR" under PS5). The second row of tabs in the place form, and
  // their own editable section in Branch Prices.
  "subplatform.label": { en: "Subcategory", ru: "Подкатегория", am: "Ենթակատեգորիա" },
  "subplatform.other": { en: "Other", ru: "Другое", am: "Այլ" },
  "subplatform.name": { en: "Name", ru: "Название", am: "Անվանում" },
  "subplatform.add": { en: "Add", ru: "Добавить", am: "Ավելացնել" },
  "subplatform.price": { en: "Price per hour", ru: "Цена за час", am: "Մեկ ժամի գինը" },
  "subplatform.priceRequiredHint": {
    en: "Required. This is what every place in this subcategory will be charged.",
    ru: "Обязательно. По этой цене будут считаться все места этой подкатегории.",
    am: "Պարտադիր է։ Այս գնով կհաշվարկվեն այս ենթակատեգորիայի բոլոր տեղերը։",
  },
  "subplatform.tierUnpricedNote": {
    en: "This subcategory has no rate for this type yet. Set it here.",
    ru: "У этой подкатегории ещё нет цены для этого типа. Задайте её здесь.",
    am: "Այս ենթակատեգորիան դեռ չունի գին այս տեսակի համար։ Սահմանեք այն այստեղ։",
  },
  "subplatform.errors.priceRequired": {
    en: "Enter a price for this subcategory.",
    ru: "Введите цену подкатегории.",
    am: "Մուտքագրեք ենթակատեգորիայի գինը։",
  },
  "subplatform.priceAppliedNote": {
    en: "This subcategory's rate applies. Change it in Branch prices.",
    ru: "Применяется цена этой подкатегории. Изменить её можно в «Ценах филиала».",
    am: "Կիրառվում է այս ենթակատեգորիայի գինը։ Փոխեք այն «Մասնաճյուղի գներ» բաժնում։",
  },
  "subplatform.inherits": { en: "as the platform", ru: "как у платформы", am: "ինչպես հարթակինը" },
  "subplatform.errors.nameRequired": {
    en: "Enter a name for the subcategory.",
    ru: "Введите название подкатегории.",
    am: "Մուտքագրեք ենթակատեգորիայի անվանումը։",
  },
  "subplatform.sectionTitle": { en: "Subcategory prices", ru: "Цены подкатегорий", am: "Ենթակատեգորիաների գներ" },
  "subplatform.renameTitle": { en: "Rename subcategory", ru: "Изменить название подкатегории", am: "Վերանվանել ենթակատեգորիան" },
  "subplatform.managedHint": {
    en: "Created in Places, on the second row of tabs. Rename them and edit each rate here. A subcategory disappears on its own once its last place is deleted. It cannot be removed while a place still uses it.",
    ru: "Создаются в разделе «Места», во втором ряду вкладок. Здесь их можно переименовать и изменить цену. Подкатегория исчезает сама, когда удалено её последнее место. Пока хотя бы одно место её использует, удалить её нельзя.",
    am: "Ստեղծվում են «Տեղեր» բաժնում՝ ներդիրների երկրորդ շարքում։ Այստեղ կարող եք վերանվանել դրանք և փոխել գինը։ Ենթակատեգորիան ինքնին անհետանում է, երբ ջնջվում է դրա վերջին տեղը։ Քանի դեռ որևէ տեղ այն օգտագործում է, այն հնարավոր չէ ջնջել։",
  },
  "subplatform.defaultUndeletable": {
    en: "The Default subcategory cannot be deleted.",
    ru: "Подкатегорию «По умолчанию» удалить нельзя.",
    am: "«Կանխադրված» ենթակատեգորիան հնարավոր չէ ջնջել։",
  },

  // Tournament form
  "tournament.titleNew": { en: "New tournament", ru: "Новый турнир", am: "Նոր մրցաշար" },
  "tournament.titleEdit": { en: "Edit tournament", ru: "Редактировать турнир", am: "Խմբագրել մրցաշարը" },
  "tournament.errors.pickGame": { en: "Pick a game", ru: "Выберите игру", am: "Ընտրեք խաղ" },
  "tournament.errors.descRequired": { en: "Description is required", ru: "Укажите описание", am: "Նկարագրությունը պարտադիր է" },
  "tournament.errors.startRequired": { en: "Start date is required", ru: "Укажите дату начала", am: "Մեկնարկի ամսաթիվը պարտադիր է" },
  "tournament.errors.companyMissing": { en: "Branch is missing company id. Reload and retry", ru: "У филиала нет компании. Перезагрузите страницу", am: "Մասնաճյուղին ընկերություն կցված չէ։ Թարմացրեք և կրկնեք։" },
  "tournament.branchLoadFailed": { en: "Branch load failed", ru: "Не удалось загрузить филиал", am: "Չհաջողվեց բեռնել մասնաճյուղը" },

  // Skill level (tournament create/edit select + list/detail chip)
  "tournament.skillLevel": { en: "Skill level", ru: "Уровень игры", am: "Խաղի մակարդակ" },
  "tournament.skillLevel.any":          { en: "Any",          ru: "Любой",          am: "Ցանկացած" },
  "tournament.skillLevel.beginner":     { en: "Beginner",     ru: "Новичок",        am: "Սկսնակ" },
  "tournament.skillLevel.intermediate": { en: "Intermediate", ru: "Средний",        am: "Միջին" },
  "tournament.skillLevel.professional": { en: "Professional", ru: "Профи",          am: "Պրոֆեսիոնալ" },

  // Verify-code section on the tournament detail page
  "registrations.verifyCodeTitle":      { en: "Verify player code", ru: "Подтвердить код игрока", am: "Հաստատել խաղացողի կոդը" },
  "registrations.verifyCodeHint":       { en: "Enter the 6-character code the player shows on their phone, or scan their QR.", ru: "Введите 6-значный код, который игрок показывает на телефоне, или отсканируйте QR.", am: "Մուտքագրեք 6 նիշանոց կոդը, որը խաղացողը ցույց է տալիս իր հեռախոսում, կամ սկանավորեք QR-ը։" },
  "registrations.verifyCodePlaceholder":{ en: "e.g. A3K9P2",       ru: "напр. A3K9P2",         am: "օր. A3K9P2" },
  "registrations.verifyButton":         { en: "Verify",            ru: "Подтвердить",          am: "Հաստատել" },
  "registrations.scanQrButton":         { en: "Scan QR",           ru: "Сканировать QR",       am: "Սկանավորել QR" },
  "registrations.verifySuccess":        { en: "Verified",          ru: "Подтверждено",         am: "Հաստատված է" },
  "registrations.verifyFailed":         { en: "Verification failed", ru: "Не удалось подтвердить", am: "Չհաջողվեց հաստատել" },
  "registrations.verifyAlready":        { en: "Already verified",  ru: "Уже подтверждено",     am: "Արդեն հաստատված է" },
  "registrations.verifiedBadge":        { en: "✓ Verified",        ru: "✓ Подтверждён",        am: "✓ Հաստատված" },
  "registrations.verifiedBy":           { en: "by",                ru: "-",                   am: "-" },
  "registrations.pendingBadge":         { en: "Pending",           ru: "Ожидает",              am: "Սպասում է" },

  // Branch form
  "branch.titleNew": { en: "New branch", ru: "Новый филиал", am: "Նոր մասնաճյուղ" },
  "branch.titleEdit": { en: "Edit branch", ru: "Редактировать филиал", am: "Խմբագրել մասնաճյուղը" },
  "branch.address": { en: "Address", ru: "Адрес", am: "Հասցե" },
  "branch.addressPlaceholder": { en: "Your branch address", ru: "Ваш адрес филиала", am: "Ձեր մասնաճյուղի հասցեն" },
  "branchForm.suggestionsHint": { en: "Start typing. Pick a real address from the list", ru: "Начните вводить. Выберите реальный адрес из списка", am: "Սկսեք մուտքագրել։ Ընտրեք իրական հասցե ցանկից" },
  "branch.country": { en: "Country", ru: "Страна", am: "Երկիր" },
  "branch.city": { en: "City", ru: "Город", am: "Քաղաք" },
  "branch.coordinates": { en: "Coordinates (lat / lng)", ru: "Координаты (широта / долгота)", am: "Կոորդինատներ (լայն. / երկ.)" },
  "branch.logo": { en: "Logo (optional)", ru: "Логотип (необязательно)", am: "Լոգո (ընտրովի)" },

  // ── PA-1: branch status (`branches.status`) ──────────────────────────────
  // Active / Inactive = may players see this branch. The owner's switch (and
  // the admin's), on create and on edit. The badge and the notice exist so
  // whoever looks learns WHY players cannot find the venue. Not the block:
  // that is `blocking.*`.
  "branch.status": { en: "Status", ru: "Статус", am: "Կարգավիճակ" },
  "branch.status.active": { en: "Active", ru: "Активен", am: "Ակտիվ" },
  "branch.status.inactive": { en: "Inactive", ru: "Неактивен", am: "Ոչ ակտիվ" },
  "branch.statusHint": {
    en: "Inactive: players can't see this branch in the app. Staff keep working in it as usual.",
    ru: "Неактивен: игроки не видят этот филиал в приложении. Персонал работает в нём как обычно.",
    am: "Ոչ ակտիվ՝ խաղացողները հավելվածում չեն տեսնում այս մասնաճյուղը։ Աշխատակազմը շարունակում է աշխատել դրանում սովորականի պես։",
  },
  "branch.inactive.hint": {
    en: "Inactive: players can't see this branch.",
    ru: "Неактивен: игроки не видят этот филиал.",
    am: "Ոչ ակտիվ՝ խաղացողները չեն տեսնում այս մասնաճյուղը։",
  },
  // Tooltip of the green "Active" pill, the counterpart of the one above.
  "branch.active.hint": {
    en: "Active: players can see this branch.",
    ru: "Активен: игроки видят этот филиал.",
    am: "Ակտիվ՝ խաղացողները տեսնում են այս մասնաճյուղը։",
  },
  "branch.inactive.notice": {
    en: "Inactive: players can't see this branch in the app. Staff can keep working in it.",
    ru: "Неактивен: игроки не видят этот филиал в приложении. Персонал может продолжать в нём работать.",
    am: "Ոչ ակտիվ՝ խաղացողները հավելվածում չեն տեսնում այս մասնաճյուղը։ Աշխատակազմը կարող է շարունակել աշխատել դրանում։",
  },
  // Appended for whoever can flip it (owner, admin). {0} = the hub's Settings
  // tile, {1} = the "Edit info" button, {2} = the "Active" toggle label — the
  // path to the switch, named with the labels they will actually see.
  "branch.inactive.noticeWhere": {
    en: "To show it to players, switch it to {2} in {0} → {1}.",
    ru: "Чтобы игроки его увидели, переключите на «{2}»: {0} → {1}.",
    am: "Որպեսզի խաղացողները տեսնեն այն, ընտրեք «{2}»՝ {0} → {1}։",
  },
  // ── PA-2: admin Owners section ───────────────────────────────────────────
  "nav.owners": { en: "Owners", ru: "Владельцы", am: "Սեփականատերեր" },
  "owners.title": { en: "Owners", ru: "Владельцы", am: "Սեփականատերեր" },
  "owners.search": {
    en: "Search by name, email or company",
    ru: "Поиск по имени, email или компании",
    am: "Որոնում ըստ անվան, էլ. փոստի կամ ընկերության",
  },
  "owners.noCompany": { en: "No company", ru: "Нет компании", am: "Ընկերություն չկա" },
  "owners.openCompany": { en: "Open the company", ru: "Открыть компанию", am: "Բացել ընկերությունը" },
  "owners.branches": { en: "Branches: {0}", ru: "Филиалов: {0}", am: "Մասնաճյուղեր՝ {0}" },
  "owners.managers": { en: "Managers: {0}", ru: "Менеджеров: {0}", am: "Մենեջերներ՝ {0}" },
  "owner.titleEdit": { en: "Edit owner", ru: "Редактировать владельца", am: "Խմբագրել սեփականատիրոջը" },
  "owner.titleNew": { en: "Add owner", ru: "Добавить владельца", am: "Ավելացնել սեփականատեր" },
  "owners.add": { en: "Add owner", ru: "Добавить владельца", am: "Ավելացնել սեփականատեր" },
  "owner.pickCompany": { en: "Choose a company", ru: "Выберите компанию", am: "Ընտրեք ընկերությունը" },
  "owner.errors.companyRequired": { en: "Choose the company", ru: "Выберите компанию", am: "Ընտրեք ընկերությունը" },
  // One hint for every "new account" form: nobody types a password for somebody else.
  "staff.inviteHint": {
    en: "We will email a link to this address; the person sets their own password.",
    ru: "На этот адрес придёт письмо со ссылкой, и человек сам задаст пароль.",
    am: "Այս հասցեին կուղարկվի հղում, և անձն ինքը կսահմանի իր գաղտնաբառը։",
  },
  "owners.delete.question": {
    en: "Delete owner {0} and everything they own?",
    ru: "Удалить владельца {0} и всё, что ему принадлежит?",
    am: "Ջնջե՞լ {0} սեփականատիրոջը և այն ամենը, ինչ պատկանում է նրան։",
  },
  "owners.delete.loading": {
    en: "Checking what would be deleted…",
    ru: "Проверяем, что будет удалено…",
    am: "Ստուգում ենք, թե ինչ կջնջվի…",
  },
  "owners.delete.loadFailed": {
    en: "Could not check what would be deleted, so nothing can be deleted now. Close and try again.",
    ru: "Не удалось проверить, что будет удалено, поэтому удаление сейчас недоступно. Закройте и попробуйте ещё раз.",
    am: "Չհաջողվեց ստուգել, թե ինչ կջնջվի, ուստի ջնջումը հիմա հասանելի չէ։ Փակեք և փորձեք կրկին։",
  },
  "owners.delete.takes": { en: "This permanently deletes:", ru: "Будет удалено безвозвратно:", am: "Անվերադարձ կջնջվի՝" },
  "owners.delete.companies": { en: "Companies: {0}", ru: "Компаний: {0}", am: "Ընկերություններ՝ {0}" },
  "owners.delete.branches": { en: "Branches: {0}", ru: "Филиалов: {0}", am: "Մասնաճյուղեր՝ {0}" },
  "owners.delete.managers": { en: "Manager accounts: {0}", ru: "Аккаунтов менеджеров: {0}", am: "Մենեջերների հաշիվներ՝ {0}" },
  "owners.delete.places": { en: "Places: {0}", ru: "Мест: {0}", am: "Տեղեր՝ {0}" },
  "owners.delete.sessions": { en: "Sessions in history: {0}", ru: "Сессий в истории: {0}", am: "Սեսիաներ պատմության մեջ՝ {0}" },
  "owners.delete.members": {
    en: "Member cards with a balance: {0}",
    ru: "Клиентских карт с балансом: {0}",
    am: "Հաճախորդի քարտեր մնացորդով՝ {0}",
  },
  "owners.delete.irreversible": { en: "This cannot be undone.", ru: "Это нельзя отменить.", am: "Սա հնարավոր չէ հետարկել։" },
  "owners.delete.blocked": { en: "It can't be deleted yet:", ru: "Удалить пока нельзя:", am: "Դեռ հնարավոր չէ ջնջել՝" },
  // Keyed by the backend's `TenantDeletionBlocker` code; {0} = the count.
  "owners.blocker.running_sessions": {
    en: "Running sessions: {0}. Stop them first.",
    ru: "Идущих сессий: {0}. Сначала остановите их.",
    am: "Ընթացիկ սեսիաներ՝ {0}։ Նախ դադարեցրեք դրանք։",
  },
  "owners.blocker.upcoming_bookings": {
    en: "Upcoming bookings: {0}. Cancel them first (players are notified).",
    ru: "Предстоящих бронирований: {0}. Сначала отмените их (игроки получат уведомление).",
    am: "Առաջիկա ամրագրումներ՝ {0}։ Նախ չեղարկեք դրանք (խաղացողները կծանուցվեն)։",
  },
  "toast.owner.created": { en: "Owner added, invitation sent", ru: "Владелец добавлен, приглашение отправлено", am: "Սեփականատերն ավելացվեց՝ հրավերն ուղարկվեց" },
  "toast.owner.updated": { en: "Owner updated", ru: "Владелец обновлён", am: "Սեփականատերը թարմացվեց" },
  "toast.owner.deleted": { en: "Owner deleted", ru: "Владелец удалён", am: "Սեփականատերը ջնջվեց" },
  // ── PA-C: one owner's page (`/owners/:ownerId`) ──────────────────────────
  "owners.openOwner": { en: "Open the owner", ru: "Открыть владельца", am: "Բացել սեփականատիրոջը" },
  "owner.back": { en: "← Owners", ru: "← Владельцы", am: "← Սեփականատերեր" },
  // {0} = the owner id, shown while the page loads or when it failed.
  "owner.fallbackTitle": { en: "Owner №{0}", ru: "Владелец №{0}", am: "Սեփականատեր №{0}" },
  "owner.invalidId": { en: "Invalid owner id", ru: "Неверный ID владельца", am: "Սեփականատիրոջ սխալ ID" },
  "owner.created": { en: "Registered", ru: "Зарегистрирован", am: "Գրանցվել է" },
  "owner.companies": { en: "Companies", ru: "Компании", am: "Ընկերություններ" },
  // ── end PA-1 / PA-2 / PA-C ────────────────────────────────────────────────

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
  "pairing.copied": { en: "Copied!", ru: "Скопировано!", am: "Պատճենվեց" },
  "pairing.hint": { en: "Use this token in the agent app on the gaming PC.", ru: "Используйте этот токен в агенте на игровом ПК.", am: "Օգտագործեք այս տոկենը խաղային համակարգչի Agent ծրագրում։" },

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
  "auth.resetSent": { en: "If the email exists, a reset link was sent.", ru: "Если email существует, ссылка отправлена.", am: "Եթե այդ էլ. հասցեն գոյություն ունի, հղումն ուղարկվել է։" },

  // Member card / list / shifts / pos / booking details
  "members.title": { en: "Members", ru: "Клиенты", am: "Հաճախորդներ" },
  "members.new": { en: "+ New member", ru: "+ Новый клиент", am: "+ Նոր հաճախորդ" },
  "members.search": { en: "Search by name / phone / card…", ru: "Поиск по имени / телефону / карте…", am: "Որոնում անունով / հեռախոսով / քարտով…" },
  "members.balance": { en: "Balance", ru: "Баланс", am: "Մնացորդ" },
  "members.deposits": { en: "Deposits", ru: "Депозиты", am: "Համալրումներ" },
  "members.lastVisit": { en: "Last visit", ru: "Последний визит", am: "Վերջին այց" },

  "products.title": { en: "Products", ru: "Товары", am: "Ապրանքներ" },
  "products.new": { en: "+ New product", ru: "+ Новый товар", am: "+ Նոր ապրանք" },
  "products.newAdditional": { en: "+ New additional item", ru: "+ Новый доп. предмет", am: "+ Նոր լրացուցիչ իր" },
  "products.search": {
    en: "Search by name or category…",
    ru: "Поиск по названию или категории…",
    am: "Որոնում անունով կամ կատեգորիայով…",
  },
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
    am: "Ժամային սակագին (դրամ)։ Սեսիաներն ու բջջային հավելվածը հաշվարկում են ըստ այս աղյուսակի։",
  },
  "branch.prices.saved": { en: "Saved", ru: "Сохранено", am: "Պահպանված է" },
  "branch.prices.packagesSubtitle": { en: "Time packages", ru: "Тарифные пакеты", am: "Ժամանակային փաթեթներ" },
  // Branch → Prices, grouped: what a seat costs, what is sold as a package,
  // and the rules applied on top of every bill.
  "prices.group.rates": { en: "Rates", ru: "Ставки", am: "Սակագներ" },
  "prices.hourlyTitle": { en: "Hourly rates", ru: "Почасовые ставки", am: "Ժամային սակագներ" },
  "prices.group.packages": { en: "Packages", ru: "Пакеты", am: "Փաթեթներ" },
  "prices.group.rules": { en: "Billing rules", ru: "Правила оплаты", am: "Վճարման կանոններ" },
  "prices.packagesHint": {
    en: "Fixed-length sessions sold at one price.",
    ru: "Сессии фиксированной длины по одной цене.",
    am: "Ֆիքսված տևողությամբ սեսիաներ՝ մեկ գնով։",
  },
  "prices.packageInactive": { en: "Inactive", ru: "Неактивен", am: "Ոչ ակտիվ" },
  "tariff.platform": { en: "Platform", ru: "Платформа", am: "Հարթակ" },
  "tariff.platformAll": { en: "All platforms", ru: "Все платформы", am: "Բոլոր հարթակները" },
  "tariff.discount.toggle": {
    en: "Add a time-windowed discount",
    ru: "Добавить скидку по времени",
    am: "Ավելացնել զեղչ ըստ ժամերի",
  },
  "tariff.discount.hint": {
    en: "Discount applies on selected weekdays inside the window. Players see it on the duration picker only while active.",
    ru: "Скидка действует в выбранные дни недели и часы. Игроки видят её на экране выбора длительности только пока она активна.",
    am: "Զեղչը գործում է ընտրված օրերին՝ նշված ժամերին։ Խաղացողները այն տեսնում են տևողության ընտրության էկրանում միայն զեղչի գործելու ժամանակ։",
  },
  "tariff.discount.price": { en: "Discount price", ru: "Цена со скидкой", am: "Զեղչային գին" },
  "tariff.discount.startTime": { en: "Start time", ru: "Время начала", am: "Սկզբի ժամ" },
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
  "branchForm.autoLocateHint": { en: "We auto-locate the address as you type. Click on the map to override the pin.", ru: "Адрес ищется автоматически по мере ввода. Кликните на карте, чтобы поставить точку вручную.", am: "Հասցեն որոնվում է ավտոմատ՝ մուտքագրելիս։ Սեղմեք քարտեզի վրա՝ կետը ձեռքով դնելու համար։" },
  "branchForm.searching": { en: "Searching address…", ru: "Поиск адреса…", am: "Հասցեի որոնում…" },
  "branchForm.pinned": { en: "Pinned ✓", ru: "Точка установлена ✓", am: "Կետը նշված է ✓" },
  "branchForm.addrNotFound": { en: "Address not found. Click the map to pick", ru: "Адрес не найден. Кликните на карте", am: "Հասցեն չի գտնվել։ Սեղմեք քարտեզի վրա" },
  "branchForm.geoFailed": { en: "Geocoding failed. Click the map to pick", ru: "Не удалось определить координаты. Кликните на карте", am: "Կոորդինատների որոնումը ձախողվեց։ Սեղմեք քարտեզի վրա" },
  "branchForm.typeOrClick": { en: "Type address or click the map", ru: "Введите адрес или кликните на карте", am: "Մուտքագրեք հասցեն կամ սեղմեք քարտեզի վրա" },
  "branchForm.selectedLocation": { en: "Selected location", ru: "Выбранная точка", am: "Ընտրված կետ" },
  "branchForm.pickLocationFirst": { en: "Pick a location on the map (or fill the address so it can be auto-located).", ru: "Укажите точку на карте (или заполните адрес для авто-определения).", am: "Ընտրեք կետ քարտեզի վրա (կամ լրացրեք հասցեն՝ այն ավտոմատ գտնելու համար)։" },
  "branchForm.pickFromList": { en: "Pick a real address from the suggestions so the location is verified.", ru: "Выберите реальный адрес из подсказок, чтобы точка была подтверждена.", am: "Ընտրեք իրական հասցե առաջարկներից, որպեսզի կետը հաստատվի։" },
  "branchForm.cityRequired": { en: "City is required.", ru: "Укажите город.", am: "Քաղաքը պարտադիր է։" },
  "branchForm.cityFromAddress": { en: "Filled from the address", ru: "Заполняется из адреса", am: "Լրացվում է հասցեից" },
  "branchForm.invalidPhone": { en: "Enter a valid phone number for the selected country.", ru: "Введите корректный номер телефона для выбранной страны.", am: "Մուտքագրեք ընտրված երկրի վավեր հեռախոսահամար։" },

  // Company details page
  "company.invalidId": { en: "Invalid company id.", ru: "Неверный идентификатор компании.", am: "Ընկերության սխալ ID։" },
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
  "company.ownerName": { en: "Owner full name", ru: "Имя владельца", am: "Սեփականատիրոջ անուն, ազգանուն" },
  "company.ownerEmail": { en: "Owner email", ru: "Email владельца", am: "Սեփականատիրոջ էլ. հասցե" },
  "company.next": { en: "Next", ru: "Далее", am: "Հաջորդը" },
  "company.back": { en: "← Back", ru: "← Назад", am: "← Հետ" },
  "company.create": { en: "Create company", ru: "Создать компанию", am: "Ստեղծել ընկերություն" },
  "company.name": { en: "Company name", ru: "Название компании", am: "Ընկերության անվանումը" },
  "company.tin": { en: "TIN", ru: "ИНН", am: "ՀՎՀՀ" },
  "company.website": { en: "Website", ru: "Веб-сайт", am: "Կայք" },
  "company.statusAdmin": { en: "Status (admin only)", ru: "Статус (только админ)", am: "Կարգավիճակ (միայն ադմին)" },
  "company.commissionAdmin": { en: "Commission % (admin only)", ru: "Комиссия % (только админ)", am: "Միջնորդավճար % (միայն ադմին)" },
  "company.commissionHint": { en: "Owner pays this percent of monthly gross revenue to Cyber Place.", ru: "Владелец платит этот процент с месячной выручки Cyber Place.", am: "Սեփականատերը Cyber Place-ին վճարում է ամսական համախառն հասույթի այս տոկոսը։" },
  "company.saving": { en: "Saving…", ru: "Сохранение…", am: "Պահպանվում է…" },
  "company.saved": { en: "Saved.", ru: "Сохранено.", am: "Պահպանված է։" },
  "company.logoRequired": { en: "Logo is required for a new company", ru: "Для новой компании нужен логотип", am: "Նոր ընկերության համար անհրաժեշտ է լոգո" },
  "company.ownerNotCreated": { en: "Owner user not created yet", ru: "Владелец ещё не создан", am: "Սեփականատերը դեռ չի ստեղծվել" },
  "company.replaceLogo": { en: "Replace logo (optional)", ru: "Заменить логотип (необязательно)", am: "Փոխել լոգոն (ընտրովի)" },
  "company.logo": { en: "Logo", ru: "Логотип", am: "Լոգո" },

  // Role labels — used by the sidebar user card chip and any other
  // surface that needs to render a humane name for `users.role`.
  "role.admin": { en: "Admin", ru: "Админ", am: "Ադմին" },
  "role.company_owner": { en: "Owner", ru: "Владелец", am: "Սեփականատեր" },
  "role.manager": { en: "Manager", ru: "Менеджер", am: "Մենեջեր" },

  // Profile
  "profile.title": { en: "Profile", ru: "Профиль", am: "Պրոֆիլ" },
  "profile.firstName": { en: "First name", ru: "Имя", am: "Անուն" },
  "profile.lastName": { en: "Last name", ru: "Фамилия", am: "Ազգանուն" },
  "profile.emailChangeSoon": { en: "Email change with verification is coming soon.", ru: "Изменение email с подтверждением появится скоро.", am: "Հաստատմամբ էլ. հասցեի փոփոխությունը հասանելի կլինի շուտով։" },
  "profile.saved": { en: "Profile saved", ru: "Профиль сохранён", am: "Պրոֆիլը պահպանվեց" },
  "profile.nameRequired": { en: "Enter a name", ru: "Введите имя", am: "Մուտքագրեք անուն" },
  "profile.pwKnow": { en: "I know my password", ru: "Помню пароль", am: "Հիշում եմ գաղտնաբառը" },
  "profile.pwForgot": { en: "I forgot it", ru: "Забыл пароль", am: "Մոռացել եմ" },
  "profile.forgotHint": { en: "We'll email a reset code to your address.", ru: "Отправим код сброса на вашу почту.", am: "Վերակայման կոդը կուղարկենք ձեր էլ. հասցեին։" },
  "profile.sendCode": { en: "Send code", ru: "Отправить код", am: "Ուղարկել կոդը" },
  "profile.resendCode": { en: "Resend", ru: "Отправить снова", am: "Ուղարկել կրկին" },
  "profile.codeSent": { en: "Code sent to your email.", ru: "Код отправлен на почту.", am: "Կոդն ուղարկվեց ձեր էլ. հասցեին։" },
  "profile.codePlaceholder": { en: "Code from email", ru: "Код из письма", am: "Կոդ նամակից" },
  "profile.passwordUpdated": { en: "Password updated", ru: "Пароль обновлён", am: "Գաղտնաբառը թարմացվեց" },
  "profile.pwRuleLength": { en: "At least 8 characters", ru: "Минимум 8 символов", am: "Առնվազն 8 նիշ" },
  "profile.pwRuleMatch": { en: "Passwords match", ru: "Пароли совпадают", am: "Գաղտնաբառերը համընկնում են" },
  "profile.wrongCurrentPassword": { en: "Current password is incorrect", ru: "Текущий пароль неверный", am: "Ընթացիկ գաղտնաբառը սխալ է" },
  "profile.changeEmail": { en: "Change email", ru: "Изменить email", am: "Փոխել էլ. հասցեն" },
  "profile.newEmail": { en: "New email", ru: "Новый email", am: "Նոր էլ. հասցե" },
  "profile.codeSentCurrent": { en: "Code sent to the new email.", ru: "Код отправлен на новую почту.", am: "Կոդն ուղարկվեց նոր էլ. հասցեին։" },
  "profile.emailUpdated": { en: "Email updated", ru: "Email обновлён", am: "Էլ. հասցեն թարմացվեց" },
  "profile.emailCodeHint": { en: "Enter the code we sent to the new email.", ru: "Введите код, отправленный на новую почту.", am: "Մուտքագրեք նոր էլ. հասցեին ուղարկված կոդը։" },
  "profile.confirmEmail": { en: "Confirm & change", ru: "Подтвердить и изменить", am: "Հաստատել և փոխել" },
  "profile.errEmailTaken": { en: "This email is already in use.", ru: "Этот email уже используется.", am: "Այս էլ. հասցեն արդեն օգտագործվում է։" },
  "profile.errInvalidCode": { en: "The code is invalid or has expired.", ru: "Код неверный или истёк.", am: "Կոդը սխալ է կամ ժամկետն անցել է։" },
  "profile.emailChangedToast": { en: "You have successfully changed your email", ru: "Вы успешно изменили почтовый ящик", am: "Դուք հաջողությամբ փոխեցիք էլ. հասցեն" },
  "profile.passwordChangedToast": { en: "You have successfully changed your password", ru: "Вы успешно изменили ваш пароль", am: "Դուք հաջողությամբ փոխեցիք ձեր գաղտնաբառը" },
  "profile.confirmCode": { en: "Confirm code", ru: "Подтвердить код", am: "Հաստատել կոդը" },
  "profile.enterCodeHint": { en: "Enter the one-time code we sent to your email.", ru: "Введите одноразовый код, отправленный на вашу почту.", am: "Մուտքագրեք ձեր էլ. հասցեին ուղարկված միանգամյա կոդը։" },

  // Pairing token modal
  "pairing.titleFor": { en: "Pairing token", ru: "Токен сопряжения", am: "Զուգակցման տոկեն" },
  "pairing.saveNow": { en: "Save this token now. It will not be shown again. You'll need it on the agent during PC setup, along with PC ID", ru: "Сохрани этот токен сейчас. Он больше не будет показан. Он понадобится для настройки агента вместе с ID ПК", am: "Պահպանեք այս տոկենը հիմա։ Այն այլևս չի ցուցադրվի։ Այն պետք կլինի Agent-ում համակարգիչը կարգավորելիս՝ համակարգչի ID-ի հետ։" },
  "pairing.copyToken": { en: "Copy token", ru: "Скопировать токен", am: "Պատճենել տոկենը" },
  "pairing.iSaved": { en: "I saved it", ru: "Сохранил", am: "Պահպանեցի" },

  // Booking action modals
  "booking.cancelTitleId": { en: "Cancel booking", ru: "Отменить бронь", am: "Չեղարկել ամրագրումը" },
  "booking.cancelReasonField": { en: "Reason (optional, kept for your records)", ru: "Причина (необязательно)", am: "Պատճառ (ընտրովի)" },
  "booking.cancelReasonHint": { en: "Backend doesn't currently store reason. This stays in your local notes only.", ru: "Бэкенд пока не сохраняет причину. Текст остаётся только в локальных заметках.", am: "Սերվերը դեռ չի պահպանում պատճառը։ Այն կմնա միայն ձեր տեղային նշումներում։" },
  "booking.keep": { en: "Keep booking", ru: "Оставить бронь", am: "Թողնել ամրագրումը" },
  "booking.cancelling": { en: "Cancelling…", ru: "Отмена…", am: "Չեղարկվում է…" },
  "booking.cancelDo": { en: "Cancel booking", ru: "Отменить бронь", am: "Չեղարկել ամրագրումը" },

  // QR scanner
  "qr.requesting": { en: "Requesting camera access…", ru: "Запрос доступа к камере…", am: "Տեսախցիկի թույլտվության հարցում…" },
  "qr.aim": { en: "Point the camera at the QR code on the customer's screen.", ru: "Наведите камеру на QR-код на экране клиента.", am: "Ուղղեք տեսախցիկը հաճախորդի էկրանի QR կոդին։" },
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
  "tariffs.confirmDelete": { en: "Delete tariff", ru: "Удалить тариф", am: "Ջնջել սակագինը" },
  "products.confirmDelete": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "members.cardLabel": { en: "card", ru: "карта", am: "քարտ" },

  // Forgot/reset
  "forgot.successPrefix": { en: "If the email exists, a reset link has been sent.", ru: "Если email существует, ссылка на сброс отправлена.", am: "Եթե էլ. հասցեն գրանցված է, վերակայման հղումն ուղարկվել է։" },
  "forgot.toastSent": { en: "Password reset link sent to your email", ru: "Ссылка для сброса пароля отправлена на почту", am: "Գաղտնաբառի վերակայման հղումն ուղարկվել է ձեր էլ. փոստին" },
  "auth.sending": { en: "Sending…", ru: "Отправка…", am: "Ուղարկվում է…" },
  "reset.token": { en: "Reset token", ru: "Токен сброса", am: "Վերակայման տոկեն" },
  "reset.successDone": { en: "Password updated. You can now sign in.", ru: "Пароль обновлён. Можно войти.", am: "Գաղտնաբառը թարմացվել է։ Կարող եք մուտք գործել։" },
  "reset.cardHint": { en: "A one-time code will be sent to {0}. Enter it together with the new password.", ru: "Одноразовый код придёт на {0}. Введите его вместе с новым паролем.", am: "Միանգամյա կոդը կուղարկվի {0} հասցեին։ Մուտքագրեք այն նոր գաղտնաբառի հետ։" },
  "reset.codeSentTo": { en: "Code sent to {0}", ru: "Код отправлен на {0}", am: "Կոդն ուղարկվել է {0} հասցեին" },

  // Member card
  "memberCard.transactions": { en: "Transactions", ru: "Транзакции", am: "Գործարքներ" },
  "memberCard.topup": { en: "Top up", ru: "Пополнение", am: "Համալրում" },
  "memberCard.spend": { en: "Spend", ru: "Списание", am: "Ծախս" },
  "memberCard.adjust": { en: "Adjust", ru: "Корректировка", am: "Շտկում" },

  // Branch hub tiles
  "tile.sessions": { en: "Sessions", ru: "Сессии", am: "Սեսիաներ" },
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
  "status.offline": { en: "Offline", ru: "Оффлайн", am: "Անցանց" },
  "status.in_session": { en: "In session", ru: "В сессии", am: "Սեսիայում" },

  // Settings
  "settings.account": { en: "Account", ru: "Аккаунт", am: "Հաշիվ" },
  "settings.changePassword": {
    en: "Change password",
    ru: "Сменить пароль",
    am: "Փոխել գաղտնաբառը",
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
    en: "Live, sessions, products, members",
    ru: "Мониторинг, сеансы, товары, игроки",
    am: "Մոնիտորինգ, սեսիաներ, ապրանքներ, հաճախորդներ",
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
    am: "Միջնորդավճար և եկամուտ",
  },
  "home.menu.myBranch": {
    en: "My branch",
    ru: "Мой филиал",
    am: "Իմ մասնաճյուղը",
  },
  "home.menu.myBranchSub": {
    en: "Sessions, products, members",
    ru: "Сеансы, товары, клиенты",
    am: "Սեսիաներ, ապրանքներ, հաճախորդներ",
  },
  "home.menu.expenses": {
    en: "Expenses",
    ru: "Расходы",
    am: "Ծախսեր",
  },
  "home.menu.expensesSub": {
    en: "Recurring services you pay monthly",
    ru: "Регулярные сервисы, оплата ежемесячно",
    am: "Ամսական վճարվող ծառայություններ",
  },
  // Admin "Metrics" section — Yandex.Metrica website analytics.
  "home.menu.metrics": {
    en: "Metrics",
    ru: "Метрики",
    am: "Մետրիկա",
  },
  "home.menu.metricsSub": {
    en: "Site traffic & server health",
    ru: "Трафик сайта и здоровье сервера",
    am: "Կայքի թրաֆիկ և սերվերի վիճակ",
  },
  "metrics.title": { en: "Metrics", ru: "Метрики", am: "Մետրիկա" },

  // ---- Monitoring sections (per app) ----
  "monitoring.title": { en: "Monitoring", ru: "Мониторинг", am: "Մոնիտորինգ" },
  "monitoring.app.mobile": { en: "Mobile app", ru: "Мобильное приложение", am: "Բջջային հավելված" },
  "monitoring.app.panel": { en: "Desktop panel", ru: "Десктоп-панель", am: "Դեսքթոփ վահանակ" },
  "monitoring.app.agent": { en: "Desktop agent", ru: "Десктоп-агент", am: "Դեսքթոփ Agent" },
  "monitoring.app.website": { en: "Website", ru: "Веб-сайт", am: "Կայք" },
  "monitoring.installs": { en: "Installs", ru: "Установки", am: "Տեղադրումներ" },
  "monitoring.installsShort": { en: "inst.", ru: "уст.", am: "տեղադր." },
  "monitoring.viewsShort": { en: "views", ru: "просм.", am: "դիտում" },
  "monitoring.launches": { en: "Launches", ru: "Запуски", am: "Գործարկումներ" },
  "monitoring.events": { en: "Events", ru: "События", am: "Իրադարձություններ" },
  "monitoring.errors": { en: "Errors", ru: "Ошибки", am: "Սխալներ" },
  "monitoring.errorRate": { en: "Error rate", ru: "Доля ошибок", am: "Սխալների տոկոս" },
  "monitoring.activity": { en: "Activity", ru: "Активность", am: "Ակտիվություն" },
  "monitoring.versions": { en: "Versions", ru: "Версии", am: "Տարբերակներ" },
  "monitoring.platforms": { en: "Platforms", ru: "Платформы", am: "Հարթակներ" },
  "monitoring.screens": { en: "Top screens", ru: "Популярные экраны", am: "Ամենադիտված էկրաններ" },
  "monitoring.recentErrors": { en: "Recent errors", ru: "Последние ошибки", am: "Վերջին սխալները" },
  "monitoring.noErrors": {
    en: "No errors in this period.",
    ru: "За этот период ошибок нет.",
    am: "Այս ժամանակահատվածում սխալներ չկան։",
  },
  "monitoring.lastSeen": { en: "Last report", ru: "Последний отчёт", am: "Վերջին հաշվետվությունը" },
  "monitoring.neverSeen": {
    en: "No reports yet",
    ru: "Отчётов пока нет",
    am: "Դեռ հաշվետվություններ չկան",
  },
  "monitoring.quietWindow": {
    en: "This app sent nothing in the selected period.",
    ru: "За выбранный период приложение ничего не присылало.",
    am: "Ընտրված ժամանակահատվածում հավելվածը ոչինչ չի ուղարկել։",
  },
  "monitoring.neverReported": {
    en: "This app has never reported. It starts once a version with monitoring is installed.",
    ru: "Приложение ещё ни разу не отчитывалось. Данные появятся после установки версии с мониторингом.",
    am: "Հավելվածը դեռ տվյալներ չի ուղարկել։ Դրանք կհայտնվեն մոնիտորինգով տարբերակը տեղադրելուց հետո։",
  },
  "monitoring.disabled": {
    en: "Monitoring is switched off",
    ru: "Мониторинг выключен",
    am: "Մոնիտորինգն անջատված է",
  },
  "monitoring.disabledSub": {
    en: "Set TELEMETRY_ENABLED=true for this environment to start collecting.",
    ru: "Включите TELEMETRY_ENABLED=true для этого окружения, чтобы начать сбор.",
    am: "Հավաքագրումը սկսելու համար այս միջավայրում միացրեք TELEMETRY_ENABLED=true։",
  },
  "monitoring.loadFailed": {
    en: "Could not load monitoring data",
    ru: "Не удалось загрузить данные мониторинга",
    am: "Չհաջողվեց բեռնել մոնիտորինգի տվյալները",
  },
  "monitoring.loadFailedSub": {
    en: "Check the connection to the backend and try again.",
    ru: "Проверьте соединение с сервером и попробуйте снова.",
    am: "Ստուգեք կապը սերվերի հետ և կրկին փորձեք։",
  },
  "metrics.period.today": { en: "Today", ru: "Сегодня", am: "Այսօր" },
  "metrics.period.week": { en: "7 days", ru: "7 дней", am: "7 օր" },
  "metrics.period.month": { en: "30 days", ru: "30 дней", am: "30 օր" },
  "metrics.openYandex": {
    en: "Open Yandex.Metrica →",
    ru: "Открыть Яндекс.Метрику →",
    am: "Բացել Yandex.Metrica →",
  },
  // ---- Administrative blocking (company / branch) ----
  // The confirmation questions carry the name because the admin is about to
  // sign people out of their workplace — "block this company?" is not a
  // question anybody should answer without seeing which one.
  "blocking.action.block.company": {
    en: "Block company",
    ru: "Заблокировать компанию",
    am: "Արգելափակել ընկերությունը",
  },
  "blocking.action.unblock.company": {
    en: "Unblock company",
    ru: "Разблокировать компанию",
    am: "Ապաարգելափակել ընկերությունը",
  },
  "blocking.action.block.branch": {
    en: "Block branch",
    ru: "Заблокировать филиал",
    am: "Արգելափակել մասնաճյուղը",
  },
  "blocking.action.unblock.branch": {
    en: "Unblock branch",
    ru: "Разблокировать филиал",
    am: "Ապաարգելափակել մասնաճյուղը",
  },
  "blocking.confirm.block.company": {
    en: "Block the company “{0}”? All its branches will be hidden from players, and its owner and managers will not be able to sign in.",
    ru: "Заблокировать компанию «{0}»? Все её филиалы скроются от игроков, а владелец и менеджеры не смогут войти.",
    am: "Արգելափակե՞լ «{0}» ընկերությունը։ Նրա բոլոր մասնաճյուղերը կթաքցվեն խաղացողներից, իսկ սեփականատերը և մենեջերները չեն կարողանա մուտք գործել։",
  },
  "blocking.confirm.unblock.company": {
    en: "Unblock the company “{0}”? Its branches become visible again and its staff can sign in.",
    ru: "Разблокировать компанию «{0}»? Её филиалы снова станут видимыми, а сотрудники смогут войти.",
    am: "Ապաարգելափակե՞լ «{0}» ընկերությունը։ Նրա մասնաճյուղերը կրկին տեսանելի կդառնան, իսկ աշխատակիցները կկարողանան մուտք գործել։",
  },
  "blocking.confirm.block.branch": {
    en: "Block the branch “{0}”? It will be hidden from players and its managers will not be able to sign in.",
    ru: "Заблокировать филиал «{0}»? Он скроется от игроков, а его менеджеры не смогут войти.",
    am: "Արգելափակե՞լ «{0}» մասնաճյուղը։ Այն կթաքցվի խաղացողներից, իսկ նրա մենեջերները չեն կարողանա մուտք գործել։",
  },
  "blocking.confirm.unblock.branch": {
    en: "Unblock the branch “{0}”? It becomes visible again and its managers can sign in.",
    ru: "Разблокировать филиал «{0}»? Он снова станет видимым, а его менеджеры смогут войти.",
    am: "Ապաարգելափակե՞լ «{0}» մասնաճյուղը։ Այն կրկին տեսանելի կդառնա, իսկ նրա մենեջերները կկարողանան մուտք գործել։",
  },
  "blocking.state": { en: "Access", ru: "Доступ", am: "Հասանելիություն" },
  "blocking.state.company": { en: "Blocked", ru: "Заблокирована", am: "Արգելափակված է" },
  "blocking.state.branch": { en: "Blocked", ru: "Заблокирован", am: "Արգելափակված է" },
  "blocking.state.byCompany": {
    en: "Blocked with the company",
    ru: "Заблокирован вместе с компанией",
    am: "Արգելափակված է ընկերության հետ",
  },
  // Read when the block lands while the person is mid-shift. Both say what
  // happened and who did it: being thrown out of a screen with no explanation
  // is how a support call starts. The locked-out line is only a fallback — the
  // server sends its own sentence, which names the company or the branch.
  "blocking.evicted.lockedOut": {
    en: "Your access has been blocked by an administrator.",
    ru: "Ваш доступ заблокирован администратором.",
    am: "Ձեր հասանելիությունն արգելափակվել է ադմինիստրատորի կողմից։",
  },
  "blocking.evicted.branch": {
    en: "This branch has been blocked by an administrator.",
    ru: "Этот филиал заблокирован администратором.",
    am: "Այս մասնաճյուղն արգելափակվել է ադմինիստրատորի կողմից։",
  },
  "blocking.closedByCompany": {
    en: "Closed because its company is blocked. Unblocking the branch alone will not reopen it.",
    ru: "Закрыт из-за блокировки компании. Разблокировка филиала сама по себе его не откроет.",
    am: "Փակ է ընկերության արգելափակման պատճառով։ Միայն մասնաճյուղի ապաարգելափակումը այն չի բացի։",
  },
  "toast.company.blocked": { en: "Company blocked", ru: "Компания заблокирована", am: "Ընկերությունն արգելափակվեց" },
  "toast.company.unblocked": { en: "Company unblocked", ru: "Компания разблокирована", am: "Ընկերությունն ապաարգելափակվեց" },
  "toast.branch.blocked": { en: "Branch blocked", ru: "Филиал заблокирован", am: "Մասնաճյուղն արգելափակվեց" },
  "toast.branch.unblocked": { en: "Branch unblocked", ru: "Филиал разблокирован", am: "Մասնաճյուղն ապաարգելափակվեց" },
  // Shown when someone opens a working screen of a branch that is out of
  // service and is sent back to the branch page.
  "blocking.branchClosed": {
    en: "This branch is out of service. Its sections are unavailable",
    ru: "Филиал отключён. Его разделы недоступны",
    am: "Մասնաճյուղը չի գործում։ Նրա բաժինները հասանելի չեն",
  },
  // The server's refusals, said in the operator's own language.
  //
  // The API answers a block with a machine-readable `code` next to its
  // sentence; the panel renders THESE from the code and only falls back to the
  // server's text for a code it does not know. Without that, a Russian panel
  // showed "Your branch has been blocked" at the login screen, because the
  // sentence was written wherever the refusal happened to be thrown.
  // This device is blocked (2026-10-01). Never says what: an address, a country, an administrator.
  "networkBlock.title": { en: "Access closed", ru: "Доступ закрыт", am: "Մուտքը փակ է" },
  "networkBlock.blocked": {
    en: "You have been blocked. You no longer have access to Cyber Place.",
    ru: "Вы заблокированы. У вас больше нет доступа к Cyber Place.",
    am: "Դուք արգելափակված եք։ Այլևս մուտք չունեք Cyber Place։",
  },
  "networkBlock.suspended": {
    en: "Suspicious activity was detected. Your access to Cyber Place has been blocked permanently.",
    ru: "Система обнаружила подозрительные действия. Доступ к Cyber Place для вас заблокирован навсегда.",
    am: "Համակարգը հայտնաբերել է կասկածելի գործողություններ։ Ձեր մուտքը Cyber Place ընդմիշտ արգելափակված է։",
  },
  "networkBlock.retry": { en: "Check again", ru: "Проверить снова", am: "Ստուգել կրկին" },
  "blocking.reason.company_blocked": {
    en: "Your company has been blocked. Please contact the administrator.",
    ru: "Ваша компания заблокирована. Обратитесь к администратору.",
    am: "Ձեր ընկերությունն արգելափակված է։ Դիմեք ադմինիստրատորին։",
  },
  "blocking.reason.branch_blocked": {
    en: "Your branch has been blocked. Please contact the administrator.",
    ru: "Ваш филиал заблокирован. Обратитесь к администратору.",
    am: "Ձեր մասնաճյուղն արգելափակված է։ Դիմեք ադմինիստրատորին։",
  },
  "blocking.reason.branch_operation_blocked": {
    en: "This branch is blocked. You can view it, but nothing here can be changed.",
    ru: "Филиал заблокирован. Его можно просматривать, но изменения недоступны.",
    am: "Մասնաճյուղն արգելափակված է։ Կարող եք դիտել, բայց փոփոխություններն անհասանելի են։",
  },
  // Not a block: an admin deleted this account's owner, and the company with
  // them. Arrives on the access channel as `code: "account_deleted"`; the same
  // sentence as the server's `response.owner.account-deleted`, in the panel's
  // language instead of the admin's.
  "blocking.reason.account_deleted": {
    en: "Your account has been deleted.",
    ru: "Ваша учётная запись удалена.",
    am: "Ձեր հաշիվը ջնջվել է։",
  },
  // Shown on the branch page itself while it is out of service. States the
  // rule the whole screen then obeys, so a disabled tile never reads as a bug.
  "blocking.readOnly.banner": {
    en: "This branch is blocked by an administrator. It is read-only: its sections and actions stay unavailable until the block is lifted.",
    ru: "Филиал заблокирован администратором. Он доступен только для просмотра: разделы и действия недоступны, пока блокировку не снимут.",
    am: "Մասնաճյուղն արգելափակված է ադմինիստրատորի կողմից։ Հասանելի է միայն դիտման համար․ բաժիններն ու գործողություններն անհասանելի են, մինչև արգելափակումը հանվի։",
  },
  "blocking.readOnly.bannerByCompany": {
    en: "The company that owns this branch is blocked. The branch is read-only until the company is unblocked.",
    ru: "Компания, которой принадлежит филиал, заблокирована. Филиал доступен только для просмотра, пока компанию не разблокируют.",
    am: "Այս մասնաճյուղին տիրապետող ընկերությունն արգելափակված է։ Մասնաճյուղը հասանելի է միայն դիտման համար, մինչև ընկերության արգելափակումը հանվի։",
  },
  "blocking.readOnly.tileHint": {
    en: "Unavailable while the branch is blocked",
    ru: "Недоступно, пока филиал заблокирован",
    am: "Անհասանելի է, քանի դեռ մասնաճյուղն արգելափակված է",
  },
  "toast.generic.blocked": { en: "Blocked", ru: "Заблокировано", am: "Արգելափակվեց" },
  "toast.generic.unblocked": { en: "Unblocked", ru: "Разблокировано", am: "Ապաարգելափակվեց" },

  "metrics.refresh": { en: "Refresh", ru: "Обновить", am: "Թարմացնել" },
  "metrics.refreshing": { en: "Refreshing…", ru: "Обновляем…", am: "Թարմացվում է…" },
  "metrics.updatedAt": {
    en: "Data as of {0}",
    ru: "Данные на {0}",
    am: "Տվյալները՝ {0} դրությամբ",
  },
  "metrics.yandexLag": {
    en: "Yandex aggregates visits with a few minutes' delay. A brand-new visit may not be counted yet.",
    ru: "Яндекс агрегирует визиты с задержкой в несколько минут. Самый свежий визит может быть ещё не учтён.",
    am: "Yandex-ը այցերը հավաքագրում է մի քանի րոպե ուշացումով։ Ամենավերջին այցը կարող է դեռ հաշվառված չլինել։",
  },
  "metrics.visits": { en: "Visits", ru: "Визиты", am: "Այցեր" },
  "metrics.users": { en: "Visitors", ru: "Посетители", am: "Այցելուներ" },
  "metrics.bounceRate": { en: "Bounce rate", ru: "Отказы", am: "Մերժումներ" },
  "metrics.pageDepth": { en: "Pages / visit", ru: "Глубина просмотра", am: "Էջ / այց" },
  "metrics.avgVisit": { en: "Avg. visit", ru: "Время на сайте", am: "Այցի միջին տևողություն" },
  "metrics.trend": { en: "Trend", ru: "Динамика", am: "Դինամիկա" },
  "metrics.sources": { en: "Traffic sources", ru: "Источники трафика", am: "Թրաֆիկի աղբյուրներ" },
  "metrics.noData": {
    en: "No data for this period yet.",
    ru: "За этот период данных пока нет.",
    am: "Այս ժամանակահատվածի տվյալներ դեռ չկան։",
  },
  "metrics.sampled": {
    en: "Figures are estimated (Yandex sampling).",
    ru: "Данные приблизительные (сэмплирование Яндекса).",
    am: "Տվյալները մոտավոր են (Yandex-ի ընտրանք)։",
  },
  "metrics.notConfigured": {
    en: "Analytics is not set up for this environment",
    ru: "Аналитика не настроена для этого окружения",
    am: "Անալիտիկան կարգավորված չէ այս միջավայրի համար",
  },
  "metrics.notConfiguredSub": {
    en: "Add the counter and token to this environment's settings, then reload.",
    ru: "Добавьте счётчик и токен в настройки этого окружения и обновите страницу.",
    am: "Ավելացրեք հաշվիչը և տոկենը այս միջավայրի կարգավորումներում, ապա վերաբեռնեք։",
  },
  "metrics.unavailable": {
    en: "Yandex.Metrica is unavailable",
    ru: "Яндекс.Метрика недоступна",
    am: "Yandex.Metrica-ն հասանելի չէ",
  },
  "metrics.unavailableSub": {
    en: "The service did not respond. The figures will return on their own once it does.",
    ru: "Сервис не ответил. Данные появятся сами, как только он снова заработает.",
    am: "Ծառայությունը չպատասխանեց։ Տվյալները կհայտնվեն ինքնաբերաբար, երբ այն պատասխանի։",
  },
  "metrics.loadFailed": {
    en: "Could not load metrics",
    ru: "Не удалось загрузить метрики",
    am: "Չհաջողվեց բեռնել մետրիկան",
  },
  "metrics.loadFailedSub": {
    en: "Check the connection to the server and try again.",
    ru: "Проверьте связь с сервером и попробуйте ещё раз.",
    am: "Ստուգեք կապը սերվերի հետ և փորձեք կրկին։",
  },
  "metrics.retry": { en: "Retry", ru: "Повторить", am: "Կրկնել" },
  // Backend monitoring dashboard (Laravel Pulse) — admin only.
  "home.menu.pulse": {
    en: "Monitoring",
    ru: "Мониторинг",
    am: "Մոնիտորինգ",
  },
  "home.menu.pulseSub": {
    en: "Server load, disk, queries",
    ru: "Нагрузка, диск, запросы",
    am: "Ծանրաբեռնվածություն, սկավառակ, հարցումներ",
  },
  "home.menu.pulseOpening": {
    en: "Opening in browser…",
    ru: "Открываю в браузере…",
    am: "Բացվում է դիտարկիչում…",
  },
  "home.menu.pulseError": {
    en: "Could not open monitoring. Try again.",
    ru: "Не удалось открыть мониторинг. Попробуйте ещё раз.",
    am: "Չհաջողվեց բացել մոնիտորինգը։ Փորձեք կրկին։",
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
    am: "Agent-ի թարմացումներ",
  },
  "agentUpdates.title": {
    en: "Kiosk agent updates",
    ru: "Обновления агента-киоска",
    am: "Կիոսկի Agent-ի թարմացումներ",
  },
  "agentUpdates.subtitle": {
    en: "Roll out a new version of the kiosk agent to every gaming PC in your branches. Updates download in the background and prompt the cashier on the lock screen.",
    ru: "Обновите версию агента на всех игровых ПК ваших филиалов. Обновление скачается фоном и предложит кассиру перезапустить на экране блокировки.",
    am: "Թարմացրեք Agent-ը ձեր մասնաճյուղերի բոլոր խաղային համակարգիչներում։ Թարմացումը ներբեռնվում է ֆոնում, և գանձապահը հուշում է ստանում կողպման էկրանին։",
  },
  "agentUpdates.loading": {
    en: "Loading agent status…",
    ru: "Загрузка состояния агента…",
    am: "Բեռնվում է Agent-ի վիճակը…",
  },
  "agentUpdates.currentVersion": {
    en: "Current version",
    ru: "Текущая версия",
    am: "Ընթացիկ տարբերակը",
  },
  "agentUpdates.latestVersion": {
    en: "Latest version",
    ru: "Новая версия",
    am: "Վերջին տարբերակը",
  },
  "agentUpdates.upToDate": {
    en: "Every agent is up to date.",
    ru: "Все агенты обновлены.",
    am: "Բոլոր Agent-ները թարմացված են։",
  },
  "agentUpdates.hasUpdate": {
    en: "A newer version is available. Install it for every agent in your branches.",
    ru: "Доступна новая версия. Установите её на всех агентах ваших филиалов.",
    am: "Հասանելի է նոր տարբերակ։ Տեղադրեք այն ձեր մասնաճյուղերի բոլոր Agent-ներում։",
  },
  "agentUpdates.promoteBtn": {
    en: "Install new version on all agents and restart",
    ru: "Установить новую версию на всех агентах и перезапустить",
    am: "Տեղադրել նոր տարբերակը բոլոր Agent-ներում և վերագործարկել",
  },
  "agentUpdates.promoting": {
    en: "Applying…",
    ru: "Применяем…",
    am: "Կիրառվում է…",
  },
  "agentUpdates.cannotPromote": {
    en: "Cannot apply. Backend could not fetch the latest release from GitHub.",
    ru: "Не удалось применить. Backend не смог получить релиз с GitHub.",
    am: "Չհաջողվեց կիրառել։ Սերվերը չկարողացավ ստանալ վերջին թողարկումը GitHub-ից։",
  },
  "agentUpdates.approvedVersion": {
    en: "Approved by administrator",
    ru: "Одобрено администратором",
    am: "Հաստատված է ադմինիստրատորի կողմից",
  },
  "agentUpdates.notApprovedYet": {
    en: "No update has been approved by an administrator yet. You will be able to roll it out to your branches once it is approved.",
    ru: "Администратор ещё не одобрил обновление. Как только он его одобрит, вы сможете применить его в своих филиалах.",
    am: "Ադմինիստրատորը դեռ չի հաստատել թարմացումը։ Հաստատվելուց հետո կկարողանաք կիրառել այն ձեր մասնաճյուղերում։",
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
    am: "Ուղարկվեց ձեր համակարգիչներին։ Յուրաքանչյուր Agent ֆոնում կներբեռնի թարմացումը և կառաջարկի գանձապահին վերագործարկել։",
  },
  "agentUpdates.noVenuePcs": {
    en: "No PCs are registered in your branches yet.",
    ru: "В ваших филиалах пока нет зарегистрированных ПК.",
    am: "Ձեր մասնաճյուղերում դեռ գրանցված համակարգիչներ չկան։",
  },
  // ── CRUD toast messages (top-right notifications) ──────────────────────
  "toast.generic.created": { en: "Created successfully", ru: "Успешно создано", am: "Հաջողությամբ ստեղծվեց" },
  "toast.generic.updated": { en: "Updated successfully", ru: "Успешно изменено", am: "Հաջողությամբ թարմացվեց" },
  "toast.generic.saved":   { en: "Saved successfully", ru: "Успешно сохранено", am: "Հաջողությամբ պահպանվեց" },
  "toast.generic.deleted": { en: "Deleted successfully", ru: "Успешно удалено", am: "Հաջողությամբ ջնջվեց" },
  "toast.generic.error":   { en: "Something went wrong", ru: "Что-то пошло не так", am: "Ինչ-որ բան սխալ գնաց" },

  // Failure sentences, resolved by the Toaster whenever a toast is red. Kept
  // per-action rather than per-entity: one line that reads correctly for a
  // place, a device or a company beats forty lines nobody keeps translated.
  "toast.fail.created":   { en: "Could not create", ru: "Не удалось создать", am: "Չհաջողվեց ստեղծել" },
  "toast.fail.updated":   { en: "Could not update", ru: "Не удалось изменить", am: "Չհաջողվեց թարմացնել" },
  "toast.fail.saved":     { en: "Could not save", ru: "Не удалось сохранить", am: "Չհաջողվեց պահպանել" },
  "toast.fail.deleted":   { en: "Could not delete", ru: "Не удалось удалить", am: "Չհաջողվեց ջնջել" },
  "toast.fail.blocked":   { en: "Could not block", ru: "Не удалось заблокировать", am: "Չհաջողվեց արգելափակել" },
  "toast.fail.unblocked": { en: "Could not unblock", ru: "Не удалось разблокировать", am: "Չհաջողվեց ապաարգելափակել" },
  "toast.fail.prices":    { en: "Could not save prices", ru: "Не удалось сохранить цены", am: "Չհաջողվեց պահպանել գները" },

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
  // An additional item (chips, a cue) — said as what it is, not as "product".
  "toast.additionalItem.created": { en: "Additional item created", ru: "Дополнительный предмет создан", am: "Լրացուցիչ իրը ստեղծվեց" },
  "toast.additionalItem.updated": { en: "Additional item updated", ru: "Дополнительный предмет обновлён", am: "Լրացուցիչ իրը թարմացվեց" },
  "toast.additionalItem.deleted": { en: "Additional item deleted", ru: "Дополнительный предмет удалён", am: "Լրացուցիչ իրը ջնջվեց" },

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
  "toast.expense.created": { en: "Expense added", ru: "Расход добавлен", am: "Ծախսն ավելացվեց" },
  "toast.expense.updated": { en: "Expense updated", ru: "Расход обновлён", am: "Ծախսը թարմացվեց" },
  "toast.expense.deleted": { en: "Expense deleted", ru: "Расход удалён", am: "Ծախսը ջնջվեց" },
  "toast.package.created": { en: "Tariff created", ru: "Тариф создан", am: "Սակագինը ստեղծվեց" },
  "toast.package.updated": { en: "Tariff updated", ru: "Тариф обновлён", am: "Սակագինը թարմացվեց" },
  "toast.package.deleted": { en: "Tariff deleted", ru: "Тариф удалён", am: "Սակագինը ջնջվեց" },

  "toast.tournament.created": { en: "Tournament created", ru: "Турнир создан", am: "Մրցաշարը ստեղծվեց" },
  "toast.tournament.updated": { en: "Tournament updated", ru: "Турнир обновлён", am: "Մրցաշարը թարմացվեց" },
  "toast.tournament.deleted": { en: "Tournament deleted", ru: "Турнир удалён", am: "Մրցաշարը ջնջվեց" },

  "updates.title": {
    en: "Desktop app updates",
    ru: "Обновления десктоп-приложений",
    am: "Դեսքթոփ հավելվածների թարմացումներ",
  },
  "updates.checkBtn": {
    en: "Check for updates",
    ru: "Проверить наличие обновлений",
    am: "Ստուգել թարմացումները",
  },
  "updates.promoteBtn": {
    en: "Apply updates to all installations",
    ru: "Внести обновления во всех приложениях",
    am: "Կիրառել թարմացումները բոլոր տեղադրումներում",
  },
  "updates.checking": { en: "Checking…", ru: "Проверяем…", am: "Ստուգվում է…" },
  "updates.promoting": { en: "Applying…", ru: "Применяем…", am: "Կիրառվում է…" },
  "updates.noUpdates": { en: "All apps are up to date.", ru: "Обновлений нет.", am: "Բոլոր հավելվածները թարմացված են։" },
  "updates.hasUpdates": {
    en: "Updates available. Apply to roll out to all partner installations.",
    ru: "Доступны обновления. Нажмите, чтобы применить их во всех инсталляциях у партнёров.",
    am: "Կան թարմացումներ։ Կիրառեք՝ գործընկերների բոլոր տեղադրումներում տարածելու համար։",
  },
  "updates.appPanel": { en: "Staff panel", ru: "Десктоп для персонала", am: "Աշխատակազմի վահանակ" },
  "updates.appAgent": { en: "Kiosk agent", ru: "Агент-киоск", am: "Կիոսկի Agent" },
  "updates.colCurrent": { en: "Current version", ru: "Текущая версия", am: "Ընթացիկ տարբերակը" },
  "updates.colAvailable": { en: "Latest on GitHub", ru: "Последняя на GitHub", am: "Վերջինը GitHub-ում" },
  "updates.colStatus": { en: "Status", ru: "Статус", am: "Կարգավիճակ" },
  "updates.statusUpToDate": { en: "Up to date", ru: "Актуально", am: "Թարմացված է" },
  "updates.statusUpdateAvailable": { en: "Update available", ru: "Доступно обновление", am: "Հասանելի թարմացում" },
  "updates.statusNoPromoted": { en: "Not promoted yet", ru: "Не опубликовано", am: "Դեռ չի հրապարակվել" },
  "updates.statusError": { en: "Error", ru: "Ошибка", am: "Սխալ" },
  "updates.localTitle": { en: "This installation", ru: "Эта установка", am: "Այս տեղադրումը" },
  "updates.localIdle": { en: "No active update operation.", ru: "Активного обновления нет.", am: "Ակտիվ թարմացում չկա։" },
  "updates.localChecking": { en: "Checking GitHub for a newer version…", ru: "Проверяем GitHub на новую версию…", am: "Ստուգում ենք GitHub-ը նոր տարբերակի համար…" },
  "updates.localAvailable": { en: "Found v{0}. Downloading…", ru: "Найдена v{0}. Загружаем…", am: "Գտնվեց v{0}։ Ներբեռնվում է…" },
  "updates.localDownloading": { en: "Downloading {0}%…", ru: "Загрузка {0}%…", am: "Ներբեռնվում է՝ {0}%…" },
  "updates.localDownloaded": { en: "v{0} is ready. Click Install & restart.", ru: "v{0} готова. Нажмите «Установить и перезапустить».", am: "v{0}-ը պատրաստ է։ Սեղմեք «Տեղադրել և վերագործարկել»։" },
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
    am: "Ձեր դեսքթոփ հավելվածի համար նոր թարմացում կա։",
  },
  "updates.toastAgent": {
    en: "You have a new update for your kiosk locker.",
    ru: "У вас есть новое обновление для вашего блокировщика.",
    am: "Կիոսկի Agent-ի համար նոր թարմացում կա։",
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
    am: "{0} տարբերակը ներբեռնվել է։ Վերագործարկեք հավելվածը՝ թարմացումն ավարտելու համար։",
  },
  "updates.readyModalRestart": {
    en: "Restart application",
    ru: "Перезапустить приложение",
    am: "Վերագործարկել հավելվածը",
  },
  "updates.cannotPromote": {
    en: "Cannot apply. Backend could not fetch the latest release from GitHub. Check the GH_RELEASES_REPO_* env vars on the server.",
    ru: "Не удалось применить. Backend не смог получить релиз с GitHub. Проверьте переменные GH_RELEASES_REPO_* на сервере.",
    am: "Չհաջողվեց կիրառել։ Սերվերը չկարողացավ ստանալ վերջին թողարկումը GitHub-ից։ Ստուգեք GH_RELEASES_REPO_* փոփոխականները սերվերում։",
  },

  // ─── i18n audit fixes (2026-05-30): previously hardcoded strings ───
  "error.invalidBranchId": { en: "Invalid branch id.", ru: "Неверный ID филиала.", am: "Մասնաճյուղի սխալ ID։" },
  "error.invalidCompanyId": { en: "Invalid company id.", ru: "Неверный ID компании.", am: "Ընկերության սխալ ID։" },
  "error.invalidTournamentId": { en: "Invalid tournament id.", ru: "Неверный ID турнира.", am: "Մրցաշարի սխալ ID։" },
  "branch.rating": { en: "Rating", ru: "Рейтинг", am: "Վարկանիշ" },

  // BranchEdit overview
  "branchEdit.title": { en: "Branch · {0}", ru: "Филиал · {0}", am: "Մասնաճյուղ · {0}" },
  "branchEdit.editInfo": { en: "Edit info", ru: "Изменить данные", am: "Խմբագրել տվյալները" },
  "branchEdit.confirmDelete": { en: "Delete this branch and all related data?", ru: "Удалить этот филиал и все связанные данные?", am: "Ջնջե՞լ այս մասնաճյուղը և դրա հետ կապված բոլոր տվյալները։" },

  // CompanyBranches list
  "companyBranches.title": { en: "Branches of company №{0}", ru: "Филиалы компании №{0}", am: "№{0} ընկերության մասնաճյուղերը" },
  "companyBranches.back": { en: "← Back to company", ru: "← Назад к компании", am: "← Վերադառնալ ընկերության էջ" },
  "companyBranches.newBranch": { en: "+ New branch", ru: "+ Новый филиал", am: "+ Նոր մասնաճյուղ" },

  // Working-hours form title
  "openDays.title": { en: "Working hours · {0}", ru: "Часы работы · {0}", am: "Աշխատանքային ժամեր · {0}" },

  // TournamentDetails rows
  "tournamentDetails.end": { en: "End", ru: "Конец", am: "Ավարտ" },
  "tournamentDetails.players": { en: "Players", ru: "Игроки", am: "Խաղացողներ" },

  // ErrorBoundary
  "errorBoundary.title": { en: "Something went wrong", ru: "Что-то пошло не так", am: "Ինչ-որ բան սխալ գնաց" },
  "errorBoundary.tryAgain": { en: "Try again", ru: "Повторить", am: "Կրկնել" },
  "errorBoundary.reload": { en: "Reload app", ru: "Перезапустить приложение", am: "Վերաբեռնել հավելվածը" },

  // CommissionInput
  "commission.label": { en: "Commission percent", ru: "Процент комиссии", am: "Միջնորդավճարի տոկոս" },
  "commission.hint": { en: "0–100%. Stored locally on this device.", ru: "0–100%. Хранится локально на этом устройстве.", am: "0–100%։ Պահվում է միայն այս սարքում։" },

  // PcForm
  "pcForm.macAddress": { en: "MAC address", ru: "MAC-адрес", am: "MAC հասցե" },

  // Emergency unlock PIN (BranchUnlockPinCard)
  "unlockPin.title": { en: "Emergency unlock PIN", ru: "PIN экстренного разблокирования", am: "Արտակարգ ապակողպման PIN" },
  "unlockPin.desc": { en: "The cashier can enter this PIN right on a locked PC if the link to the panel or server is lost. Works even offline. A 4–6 digit PIN.", ru: "Кассир сможет ввести этот PIN прямо на заблокированном ПК, если связь с панелью или сервером пропала. Работает даже офлайн. PIN из 4–6 цифр.", am: "Գանձապահը կարող է մուտքագրել այս PIN-ը անմիջապես կողպված համակարգչի վրա, եթե վահանակի կամ սերվերի հետ կապը կորել է։ Աշխատում է նույնիսկ անցանց։ PIN՝ 4–6 թվանշան։" },
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
  "unlockPin.saved": { en: "Saved.", ru: "Сохранено.", am: "Պահպանված է։" },

  // CompanyBillingCard
  "billing.title": { en: "Billing", ru: "Оплата", am: "Վճարում" },
  "billing.markPaidConfirm": { en: "Mark {0} as paid? This shifts the next-due date by one month.", ru: "Отметить {0} как оплачено? Дата следующего платежа сдвинется на месяц.", am: "Նշե՞լ {0}-ը որպես վճարված։ Հաջորդ վճարման ամսաթիվը կտեղափոխվի մեկ ամսով։" },
  "billing.notDeployed": { en: "Billing endpoints not deployed yet.", ru: "Эндпоинты оплаты ещё не развёрнуты.", am: "Վճարման endpoint-ները դեռ տեղադրված չեն։" },
  "billing.noInfo": { en: "No billing info.", ru: "Нет данных об оплате.", am: "Վճարման տվյալներ չկան։" },
  "billing.commissionRate": { en: "Commission rate", ru: "Ставка комиссии", am: "Միջնորդավճարի դրույք" },
  "billing.lastPaid": { en: "Last paid", ru: "Последняя оплата", am: "Վերջին վճարում" },
  "billing.nextDue": { en: "Next due", ru: "Следующий платёж", am: "Հաջորդ վճարում" },
  "billing.timeLeft": { en: "Time left", ru: "Осталось", am: "Մնացել է" },
  "billing.overdueBy": { en: "Overdue by {0} day(s)", ru: "Просрочено на {0} дн.", am: "Ուշացած {0} օրով" },
  "billing.daysLeft": { en: "{0} day(s) left", ru: "Осталось {0} дн.", am: "Մնացել է {0} օր" },
  "billing.adminReminder": { en: "⚠ Company {0} must pay for the program in {1} day(s).", ru: "⚠ Компания {0} должна оплатить программу через {1} дн.", am: "⚠ {0} ընկերությունը {1} օրից պետք է վճարի ծրագրի համար։" },
  "billing.ownerReminder": { en: "⚠ In {0} day(s) you must pay Cyber Place.", ru: "⚠ Через {0} дн. вам нужно оплатить Cyber Place.", am: "⚠ {0} օրից դուք պետք է վճարեք Cyber Place-ին։" },
  "billing.adminOverdue": { en: "Company {0} is overdue. Status will switch to pending automatically.", ru: "Компания {0} просрочила оплату. Статус переключится на «ожидание» автоматически.", am: "{0} ընկերությունն ուշացրել է վճարումը։ Կարգավիճակն ավտոմատ կդառնա «Սպասման մեջ»։" },
  "billing.ownerOverdue": { en: "Payment to Cyber Place is overdue. Your company status has been set to pending.", ru: "Оплата Cyber Place просрочена. Статус вашей компании переведён в «ожидание».", am: "Cyber Place-ին վճարումն ուշացած է։ Ձեր ընկերության կարգավիճակը փոխվել է «Սպասման մեջ»։" },
  "billing.markPaidHint": { en: "Marking as paid sets last paid = now and next due = +1 month.", ru: "Отметка «оплачено» ставит последнюю оплату = сейчас и следующий платёж = +1 месяц.", am: "«Վճարված» նշելիս վերջին վճարումը դառնում է այսօր, իսկ հաջորդը՝ +1 ամիս։" },
  "billing.markPaid": { en: "Mark as paid", ru: "Отметить оплаченным", am: "Նշել որպես վճարված" },

  // PosTerminal

  // Company country picker + TIN validation
  "company.selectCountry": { en: "select country", ru: "выберите страну", am: "ընտրեք երկիր" },
  "tin.invalid": { en: "Invalid TIN for the selected country (e.g. {0})", ru: "Неверный ИНН для выбранной страны (например: {0})", am: "Սխալ ՀՎՀՀ ընտրված երկրի համար (օրինակ՝ {0})" },
  "tin.invalidGeneric": { en: "Invalid TIN format", ru: "Неверный формат ИНН", am: "ՀՎՀՀ-ի սխալ ձևաչափ" },
  "company.selectCountryFirst": { en: "Select a country first", ru: "Сначала выберите страну", am: "Սկզբում ընտրեք երկիր" },

  "product.errors.name": {
    en: "Enter a name",
    ru: "Введите название",
    am: "Մուտքագրեք անվանումը",
  },

  "tariff.errors.allNames": {
    en: "Fill in the name in every language",
    ru: "Заполните название на всех языках",
    am: "Լրացրեք անվանումը բոլոր լեզուներով",
  },

  // Multilingual name fields — one row per language, auto-translated from the
  // language of the interface.
  "multilang.translating": { en: "translating…", ru: "переводим…", am: "թարգմանվում է…" },
  "multilang.autoPlaceholder": {
    en: "filled automatically",
    ru: "заполнится автоматически",
    am: "կլրացվի ավտոմատ",
  },
  "multilang.edited": { en: "edited by hand", ru: "изменено вручную", am: "ձեռքով խմբագրված" },
  "multilang.reset": { en: "restore auto", ru: "вернуть автоперевод", am: "վերականգնել ավտոթարգմանությունը" },
  // Why the whole field could not be translated. Deliberately actionable for
  // an operator, and free of anything that would confuse a cashier.
  "multilang.reason.not_configured": {
    en: "Automatic translation is not set up on this server. Fill the languages in by hand.",
    ru: "Автоперевод не настроен на сервере. Заполните языки вручную.",
    am: "Ավտոթարգմանությունը սերվերում կարգավորված չէ։ Լրացրեք լեզուները ձեռքով։",
  },
  "multilang.reason.auth": {
    en: "The translation service rejected the server's credentials. Contact the administrator.",
    ru: "Сервис перевода отклонил доступ сервера. Обратитесь к администратору.",
    am: "Թարգմանության ծառայությունը մերժեց սերվերի մուտքի տվյալները։ Դիմեք ադմինիստրատորին։",
  },
  "multilang.reason.quota": {
    en: "The translation quota is used up. Fill the languages in by hand for now.",
    ru: "Лимит переводов исчерпан. Пока заполните языки вручную.",
    am: "Թարգմանության սահմանաչափը սպառված է։ Առայժմ լրացրեք ձեռքով։",
  },
  // Shown INSTEAD of the one above when the service told us how long to wait.
  // The distinction matters: one asks the user to do the work themselves, the
  // other asks them to do nothing at all.
  "multilang.reason.quota_retry": {
    en: "Too many translations at once. Retrying automatically in",
    ru: "Слишком много переводов подряд. Повторим автоматически через",
    am: "Չափազանց շատ թարգմանություններ միաժամանակ։ Նոր փորձ՝",
  },
  "multilang.seconds": { en: "s", ru: "с", am: "վրկ" },
  "multilang.reason.provider_error": {
    en: "The translation service is unavailable right now. Fill the languages in by hand.",
    ru: "Сервис перевода сейчас недоступен. Заполните языки вручную.",
    am: "Թարգմանության ծառայությունն այժմ հասանելի չէ։ Լրացրեք ձեռքով։",
  },

  "multilang.failed": {
    en: "could not translate. Please fill in",
    ru: "не удалось перевести. Заполните вручную",
    am: "չհաջողվեց թարգմանել։ Լրացրեք ձեռքով",
  },

  // Language selection flow — first run (before login) and the workspace step
  // an owner/manager sees before their cabinet opens.
  "lang.firstRun.title": {
    en: "Choose your language",
    ru: "Выберите язык",
    am: "Ընտրեք լեզուն",
  },
  "lang.firstRun.subtitle": {
    en: "Pick the language you want to work in. You can change it any time in Settings.",
    ru: "Выберите язык, на котором хотите работать. Его можно сменить в любой момент в настройках.",
    am: "Ընտրեք լեզուն, որով ցանկանում եք աշխատել։ Այն կարող եք փոխել ցանկացած պահի կարգավորումներում։",
  },
  "lang.account.title": {
    en: "Language for your account",
    ru: "Язык вашего аккаунта",
    am: "Ձեր հաշվի լեզուն",
  },
  "lang.account.subtitle": {
    en: "This is a one-time setup. Your account will always open in this language, on any computer.",
    ru: "Это разовая настройка. Ваш аккаунт всегда будет открываться на этом языке, на любом компьютере.",
    am: "Սա միանվագ կարգավորում է։ Ձեր հաշիվը միշտ կբացվի այս լեզվով՝ ցանկացած համակարգչի վրա։",
  },
  "lang.continue": { en: "Continue", ru: "Продолжить", am: "Շարունակել" },
  "lang.changeLaterHint": {
    en: "You can change the language later in Settings.",
    ru: "Язык можно изменить позже в настройках.",
    am: "Լեզուն կարող եք փոխել ավելի ուշ՝ կարգավորումներում։",
  },

  // Automatic translation of staff-authored content. Staff type a value once;
  // the backend fills in the other UI languages in the background. These
  // strings are what makes that process visible instead of magic.
  "i18n.sourceLocale": { en: "Input language", ru: "Язык ввода", am: "Մուտքագրման լեզու" },
  "i18n.sourceLocale.hint": {
    en: "Type once. The other languages are filled in automatically.",
    ru: "Введите один раз. Остальные языки заполнятся автоматически.",
    am: "Մուտքագրեք մեկ անգամ։ Մնացած լեզուները կլրացվեն ավտոմատ։",
  },
  "i18n.translations": { en: "Translations", ru: "Переводы", am: "Թարգմանություններ" },
  "i18n.pending": { en: "translating…", ru: "переводится…", am: "թարգմանվում է…" },
  "i18n.overrideHint": {
    en: "Editing a language here locks it. Automatic translation will not overwrite your wording.",
    ru: "Правка языка здесь блокирует его. Автоперевод не перезапишет вашу формулировку.",
    am: "Այստեղ լեզուն խմբագրելը կողպում է այն։ Ավտոթարգմանությունը չի փոխարինի ձեր ձևակերպումը։",
  },
  "i18n.status.pending": { en: "translating…", ru: "переводится…", am: "թարգմանվում է…" },
  "i18n.status.pending.hint": {
    en: "Queued for translation. The value will appear shortly.",
    ru: "В очереди на перевод. Значение появится в ближайшее время.",
    am: "Հերթում է թարգմանության համար։ Արժեքը շուտով կհայտնվի։",
  },
  "i18n.status.ready": { en: "translated", ru: "переведено", am: "թարգմանված է" },
  "i18n.status.ready.hint": {
    en: "Up to date with the source text.",
    ru: "Соответствует исходному тексту.",
    am: "Համապատասխանում է սկզբնական տեքստին։",
  },
  "i18n.status.stale": { en: "updating…", ru: "обновляется…", am: "թարմացվում է…" },
  "i18n.status.stale.hint": {
    en: "The source changed. The previous translation is shown until the new one is ready.",
    ru: "Исходник изменился. Показывается прежний перевод, пока не готов новый.",
    am: "Սկզբնական տեքստը փոխվել է։ Ցուցադրվում է նախորդ թարգմանությունը, մինչև նորը պատրաստ լինի։",
  },
  "i18n.status.failed": { en: "translation failed", ru: "ошибка перевода", am: "թարգմանության սխալ" },
  "i18n.status.failed.hint": {
    en: "Automatic translation did not succeed. The previous value is still shown; you can fill it in by hand.",
    ru: "Автоперевод не удался. Прежнее значение показывается; можно заполнить вручную.",
    am: "Ավտոթարգմանությունը չհաջողվեց։ Նախորդ արժեքը ցուցադրվում է․ կարող եք լրացնել ձեռքով։",
  },
  "i18n.status.needs_review": { en: "needs review", ru: "нужна проверка", am: "պահանջում է ստուգում" },
  "i18n.status.needs_review.hint": {
    en: "You edited this language by hand and the source has changed since. Automatic translation will not touch it.",
    ru: "Вы правили этот язык вручную, а исходник с тех пор изменился. Автоперевод его не тронет.",
    am: "Դուք ձեռքով խմբագրել եք այս լեզուն, իսկ սկզբնական տեքստն այդ ընթացքում փոխվել է։ Ավտոթարգմանությունն այն չի փոխի։",
  },
  "i18n.status.skipped": { en: "not translated", ru: "без перевода", am: "առանց թարգմանության" },
  "i18n.status.skipped.hint": {
    en: "Brand names, codes and numbers are copied as-is instead of being translated.",
    ru: "Бренды, коды и числа копируются как есть, без перевода.",
    am: "Ապրանքանիշերը, կոդերը և թվերը պատճենվում են այնպես, ինչպես կան՝ առանց թարգմանության։",
  },
  // ── Security (admin, `/security`) ─────────────────────────────────────────
  "nav.security": { en: "Security", ru: "Безопасность", am: "Անվտանգություն" },
  "security.title": { en: "Security", ru: "Безопасность", am: "Անվտանգություն" },
  "security.tab.ips": { en: "Blocked IPs", ru: "Заблокированные IP", am: "Արգելափակված IP հասցեներ" },
  "security.tab.countries": { en: "Blocked countries", ru: "Заблокированные страны", am: "Արգելափակված երկրներ" },
  "security.tab.activity": { en: "IP activity", ru: "Активность IP", am: "IP ակտիվություն" },
  // Security → IP activity (2026-09-30): the address the SERVER saw. Never "exact location".
  "ipActivity.about": {
    en: "The address the Cyber Place server saw for each connection. Behind a VPN or proxy it is that service's address, not the person's. Country and city are approximate.",
    ru: "Адрес, который сервер Cyber Place увидел при подключении. Если человек за VPN или прокси, это адрес VPN или прокси, а не его собственный. Страна и город определяются приблизительно.",
    am: "Հասցեն, որը Cyber Place-ի սերվերը տեսել է միացման ժամանակ։ VPN-ի կամ պրոքսիի դեպքում դա այդ ծառայության հասցեն է, ոչ թե անձի։ Երկիրը և քաղաքը մոտավոր են։",
  },
  "ipActivity.search": { en: "Search", ru: "Поиск", am: "Որոնում" },
  "ipActivity.searchHint": {
    en: "IP, name, email, country, city, provider or AS number",
    ru: "IP, имя, email, страна, город, провайдер или номер AS",
    am: "IP, անուն, էլ. հասցե, երկիր, քաղաք, մատակարար կամ AS համար",
  },
  "ipActivity.all": { en: "All", ru: "Все", am: "Բոլորը" },
  "ipActivity.from": { en: "Last seen from", ru: "Последний визит с", am: "Վերջին այցը սկսած" },
  "ipActivity.to": { en: "Last seen to", ru: "Последний визит по", am: "Վերջին այցը մինչև" },
  "ipActivity.sort": { en: "Sort", ru: "Сортировка", am: "Դասավորել" },
  "ipActivity.sort.last_seen": { en: "Last seen, newest first", ru: "Последний визит, сначала новые", am: "Վերջին այցը, նորերը առաջինը" },
  "ipActivity.sort.first_seen": { en: "First seen, newest first", ru: "Первый визит, сначала новые", am: "Առաջին այցը, նորերը առաջինը" },
  "ipActivity.sort.visits": { en: "Most activity", ru: "Больше всего активности", am: "Ամենաշատ ակտիվությունը" },
  "ipActivity.clearFilter": { en: "Remove filter", ru: "Убрать фильтр", am: "Հեռացնել զտիչը" },
  "ipActivity.onlyThisUser": { en: "Show only this user", ru: "Показать только этого пользователя", am: "Ցույց տալ միայն այս օգտատիրոջը" },
  "ipActivity.empty": { en: "No connections match.", ru: "Подключений не найдено.", am: "Միացումներ չեն գտնվել։" },
  "ipActivity.unknown": { en: "Unknown", ru: "Не определено", am: "Անհայտ" },
  "ipActivity.anonymous": { en: "Anonymous", ru: "Аноним", am: "Անանուն" },
  "ipActivity.player": { en: "Mobile player", ru: "Игрок (мобильное приложение)", am: "Խաղացող (բջջային հավելված)" },
  "ipActivity.telegramServers": { en: "Telegram servers", ru: "Серверы Telegram", am: "Telegram-ի սերվերներ" },
  "ipActivity.col.user": { en: "User", ru: "Пользователь", am: "Օգտատեր" },
  "ipActivity.col.ip": { en: "IP address", ru: "IP-адрес", am: "IP հասցե" },
  "ipActivity.col.country": { en: "Country", ru: "Страна", am: "Երկիր" },
  "ipActivity.col.city": { en: "City", ru: "Город", am: "Քաղաք" },
  "ipActivity.col.source": { en: "Source", ru: "Источник", am: "Աղբյուր" },
  "ipActivity.col.firstSeen": { en: "First seen", ru: "Первый визит", am: "Առաջին այց" },
  "ipActivity.col.lastSeen": { en: "Last seen", ru: "Последний визит", am: "Վերջին այց" },
  // Not "visits": the backend counts 10-minute windows with any activity in
  // them, not requests or sign-ins (2026-10-07).
  "ipActivity.col.visits": { en: "Activity", ru: "Активность", am: "Ակտիվություն" },
  "ipActivity.col.visitsHint": { en: "Number of 10-minute periods of activity", ru: "Число 10-минутных периодов активности", am: "Ակտիվության 10 րոպեանոց ժամանակահատվածների քանակը" },
  "ipActivity.source.website": { en: "Website", ru: "Сайт", am: "Կայք" },
  "ipActivity.source.mobile": { en: "Mobile", ru: "Мобильное приложение", am: "Բջջային հավելված" },
  "ipActivity.source.desktop": { en: "Desktop", ru: "Десктоп", am: "Համակարգչային հավելված" },
  "ipActivity.source.owner_web": { en: "Owner Web", ru: "Веб-кабинет", am: "Վեբ կաբինետ" },
  "ipActivity.source.telegram": { en: "Telegram", ru: "Telegram", am: "Telegram" },
  "ipActivity.source.telegram_bot": { en: "Telegram bot", ru: "Бот Telegram", am: "Telegram բոտ" },



  "security.col.created": { en: "Created", ru: "Создано", am: "Ստեղծվել է" },
  "security.col.actions": { en: "Actions", ru: "Действия", am: "Գործողություններ" },
  "security.col.addedBy": { en: "Added by", ru: "Кто добавил", am: "Ով է ավելացրել" },




  "security.note": { en: "Note", ru: "Заметка", am: "Նշում" },
  "security.yourIp": { en: "Your IP:", ru: "Ваш IP:", am: "Ձեր IP հասցեն:" },
  "security.yourCountry": { en: "Your country:", ru: "Ваша страна:", am: "Ձեր երկիրը:" },

  "security.ips.address": { en: "IP address or range", ru: "IP-адрес или диапазон", am: "IP հասցե կամ միջակայք" },
  "security.ips.addressHint": { en: "203.0.113.7 or 203.0.113.0/24", ru: "203.0.113.7 или 203.0.113.0/24", am: "203.0.113.7 կամ 203.0.113.0/24" },
  "security.ips.block": { en: "Block", ru: "Заблокировать", am: "Արգելափակել" },
  "security.ips.unblock": { en: "Unblock", ru: "Разблокировать", am: "Ապաարգելափակել" },
  // Blocked by the system itself (2026-10-01).
  "security.ips.autoThreat": { en: "System: attack requests", ru: "Система: атакующие запросы", am: "Համակարգ՝ հարձակողական հարցումներ" },
  "security.ips.autoLogin": { en: "System: password guessing", ru: "Система: подбор пароля", am: "Համակարգ՝ գաղտնաբառի ընտրություն" },
  "security.ips.confirmDelete": {
    en: "Unblock {0}?\nRequests from it will be accepted again.",
    ru: "Разблокировать {0}?\nЗапросы с него снова будут приниматься.",
    am: "Ապաարգելափակե՞լ {0}։\nԴրանից հարցումները կրկին կընդունվեն։",
  },

  "security.countries.country": { en: "Country", ru: "Страна", am: "Երկիր" },
  "security.countries.search": { en: "Start typing a country", ru: "Начните вводить страну", am: "Սկսեք մուտքագրել երկիրը" },
  "security.countries.block": { en: "Block", ru: "Заблокировать", am: "Արգելափակել" },
  "security.countries.unblock": { en: "Unblock", ru: "Разблокировать", am: "Ապաարգելափակել" },
  "security.countries.unknown": { en: "not detected", ru: "не определена", am: "չի որոշվել" },
  "security.countries.geoipMissing": {
    en: "The GeoIP database is not installed on the server. Country rules are saved but not enforced until it is.",
    ru: "На сервере не установлена база GeoIP. Правила по странам сохраняются, но не действуют, пока её не установят.",
    am: "Սերվերում GeoIP տվյալների բազան տեղադրված չէ։ Երկրների կանոնները պահպանվում են, բայց չեն գործում, քանի դեռ այն չի տեղադրվել։",
  },
  "security.countries.confirmDelete": {
    en: "Unblock {0}?\nRequests from this country will be accepted again.",
    ru: "Разблокировать {0}?\nЗапросы из этой страны снова будут приниматься.",
    am: "Ապաարգելափակե՞լ {0}։\nԱյս երկրից հարցումները կրկին կընդունվեն։",
  },


  "toast.blockedIp.created": { en: "IP blocked", ru: "IP заблокирован", am: "IP հասցեն արգելափակվեց" },
  "toast.blockedIp.deleted": { en: "IP unblocked", ru: "IP разблокирован", am: "IP հասցեն ապաարգելափակվեց" },
  "toast.blockedCountry.created": { en: "Country blocked", ru: "Страна заблокирована", am: "Երկիրն արգելափակվեց" },
  "toast.blockedCountry.deleted": { en: "Country unblocked", ru: "Страна разблокирована", am: "Երկիրն ապաարգելափակվեց" },
  "toast.loginLockout.deleted": { en: "Sign-in unlocked", ru: "Вход разблокирован", am: "Մուտքն ապաարգելափակվեց" },

  // Sign-ins closed after too many wrong passwords (2026-10-07), under Blocked IPs.
  "security.locks.title": { en: "Locked sign-ins", ru: "Заблокированные входы", am: "Արգելափակված մուտքեր" },
  "security.locks.hint": {
    en: "Sign-in closed after too many wrong passwords. It opens by itself when the time runs out, or at once with Unlock.",
    ru: "Вход закрыт после слишком многих неверных паролей. Он откроется сам, когда истечёт время, или сразу кнопкой «Разблокировать».",
    am: "Մուտքը փակվել է չափազանց շատ սխալ գաղտնաբառերից հետո։ Այն կբացվի ինքնաշխատ՝ ժամկետի ավարտին, կամ անմիջապես՝ «Ապաարգելափակել» կոճակով։",
  },
  "security.locks.account": { en: "Account", ru: "Аккаунт", am: "Հաշիվ" },
  "security.locks.unknownAccount": { en: "No such account", ru: "Такого аккаунта нет", am: "Այդպիսի հաշիվ չկա" },
  "security.locks.client": { en: "Where", ru: "Где", am: "Որտեղ" },
  "security.locks.attempts": { en: "Wrong passwords", ru: "Неверных паролей", am: "Սխալ գաղտնաբառեր" },
  "security.locks.until": { en: "Locked until", ru: "Закрыт до", am: "Փակ է մինչև" },
  "security.locks.alsoIp": { en: "The address is blocked too", ru: "Адрес тоже заблокирован", am: "Հասցեն նույնպես արգելափակված է" },
  "security.locks.empty": { en: "No locked sign-ins.", ru: "Заблокированных входов нет.", am: "Արգելափակված մուտքեր չկան։" },
  "security.locks.confirmUnlock": {
    en: "Unlock sign-in for {0}?\nThey can sign in again at once.",
    ru: "Разблокировать вход для {0}?\nВойти можно будет сразу.",
    am: "Ապաարգելափակե՞լ մուտքը {0}-ի համար։\nՀնարավոր կլինի անմիջապես մուտք գործել։",
  },
  // State views (src/components/ui/state): defaults, overridden per screen.
  "state.empty.title": { en: "Nothing here yet", ru: "Здесь пока пусто", am: "Այստեղ դեռ դատարկ է" },
  "state.empty.description": { en: "When something is added, it appears here.", ru: "Когда что-то появится, оно будет здесь.", am: "Երբ ինչ-որ բան ավելացվի, այն կհայտնվի այստեղ։" },
  "state.noResults.title": { en: "Nothing found", ru: "Ничего не найдено", am: "Ոչինչ չի գտնվել" },
  "state.noResults.description": { en: "Try changing the search or filters.", ru: "Попробуйте изменить запрос или фильтры.", am: "Փորձեք փոխել որոնումը կամ զտիչները։" },
  "state.notFound.title": { en: "Page not found", ru: "Страница не найдена", am: "Էջը չի գտնվել" },
  "state.notFound.description": { en: "It looks like this page no longer exists or the address is wrong.", ru: "Похоже, такой страницы больше нет или адрес указан неверно.", am: "Կարծես այս էջն այլևս չկա, կամ հասցեն սխալ է նշված։" },
  "state.notFound.back": { en: "Go back", ru: "Вернуться назад", am: "Վերադառնալ" },
  "state.error.title": { en: "Could not load the data", ru: "Не удалось загрузить данные", am: "Չհաջողվեց բեռնել տվյալները" },
  "state.error.description": { en: "Something went wrong. Try again in a moment.", ru: "Что-то пошло не так. Попробуйте ещё раз чуть позже.", am: "Ինչ-որ բան այն չգնաց։ Փորձեք կրկին մի փոքր ուշ։" },
  "state.offline.title": { en: "No connection", ru: "Нет соединения", am: "Կապ չկա" },
  "state.offline.description": { en: "Check the internet connection and try again.", ru: "Проверьте подключение к интернету и попробуйте снова.", am: "Ստուգեք ինտերնետ կապը և փորձեք կրկին։" },
  "state.offline.notice": { en: "No connection. The last loaded data is shown.", ru: "Нет соединения. Показаны последние загруженные данные.", am: "Կապ չկա։ Ցուցադրված են վերջին բեռնված տվյալները։" },
  "state.stale.offline": { en: "No connection. This is the last loaded data.", ru: "Нет соединения. Это последние загруженные данные.", am: "Կապ չկա։ Սրանք վերջին բեռնված տվյալներն են։" },
  "state.stale.failed": { en: "Could not refresh. This is the last loaded data.", ru: "Не удалось обновить. Это последние загруженные данные.", am: "Չհաջողվեց թարմացնել։ Սրանք վերջին բեռնված տվյալներն են։" },
  "state.success.title": { en: "Done", ru: "Готово", am: "Պատրաստ է" },
  "state.success.description": { en: "Everything went through.", ru: "Всё прошло успешно.", am: "Ամեն ինչ հաջողությամբ ավարտվեց։" },
  "branchesList.state.emptyTitle": { en: "No branches yet", ru: "Филиалов пока нет", am: "Մասնաճյուղեր դեռ չկան" },
  "branchesList.state.emptyDescription": { en: "No branches have been added so far.", ru: "На данный момент филиалы не добавлены.", am: "Այս պահին մասնաճյուղեր ավելացված չեն։" },
  "branchesList.state.errorTitle": { en: "Could not load branches", ru: "Не удалось загрузить филиалы", am: "Չհաջողվեց բեռնել մասնաճյուղերը" },
  "companyBranches.state.emptyTitle": { en: "This company has no branches yet", ru: "У этой компании пока нет филиалов", am: "Այս ընկերությունը դեռ մասնաճյուղեր չունի" },
  "companyBranches.state.emptyDescription": { en: "The company's branches appear here once they are added.", ru: "Филиалы компании появятся здесь, когда их добавят.", am: "Ընկերության մասնաճյուղերը կհայտնվեն այստեղ, երբ դրանք ավելացվեն։" },
  "bookings.state.emptyTitle": { en: "No bookings yet", ru: "Бронирований пока нет", am: "Ամրագրումներ դեռ չկան" },
  "bookings.state.emptyDescription": { en: "Bookings made by players appear here.", ru: "Здесь появятся бронирования игроков.", am: "Այստեղ կհայտնվեն խաղացողների ամրագրումները։" },
  "bookings.state.errorTitle": { en: "Could not load bookings", ru: "Не удалось загрузить бронирования", am: "Չհաջողվեց բեռնել ամրագրումները" },
  "games.state.emptyTitle": { en: "No games yet", ru: "Игр пока нет", am: "Խաղեր դեռ չկան" },
  "games.state.emptyDescription": { en: "No games have been added to the catalogue so far.", ru: "На данный момент в каталог не добавлено ни одной игры.", am: "Այս պահին կատալոգում խաղեր ավելացված չեն։" },
  "games.state.errorTitle": { en: "Could not load games", ru: "Не удалось загрузить игры", am: "Չհաջողվեց բեռնել խաղերը" },
  "branchGames.state.emptyTitle": { en: "This branch has no games yet", ru: "У этого филиала пока нет игр", am: "Այս մասնաճյուղը դեռ խաղեր չունի" },
  "branchGames.state.emptyDescription": { en: "Add the games this branch offers, and they appear here.", ru: "Добавьте игры, которые есть в филиале, и они появятся здесь.", am: "Ավելացրեք մասնաճյուղի խաղերը, և դրանք կհայտնվեն այստեղ։" },
  "companies.state.emptyTitle": { en: "No companies yet", ru: "Компаний пока нет", am: "Ընկերություններ դեռ չկան" },
  "companies.state.emptyDescription": { en: "No companies have been registered so far.", ru: "На данный момент ни одна компания не зарегистрирована.", am: "Այս պահին ոչ մի ընկերություն գրանցված չէ։" },
  "companies.state.errorTitle": { en: "Could not load companies", ru: "Не удалось загрузить компании", am: "Չհաջողվեց բեռնել ընկերությունները" },
  "managers.state.emptyTitle": { en: "No managers yet", ru: "Менеджеров пока нет", am: "Մենեջերներ դեռ չկան" },
  "managers.state.emptyDescription": { en: "Managers you add appear here.", ru: "Добавленные менеджеры появятся здесь.", am: "Ավելացված մենեջերները կհայտնվեն այստեղ։" },
  "managers.state.errorTitle": { en: "Could not load managers", ru: "Не удалось загрузить менеджеров", am: "Չհաջողվեց բեռնել մենեջերներին" },
  "tournaments.state.emptyTitle": { en: "No tournaments yet", ru: "Турниров пока нет", am: "Մրցաշարեր դեռ չկան" },
  "tournaments.state.emptyDescription": { en: "No tournaments have been created so far.", ru: "На данный момент нет созданных турниров.", am: "Այս պահին ստեղծված մրցաշարեր չկան։" },
  "tournaments.state.errorTitle": { en: "Could not load tournaments", ru: "Не удалось загрузить турниры", am: "Չհաջողվեց բեռնել մրցաշարերը" },
  "owners.state.emptyTitle": { en: "No owners yet", ru: "Владельцев пока нет", am: "Սեփականատերեր դեռ չկան" },
  "owners.state.emptyDescription": { en: "Company owners appear here once they are added.", ru: "Владельцы компаний появятся здесь, когда их добавят.", am: "Ընկերությունների սեփականատերերը կհայտնվեն այստեղ, երբ ավելացվեն։" },
  "owners.state.noResultsDescription": { en: "Nobody matches this name, email or company. Try another search.", ru: "Никто не подходит под это имя, почту или компанию. Попробуйте изменить запрос.", am: "Այս անունով, էլ. փոստով կամ ընկերությամբ ոչ ոք չի գտնվել։ Փորձեք փոխել որոնումը։" },
  "owners.state.errorTitle": { en: "Could not load owners", ru: "Не удалось загрузить владельцев", am: "Չհաջողվեց բեռնել սեփականատերերին" },
  "owner.state.errorTitle": { en: "Could not load this owner", ru: "Не удалось загрузить владельца", am: "Չհաջողվեց բեռնել սեփականատիրոջը" },
  "owner.state.notFoundTitle": { en: "Owner not found", ru: "Владелец не найден", am: "Սեփականատերը չի գտնվել" },
  "owner.state.notFoundDescription": { en: "This owner may have been deleted, or the address is wrong.", ru: "Возможно, владелец удалён или адрес указан неверно.", am: "Հնարավոր է՝ սեփականատերը ջնջվել է, կամ հասցեն սխալ է։" },
  "owner.state.noCompanyTitle": { en: "No company yet", ru: "Компании пока нет", am: "Ընկերություն դեռ չկա" },
  "owner.state.noCompanyDescription": { en: "This owner is not linked to any company.", ru: "Этот владелец не привязан ни к одной компании.", am: "Այս սեփականատերը կապված չէ որևէ ընկերության։" },
  "owner.state.noBranchesTitle": { en: "This company has no branches yet", ru: "У этой компании пока нет филиалов", am: "Այս ընկերությունը դեռ մասնաճյուղեր չունի" },
  "products.state.emptyTitle": { en: "No products yet", ru: "Товаров пока нет", am: "Ապրանքներ դեռ չկան" },
  "products.state.emptyDescription": { en: "Products added to this branch appear here and at the till.", ru: "Товары филиала появятся здесь и в кассе, когда их добавят.", am: "Մասնաճյուղի ապրանքները կհայտնվեն այստեղ և դրամարկղում, երբ ավելացվեն։" },
  "products.state.emptyAdditionalTitle": { en: "No additional items yet", ru: "Дополнительных предметов пока нет", am: "Լրացուցիչ իրեր դեռ չկան" },
  "products.state.emptyAdditionalDescription": { en: "These are chips, a cue or a racket handed out with the seat.", ru: "Это фишки, кий, ракетка, которые выдаются вместе с местом.", am: "Դրանք ֆիշկաներ, կիյ կամ ռակետ են, որոնք տրվում են տեղի հետ։" },
  "products.state.noResultsDescription": { en: "No product has this name or category. Try another search.", ru: "Нет товара с таким названием или категорией. Попробуйте изменить запрос.", am: "Այս անունով կամ կատեգորիայով ապրանք չկա։ Փորձեք փոխել որոնումը։" },
  "products.state.errorTitle": { en: "Could not load products", ru: "Не удалось загрузить товары", am: "Չհաջողվեց բեռնել ապրանքները" },
  "members.state.emptyTitle": { en: "No customers yet", ru: "Клиентов пока нет", am: "Հաճախորդներ դեռ չկան" },
  "members.state.emptyDescription": { en: "Customer cards created at this branch appear here.", ru: "Здесь появятся карты клиентов этого филиала.", am: "Այստեղ կհայտնվեն այս մասնաճյուղի հաճախորդների քարտերը։" },
  "members.state.noResultsDescription": { en: "No customer matches this name, phone, email or card. Try another search.", ru: "Нет клиента с таким именем, телефоном, почтой или картой. Попробуйте изменить запрос.", am: "Այս անունով, հեռախոսով, էլ. փոստով կամ քարտով հաճախորդ չկա։ Փորձեք փոխել որոնումը։" },
  "members.state.errorTitle": { en: "Could not load customers", ru: "Не удалось загрузить клиентов", am: "Չհաջողվեց բեռնել հաճախորդներին" },
  "memberCard.state.errorTitle": { en: "Could not load this customer", ru: "Не удалось загрузить клиента", am: "Չհաջողվեց բեռնել հաճախորդին" },
  "memberCard.state.notFoundTitle": { en: "Customer not found", ru: "Клиент не найден", am: "Հաճախորդը չի գտնվել" },
  "memberCard.state.notFoundDescription": { en: "This card may have been deleted, or the address is wrong.", ru: "Возможно, карта удалена или адрес указан неверно.", am: "Հնարավոր է՝ քարտը ջնջվել է, կամ հասցեն սխալ է։" },
  "memberCard.state.noTxTitle": { en: "No transactions yet", ru: "Операций пока нет", am: "Գործարքներ դեռ չկան" },
  "memberCard.state.noTxDescription": { en: "Top-ups and spending on this card appear here.", ru: "Здесь появятся пополнения и списания по карте.", am: "Այստեղ կհայտնվեն քարտի համալրումներն ու ծախսերը։" },
  "pcs.state.emptyTitle": { en: "No PCs registered yet", ru: "ПК пока не зарегистрированы", am: "Համակարգիչներ դեռ գրանցված չեն" },
  "pcs.state.emptyDescription": { en: "Register the first computer, and its Agent connects with the token shown after saving.", ru: "Зарегистрируйте первый компьютер: его Agent подключится по токену, который появится после сохранения.", am: "Գրանցեք առաջին համակարգիչը, և դրա Agent-ը կմիանա պահպանելուց հետո ցուցադրվող թոքենով։" },
  "pcs.state.errorTitle": { en: "Could not load PCs", ru: "Не удалось загрузить ПК", am: "Չհաջողվեց բեռնել համակարգիչները" },
  "pcs.state.placesErrorTitle": { en: "Could not load this branch's places", ru: "Не удалось загрузить места филиала", am: "Չհաջողվեց բեռնել մասնաճյուղի տեղերը" },
  "branchPlaces.state.emptyTitle": { en: "No places yet", ru: "Мест пока нет", am: "Տեղեր դեռ չկան" },
  "branchPlaces.state.emptyDescription": { en: "Press \"New place\" to add the first one.", ru: "Нажмите «Новое место», чтобы добавить первое.", am: "Սեղմեք «Նոր տեղ»՝ առաջինն ավելացնելու համար։" },
  "branchPlaces.state.errorTitle": { en: "Could not load places", ru: "Не удалось загрузить места", am: "Չհաջողվեց բեռնել տեղերը" },
  "session.state.errorTitle": { en: "Could not load Active Places", ru: "Не удалось загрузить активные места", am: "Չհաջողվեց բեռնել ակտիվ տեղերը" },
  "session.state.noPcsTitle": { en: "No devices registered yet", ru: "Устройства пока не зарегистрированы", am: "Սարքեր դեռ գրանցված չեն" },
  "session.state.noPcsDescription": { en: "Computers and consoles registered in Computers appear here as seats.", ru: "Компьютеры и консоли из раздела «Компьютеры» появятся здесь как места.", am: "«Համակարգիչներ» բաժնում գրանցված սարքերը կհայտնվեն այստեղ որպես տեղեր։" },
  "live.state.emptyTitle": { en: "No places yet", ru: "Мест пока нет", am: "Տեղեր դեռ չկան" },
  "live.state.emptyDescription": { en: "Places created in this branch appear here with their live status.", ru: "Места филиала появятся здесь вместе с их текущим статусом.", am: "Մասնաճյուղի տեղերը կհայտնվեն այստեղ՝ իրենց ընթացիկ կարգավիճակով։" },
  "history.state.errorTitle": { en: "Could not load the session history", ru: "Не удалось загрузить историю сессий", am: "Չհաջողվեց բեռնել սեսիաների պատմությունը" },
  "history.state.noResultsTitle": { en: "No sessions in this period", ru: "За выбранный период сессий нет", am: "Ընտրված ժամանակահատվածում սեսիաներ չկան" },
  "history.state.noResultsDescription": { en: "Try another date range or staff member.", ru: "Попробуйте изменить период или сотрудника.", am: "Փորձեք փոխել ժամանակահատվածը կամ աշխատակցին։" },
  "history.state.timelineErrorTitle": { en: "Could not load this session's activity", ru: "Не удалось загрузить действия по сессии", am: "Չհաջողվեց բեռնել սեսիայի գործողությունները" },
  "history.state.actorsFailed": { en: "Could not load the staff list. Retry", ru: "Не удалось загрузить сотрудников. Повторить", am: "Չհաջողվեց բեռնել աշխատակիցներին։ Կրկնել" },
  "session.state.packagesErrorTitle": { en: "Could not load time packages", ru: "Не удалось загрузить пакеты времени", am: "Չհաջողվեց բեռնել ժամային փաթեթները" },
  "session.state.relocateErrorTitle": { en: "Could not load free seats", ru: "Не удалось загрузить свободные места", am: "Չհաջողվեց բեռնել ազատ տեղերը" },
  "till.state.emptyTitle": { en: "No sales today yet", ru: "Сегодня продаж ещё не было", am: "Այսօր դեռ վաճառք չի եղել" },
  "till.state.emptyDescription": { en: "Sales made at the till appear here.", ru: "Здесь появятся продажи через кассу.", am: "Այստեղ կհայտնվեն դրամարկղով կատարված վաճառքները։" },
  "till.state.errorTitle": { en: "Could not load today's sales", ru: "Не удалось загрузить продажи за сегодня", am: "Չհաջողվեց բեռնել այսօրվա վաճառքները" },
  "subscribers.state.emptyTitle": { en: "No subscribers yet", ru: "Подписчиков пока нет", am: "Բաժանորդներ դեռ չկան" },
  "subscribers.state.emptyDescription": { en: "Players who follow this branch in the app appear here.", ru: "Здесь появятся игроки, подписавшиеся на филиал в приложении.", am: "Այստեղ կհայտնվեն հավելվածում մասնաճյուղին բաժանորդագրված խաղացողները։" },
  "subscribers.state.noResultsDescription": { en: "Nobody has this first or last name. Try another search.", ru: "Нет подписчиков с таким именем или фамилией. Попробуйте изменить запрос.", am: "Այս անունով կամ ազգանունով բաժանորդ չկա։ Փորձեք փոխել որոնումը։" },
  "subscribers.state.errorTitle": { en: "Could not load subscribers", ru: "Не удалось загрузить подписчиков", am: "Չհաջողվեց բեռնել բաժանորդներին" },
  "tariffs.state.emptyTitle": { en: "No tariffs yet", ru: "Тарифов пока нет", am: "Սակագներ դեռ չկան" },
  "tariffs.state.emptyDescription": { en: "Add at least one to start sessions on a package.", ru: "Добавьте хотя бы один, чтобы запускать сессии по пакету.", am: "Ավելացրեք առնվազն մեկը՝ փաթեթով սեսիաներ սկսելու համար։" },
  "expenses.state.emptyTitle": { en: "No services tracked yet", ru: "Сервисов пока нет", am: "Ծառայություններ դեռ չկան" },
  "expenses.state.emptyDescription": { en: "Add the subscriptions and services you pay for, and reminders arrive before each charge.", ru: "Добавьте подписки и сервисы, за которые платите, и перед каждым списанием придёт напоминание.", am: "Ավելացրեք վճարովի բաժանորդագրություններն ու ծառայությունները, և յուրաքանչյուր գանձումից առաջ կստանաք հիշեցում։" },
  "expenses.state.errorTitle": { en: "Could not load services", ru: "Не удалось загрузить сервисы", am: "Չհաջողվեց բեռնել ծառայությունները" },
  "revenue.state.noCompanyTitle": { en: "No company linked to this account", ru: "К этому аккаунту не привязана компания", am: "Այս հաշվին ընկերություն կապված չէ" },
  "revenue.state.noCompanyDescription": { en: "Revenue appears here once the account belongs to a company.", ru: "Выручка появится здесь, когда аккаунт будет привязан к компании.", am: "Եկամուտը կհայտնվի այստեղ, երբ հաշիվը կապվի ընկերության հետ։" },
  "myCompany.state.noCompanyDescription": { en: "Once a company is linked to this account, its page opens here.", ru: "Когда к аккаунту привяжут компанию, здесь откроется её страница.", am: "Երբ հաշվին ընկերություն կապվի, այստեղ կբացվի դրա էջը։" },
  "company.state.errorTitle": { en: "Could not load this company", ru: "Не удалось загрузить компанию", am: "Չհաջողվեց բեռնել ընկերությունը" },
  "company.state.notFoundTitle": { en: "Company not found", ru: "Компания не найдена", am: "Ընկերությունը չի գտնվել" },
  "company.state.notFoundDescription": { en: "This company may have been deleted, or the address is wrong.", ru: "Возможно, компания удалена или адрес указан неверно.", am: "Հնարավոր է՝ ընկերությունը ջնջվել է, կամ հասցեն սխալ է։" },
  "booking.state.errorTitle": { en: "Could not load this booking", ru: "Не удалось загрузить бронирование", am: "Չհաջողվեց բեռնել ամրագրումը" },
  "booking.state.notFoundTitle": { en: "Booking not found", ru: "Бронирование не найдено", am: "Ամրագրումը չի գտնվել" },
  "booking.state.notFoundDescription": { en: "This booking may have been removed, or the address is wrong.", ru: "Возможно, бронирование удалено или адрес указан неверно.", am: "Հնարավոր է՝ ամրագրումը հեռացվել է, կամ հասցեն սխալ է։" },
  "branch.state.errorTitle": { en: "Could not load this branch", ru: "Не удалось загрузить филиал", am: "Չհաջողվեց բեռնել մասնաճյուղը" },
  "branch.state.notFoundTitle": { en: "Branch not found", ru: "Филиал не найден", am: "Մասնաճյուղը չի գտնվել" },
  "branch.state.notFoundDescription": { en: "This branch may have been deleted, or the address is wrong.", ru: "Возможно, филиал удалён или адрес указан неверно.", am: "Հնարավոր է՝ մասնաճյուղը ջնջվել է, կամ հասցեն սխալ է։" },
  "tournament.state.errorTitle": { en: "Could not load this tournament", ru: "Не удалось загрузить турнир", am: "Չհաջողվեց բեռնել մրցաշարը" },
  "tournament.state.notFoundTitle": { en: "Tournament not found", ru: "Турнир не найден", am: "Մրցաշարը չի գտնվել" },
  "tournament.state.notFoundDescription": { en: "This tournament may have been deleted, or the address is wrong.", ru: "Возможно, турнир удалён или адрес указан неверно.", am: "Հնարավոր է՝ մրցաշարը ջնջվել է, կամ հասցեն սխալ է։" },
  "registrations.state.emptyTitle": { en: "No registrations yet", ru: "Регистраций пока нет", am: "Գրանցումներ դեռ չկան" },
  "registrations.state.emptyDescription": { en: "Players and guests who sign up in the app appear here.", ru: "Здесь появятся игроки и гости, записавшиеся через приложение.", am: "Այստեղ կհայտնվեն հավելվածով գրանցված խաղացողներն ու հյուրերը։" },
  "registrations.state.noResultsDescription": { en: "Nobody has this first or last name. Try another search.", ru: "Нет участников с таким именем или фамилией. Попробуйте изменить запрос.", am: "Այս անունով կամ ազգանունով մասնակից չկա։ Փորձեք փոխել որոնումը։" },
  "registrations.state.errorTitle": { en: "Could not load participants", ru: "Не удалось загрузить участников", am: "Չհաջողվեց բեռնել մասնակիցներին" },
  "registrations.state.removeFailed": { en: "Could not remove the registration. Try again.", ru: "Не удалось удалить регистрацию. Попробуйте ещё раз.", am: "Չհաջողվեց հեռացնել գրանցումը։ Փորձեք կրկին։" },
  "notifications.state.errorTitle": { en: "Could not load notifications", ru: "Не удалось загрузить уведомления", am: "Չհաջողվեց բեռնել ծանուցումները" },
  "notifications.state.emptyTitle": { en: "No notifications right now", ru: "Сейчас уведомлений нет", am: "Այս պահին ծանուցումներ չկան" },
  "notifications.state.bookingsEmptyDescription": { en: "New bookings, subscriptions and tournament sign-ups appear here.", ru: "Здесь появятся новые бронирования, подписки и записи на турниры.", am: "Այստեղ կհայտնվեն նոր ամրագրումները, բաժանորդագրություններն ու մրցաշարային գրանցումները։" },
  "notifications.state.billingEmptyDescription": { en: "Payment reminders appear here a few days before each due date.", ru: "Напоминания об оплате появятся здесь за несколько дней до срока.", am: "Վճարման հիշեցումները կհայտնվեն այստեղ ժամկետից մի քանի օր առաջ։" },
  "support.state.listErrorTitle": { en: "Could not load your support requests", ru: "Не удалось загрузить ваши обращения", am: "Չհաջողվեց բեռնել ձեր դիմումները" },
  "support.state.threadErrorTitle": { en: "Could not load this conversation", ru: "Не удалось загрузить переписку", am: "Չհաջողվեց բեռնել նամակագրությունը" },
  "support.state.noBranchesTitle": { en: "No branches to choose from", ru: "Нет филиалов для выбора", am: "Ընտրելու մասնաճյուղեր չկան" },
  "switchAccount.state.errorTitle": { en: "Could not load the accounts", ru: "Не удалось загрузить аккаунты", am: "Չհաջողվեց բեռնել հաշիվները" },
  "security.state.errorTitle": { en: "Could not load this list", ru: "Не удалось загрузить список", am: "Չհաջողվեց բեռնել ցանկը" },
  "security.ips.state.emptyTitle": { en: "No blocked IP addresses", ru: "Заблокированных IP-адресов нет", am: "Արգելափակված IP հասցեներ չկան" },
  "security.ips.state.emptyDescription": { en: "Addresses blocked by hand or by the system appear here.", ru: "Здесь появятся адреса, заблокированные вручную или системой.", am: "Այստեղ կհայտնվեն ձեռքով կամ համակարգի կողմից արգելափակված հասցեները։" },
  "security.countries.state.emptyTitle": { en: "No blocked countries", ru: "Заблокированных стран нет", am: "Արգելափակված երկրներ չկան" },
  "security.countries.state.emptyDescription": { en: "Connections from a country blocked here are refused.", ru: "Подключения из заблокированной здесь страны отклоняются.", am: "Այստեղ արգելափակված երկրից միացումները մերժվում են։" },
  // IP activity: device / OS (backend mirrors the enums)
  "ipActivity.col.device": { en: "Device", ru: "Устройство", am: "Սարք" },
  "ipActivity.col.os": { en: "OS", ru: "ОС", am: "ՕՀ" },
  "ipActivity.device.iphone": { en: "iPhone", ru: "iPhone", am: "iPhone" },
  "ipActivity.device.ipad": { en: "iPad", ru: "iPad", am: "iPad" },
  "ipActivity.device.android_phone": { en: "Android phone", ru: "Телефон Android", am: "Android հեռախոս" },
  "ipActivity.device.android_tablet": { en: "Android tablet", ru: "Планшет Android", am: "Android պլանշետ" },
  "ipActivity.device.windows_pc": { en: "Windows PC", ru: "ПК с Windows", am: "Windows համակարգիչ" },
  "ipActivity.device.mac": { en: "Mac", ru: "Mac", am: "Mac" },
  "ipActivity.device.linux_pc": { en: "Linux PC", ru: "ПК с Linux", am: "Linux համակարգիչ" },
  "ipActivity.device.chromebook": { en: "Chromebook", ru: "Chromebook", am: "Chromebook" },
  "ipActivity.os.ios": { en: "iOS", ru: "iOS", am: "iOS" },
  "ipActivity.os.ipados": { en: "iPadOS", ru: "iPadOS", am: "iPadOS" },
  "ipActivity.os.android": { en: "Android", ru: "Android", am: "Android" },
  "ipActivity.os.windows": { en: "Windows", ru: "Windows", am: "Windows" },
  "ipActivity.os.macos": { en: "macOS", ru: "macOS", am: "macOS" },
  "ipActivity.os.linux": { en: "Linux", ru: "Linux", am: "Linux" },
  "ipActivity.os.chromeos": { en: "ChromeOS", ru: "ChromeOS", am: "ChromeOS" },
  "ipActivity.state.errorTitle": { en: "Could not load the IP activity", ru: "Не удалось загрузить активность IP", am: "Չհաջողվեց բեռնել IP ակտիվությունը" },
  "ipActivity.state.emptyTitle": { en: "No connections recorded yet", ru: "Подключений пока не зафиксировано", am: "Միացումներ դեռ չեն գրանցվել" },
  "ipActivity.state.emptyDescription": { en: "Addresses appear here as people connect to Cyber Place.", ru: "Адреса появятся здесь, когда к Cyber Place начнут подключаться.", am: "Հասցեները կհայտնվեն այստեղ, երբ մարդիկ միանան Cyber Place-ին։" },
  // IP activity: network, browser and the details dialog (2026-10-07).
  "ipActivity.col.network": { en: "Provider / Network", ru: "Провайдер / Сеть", am: "Մատակարար / Ցանց" },
  "ipActivity.col.browser": { en: "Browser", ru: "Браузер", am: "Դիտարկիչ" },
  "ipActivity.col.region": { en: "Region", ru: "Регион", am: "Մարզ" },
  "ipActivity.notDetermined": { en: "Not determined", ru: "Не определено", am: "Որոշված չէ" },
  "ipActivity.onlyThisNetwork": { en: "Show only this network", ru: "Показать только эту сеть", am: "Ցույց տալ միայն այս ցանցը" },
  "ipActivity.openDetails": { en: "Show details", ru: "Показать подробности", am: "Ցույց տալ մանրամասները" },
  "ipActivity.browser.chrome": { en: "Chrome", ru: "Chrome", am: "Chrome" },
  "ipActivity.browser.edge": { en: "Edge", ru: "Edge", am: "Edge" },
  "ipActivity.browser.firefox": { en: "Firefox", ru: "Firefox", am: "Firefox" },
  "ipActivity.browser.safari": { en: "Safari", ru: "Safari", am: "Safari" },
  "ipActivity.browser.opera": { en: "Opera", ru: "Opera", am: "Opera" },
  "ipActivity.browser.samsung": { en: "Samsung Internet", ru: "Samsung Internet", am: "Samsung Internet" },
  "ipActivity.browser.electron": { en: "Electron", ru: "Electron", am: "Electron" },
  "ipActivity.browser.telegram": { en: "Telegram", ru: "Telegram", am: "Telegram" },
  "ipActivity.browser.cyberplace_app": { en: "Cyber Place app", ru: "Приложение Cyber Place", am: "Cyber Place հավելված" },
  "ipActivity.details.copyIp": { en: "Copy IP", ru: "Скопировать IP", am: "Պատճենել IP-ն" },
  "ipActivity.details.copied": { en: "Copied", ru: "Скопировано", am: "Պատճենվեց" },
  "ipActivity.details.errorTitle": { en: "Could not load the connection details", ru: "Не удалось загрузить подробности подключения", am: "Չհաջողվեց բեռնել միացման մանրամասները" },
  "ipActivity.details.notFoundTitle": { en: "This record no longer exists", ru: "Этой записи больше нет", am: "Այս գրառումն այլևս չկա" },
  "ipActivity.details.notFoundDescription": { en: "It was removed after the list was loaded.", ru: "Её удалили после загрузки списка.", am: "Այն հեռացվել է ցանկը բեռնելուց հետո։" },
  "ipActivity.details.noLocation": { en: "IP location not determined", ru: "Местоположение IP не определено", am: "IP հասցեի գտնվելու վայրը որոշված չէ" },
  "ipActivity.details.telegramNote": {
    en: "This IP address belongs to Telegram's servers, so the user's location is not available.",
    ru: "IP принадлежит серверам Telegram, поэтому местоположение пользователя недоступно.",
    am: "IP հասցեն պատկանում է Telegram-ի սերվերներին, ուստի օգտատիրոջ գտնվելու վայրը հասանելի չէ։",
  },
  "ipActivity.details.caption": {
    en: "Approximate location of the IP address: the centre of its network, accurate to about {0} km. This is not where the person is; behind a VPN it is the VPN's location.",
    ru: "Примерное местоположение IP-адреса: центр сети с радиусом точности около {0} км, а не местонахождение человека. При VPN это местоположение VPN.",
    am: "IP հասցեի մոտավոր գտնվելու վայրը՝ ցանցի կենտրոնը մոտ {0} կմ ճշտությամբ, այլ ոչ թե մարդու գտնվելու վայրը։ VPN-ի դեպքում սա VPN-ի գտնվելու վայրն է։",
  },
  "ipActivity.details.captionNoRadius": {
    en: "Approximate location of the IP address: the centre of its network, not where the person is. Behind a VPN it is the VPN's location.",
    ru: "Примерное местоположение IP-адреса: центр сети, а не местонахождение человека. При VPN это местоположение VPN.",
    am: "IP հասցեի մոտավոր գտնվելու վայրը՝ ցանցի կենտրոնը, այլ ոչ թե մարդու գտնվելու վայրը։ VPN-ի դեպքում սա VPN-ի գտնվելու վայրն է։",
  },
  "billing.state.errorTitle": { en: "Could not load billing", ru: "Не удалось загрузить данные об оплате", am: "Չհաջողվեց բեռնել վճարման տվյալները" },
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

/**
 * The language the panel is rendering in, for callers that must TELL the
 * server about it — the API client sends it as `X-App-Language` so server-side
 * sentences (validation errors, block refusals) come back in the same language
 * as the rest of the screen.
 */
export const getActiveLang = (): Lang => activeLang;
