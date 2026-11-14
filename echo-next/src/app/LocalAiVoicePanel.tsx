import { useEffect, useRef, useState } from "react";
import { AI_VOICES, loadLocalAIPreferences, saveLocalAIPreferences, loadLocalAI, synthesizeLocalAI, type AIVoice } from "../services/localAi";

type UILanguage = "en" | "ru" | "be";
export default function LocalAiVoicePanel({ language }: { language: UILanguage }) {
  const ru = language === "ru";
  const be = language === "be";
  const [text, setText] = useState("Hello. This is a new AI-generated voice.");
  const [voice, setVoice] = useState<AIVoice>(() => loadLocalAIPreferences().voice);
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
      <label>
        {copy("AI voice", "Нейросетевой голос", "Голас нейрасеткі")}
        <select aria-label={copy("Kokoro voice", "Голос Kokoro", "Голас Kokoro")} value={voice} onChange={(event) => setVoice(event.target.value as AIVoice)}>
          {AI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>
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
