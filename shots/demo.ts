/**
 * The demo venue every capture is taken of.
 *
 * One club network, written once and served to the real bundle: three
 * branches, a floor that is actually busy, a catalogue somebody buys from,
 * bookings for tonight and a tournament this weekend. Numbers are round and
 * plausible rather than random — a screenshot is read, and a bill of 17 843 ֏
 * reads as test data.
 *
 * Nothing here is a fixture for a test. Tests assert; these sell.
 */

const iso = (minutesFromNow: number): string =>
  new Date(Date.now() + minutesFromNow * 60_000).toISOString();

const today = (): string => new Date().toISOString().slice(0, 10);

/* ── The network ────────────────────────────────────────────────────────── */

export const company = {
  id: 1,
  user_id: 1,
  user: { id: 1, name: "Արամ Հովհաննիսյան", email: "owner@cyberplace.pro" },
  name: "Cyber Place Armenia",
  email: "hello@cyberplace.pro",
  phone: "+374 10 55 44 33",
  company_logo_path: "",
  company_country: "Հայաստան",
  company_city: "Երևան",
  tin: "02512345",
  website: "cyberplace.pro",
  description: "Գեյմինգ ակումբների ցանց Երևանում և մարզերում",
  status: "active",
  branches_count: 3,
  managers_count: 5,
  commission_percent: 0,
};

const branch = (
  id: number,
  city: string,
  address: string,
  lat: number,
  lng: number,
  places: number,
  managers: number,
  rating: number,
) => ({
  id,
  company_id: 1,
  city,
  country: "Հայաստան",
  address,
  address_lat: lat,
  address_lng: lng,
  phone: ["+374 10 55 44 33"],
  branch_logo_path: "",
  status: "active",
  blocked_at: null,
  is_blocked: false,
  places_count: places,
  managers_count: managers,
  ratings_avg_rating: rating,
  price_for_branch: {
    id,
    branch_id: id,
    "pc-standard": 1200,
    "pc-vip": 1800,
    "ps4-standard": 1500,
    "ps5-standard": 2000,
    "ps5-vip": 2500,
    "ps4-vip": null,
  },
  company: { id: 1, name: "Cyber Place Armenia" },
});

export const branches = [
  branch(1, "Երևան", "Տիգրան Մեծի 42", 40.1834, 44.5152, 18, 2, 4.8),
  branch(2, "Գյումրի", "Ռուսթավելու 7", 40.7894, 43.8475, 14, 2, 4.7),
  branch(3, "Աբովյան", "Հանրապետության 15", 40.2719, 44.6301, 10, 1, 4.9),
];

/* ── The floor ──────────────────────────────────────────────────────────── */

const place = (
  id: number,
  number: number,
  platform: string,
  type: "standard" | "vip",
  rate: number | null,
) => ({
  id,
  branch_id: 1,
  number,
  name: null,
  type,
  status: "active" as const,
  platform,
  subplatform_id: null,
  hourly_rate: rate,
  games: [],
  i18n: { name: { en: "", ru: "", am: "" } },
  source_locale: "hy",
});

export const places = [
  ...Array.from({ length: 8 }, (_, i) => place(i + 1, i + 1, "pc", "standard", null)),
  ...Array.from({ length: 4 }, (_, i) => place(i + 9, i + 9, "pc", "vip", null)),
  place(13, 13, "ps5", "standard", null),
  place(14, 14, "ps5", "vip", null),
  place(15, 15, "ps5", "standard", null),
  place(16, 16, "ps4", "standard", null),
  place(17, 17, "poker", "standard", 4000),
  place(18, 18, "poker", "vip", 6000),
];

const pc = (
  id: number,
  placeId: number,
  label: string,
  kind: "pc" | "ps",
  status: string,
  sessionId?: number,
) => ({
  id,
  branch_id: 1,
  place_id: placeId,
  label,
  kind,
  status,
  is_startable: status === "online",
  last_seen_at: iso(-1),
  current_session_id: sessionId,
  mac_address: "A4:B1:C2:D3:E4:" + String(10 + id),
  place: {
    id: placeId,
    number: placeId,
    name: null,
    type: placeId > 8 && placeId < 13 ? "vip" : "standard",
    platform: placeId >= 13 ? (placeId === 16 ? "ps4" : "ps5") : "pc",
    i18n: { name: { en: "", ru: "", am: "" } },
  },
});

export const pcs = [
  pc(1, 1, "PC-01", "pc", "in_session", 101),
  pc(2, 2, "PC-02", "pc", "in_session", 102),
  pc(3, 3, "PC-03", "pc", "online"),
  pc(4, 4, "PC-04", "pc", "in_session", 103),
  pc(5, 5, "PC-05", "pc", "online"),
  pc(6, 6, "PC-06", "pc", "in_session", 104),
  pc(7, 7, "PC-07", "pc", "online"),
  pc(8, 8, "PC-08", "pc", "offline"),
  pc(9, 9, "VIP-01", "pc", "in_session", 105),
  pc(10, 10, "VIP-02", "pc", "online"),
  pc(11, 11, "VIP-03", "pc", "in_session", 106),
  pc(12, 12, "VIP-04", "pc", "online"),
  pc(13, 13, "PS5-01", "ps", "in_session", 107),
  pc(14, 14, "PS5-VIP", "ps", "in_session", 108),
  pc(15, 15, "PS5-02", "ps", "online"),
  pc(16, 16, "PS4-01", "ps", "online"),
];

/* ── The evening ────────────────────────────────────────────────────────── */

const session = (
  id: number,
  pcId: number,
  label: string,
  player: string,
  startedMinutesAgo: number,
  endsInMinutes: number | null,
  rate: number,
  items: Array<{ id: number; name: string; price: number; qty: number }> = [],
) => ({
  id,
  branch_id: 1,
  pc_id: pcId,
  pc_label: label,
  user_display_name: player,
  mode: endsInMinutes === null ? "open" : "fixed",
  hourly_rate: rate,
  tariff_hourly_rate: rate,
  started_at: iso(-startedMinutesAgo),
  ends_at: endsInMinutes === null ? null : iso(endsInMinutes),
  stopped_at: null,
  status: "active" as const,
  total_paid: 0,
  is_free: false,
  is_unlimited: false,
  joystick_count: pcId >= 13 ? 2 : undefined,
  supports_joysticks: pcId >= 13,
  items: items.map((i) => ({ ...i, line_total: i.price * i.qty })),
  items_total: items.reduce((s, i) => s + i.price * i.qty, 0),
  place_platform: pcId >= 13 ? "ps5" : "pc",
  rounding_step: 0,
  rounding_mode: "up",
  opened_by: { id: 7, name: "Նարե Սարգսյան", role: "manager" },
  branch: { id: 1, address: "Տիգրան Մեծի 42", city: "Երևան", company_id: 1 },
});

export const activeSessions = [
  session(101, 1, "PC-01", "Դավիթ", 95, 25, 1200, [
    { id: 1, name: "Coca-Cola", price: 500, qty: 2 },
  ]),
  session(102, 2, "PC-02", "Գոռ", 42, null, 1200),
  session(103, 4, "PC-04", "Տիգրան", 128, 52, 1200, [
    { id: 2, name: "Lays", price: 700, qty: 1 },
    { id: 3, name: "Coca-Cola", price: 500, qty: 1 },
  ]),
  session(104, 6, "PC-06", "Արեգ", 18, 102, 1200),
  session(105, 9, "VIP-01", "Հայկ", 64, 56, 1800, [
    { id: 4, name: "Էներգետիկ", price: 800, qty: 2 },
  ]),
  session(106, 11, "VIP-03", "Սարգիս", 7, 113, 1800),
  session(107, 13, "PS5-01", "Նարեկ", 31, 89, 2000),
  session(108, 14, "PS5-VIP", "Մարո", 76, 44, 2500, [
    { id: 5, name: "Sprite", price: 400, qty: 3 },
  ]),
];

export const finishedSessions = [
  {
    ...session(94, 3, "PC-03", "Վահե", 400, null, 1200),
    status: "stopped" as const,
    stopped_at: iso(-220),
    ends_at: iso(-220),
    total_paid: 3600,
    payment_method: "cash",
  },
  {
    ...session(95, 5, "PC-05", "Անի", 380, null, 1200),
    status: "stopped" as const,
    stopped_at: iso(-260),
    ends_at: iso(-260),
    total_paid: 2400,
    payment_method: "card",
  },
  {
    ...session(96, 13, "PS5-01", "Էդգար", 340, null, 2000),
    status: "stopped" as const,
    stopped_at: iso(-180),
    ends_at: iso(-180),
    total_paid: 5500,
    payment_method: "cash",
  },
  {
    ...session(97, 10, "VIP-02", "Լիլիթ", 300, null, 1800),
    status: "stopped" as const,
    stopped_at: iso(-150),
    ends_at: iso(-150),
    total_paid: 4700,
    payment_method: "card",
  },
];

export const sessionEvents = [
  { id: 1, session_id: 94, branch_id: 1, action: "started", amount: "0.00", user_id: 7,
    user: { id: 7, name: "Նարե Սարգսյան", role: "manager" }, created_at: iso(-400), meta: { mode: "open" } },
  { id: 2, session_id: 94, branch_id: 1, action: "item_added", amount: "1200.00", user_id: 7,
    user: { id: 7, name: "Նարե Սարգսյան", role: "manager" }, created_at: iso(-320),
    meta: { lines: [{ name: "Coca-Cola", price: 500, qty: 2 }, { name: "Lays", price: 700, qty: 1 }], count: 3, items_total: 1700 } },
  { id: 3, session_id: 94, branch_id: 1, action: "stopped", amount: "3600.00", user_id: 7,
    user: { id: 7, name: "Նարե Սարգսյան", role: "manager" }, created_at: iso(-220), meta: { payment_method: "cash" } },
];

/* ── The catalogue ──────────────────────────────────────────────────────── */

const product = (id: number, name: string, category: string, price: number) => ({
  id,
  branch_id: 1,
  name,
  category,
  price,
  is_active: true,
  i18n: { name: { en: name, ru: name, am: name } },
});

export const products = [
  product(1, "Coca-Cola", "Ըմպելիք", 500),
  product(2, "Sprite", "Ըմպելիք", 400),
  product(3, "Էներգետիկ", "Ըմպելիք", 800),
  product(4, "Սուրճ", "Ըմպելիք", 600),
  product(5, "Lays", "Խորտիկ", 700),
  product(6, "Snickers", "Խորտիկ", 600),
  product(7, "Պիցցա", "Խոհանոց", 2500),
  product(8, "Ֆիշկաներ", "chips", 100),
];

/* ── Tonight's bookings ─────────────────────────────────────────────────── */

const booking = (
  id: number,
  code: number,
  start: string,
  end: string,
  minutes: number,
  places: number[],
  status: string,
  game: string,
) => ({
  id,
  company_id: 1,
  branch_id: 1,
  game_id: 1,
  guest_id: id,
  booking_date: today(),
  start_time: start,
  end_time: end,
  duration_minutes: minutes,
  status,
  code,
  place_booking_count: places.length,
  place_ids: places,
  place_numbers: places,
  company: { id: 1, name: "Cyber Place Armenia" },
  game: { id: 1, platform: "pc", name: game },
  guest: { id, first_name: "Հյուր", last_name: String(id) },
});

export const bookings = [
  booking(1, 4821, "18:00", "20:00", 120, [3, 5], "confirmed", "Counter-Strike 2"),
  booking(2, 7364, "19:00", "21:00", 120, [12], "confirmed", "Dota 2"),
  booking(3, 2190, "20:00", "22:00", 120, [15], "confirmed", "EA FC 25"),
  booking(4, 5518, "21:00", "23:00", 120, [7, 8], "pending", "Valorant"),
  booking(5, 9043, "16:00", "18:00", 120, [10], "finished", "Mortal Kombat 1"),
];

/* ── The weekend ────────────────────────────────────────────────────────── */

export const tournaments = [
  {
    id: 1,
    branch_id: 1,
    name: "EA FC 25 Cup",
    game: "EA FC 25",
    status: "open",
    starts_at: iso(60 * 26),
    entry_fee: 3000,
    prize_pool: 60000,
    slots: 32,
    registrations_count: 24,
    branch: { id: 1, address: "Տիգրան Մեծի 42", city: "Երևան" },
  },
  {
    id: 2,
    branch_id: 1,
    name: "CS2 5v5 Night",
    game: "Counter-Strike 2",
    status: "open",
    starts_at: iso(60 * 50),
    entry_fee: 5000,
    prize_pool: 100000,
    slots: 20,
    registrations_count: 15,
    branch: { id: 1, address: "Տիգրան Մեծի 42", city: "Երևան" },
  },
];

/* ── The people ─────────────────────────────────────────────────────────── */

export const managers = [
  { id: 7, user_id: 7, branch_id: 1, company_id: 1, name: "Նարե Սարգսյան", email: "nare@cyberplace.pro",
    phone: "+374 91 22 33 44", user: { id: 7, name: "Նարե Սարգսյան", email: "nare@cyberplace.pro", role: "manager" },
    branch: { id: 1, address: "Տիգրան Մեծի 42", city: "Երևան" } },
  { id: 8, user_id: 8, branch_id: 1, company_id: 1, name: "Կարեն Պետրոսյան", email: "karen@cyberplace.pro",
    phone: "+374 91 55 66 77", user: { id: 8, name: "Կարեն Պետրոսյան", email: "karen@cyberplace.pro", role: "manager" },
    branch: { id: 1, address: "Տիգրան Մեծի 42", city: "Երևան" } },
  { id: 9, user_id: 9, branch_id: 2, company_id: 1, name: "Անի Գրիգորյան", email: "ani@cyberplace.pro",
    phone: "+374 93 11 22 33", user: { id: 9, name: "Անի Գրիգորյան", email: "ani@cyberplace.pro", role: "manager" },
    branch: { id: 2, address: "Ռուսթավելու 7", city: "Գյումրի" } },
];

/* ── Money ──────────────────────────────────────────────────────────────── */

export const timePackages = [
  { id: 1, branch_id: 1, name: "1 ժամ", duration_minutes: 60, price: 1200 },
  { id: 2, branch_id: 1, name: "3 ժամ", duration_minutes: 180, price: 3000 },
  { id: 3, branch_id: 1, name: "5 ժամ", duration_minutes: 300, price: 4500 },
  { id: 4, branch_id: 1, name: "Գիշերային", duration_minutes: 600, price: 7000 },
];

export const platformPrices = [
  { id: 1, branch_id: 1, platform: "pc", name_en: "PC", name_ru: "PC", name_am: "PC",
    "pc-standard": 1200, standard: 1200, vip: 1800 },
];

export const billingSettings = {
  branch_id: 1,
  money_rounding_step: 100,
  money_rounding_mode: "up",
  joystick_price: 500,
  joystick_included: 1,
  joystick_max: 4,
  joystick_charged_slots: "3,4",
  joystick_pricing_mode: "fixed",
  joystick_price_4: null,
  joystick_max_slot: 4,
  joystick_strategy_mode: "fixed_price",
};

export const supportConversations = [
  { id: 1, branch_id: 1, subject: "Ագենտի թարմացում", status: "open", unread: 0,
    last_message_at: iso(-90), branch: { id: 1, address: "Տիգրան Մեծի 42", city: "Երևան" } },
];

export const agentUpdateStatus = {
  channel: "stable",
  latest_version: "1.0.24",
  applied_version: "1.0.24",
  devices_total: 16,
  devices_updated: 16,
};
