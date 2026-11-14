import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Home,
  MessageSquare,
  AudioLines,
  Library,
  Settings as SettingsIcon,
  ArrowUpRight,
  Volume2,
  Play,
  Square,
  RotateCcw,
  Star,
  Search,
  Plus,
  ArrowRight,
  Mic,
  Trash2,
  Pencil,
  ChevronDown,
  ShieldCheck,
  Download,
  Upload,
  X,
  Folder,
  ArrowUp,
  ArrowDown,
  Check,
  Sun,
  Moon,
  Monitor,
  Headphones,
} from "lucide-react";
import { Capacitor, registerPlugin } from "@capacitor/core";
const files = registerPlugin<{
  exportBackup(o: { name: string; data: string }): Promise<void>;
}>("EchoFiles");
import { App as NativeApp } from "@capacitor/app";
import {
  initialState,
  stateSchema,
  loadState,
  saveState,
  searchPhrases,
  removeCategory,
  upsertPhrase,
  toggleFavorite,
  getClips,
  putClip,
  deleteClip,
  exportBackup,
  restoreBackup,
  eraseData,
  type State,
  type Phrase,
  type Clip,
} from "../database/store";
import { speech, type Voice } from "../services/speech";
import { VoiceRecorder } from "../services/recorder";
import { adaptiveSpeechSettings } from "../services/adaptiveSpeech";
import LocalAiVoicePanel from "./LocalAiVoicePanel";
import SupertonicVoicePanel from "./SupertonicVoicePanel";
type Page = "home" | "communicate" | "voice" | "library" | "settings";
type Editor =
  | { kind: "phrase"; value?: Phrase }
  | { kind: "category"; id?: string; name?: string }
  | { kind: "profile" }
  | null;
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon" aria-label="Close / Закрыть" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function readRoute(): Page {
  const route = location.hash.slice(1);
  return ["home", "communicate", "voice", "library", "settings"].includes(route)
    ? (route as Page)
    : "home";
}
export default function App() {
  const [state, setState] = useState<State>(initialState),
    [ready, setReady] = useState(false),
    [fatal, setFatal] = useState("");
  const [page, setPage] = useState<Page>(readRoute),
    [text, setText] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [favorites, setFavorites] = useState(false),
    [notice, setNotice] = useState(""),
    [speaking, setSpeaking] = useState(false),
    [voices, setVoices] = useState<Voice[]>([]),
    [clips, setClips] = useState<Clip[]>([]),
    [recording, setRecording] = useState(false),
    [recordBusy, setRecordBusy] = useState(false),
    [clipName, setClipName] = useState(""),
    [editor, setEditor] = useState<Editor>(null),
    [confirm, setConfirm] = useState<{
      message: string;
      action: () => void;
    } | null>(null),
    [audioUrl, setAudioUrl] = useState("");
  const recorder = useRef(new VoiceRecorder()),
    stateRef = useRef(state),
    queue = useRef(Promise.resolve()),
    speakId = useRef(0),
    lastText = useRef(""),
    audio = useRef<HTMLAudioElement>(null);
  const [voiceFilter, setVoiceFilter] = useState("");
  const [systemVoiceQuery, setSystemVoiceQuery] = useState("");
  const [previewingSystemVoice, setPreviewingSystemVoice] = useState("");
  const [systemVoiceAvailability, setSystemVoiceAvailability] = useState<"all" | "offline" | "online">("all");
  const s = state.settings;
  const be: Record<string, string> = {
    "Voice engine shortcuts": "Хуткі пераход да галасавых рухавікоў",
    "System TTS": "Сістэмны голас", "My recordings": "Мае запісы",
    "General": "Агульнае", "Currently active": "Зараз выкарыстоўваецца",
    "Tip: press Ctrl/⌘ + Enter to speak": "Падказка: Ctrl/⌘ + Enter — агучыць",
    "Home": "Галоўная", "Communicate": "Зносіны", "Voice Studio": "Студыя голасу",
    "Library": "Бібліятэка", "Settings": "Налады", "Device default": "Сістэмны голас",
    "YOUR WORDS, OUT LOUD": "ТВАЕ СЛОВЫ ЎГОЛАС", "Message to speak": "Тэкст для агучвання",
    "Clear text": "Ачысціць тэкст", "Repeat last speech": "Паўтарыць апошнюю фразу",
    "Stop": "Спыніць", "Speak": "Прамовіць", "Search phrases": "Пошук фраз",
    "Find a phrase…": "Знайсці фразу…", "Clear search": "Ачысціць пошук",
    "All phrases": "Усе фразы", "Favorites": "Выбранае", "New phrase": "Новая фраза",
    "Skip to content": "Перайсці да змесціва", "Workspace navigation": "Навігацыя па працоўнай прасторы",
    "Main navigation": "Галоўная навігацыя", "Private by design": "Прыватнасць па змаўчанні",
    "Your words stay with you.": "Твае словы застаюцца з табой.",
    "Stored on this device": "Захоўваецца на гэтай прыладзе", "My workspace": "Мая прастора",
    "Local storage": "Лакальнае сховішча", "Voice language": "Мова голасу",
    "All languages": "Усе мовы", "System voice": "Сістэмны голас", "Preview voice": "Праслухаць голас",
    "Speaking speed": "Хуткасць маўлення", "Pitch": "Вышыня тону",
    "Voice profiles": "Галасавыя профілі", "Save profile": "Захаваць профіль",
    "Recorded voice": "Запісаны голас", "Start recording": "Пачаць запіс",
    "Stop & save": "Спыніць і захаваць", "Appearance & language": "Выгляд і мова",
    "Appearance": "Выгляд", "Interface language": "Мова інтэрфейсу",
    "Voice settings": "Налады голасу", "Accessibility": "Даступнасць",
    "Text size": "Памер тэксту", "Phrase card spacing": "Памер картак",
    "Comfortable": "Зручны", "Compact": "Кампактны", "Reduce motion": "Паменшыць анімацыю",
    "Backup & restore": "Рэзервовая копія і аднаўленне", "Export backup": "Экспартаваць копію",
    "Restore backup": "Аднавіць копію", "Privacy & your data": "Прыватнасць і твае даныя",
    "Delete all personal data": "Выдаліць усе асабістыя даныя",
    "A place for every conversation": "Месца для кожнай размовы",
    "A space that works the way you do.": "Прастора, якая працуе так, як табе зручна.",
    "A thought, a need, a conversation. Start with your words.": "Думка, патрэба, размова. Пачні са сваіх слоў.",
    "A voice of your own. Always.": "Твой уласны голас. Заўсёды.",
    "Add a phrase or try a different search.": "Дадай фразу або змяні пошукавы запыт.",
    "Add favorite": "Дадаць у абранае",
    "Backup restored.": "Рэзервовая копія адноўлена.",
    "Changes could not be saved. Check available storage.": "Не ўдалося захаваць змены. Правер наяўнасць вольнага месца.",
    "Clear spoken history?": "Ачысціць гісторыю маўлення?",
    "Could not read recordings.": "Не ўдалося прачытаць запісы.",
    "Could not read the local database. Reload or check browser storage permissions.": "Не ўдалося прачытаць лакальную базу даных. Абнаві старонку або правер дазволы на сховішча браўзера.",
    "Create a category in the Library first.": "Спачатку ствары катэгорыю ў бібліятэцы.",
    "Data could not be erased.": "Не ўдалося выдаліць даныя.",
    "Find the right words. Let your voice do the rest.": "Знайдзі патрэбныя словы, а голас зробіць астатняе.",
    "Find the voice that feels like you.": "Знайдзі голас, які табе падыходзіць.",
    "Invalid backup or unavailable storage. Nothing was imported.": "Рэзервовая копія пашкоджаная або сховішча недаступнае. Даныя не імпартаваныя.",
    "Keep a copy of your phrases, settings, profiles and recordings. Backups contain personal data; store them somewhere you trust.": "Захоўвай копію сваіх фраз, налад, профіляў і запісаў. Рэзервовыя копіі ўтрымліваюць асабістыя даныя — захоўвай іх у надзейным месцы.",
    "Maximum backup size is 50 MB.": "Максімальны памер рэзервовай копіі — 50 МБ.",
    "No account. No analytics. Personal phrases and audio stay in your local database. Browser storage can be cleared by the device; export regular backups.": "Без уліковага запісу і аналітыкі. Асабістыя фразы і аўдыя застаюцца ў лакальнай базе даных. Сховішча браўзера можа быць ачышчана прыладай — рэгулярна экспартуй рэзервовыя копіі.",
    "Permanently erase all phrases, recordings and settings? This cannot be undone.": "Незваротна выдаліць усе фразы, запісы і налады? Гэта дзеянне нельга будзе адмяніць.",
    "Recording storage limit reached (100 clips / 30 MB). Export a backup and delete older clips.": "Дасягнуты ліміт запісаў (100 файлаў / 30 МБ). Экспартуй рэзервовую копію і выдалі старыя запісы.",
    "Remove favorite": "Выдаліць з абранага",
    "Rename category": "Перайменаваць катэгорыю",
    "Replace all local data with this backup?": "Замяніць усе лакальныя даныя гэтай рэзервовай копіяй?",
    "Spoken phrases will appear here for a quick repeat.": "Тут будуць з'яўляцца агучаныя фразы для хуткага паўтору.",
    "The words that matter, always within reach.": "Важныя словы заўсёды будуць пад рукой.",
    "This change exceeds the data limits or contains invalid values.": "Гэта змяненне перавышае ліміт даных або змяшчае няправільныя значэнні.",
    "What would you like to say?": "Што ты хочаш сказаць?",
    "Your conversations begin here.": "Твае размовы пачынаюцца тут.",
    "Your voice deserves to be heard, at your own pace.": "Твой голас заслугоўвае быць пачутым — у зручным для цябе тэмпе.",
    "Your words. Your voice. Your independence.": "Твае словы. Твой голас. Твая незалежнасць.",
    "My personal space": "Мая асабістая прастора",
    "Recording name": "Назва запісу",
    "Adaptive pacing": "Адаптыўны тэмп",
    "Voice engine mode": "Рэжым галасавога рухавіка",
    "Automatic": "Аўтаматычна",
    "System voice only": "Толькі сістэмны голас",
    "Installed neural voices": "Усталяваныя нейрасеткавыя галасы",
    "Automatic uses an installed offline neural model when available; otherwise ECHO uses the device voice. No text is sent online in this version.": "Аўтаматычны рэжым выкарыстоўвае ўсталяваную лакальную нейрасеткавую мадэль, калі яна даступная; інакш ECHO выкарыстоўвае сістэмны голас. У гэтай версіі тэкст не адпраўляецца ў інтэрнэт.",
    "Off": "Выключана",
    "Smart pacing": "Разумны тэмп",
    "Smart pacing gently adjusts speech rate for longer sentences and punctuation. It does not infer emotions.": "Разумны тэмп мякка змяняе хуткасць маўлення ў залежнасці ад даўжыні фразы і пунктуацыі. Эмоцыі не распазнаюцца.",
    "Phrase language": "Мова фразы", "Phrase": "Фраза", "Category": "Катэгорыя",
    "Add to favorites": "Дадаць у выбранае", "Name": "Назва", "Cancel": "Скасаваць",
    "Save": "Захаваць", "Confirm": "Пацвердзіць", "Please confirm": "Пацвердзі дзеянне",
    "Voice recording": "Запіс голасу",
    "Recording saved on this device.": "Запіс захаваны на гэтай прыладзе.",
    "A little space for your words": "Месца для тваіх слоў",
    "A voice of your own": "Твой уласны голас",
    "YOUR SPACE": "ТВАЯ ПРАСТОРА",
    "YOUR EVERYDAY COMPANION": "ТВОЙ ШТОДЗЁННЫ ДАПАМОЖНІК",
    "YOUR WORDS. YOUR WAY.": "ТВАЕ СЛОВЫ. ТВОЙ СПОСАБ.",
    "Make yourself heard.": "Дапамажы іншым пачуць цябе.",
    "Dismiss message": "Закрыць паведамленне",
    "Your go-to phrases": "Твае асноўныя фразы",
    "View all": "Паказаць усе",
    "phrases": "фраз",
    "Recent speech": "Апошнія выказванні",
    "Recently spoken": "Нядаўна агучана",
    "ON THIS DEVICE": "НА ГЭТАЙ ПРЫЛАДЗЕ",
    "A little more time is okay.": "Можна не спяшацца.",
    "Phrase collection": "Зборнік фраз",
    "Add phrase": "Дадаць фразу",
    "History": "Гісторыя",
    "Clear history": "Ачысціць гісторыю",
    "Categories": "Катэгорыі",
    "New category": "Новая катэгорыя",
    "Rename": "Перайменаваць",
    "Delete category": "Выдаліць катэгорыю",
    "Your phrases": "Твае фразы",
    "Add": "Дадаць",
    "Move up": "Перамясціць вышэй",
    "Move down": "Перамясціць ніжэй",
    "Toggle favorite": "Змяніць абранае",
    "Edit phrase": "Рэдагаваць фразу",
    "Delete phrase": "Выдаліць фразу",
    "SYSTEM TEXT-TO-SPEECH": "СІСТЭМНЫ СІНТЭЗ МАЎЛЕННЯ",
    "Make it sound like you": "Наладзь голас",
    "Delete profile": "Выдаліць профіль",
    "Delete recording": "Выдаліць запіс",
    "Light": "Светлая",
    "Dark": "Цёмная",
    "System": "Сістэмная",
    "Save voice profile": "Захаваць профіль голасу",
    "Backup exported.": "Рэзервовая копія экспартаваная.",
    "Could not export backup.": "Не ўдалося экспартаваць рэзервовую копію.",
    "Please check your entry.": "Правер уведзеныя даныя.",
    "Delete this phrase?": "Выдаліць гэтую фразу?",
    "Record a phrase in your own voice. Clips are saved locally and played back exactly as recorded.": "Запішы фразу сваім голасам. Запісы захоўваюцца на прыладзе і прайграваюцца без змен.",
    "e.g. A personal greeting": "Напрыклад, асабістае прывітанне",
    "Microphone permission required · Up to 60 seconds": "Патрэбны доступ да мікрафона · Да 60 секунд",
    "Your device’s speech engine. Ready when you are.": "Галасавы рухавік тваёй прылады. Гатовы да працы.",
    "Hello. This is my voice.": "Добры дзень. Гэта мой голас.",
    "Only voices marked offline are guaranteed to work without a network. Install language packs in Android settings.": "Без інтэрнэту гарантуюць працу толькі галасы з пазнакай offline. Усталюй моўныя пакеты ў наладах Android.",
    "No voices reported yet. Install a system TTS engine or language pack.": "Галасы пакуль не знойдзены. Усталюй сістэмны TTS-рухавік або моўны пакет.",
    "Delete this recording?": "Выдаліць гэты запіс?",
    "This audio format cannot be played on this device.": "Гэты фармат аўдыя не падтрымліваецца прыладай.",
    "Delete all personal data?": "Выдаліць усе асабістыя даныя?",
    "Restore this backup?": "Аднавіць гэтую рэзервовую копію?",
  };
  const t = (en: string, ru: string) =>
    s.language === "ru" ? ru : s.language === "be" ? (be[en] ?? en) : en;
  useEffect(() => {
    loadState()
      .then((v) => {
        stateRef.current = v;
        setState(v);
        setReady(true);
      })
      .catch(() =>
        setFatal(
          "Could not read the local database. Reload or check browser storage permissions.",
        ),
      );
    getClips()
      .then(setClips)
      .catch(() => setNotice("Could not read recordings."));
    const refresh = () => {
      speech
        .voices()
        .then(setVoices)
        .catch((e) => setNotice(String(e.message)));
    };
    refresh();
    if ("speechSynthesis" in globalThis)
      speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      if ("speechSynthesis" in globalThis)
        speechSynthesis.removeEventListener("voiceschanged", refresh);
      recorder.current.cancel();
      void speech.stop();
    };
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        s.theme === "system" ? (mq.matches ? "dark" : "light") : s.theme;
    };
    apply();
    mq.addEventListener("change", apply);
    document.documentElement.lang = s.language;
    document.documentElement.style.fontSize = `${s.textSize}px`;
    document.documentElement.dataset.motion = s.reducedMotion
      ? "reduced"
      : "normal";
    return () => mq.removeEventListener("change", apply);
  }, [s.theme, s.language, s.textSize, s.reducedMotion]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) {
        recorder.current.cancel();
        setRecording(false);
        audio.current?.pause();
        void speech.stop();
        setSpeaking(false);
        speakId.current++;
      }
    };
    document.addEventListener("visibilitychange", pause);
    let disposed = false;
    let cleanup: (() => void) | undefined;
    if (Capacitor.isNativePlatform())
      NativeApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          speakId.current++;
          setSpeaking(false);
          recorder.current.cancel();
          setRecording(false);
          void speech.stop();
          audio.current?.pause();
        }
      }).then((h) => {
        if (disposed) void h.remove();
        else
          cleanup = () => {
            void h.remove();
          };
      });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", pause);
      cleanup?.();
    };
  }, []);
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  function update(fn: (v: State) => State) {
    const parsed = stateSchema.safeParse(fn(stateRef.current));
    if (!parsed.success) {
      setNotice(
        t(
          "This change exceeds the data limits or contains invalid values.",
          "Изменение превышает лимит данных или содержит некорректные значения.",
        ),
      );
      return;
    }
    const next = parsed.data;
    stateRef.current = next;
    setState(next);
    queue.current = queue.current
      .then(() => saveState(next))
      .catch(() =>
        setNotice(
          t(
            "Changes could not be saved. Check available storage.",
            "Не удалось сохранить изменения. Проверьте свободное место.",
          ),
        ),
      );
  }
  function setting<K extends keyof State["settings"]>(
    key: K,
    value: State["settings"][K],
  ) {
    update((v) => ({ ...v, settings: { ...v.settings, [key]: value } }));
  }
  useEffect(() => {
    const navigate = () => setPage(readRoute());
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  function go(next: Page) {
    location.hash = next;
    setPage(next);
    setQuery("");
    setCategory("");
    setFavorites(false);
  }
  function jumpToVoiceEngine(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: s.reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }
  async function say(value = text, language?: string) {
    if (!value.trim()) return;
    const id = ++speakId.current;
    lastText.current = value;
    setSpeaking(true);
    setNotice("");
    try {
      await speech.speak(value, adaptiveSpeechSettings(value, s), language);
      if (id === speakId.current)
        update((v) => ({
          ...v,
          history: [
            { id: crypto.randomUUID(), text: value, at: Date.now() },
            ...v.history,
          ].slice(0, 100),
        }));
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      if (id === speakId.current) setSpeaking(false);
    }
  }
  async function previewSystemVoice(voice: Voice) {
    if (previewingSystemVoice) return;
    setPreviewingSystemVoice(voice.id);
    try {
      await speech.speak(
        t("Hello. This is a voice preview.", "Здравствуйте. Это пример голоса."),
        adaptiveSpeechSettings("Hello. This is a voice preview.", { ...s, voice: voice.id }),
        voice.language,
      );
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setPreviewingSystemVoice("");
    }
  }
  async function stop() {
    speakId.current++;
    await speech.stop();
    setSpeaking(false);
  }
  async function endRecording() {
    if (recordBusy) return;
    setRecordBusy(true);
    setRecording(false);
    try {
      const blob = await recorder.current.stop();
      const existing = await getClips();
      if (
        existing.length >= 100 ||
        existing.reduce((total, clip) => total + clip.blob.size, blob.size) >
          30 * 1024 * 1024
      )
        throw new Error(
          t(
            "Recording storage limit reached (100 clips / 30 MB). Export a backup and delete older clips.",
            "Лимит записей: 100 записей / 30 МБ. Создайте копию и удалите старые записи.",
          ),
        );
      await putClip({
        id: crypto.randomUUID(),
        name: clipName.trim() || t("Voice recording", "Запись голоса"),
        blob,
        createdAt: Date.now(),
      });
      setClips(await getClips());
      setClipName("");
      setNotice(
        t("Recording saved on this device.", "Запись сохранена на устройстве."),
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setRecordBusy(false);
    }
  }
  async function startRecording() {
    setRecordBusy(true);
    try {
      await stop();
      audio.current?.pause();
      await recorder.current.start(
        () => {
          void endRecording();
        },
        (message) => {
          setRecording(false);
          setNotice(message);
        },
      );
      setRecording(true);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setRecordBusy(false);
    }
  }
  const nav: [Page, typeof Home, string][] = [
    ["home", Home, t("Home", "Главная")],
    ["communicate", MessageSquare, t("Communicate", "Общение")],
    ["voice", AudioLines, t("Voice Studio", "Студия голоса")],
    ["library", Library, t("Library", "Библиотека")],
    ["settings", SettingsIcon, t("Settings", "Настройки")],
  ];
  const activeVoice = voices.find((v) => v.id === s.voice);
  const voiceLabel =
    activeVoice?.name || t("Device default", "Системный голос");
  const filteredSystemVoices = voices.filter((v) =>
    (!voiceFilter || v.language === voiceFilter) &&
    (systemVoiceAvailability === "all" || (systemVoiceAvailability === "offline" ? v.local : !v.local)) &&
    (v.name + " " + v.language).toLowerCase().includes(systemVoiceQuery.trim().toLowerCase())
  );
  function card(p: Phrase) {
    return (
      <article className="phrase-card" key={p.id}>
        <button
          className="phrase-speak"
          onClick={() => void say(p.text, p.language)}
        >
          <span>{p.text}</span>
          <Volume2 size={18} />
        </button>
        <div className="phrase-meta">
          <span>
            {state.categories.find((c) => c.id === p.categoryId)?.name}{" "}
            <small>{p.language.toUpperCase()}</small>
          </span>
          <button
            className={`icon favorite ${p.favorite ? "selected" : ""}`}
            aria-label={t(
              p.favorite ? "Remove favorite" : "Add favorite",
              p.favorite ? "Убрать из избранного" : "В избранное",
            )}
            onClick={() => update((v) => toggleFavorite(v, p.id))}
          >
            <Star size={17} fill={p.favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </article>
    );
  }
  function composer() {
    return (
      <section className="composer">
        <div className="section-label">
          <span>
            <span className="status-dot" />
            {t("YOUR WORDS, OUT LOUD", "ВАШИ СЛОВА ВСЛУХ")}
          </span>
          <span className="muted">{text.length}/2000</span>
        </div>
        <label className="sr-only" htmlFor="composer">
          {t("Message to speak", "Текст для озвучивания")}
        </label>
        <textarea
          id="composer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && text.trim() && !speaking) {
              event.preventDefault();
              void say();
            }
          }}
          aria-describedby="composer-shortcut"
          maxLength={2000}
          placeholder={t(
            "What would you like to say?",
            "Что вы хотите сказать?",
          )}
        />
        <p className="composer-shortcut" id="composer-shortcut">
          {t("Tip: press Ctrl/⌘ + Enter to speak", "Подсказка: Ctrl/⌘ + Enter — произнести")}
        </p>
        <div className="composer-bottom">
          <button className="voice-chip" onClick={() => go("voice")}>
            <AudioLines size={17} />
            <span>{voiceLabel}</span>
            <ChevronDown size={14} />
          </button>
          <div className="composer-actions">
            <button
              className="icon"
              aria-label={t("Clear text", "Очистить текст")}
              disabled={!text}
              onClick={() => setText("")}
            >
              <X size={19} />
            </button>
            <button
              className="icon"
              aria-label={t("Repeat last speech", "Повторить речь")}
              disabled={!lastText.current}
              onClick={() => void say(lastText.current)}
            >
              <RotateCcw size={18} />
            </button>
            {speaking ? (
              <button className="primary" onClick={() => void stop()}>
                <Square size={17} />
                {t("Stop", "Стоп")}
              </button>
            ) : (
              <button
                className="primary"
                disabled={!text.trim()}
                onClick={() => void say()}
              >
                <Volume2 size={18} />
                {t("Speak", "Произнести")}
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }
  function filterBar() {
    return (
      <>
        <div className="search">
          <Search size={18} />
          <input
            aria-label={t("Search phrases", "Поиск фраз")}
            placeholder={t("Find a phrase…", "Найти фразу…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon"
              aria-label={t("Clear search", "Очистить поиск")}
              onClick={() => setQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="filters">
          <button
            className={!category && !favorites ? "active" : ""}
            onClick={() => {
              setCategory("");
              setFavorites(false);
            }}
          >
            {t("All phrases", "Все фразы")}
          </button>
          <button
            className={favorites ? "active" : ""}
            onClick={() => {
              setFavorites(!favorites);
              setCategory("");
            }}
          >
            <Star size={15} />
            {t("Favorites", "Избранное")}
          </button>
          {state.categories.map((c) => (
            <button
              className={category === c.id ? "active" : ""}
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                setFavorites(false);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </>
    );
  }
  function empty() {
    return (
      <div className="empty">
        <MessageSquare size={26} />
        <h3>{t("A little space for your words", "Место для ваших слов")}</h3>
        <p>
          {t(
            "Add a phrase or try a different search.",
            "Добавьте фразу или измените поиск.",
          )}
        </p>
        <button onClick={() => setEditor({ kind: "phrase" })}>
          <Plus size={16} />
          {t("New phrase", "Новая фраза")}
        </button>
      </div>
    );
  }
  if (fatal)
    return (
      <main className="fatal">
        <h1>ECHO</h1>
        <p>{fatal}</p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    );
  if (!ready)
    return (
      <main className="fatal" aria-busy="true">
        <div className="brand-mark brand-mark-logo">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="ECHO" />
        </div>
        <p>Opening ECHO…</p>
      </main>
    );
  return (
    <div className={`app ${s.cardSize}`}>
      <a className="skip-link" href="#main-content" onClick={event => {event.preventDefault(); document.getElementById("main-content")?.focus();}}>
        {t("Skip to content", "Перейти к содержимому")}
      </a>
      <aside
        className="sidebar"
        aria-label={t("Workspace navigation", "Навигация")}
      >
        <a
          className="brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brand-mark brand-mark-logo">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          </span>
          <span className="brand-wordmark">
            ECHO
            <small>{t("ГОЛОС ТЕХ, КТО НЕ СЛЫШИТ", "ГОЛОС ТЕХ, КТО НЕ СЛЫШИТ")}</small>
          </span>
        </a>
        <div className="nav-label">{t("YOUR SPACE", "ВАШЕ ПРОСТРАНСТВО")}</div>
        <nav aria-label={t("Main navigation", "Главная навигация")}>
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={19} />
            <div>
              <strong>
                {t("Private by design", "Приватность по умолчанию")}
              </strong>
              <p>
                {t("Your words stay with you.", "Ваши слова остаются с вами.")}
              </p>
            </div>
          </div>
          <button className="device-profile" onClick={() => go("settings")}>
            <span className="avatar avatar-logo"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="ECHO" /></span>
            <span>
              {t("My personal space", "Моё пространство")}
              <small>
                {t("Stored on this device", "Хранится на устройстве")}
              </small>
            </span>
            <SettingsIcon size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            {t("My workspace", "Моё пространство")} <span>/</span>{" "}
            <strong>{nav.find((n) => n[0] === page)?.[2]}</strong>
          </span>
          <span className="local-badge">
            <span className="status-dot" />
            {t("Local storage", "На устройстве")}
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "home"
                  ? t("YOUR EVERYDAY COMPANION", "ВАШ ЕЖЕДНЕВНЫЙ ПОМОЩНИК")
                  : t("YOUR WORDS. YOUR WAY.", "ВАШИ СЛОВА. ВАШ СПОСОБ.")}
              </div>
              <h1>
                {page === "home"
                  ? t("Make yourself heard.", "Пусть вас услышат.")
                  : nav.find((n) => n[0] === page)?.[2]}
              </h1>
              <p>
                {page === "home"
                  ? t(
                      "A thought, a need, a conversation. Start with your words.",
                      "Мысль, просьба, разговор. Начните со своих слов.",
                    )
                  : page === "communicate"
                    ? t(
                        "Find the right words. Let your voice do the rest.",
                        "Найдите нужные слова и произнесите их.",
                      )
                    : page === "voice"
                      ? t(
                          "Find the voice that feels like you.",
                          "Найдите голос, который вам близок.",
                        )
                      : page === "library"
                        ? t(
                            "The words that matter, always within reach.",
                            "Важные слова всегда под рукой.",
                          )
                        : t(
                            "A space that works the way you do.",
                            "Пространство, удобное именно вам.",
                          )}
              </p>
            </div>
            {(page === "home" || page === "library") && (
              <button
                className="outline"
                onClick={() => setEditor({ kind: "phrase" })}
              >
                <Plus size={17} />
                {t("New phrase", "Новая фраза")}
              </button>
            )}
          </div>
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                className="icon"
                aria-label={t("Dismiss message", "Закрыть сообщение")}
                onClick={() => setNotice("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {(page === "home" || page === "communicate") && (
            <>
              {composer()}
              {page === "home" ? (
                <div className="home-columns">
                  <div>
                    <div className="section-head">
                      <h2>
                        <Star size={18} />
                        {t("Your go-to phrases", "Любимые фразы")}
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          go("communicate");
                          setFavorites(true);
                        }}
                      >
                        {t("View all", "Все")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="phrase-grid">
                      {state.phrases
                        .filter((p) => p.favorite)
                        .slice(-6)
                        .reverse()
                        .map(card)}
                    </div>
                    {!state.phrases.some((p) => p.favorite) && empty()}
                    <div className="section-head category-heading">
                      <h2>
                        {t(
                          "A place for every conversation",
                          "Для любого разговора",
                        )}
                      </h2>
                    </div>
                    <div className="category-grid">
                      {state.categories.map((c, i) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            go("communicate");
                            setCategory(c.id);
                          }}
                        >
                          <span className={`category-icon tone-${i % 4}`}>
                            <Folder size={20} />
                          </span>
                          <strong>{c.name}</strong>
                          <span>
                            {
                              state.phrases.filter((p) => p.categoryId === c.id)
                                .length
                            }{" "}
                            {t("phrases", "фраз")}
                          </span>
                          <ArrowUpRight size={17} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <aside
                    className="recent-panel"
                    aria-label={t("Recent speech", "Недавняя речь")}
                  >
                    <div className="section-head">
                      <h2>{t("Recently spoken", "Недавние")}</h2>
                      <span className="tiny-label">
                        {t("ON THIS DEVICE", "НА УСТРОЙСТВЕ")}
                      </span>
                    </div>
                    {state.history.length ? (
                      state.history.slice(0, 5).map((h) => (
                        <button
                          className="recent-item"
                          key={h.id}
                          onClick={() => void say(h.text)}
                        >
                          <span>
                            {h.text}
                            <small>
                              {new Date(h.at).toLocaleString(s.language, {
                                hour: "2-digit",
                                minute: "2-digit",
                                month: "short",
                                day: "numeric",
                              })}
                            </small>
                          </span>
                          <Volume2 size={17} />
                        </button>
                      ))
                    ) : (
                      <div className="recent-empty">
                        <MessageSquare size={22} />
                        <p>
                          {t(
                            "Your conversations begin here.",
                            "Ваши разговоры начинаются здесь.",
                          )}
                        </p>
                        <small>
                          {t(
                            "Spoken phrases will appear here for a quick repeat.",
                            "Произнесённые фразы появятся здесь для быстрого повтора.",
                          )}
                        </small>
                      </div>
                    )}
                    <div className="quiet-tip">
                      <span className="tip-line" />
                      <strong>
                        {t("A little more time is okay.", "Не торопитесь.")}
                      </strong>
                      <p>
                        {t(
                          "Your voice deserves to be heard, at your own pace.",
                          "Ваш голос заслуживает внимания в удобном вам темпе.",
                        )}
                      </p>
                    </div>
                  </aside>
                </div>
              ) : (
                <>
                  <div className="section-head">
                    <h2>{t("Phrase collection", "Коллекция фраз")}</h2>
                    <button
                      className="text-button"
                      onClick={() => setEditor({ kind: "phrase" })}
                    >
                      <Plus size={16} />
                      {t("Add phrase", "Добавить")}
                    </button>
                  </div>
                  {filterBar()}
                  <div className="phrase-grid communicate-grid">
                    {searchPhrases(state, query, category, favorites).map(card)}
                  </div>
                  {!searchPhrases(state, query, category, favorites).length &&
                    empty()}
                  <section className="panel history">
                    <div className="section-head">
                      <h2>{t("History", "История")}</h2>
                      <button
                        disabled={!state.history.length}
                        onClick={() =>
                          setConfirm({
                            message: t(
                              "Clear spoken history?",
                              "Очистить историю речи?",
                            ),
                            action: () =>
                              update((v) => ({ ...v, history: [] })),
                          })
                        }
                      >
                        {t("Clear history", "Очистить историю")}
                      </button>
                    </div>
                    {state.history.slice(0, 10).map((h) => (
                      <button
                        className="history-row"
                        key={h.id}
                        onClick={() => void say(h.text)}
                      >
                        {h.text}
                        <Volume2 size={17} />
                      </button>
                    ))}
                  </section>
                </>
              )}
            </>
          )}
          {page === "library" && (
            <>
              {filterBar()}
              <div className="library-layout">
                <section className="panel category-list">
                  <div className="section-head">
                    <h2>{t("Categories", "Категории")}</h2>
                    <button
                      className="icon"
                      aria-label={t("New category", "Новая категория")}
                      onClick={() => setEditor({ kind: "category" })}
                    >
                      <Plus size={19} />
                    </button>
                  </div>
                  {state.categories.map((c) => (
                    <div className="category-row" key={c.id}>
                      <button
                        className={category === c.id && !favorites ? "text-button category-filter-button active" : "text-button category-filter-button"}
                        aria-pressed={category === c.id && !favorites}
                        onClick={() => {
                          setCategory(c.id);
                          setFavorites(false);
                        }}
                      >
                        <Folder size={16} />
                        {c.name}
                      </button>
                      <div>
                        <button
                          className="icon"
                          aria-label={`${t("Rename", "Переименовать")} ${c.name}`}
                          onClick={() =>
                            setEditor({
                              kind: "category",
                              id: c.id,
                              name: c.name,
                            })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon"
                          aria-label={`${t("Delete category", "Удалить категорию")} ${c.name}`}
                          onClick={() =>
                            setConfirm({
                              message: t(
                                `Delete “${c.name}” and all its phrases?`,
                                `Удалить «${c.name}» и все фразы в ней?`,
                              ),
                              action: () => {
                                update((v) => removeCategory(v, c.id));
                                setCategory("");
                              },
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
                <section className="panel phrase-table">
                  <div className="section-head">
                    <h2>
                      {t("Your phrases", "Ваши фразы")}{" "}
                      <span className="count">
                        {
                          searchPhrases(state, query, category, favorites)
                            .length
                        }
                      </span>
                    </h2>
                    <button onClick={() => setEditor({ kind: "phrase" })}>
                      <Plus size={16} />
                      {t("Add", "Добавить")}
                    </button>
                  </div>
                  {searchPhrases(state, query, category, favorites).map((p) => (
                    <div className="library-row" key={p.id}>
                      <button
                        className="library-text"
                        onClick={() => void say(p.text, p.language)}
                      >
                        {p.text}
                        <small>
                          {
                            state.categories.find((c) => c.id === p.categoryId)
                              ?.name
                          }{" "}
                          · {p.language.toUpperCase()}
                        </small>
                      </button>
                      <div className="row-tools">
                        <button
                          className="icon"
                          aria-label={t("Move up", "Выше")}
                          onClick={() => move(p, -1)}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          className="icon"
                          aria-label={t("Move down", "Ниже")}
                          onClick={() => move(p, 1)}
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          className={`icon ${p.favorite ? "selected" : ""}`}
                          aria-label={t("Toggle favorite", "Избранное")}
                          onClick={() => update((v) => toggleFavorite(v, p.id))}
                        >
                          <Star
                            size={16}
                            fill={p.favorite ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          className="icon"
                          aria-label={t("Edit phrase", "Редактировать фразу")}
                          onClick={() =>
                            setEditor({ kind: "phrase", value: p })
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon"
                          aria-label={t("Delete phrase", "Удалить фразу")}
                          onClick={() =>
                            setConfirm({
                              message: t(
                                "Delete this phrase?",
                                "Удалить эту фразу?",
                              ),
                              action: () =>
                                update((v) => ({
                                  ...v,
                                  phrases: v.phrases.filter(
                                    (x) => x.id !== p.id,
                                  ),
                                })),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!searchPhrases(state, query, category, favorites).length &&
                    empty()}
                </section>
              </div>
            </>
          )}
          {page === "voice" && (
            <>
              <nav className="voice-engine-nav" aria-label={t("Voice engine shortcuts", "Быстрый переход к голосовым движкам")}>
                <button type="button" onClick={() => jumpToVoiceEngine("system-voice-engine")}>{t("System TTS", "Системный голос")}</button>
                <button type="button" onClick={() => jumpToVoiceEngine("recorded-voice-panel")}>{t("My recordings", "Мои записи")}</button>
                <button type="button" onClick={() => jumpToVoiceEngine("kokoro-voice-engine")}>Kokoro</button>
                <button type="button" onClick={() => jumpToVoiceEngine("supertonic-voice-engine")}>Supertonic</button>
              </nav>
              <div className="voice-overview panel" id="system-voice-engine">
                <span className="large-wave">
                  <AudioLines size={36} />
                </span>
                <div>
                  <span className="eyebrow">
                    {t("SYSTEM TEXT-TO-SPEECH", "СИСТЕМНЫЙ СИНТЕЗ РЕЧИ")}
                  </span>
                  <h2>{voiceLabel}</h2>
                  <p>
                    {t(
                      "Your device’s speech engine. Ready when you are.",
                      "Речевой движок вашего устройства.",
                    )}
                  </p>
                </div>
                <button
                  className="outline"
                  onClick={() =>
                    void say(
                      t(
                        "Hello. This is my voice.",
                        "Здравствуйте. Это мой голос.",
                      ),
                    )
                  }
                >
                  <Volume2 size={17} />
                  {t("Preview voice", "Прослушать")}
                </button>
              </div>
              <div className="settings-grid">
                <section className="panel">
                  <h2>{t("Make it sound like you", "Звучание голоса")}</h2>
                  <div className="system-voice-picker">
                    <div className="system-voice-tools">
                      <label className="system-voice-language">
                        {t("Voice language", "Язык голоса")}
                        <select value={voiceFilter} onChange={(e) => setVoiceFilter(e.target.value)}>
                          <option value="">{t("All languages", "Все языки")}</option>
                          {[...new Set(voices.map((v) => v.language))].map((l) => <option key={l}>{l}</option>)}
                        </select>
                      </label>
                      <label className="system-voice-search">
                        {t("Find a voice", "Найти голос")}
                        <span className="system-voice-search-box">
                          <Search size={17} />
                          <input value={systemVoiceQuery} onChange={(e) => setSystemVoiceQuery(e.target.value)} placeholder={t("Search by name or language", "Поиск по имени или языку")} />
                          {systemVoiceQuery && <button type="button" className="system-voice-clear" onClick={() => setSystemVoiceQuery("")} aria-label={t("Clear search", "Очистить поиск")}><X size={15} /></button>}
                        </span>
                      </label>
                    </div>
                    <div className="system-voice-filter-row">
                      <div className="system-voice-filters" role="group" aria-label={t("Voice availability", "Доступность голоса")}>
                        {(["all", "offline", "online"] as const).map((availability) => <button type="button" key={availability} className={systemVoiceAvailability === availability ? "active" : ""} aria-pressed={systemVoiceAvailability === availability} onClick={() => setSystemVoiceAvailability(availability)}>{availability === "all" ? t("All voices", "Все голоса") : availability === "offline" ? t("Offline", "Офлайн") : t("Online", "Онлайн")}</button>)}
                      </div>
                      <span className="system-voice-count">{filteredSystemVoices.length} {t("voices found", "голосов найдено")}</span>
                    </div>
                    <div className="system-voice-list">
                      <button type="button" className={!s.voice ? "system-voice-option selected" : "system-voice-option"} aria-pressed={!s.voice} onClick={() => setting("voice", "")}>
                        <span className="system-voice-icon"><Volume2 size={18} /></span>
                        <span className="system-voice-copy"><strong>{t("Device default", "По умолчанию")}</strong><small>{t("Let the device choose", "Выбор устройства")}</small></span>
                        <span className="system-voice-check">{!s.voice ? <Check size={16} /> : null}</span>
                      </button>
                      {filteredSystemVoices.map((v) => (
                        <div className={s.voice === v.id ? "system-voice-option selected" : "system-voice-option"} key={v.id}>
                          <button type="button" className="system-voice-select" aria-pressed={s.voice === v.id} onClick={() => setting("voice", v.id)}>
                            <span className="system-voice-icon"><Volume2 size={18} /></span>
                            <span className="system-voice-copy"><strong>{v.name}</strong><small>{v.language}</small></span>
                            <span className={v.local ? "system-voice-status offline" : "system-voice-status online"}>{v.local ? t("Offline", "Офлайн") : t("Online", "Онлайн")}</span>
                            <span className="system-voice-check">{s.voice === v.id ? <Check size={16} /> : null}</span>
                          </button>
                          <button type="button" className="system-voice-preview" disabled={Boolean(previewingSystemVoice)} onClick={() => void previewSystemVoice(v)} aria-label={t("Preview voice", "Прослушать голос") + " " + v.name}>
                            <Play size={14} fill="currentColor" /> {previewingSystemVoice === v.id ? t("Playing", "Звучит") : t("Listen", "Слушать")}
                          </button>
                        </div>
                      ))}
                      {!voices.length && <p className="system-voice-empty">{t("No installed voices found. Install a speech engine or language pack in device settings.", "Установленные голоса не найдены. Добавьте движок речи или языковой пакет в настройках устройства.")}</p>}
                      {voices.length > 0 && !filteredSystemVoices.length && <p className="system-voice-empty">{t("No voices match these filters. Try another language or reset the filters.", "Нет голосов по этим фильтрам. Выберите другой язык или сбросьте фильтры.")}</p>}
                    </div>
                  </div>
                  <p className="field-note">
                    {voices.length
                      ? t(
                          "Only voices marked offline are guaranteed to work without a network. Install language packs in Android settings.",
                          "Без сети работают установленные офлайн-голоса. Языковые пакеты доступны в настройках Android.",
                        )
                      : t(
                          "No voices reported yet. Install a system TTS engine or language pack.",
                          "Голоса не найдены. Установите движок TTS или языковой пакет.",
                        )}
                  </p>
                  {range(
                    "rate",
                    t("Speaking speed", "Скорость речи"),
                    0.5,
                    2,
                    0.05,
                    "×",
                  )}
                  <label>
                    {t("Adaptive pacing", "Адаптивный темп")}
                    <select
                      value={s.adaptiveVoice}
                      onChange={(e) => setting("adaptiveVoice", e.target.value as "off" | "smart")}
                    >
                      <option value="off">{t("Off", "Выключено")}</option>
                      <option value="smart">{t("Smart pacing", "Умный темп")}</option>
                    </select>
                  </label>
                  <label>
                    {t("Voice engine mode", "Режим голосового движка")}
                    <select
                      value={s.speechMode}
                      onChange={(e) => setting("speechMode", e.target.value as "auto" | "system" | "neural")}
                    >
                      <option value="auto">{t("Automatic", "Автоматически")}</option>
                      <option value="system">{t("System voice only", "Только системный голос")}</option>
                      <option value="neural">{t("Installed neural voices", "Установленные нейросетевые голоса")}</option>
                    </select>
                  </label>
                  <p className="field-note">
                    {t(
                      "Automatic uses an installed offline neural model when available; otherwise ECHO uses the device voice. No text is sent online in this version.",
                      "Автоматический режим использует установленную офлайн-модель, если она доступна; иначе ECHO использует голос устройства. В этой версии текст не отправляется в интернет.",
                    )}
                  </p>
                  <p className="field-note">
                    {t(
                      "Smart pacing gently adjusts speech rate for longer sentences and punctuation. It does not infer emotions.",
                      "Умный темп немного меняет скорость в зависимости от длины фразы и пунктуации. Эмоции не распознаются.",
                    )}
                  </p>
                  {range("pitch", t("Pitch", "Высота тона"), 0.5, 2, 0.05, "×")}
                  <div className="section-head">
                    <h3>{t("Voice profiles", "Профили голоса")}</h3>
                    <button onClick={() => setEditor({ kind: "profile" })}>
                      <Plus size={15} />
                      {t("Save profile", "Сохранить профиль")}
                    </button>
                  </div>
                  {state.profiles.map((p) => {
                    const selected =
                      p.voice === s.voice && p.rate === s.rate && p.pitch === s.pitch;
                    return (
                      <div className="category-row voice-profile-row" key={p.id}>
                        <button
                          className={selected ? "text-button voice-profile-select active" : "text-button voice-profile-select"}
                          aria-pressed={selected}
                          onClick={() =>
                            update((v) => ({
                              ...v,
                              settings: {
                                ...v.settings,
                                voice: p.voice,
                                rate: p.rate,
                                pitch: p.pitch,
                              },
                            }))
                          }
                        >
                          {p.name}
                          {selected && <Check size={15} />}
                          {selected && <small>{t("Currently active", "Сейчас используется")}</small>}
                        </button>
                        <button
                          className="icon"
                          aria-label={t("Delete profile", "Удалить профиль")}
                          onClick={() =>
                            setConfirm({
                              message: t("Delete this voice profile?", "Удалить этот профиль голоса?"),
                              action: () =>
                                update((v) => ({
                                  ...v,
                                  profiles: v.profiles.filter((x) => x.id !== p.id),
                                })),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </section>
                <section className="panel" id="recorded-voice-panel">
                  <div className="section-head">
                    <h2>{t("Recorded voice", "Записи голоса")}</h2>
                    <Mic size={20} />
                  </div>
                  <p>
                    {t(
                      "Record a phrase in your own voice. Clips are saved locally and played back exactly as recorded.",
                      "Запишите фразу своим голосом. Записи хранятся локально и воспроизводятся без синтеза.",
                    )}
                  </p>
                  <label>
                    {t("Recording name", "Название записи")}
                    <input
                      maxLength={100}
                      value={clipName}
                      onChange={(e) => setClipName(e.target.value)}
                      placeholder={t(
                        "e.g. A personal greeting",
                        "Например, приветствие",
                      )}
                    />
                  </label>
                  <button
                    className={recording ? "danger" : "primary"}
                    disabled={recordBusy}
                    onClick={() =>
                      void (recording ? endRecording() : startRecording())
                    }
                  >
                    {recording ? <Square size={17} /> : <Mic size={17} />}{" "}
                    {recording
                      ? t("Stop & save", "Остановить и сохранить")
                      : t("Start recording", "Начать запись")}
                  </button>
                  <p className="field-note">
                    {t(
                      "Microphone permission required · Up to 60 seconds",
                      "Требуется доступ к микрофону · До 60 секунд",
                    )}
                  </p>
                  {clips.map((c) => (
                    <div className="clip-row" key={c.id}>
                      <Headphones size={18} />
                      <button
                        onClick={() => {
                          setAudioUrl(URL.createObjectURL(c.blob));
                        }}
                      >
                        {c.name}
                        <small>
                          {new Date(c.createdAt).toLocaleDateString(s.language)}
                        </small>
                      </button>
                      <button
                        className="icon"
                        aria-label={t("Delete recording", "Удалить запись")}
                        onClick={() =>
                          setConfirm({
                            message: t(
                              "Delete this recording?",
                              "Удалить эту запись?",
                            ),
                            action: () => {
                              void deleteClip(c.id)
                                .then(() => getClips())
                                .then(setClips)
                                .catch((e) => setNotice(e.message));
                              setAudioUrl("");
                            },
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {audioUrl && (
                    <audio
                      ref={audio}
                      src={audioUrl}
                      controls
                      autoPlay
                      onError={() =>
                        setNotice(
                          t(
                            "This audio format cannot be played on this device.",
                            "Формат записи не поддерживается устройством.",
                          ),
                        )
                      }
                    />
                  )}
                </section>
              </div>
              <LocalAiVoicePanel language={s.language} />
              <SupertonicVoicePanel language={s.language} />
            </>
          )}
          {page === "settings" && (
            <>
              <div className="settings-grid">
                <section className="panel">
                  <h2>{t("Appearance & language", "Оформление и язык")}</h2>
                  <label>
                    {t("Appearance", "Тема")}
                    <span className="segmented">
                      {(["light", "dark", "system"] as const).map((v, i) => {
                        const Icon = [Sun, Moon, Monitor][i];
                        return (
                          <button
                            key={v}
                            className={s.theme === v ? "active" : ""}
                            aria-pressed={s.theme === v}
                            onClick={() => setting("theme", v)}
                          >
                            <Icon size={16} />
                            {
                              [
                                t("Light", "Светлая"),
                                t("Dark", "Тёмная"),
                                t("System", "Системная"),
                              ][i]
                            }
                          </button>
                        );
                      })}
                    </span>
                  </label>
                  <label>
                    {t("Interface language", "Язык интерфейса")}
                    <select
                      value={s.language}
                      onChange={(e) =>
                        setting("language", e.target.value as "en" | "ru" | "be")
                      }
                    >
                      <option value="en">English</option>
                      <option value="ru">Русский</option>
                      <option value="be">Беларуская</option>
                    </select>
                  </label>
                  <button className="outline" onClick={() => go("voice")}>
                    <AudioLines size={17} />
                    {t("Voice settings", "Настройки голоса")}
                    <ArrowRight size={16} />
                  </button>
                </section>
                <section className="panel">
                  <h2>{t("Accessibility", "Доступность")}</h2>
                  {range(
                    "textSize",
                    t("Text size", "Размер текста"),
                    14,
                    24,
                    1,
                    "px",
                  )}
                  <label>
                    {t("Phrase card spacing", "Размер карточек")}
                    <select
                      value={s.cardSize}
                      onChange={(e) =>
                        setting(
                          "cardSize",
                          e.target.value as "comfortable" | "compact",
                        )
                      }
                    >
                      <option value="comfortable">
                        {t("Comfortable", "Просторный")}
                      </option>
                      <option value="compact">
                        {t("Compact", "Компактный")}
                      </option>
                    </select>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={s.reducedMotion}
                      onChange={(e) =>
                        setting("reducedMotion", e.target.checked)
                      }
                    />
                    <span>{t("Reduce motion", "Уменьшить анимацию")}</span>
                  </label>
                  <p className="field-note">
                    {t(
                      "Your device’s reduced-motion preference is always respected.",
                      "Системная настройка уменьшения анимации учитывается всегда.",
                    )}
                  </p>
                </section>
                <section className="panel">
                  <h2>{t("Backup & restore", "Резервное копирование")}</h2>
                  <p>
                    {t(
                      "Keep a copy of your phrases, settings, profiles and recordings. Backups contain personal data; store them somewhere you trust.",
                      "Сохраните фразы, настройки, профили и записи. Копии содержат личные данные — храните их в надёжном месте.",
                    )}
                  </p>
                  <div className="button-row">
                    <button onClick={() => void backup()}>
                      <Download size={17} />
                      {t("Export backup", "Экспорт")}
                    </button>
                    <label className="file-button">
                      <Upload size={17} />
                      {t("Restore backup", "Восстановить")}
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) {
                            if (f.size > 50 * 1024 * 1024) {
                              setNotice(
                                t(
                                  "Maximum backup size is 50 MB.",
                                  "Максимальный размер — 50 МБ.",
                                ),
                              );
                              return;
                            }
                            setConfirm({
                              message: t(
                                "Replace all local data with this backup?",
                                "Заменить все локальные данные этой копией?",
                              ),
                              action: () => {
                                void queue.current
                                  .then(() => f.text())
                                  .then(restoreBackup)
                                  .then((v) => {
                                    stateRef.current = v;
                                    setState(v);
                                    return getClips();
                                  })
                                  .then(setClips)
                                  .then(() =>
                                    setNotice(
                                      t(
                                        "Backup restored.",
                                        "Копия восстановлена.",
                                      ),
                                    ),
                                  )
                                  .catch(() =>
                                    setNotice(
                                      t(
                                        "Invalid backup or unavailable storage. Nothing was imported.",
                                        "Некорректная копия или хранилище недоступно. Импорт не выполнен.",
                                      ),
                                    ),
                                  );
                              },
                            });
                          }
                        }}
                      />
                    </label>
                  </div>
                </section>
                <section className="panel">
                  <h2>
                    <ShieldCheck size={20} />
                    {t("Privacy & your data", "Приватность и данные")}
                  </h2>
                  <p>
                    {t(
                      "No account. No analytics. Personal phrases and audio stay in your local database. Browser storage can be cleared by the device; export regular backups.",
                      "Без регистрации и аналитики. Фразы и аудио хранятся на устройстве. Браузер может очистить хранилище — создавайте резервные копии.",
                    )}
                  </p>
                  <button
                    className="danger-outline"
                    onClick={() =>
                      setConfirm({
                        message: t(
                          "Permanently erase all phrases, recordings and settings? This cannot be undone.",
                          "Удалить все фразы, записи и настройки без возможности восстановления?",
                        ),
                        action: () => {
                          void queue.current
                            .then(eraseData)
                            .then(() => {
                              const v = initialState();
                              v.phrases = [];
                              v.categories = [];
                              stateRef.current = v;
                              setState(v);
                              setClips([]);
                              setAudioUrl("");
                              return saveState(v);
                            })
                            .catch(() =>
                              setNotice(
                                t(
                                  "Data could not be erased.",
                                  "Не удалось удалить данные.",
                                ),
                              ),
                            );
                        },
                      })
                    }
                  >
                    <Trash2 size={16} />
                    {t("Delete all personal data", "Удалить все личные данные")}
                  </button>
                </section>
              </div>
              <footer className="about">
                <span className="brand-mark">
                  <AudioLines size={22} />
                </span>
                <div>
                  <strong>
                    ECHO <span>0.1.0</span>
                  </strong>
                  <p>
                    {t(
                      "Your words. Your voice. Your independence.",
                      "Ваши слова. Ваш голос. Ваша независимость.",
                    )}
                  </p>
                </div>
              </footer>
            </>
          )}
          <footer className="page-footer">
            <span>ECHO</span>
            <span>
              {t(
                "A voice of your own. Always.",
                "Ваш собственный голос. Всегда.",
              )}
            </span>
            <ShieldCheck size={14} />
          </footer>
        </main>
      </div>
      {editor && (
        <Modal
          title={
            editor.kind === "phrase"
              ? t(
                  editor.value ? "Edit phrase" : "New phrase",
                  editor.value ? "Редактировать фразу" : "Новая фраза",
                )
              : editor.kind === "category"
                ? t(
                    editor.id ? "Rename category" : "New category",
                    editor.id ? "Переименовать категорию" : "Новая категория",
                  )
                : t("Save voice profile", "Сохранить профиль")
          }
          onClose={() => setEditor(null)}
        >
          <form onSubmit={saveEditor}>
            {editor.kind === "phrase" ? (
              <>
                <label>
                  {t("Phrase", "Фраза")}
                  <textarea
                    name="text"
                    required
                    autoFocus
                    maxLength={2000}
                    defaultValue={editor.value?.text}
                  />
                </label>
                {state.categories.length ? (
                  <label>
                    {t("Category", "Категория")}
                    <select
                      name="categoryId"
                      required
                      defaultValue={
                        editor.value?.categoryId ||
                        category ||
                        state.categories[0]?.id
                      }
                    >
                      {state.categories.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="field-note">
                    {t(
                      "A General category will be created automatically for your first phrase.",
                      "Для первой фразы категория «Общее» создастся автоматически.",
                    )}
                  </p>
                )}
                <label>
                  {t("Phrase language", "Язык фразы")}
                  <select
                    name="language"
                    defaultValue={editor.value?.language || s.language}
                  >
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                    <option value="be">Беларуская</option>
                  </select>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="favorite"
                    defaultChecked={editor.value?.favorite}
                  />
                  {t("Add to favorites", "Добавить в избранное")}
                </label>
              </>
            ) : (
              <label>
                {t("Name", "Название")}
                <input
                  name="name"
                  autoFocus
                  required
                  maxLength={60}
                  defaultValue={editor.kind === "category" ? editor.name : ""}
                />
              </label>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setEditor(null)}>
                {t("Cancel", "Отмена")}
              </button>
              <button
                className="primary"
                
              >
                <Check size={17} />
                {t("Save", "Сохранить")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={t("Please confirm", "Подтверждение")}
          onClose={() => setConfirm(null)}
        >
          <p>{confirm.message}</p>
          <div className="modal-actions">
            <button onClick={() => setConfirm(null)}>
              {t("Cancel", "Отмена")}
            </button>
            <button
              className="danger"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              {t("Confirm", "Подтвердить")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
  function move(p: Phrase, direction: number) {
    update((v) => {
      const ordered = v.phrases
        .filter((x) => x.categoryId === p.categoryId)
        .sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((x) => x.id === p.id),
        target = index + direction;
      if (target < 0 || target >= ordered.length) return v;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return {
        ...v,
        phrases: v.phrases.map((x) => {
          const i = ordered.findIndex((y) => y.id === x.id);
          return i < 0 ? x : { ...x, order: i };
        }),
      };
    });
  }
  function range(
    key: "rate" | "pitch" | "textSize",
    label: string,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) {
    return (
      <label className="range-label">
        <span>
          {label}
          <output>
            {s[key]}
            {unit}
          </output>
        </span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={s[key]}
          onChange={(e) => setting(key, Number(e.target.value))}
        />
      </label>
    );
  }
  async function backup() {
    try {
      await queue.current;
      const data = await exportBackup(stateRef.current);
      if (Capacitor.getPlatform() === "android") {
        await files.exportBackup({
          data,
          name: `echo-backup-${new Date().toISOString().slice(0, 10)}.json`,
        });
        setNotice(t("Backup exported.", "Копия экспортирована."));
        return;
      }
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `echo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice(t("Could not export backup.", "Не удалось создать копию."));
    }
  }
  async function saveEditor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      if (editor?.kind === "phrase") {
        const requestedCategoryId = String(f.get("categoryId") || editor.value?.categoryId || "");
        update((v) => {
          const categoryId = v.categories.some((item) => item.id === requestedCategoryId)
            ? requestedCategoryId
            : v.categories[0]?.id || crypto.randomUUID();
          const categories = v.categories.length
            ? v.categories
            : [{ id: categoryId, name: t("General", "Общее") }];
          return upsertPhrase(
            { ...v, categories },
            {
              id: editor.value?.id || crypto.randomUUID(),
              text: String(f.get("text")).trim(),
              categoryId,
              language: f.get("language") as "en" | "ru" | "be",
              favorite: f.get("favorite") === "on",
              order: editor.value?.order ?? v.phrases.length,
            },
          );
        });
      } else if (editor?.kind === "category") {
        const name = String(f.get("name")).trim();
        if (!name) return;
        update((v) => ({
          ...v,
          categories: editor.id
            ? v.categories.map((c) => (c.id === editor.id ? { ...c, name } : c))
            : [...v.categories, { id: crypto.randomUUID(), name }],
        }));
      } else {
        const name = String(f.get("name")).trim();
        if (!name) return;
        update((v) => ({
          ...v,
          profiles: [
            ...v.profiles,
            {
              id: crypto.randomUUID(),
              name,
              voice: s.voice,
              rate: s.rate,
              pitch: s.pitch,
            },
          ],
        }));
      }
      // Wait for the queued IndexedDB transaction before closing the editor.
      await queue.current;
      setEditor(null);
    } catch {
      setNotice(t("Please check your entry.", "Проверьте введённые данные."));
    }
  }
}
