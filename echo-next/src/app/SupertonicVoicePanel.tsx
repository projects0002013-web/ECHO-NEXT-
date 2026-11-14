import { useEffect, useRef, useState } from "react";
import {
  getSupertonicCacheStatus,
  loadSupertonic,
  modelStorageEstimate,
  removeSupertonicModel,
  SUPERTONIC_LANGUAGES,
  SUPERTONIC_VOICES,
  synthesizeSupertonic,
  type SupertonicLanguage,
  type SupertonicVoice,
  type SupertonicCacheStatus,
  loadSupertonicPreferences,
  saveSupertonicPreferences,
} from "../services/supertonic";

type UILanguage = "en" | "ru" | "be";
type Status = "idle" | "loading" | "ready" | "generating" | "error";

export default function SupertonicVoicePanel({ language }: { language: UILanguage }) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("Hello. This is ECHO speaking with Supertonic.");
  const [preferences, setPreferences] = useState(() =>
    loadSupertonicPreferences(language === "ru" ? "ru" : "en"),
  );
  const { voice, language: ttsLanguage, speed, steps, adaptive } = preferences;
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [cacheStatus, setCacheStatus] = useState<SupertonicCacheStatus>({ available: true, modelFilesCached: 0, modelFilesTotal: 6, voiceStylesCached: 0, voiceStylesTotal: 10, complete: false });
  const cached = cacheStatus.complete;
  const hasPartialCache = cacheStatus.modelFilesCached > 0 || cacheStatus.voiceStylesCached > 0;
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef("");

  const copy = (en: string, ru: string, be: string) =>
    language === "ru" ? ru : language === "be" ? be : en;

  useEffect(() => {
    void getSupertonicCacheStatus()
      .then((stored) => {
        setCacheStatus(stored);
        if (stored.complete) setMessage(copy(
          "All model files are saved on this device. Load the cached model; no download is needed.",
          "Все файлы модели сохранены на устройстве. Загрузите сохранённую модель — повторное скачивание не требуется.",
          "Усе файлы мадэлі захаваныя на прыладзе. Загрузі захаваную мадэль — паўторная загрузка не патрэбная."
        ));
        else if (stored.modelFilesCached > 0 || stored.voiceStylesCached > 0) setMessage(copy(
          `Local cache found: ${stored.modelFilesCached}/${stored.modelFilesTotal} model files and ${stored.voiceStylesCached}/${stored.voiceStylesTotal} voice styles. Only missing files will be downloaded.`,
          `Найдены сохранённые файлы: модель ${stored.modelFilesCached}/${stored.modelFilesTotal}, голоса ${stored.voiceStylesCached}/${stored.voiceStylesTotal}. Будут загружены только отсутствующие файлы.`,
          `Знойдзены захаваныя файлы: мадэль ${stored.modelFilesCached}/${stored.modelFilesTotal}, галасы ${stored.voiceStylesCached}/${stored.voiceStylesTotal}. Будуць загружаныя толькі адсутныя файлы.`
        ));
      })
      .catch(() => setCacheStatus((current) => ({ ...current, available: false })));
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    saveSupertonicPreferences(preferences);
  }, [preferences]);

  const load = async () => {
    if (status === "loading" || status === "generating") return;
    setStatus("loading");
    setMessage(copy(
      "Checking available storage and preparing the optional ~400 MB model…",
      "Проверяем память и готовим дополнительную модель размером около 400 МБ…",
      "Правяраем сховішча і рыхтуем дадатковую мадэль памерам каля 400 МБ…"
    ));
    try {
      const before = await getSupertonicCacheStatus();
      setCacheStatus(before);
      if (!before.available) {
        throw new Error(copy(
          "This browser cannot access local model storage, so Supertonic cannot be kept for offline use.",
          "Браузер не предоставляет локальное хранилище моделей, поэтому Supertonic не сможет работать офлайн после перезапуска.",
          "Браўзер не мае доступу да лакальнага сховішча мадэляў, таму Supertonic не зможа працаваць без інтэрнэту пасля перазапуску."
        ));
      }
      const estimate = await modelStorageEstimate();
      if (!before.complete && before.modelFilesCached === 0 && before.voiceStylesCached === 0 &&
          estimate.available !== undefined && estimate.available < 420 * 1024 * 1024) {
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
      const stored = await getSupertonicCacheStatus();
      setCacheStatus(stored);
      if (!stored.complete) throw new Error(copy(
        "The model could not be fully saved on this device. Check available storage and retry; saved files will be reused.",
        "Не удалось полностью сохранить модель на устройстве. Проверьте свободную память и повторите попытку; уже сохранённые файлы будут использованы повторно.",
        "Не ўдалося цалкам захаваць мадэль на прыладзе. Правер вольнае месца і паўтары спробу; ужо захаваныя файлы будуць выкарыстаныя паўторна."
      ));
      setStatus("ready");
      setProgress("");
      setMessage(estimate.persistent
        ? copy("Supertonic 3 is ready. All model files are saved with persistent browser storage.", "Supertonic 3 готова. Все файлы сохранены в постоянном хранилище браузера.", "Supertonic 3 гатовая. Усе файлы захаваныя ў пастаянным сховішчы браўзера.")
        : copy("Supertonic 3 is saved locally, but the browser did not grant persistent-storage protection. It may clear cached files if device storage becomes low. Do not clear ECHO site/app data.", "Supertonic 3 сохранена локально, но браузер не предоставил защиту постоянного хранилища. При нехватке памяти он может очистить кэш. Не очищайте данные ECHO.", "Supertonic 3 захаваная лакальна, але браўзер не даў абарону пастаяннага сховішча. Пры недахопе памяці ён можа ачысціць кэш. Не ачышчай даныя ECHO."));
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
    setCacheStatus({ available: true, modelFilesCached: 0, modelFilesTotal: 6, voiceStylesCached: 0, voiceStylesTotal: 10, complete: false });
    setStatus("idle");
    setMessage(copy("Supertonic model cache removed from this browser.", "Кэш модели Supertonic удалён из этого браузера.", "Кэш мадэлі Supertonic выдалены з гэтага браўзера."));
  };

  return (
    <section className="panel" aria-label={copy("Supertonic 3 multilingual neural speech", "Мультиязычный нейросетевой синтез Supertonic 3", "Шматмоўны нейрасеткавы сінтэз Supertonic 3")}>
      <div className="section-head">
        <h2>{copy("Supertonic 3 · Multilingual AI", "Supertonic 3 · Мультиязычный ИИ", "Supertonic 3 · Шматмоўны ШІ")}</h2>
        <span className="badge">{status === "ready" ? "Ready" : cached ? "Cached" : hasPartialCache ? "Partial cache" : cacheStatus.available ? "Optional" : "Storage unavailable"}</span>
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
      <p className="field-note" role="status" aria-live="polite">{copy(
        `Saved locally: ${cacheStatus.modelFilesCached}/${cacheStatus.modelFilesTotal} model files and ${cacheStatus.voiceStylesCached}/${cacheStatus.voiceStylesTotal} voice styles. Only files missing from this device are downloaded.`,
        `Сохранено на устройстве: файлов модели ${cacheStatus.modelFilesCached}/${cacheStatus.modelFilesTotal}, голосов ${cacheStatus.voiceStylesCached}/${cacheStatus.voiceStylesTotal}. Скачиваются только отсутствующие файлы.`,
        `Захавана на прыладзе: файлаў мадэлі ${cacheStatus.modelFilesCached}/${cacheStatus.modelFilesTotal}, галасоў ${cacheStatus.voiceStylesCached}/${cacheStatus.voiceStylesTotal}. Спампоўваюцца толькі адсутныя файлы.`
      )}</p>
      <label>
        {copy("Text (max 300 characters)", "Текст (до 300 символов)", "Тэкст (да 300 сімвалаў)")}
        <textarea rows={3} maxLength={300} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="settings-grid">
        <label>
          {copy("Speech language", "Язык речи", "Мова маўлення")}
          <select aria-label={copy("Speech language", "Язык речи", "Мова маўлення")} value={ttsLanguage} onChange={(event) => setPreferences((current) => ({ ...current, language: event.target.value as SupertonicLanguage }))}>
            {SUPERTONIC_LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <div className="supertonic-voice-picker" role="group" aria-label={copy("Neural voice style", "Стиль нейросетевого голоса", "Стыль нейрасеткавага голасу")}>
          <span className="supertonic-picker-label">{copy("Neural voice style", "Стиль нейросетевого голоса", "Стыль нейрасеткавага голасу")}</span>
          <div className="supertonic-voice-grid">
            {SUPERTONIC_VOICES.map((v) => <button type="button" key={v} className={voice === v ? "supertonic-voice-option selected" : "supertonic-voice-option"} aria-pressed={voice === v} onClick={() => setPreferences((current) => ({ ...current, voice: v }))}>
              <span className="supertonic-voice-symbol">{v.startsWith("F") ? "F" : "M"}</span>
              <span><strong>{v.startsWith("F") ? copy("Female", "Женский", "Жаночы") : copy("Male", "Мужской", "Мужчынскі")}</strong><small>{v}</small></span>
              {voice === v && <span className="supertonic-voice-selected">✓</span>}
            </button>)}
          </div>
        </div>
      </div>
      <label>
        {copy("Speech speed", "Скорость речи", "Хуткасць маўлення")} · {speed.toFixed(2)}×
        <input aria-label={copy("Speech speed", "Скорость речи", "Хуткасць маўлення")} type="range" min="0.7" max="1.8" step="0.05" value={speed} onChange={(event) => setPreferences((current) => ({ ...current, speed: Number(event.target.value) }))} />
      </label>
      <label>
        {copy("Quality steps", "Шаги качества", "Крокі якасці")}
        <select aria-label={copy("Quality steps", "Шаги качества", "Крокі якасці")} value={steps} onChange={(event) => setPreferences((current) => ({ ...current, steps: Number(event.target.value) as 5 | 8 | 12 }))}>
          <option value={5}>5 · Faster</option>
          <option value={8}>8 · Balanced</option>
          <option value={12}>12 · Higher quality</option>
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={adaptive} onChange={(event) => setPreferences((current) => ({ ...current, adaptive: event.target.checked }))} />
        {copy("Adaptive pacing", "Адаптивный темп", "Адаптыўны тэмп")}
      </label>
      <p className="field-note">{copy(
        "Adaptive pacing changes speed based on text length and punctuation. It does not detect emotion or clone a voice.",
        "Адаптивный темп меняет скорость в зависимости от длины текста и пунктуации. Он не распознаёт эмоции и не клонирует голос.",
        "Адаптыўны тэмп змяняе хуткасць у залежнасці ад даўжыні тэксту і пунктуацыі. Ён не распазнае эмоцыі і не клануе голас."
      )}</p>
      <div className="section-head">
        <button className="outline" type="button" disabled={status === "loading" || status === "generating" || !cacheStatus.available} onClick={() => void load()}>
          {status === "loading" ? copy("Loading…", "Загрузка…", "Загрузка…") : cached ? copy("Load cached model", "Загрузить сохранённую модель", "Загрузіць захаваную мадэль") : hasPartialCache ? copy("Resume setup (missing files only)", "Продолжить установку (только недостающие файлы)", "Працягнуць усталяванне (толькі адсутныя файлы)") : copy("Download & load (~400 MB)", "Загрузить и открыть (~400 МБ)", "Загрузіць і адкрыць (~400 МБ)")}
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
