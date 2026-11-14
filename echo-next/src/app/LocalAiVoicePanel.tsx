import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, Search, Sparkles, Volume2 } from "lucide-react";
import { AI_VOICES, loadLocalAIPreferences, saveLocalAIPreferences, loadLocalAI, synthesizeLocalAI, type AIVoice } from "../services/localAi";

type UILanguage = "en" | "ru" | "be";
export default function LocalAiVoicePanel({ language }: { language: UILanguage }) {
  const ru = language === "ru";
  const be = language === "be";
  const [text, setText] = useState("Hello. This is a new AI-generated voice.");
  const [voice, setVoice] = useState<AIVoice>(() => loadLocalAIPreferences().voice);
  const [voiceRegion, setVoiceRegion] = useState<"all" | "us" | "uk">("all");
  const [voiceQuery, setVoiceQuery] = useState("");
  const [previewingVoice, setPreviewingVoice] = useState<AIVoice | null>(null);
  const visibleVoices = useMemo(() => AI_VOICES.filter((item) => {
    const matchesRegion = voiceRegion === "all" || (voiceRegion === "us" ? item.label.includes("US English") : item.label.includes("UK English"));
    return matchesRegion && item.label.toLowerCase().includes(voiceQuery.trim().toLowerCase());
  }), [voiceRegion, voiceQuery]);
  const [status, setStatus] = useState<"unloaded" | "loading" | "ready" | "generating" | "error">("unloaded");
  const [message, setMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef("");
  const mountedRef = useRef(true);

  const copy = (en: string, ruText: string, beText: string) =>
    ru ? ruText : be ? beText : en;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    saveLocalAIPreferences({ voice });
  }, [voice]);

  const load = async () => {
    if (status === "loading" || status === "generating") return;
    setStatus("loading");
    setMessage(copy(
      "Loading the model onto this device. The first download needs internet and free memory.",
      "Загрузка модели на устройство. При первом запуске потребуется интернет и свободная память.",
      "Мадэль загружаецца на прыладу. Пры першым запуску патрэбны інтэрнэт і вольная памяць."
    ));
    try {
      await loadLocalAI();
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

  const previewVoice = async (selectedVoice: AIVoice) => {
    if (status !== "ready" || previewingVoice) return;
    setPreviewingVoice(selectedVoice);
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
      if (mountedRef.current) setMessage(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      if (mountedRef.current) setPreviewingVoice(null);
    }
  };

  const generate = async () => {
    if (status !== "ready") return;
    setStatus("generating");
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
    <section className="panel" aria-label={copy("Local AI speech synthesis", "Локальный ИИ-синтез речи", "Лакальны сінтэз маўлення з дапамогай ШІ")}>
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
            <h3>{copy("Choose your voice", "Выберите голос", "Выберы голас")}</h3>
            <p>{copy("28 studio presets · US and UK English", "28 готовых голосов · американский и британский английский", "28 гатовых галасоў · амерыканская і брытанская англійская")}</p>
          </div>
          <span className="voice-count">{AI_VOICES.length}</span>
        </div>
        <div className="voice-picker-tools">
          <div className="voice-search">
            <Search size={17} />
            <input value={voiceQuery} onChange={(event) => setVoiceQuery(event.target.value)} placeholder={copy("Search voices", "Найти голос", "Знайсці голас")} aria-label={copy("Search voices", "Поиск голосов", "Пошук галасоў")} />
          </div>
          <div className="voice-region-tabs" role="group" aria-label={copy("Filter by accent", "Фильтр по акценту", "Фільтр па акцэнце")}>
            {(["all", "us", "uk"] as const).map((region) => <button type="button" key={region} className={voiceRegion === region ? "active" : ""} aria-pressed={voiceRegion === region} onClick={() => setVoiceRegion(region)}>{region === "all" ? copy("All", "Все", "Усе") : region === "us" ? copy("US English", "США", "ЗША") : copy("UK English", "Британия", "Брытанія")}</button>)}
          </div>
        </div>
        <div className="voice-choice-grid">
          {visibleVoices.map((item) => {
            const selected = voice === item.id;
            const parts = item.label.split(" · ");
            return <article className={selected ? "voice-choice selected" : "voice-choice"} key={item.id}>
              <button type="button" className="voice-choice-select" aria-pressed={selected} onClick={() => setVoice(item.id)}>
                <span className="voice-choice-wave"><Volume2 size={19} /></span>
                <span className="voice-choice-copy"><strong>{parts[0]}</strong><small>{parts[1]} · {parts[2]}</small></span>
                <span className="voice-choice-check">{selected ? <Check size={17} /> : null}</span>
              </button>
              <button type="button" className="voice-preview-button" disabled={status !== "ready" || previewingVoice !== null} onClick={() => void previewVoice(item.id)} aria-label={copy("Preview", "Прослушать", "Праслухаць") + " " + parts[0]}>
                <Play size={14} fill="currentColor" /> {previewingVoice === item.id ? copy("Preparing", "Готовлю", "Рыхтую") : copy("Preview", "Пример", "Узор")}
              </button>
            </article>;
          })}
          {!visibleVoices.length && <p className="field-note">{copy("No voices match your search.", "По вашему запросу ничего не найдено.", "Па запыце нічога не знойдзена.")}</p>}
        </div>
        <p className="voice-selected-note"><Sparkles size={14} /> {copy("Selected voice", "Выбранный голос", "Абраны голас")}: <strong>{AI_VOICES.find((item) => item.id === voice)?.label}</strong></p>
      </section>
      <div className="section-head">
        <button className="outline" type="button" disabled={status === "loading" || status === "generating"} onClick={() => void load()}>
          {status === "loading" ? copy("Loading…", "Загружается…", "Загрузка…") : copy("Load AI model", "Загрузить ИИ", "Загрузіць мадэль ШІ")}
        </button>
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
