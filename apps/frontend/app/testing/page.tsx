"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Question = { index: number; text: string; options: { id: number; text: string }[]; multiple: boolean; total: number };
type Exam = { attemptId: string; question: Question; secondsPerQuestion: number };
const request = async (url: string, init: RequestInit) => {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Не удалось обработать запрос.");
  return response.json();
};
export default function TestingPage() {
  const [exam, setExam] = useState<Exam | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const submitting = useRef(false);
  const submit = async (answers = selected) => {
    if (!exam || submitting.current) return;
    submitting.current = true;
    try {
      const response = await request(`/api/exam/${exam.attemptId}/answer`, { method: "POST", body: JSON.stringify({ questionIndex: exam.question.index, answers }) });
      if (response.completed) setResult(response); else { setExam((current) => current ? { ...current, question: response.question } : current); setSelected([]); setSeconds(30); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить ответ."); }
    finally { submitting.current = false; }
  };
  useEffect(() => {
    if (!exam || result) return;
    if (seconds <= 0) { setBlockedReason(`Время на вопрос ${exam.question.index + 1} истекло.`); return; }
    if (blockedReason) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [exam, result, seconds, blockedReason]);
  useEffect(() => {
    const leave = () => { if (exam && !result) setBlockedReason(`Вопрос ${exam.question.index + 1} не засчитан: обнаружено переключение вкладки или сворачивание окна.`); };
    window.addEventListener("blur", leave);
    return () => window.removeEventListener("blur", leave);
  }, [exam, result]);
  if (result) return <main className="exam-page"><section className="exam-card result-card"><p className="exam-kicker">ТЕСТИРОВАНИЕ ЗАВЕРШЕНО</p><h1>{result.score >= 25 ? "Экзамен сдан" : "Экзамен не сдан"}</h1><strong>{result.score} / {result.total}</strong><p>Результат сохранен в системе.</p><a href="/testing">Вернуться к регистрации</a></section></main>;
  if (exam) { const question = exam.question; if (blockedReason) return <main className="exam-page"><section className="exam-card result-card"><p className="exam-kicker">ВОПРОС НЕ ЗАСЧИТАН</p><h1>Вопрос {question.index + 1}</h1><p className="exam-error">{blockedReason}</p><p>Ответ на этот вопрос не будет сохранен.</p><button onClick={() => { setBlockedReason(""); void submit([]); }}>Далее</button></section></main>; return <main className="exam-page"><section className="exam-card"><header className="exam-header"><div><p className="exam-kicker">ЭКЗАМЕН</p><span>Вопрос {question.index + 1} из {question.total}</span></div><b className="exam-timer">00:{String(seconds).padStart(2, "0")}</b></header><div className="exam-progress"><i style={{ width: `${((question.index + 1) / question.total) * 100}%` }} /></div><h1>{question.text}</h1><div className="exam-options">{question.options.map((option) => <label key={option.id}><input type={question.multiple ? "checkbox" : "radio"} name="answer" checked={selected.includes(option.id)} onChange={() => setSelected((current) => question.multiple ? (current.includes(option.id) ? current.filter((value) => value !== option.id) : [...current, option.id]) : [option.id])} /><span>{option.text}</span></label>)}</div>{error && <p className="exam-error">{error}</p>}<button onClick={() => void submit()}>Следующий вопрос</button></section></main>; }
  async function start(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); setError(""); try { const response = await request("/api/exam/start", { method: "POST", body: JSON.stringify({ firstName: data.get("firstName"), lastName: data.get("lastName"), examCode: `${data.get("passportLeft")}-${data.get("passportRight")}`, consent: data.get("consent") === "on" }) }); setExam(response); setSeconds(response.secondsPerQuestion); } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось начать тестирование."); } }
  return <main className="exam-page"><form className="exam-card registration-card" onSubmit={start}><p className="exam-kicker">ТЕСТИРОВАНИЕ</p><h1>Экзамен по окончанию академии</h1><p>На каждый вопрос отводится 30 секунд. Не переключайтесь на другие вкладки и не сворачивайте окно во время экзамена.</p><label>Имя<input name="firstName" required maxLength={80} autoComplete="given-name" /></label><label>Фамилия<input name="lastName" required maxLength={80} autoComplete="family-name" /></label><label>Номер Паспорта (статик)<span className="passport-input"><input name="passportLeft" required inputMode="numeric" pattern="[0-9]{3}" placeholder="999" maxLength={3} onChange={(event) => event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 3)} /><b>-</b><input name="passportRight" required inputMode="numeric" pattern="[0-9]{3}" placeholder="999" maxLength={3} onChange={(event) => event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 3)} /></span></label><label className="exam-consent"><input name="consent" type="checkbox" required /><span>Я согласен начать тестирование и понимаю, что переключение на другие вкладки или сворачивание окна завершает текущий вопрос.</span></label>{error && <p className="exam-error">{error}</p>}<button type="submit">Регистрация</button></form></main>;
}
