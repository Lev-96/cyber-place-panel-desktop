import { describe, expect, test } from "vitest";
import {
  EMPTY_DRAFT, settleDuration, clockOfDraft, settleClock, stepClock, typeIntoClockHours, typeIntoClockMinutes, amountIn, clockOf, draftMinutes, draftOf, minutesOf, parseDuration, stepDraft, typeIntoHours, typeIntoMinutes,
} from "./durationModel";
import { isNextDay } from "./ClockTimeField";

/** One length, two units: what "2" means is decided by the unit beside it. */
describe("minutesOf", () => {
  test.each([
    ["2", "hours", 120],
    ["1.5", "hours", 90],
    ["1,5", "hours", 90],
    ["0.25", "hours", 15],
    ["30", "minutes", 30],
    ["180", "minutes", 180],
    ["10", "hours", 600],
  ] as const)("%s %s is %i minutes", (amount, unit, minutes) => {
    expect(minutesOf(amount, unit)).toBe(minutes);
  });

  test.each([
    ["", "hours"], ["  ", "minutes"], ["0", "minutes"], ["-1", "hours"], ["abc", "hours"],
    ["1.5", "minutes"], ["0.33", "hours"], ["601", "minutes"], ["10.5", "hours"],
  ] as const)("%j %s means nothing the server would take", (amount, unit) => {
    expect(minutesOf(amount, unit)).toBeNull();
  });
});

describe("amountIn", () => {
  test("keeps the length across a unit switch", () => {
    expect(amountIn("2", "hours", "minutes")).toBe("120");
    expect(amountIn("90", "minutes", "hours")).toBe("1.5");
    expect(amountIn("45", "minutes", "hours")).toBe("0.75");
    expect(amountIn("60", "minutes", "minutes")).toBe("60");
  });

  test("leaves what means nothing yet as typed", () => {
    expect(amountIn("", "hours", "minutes")).toBe("");
    expect(amountIn("abc", "minutes", "hours")).toBe("abc");
  });
});

describe("clockOf — the time a plan runs until (2026-10-26)", () => {
  test("a 24-hour time in the server's form", () => {
    expect(clockOf("00:40")).toBe("00:40");
    expect(clockOf("0:40")).toBe("00:40");
    expect(clockOf("23:59")).toBe("23:59");
    expect(clockOf(" 9.05 ")).toBe("09:05");
  });

  test("nothing it would refuse", () => {
    for (const bad of ["", "24:00", "25:80", "12:60", "9", "0940", "12:5", "12:00:00", "-1:00", "ab:cd"]) {
      expect(clockOf(bad)).toBeNull();
    }
  });
});

describe("isNextDay", () => {
  test("an end after midnight is tomorrow, the same evening is today", () => {
    const now = new Date(2026, 9, 26, 23, 50);
    expect(isNextDay(new Date(2026, 9, 27, 0, 40).toISOString(), now)).toBe(true);
    expect(isNextDay(new Date(2026, 9, 26, 23, 59).toISOString(), now)).toBe(false);
  });
});

/** One box, said as at a counter (2026-11-05). */
describe("parseDuration", () => {
  test.each([
    ["1ч", 60], ["1 ч", 60], ["2 часа", 120], ["1.5ч", 90], ["1,5 ч", 90], ["1h", 60], ["2 hours", 120], ["1 ժ", 60], ["1ժամ", 60],
    ["30мин", 30], ["30 мин", 30], ["45м", 45], ["20 минут", 20], ["30 min", 30], ["15m", 15], ["30 ր", 30], ["30 րոպե", 30],
    ["1ч 30мин", 90], ["1ч30м", 90], ["1 ч 30 мин", 90], ["1h30", 90], ["1h 30m", 90], ["2ч 15", 135], ["1Ч 30МИН", 90],
    ["1:30", 90], ["0:45", 45], ["10:00", 600],
    ["2", 120], ["1.5", 90], ["0.5", 30], ["10", 600], ["30", 30], ["90", 90], ["600", 600],
    ["  1ч   30мин  ", 90], ["мин30", null],
  ] as const)("%j is %s minutes", (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });

  test.each([
    [""], ["   "], ["abc"], ["0"], ["0ч"], ["0 мин"], ["-1"], ["601"], ["11ч"], ["10ч 1мин"], ["1:60"], ["1:5"],
    ["0.33ч"], ["1.5 мин"], ["ч"], ["мин"], ["1ч мин"], ["30 мин 1ч"], ["1 д"], ["1ч30мин5"],
  ] as const)("%j means nothing the server would take", (text) => {
    expect(parseDuration(text)).toBeNull();
  });

  test("follows another ceiling", () => {
    // Past 2 hours a bare number can only be minutes.
    expect(parseDuration("2", 120)).toBe(120);
    expect(parseDuration("3", 120)).toBe(3);
    expect(parseDuration("3ч", 120)).toBeNull();
    expect(parseDuration("90", 120)).toBe(90);
  });
});

describe("the two boxes of the time-style field", () => {
  const d = (hours: string, minutes: string) => ({ hours, minutes });

  test.each([
    [d("1", "30"), 90], [d("1", ""), 60], [d("", "30"), 30], [d("0", "45"), 45], [d("10", "00"), 600], [d("2", "05"), 125],
    // minutes past 59 while typed mean that many minutes
    [d("1", "60"), 120], [d("", "90"), 90], [d("", "600"), 600], [d("1.", ""), 60],
  ] as const)("%j is %i minutes", (draft, minutes) => {
    expect(draftMinutes(draft)).toBe(minutes);
  });

  test.each([
    [d("", "")], [d("0", "00")], [d("10", "01")], [d("11", "")], [d("10", "60")], [d("a", "")], [d("1", "x")], [d("1ч", "")], [d("1", "1000")],
  ] as const)("%j means nothing the server would take", (draft) => {
    expect(draftMinutes(draft)).toBeNull();
  });

  test("draftOf lays minutes out in both boxes", () => {
    expect(draftOf(90)).toEqual(d("1", "30"));
    expect(draftOf(45)).toEqual(d("0", "45"));
    expect(draftOf(120)).toEqual(d("2", "00"));
  });

  describe("typing into the hours", () => {
    test.each([
      // no digit alone jumps on; two that are hours do
      ["1", d("1", ""), false], ["3", d("3", ""), false], ["0", d("0", ""), false], ["10", d("10", ""), false],
      // past the ceiling it is minutes: "30мин" typed key by key never becomes 3 h
      ["30", d("", "30"), true], ["45", d("", "45"), true], ["90", d("", "90"), true], ["120", d("", "120"), true],
      ["30м", d("", "30"), true], ["5 мин", d("", "5"), true], ["15m", d("", "15"), true],
      // a separator or an hour unit goes on to the minutes: "1 30", "1ч…"
      ["1 ", d("1", ""), true], ["1:", d("1", ""), true], ["1ч", d("1", ""), true], ["1 час", d("1", ""), true], ["2h", d("2", ""), true],
      // said in one go
      ["1ч 30мин", d("1", "30"), true], ["1 30", d("1", "30"), true], ["1:30", d("1", "30"), true], ["1.30", d("1", "30"), true],
      ["1,30", d("1", "30"), true], ["90 мин", d("", "90"), true], ["1h30", d("1", "30"), true],
      // on its way to "1.5": kept as typed
      ["1.", d("1.", ""), false],
      ["", d("", ""), false],
    ] as const)("%j → %j (on to minutes: %s)", (text, draft, toMinutes) => {
      const r = typeIntoHours(text, EMPTY_DRAFT);
      expect({ draft: r.draft, toMinutes: r.toMinutes }).toEqual({ draft, toMinutes });
    });

    test("keeps the minutes already there", () => {
      expect(typeIntoHours("2", d("1", "30")).draft).toEqual(d("2", "30"));
    });

    test("unreadable stays as typed, and the boxes say it is no length", () => {
      const r = typeIntoHours("abc", EMPTY_DRAFT);
      expect(r.draft.hours).toBe("abc");
      expect(draftMinutes(r.draft)).toBeNull();
    });

    test("30мин typed key by key, the keys landing where focus goes, is 30 minutes", () => {
      // "3" (hours) → "30" (hours, past 10 h: minutes, on) → "м", "и", "н" (minutes).
      let s = typeIntoHours("3", EMPTY_DRAFT).draft;
      const r = typeIntoHours("30", s);
      expect(r.toMinutes).toBe(true);
      s = r.draft;
      for (const k of ["м", "и", "н"]) s = typeIntoMinutes(s.minutes + k, s);
      expect(draftMinutes(s)).toBe(30);
    });

    test("1 час 30 мин typed key by key is 90 minutes", () => {
      let s = typeIntoHours("1", EMPTY_DRAFT).draft;
      const r = typeIntoHours("1 ", s);
      expect(r.toMinutes).toBe(true);
      s = r.draft;
      for (const k of "час 30 мин") s = typeIntoMinutes(s.minutes + k, s);
      expect(s).toEqual(d("1", "30"));
    });

    test("1.5ч typed key by key is 90 minutes", () => {
      let s = typeIntoHours("1", EMPTY_DRAFT).draft;
      s = typeIntoHours("1.", s).draft;
      // A decimal on its way stays in the box, and already means 90 minutes.
      const r = typeIntoHours("1.5", s);
      expect(r).toMatchObject({ draft: d("1.5", ""), toMinutes: false });
      expect(draftMinutes(r.draft)).toBe(90);
      const u = typeIntoHours("1.5ч", r.draft);
      expect(u).toMatchObject({ draft: d("1", "30"), toMinutes: true });
    });

    test("1.30 typed key by key is 1 h 30 min, never 1.3 h + a carried 0", () => {
      let s = EMPTY_DRAFT;
      let inMinutes = false;
      for (const k of "1.30") {
        if (inMinutes) { s = typeIntoMinutes(s.minutes + k, s); continue; }
        const r = typeIntoHours(s.hours + k, s);
        s = r.draft;
        inMinutes = r.toMinutes;
      }
      expect(s).toEqual(d("1", "30"));
    });

    test("a decimal left in the hours is laid out once the field is left", () => {
      expect(settleDuration(d("1.5", ""))).toEqual(d("1", "30"));
      expect(settleDuration(d("0,5", ""))).toEqual(d("0", "30"));
      expect(settleDuration(d("2", "15"))).toEqual(d("2", "15"));
      // two digits after the point are minutes: 1 h 33
      expect(settleDuration(d("1.33", ""))).toEqual(d("1", "33"));
      // not a whole number of minutes: left as typed, and no length
      expect(settleDuration(d("1.333", ""))).toEqual(d("1.333", ""));
      expect(draftMinutes(d("1.333", ""))).toBeNull();
      expect(draftMinutes(d("1.60", ""))).toBeNull();
      expect(stepDraft(d("1.5", ""), "hours", 1)).toEqual(d("2", "30"));
    });

    test("hours and minutes pasted apart into the minutes box are read whole", () => {
      expect(typeIntoMinutes("1 30", d("", ""))).toEqual(d("1", "30"));
      expect(typeIntoMinutes("1.30", d("", ""))).toEqual(d("1", "30"));
      expect(typeIntoMinutes("30 мин", d("1", ""))).toEqual(d("1", "30"));
    });
  });

  describe("typing into the minutes", () => {
    test.each([
      ["3", d("1", "3")], ["30", d("1", "30")], ["30мин", d("1", "30")], ["45 m", d("1", "45")], ["ас", d("1", "")],
      // past 59: kept as typed, laid out on leaving
      ["75", d("1", "75")], ["90", d("1", "90")], ["", d("1", "")],
    ] as const)("%j with 1 h → %j", (text, draft) => {
      expect(typeIntoMinutes(text, d("1", ""))).toEqual(draft);
    });

    test("past 59 is laid out once the field is left: 90 → 1 h 30 min, 1 h + 75 → 2 h 15", () => {
      expect(typeIntoMinutes("90", EMPTY_DRAFT)).toEqual(d("", "90"));
      expect(settleDuration(d("", "90"))).toEqual(d("1", "30"));
      expect(settleDuration(d("1", "75"))).toEqual(d("2", "15"));
      expect(settleDuration(d("", "600"))).toEqual(d("10", "00"));
      expect(settleDuration(d("10", "90"))).toEqual(d("10", "90"));
    });

    test("a carry past the ceiling stays as typed (no length)", () => {
      expect(draftMinutes(typeIntoMinutes("90", d("10", "")))).toBeNull();
    });

    test("a whole length pasted here lands in both boxes", () => {
      expect(typeIntoMinutes("2ч 15мин", d("1", ""))).toEqual(d("2", "15"));
      expect(typeIntoMinutes("1:45", d("", ""))).toEqual(d("1", "45"));
    });
  });

  describe("the arrow keys", () => {
    test("an hour in the hours box, never below 0 or past 10 h", () => {
      expect(stepDraft(d("1", "30"), "hours", 1)).toEqual(d("2", "30"));
      expect(stepDraft(d("0", "30"), "hours", -1)).toEqual(d("0", "00"));
      expect(stepDraft(d("9", "30"), "hours", 1)).toEqual(d("10", "00"));
    });

    test("five minutes in the minutes box, to the next 5, carrying into the hours", () => {
      expect(stepDraft(d("", ""), "minutes", 1)).toEqual(d("0", "05"));
      expect(stepDraft(d("1", "33"), "minutes", 1)).toEqual(d("1", "35"));
      expect(stepDraft(d("1", "33"), "minutes", -1)).toEqual(d("1", "30"));
      expect(stepDraft(d("1", "55"), "minutes", 1)).toEqual(d("2", "00"));
      expect(stepDraft(d("1", "00"), "minutes", -1)).toEqual(d("0", "55"));
    });
  });
});

describe("parseDuration reads \"1 30\" as said", () => {
  test.each([
    ["1 30", 90], ["2 05", 125], ["1 5", 65], ["0 45", 45],
    // two digits after the point are minutes (as "1:30"); one is a decimal; a unit makes it hours
    ["1.30", 90], ["1,30", 90], ["0.45", 45], ["1.5", 90], ["1.25ч", 75],
  ] as const)("%j is %i minutes", (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });
});

/** A clock time in two boxes, no ":" to type (2026-11-05). */
describe("the clock field", () => {
  const d = (hours: string, minutes: string) => ({ hours, minutes });

  test.each([
    [d("14", "30"), "14:30"], [d("0", "40"), "00:40"], [d("9", "05"), "09:05"], [d("23", "59"), "23:59"], [d("00", "00"), "00:00"],
  ] as const)("%j is %s", (draft, hhmm) => {
    expect(clockOfDraft(draft)).toBe(hhmm);
  });

  test.each([
    [d("", "")], [d("14", "")], [d("14", "5")], [d("24", "00")], [d("14", "60")], [d("ab", "00")], [d("", "30")],
  ] as const)("%j is no time yet", (draft) => {
    expect(clockOfDraft(draft)).toBeNull();
  });

  describe("typing into the hour", () => {
    test.each([
      ["0", d("0", ""), false], ["1", d("1", ""), false], ["2", d("2", ""), false],
      ["3", d("3", ""), true], ["9", d("9", ""), true],
      ["14", d("14", ""), true], ["23", d("23", ""), true], ["00", d("00", ""), true],
      ["25", d("2", "5"), true], ["99", d("9", "9"), true],
      ["930", d("9", "30"), true], ["0040", d("00", "40"), true], ["1430", d("14", "30"), true],
      ["14:", d("14", ""), true], ["9.", d("9", ""), true], ["14 ", d("14", ""), true],
      ["14:30", d("14", "30"), true], ["14.30", d("14", "30"), true], ["14 30", d("14", "30"), true], ["0:40", d("00", "40"), true],
      ["", d("", ""), false],
    ] as const)("%j → %j (on to minutes: %s)", (text, draft, toMinutes) => {
      const r = typeIntoClockHours(text, EMPTY_DRAFT);
      expect({ draft: r.draft, toMinutes: r.toMinutes }).toEqual({ draft, toMinutes });
    });

    test("unreadable stays as typed and is no time", () => {
      const r = typeIntoClockHours("abc", EMPTY_DRAFT);
      expect(r.draft.hours).toBe("abc");
      expect(clockOfDraft(r.draft)).toBeNull();
    });

    test("1430 typed key by key, with no colon, is 14:30", () => {
      let s = EMPTY_DRAFT;
      let r = typeIntoClockHours("1", s); s = r.draft; expect(r.toMinutes).toBe(false);
      r = typeIntoClockHours("14", s); s = r.draft; expect(r.toMinutes).toBe(true);
      s = typeIntoClockMinutes("3", s);
      s = typeIntoClockMinutes("30", s);
      expect(clockOfDraft(s)).toBe("14:30");
    });

    test("930 typed key by key is 09:30", () => {
      const r = typeIntoClockHours("9", EMPTY_DRAFT);
      expect(r.toMinutes).toBe(true);
      let s = typeIntoClockMinutes("3", r.draft);
      s = typeIntoClockMinutes("30", s);
      expect(clockOfDraft(s)).toBe("09:30");
    });
  });

  describe("typing into the minutes", () => {
    test.each([
      ["3", d("14", "3")], ["30", d("14", "30")], ["6", d("14", "06")], ["9", d("14", "09")], ["305", d("14", "305")],
      ["3a", d("14", "3")], ["", d("14", "")], ["9:15", d("09", "15")],
    ] as const)("%j with 14 → %j", (text, draft) => {
      expect(typeIntoClockMinutes(text, d("14", ""))).toEqual(draft);
    });
  });

  test("leaving writes it out: an hour alone is on the hour, one minute digit is that minute", () => {
    expect(settleClock(d("9", ""))).toEqual(d("09", "00"));
    expect(settleClock(d("14", "5"))).toEqual(d("14", "05"));
    expect(settleClock(d("0", "40"))).toEqual(d("00", "40"));
    expect(settleClock(d("25", "00"))).toEqual(d("25", "00"));
    expect(settleClock(d("abc", ""))).toEqual(d("abc", ""));
    expect(settleClock(d("", ""))).toEqual(d("", ""));
  });

  test("the arrows go round the clock", () => {
    expect(stepClock(d("14", "30"), "hours", 1)).toEqual(d("15", "30"));
    expect(stepClock(d("23", "30"), "hours", 1)).toEqual(d("00", "30"));
    expect(stepClock(d("00", "30"), "hours", -1)).toEqual(d("23", "30"));
    expect(stepClock(d("14", "33"), "minutes", 1)).toEqual(d("14", "35"));
    expect(stepClock(d("14", "55"), "minutes", 1)).toEqual(d("15", "00"));
    expect(stepClock(d("00", "00"), "minutes", -1)).toEqual(d("23", "55"));
    expect(stepClock(d("", ""), "hours", 1)).toEqual(d("01", "00"));
    expect(stepClock(d("9", ""), "minutes", 1)).toEqual(d("09", "05"));
  });
});

/**
 * Minutes typed key by key are never cut short (second review, 2026-11-05):
 * "120" through the hours is 2 h, and a digit after two in the minutes box
 * carries, as typed. Retyping a filled box is the field's job: it selects
 * the box on entry (TwoBoxField, e2e «correcting a filled length…»).
 */
describe("minutes typed key by key", () => {
  const d = (hours: string, minutes: string) => ({ hours, minutes });
  const keys = (sequence: string) => {
    let s = EMPTY_DRAFT;
    let inMinutes = false;
    for (const k of sequence) {
      if (inMinutes) { s = typeIntoMinutes(s.minutes + k, s); continue; }
      const r = typeIntoHours(s.hours + k, s);
      s = r.draft;
      inMinutes = r.toMinutes;
    }
    return s;
  };

  test.each([["120", 120], ["150", 150], ["300", 300], ["90", 90], ["30мин", 30], ["1 30", 90], ["2ч 15мин", 135]] as const)(
    "%j is %i minutes", (sequence, minutes) => {
      expect(draftMinutes(keys(sequence))).toBe(minutes);
    },
  );

  test("the move says whether it wrote the minutes", () => {
    expect(typeIntoHours("30", d("1", "30")).wroteMinutes).toBe(true);
    expect(typeIntoHours("1.30", d("1", "30")).wroteMinutes).toBe(true);
    expect(typeIntoHours("1.5", d("1", "30")).wroteMinutes).toBe(false);
    expect(typeIntoHours("2 ", d("1", "30")).wroteMinutes).toBe(false);
    expect(typeIntoHours("10", d("1", "30")).wroteMinutes).toBe(false);
    expect(typeIntoClockHours("25", d("1", "5")).wroteMinutes).toBe(true);
    expect(typeIntoClockHours("1430", EMPTY_DRAFT).wroteMinutes).toBe(true);
    expect(typeIntoClockHours("14", d("", "30")).wroteMinutes).toBe(false);
  });
});

describe("key by key, nothing rewritten while typed (third review, 2026-11-05)", () => {
  const d = (hours: string, minutes: string) => ({ hours, minutes });
  const keys = (sequence: string) => {
    let s = EMPTY_DRAFT;
    let inMinutes = false;
    for (const k of sequence) {
      if (inMinutes) { s = typeIntoMinutes(s.minutes + k, s); continue; }
      const r = typeIntoHours(s.hours + k, s);
      s = r.draft;
      inMinutes = r.toMinutes;
    }
    return s;
  };
  test.each([["600", 600], ["120", 120], ["90", 90], ["601", null], ["1.60", null], ["10.5", null]] as const)(
    "%j is %s minutes", (sequence, minutes) => {
      expect(draftMinutes(keys(sequence))).toBe(minutes);
    },
  );
  test("1.60 is refused, never re-read as 1.6 h", () => {
    expect(parseDuration("1.60")).toBeNull();
    expect(parseDuration("1.75")).toBeNull();
  });
  test("a clock time typed key by key with a digit too many is no time, never a shorter one", () => {
    let s = EMPTY_DRAFT;
    let inMinutes = false;
    for (const k of "2400") {
      if (inMinutes) { s = typeIntoClockMinutes(s.minutes + k, s); continue; }
      const r = typeIntoClockHours(s.hours + k, s);
      s = r.draft;
      inMinutes = r.toMinutes;
    }
    expect(clockOfDraft(s)).toBeNull();
    expect(clockOfDraft(settleClock(s))).toBeNull();
  });
  test("an extra digit after a full minute is no time either: 14:30 + 4", () => {
    expect(clockOfDraft(typeIntoClockMinutes("304", d("14", "30")))).toBeNull();
  });
});

describe("fourth review (2026-11-05)", () => {
  const d = (hours: string, minutes: string) => ({ hours, minutes });
  const keys = (sequence: string) => {
    let s = EMPTY_DRAFT;
    let inMinutes = false;
    for (const k of sequence) {
      if (inMinutes) { s = typeIntoMinutes(s.minutes + k, s); continue; }
      const r = typeIntoHours(s.hours + k, s);
      s = r.draft;
      inMinutes = r.toMinutes;
    }
    return s;
  };
  test.each([["100", 100], ["105", 105], ["110", 110], ["10", 600], ["10 30", null], ["1500", null], ["10 0", 600]] as const)(
    "%j typed key by key is %s minutes", (sequence, minutes) => {
      expect(draftMinutes(keys(sequence))).toBe(minutes);
    },
  );
  test("a fourth minute digit is kept, never dropped", () => {
    expect(typeIntoMinutes("1500", d("", ""))).toEqual(d("", "1500"));
    expect(draftMinutes(d("", "1500"))).toBeNull();
  });
  test("typing a 0 over minutes is a 0 (Backspace over a pad is the field's: e2e)", () => {
    expect(typeIntoClockMinutes("0", d("14", "07"))).toEqual(d("14", "0"));
    expect(typeIntoClockMinutes("05", d("14", "0"))).toEqual(d("14", "05"));
  });
});
