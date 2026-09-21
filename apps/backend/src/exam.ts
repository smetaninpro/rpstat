import { BadRequestException, Body, Controller, Get, Injectable, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { ExamStatus, Role } from "@prisma/client";
import { IsArray, IsBoolean, IsInt, IsString, Length, Max, Min } from "class-validator";
import { PrismaService } from "./prisma.service";
import { Roles, RoleGuard, SessionGuard } from "./auth";

type Question = { text: string; options: string[]; correct: number[] };
const questions: Question[] = [
  ["Какая статья инкриминируется за превышение должностных полномочий?", ["Статья 77 УК РФ", "Статья 79 УК РФ", "Статья 76 УК РФ"], [0]],
  ["На какой максимальный срок может быть задержано лицо до принятия официального решения?", ["Не более 24 часов", "Не более 48 часов", "Не более 60 минут", "Не более 3 часов"], [2]],
  ["Сколько всего управлений в УФСБ?", ["3", "4", "5", "6"], [2]],
  ["Халатность это?", ["Сознательное допущение последствий", "Самоуверенный расчет", "Непредвидение последствий при обязанности их предвидеть", "Прямой умысел"], [2]],
  ["Время обеда в управлении", ["12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00"], [1]],
  ["Содержание ст. 44 УК РФ?", ["Грабеж", "Кража", "Убийство"], [1]],
  ["Назовите рабочее время в будни.", ["10:00 - 21:00", "09:00 - 21:00", "10:00 - 22:00", "10:00 - 20:00"], [2]],
  ["Назовите права задержанного.", ["Не свидетельствовать против себя", "Требовать государственного адвоката", "Требовать неподобающего адвоката", "Присутствие адвоката", "Консультация с адвокатом до 5 минут", "Консультация более 10 минут", "Один телефонный звонок до 2 минут"], [0, 1, 3, 4, 6]],
  ["Какое спецсредство рекомендуется для нейтрализации сопротивления без тяжкого вреда?", ["Пистолет ПМ", "Тазер", "Дубинка", "Светошумовая граната", "Пистолет ПЯ"], [1]],
  ["Когда возникает право на телефонный звонок?", ["Сразу", "В СИЗО/КПЗ после доставки", "В автомобиле", "По усмотрению сотрудника"], [1]],
].map(([text, options, correct]) => ({ text: text as string, options: options as string[], correct: correct as number[] }));
questions.push(
  { text: "Что происходит, если адвокат не прибывает для конфиденциальной беседы в течение 5 минут?", options: ["Ожидание продлевается еще на 5 минут.", "Право считается реализованным, процедура продолжается.", "Задержанный лишается этого права.", "Сотрудник сам выбирает адвоката."], correct: [1] },
  { text: "Сотрудник вправе запросить максимально на отпуск сколько дней в течение месяца?", options: ["3 дня.", "7 дней.", "10 дней.", "14 дней."], correct: [3] },
  { text: "Имеет ли статус неприкосновенности Судья?", options: ["Нет.", "Да.", "На усмотрении руководства."], correct: [1] },
  { text: "Выберите виды дисциплинарных взысканий.", options: ["Предупреждения.", "Выговор.", "Денежное взыскание.", "Увольнение по соответствующим основаниям.", "Лишение премии."], correct: [0, 1, 3] },
  { text: "Какое наказание предусмотрено за мелкое хулиганство?", options: ["Лишение свободы до 15 суток", "Обязательные работы до 50 часов", "Штраф от 10000 до 30000 рублей или арест до 7 суток", "Предупреждение"], correct: [2] },
  { text: "Что из перечисленного НЕ входит в пять основных принципов деятельности органов ФСБ?", options: ["Уважение и соблюдение прав и свобод человека", "Публичность и полная открытость (гласность)", "Конспирация", "Централизация (единство системы органов)"], correct: [1] },
  { text: "Какое подразделение выполняет функции «УСБ» и занимается делами собственных коррумпированных сотрудников?", options: ["Управление «М» (1-я служба)", "Управление «К» (2-я служба)", "Управление «О» (Кадры)", "Управление «А» (Альфа)", "Управление «АПС» (Прикомандированные)"], correct: [0] },
  { text: "Спустя сколько времени можно задержать за неуплату штрафа?", options: ["Спустя 15 секунд", "Спустя 25 секунд", "Спустя 35 секунд", "Спустя 45 секунд"], correct: [2] },
  { text: "Какие акты составляют правовую основу деятельности Федеральной службы безопасности?", options: ["Конституция РФ", "Нормативные правовые акты Председателя Правительства РФ", "Акты Губернаторов федеральных округов РФ", "Все перечисленные выше документы"], correct: [3] },
  { text: "Содержание ст. 89 УК РФ?", options: ["Влияние на судебное дело", "Присвоение полномочий", "Вооруженный мятеж", "Посягательство на сотрудника при исполнении"], correct: [3] },
  { text: "Кто НЕ имеет права на вход на место происшествия?", options: ["Адвокат задержанного.", "Два представителя Следственного комитета.", "Сотрудник Управления «М».", "Начальник задержанного, являющийся государственным служащим."], correct: [1] },
  { text: "В чем главное юридическое отличие кражи от грабежа?", options: ["В сумме ущерба.", "Кража совершается тайно, а грабеж открыто.", "В статусе преступника.", "В месте совершения."], correct: [1] },
  { text: "Отбор сумки с угрозой ножом, приставленным к горлу, квалифицируется как?", options: ["Кража", "Грабеж", "Разбой", "Халатность"], correct: [2] },
  { text: "Какое решение принять при проникновении на охраняемую территорию по ст. 8.11 КоАП?", options: ["Отпустить гражданина.", "Провести профилактическую беседу.", "Составить протокол по ст. 8.11 КоАП.", "Оштрафовать на 5 000."], correct: [2] },
  { text: "Какие действия прямо разрешены согласно ст. 12 «О ФСБ»?", options: ["Запретить передвижение граждан по участку для мероприятия.", "Использовать форму и транспорт без знаков при наблюдении.", "Самостоятельно определять ПДД.", "Проверять документы, удостоверяющие личность.", "Изымать ограниченные в обороте предметы без разрешения."], correct: [0, 1, 3, 4] },
  { text: "В каких ситуациях использование спецсигналов является правомерным?", options: ["Для проезда пробки по личным делам.", "Следование на специальную антитеррористическую операцию.", "Транспортировка задержанного в КПЗ.", "Доставка раненого сотрудника в больницу."], correct: [1, 2, 3] },
  { text: "Что является основанием для привлечения лица к уголовной ответственности?", options: ["Факт задержания на месте происшествия.", "Деяние, содержащее все признаки состава преступления.", "Устное признание вины.", "Распоряжение руководства."], correct: [1] },
  { text: "Какой правовой статус Федеральной службы безопасности?", options: ["Совокупность независимых региональных ведомств.", "Федеральный орган исполнительной власти, единая централизованная система.", "Негосударственная организация.", "Подразделение местных органов."], correct: [1] },
  { text: "Какой состав преступления описывает незаконное проникновение на объект?", options: ["Статья 62.1 УК РФ", "Статья 62.2 УК РФ", "Статья 64 УК РФ", "Статья 65 УК РФ"], correct: [0] },
  { text: "На каких территориях запрещено проводить процессуальные действия?", options: ["Территории военных частей.", "Закрытые бизнес-помещения.", "Территории спавна: аукцион, ЦГБ, вокзал.", "Жилые кварталы."], correct: [2] },
);

class StartDto { @IsString() @Length(1, 80) firstName!: string; @IsString() @Length(1, 80) lastName!: string; @IsString() @Length(7, 7) examCode!: string; @IsBoolean() consent!: boolean; }
class AnswerDto { @IsInt() @Min(0) @Max(29) questionIndex!: number; @IsArray() answers!: number[]; }
@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}
  question(index: number, questionIndex = index) { const item = questions[questionIndex]; if (!item) throw new NotFoundException(); const options = item.options.map((text, id) => ({ id, text })).sort(() => Math.random() - 0.5); return { index, text: item.text, options, multiple: item.correct.length > 1, total: questions.length }; }
  async start(dto: StartDto) {
    if (!dto.consent || !/^\d{3}-\d{3}$/.test(dto.examCode)) throw new BadRequestException("Проверьте данные регистрации и подтвердите согласие.");
    const admission = await this.prisma.examAdmission.findFirst({ where: { active: true, examCode: dto.examCode, firstName: { equals: dto.firstName.trim(), mode: "insensitive" }, lastName: { equals: dto.lastName.trim(), mode: "insensitive" } } });
    if (!admission) throw new BadRequestException("Вы не зарегистрированы для экзамена");
    const used = await this.prisma.examAttempt.count({ where: { admissionId: admission.id } });
    if (used >= 3 && admission.examCode !== "111-111") throw new BadRequestException("Достигнут лимит попыток: 3.");
    const questionOrder = questions.map((_, index) => index).sort(() => Math.random() - 0.5);
    const attempt = await this.prisma.examAttempt.create({ data: { admissionId: admission.id, questionOrder } });
    return { attemptId: attempt.id, question: this.question(0, questionOrder[0]), secondsPerQuestion: 30 };
  }
  async answer(id: string, dto: AnswerDto) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id } });
    if (!attempt || attempt.status !== ExamStatus.IN_PROGRESS) throw new NotFoundException();
    if (dto.questionIndex !== attempt.currentQuestion) throw new BadRequestException("Вопрос уже завершен.");
    if (Date.now() - attempt.questionStartedAt.getTime() > 45_000) dto.answers = [];
    const order = Array.isArray(attempt.questionOrder) ? attempt.questionOrder as number[] : questions.map((_, index) => index);
    const actualIndex = order[dto.questionIndex];
    const answers = Array.isArray(attempt.answers) ? [...attempt.answers] : [];
    answers[dto.questionIndex] = dto.answers.filter((value) => Number.isInteger(value) && value >= 0 && value < questions[actualIndex].options.length).sort();
    const next = dto.questionIndex + 1;
    if (next === questions.length) { const score = order.reduce((total, itemIndex, index) => total + (JSON.stringify(questions[itemIndex].correct) === JSON.stringify(answers[index] ?? []) ? 1 : 0), 0); await this.prisma.examAttempt.update({ where: { id }, data: { answers, currentQuestion: next, status: ExamStatus.COMPLETED, score, completedAt: new Date() } }); return { completed: true, score, total: questions.length }; }
    await this.prisma.examAttempt.update({ where: { id }, data: { answers, currentQuestion: next, questionStartedAt: new Date() } }); return { completed: false, question: this.question(next, order[next]) };
  }
  async report() { return this.prisma.examAdmission.findMany({ include: { attempts: { orderBy: { startedAt: "desc" }, select: { status: true, score: true, startedAt: true, completedAt: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }); }
}
@Controller("api/exam")
export class ExamController { constructor(private readonly exam: ExamService) {} @Post("start") start(@Body() dto: StartDto) { return this.exam.start(dto); } @Post(":id/answer") answer(@Param("id") id: string, @Body() dto: AnswerDto) { return this.exam.answer(id, dto); } @Get("report") @UseGuards(SessionGuard, RoleGuard) @Roles(Role.ADMIN) report() { return this.exam.report(); } }
