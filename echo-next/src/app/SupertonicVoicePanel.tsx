import { useEffect, useRef, useState } from "react";
import {
  isSupertonicModelCached,
  loadSupertonic,
  modelStorageEstimate,
  removeSupertonicModel,
  SUPERTONIC_LANGUAGES,
  SUPERTONIC_VOICES,
  synthesizeSupertonic,
  type SupertonicLanguage,
  type SupertonicVoice,
} from "../services/supertonic";

type UILanguage = "en" | "ru" | "be";
type Status = "idle" | "loading" | "ready" | "generating" | "error";

export default function SupertonicVoicePanel({ language }: { language: UILanguage }) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("Hello. This is ECHO speaking with Supertonic.");
  const [voice, setVoice] = useState<SupertonicVoice>("F1");
  const [ttsLanguage, setTtsLanguage] = useState<SupertonicLanguage>(language === "ru" ? "ru" : "en");
  const [speed, setSpeed] = useState(1);
  const [steps, setSteps] = useState(8);
  const [adaptive, setAdaptive] = useState(true);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [cached, setCached] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef("");

  const copy = (en: string, ru: string, be: string) =>
    language === "ru" ? ru : language === "be" ? be : en;

  useEffect(() => {
    void isSupertonicModelCached().then(setCached).catch(() => setCached(false));
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const load = async () => {
    if (status === "loading" || status === "generating") return;
    setStatus("loading");
    setMessage(copy(
      "Checking available storage and preparing the optional ~400 MB model…",
      "Проверяем память и готовим дополнительную модель размером около 400 МБ…",
      "Правяраем сховішча і рыхтуем дадатковую мадэль памерам каля 400 МБ…"
    ));
    try {
      const estimate = await modelStorageEstimate();
      if (estimate.available !== undefined && estimate.available < 420 * 1024 * 1024) {
        throw new Error(copy(
          "Not enough free app storage. Supertonic needs about 400 MB plus temporary working space.",
          "Недостаточно свободной памяти приложения. Supertonic требуется около 400 МБ и дополнительное место для работы.",
          "Недастаткова вольнага месца. Supertonic патрэбна каля 400 МБ і дадатковае месца для працы."
        ));
      }
      await loadSupertonic((name, current, total) => {
        setProgress(`${current}/${total} · ${name}`);
        setMessage(copy(
          "Downloading and preparing model files. Keep ECHO open until this finishes.",
          "Загружаем и подготавливаем файлы модели. Не закрывайте ECHO до завершения.",
          "Загружаем і рыхтуем файлы мадэлі. Не закрывай ECHO да завяршэння."
        ));
      });
      const stored = await isSupertonicModelCached().catch(() => false);
      setCached(stored);
      setStatus("ready");
      setProgress("");
      setMessage(stored
        ? copy("Supertonic 3 is ready and its model files are cached on this device.", "Supertonic 3 готова, файлы модели сохранены на устройстве.", "Supertonic 3 гатовая, файлы мадэлі захаваныя на прыладзе.")
        : copy("Model loaded for this session. Browser storage did not confirm a complete offline cache.", "Модель загружена для этой сессии. Браузер не подтвердил полное сохранение для офлайн-работы.", "Мадэль загружаная для гэтай сесіі. Браўзер не пацвердзіў поўнае захаванне для працы без інтэрнэту."));
    } catch (error) {
      setStatus("error");
      setProgress("");
      setMessage(error instanceof Error ? error.message : "Supertonic could not be loaded.");
    }
  };

  const generate = async () => {
    if (status !== "ready" || !text.trim()) return;
    setStatus("generating");
    setMessage(copy("Generating audio locally…", "Создаём аудио локально…", "Ствараем аўдыя лакальна…"));
    try {
      const blob = await synthesizeSupertonic(text, voice, ttsLanguage, speed, steps, adaptive, (step, total) => {
        setProgress(`Step ${step}/${total}`);
      });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setAudioUrl(url);
      setStatus("ready");
      setProgress("");
      setMessage(copy("Speech generated on this device.", "Речь создана на этом устройстве.", "Маўленне створанае на гэтай прыладзе."));
    } catch (error) {
      setStatus("ready");
      setProgress("");
      setMessage(error instanceof Error ? error.message : "Speech generation failed.");
    }
  };

  const clearModel = async () => {
    await removeSupertonicModel();
    setCached(false);
    setStatus("idle");
    setMessage(copy("Supertonic model cache removed from this browser.", "Кэш модели Supertonic удалён из этого браузера.", "Кэш мадэлі Supertonic выдалены з гэтага браўзера."));
  };

  return (
    <section className="panel" aria-label={copy("Supertonic 3 multilingual neural speech", "Мультиязычный нейросетевой синтез Supertonic 3", "Шматмоўны нейрасеткавы сінтэз Supertonic 3")}>
      <div className="section-head">
        <h2>{copy("Supertonic 3 · Multilingual AI", "Supertonic 3 · Мультиязычный ИИ", "Supertonic 3 · Шматмоўны ШІ")}</h2>
        <span className="badge">{status === "ready" ? "Ready" : cached ? "Cached" : "Optional"}</span>
      </div>
      <p>{copy(
        "An additional on-device ONNX voice engine with 10 preset voices and 31 supported languages, including Russian and Ukrainian.",
        "Дополнительный локальный ONNX-движок с 10 голосами и 31 языком, включая русский и украинский.",
        "Дадатковы лакальны ONNX-рухавік з 10 галасамі і 31 мовай, у тым ліку рускай і ўкраінскай."
      )}</p>
      <p className="field-note">{copy(
        "Optional first download: about 400 MB. Model weights use OpenRAIL-M. Download only if you have enough storage and a suitable device. This upstream model project is archived.",
        "Необязательная первая загрузка: около 400 МБ. Лицензия весов — OpenRAIL-M. Загружайте только при достаточном месте и подходящем устройстве. Исходный проект модели архивирован.",
        "Неабавязковая першая загрузка: каля 400 МБ. Ліцэнзія вагаў — OpenRAIL-M. Загружай толькі пры дастатковым месцы і на сумяшчальнай прыладзе. Зыходны праект мадэлі архіваваны."
      )}</p>
      <label>
        {copy("Text (max 300 characters)", "Текст (до 300 символов)", "Тэкст (да 300 сімвалаў)")}
        <textarea rows={3} maxLength={300} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="settings-grid">
        <label>
          {copy("Speech language", "Язык речи", "Мова маўлення")}
          <select value={ttsLanguage} onChange={(event) => setTtsLanguage(event.target.value as SupertonicLanguage)}>
            {SUPERTONIC_LANGUAGES.filter(([code]) => code !== "na").map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label>
          {copy("Neural voice style", "Стиль нейросетевого голоса", "Стыль нейрасеткавага голасу")}
          <select value={voice} onChange={(event) => setVoice(event.target.value as SupertonicVoice)}>
            {SUPERTONIC_VOICES.map((v) => <option key={v} value={v}>{v.startsWith("F") ? "Female" : "Male"} · {v}</option>)}
          </select>
        </label>
      </div>
      <label>
        {copy("Speech speed", "Скорость речи", "Хуткасць маўлення")} · {speed.toFixed(2)}×
        <input type="range" min="0.7" max="1.8" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
      </label>
      <label>
        {copy("Quality steps", "Шаги качества", "Крокі якасці")}
        <select value={steps} onChange={(event) => setSteps(Number(event.target.value))}>
          <option value={5}>5 · Faster</option>
          <option value={8}>8 · Balanced</option>
          <option value={12}>12 · Higher quality</option>
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={adaptive} onChange={(event) => setAdaptive(event.target.checked)} />
        {copy("Adaptive pacing", "Адаптивный темп", "Адаптыўны тэмп")}
      </label>
      <p className="field-note">{copy(
        "Adaptive pacing changes speed based on text length and punctuation. It does not detect emotion or clone a voice.",
        "Адаптивный темп меняет скорость в зависимости от длины текста и пунктуации. Он не распознаёт эмоции и не клонирует голос.",
        "Адаптыўны тэмп змяняе хуткасць у залежнасці ад даўжыні тэксту і пунктуацыі. Ён не распазнае эмоцыі і не клануе голас."
      )}</p>
      <div className="section-head">
        <button className="outline" type="button" disabled={status === "loading" || status === "generating"} onClick={() => void load()}>
          {status === "loading" ? copy("Loading…", "Загрузка…", "Загрузка…") : copy("Download & load (~400 MB)", "Загрузить и открыть (~400 МБ)", "Загрузіць і адкрыць (~400 МБ)")}
        </button>
        <button className="primary" type="button" disabled={status !== "ready" || !text.trim()} onClick={() => void generate()}>
          {status === "generating" ? copy("Generating…", "Генерация…", "Стварэнне…") : copy("Generate speech", "Создать речь", "Стварыць маўленне")}
        </button>
      </div>
      {progress && <p className="field-note" role="status">{progress}</p>}
      <p className="field-note" role="status" aria-live="polite">{message}</p>
      {audioUrl && <audio ref={audioRef} src={audioUrl} controls aria-label={copy("Supertonic generated speech", "Речь, созданная Supertonic", "Маўленне, створанае Supertonic")} />}
      {cached && <button className="outline" type="button" onClick={() => void clearModel()}>{copy("Remove downloaded model", "Удалить загруженную модель", "Выдаліць загружаную мадэль")}</button>}
      {language === "be" && <small>{copy(
        "Belarusian is not in Supertonic 3's supported language list. Use the system voice for Belarusian; ECHO will not silently replace it with Russian.",
        "Белорусского нет в списке языков Supertonic 3. Для него используйте системный голос; ECHO не будет незаметно заменять его русским.",
        "Беларускай мовы няма ў спісе Supertonic 3. Для яе выкарыстоўвай сістэмны голас; ECHO не будзе непрыкметна замяняць яго рускай мовай."
      )}</small>}
    </section>
  );
}
