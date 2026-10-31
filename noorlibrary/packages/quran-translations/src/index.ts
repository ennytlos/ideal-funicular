// src/lib/indigenous-translations.ts
// Nigerian indigenous-language Qur'an translations.
//
// Sources:
// - Yorùbá: Shaykh Abu Rahimah Mikail Aykyuni — QuranEnc `yoruba_mikail` (verbatim, full tone marks)
// - Hausa:  Sheikh Abubakar Mahmoud Gumi      — QuranEnc `hausa_gummi`   (verbatim, ɓ ɗ ƙ ƴ ã ĩ)
// - Igbo:   No published online source available yet. Only the bundled verses below exist and they
//           are UNVERIFIED — they must be reviewed by a qualified Igbo scholar before being treated
//           as authoritative.
//
// Resolution order (Hausa/Yorùbá): live QuranEnc cache, bundled verbatim offline copy, English.
// When no indigenous text exists, the English text is returned unmodified and `isFallback` is true,
// so the UI can label it honestly. Never prepend or invent text in place of a verse translation.
//
// NOTE: This file is generated identically for web and mobile. Keep both copies in sync.

export type SupportedLanguage = "en" | "yoruba" | "hausa" | "igbo";
export type IndigenousLanguage = Exclude<SupportedLanguage, "en">;

export const TRANSLATION_SOURCES: Record<
  SupportedLanguage,
  { languageName: string; translator: string; verified: boolean }
> = {
  en: { languageName: "English", translator: "Sahih International", verified: true },
  yoruba: { languageName: "Yorùbá", translator: "Shaykh Abu Rahimah Mikail Aykyuni", verified: true },
  hausa: { languageName: "Hausa", translator: "Sheikh Abubakar Mahmoud Gumi", verified: true },
  igbo: { languageName: "Igbo", translator: "Selected verses (under scholarly review)", verified: false },
};

const FETCH_TIMEOUT_MS = 10000;

// In-memory cache for dynamically fetched surahs (lang -> surahId -> verseId -> text)
export const dynamicCache: Record<string, Record<number, Record<number, string>>> = {
  hausa: {},
  yoruba: {},
  igbo: {},
};

const TRANSLATION_CACHE_STORAGE_KEY = "noor_quran_translation_cache_v1";

export interface TranslationCacheStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

let cacheStorage: TranslationCacheStorage | null = null;
let cacheHydration: Promise<void> = Promise.resolve();

function hydrateCacheFromRaw(raw: string | null): void {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, Record<number, Record<number, string>>>;
    if (!parsed || typeof parsed !== "object") return;

    for (const lang of Object.keys(dynamicCache)) {
      const savedSurahs = parsed[lang];
      if (!savedSurahs || typeof savedSurahs !== "object") continue;
      dynamicCache[lang] = { ...dynamicCache[lang], ...savedSurahs };
    }
  } catch {
    // Ignore malformed cached data; translations can be fetched again.
  }
}

export function configureTranslationCacheStorage(storage: TranslationCacheStorage): void {
  cacheStorage = storage;
  try {
    const result = storage.getItem(TRANSLATION_CACHE_STORAGE_KEY);
    if (result && typeof (result as Promise<string | null>).then === "function") {
      cacheHydration = Promise.resolve(result).then(hydrateCacheFromRaw).catch(() => undefined);
    } else {
      hydrateCacheFromRaw(result as string | null);
      cacheHydration = Promise.resolve();
    }
  } catch {
    cacheHydration = Promise.resolve();
  }
}

function persistTranslationCache(): void {
  if (!cacheStorage) return;
  try {
    void Promise.resolve(
      cacheStorage.setItem(TRANSLATION_CACHE_STORAGE_KEY, JSON.stringify(dynamicCache))
    ).catch(() => undefined);
  } catch {
    // Ignore storage write failures; the app still works without persistence.
  }
}

// Deduplicates concurrent requests for the same surah (key: `${lang}:${surahId}`)
const inFlight: Record<string, Promise<Record<number, string> | null>> = {};

// Bundled offline copy. Hausa/Yorùbá are verbatim from QuranEnc; Igbo is unverified (see header).
export const AUTHENTIC_INDIGENOUS_VERSES: Record<
  string,
  { yoruba?: string; hausa?: string; igbo?: string }
> = {
  "1:1": {"yoruba":"Ní orúkọ Allāhu, Àjọkẹ́-ayé, Àṣàkẹ́-ọ̀run.","hausa":"Da sũnan Allah, Mai rahama, Mai jin ƙai.","igbo":"N'aha Allah, Onye Ebere, Onye Ọmịko."},
  "1:2": {"yoruba":"Gbogbo ẹyìn ń jẹ́ ti Allāhu, Olúwa gbogbo ẹ̀dá (àgbáńlá ayé àti ọ̀run),","hausa":"Godiya ta tabbata ga Allah, Ubangijin halittu;","igbo":"Otuto niile dịrị Allah, Onye nwe ụwa dum."},
  "1:3": {"yoruba":"Àjọkẹ́-ayé, Àṣàkẹ́-ọ̀run,","hausa":"Mai rahama, Mai jin ƙai;","igbo":"Onye Ebere, Onye Ọmịko."},
  "1:4": {"yoruba":"Ọba Olùkápá-ọjọ́-ẹ̀san.","hausa":"Mai nuna Mulkin Rãnar Sakamako.","igbo":"Onye nwe Ụbọchị Ikpe."},
  "1:5": {"yoruba":"Ìwọ nìkan ni à ń jọ́sìn fún. Ọ̀dọ̀ Rẹ nìkan sì ni à ń wá ìrànlọ́wọ́ sí.","hausa":"Kai muke bautawa, kuma Kai kadai muke neman taimakonKa","igbo":"Sọ Gị ka anyị na-efe, sọ Gị kwa ka anyị na-arịọ enyemaka."},
  "1:6": {"yoruba":"Fi ẹsẹ̀ wa rinlẹ̀ l’ójú ọ̀nà tààrà (ẹ̀sìn ’Islām),","hausa":"Ka shiryar da mu ga hanya madaidaiciya.","igbo":"Duo anyị n'ụzọ ziri ezi."},
  "1:7": {"yoruba":"ọ̀nà àwọn tí O ṣe ìdẹ̀ra fún, yàtọ̀ sí (ọ̀nà) àwọn ẹni-ìbínú (ìyẹn, àwọn yẹhudi) àti (ọ̀nà) àwọn olùṣìnà (ìyẹn, àwọn nasọ̄rọ̄).","hausa":"Hanyar waɗanda Ka yi wa ni'ima, ba waɗanda aka yi wa fushi ba, kuma ba ɓatattu ba.","igbo":"Ụzọ nke ndị I wụkwasịrị amara Gị, ọ bụghị nke ndị I wutere iwe ma ọ bụ ndị kpafuru akpafu."},
  "2:255": {"yoruba":"Allāhu, kò sí ọlọ́hun kan tí a gbọ́dọ̀ jọ́sìn fún ní ọ̀nà òdodo àyàfi Òun, Alààyè, Alámòjúútó-ẹ̀dá. Òògbé kì í ta Á. Àti pé oorun kì í kùn Ún. TiRẹ̀ ni ohunkóhun tó wà nínú àwọn sánmọ̀ àti ohunkóhun tó wà nínú ilẹ̀. Ta ni ẹni tí ó máa ṣìpẹ̀ lọ́dọ̀ Rẹ̀ àfi pẹ̀lú ìyọ̀ǹda Rẹ̀? Ó mọ ohun tí ń bẹ níwájú wọn àti ohun tí ń bẹ lẹ́yìn wọn. Wọn kò sì ní ìmọ̀ àmọ̀tán nípa kiní kan nínú ìmọ̀ Rẹ̀ àfi ohun tí Ó bá fẹ́ (fi mọ̀ wọ́n). Àga Rẹ̀ gbààyè ju àwọn sánmọ̀ àti ilẹ̀. Ṣíṣọ́ sánmọ̀ àti ilẹ̀ kò sì dá A lágara. Allāhu ga, Ó tóbi.","hausa":"Allah, bãbu wani Ubangiji fãce Shi, Rãyayye, Mai tsayuwa da kõme, gyangyaɗi bã ya kãma Shi, kuma barci bã ya kãma Shi, Shi ne da abin da yake a cikin sammai da abin da yake a cikin ƙasa. Wane ne wanda yake yin cẽto a wurinSa, fãce da izninSa? Yana sanin abin da yake a gaba gare su da abin da yake a bãyansu. Kuma bã su kẽwayẽwa da kõme daga ilminSa, fãce da abin da Ya so. KursiyyunSa ya yalwaci sammai da ƙasa. Kuma tsare su bã ya nauyayarSa. Kuma Shi ne Maɗaukaki, Mai girma.","igbo":"Allah! Ọ dịghị chi ọzọ ma e wezụga Ya, Onye Dị Ndụ, Onye Na-elekọta ihe niile. Ụra ma ọ bụ arụ ụra anaghị ejide Ya. Nke Ya ka ihe niile dị n'eluigwe na ihe niile dị n'ụwa bụ. Onye bụ onye ahụ ga-arịọchitere mmadụ n'ihu Ya ma e wezụga site na ikike Ya? Ọ maara ihe dị n'ihu ha na ihe dị n'azụ ha, ha enweghịkwa ike ịghọta ihe ọ bụla n'ihe ọmụma Ya ma e wezụga nke Ọ chọrọ. Ocheeze Ya gbasapụrụ eluigwe na ụwa, ichebe ha abụọ anaghịkwa arọ Ya ahụ. Ọ bụkwa Onye Kasị Elu, Onye Kasị Ukwuu."},
  "97:1": {"yoruba":"Dájúdájú Àwa sọ al-Ƙur’ān kalẹ̀ nínú Òru Abiyì.","hausa":"Lalle ne Mũ, Mun saukar da shi (Alƙur'ãni) a cikin Lailatul ƙadari (daren daraja)","igbo":"N'ezie, Anyị kpughere ya (Quran) n'Abalị nke Ikpe (Lailatul Qadr)."},
  "97:2": {"yoruba":"Kí sì ni ó mú ọ mọ ohun tó ń jẹ́ Òru Abiyì?","hausa":"To, me ya sanar da kai abin da ake cewa Lailatul ¡adari?","igbo":"Gịnị ga-eme ka ị mara ihe Abalị nke Ikpe bụ?"},
  "97:3": {"yoruba":"Òru Abiyì lóore ju ẹgbẹ̀rún oṣù.","hausa":"Lailatul ¡adari mafi alheri ne daga wasu watanni dubu.","igbo":"Abalị nke Ikpe dị mma karịa puku ọnwa."},
  "97:4": {"yoruba":"Àwọn mọlāika àti Jibrīl yó sì máa sọ̀kalẹ̀ nínú òru náà pẹ̀lú àṣẹ Olúwa wọn fún gbogbo ọ̀rọ̀ ẹ̀dá kọ̀ọ̀kan.","hausa":"Mala'iku da Rũhi suna sauka a cikinsa da iznin Ubangijinsu sabõda kowane umurni.","igbo":"Ndị mụọ ozi na Mmụọ Nsọ (Jibril) na-agbadata na ya site n'ikike nke Onye nwe ha maka ihe niile."},
  "97:5": {"yoruba":"Àlàáfíà ni òru náà títí di àsìkò àfẹ̀mọ́júmọ́.","hausa":"Sallama ne shi daren, har fitar alfijiri.","igbo":"Udo ka ọ bụ ruo mgbe ụtụtụ ga-awa."},
  "103:1": {"yoruba":"Allāhu fi àkókò ìrọ̀lẹ́ ayé búra.","hausa":"Ina rantsuwa da zãmani.","igbo":"Site n'oge (oge ndụ mmadụ)."},
  "103:2": {"yoruba":"Dájúdájú ènìyàn wà nínú òfò.","hausa":"Lalle ne mutum yana a cikin hasara.","igbo":"N'ezie, mmadụ nọ n'ime mfu."},
  "103:3": {"yoruba":"Àyàfi àwọn tó gbàgbọ́ ní òdodo, tí wọ́n ṣe àwọn iṣẹ́ rere, tí wọ́n sọ àsọtẹ́lẹ̀ òdodo láààrin ara wọn, tí wọ́n sì tún sọ àsọtẹ́lẹ̀ sùúrù láààrin ara wọn.","hausa":"Fãce waɗanda suka yi ĩmani, kuma suka aikata ayyukan ƙwarai, kuma suka yi wa juna wasiyya da bin gaskiya, kuma suka yi wa juna wasiyya da yin haƙuri (su kam, basu cikin hasara).","igbo":"Ma e wezụga ndị kweere na Chineke ma mee ezi omume, ma na-adụkọrịta onwe ha ọdụ n'eziokwu na ntachi obi."},
  "108:1": {"yoruba":"Dájúdájú Àwa fún ọ ní ọ̀pọ̀lọ́pọ̀ oore.","hausa":"Lalle ne Mu, Mun yi maka kyauta mai yawa.","igbo":"N'ezie, Anyị enyela gị Al-Kawthar (ọtụtụ ngọzi)."},
  "108:2": {"yoruba":"Nítorí náà, kírun fún Olúwa rẹ, kí o sì gúnran (fún Un).","hausa":"Saboda haka, ka yi salla dõmin Ubangijinka, kuma ka sõke (baiko, wato sukar raƙumi).","igbo":"Ya mere kpee ekpere nye Onye nwe gị ma chụọ àjà."},
  "108:3": {"yoruba":"Dájúdájú, ẹni tó ń bínú rẹ, òun ni kò níí lẹ́yìn.","hausa":"Lalle mai aibanta ka shi ne mai yankakkiyar albarka.","igbo":"N'ezie, onye na-akpọ gị asị bụ onye ebipụrụ ngọzi ya."},
  "109:1": {"yoruba":"Sọ pé: “Ẹ̀yin aláìgbàgbọ́,","hausa":"Ka ce: \"Ya kũ kãfirai!\"","igbo":"Kwuo sị: 'Unu ndị na-ekweghị ekwe!'"},
  "109:2": {"yoruba":"Èmi kò níí jọ́sìn fún ohun tí ẹ̀ ń jọ́sìn fún.","hausa":"\"Bã zan bautã wa abin da kuke bautã wa ba.\"","igbo":"Anaghị m efe ihe unu na-efe."},
  "109:3": {"yoruba":"Ẹ̀yin náà kò jọ́sìn fún Ẹni tí mò ń jọ́sìn fún.","hausa":"\"Kuma kũ, ba ku zama masu bauta wa abin da nake bautã wa ba.\"","igbo":"Unu anaghịkwa efe Onye m na-efe."},
  "109:4": {"yoruba":"Èmi kò níí jọ́sìn fún ohun tí ẹ jọ́sìn fún sẹ́.","hausa":"\"Kuma nĩ ban zama mai bautã wa abin da kuka bautã wa ba.\"","igbo":"Agaghịkwa m efe ihe unu fere."},
  "109:5": {"yoruba":"Ẹ̀yin náà kò kú jọ́sìn fún Ẹni tí mò ń jọ́sìn fún.","hausa":"\"Kuma kũ, ba ku zama mãsu bautã wa abin da nake bautã wa ba.\"","igbo":"Unu agaghịkwa efe Onye m na-efe."},
  "109:6": {"yoruba":"Tiyín ni ẹ̀sìn yín, tèmi sì ni ẹ̀sìn mi.”","hausa":"\"Addininku na garẽ ku, kuma addinina yanã gare ni.\"","igbo":"Unu nwere okpukpe unu, m nwekwara okpukpe m."},
  "110:1": {"yoruba":"Nígbà tí àrànṣe Allāhu (lórí ọ̀tá ẹ̀sìn) àti ṣíṣí ìlú (Mọ́kkah) bá ṣẹlẹ̀,","hausa":"Idan taimakon Allah ya zo da cin nasara.","igbo":"Mgbe enyemaka Allah na mmeri bịara."},
  "110:2": {"yoruba":"tí o sì rí àwọn ènìyàn tí wọ́n wọnú ẹ̀sìn Allāhu níjọníjọ,","hausa":"Kuma ka ga mutane suna shiga addinin Allah, ƙungiya-ƙungiya.","igbo":"I wee hụ ka ndị mmadụ na-abanye n'okpukpe Allah n'ìgwè n'ìgwè."},
  "110:3": {"yoruba":"nítorí náà, ṣe àfọ̀mọ́ àti ẹyìn fún Olúwa rẹ. Kí o sì tọrọ àforíjìn lọ́dọ̀ Rẹ̀. Dájúdájú Ó ń jẹ́ Olùgba-ìronúpìwàdà.","hausa":"To, ka yi tasbihi game da gõde wa Ubangijinka, kuma ka nẽme Shi gafara, lalle Shi (Ubangijinka) Ya kasance Mai karɓar tũba ne.","igbo":"Kwere otuto nye Onye nwe gị ma rịọ Ya mgbaghara; n'ezie Ọ na-anabata nchegharị mgbe niile."},
  "112:1": {"yoruba":"Sọ pé: “Òun ni Allāhu, Ọ̀kan ṣoṣo.","hausa":"\"Ka ce: \"Shi ne Allah Makaɗaĩci.\"","igbo":"Kwuo sị: 'Ọ bụ Allah, Onye ahụ bụ Otu.'"},
  "112:2": {"yoruba":"Allāhu ni Aṣíwájú tí ẹ̀dá ní bùkátà sí níbi jíjọ́sìn fún Un àti títọrọ oore ní ọ̀dọ̀ Rẹ̀, tí Òun kò sì ní bùkátà sí wọn ní ọ̀nà kan kan.","hausa":"\"Allah wanda ake nufin Sa da buƙata.\"","igbo":"Allah, Onye mmadụ niile na-adabere na Ya."},
  "112:3": {"yoruba":"Kò bímọ. Wọn kò sì bí I.","hausa":"\"Bai haifa ba, kuma ba a haife Shi ba.\"","igbo":"Ọ mụtaghị nwa, a mụtaghịkwa Ya."},
  "112:4": {"yoruba":"Kò sì sí ẹnì kan kan tí ó jọ Ọ́.”","hausa":"\"Kuma babu ɗaya da ya kasance kini a gare Shi","igbo":"Ọ dịghịkwa onye ọ bụla hà ka Ya."},
  "113:1": {"yoruba":"Sọ pé: “Mo sá di Olúwa òwúrọ̀ kùtùkùtù","hausa":"\"Ka ce \"ina neman tsari ga Ubangijin safiya\"","igbo":"Kwuo sị: 'Ana m achọ mgbaba n'aka Onye nwe ụtụtụ.'"},
  "113:2": {"yoruba":"níbi aburú ohun tí Ó dá,","hausa":"\"Daga sharrin abin da Ya halitta.\"","igbo":"Site n'ajọ ihe niile Ọ kere."},
  "113:3": {"yoruba":"àti níbi aburú òru nígbà tí ó bá ṣóòkùn,","hausa":"\"Da sharrin dare, idan ya yi duhu.\"","igbo":"Na site n'ọchịchịrị abalị mgbe ọ gbasara."},
  "113:4": {"yoruba":"àti níbi aburú àwọn (òpìdán) tó ń fẹnu fátẹ́gùn túẹ́túẹ́ sínú àwọn ońdè,","hausa":"\"Da sharrin mãtã mãsu tõfi a cikin kuduri\"","igbo":"Na site n'aka ndị amoosu na-afụ na mkpụrụ eriri."},
  "113:5": {"yoruba":"àti níbi aburú onílara nígbà tí ó bá ṣe ìlara.”","hausa":"\"Da sharrin mai hãsada idan ya yi hasada.\"","igbo":"Na site n'ajọ omume nke onye anyaụfụ mgbe ọ na-enwe anyaụfụ."},
  "114:1": {"yoruba":"Sọ pé: “Mo sá di Olúwa àwọn ènìyàn,","hausa":"\"Ka ce \"Ina nẽman tsari ga Ubangijin mutãne.\"","igbo":"Kwuo sị: 'Ana m achọ mgbaba n'aka Onye nwe mmadụ.'"},
  "114:2": {"yoruba":"Ọba àwọn ènìyàn,","hausa":"\"Mamallakin mutane.\"","igbo":"Eze nke mmadụ."},
  "114:3": {"yoruba":"Ọlọ́hun àwọn ènìyàn,","hausa":"\"Abin bautãwar mutãne.\"","igbo":"Chi nke mmadụ."},
  "114:4": {"yoruba":"níbi aburú (aṣ-Ṣaetọ̄n) oníròyíròyí, olùsásẹ́yìn (fún ẹni tó bá ń dárúkọ Allāhu).","hausa":"\"Daga sharrin mai sanya wasuwãsi, mai ɓoyewa.\"","igbo":"Site n'ajọ ntamu nke onye na-agba izu ọjọọ na-ezoro ezo."},
  "114:5": {"yoruba":"(aṣ-Ṣaetọ̄n ni) ẹni tí ó ń kó ròyíròyí sínú àwọn ọkàn ènìyàn.","hausa":"\"Wanda ke sanya wasuwãsi a cikin ƙirãzan mutane.\"","igbo":"Onye na-atụba ajọ echiche n'obi ndị mmadụ."},
  "114:6": {"yoruba":"(Ṣaetọ̄n náà) wà nínú àwọn àlùjànnú àti àwọn ènìyàn.”","hausa":"\"Daga aljannu da mutane.\"","igbo":"N'etiti ndị mmụọ ọjọọ (Jinn) na ụmụ mmadụ."},
};

/**
 * Normalise to NFC (QuranEnc uses combining tone marks) and strip footnote markers like [1].
 */
function cleanText(text: string): string {
  if (!text) return "";
  return String(text)
    .normalize("NFC")
    .replace(/\[\d+\]/g, "")
    .replace(/\s\s+/g, " ")
    .trim();
}

async function fetchJsonWithTimeout(url: string): Promise<any | null> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Store verses only if we actually received some (avoids caching an empty surah forever). */
function storeVerses(
  lang: "hausa" | "yoruba",
  surahId: number,
  entries: Array<[number, string]>
): Record<number, string> | null {
  const valid = entries.filter(([v, t]) => Number.isFinite(v) && v > 0 && t);
  if (valid.length === 0) return null;
  const map: Record<number, string> = {};
  valid.forEach(([v, t]) => {
    map[v] = t;
  });
  dynamicCache[lang][surahId] = map;
  persistTranslationCache();
  return map;
}

async function fetchFromQuranEnc(lang: "hausa" | "yoruba", surahId: number) {
  const key = lang === "yoruba" ? "yoruba_mikail" : "hausa_gummi";
  const data = await fetchJsonWithTimeout(
    `https://quranenc.com/api/v1/translation/sura/${key}/${surahId}`
  );
  if (!data || !Array.isArray(data.result)) return null;
  return storeVerses(
    lang,
    surahId,
    data.result.map((item: { aya: string | number; translation: string }) => [
      parseInt(String(item.aya), 10),
      cleanText(item.translation),
    ])
  );
}

async function fetchFromCdn(lang: "hausa" | "yoruba", surahId: number) {
  // Diacritic-preserving editions (the `-la` variants strip all tone marks — do not use them).
  const edition = lang === "yoruba" ? "yor-shaykhaburahima" : "hau-abubakarmahmoud";
  const data = await fetchJsonWithTimeout(
    `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/${edition}/${surahId}.json`
  );
  if (!data || !Array.isArray(data.chapter)) return null;
  return storeVerses(
    lang,
    surahId,
    data.chapter.map((item: { verse: number; text: string }) => [
      Number(item.verse),
      cleanText(item.text),
    ])
  );
}

/**
 * Fetch and cache a full surah translation. QuranEnc first, jsDelivr mirror on any failure
 * (network error, non-2xx, malformed or empty payload). Resolves null if unavailable.
 */
export function fetchSurahTranslationAsync(
  lang: IndigenousLanguage,
  surahId: number
): Promise<Record<number, string> | null> {
  if (lang !== "hausa" && lang !== "yoruba") return Promise.resolve(null);

  const key = `${lang}:${surahId}`;
  if (key in inFlight) return inFlight[key];

  const promise = (async () => {
    await cacheHydration;
    const cached = dynamicCache[lang]?.[surahId];
    if (cached && Object.keys(cached).length > 0) return cached;

    const primary = await fetchFromQuranEnc(lang, surahId);
    if (primary) return primary;
    return fetchFromCdn(lang, surahId);
  })().finally(() => {
    delete inFlight[key];
  });

  inFlight[key] = promise;
  return promise;
}

export interface ResolvedTranslation {
  text: string;
  lang: SupportedLanguage;
  /** True when the requested language has no text for this verse and English is shown instead. */
  isFallback: boolean;
}

/**
 * Resolve a verse translation, reporting whether it fell back to English.
 */
export function resolveIndigenousTranslationDetailed(
  lang: string,
  surahId: number,
  verseId: number,
  defaultEn: string
): ResolvedTranslation {
  if (!lang || lang === "en") return { text: defaultEn, lang: "en", isFallback: false };

  const bundled = AUTHENTIC_INDIGENOUS_VERSES[`${surahId}:${verseId}`];

  if (lang === "hausa" || lang === "yoruba") {
    const live = dynamicCache[lang]?.[surahId]?.[verseId];
    if (live) return { text: live, lang, isFallback: false };
    const offline = bundled?.[lang];
    if (offline) return { text: offline, lang, isFallback: false };
    return { text: defaultEn, lang, isFallback: true };
  }

  if (lang === "igbo") {
    return { text: defaultEn, lang, isFallback: true };
  }

  return { text: defaultEn, lang: "en", isFallback: true };
}

/**
 * Synchronous resolver returning only the text (English when unavailable).
 * `surahName` is kept for backwards compatibility and is unused.
 */
export function resolveIndigenousTranslation(
  lang: string,
  surahId: number,
  verseId: number,
  defaultEn: string,
  _surahName?: string
): string {
  return resolveIndigenousTranslationDetailed(lang, surahId, verseId, defaultEn).text;
}

/**
 * Short, honest notice to show when English is displayed in place of the chosen language.
 */
export function getTranslationFallbackNotice(lang: string, isLoading = false): string {
  const name = TRANSLATION_SOURCES[lang as SupportedLanguage]?.languageName ?? lang;
  if (isLoading) return `Loading ${name} translation… showing English for now.`;
  if (lang === "igbo") return "Igbo translation is coming soon — showing English for now.";
  return `${name} translation unavailable (check your connection) — showing English.`;
}
