import { useEffect, useRef, useState } from "react";
import { AI_VOICES, loadLocalAI, synthesizeLocalAI, type AIVoice } from "../services/localAi";

export default function LocalAiVoicePanel({ language }: { language: "en" | "ru" }) {
  const ru = language === "ru";
  const [text, setText] = useState("Hello. This is a new AI-generated voice.");
  const [voice, setVoice] = useState<AIVoice>("af_heart");
  const [status, setStatus] = useState<"unloaded" | "loading" | "ready" | "generating" | "error">("unloaded");
  const [message, setMessage] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const load = async () => {
    if (status === "loading" || status === "generating") return;
    setStatus("loading");
    setMessage(ru
      ? "Загрузка модели на устройство. При первом запуске потребуется интернет и свободная память."
      : "Loading the model onto this device. The first download needs internet and free memory.");
    try {
      await loadLocalAI();
      if (!mountedRef.current) return;
      setStatus("ready");
      setMessage(ru ? "Модель загружена. Теперь можно генерировать речь." : "AI model ready. Generate speech below.");
    } catch {
      if (!mountedRef.current) return;
      setStatus("error");
      setMessage(ru
        ? "Модель не загрузилась. Проверьте интернет, память и поддержку браузера. Можно повторить."
        : "Could not load AI model. Check the connection, memory, and browser support, then retry.");
    }
  };

  const generate = async () => {
    if (status !== "ready") return;
    setStatus("generating");
    setMessage(ru ? "Нейросеть создаёт звук на этом устройстве…" : "Generating speech on this device…");
    try {
      const blob = await synthesizeLocalAI(text, voice);
      if (!mountedRef.current) return;
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setAudioUrl(url);
      setStatus("ready");
      setMessage(ru ? "Готово. Нажмите Play ниже." : "Generated. Press Play below.");
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "AI generation failed.");
    }
  };

  return (
    <section className="panel" aria-label={ru ? "Локальный ИИ-синтез речи" : "Local AI speech synthesis"}>
      <div className="section-head">
        <h2>{ru ? "Нейросетевой синтез речи" : "Neural voice synthesis"}</h2>
        <span className="badge">{status === "ready" ? (ru ? "Готов" : "Ready") : "Beta"}</span>
      </div>
      <p>{ru
        ? "Настоящая нейросеть Kokoro создаёт новые фразы на устройстве. Пока поддерживается английский. Это не копия личного голоса."
        : "Kokoro generates new speech locally. English only for now. This does not clone a person's voice."}
      </p>
      <p className="field-note">{ru
        ? "Модель загружается отдельно при первом запуске (большой файл). При дальнейшем использовании её хранение зависит от кэша браузера. Фразы и записи не загружаются на сервер синтеза."
        : "Model download is large and needs internet once. Later offline availability depends on browser cache. Your phrases and recordings are not sent to an inference server."}
      </p>
      <label>
        {ru ? "Английский текст для ИИ" : "English text for AI"}
        <textarea
          rows={3}
          maxLength={400}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type an English phrase"
        />
      </label>
      <label>
        {ru ? "Нейросетевой голос" : "AI voice"}
        <select value={voice} onChange={(event) => setVoice(event.target.value as AIVoice)}>
          {AI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>
      <div className="section-head">
        <button
          className="outline"
          type="button"
          disabled={status === "loading" || status === "generating"}
          onClick={() => void load()}
        >
          {status === "loading" ? (ru ? "Загружается…" : "Loading…") : (ru ? "Загрузить ИИ" : "Load AI model")}
        </button>
        <button
          className="primary"
          type="button"
          disabled={status !== "ready" || !text.trim()}
          onClick={() => void generate()}
        >
          {status === "generating" ? (ru ? "Генерация…" : "Generating…") : (ru ? "Создать речь" : "Generate speech")}
        </button>
      </div>
      <p className="field-note" role="status" aria-live="polite">{message}</p>
      {audioUrl && <audio ref={audioRef} src={audioUrl} controls aria-label={ru ? "Созданная ИИ речь" : "Generated AI speech"} />}
      <small>{ru
        ? "Для русского и казахского пользуйтесь системным голосом. Персональное клонирование голоса пока не подключено."
        : "For Russian or Kazakh, use system speech. Personalized voice cloning is not configured."}
      </small>
    </section>
  );
}
