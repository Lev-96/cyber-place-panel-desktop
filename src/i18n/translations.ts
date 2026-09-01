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
  "nav.dashboard": { en: "Dashboard", ru: "Панель", am: "Վահանակ" },
  "nav.branches": { en: "Branches", ru: "Филиалы", am: "Մասնաճյուղեր" },
  "nav.myBranch": { en: "My branch", ru: "Мой филиал", am: "Իմ մասնաճյուղը" },
  "nav.map": { en: "Map", ru: "Карта", am: "Քարտեզ" },
  "nav.bookings": { en: "Bookings", ru: "Бронирования", am: "Ամրագրումներ" },
  "nav.scan": { en: "Scan / Confirm", ru: "Сканировать", am: "Սկանավորել" },
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
    am: "Մոռացե՞լ եք",
  },

  // Common actions
  "action.save": { en: "Save", ru: "Сохранить", am: "Պահպանել" },
  "action.continue": { en: "Continue", ru: "Продолжить", am: "Շարունակել" },
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
  "action.back": { en: "Back", ru: "Назад", am: "Հետ" },

  // Sessions
  "session.start": { en: "Start session", ru: "Старт сессии", am: "Սկսել նիստը" },
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
  "ps5.discover.open": { en: "Find PlayStations", ru: "Найти PlayStation", am: "Գտնել PlayStation" },
  "ps5.discover.title": { en: "PlayStations on this network", ru: "PlayStation в этой сети", am: "PlayStation այս ցանցում" },
  "ps5.discover.hint": {
    en: "Scanned from this computer, not from the server.",
    ru: "Поиск идёт с этого компьютера, а не с сервера.",
    am: "Որոնումն այս համակարգչից է, ոչ թե սերվերից։",
  },
  "ps5.discover.none": {
    en: "Nothing answered. The consoles must be on the same network as this computer and switched on or resting.",
    ru: "Никто не ответил. Консоли должны быть в той же сети, что и этот компьютер, и быть включены или в режиме покоя.",
    am: "Ոչ ոք չպատասխանեց։ Կոնսոլները պետք է լինեն նույն ցանցում և միացված կամ քնած վիճակում։",
  },
  "ps5.discover.probed": { en: "Looked at", ru: "Опрошено", am: "Հարցվել է" },
  "ps5.discover.scanning": { en: "Searching…", ru: "Ищем…", am: "Որոնում…" },
  "ps5.discover.rescan": { en: "Search again", ru: "Искать снова", am: "Որոնել կրկին" },
  "ps5.discover.desktopOnly": {
    en: "Console search works only in the desktop app.",
    ru: "Поиск консолей работает только в десктопном приложении.",
    am: "Կոնսոլների որոնումն աշխատում է միայն desktop հավելվածում։",
  },
  "ps5.state.awake": { en: "On", ru: "Включена", am: "Միացված" },
  "ps5.state.rest": { en: "Resting", ru: "Режим покоя", am: "Քնած ռեժիմ" },
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
    am: "Բոլոր կոնսոլային տեղերն արդեն ունեն",
  },
  // Not the same thing as the line above, and telling an owner "every console
  // place already has one" when the branch has no console place at all sends
  // them looking for a place that does not exist.
  // The places that already have a console — including ones whose console is
  // nowhere on this network, which is the only way to free them up again.
  "ps5.bound.title": { en: "Places with a console", ru: "Места с привязанной приставкой", am: "Տեղեր՝ կապված կոնսոլով" },
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
    en: "This branch has no console place yet — create one first",
    ru: "В филиале ещё нет консольного места — сначала создайте его",
    am: "Մասնաճյուղում դեռ չկա կոնսոլային տեղ — նախ ստեղծեք այն",
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
    am: "Միացրեք կոնսոլը, բացեք Կարգավորումներ → Համակարգ → Հեռախաղ → «Կապել սարքը» և մուտքագրեք ցուցադրվող 8 թվանշանը։",
  },
  "ps5.pair.pin": { en: "8 digits from the console", ru: "8 цифр с экрана приставки", am: "8 թվանշան կոնսոլի էկրանից" },
  // The way through when Sony's page refuses the embedded window.
  "ps5.pair.browser": {
    en: "Sign in through your browser instead",
    ru: "Войти через обычный браузер",
    am: "Մուտք գործել սովորական դիտարկիչով",
  },
  "ps5.pair.browserSteps": {
    en: "Sign in there, then copy the address of the page it lands on and paste it below.",
    ru: "Войдите там, затем скопируйте адрес страницы, на которую вас перекинуло, и вставьте сюда.",
    am: "Մուտք գործեք այնտեղ, ապա պատճենեք էջի հասցեն, ուր ձեզ տեղափոխեց, և տեղադրեք ստորև։",
  },
  "ps5.pair.redirect": {
    en: "The address you were redirected to",
    ru: "Адрес, на который вас перекинуло",
    am: "Հասցեն, ուր ձեզ տեղափոխեց",
  },
  "ps5.pair.start": { en: "Pair", ru: "Сопрячь", am: "Զուգակցել" },
  "ps5.pair.working": { en: "Pairing…", ru: "Сопрягаем…", am: "Զուգակցում…" },
  "ps5.pair.done": { en: "Paired — waking and sleeping now work", ru: "Сопряжено — пробуждение и сон работают", am: "Զուգակցված է — արթնացումն ու քունը աշխատում են" },
  "ps5.pair.error.CANCELLED": { en: "Sign-in was closed", ru: "Вход отменён", am: "Մուտքը չեղարկվեց" },
  "ps5.pair.error.NOT_AWAKE": {
    en: "The console must be switched ON to pair — it cannot be paired from rest",
    ru: "Для сопряжения приставка должна быть ВКЛЮЧЕНА — из режима покоя не выйдет",
    am: "Զուգակցման համար կոնսոլը պետք է ՄԻԱՑՎԱԾ լինի — քնի ռեժիմից չի ստացվի",
  },
  "ps5.pair.error.BAD_PIN": {
    en: "The console did not accept that PIN — it expires, so take a fresh one",
    ru: "Приставка не приняла PIN — он одноразовый, возьмите новый с её экрана",
    am: "Կոնսոլը չընդունեց PIN-ը — այն ժամանակավոր է, վերցրեք նորը",
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
    en: "No OS keystore here — the key will work until the panel is closed, and is never written to disk",
    ru: "Хранилища ключей ОС здесь нет — ключ будет работать до закрытия панели и на диск не записывается",
    am: "Այստեղ ՕՀ բանալիների պահոց չկա — բանալին կաշխատի մինչև վահանակի փակումը և սկավառակին չի գրվում",
  },
  "ps5.key.savedForRun": {
    en: "Key held until the panel is closed",
    ru: "Ключ действует до закрытия панели",
    am: "Բանալին գործում է մինչև վահանակի փակումը",
  },
  "ps5.key.test": { en: "Test wake", ru: "Проверить пробуждение", am: "Ստուգել արթնացումը" },
  "ps5.key.testSent": {
    en: "Signal sent — the console should wake within a few seconds",
    ru: "Сигнал отправлен — приставка должна проснуться за несколько секунд",
    am: "Ազդանշանն ուղարկվեց — կոնսոլը պետք է արթնանա մի քանի վայրկյանում",
  },
  // The mistake this line exists to prevent: the eight digits on the console's
  // "Link Device" screen are a one-time PIN for pairing, not the key. The key is
  // what a Remote Play client is given once pairing completes, and the console
  // ignores a wake carrying anything else.
  "ps5.key.hint": {
    en: "NOT the 8-digit code on the console screen — that is a one-time pairing PIN. This is the registration key a Remote Play client receives after pairing. Stored encrypted on this computer, never sent to the server.",
    ru: "Это НЕ 8-значный код с экрана приставки — тот код одноразовый, для сопряжения. Нужен ключ регистрации, который клиент Remote Play получает после сопряжения. Хранится зашифрованным на этом компьютере и на сервер не уходит.",
    am: "Սա ՈՉ թե կոնսոլի էկրանի 8-նիշանոց կոդն է — այն միանվագ է, զուգակցման համար։ Պետք է գրանցման բանալին, որը Remote Play հաճախորդը ստանում է զուգակցումից հետո։ Պահվում է գաղտնագրված այս համակարգչում և սերվեր չի ուղարկվում։",
  },
  // The question the owner is asked when a console is on with no session.
  // Shown above the place, and only for an owner with more than one venue.
  // The console's own power, separate from the session. "Rest mode" and not
  // "off" because that is what the protocol actually does — a PlayStation has
  // no remote shutdown, and promising one on a button would be a lie.
  "ps5.power.on": { en: "Turn on", ru: "Включить", am: "Միացնել" },
  "ps5.power.off": { en: "To rest mode", ru: "В режим покоя", am: "Հանգստի ռեժիմ" },
  "ps5.power.working": { en: "Working…", ru: "Выполняем…", am: "Կատարվում է…" },
  "ps5.power.hint": {
    en: "The console only — it starts no session and bills nothing. A PlayStation cannot be switched off over the network; rest mode is its off.",
    ru: "Только приставка — сессия не начинается и деньги не считаются. Выключить PlayStation по сети нельзя, режим покоя — это её выключение.",
    am: "Միայն կոնսոլը — սեսիա չի սկսվում և գումար չի հաշվարկվում։ PlayStation-ը ցանցով անջատել հնարավոր չէ, հանգստի ռեժիմն է դրա անջատումը։",
  },
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
    am: "Դրա վրա ակտիվ սեսիա չկա։ Դուք ինքներդ եք միացրել:",
  },
  "ps5.wake.dialogCountdown": {
    en: "Goes back to rest in {s} s",
    ru: "Уйдёт в режим сна через {s} с",
    am: "Կանցնի քնի ռեժիմ {s} վրկ հետո",
  },
  "ps5.wake.yes": { en: "Yes, that was me", ru: "Да, это я", am: "Այո, ես էի" },
  "ps5.wake.no": { en: "No", ru: "Нет", am: "Ոչ" },
  // Suspending the protection while somebody works on a console.
  "ps5.maintenance.title": { en: "Maintenance", ru: "Обслуживание", am: "Սպասարկում" },
  "ps5.maintenance.hint": {
    en: "While it lasts, this console may stay on without a session.",
    ru: "Пока оно длится, приставка может быть включена без сессии.",
    am: "Քանի դեռ այն տևում է, կոնսոլը կարող է միացված մնալ առանց սեսիայի։",
  },
  "ps5.maintenance.start": { en: "Suspend for an hour", ru: "Приостановить на час", am: "Կասեցնել մեկ ժամով" },
  "ps5.maintenance.stop": { en: "Resume protection", ru: "Вернуть защиту", am: "Վերականգնել պաշտպանությունը" },
  "ps5.maintenance.until": { en: "Suspended until {t}", ru: "Приостановлено до {t}", am: "Կասեցված է մինչև {t}" },
  // Lifecycle, as the board shows it.
  "ps5.lifecycle.WAKING": { en: "Waking…", ru: "Просыпается…", am: "Արթնանում է…" },
  "ps5.lifecycle.GOING_TO_REST": { en: "Going to rest…", ru: "Уходит в сон…", am: "Անցնում է քնի…" },
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
    en: "The console says a Remote Play session is already in use — close it on the console or wait a moment",
    ru: "Приставка отвечает, что сессия Remote Play уже занята — закройте её на приставке или подождите немного",
    am: "Կոնսոլն ասում է, որ Remote Play սեսիան արդեն զբաղված է — փակեք այն կոնսոլի վրա կամ սպասեք",
  },
  "ps5.error.UNSUPPORTED_BY_TRANSPORT": {
    en: "This build cannot put a console to rest over the network",
    ru: "Эта сборка не умеет усыплять приставку по сети",
    am: "Այս տարբերակը չի կարող կոնսոլը քնեցնել ցանցով",
  },
  "ps5.error.WAKE_IGNORED": {
    en: "The console is ignoring the wake — switch on \"Enable Turning On PS5 from Network\" in its Power Saving settings",
    ru: "Приставка игнорирует пробуждение — включите на ней «Включение PS5 по сети» в настройках энергосбережения",
    am: "Կոնսոլն անտեսում է արթնացումը — միացրեք «Միացնել PS5-ը ցանցից» էներգախնայման կարգավորումներում",
  },
  "ps5.error.TRANSPORT_ERROR": {
    en: "Could not reach the console",
    ru: "Не удалось достучаться до приставки",
    am: "Չհաջողվեց հասնել կոնսոլին",
  },
  // What the protocol does NOT offer, said once, where the owner sets things up.
  "ps5.sleep.impossible": {
    en: "A console cannot be put to rest over the network — only woken. Use the console's own Power Saving timer for that.",
    ru: "Усыпить приставку по сети нельзя — только разбудить. Для сна используйте таймер энергосбережения самой приставки.",
    am: "Կոնսոլը ցանցով քնեցնել հնարավոր չէ — միայն արթնացնել։ Քնի համար օգտագործեք կոնսոլի էներգախնայման ժամաչափը։",
  },
  "nav.support": { en: "Support", ru: "Поддержка", am: "Աջակցություն" },
  "support.title": { en: "Support", ru: "Поддержка", am: "Աջակցություն" },
  "support.intro": {
    en: "Write to the Cyber Place support team. Your company, branch and role travel with the message — there is nothing to fill in.",
    ru: "Напишите в поддержку Cyber Place. Компания, филиал и роль передаются вместе с сообщением — заполнять ничего не нужно.",
    am: "Գրեք Cyber Place-ի աջակցության թիմին։ Ընկերությունը, մասնաճյուղը և դերը փոխանցվում են հաղորդագրության հետ:",
  },
  "support.conversations": { en: "Conversations", ru: "Обращения", am: "Դիմումներ" },
  "support.noConversations": {
    en: "No requests yet. Start one below.",
    ru: "Обращений пока нет. Создайте первое ниже.",
    am: "Դիմումներ դեռ չկան: Ստեղծեք առաջինը ներքևում:",
  },
  "support.newRequest": { en: "+ New request", ru: "+ Новое обращение", am: "+ Նոր դիմում" },
  "support.starting": { en: "Opening…", ru: "Открываем…", am: "Բացվում է…" },
  "support.pickConversation": {
    en: "Pick a conversation on the left.",
    ru: "Выберите обращение слева.",
    am: "Ընտրեք դիմումը ձախից:",
  },
  "support.emptyThread": {
    en: "Nothing here yet — describe the problem and we will pick it up.",
    ru: "Здесь пока пусто — опишите проблему, мы её получим.",
    am: "Այստեղ դեռ դատարկ է — նկարագրեք խնդիրը:",
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
    en: "The file is empty — it may not have been read correctly",
    ru: "Файл пустой — возможно, он не прочитался",
    am: "Ֆայլը դատարկ է — հնարավոր է՝ այն չի կարդացվել",
  },
  "support.file.tooMany": {
    en: "Too many files. Maximum: {0}",
    ru: "Слишком много файлов. Максимум: {0}",
    am: "Չափազանց շատ ֆայլ։ Առավելագույնը՝ {0}",
  },
  "support.file.totalTooLarge": {
    en: "The message is too heavy altogether. Maximum: {0} MB",
    ru: "Сообщение слишком тяжёлое целиком. Максимум: {0} МБ",
    am: "Հաղորդագրությունը չափազանց ծանր է։ Առավելագույնը՝ {0} ՄԲ",
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
    am: "Հաղորդագրությունը չուղարկվեց:",
  },
  "support.state.sending": { en: "Sending…", ru: "Отправляется…", am: "Ուղարկվում է…" },
  "support.state.queued": {
    en: "Saved — reaching support…",
    ru: "Сохранено — доставляем в поддержку…",
    am: "Պահպանված է — հասնում է աջակցությանը…",
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
    ru: "Обращения ведутся по филиалам — так поддержка сразу видит, о какой площадке речь.",
    am: "Դիմումները վարվում են ըստ մասնաճյուղերի, որպեսզի թիմը տեսնի, թե որ վայրի մասին է խոսքը:",
  },
  "support.searchBranch": { en: "Search a branch…", ru: "Поиск филиала…", am: "Որոնել մասնաճյուղ…" },
  "support.noBranchMatches": { en: "No branches found", ru: "Филиалы не найдены", am: "Մասնաճյուղեր չեն գտնվել" },
  "support.branchChange": { en: "Change branch", ru: "Сменить филиал", am: "Փոխել մասնաճյուղը" },
  "support.openThread": { en: "Open the chat", ru: "Открыть чат", am: "Բացել զրույցը" },
  "support.role.company_owner": { en: "Owner", ru: "Владелец", am: "Սեփականատեր" },
  "support.role.manager": { en: "Manager", ru: "Менеджер", am: "Մենեջեր" },
  "support.role.admin": { en: "Admin", ru: "Админ", am: "Ադմին" },
  "session.createProduct": { en: "New product", ru: "Создать товар", am: "Ստեղծել ապրանք" },
  "session.createProductHint": {
    en: "Not stocked yet? Create it — it joins the catalogue and this bill.",
    ru: "Товара ещё нет? Создайте — он появится в каталоге и в этом счёте.",
    am: "Ապրանքը դեռ չկա՞։ Ստեղծեք — այն կհայտնվի կատալոգում և այս հաշվին։",
  },
  "session.removeFromBill": { en: "Remove from the bill", ru: "Убрать из счёта", am: "Հեռացնել հաշվից" },
  "session.removedOne": { en: "{0} removed", ru: "Товар «{0}» успешно удалён", am: "«{0}» ապրանքը հեռացվեց" },
  "session.removeFailed": { en: "Could not remove the product.", ru: "Не удалось удалить товар.", am: "Չհաջողվեց հեռացնել ապրանքը։" },
  "session.addItem": { en: "Add a product", ru: "Добавить товар", am: "Ավելացնել ապրանք" },
  "session.availableProducts": { en: "Available products", ru: "Доступные товары", am: "Հասանելի ապրանքներ" },
  "session.addedProducts": { en: "Added products", ru: "Добавленные товары", am: "Ավելացված ապրանքներ" },
  "session.nothingAdded": {
    en: "Nothing added yet — pick a product above.",
    ru: "Пока ничего не добавлено — выберите товар выше.",
    am: "Դեռ ոչինչ ավելացված չէ — ընտրեք ապրանք վերևում:",
  },
  "session.noSearchMatches": { en: "Nothing matches that search.", ru: "Ничего не найдено.", am: "Ոչինչ չի գտնվել:" },
  "session.itemsTotal": { en: "Products total", ru: "Итого за товары", am: "Ընդամենը ապրանքների համար" },
  "session.decrease": { en: "One fewer", ru: "Убрать одну", am: "Մեկով պակաս" },
  "session.increase": { en: "One more", ru: "Добавить одну", am: "Մեկով ավելի" },
  "session.removeItem": { en: "Remove from the session", ru: "Удалить из сессии", am: "Հեռացնել նիստից" },
  // The dialog is a basket: nothing reaches the session until it is confirmed,
  // so the button says what confirming will do, and the count decides the word.
  "session.cartConfirmOne": {
    en: "Add the product to this session",
    ru: "Добавить товар к этой сессии",
    am: "Ավելացնել ապրանքը այս նիստին",
  },
  "session.cartConfirmMany": {
    en: "Add the products to this session",
    ru: "Добавить товары к этой сессии",
    am: "Ավելացնել ապրանքները այս նիստին",
  },
  "session.adding": { en: "Adding…", ru: "Добавление…", am: "Ավելացվում է…" },
  "session.cartEmpty": {
    en: "Nothing selected yet — pick a product above.",
    ru: "Пока ничего не выбрано — выберите товар выше.",
    am: "Դեռ ոչինչ ընտրված չէ — ընտրեք ապրանք վերևում:",
  },
  "session.alreadyInSession": { en: "Already on the bill", ru: "Уже в сессии", am: "Արդեն հաշվին" },
  "session.addedOne": {
    en: "{0} × {1} added to the current session.",
    ru: "{0} × {1} успешно добавлен к текущей сессии.",
    am: "{0} × {1} ավելացվեց ընթացիկ նիստին:",
  },
  "session.addedMany": {
    en: "Added to the current session: {0}.",
    ru: "Товары успешно добавлены к текущей сессии: {0}.",
    am: "Ավելացվեց ընթացիկ նիստին՝ {0}:",
  },
  "session.addFailedOne": {
    en: "The product was not added to the current session.",
    ru: "Товар не добавлен к текущей сессии.",
    am: "Ապրանքը չավելացվեց ընթացիկ նիստին:",
  },
  "session.addFailedMany": {
    en: "The products were not added to the current session.",
    ru: "Товары не добавлены к текущей сессии.",
    am: "Ապրանքները չավելացվեցին ընթացիկ նիստին:",
  },
  "session.failReason": { en: "Reason: {0}", ru: "Причина: {0}", am: "Պատճառը՝ {0}" },
  "session.failUnknown": {
    en: "the server did not say why.",
    ru: "сервер не сообщил причину.",
    am: "սերվերը պատճառ չնշեց:",
  },
  "session.search": { en: "Search by name…", ru: "Поиск по названию…", am: "Որոնում անունով…" },
  "session.noProducts": { en: "No products in this branch yet — create the first one below.", ru: "В этом филиале ещё нет товаров — создайте первый ниже.", am: "Այս մասնաճյուղում ապրանքներ դեռ չկան — ստեղծեք առաջինը ներքևում։" },
  "session.added": { en: "Added", ru: "Добавлено", am: "Ավելացված է" },
  "session.checkoutTitle": { en: "Close session", ru: "Закрыть сессию", am: "Փակել նիստը" },
  "session.checkoutDone": { en: "Receipt closed", ru: "Чек закрыт", am: "Հաշիվը փակված է" },
  "session.timePlayed": { en: "Time played", ru: "Время игры", am: "Խաղի ժամանակը" },
  "session.tariff": { en: "Tariff", ru: "Тариф", am: "Սակագին" },
  "session.totalDue": { en: "Total to pay", ru: "Итого к оплате", am: "Ընդամենը վճարման" },
  "session.confirmStop": { en: "Confirm and close", ru: "Подтвердить и закрыть", am: "Հաստատել և փակել" },
  "session.closing": { en: "Closing…", ru: "Закрываем…", am: "Փակվում է…" },
  "session.fixedTariff": { en: "Fixed tariff", ru: "Фиксированный тариф", am: "Ֆիքսված սակագին" },
  "session.openByHour": { en: "By hour (open)", ru: "По часам (открытая)", am: "Ժամով (բաց)" },
  "session.tariffField": { en: "Tariff", ru: "Тариф", am: "Սակագին" },
  "session.hourlyRate": { en: "Hourly rate", ru: "Ставка за час", am: "Ժամային սակագին" },
  "session.editPrice": { en: "Change current price", ru: "Изменить текущую цену", am: "Փոխել ընթացիկ գինը" },
  "session.newHourlyRate": { en: "New price per hour", ru: "Новая цена за час", am: "Նոր գին մեկ ժամի համար" },
  "session.priceSaved": { en: "Saved", ru: "Сохранено", am: "Պահպանված է" },
  "session.savePriceHint": { en: "Save the new price, then press Start.", ru: "Сохраните новую цену, затем нажмите «Старт».", am: "Պահպանեք նոր գինը, ապա սեղմեք «Սկսել»:" },
  "session.groupComputers": { en: "Computer places", ru: "Места для компьютеров", am: "Համակարգիչների տեղեր" },
  "session.groupPs": { en: "PS places", ru: "Места для PS", am: "PS-ի տեղեր" },
  "session.groupOther": { en: "Other places", ru: "Другие места", am: "Այլ տեղեր" },
  "session.noPcs": { en: "No devices registered.", ru: "Устройства не зарегистрированы.", am: "Սարքեր գրանցված չեն:" },
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
  // Device (not seat) availability: the kiosk agent isn't connected, so the
  // machine can't be unlocked for a player and must not be billable either.
  "session.deviceOffline": { en: "Offline", ru: "Не в сети", am: "Անցանց" },
  "session.deviceOfflineHint": {
    en: "The device agent is not connected — a session cannot be started.",
    ru: "Агент устройства не подключён — сессию начать нельзя.",
    am: "Սարքի գործակալը միացված չէ — նիստը հնարավոր չէ սկսել:",
  },
  "session.toastNewBooking": { en: "New booking", ru: "Новое бронирование", am: "Նոր ամրագրում" },
  "session.toastBookingExtended": { en: "Booking extended", ru: "Бронь продлена", am: "Ամրագրումը երկարացվել է" },
  "session.boardTitle": { en: "Sessions", ru: "Сессии", am: "Նիստեր" },
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
  "hub.tile.members": { en: "Members", ru: "Клиенты", am: "Անդամներ" },
  "hub.tile.membersHint": { en: "Cards & deposits", ru: "Карты и депозиты", am: "Քարտեր և ավանդներ" },
  "hub.tile.places": { en: "Places", ru: "Места", am: "Տեղեր" },
  "hub.tile.placesHint": { en: "Bookable seats · games", ru: "Места для бронирования · игры", am: "Ամրագրման տեղեր · խաղեր" },
  "hub.tile.games": { en: "Games", ru: "Игры", am: "Խաղեր" },
  "hub.tile.gamesHint": { en: "This branch's game library", ru: "Библиотека игр филиала", am: "Մասնաճյուղի խաղերի գրադարան" },
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
  "hub.tile.productsHint": { en: "Sold on the session bill", ru: "Продаются в счёт сессии", am: "Վաճառվում են սեանսի հաշվին" },
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
  "login.forgetEmail": { en: "Forget this address", ru: "Забыть этот адрес", am: "Մոռանալ այս հասցեն" },

  // Switching to a manager account (owner only)
  "switchAccount.cta": { en: "Switch to another account", ru: "Переключиться на другой аккаунт", am: "Անցնել այլ հաշվի" },
  "switchAccount.title": { en: "Company accounts", ru: "Аккаунты компании", am: "Ընկերության հաշիվներ" },
  "switchAccount.filter": { en: "Search by name, email or branch", ru: "Поиск по имени, почте или филиалу", am: "Որոնում ըստ անվան, էլ. հասցեի կամ մասնաճյուղի" },
  "switchAccount.empty": { en: "No other accounts available yet", ru: "Других аккаунтов пока нет", am: "Այլ հաշիվներ դեռ չկան" },
  "switchAccount.noMatch": { en: "No account matches", ru: "Ничего не найдено", am: "Համընկնում չկա" },
  "switchAccount.unnamed": { en: "Unnamed account", ru: "Без имени", am: "Անանուն հաշիվ" },
  "switchAccount.passwordHint": { en: "Enter this account's password to continue as them.", ru: "Введите пароль этого аккаунта, чтобы войти под ним.", am: "Մուտքագրեք այս հաշվի գաղտնաբառը՝ նրա անունից շարունակելու համար:" },
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
  // Deleting a place takes the device that makes it billable and every session
  // recorded on that device. Two wordings, because a PC place owns a computer
  // the operator can see under "Computers" and a console place does not —
  // naming a section that will not change is how a warning stops being read.
  "branchPlaces.confirmDelete": {
    en: "Delete place #{0}?\n\nIts device and every session recorded on it will be deleted as well. This cannot be undone.",
    ru: "Удалить место №{0}?\n\nВместе с ним будут удалены его устройство и все записанные на нём сессии. Действие необратимо.",
    am: "Ջնջե՞լ #{0} տեղը:\n\nՆրա հետ կջնջվեն դրա սարքը և դրանում գրանցված բոլոր սեսիաները: Գործողությունն անդարձելի է:",
  },
  "branchPlaces.confirmDeletePc": {
    en: "Delete place #{0}?\n\nIts computer will disappear from Computers, and every session recorded on it will be deleted as well. This cannot be undone.",
    ru: "Удалить место №{0}?\n\nСвязанный компьютер исчезнет из раздела «Компьютеры», а все записанные на нём сессии будут удалены. Действие необратимо.",
    am: "Ջնջե՞լ #{0} տեղը:\n\nԿապված համակարգիչը կվերանա «Համակարգիչներ» բաժնից, իսկ դրանում գրանցված բոլոր սեսիաները կջնջվեն: Գործողությունն անդարձելի է:",
  },
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
  // A computer is not deleted on its own: it exists to serve one place, so the
  // place goes with it, and the place's sessions go with the place. The number
  // is in the text because "delete PC #4" and "delete place #4 too" are the
  // same action and the operator has to see the second half before confirming.
  "pcs.confirmDelete": {
    en: "Delete computer \u201c{0}\u201d?\n\nThe place it serves (#{1}) will be deleted with it, along with every session recorded on it. This cannot be undone.",
    ru: "Удалить компьютер «{0}»?\n\nВместе с ним будет удалено обслуживаемое место (№{1}) и все записанные на нём сессии. Действие необратимо.",
    am: "Ջնջե՞լ «{0}» համակարգիչը:\n\nՆրա հետ կջնջվի սպասարկվող տեղը (#{1}) և դրանում գրանցված բոլոր սեսիաները: Գործողությունն անդարձելի է:",
  },
  // Same action for a device that serves no place — a legacy row from before
  // one-device-per-place. Nothing else goes with it, and saying so avoids
  // promising a cascade that will not happen.
  "pcs.confirmDeleteUnlinked": {
    en: "Delete computer \u201c{0}\u201d?\n\nEvery session recorded on it will be deleted as well. This cannot be undone.",
    ru: "Удалить компьютер «{0}»?\n\nВсе записанные на нём сессии будут удалены. Действие необратимо.",
    am: "Ջնջե՞լ «{0}» համակարգիչը:\n\nԴրանում գրանցված բոլոր սեսիաները կջնջվեն: Գործողությունն անդարձելի է:",
  },
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

  "action.failed": { en: "Failed", ru: "Сбой", am: "Ձախողվեց" },

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
  "tournaments.goToMyBranch": { en: "Go to my branch tournaments", ru: "Перейти к турнирам моего филиала", am: "Անցնել իմ մասնաճյուղի մրցաշարերին" },
  "tournaments.pickBranch": { en: "Choose a branch", ru: "Выберите филиал", am: "Ընտրեք մասնաճյուղ" },
  "tournaments.noBranch": { en: "No branch is assigned to your account.", ru: "К вашему аккаунту не привязан филиал.", am: "Ձեր հաշվին մասնաճյուղ կցված չէ:" },
  "tournaments.price": { en: "price", ru: "цена", am: "գին" },
  "tournaments.players": { en: "players", ru: "игроков", am: "խաղացողներ" },
  "tournaments.confirmDelete": { en: "Delete tournament", ru: "Удалить турнир", am: "Ջնջել մրցաշարը" },

  // Games
  "games.title": { en: "Games", ru: "Игры", am: "Խաղեր" },
  "games.new": { en: "+ New game", ru: "+ Новая игра", am: "+ Նոր խաղ" },
  "games.confirmDelete": { en: "Delete", ru: "Удалить", am: "Ջնջել" },
  "branchGames.title": { en: "Branch games", ru: "Игры филиала", am: "Մասնաճյուղի խաղեր" },
  "branchGames.intro": { en: "Games attached to this branch", ru: "Игры, привязанные к этому филиалу", am: "Այս մասնաճյուղին կցված խաղեր" },
  "branchGames.empty": { en: "No games for this branch yet.", ru: "Пока нет игр для этого филиала.", am: "Այս մասնաճյուղի համար դեռ խաղեր չկան:" },

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
  "revenue.noCompany": {
    en: "This account is not attached to a company.",
    ru: "К этому аккаунту не привязана компания.",
    am: "Այս հաշիվը կապված չէ ընկերության հետ։",
  },
  "revenue.pickHint": { en: "Pick a company to see its monthly revenue and commission.", ru: "Выберите компанию, чтобы увидеть её месячную выручку и комиссию.", am: "Ընտրեք ընկերություն՝ ամսական եկամուտ և միջնորդավճար տեսնելու համար:" },
  // The heading of the only revenue figure there is now. It used to say
  // "sessions + POS" beside a second block that computed a different
  // commission from bookings; that block is gone, and so is the ambiguity
  // about which number the owner actually owes on.
  "revenue.operationalTitle": { en: "Revenue from closed sessions", ru: "Выручка по закрытым сессиям", am: "Եկամուտ փակված սեանսներից" },
  "revenue.closedSessions": { en: "Closed sessions", ru: "Закрытых сессий", am: "Փակված սեանսներ" },
  "revenue.sourceSessions": { en: "Sessions", ru: "Сессии", am: "Սեանսներ" },
  "revenue.sourcePos": { en: "POS orders", ru: "Заказы кассы", am: "Դրամարկղի վաճառք" },
  "revenue.gross": { en: "Gross", ru: "Итого выручка", am: "Ընդհանուր" },
  "revenue.commissionPercent": { en: "Commission", ru: "Комиссия", am: "Միջնորդավճար" },
  "revenue.amountOwed": { en: "You owe us this period", ru: "К оплате за период", am: "Վճարման ենթակա ժամանակահատվածում" },

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
    am: "Մենեջերը կկապվի ընտրված մասնաճյուղին և կտեսնի միայն այն:",
  },
  "managers.noBranches": {
    en: "You have no branches yet — create one first, then add a manager to it.",
    ru: "У вас пока нет филиалов — сначала создайте филиал, затем добавьте в него менеджера.",
    am: "Դուք դեռ մասնաճյուղ չունեք — նախ ստեղծեք մասնաճյուղ, ապա ավելացրեք մենեջեր:",
  },
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
  "place.hourlyRate": { en: "Price per hour", ru: "Цена за час", am: "Գինը մեկ ժամում" },
  "place.customPlatformNote": { en: "Custom platform — set its own price per hour (no branch tariff matrix).", ru: "Кастомная платформа — задайте свою цену за час (без тарифной матрицы филиала).", am: "Հատուկ հարթակ — սահմանեք սեփական ժամային գինը (առանց մասնաճյուղի սակագների):" },
  "platform.other": { en: "Other", ru: "Другое", am: "Այլ" },
  "platform.customPlaceholder": { en: "e.g. table-tennis, poker, vr", ru: "напр. table-tennis, poker, vr", am: "օր. table-tennis, poker, vr" },
  "place.gamesAvailable": { en: "Games available on this place", ru: "Доступные игры на этом месте", am: "Հասանելի խաղեր այս տեղում" },
  "place.noGamesPlatform": { en: "No games for", ru: "Нет игр для", am: "Խաղեր չկան" },
  "place.selected": { en: "selected", ru: "выбрано", am: "ընտրված" },
  "place.hasGames": { en: "Does this platform have games?", ru: "У этой платформы есть игры?", am: "Այս հարթակը ունի՞ խաղեր" },
  "place.hasGamesHint": { en: "Turn on to attach games; leave off for a games-free platform (e.g. table tennis).", ru: "Включите, чтобы прикрепить игры; оставьте выключенным для платформы без игр (напр. настольный теннис).", am: "Միացրեք՝ խաղեր կցելու համար; թողեք անջատած՝ առանց խաղերի հարթակի համար (օր. սեղանի թենիս):" },
  "place.createGame": { en: "+ Create game", ru: "+ Создать игру", am: "+ Ստեղծել խաղ" },
  "place.errors.number": { en: "Number must be a positive integer", ru: "Номер должен быть положительным целым числом", am: "Համարը պետք է լինի դրական ամբողջ թիվ" },
  "place.errors.priceRequired": { en: "Set a price for this new platform", ru: "Задайте цену для новой платформы", am: "Սահմանեք գին այս նոր հարթակի համար" },
  "place.errors.nameRequired": { en: "Enter the platform name (English is required)", ru: "Введите наименование платформы (английское обязательно)", am: "Մուտքագրեք հարթակի անվանումը (անգլերենը պարտադիր է)" },
  "place.priceName": { en: "Platform name (наименование)", ru: "Наименование платформы", am: "Հարթակի անվանումը" },
  "place.priceLockedNote": { en: "This platform already has a branch price — it will be applied to this place.", ru: "Для этой платформы уже задана цена филиала — она будет применена к этому месту.", am: "Այս հարթակի համար արդեն սահմանված է մասնաճյուղի գին — այն կկիրառվի այս տեղի համար:" },
  "place.tierUnpricedNote": { en: "This tier of the platform isn't priced yet — set its rate once here.", ru: "Для этого тарифа платформы цена ещё не задана — задайте её здесь один раз.", am: "Հարթակի այս սակագինը դեռ գնավորված չէ — սահմանեք այն այստեղ մեկ անգամ:" },
  // Multilingual platform-name widget (place form, custom platform).
  "platformName.placeholder": { en: "Name", ru: "Наименование", am: "Անվանում" },
  "platformName.enIdHint": { en: "used as the id", ru: "используется как идентификатор", am: "օգտագործվում է որպես ID" },
  "platformName.suggestions": { en: "Existing platforms", ru: "Существующие платформы", am: "Առկա հարթակներ" },
  // Custom-platform prices — read + edit block on the Branch prices page.
  "platformPrice.sectionTitle": { en: "Custom platform prices", ru: "Цены кастомных платформ", am: "Հատուկ հարթակների գներ" },
  "platformPrice.perHour": { en: "per hour", ru: "за час", am: "մեկ ժամում" },
  "platformPrice.managedInPlaces": { en: "Added automatically when you create a place on the platform (in Places). Click a name to rename it; edit the rates here.", ru: "Добавляются автоматически при создании места на платформе (в разделе Места). Нажмите на название, чтобы переименовать; цены изменяются здесь.", am: "Ավելացվում են ինքնաշխատ՝ հարթակի վրա տեղ ստեղծելիս (Տեղեր բաժնում): Սեղմեք անվան վրա՝ վերանվանելու համար; գները փոխվում են այստեղ:" },
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
  "subplatform.price": { en: "Price per hour", ru: "Цена за час", am: "Գինը մեկ ժամում" },
  "subplatform.priceRequiredHint": {
    en: "Required — this is what every place in this subcategory will be charged.",
    ru: "Обязательно — по этой цене будут считаться все места этой подкатегории.",
    am: "Պարտադիր է — այս գնով կհաշվարկվեն այս ենթակատեգորիայի բոլոր տեղերը:",
  },
  "subplatform.tierUnpricedNote": {
    en: "This subcategory has no rate for this type yet — set it here.",
    ru: "У этой подкатегории ещё нет цены для этого типа — задайте её здесь.",
    am: "Այս ենթակատեգորիան դեռ չունի գին այս տեսակի համար — սահմանեք այն այստեղ:",
  },
  "subplatform.errors.priceRequired": {
    en: "Enter a price for this subcategory.",
    ru: "Введите цену подкатегории.",
    am: "Մուտքագրեք ենթակատեգորիայի գինը:",
  },
  "subplatform.priceAppliedNote": {
    en: "This subcategory's rate applies. Change it in Branch prices.",
    ru: "Применяется цена этой подкатегории. Изменить её можно в «Ценах филиала».",
    am: "Կիրառվում է այս ենթակատեգորիայի գինը: Փոխեք այն «Մասնաճյուղի գներ» բաժնում:",
  },
  "subplatform.inherits": { en: "as the platform", ru: "как у платформы", am: "ինչպես հարթակը" },
  "subplatform.errors.nameRequired": {
    en: "Enter a name for the subcategory.",
    ru: "Введите название подкатегории.",
    am: "Մուտքագրեք ենթակատեգորիայի անվանումը:",
  },
  "subplatform.sectionTitle": { en: "Subcategory prices", ru: "Цены подкатегорий", am: "Ենթակատեգորիաների գներ" },
  "subplatform.renameTitle": { en: "Rename subcategory", ru: "Изменить название подкатегории", am: "Վերանվանել ենթակատեգորիան" },
  "subplatform.managedHint": {
    en: "Created in Places, on the second row of tabs. Rename them and edit each rate here. A subcategory disappears on its own once its last place is deleted — it cannot be removed while a place still uses it.",
    ru: "Создаются в разделе «Места», во втором ряду вкладок. Здесь их можно переименовать и изменить цену. Подкатегория исчезает сама, когда удалено её последнее место — пока хотя бы одно место её использует, удалить её нельзя.",
    am: "Ստեղծվում են «Տեղեր» բաժնում՝ ներդիրների երկրորդ շարքում: Այստեղ կարող եք վերանվանել և փոխել գինը: Ենթակատեգորիան անհետանում է ինքնաշխատ, երբ ջնջվում է նրա վերջին տեղը:",
  },
  "subplatform.defaultUndeletable": {
    en: "The Default subcategory cannot be deleted.",
    ru: "Подкатегорию «По умолчанию» удалить нельзя.",
    am: "«Կանխադրված» ենթակատեգորիան հնարավոր չէ ջնջել:",
  },

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
  "products.search": {
    en: "Search by name or category…",
    ru: "Поиск по названию или категории…",
    am: "Որոնում անունով կամ կատեգորիայով…",
  },
  "products.noMatches": {
    en: "Nothing matches that search.",
    ru: "Ничего не найдено.",
    am: "Ոչինչ չի գտնվել:",
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
  "role.manager": { en: "Manager", ru: "Менеджер", am: "Մենеջեր" },

  // Profile
  "profile.title": { en: "Profile", ru: "Профиль", am: "Պրոֆիլ" },
  "profile.firstName": { en: "First name", ru: "Имя", am: "Անուն" },
  "profile.lastName": { en: "Last name", ru: "Фамилия", am: "Ազգանուն" },
  "profile.emailChangeSoon": { en: "Email change with verification is coming soon.", ru: "Изменение email с подтверждением — скоро.", am: "Էլ. հասցեի փոփոխությունը հաստատմամբ՝ շուտով:" },
  "profile.saved": { en: "Profile saved", ru: "Профиль сохранён", am: "Պրոֆիլը պահպանվեց" },
  "profile.nameRequired": { en: "Enter a name", ru: "Введите имя", am: "Մուտքագրեք անուն" },
  "profile.pwKnow": { en: "I know my password", ru: "Помню пароль", am: "Հիշում եմ գաղտնաբառը" },
  "profile.pwForgot": { en: "I forgot it", ru: "Забыл пароль", am: "Մոռացել եմ" },
  "profile.forgotHint": { en: "We'll email a reset code to your address.", ru: "Отправим код сброса на вашу почту.", am: "Վերակայման կոդը կուղարկենք ձեր էլ. հասցեին:" },
  "profile.sendCode": { en: "Send code", ru: "Отправить код", am: "Ուղարկել կոդը" },
  "profile.resendCode": { en: "Resend", ru: "Отправить снова", am: "Ուղարկել կրկին" },
  "profile.codeSent": { en: "Code sent to your email.", ru: "Код отправлен на почту.", am: "Կոդն ուղարկվեց ձեր էլ. հասցեին:" },
  "profile.codePlaceholder": { en: "Code from email", ru: "Код из письма", am: "Կոդ նամակից" },
  "profile.passwordUpdated": { en: "Password updated", ru: "Пароль обновлён", am: "Գաղտնաբառը թարմացվեց" },
  "profile.pwRuleLength": { en: "At least 8 characters", ru: "Минимум 8 символов", am: "Առնվազն 8 նիշ" },
  "profile.pwRuleMatch": { en: "Passwords match", ru: "Пароли совпадают", am: "Գաղտնաբառերը համընկնում են" },
  "profile.wrongCurrentPassword": { en: "Current password is incorrect", ru: "Текущий пароль неверный", am: "Ընթացիկ գաղտնաբառը սխալ է" },
  "profile.changeEmail": { en: "Change email", ru: "Изменить email", am: "Փոխել էլ. հասցեն" },
  "profile.newEmail": { en: "New email", ru: "Новый email", am: "Նոր էл. հասցե" },
  "profile.codeSentCurrent": { en: "Code sent to the new email.", ru: "Код отправлен на новую почту.", am: "Կոդն ուղարկվեց նոր էл. հասցեին:" },
  "profile.emailUpdated": { en: "Email updated", ru: "Email обновлён", am: "Էլ. հասցեն թարմացվեց" },
  "profile.emailCodeHint": { en: "Enter the code we sent to the new email.", ru: "Введите код, отправленный на новую почту.", am: "Մուտքագրեք նոր էл. հասցեին ուղարկված կոդը:" },
  "profile.confirmEmail": { en: "Confirm & change", ru: "Подтвердить и изменить", am: "Հաստատել և փոխել" },
  "profile.errEmailTaken": { en: "This email is already in use.", ru: "Этот email уже используется.", am: "Այս էլ. հասցեն արդեն օգտագործվում է:" },
  "profile.errInvalidCode": { en: "The code is invalid or has expired.", ru: "Код неверный или истёк.", am: "Կոդը սխալ է կամ ժամկետը լրացել է:" },
  "profile.emailChangedToast": { en: "You have successfully changed your email", ru: "Вы успешно изменили почтовый ящик", am: "Դուք հաջողությամբ փոխեցիք էл. հասցեն" },
  "profile.passwordChangedToast": { en: "You have successfully changed your password", ru: "Вы успешно изменили ваш пароль", am: "Դուք հաջողությամբ փոխեցիք ձեր գաղտնաբառը" },
  "profile.confirmCode": { en: "Confirm code", ru: "Подтвердить код", am: "Հաստատել կոդը" },
  "profile.enterCodeHint": { en: "Enter the one-time code we sent to your email.", ru: "Введите одноразовый код, отправленный на вашу почту.", am: "Մուտքագրեք ձեր էլ. հասցեին ուղարկված միանգամյա կոдn:" },

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
  "reset.cardHint": { en: "A one-time code will be sent to {0}. Enter it together with the new password.", ru: "Одноразовый код придёт на {0}. Введите его вместе с новым паролем.", am: "Միանգամյա կոդը կուղարկվի {0} հասցեին: Մուտքագրեք այն նոր գաղտնաբառի հետ:" },
  "reset.codeSentTo": { en: "Code sent to {0}", ru: "Код отправлен на {0}", am: "Կոդն ուղարկվել է {0} հասցեին" },

  // Member card
  "memberCard.transactions": { en: "Transactions", ru: "Транзакции", am: "Գործարքներ" },
  "memberCard.noTx": { en: "No transactions yet.", ru: "Транзакций пока нет.", am: "Գործարքներ դեռ չկան:" },
  "memberCard.topup": { en: "Top up", ru: "Пополнение", am: "Համալրում" },
  "memberCard.spend": { en: "Spend", ru: "Списание", am: "Ծախս" },
  "memberCard.adjust": { en: "Adjust", ru: "Корректировка", am: "Շտկում" },

  // Branch hub tiles
  "tile.sessions": { en: "Sessions", ru: "Сессии", am: "Նիստեր" },
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
    en: "Live, sessions, products, members",
    ru: "Мониторинг, сеансы, товары, игроки",
    am: "Մոնիթորինգ, սեանսներ, ապրանքներ, խաղացողներ",
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
    en: "Sessions, products, members",
    ru: "Сеансы, товары, клиенты",
    am: "Սեանսներ, ապրանքներ, հաճախորդներ",
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
  "monitoring.app.agent": { en: "Desktop agent", ru: "Десктоп-агент", am: "Դեսքթոփ գործակալ" },
  "monitoring.app.website": { en: "Website", ru: "Веб-сайт", am: "Կայք" },
  "monitoring.installs": { en: "Installs", ru: "Установки", am: "Տեղադրումներ" },
  "monitoring.installsShort": { en: "inst.", ru: "уст.", am: "տեղ." },
  "monitoring.viewsShort": { en: "views", ru: "просм.", am: "դիտում" },
  "monitoring.launches": { en: "Launches", ru: "Запуски", am: "Գործարկումներ" },
  "monitoring.events": { en: "Events", ru: "События", am: "Իրադարձություններ" },
  "monitoring.errors": { en: "Errors", ru: "Ошибки", am: "Սխալներ" },
  "monitoring.errorRate": { en: "Error rate", ru: "Доля ошибок", am: "Սխալների բաժինը" },
  "monitoring.activity": { en: "Activity", ru: "Активность", am: "Ակտիվություն" },
  "monitoring.versions": { en: "Versions", ru: "Версии", am: "Տարբերակներ" },
  "monitoring.platforms": { en: "Platforms", ru: "Платформы", am: "Հարթակներ" },
  "monitoring.screens": { en: "Top screens", ru: "Популярные экраны", am: "Հանրաճանաչ էկրաններ" },
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
    am: "Հավելվածը դեռ երբեք չի հաշվետվել։ Տվյալները կհայտնվեն մոնիտորինգով տարբերակը տեղադրելուց հետո։",
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
    en: "Closed because its company is blocked — unblocking the branch alone will not reopen it.",
    ru: "Закрыт из-за блокировки компании — разблокировка филиала сама по себе его не откроет.",
    am: "Փակ է ընկերության արգելափակման պատճառով — միայն մասնաճյուղի ապաարգելափակումը այն չի բացի։",
  },
  "toast.company.blocked": { en: "Company blocked", ru: "Компания заблокирована", am: "Ընկերությունն արգելափակվեց" },
  "toast.company.unblocked": { en: "Company unblocked", ru: "Компания разблокирована", am: "Ընկերությունն ապաարգելափակվեց" },
  "toast.branch.blocked": { en: "Branch blocked", ru: "Филиал заблокирован", am: "Մասնաճյուղն արգելափակվեց" },
  "toast.branch.unblocked": { en: "Branch unblocked", ru: "Филиал разблокирован", am: "Մասնաճյուղն ապաարգելափակվեց" },
  // Shown when someone opens a working screen of a branch that is out of
  // service and is sent back to the branch page.
  "blocking.branchClosed": {
    en: "This branch is out of service — its sections are unavailable",
    ru: "Филиал отключён — его разделы недоступны",
    am: "Մասնաճյուղն անջատված է — նրա բաժինները հասանելի չեն",
  },
  // The server's refusals, said in the operator's own language.
  //
  // The API answers a block with a machine-readable `code` next to its
  // sentence; the panel renders THESE from the code and only falls back to the
  // server's text for a code it does not know. Without that, a Russian panel
  // showed "Your branch has been blocked" at the login screen, because the
  // sentence was written wherever the refusal happened to be thrown.
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
    en: "This branch is blocked — you can view it, but nothing here can be changed.",
    ru: "Филиал заблокирован — его можно просматривать, но изменения недоступны.",
    am: "Մասնաճյուղն արգելափակված է — կարող եք դիտել, բայց փոփոխություններն անհասանելի են։",
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
    en: "Yandex aggregates visits with a few minutes' delay — a brand-new visit may not be counted yet.",
    ru: "Яндекс агрегирует визиты с задержкой в несколько минут — самый свежий визит может быть ещё не учтён.",
    am: "Yandex-ը այցերը հավաքագրում է մի քանի րոպե ուշացումով — ամենավերջին այցը կարող է դեռ հաշվառված չլինել։",
  },
  "metrics.visits": { en: "Visits", ru: "Визиты", am: "Այցեր" },
  "metrics.users": { en: "Visitors", ru: "Посетители", am: "Այցելուներ" },
  "metrics.bounceRate": { en: "Bounce rate", ru: "Отказы", am: "Մերժումներ" },
  "metrics.pageDepth": { en: "Pages / visit", ru: "Глубина просмотра", am: "Դիտման խորություն" },
  "metrics.avgVisit": { en: "Avg. visit", ru: "Время на сайте", am: "Կայքում անցկացրած ժամանակ" },
  "metrics.trend": { en: "Trend", ru: "Динамика", am: "Դինամիկա" },
  "metrics.sources": { en: "Traffic sources", ru: "Источники трафика", am: "Թրաֆիկի աղբյուրներ" },
  "metrics.noData": {
    en: "No data for this period yet.",
    ru: "За этот период данных пока нет.",
    am: "Այս ժամանակահատվածի տվյալներ դեռ չկան:",
  },
  "metrics.sampled": {
    en: "Figures are estimated (Yandex sampling).",
    ru: "Данные приблизительные (сэмплирование Яндекса).",
    am: "Տվյալները մոտավոր են (Yandex-ի ընտրանք):",
  },
  "metrics.notConfigured": {
    en: "Analytics is not set up for this environment",
    ru: "Аналитика не настроена для этого окружения",
    am: "Անալիտիկան կարգավորված չէ այս միջավայրի համար",
  },
  "metrics.notConfiguredSub": {
    en: "Add the counter and token to this environment's settings, then reload.",
    ru: "Добавьте счётчик и токен в настройки этого окружения и обновите страницу.",
    am: "Ավելացրեք հաշվիչը և թոքենը այս միջավայրի կարգավորումներում և թարմացրեք:",
  },
  "metrics.unavailable": {
    en: "Yandex.Metrica is unavailable",
    ru: "Яндекс.Метрика недоступна",
    am: "Yandex.Metrica-ն հասանելի չէ",
  },
  "metrics.unavailableSub": {
    en: "The service did not respond. The figures will return on their own once it does.",
    ru: "Сервис не ответил. Данные появятся сами, как только он снова заработает.",
    am: "Ծառայությունը չպատասխանեց: Տվյալները կվերադառնան ինքնաբերաբար:",
  },
  "metrics.loadFailed": {
    en: "Could not load metrics",
    ru: "Не удалось загрузить метрики",
    am: "Չհաջողվեց բեռնել մետրիկան",
  },
  "metrics.loadFailedSub": {
    en: "Check the connection to the server and try again.",
    ru: "Проверьте связь с сервером и попробуйте ещё раз.",
    am: "Ստուգեք կապը սերվերի հետ և փորձեք կրկին:",
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
    am: "Չհաջողվեց բացել մոնիտորինգը: Փորձեք կրկին:",
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

  // Company country picker + TIN validation
  "company.selectCountry": { en: "— select country —", ru: "— выберите страну —", am: "— ընտրեք երկիր —" },
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
    en: "Automatic translation is not set up on this server — fill the languages in by hand.",
    ru: "Автоперевод не настроен на сервере — заполните языки вручную.",
    am: "Ավտոթարգմանությունը սերվերում կարգավորված չէ — լրացրեք լեզուները ձեռքով։",
  },
  "multilang.reason.auth": {
    en: "The translation service rejected the server's credentials — contact the administrator.",
    ru: "Сервис перевода отклонил доступ сервера — обратитесь к администратору.",
    am: "Թարգմանության ծառայությունը մերժեց սերվերի հասանելիությունը — դիմեք ադմինիստրատորին։",
  },
  "multilang.reason.quota": {
    en: "The translation quota is used up — fill the languages in by hand for now.",
    ru: "Лимит переводов исчерпан — пока заполните языки вручную.",
    am: "Թարգմանության սահմանաչափը սպառված է — առայժմ լրացրեք ձեռքով։",
  },
  // Shown INSTEAD of the one above when the service told us how long to wait.
  // The distinction matters: one asks the user to do the work themselves, the
  // other asks them to do nothing at all.
  "multilang.reason.quota_retry": {
    en: "Too many translations at once — retrying automatically in",
    ru: "Слишком много переводов подряд — повторим автоматически через",
    am: "Չափազանց շատ թարգմանություններ անընդմեջ — ավտոմատ կկրկնվի",
  },
  "multilang.seconds": { en: "s", ru: "с", am: "վրկ" },
  "multilang.reason.provider_error": {
    en: "The translation service is unavailable right now — fill the languages in by hand.",
    ru: "Сервис перевода сейчас недоступен — заполните языки вручную.",
    am: "Թարգմանության ծառայությունն այժմ հասանելի չէ — լրացրեք ձեռքով։",
  },

  "multilang.failed": {
    en: "could not translate — please fill in",
    ru: "не удалось перевести — заполните вручную",
    am: "չհաջողվեց թարգմանել — լրացրեք ձեռքով",
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
    en: "Type once — the other languages are filled in automatically.",
    ru: "Введите один раз — остальные языки заполнятся автоматически.",
    am: "Մուտքագրեք մեկ անգամ — մնացած լեզուները կլրացվեն ավտոմատ։",
  },
  "i18n.translations": { en: "Translations", ru: "Переводы", am: "Թարգմանություններ" },
  "i18n.pending": { en: "translating…", ru: "переводится…", am: "թարգմանվում է…" },
  "i18n.overrideHint": {
    en: "Editing a language here locks it — automatic translation will not overwrite your wording.",
    ru: "Правка языка здесь блокирует его — автоперевод не перезапишет вашу формулировку.",
    am: "Այստեղ լեզուն խմբագրելը կողպում է այն — ավտոթարգմանությունը չի վերագրի ձեր ձևակերպումը։",
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
    en: "The source changed — the previous translation is shown until the new one is ready.",
    ru: "Исходник изменился — показывается прежний перевод, пока не готов новый.",
    am: "Սկզբնաղբյուրը փոխվել է — ցուցադրվում է նախորդ թարգմանությունը, մինչև նորը պատրաստ լինի։",
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
    am: "Դուք ձեռքով խմբագրել եք այս լեզուն, իսկ սկզբնաղբյուրն այդ ժամանակից փոխվել է։ Ավտոթարգմանությունը այն չի փոխի։",
  },
  "i18n.status.skipped": { en: "not translated", ru: "без перевода", am: "առանց թարգմանության" },
  "i18n.status.skipped.hint": {
    en: "Brand names, codes and numbers are copied as-is instead of being translated.",
    ru: "Бренды, коды и числа копируются как есть, без перевода.",
    am: "Ապրանքանիշերը, կոդերը և թվերը պատճենվում են այնպես, ինչպես կան՝ առանց թարգմանության։",
  },
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
