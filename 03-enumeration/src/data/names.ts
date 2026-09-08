// Macedonian name pools. Display names are Cyrillic; usernames are a Latin
// transliteration (the "mixed" choice). Surnames are stored in the male -ски form
// and feminized to -ска, which also drives realistic gendered display names.
//
// This file is intentionally dependency-free and module-agnostic so it can be
// copied verbatim into every module's src/data/.

export const MALE_FIRST: readonly string[] = [
  "Александар", "Бојан", "Стефан", "Марко", "Никола", "Дејан", "Горан",
  "Игор", "Владимир", "Филип", "Дарко", "Кирил", "Тодор", "Борис",
  "Зоран", "Љубе", "Ристо", "Панче", "Васко", "Драган", "Митко",
  "Сашо", "Благоја", "Трајко", "Огнен", "Дамјан", "Јован", "Петар",
];

export const FEMALE_FIRST: readonly string[] = [
  "Ана", "Марија", "Елена", "Ивана", "Билјана", "Весна", "Габриела",
  "Јасмина", "Сара", "Тамара", "Наташа", "Кристина", "Емилија", "Сузана",
  "Драгана", "Викторија", "Симона", "Катерина", "Марта", "Даниела",
  "Оливера", "Снежана", "Валентина", "Теодора", "Марина", "Лидија",
];

// Male form. Feminine form is derived by feminizeSurname().
export const SURNAMES_M: readonly string[] = [
  "Трајаноски", "Петровски", "Стојановски", "Николовски", "Ристовски",
  "Јовановски", "Димитриевски", "Ангеловски", "Тодоровски", "Спасовски",
  "Крстевски", "Илиевски", "Марковски", "Величковски", "Кузмановски",
  "Наумовски", "Митревски", "Христовски", "Лазаревски", "Ѓорѓиевски",
  "Ивановски", "Здравковски", "Костовски", "Богдановски", "Талевски",
  "Атанасовски", "Пауновски", "Симоновски", "Цветковски", "Огненовски",
];

export function feminizeSurname(surnameM: string): string {
  // "Петровски" -> "Петровска"
  return surnameM.replace(/и$/, "а");
}

// Macedonian Cyrillic -> Latin transliteration, for usernames only.
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", е: "e", ж: "zh",
  з: "z", ѕ: "dz", и: "i", ј: "j", к: "k", л: "l", љ: "lj", м: "m",
  н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ќ: "kj",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", џ: "dj", ш: "sh",
};

export function translit(cyr: string): string {
  return [...cyr.toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? "")
    .join("");
}

/** e.g. "Ана", "Петровска" -> "apetrovska". Caller appends a number for uniqueness. */
export function usernameBase(first: string, surname: string): string {
  return (translit(first)[0] ?? "x") + translit(surname);
}
