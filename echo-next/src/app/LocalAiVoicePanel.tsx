import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, Search, Sparkles, Volume2, X } from "lucide-react";
import { AI_VOICES, hasLocalAIInstallConsent, loadLocalAIPreferences, saveLocalAIPreferences, loadLocalAI, synthesizeLocalAI, type AIVoice } from "../services/localAi";

type UILanguage = "en" | "ru" | "be";
export default function LocalAiVoicePanel({ language }: { language: UILanguage }) {
  const ru = language === "ru";
  const be = language === "be";
  const [text, setText] = useState("Hello. This is a new AI-generated voice.");
  const [voice, setVoice] = useState<AIVoice>(() => loadLocalAIPreferences().voice);
  const [voiceRegion, setVoiceRegion] = useState<"all" | "us" | "uk">("all");
  const [voiceGender, setVoiceGender] = useState<"all" | "female" | "male">("all");
  const [voiceQuery, setVoiceQuery] = useState("");
  const [previewingVoice, setPreviewingVoice] = useState<AIVoice | null>(null);
  const visibleVoices = useMemo(() => AI_VOICES.filter((item) => {
    const parts = item.label.split(" · ");
    const matchesRegion = voiceRegion === "all" || (voiceRegion === "us" ? item.label.includes("US English") : item.label.includes("UK English"));
    const matchesGender = voiceGender === "all" || (voiceGender === "female" ? parts[2]?.toLowerCase() === "female" : parts[2]?.toLowerCase() === "male");
    return matchesRegion && matchesGender && item.label.toLowerCase().includes(voiceQuery.trim().toLowerCase());
  }), [voiceRegion, voiceGender, voiceQuery]);
  const selectedVoice = AI_VOICES.find((item) => item.id === voice);
  const [status, setStatus] = useState<"unloaded" | "loading" | "ready" | "generating" | "error">("unloaded");
  const [message, setMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef("");
  const mountedRef = useRef(true);
  const autoPlayPreviewRef = useRef(false);

  const copy = (en: string, ruText: string, beText: string) =>
    ru ? ruText : be ? beText : en;

  useEffect(() => {
    mountedRef.current = true;
    if (hasLocalAIInstallConsent()) {
      setStatus("loading");
      setMessage(copy("Restoring your saved offline voice…", "Автоматически запускаем сохранённый офлайн-голос…", "Аўтаматычна запускаем захаваны афлайн-голас…"));
      void loadLocalAI({localOnly:true}).then(() => {
        if (!mountedRef.current) return;
        setStatus("ready");
        setMessage(copy("Your saved offline voice is ready.", "Сохранённый офлайн-голос готов.", "Захаваны афлайн-голас гатовы."));
      }).catch(() => {
        if (!mountedRef.current) return;
        setStatus("error");
        setMessage(copy("Could not restore the saved voice. Check storage and try loading again.", "Не удалось запустить сохранённую модель. Проверьте хранилище и попробуйте загрузить её снова.", "Не ўдалося запусціць захаваную мадэль. Праверце сховішча і паспрабуйце загрузіць яе зноў."));
      });
    }
    return () => {
      mountedRef.current = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    saveLocalAIPreferences({ voice });
  }, [voice]);

  useEffect(() => {
    if (!audioUrl || !autoPlayPreviewRef.current) return;
    autoPlayPreviewRef.current = false;
    const player = audioRef.current;
    if (player) void player.play().catch(() => {
      setMessage(copy("Preview is ready. Press play below.", "Образец готов. Нажмите Play ниже.", "Узор гатовы. Націсніце Play ніжэй."));
    });
  }, [audioUrl]);

  const load = async () => {
    if (status === "loading" || status === "generating") return;
    setStatus("loading");
    setMessage(copy(
      "Loading the model onto this device. The first download needs internet and free memory.",
      "Загрузка модели на устройство. При первом запуске потребуется интернет и свободная память.",
      "Мадэль загружаецца на прыладу. Пры першым запуску патрэбны інтэрнэт і вольная памяць."
    ));
    try {
      await loadLocalAI({onProgress: progress => { if (mountedRef.current) setMessage(copy("Loading model", "Загрузка модели", "Загрузка мадэлі") + ` · ${Math.round(progress)}%`); }});
      if (!mountedRef.current) return;
      setStatus("ready");
      setMessage(copy("AI model ready. Generate speech below.", "Модель загружена. Теперь можно генерировать речь.", "Мадэль загружана. Цяпер можна ствараць маўленне."));
    } catch {
      if (!mountedRef.current) return;
      setStatus("error");
      setMessage(copy(
        "Could not load AI model. Check the connection, memory, and browser support, then retry.",
        "Модель не загрузилась. Проверьте интернет, память и поддержку браузера. Можно повторить.",
        "Не ўдалося загрузіць мадэль. Праверце інтэрнэт, памяць і падтрымку браўзера, затым паспрабуйце зноў."
      ));
    }
  };

  const selectVoice = (nextVoice: AIVoice) => {
    setVoice(nextVoice);
    autoPlayPreviewRef.current = false;
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setAudioUrl("");
  };

  const previewVoice = async (selectedVoice: AIVoice) => {
    if (status !== "ready" || previewingVoice) return;
    setPreviewingVoice(selectedVoice);
    audioRef.current?.pause();
    autoPlayPreviewRef.current = true;
    setMessage(copy("Creating a short voice preview…", "Создаю короткий образец голоса…", "Ствараю кароткі ўзор голасу…"));
    try {
      const sample = await synthesizeLocalAI("Hello. This is a preview of my voice.", selectedVoice);
      if (!mountedRef.current) return;
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(sample);
      urlRef.current = url;
      setAudioUrl(url);
      setMessage(copy("Voice preview is ready. Press play below.", "Образец готов. Нажмите воспроизведение ниже.", "Узор гатовы. Націсніце прайграванне ніжэй."));
    } catch (error) {
      autoPlayPreviewRef.current = false;
      if (mountedRef.current) setMessage(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      if (mountedRef.current) setPreviewingVoice(null);
    }
  };

  const generate = async () => {
    if (status !== "ready") return;
    setStatus("generating");
    autoPlayPreviewRef.current = false;
    audioRef.current?.pause();
    setMessage(copy("Generating speech on this device…", "Нейросеть создаёт звук на этом устройстве…", "Нейрасетка стварае гук на гэтай прыладзе…"));
    try {
      const blob = await synthesizeLocalAI(text, voice);
      if (!mountedRef.current) return;
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setAudioUrl(url);
      setStatus("ready");
      setMessage(copy("Generated. Press Play below.", "Готово. Нажмите Play ниже.", "Гатова. Націсніце Play ніжэй."));
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "AI generation failed.");
    }
  };

  return (
    <section className="panel" id="kokoro-voice-engine" aria-label={copy("Local AI speech synthesis", "Локальный ИИ-синтез речи", "Лакальны сінтэз маўлення з дапамогай ШІ")}>
      <div className="section-head">
        <h2>{copy("Neural voice synthesis", "Нейросетевой синтез речи", "Нейрасеткавы сінтэз маўлення")}</h2>
        <span className="badge">{status === "ready" ? copy("Ready", "Готов", "Гатова") : "Beta"}</span>
      </div>
      <p>{copy(
        "Kokoro generates new English speech locally. Choose from 28 preset voices across US and UK English. This does not clone a person's voice.",
        "Kokoro локально создаёт английскую речь. Доступны 28 готовых голосов с американским и британским английским. Это не копирование личного голоса.",
        "Kokoro лакальна стварае англійскае маўленне. Даступныя 28 гатовых галасоў з амерыканскай і брытанскай англійскай. Гэта не кланаванне асабістага голасу."
      )}</p>
      <p className="field-note">{copy(
        "Model download is large and needs internet once. Later offline availability depends on browser cache. Your phrases and recordings are not sent to an inference server.",
        "Модель загружается отдельно при первом запуске (большой файл). При дальнейшем использовании её хранение зависит от кэша браузера. Фразы и записи не загружаются на сервер синтеза.",
        "Пры першым запуску трэба загрузіць мадэль (вялікі файл). Далейшая праца без інтэрнэту залежыць ад кэша браўзера. Фразы і запісы не адпраўляюцца на сервер сінтэзу."
      )}</p>
      <label>
        {copy("English text for AI", "Английский текст для ИИ", "Англійскі тэкст для ШІ")}
        <textarea rows={3} maxLength={400} value={text} onChange={(event) => setText(event.target.value)} placeholder="Type an English phrase" />
      </label>
      <section className="voice-picker" aria-label={copy("Choose a neural voice", "Выбор нейросетевого голоса", "Выбар голасу нейрасеткі")}>
        <div className="voice-picker-heading">
          <div>
            <span className="eyebrow">{copy("VOICE LIBRARY", "БИБЛИОТЕКА ГОЛОСОВ", "БІБЛІЯТЭКА ГАЛАСОЎ")}</span>
            <h3>{copy("Find your voice", "Найдите свой голос", "Знайдзіце свой голас")}</h3>
            <p>{copy("28 studio voices · preview before choosing", "28 студийных голосов · прослушайте перед выбором", "28 студыйных галасоў · праслухайце перад выбарам")}</p>
          </div>
          <div className="voice-picker-heading-actions">
            <span className="voice-count"><strong>{visibleVoices.length}</strong><small> / {AI_VOICES.length}</small></span>
            {status === "ready"
              ? <span className="voice-model-ready"><Check size={14} /> {copy("Model loaded", "Модель загружена", "Мадэль загружана")}</span>
              : <button className="voice-model-load" type="button" disabled={status === "loading" || status === "generating"} onClick={() => void load()}>
                  {status === "loading" ? copy("Loading…", "Загрузка…", "Загрузка…") : status === "generating" ? copy("Working…", "Обработка…", "Апрацоўка…") : copy("Load AI model", "Загрузить ИИ", "Загрузіць мадэль ШІ")}
                </button>}
          </div>
        </div>
        <div className="voice-search">
          <Search size={18} />
          <input value={voiceQuery} onChange={(event) => setVoiceQuery(event.target.value)} placeholder={copy("Search by name, accent or voice type", "Поиск по имени, акценту или типу голоса", "Пошук па імені, акцэнце або тыпе голасу")} aria-label={copy("Search voices", "Поиск голосов", "Пошук галасоў")} />
          {voiceQuery && <button type="button" className="voice-search-clear" onClick={() => setVoiceQuery("")} aria-label={copy("Clear search", "Очистить поиск", "Ачысціць пошук")}><X size={16} /></button>}
        </div>
        <div className="voice-filter-rows">
          <div className="voice-filter-line">
            <span className="voice-filter-label">{copy("Accent", "Акцент", "Акцэнт")}</span>
            <div className="voice-region-tabs" role="group" aria-label={copy("Filter by accent", "Фильтр по акценту", "Фільтр па акцэнце")}>
              {(["all", "us", "uk"] as const).map((region) => <button type="button" key={region} className={voiceRegion === region ? "active" : ""} aria-pressed={voiceRegion === region} onClick={() => setVoiceRegion(region)}>{region === "all" ? copy("All accents", "Все", "Усе") : region === "us" ? copy("US English", "США", "ЗША") : copy("UK English", "Британия", "Брытанія")}</button>)}
            </div>
          </div>
          <div className="voice-filter-line">
            <span className="voice-filter-label">{copy("Voice type", "Тип голоса", "Тып голасу")}</span>
            <div className="voice-gender-tabs" role="group" aria-label={copy("Filter by voice type", "Фильтр по типу голоса", "Фільтр па тыпе голасу")}>
              {(["all", "female", "male"] as const).map((gender) => <button type="button" key={gender} className={voiceGender === gender ? "active" : ""} aria-pressed={voiceGender === gender} onClick={() => setVoiceGender(gender)}>{gender === "all" ? copy("All", "Все", "Усе") : gender === "female" ? copy("Female", "Женский", "Жаночы") : copy("Male", "Мужской", "Мужчынскі")}</button>)}
            </div>
          </div>
        </div>
        <div className="voice-results-line">
          <span>{copy("Showing", "Показано", "Паказана")} <strong>{visibleVoices.length}</strong> {copy("of", "из", "з")} {AI_VOICES.length}</span>
          {(voiceQuery || voiceRegion !== "all" || voiceGender !== "all") && <button type="button" onClick={() => { setVoiceQuery(""); setVoiceRegion("all"); setVoiceGender("all"); }}>{copy("Reset filters", "Сбросить фильтры", "Скінуць фільтры")}</button>}
        </div>
        <div className="voice-choice-grid">
          {visibleVoices.map((item) => {
            const selected = voice === item.id;
            const parts = item.label.split(" · ");
            const isFemale = parts[2]?.toLowerCase() === "female";
            return <article className={selected ? "voice-choice selected" : "voice-choice"} key={item.id}>
              <button type="button" className="voice-choice-select" aria-pressed={selected} onClick={() => selectVoice(item.id)}>
                <span className={isFemale ? "voice-choice-avatar female" : "voice-choice-avatar male"}>{isFemale ? "F" : "M"}</span>
                <span className="voice-choice-copy"><strong>{parts[0]}</strong><small>{parts[1]}</small><span className="voice-choice-type">{isFemale ? copy("Female voice", "Женский голос", "Жаночы голас") : copy("Male voice", "Мужской голос", "Мужчынскі голас")}</span></span>
                <span className="voice-choice-check">{selected ? <Check size={17} /> : null}</span>
              </button>
              <button type="button" className="voice-preview-button" disabled={status !== "ready" || previewingVoice !== null} onClick={() => void previewVoice(item.id)} aria-label={copy("Preview", "Прослушать", "Праслухаць") + " " + parts[0]} title={status !== "ready" ? copy("Load the AI model first", "Сначала загрузите ИИ-модель", "Спачатку загрузіце мадэль ШІ") : copy("Listen to this voice", "Прослушать этот голос", "Праслухаць гэты голас")}>
                <Play size={14} fill="currentColor" /> {previewingVoice === item.id ? copy("Preparing…", "Готовлю…", "Рыхтую…") : copy("Listen", "Слушать", "Слухаць")}
              </button>
            </article>;
          })}
          {!visibleVoices.length && <div className="voice-empty-state"><Search size={22} /><strong>{copy("No matching voices", "Голоса не найдены", "Галасы не знойдзены")}</strong><span>{copy("Try another name or reset the filters.", "Попробуйте другое имя или сбросьте фильтры.", "Паспрабуйце іншае імя або скіньце фільтры.")}</span></div>}
        </div>
        <div className="voice-selected-note"><span className="voice-selected-check"><Check size={15} /></span><span><small>{copy("CURRENT SELECTION", "ТЕКУЩИЙ ВЫБОР", "БЯГУЧЫ ВЫБАР")}</small><strong>{selectedVoice?.label ?? voice}</strong></span></div>
        {status !== "ready" && <p className="voice-preview-hint">{copy("To listen to samples, load the AI model once. After that, previews are generated on this device.", "Чтобы слушать образцы, один раз загрузите ИИ-модель. После этого примеры создаются прямо на устройстве.", "Каб слухаць узоры, адзін раз загрузіце мадэль ШІ. Пасля гэтага ўзоры ствараюцца непасрэдна на прыладзе.")}</p>}
      </section>
      <div className="voice-generate-actions">
        <button className="primary" type="button" disabled={status !== "ready" || !text.trim()} onClick={() => void generate()}>
          {status === "generating" ? copy("Generating…", "Генерация…", "Стварэнне…") : copy("Generate speech", "Создать речь", "Стварыць маўленне")}
        </button>
      </div>
      <p className="field-note" role="status" aria-live="polite">{message}</p>
      {audioUrl && <audio ref={audioRef} src={audioUrl} controls aria-label={copy("Generated AI speech", "Созданная ИИ речь", "Створанае маўленне ШІ")} />}
      <small>{copy(
        "For Russian, Kazakh or Belarusian, use system speech. Personalized voice cloning is not configured.",
        "Для русского, казахского и белорусского пользуйтесь системным голосом. Персональное клонирование голоса пока не подключено.",
        "Для беларускай, рускай і казахскай моў выкарыстоўвайце сістэмны голас. Кланаванне асабістага голасу пакуль не падключана."
      )}</small>
    </section>
  );
}
