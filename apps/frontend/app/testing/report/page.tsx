"use client";

import { useEffect, useState } from "react";
type Attempt = { status: string; score: number | null; startedAt: string; completedAt: string | null };
type Admission = { id: string; firstName: string; lastName: string; examCode: string; active: boolean; attempts: Attempt[] };
export default function TestingReportPage() {
  const [items, setItems] = useState<Admission[]>([]); const [error, setError] = useState("");
  useEffect(() => { const csrf = document.cookie.split("; ").find((item) => item.startsWith("rmrp_csrf="))?.split("=")[1] ?? ""; fetch("/api/exam/report", { headers: { "x-csrf-token": csrf } }).then(async (response) => { if (!response.ok) throw new Error(response.status === 403 ? "Отчет доступен только администратору." : "Не удалось загрузить отчет."); return response.json(); }).then(setItems).catch((reason) => setError(reason.message)); }, []);
  return <main className="exam-page"><section className="exam-card report-card"><p className="exam-kicker">АДМИНИСТРАТОР</p><h1>Отчет по тестированию</h1>{error ? <p className="exam-error">{error}</p> : <div className="exam-report">{items.map((item) => <article key={item.id}><header><b>{item.lastName} {item.firstName}</b><span>{item.examCode}</span></header><p>Попыток: {item.attempts.length} / 3</p>{item.attempts.length ? item.attempts.map((attempt, index) => <div key={`${attempt.startedAt}-${index}`}>Попытка {item.attempts.length - index}: {attempt.status === "COMPLETED" ? `${attempt.score} / 30 ${attempt.score! >= 25 ? "сдан" : "не сдан"}` : "не завершена"}</div>) : <small>Попыток пока нет</small>}</article>)}</div>}</section></main>;
}
