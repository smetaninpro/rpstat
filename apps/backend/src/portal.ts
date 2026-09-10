import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { MessageStatus, Prisma, Role } from "@prisma/client";
import { CurrentUser, RoleGuard, Roles, SessionGuard } from "./auth";
import { PrismaService } from "./prisma.service";
import { parseDiscordNickname } from "./discord-nickname";

class CreateEmployeeDto {
  @IsString() @Length(1, 120) gameName!: string;
  @IsOptional() @IsString() @Length(1, 64) discordUserId?: string;
  @IsOptional() @IsString() @Length(1, 256) discordDisplayName?: string;
  @IsOptional() @IsString() rankId?: string;
  @IsOptional() @IsString() positionId?: string;
  @IsOptional() @IsString() departmentId?: string;
}
class CreateManualEventDto {
  @IsString() employeeId!: string;
  @IsString() activityTypeId!: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsString() occurredAt!: string;
  @IsString() @Length(3, 1000) reason!: string;
}
class MaterialDto {
  @IsString() @Length(3, 160) title!: string;
  @IsString() @Length(1, 10000) body!: string;
  @IsOptional() @IsString() @Length(1, 2048) linkUrl?: string | null;
  @IsBoolean() isPublic!: boolean;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() attachments?: { fileName: string; mimeType: string; dataBase64: string }[];
}
class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take = 25;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
}
class EmployeeQueryDto extends PaginationDto {
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() rankId?: string;
  @IsOptional() @IsString() positionId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() active?: boolean;
}
class AnalyticsPeriodDto {
  @IsOptional() @IsIn(["week", "month"]) period: "week" | "month" = "week";
}
class ReviewQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(MessageStatus) status?: MessageStatus;
}
class ResolveEmployeeDto {
  @IsString() employeeId!: string;
}
class AssignRankDto {
  @IsString() rankId!: string;
}
class UpdateEmployeeDto {
  @IsOptional() @IsString() @Length(1, 120) gameName?: string;
  @IsOptional() @IsString() @Length(1, 64) discordUserId?: string | null;
  @IsOptional() @IsString() @Length(1, 256) discordDisplayName?: string | null;
  @IsOptional() @IsString() rankId?: string | null;
  @IsOptional() @IsString() positionId?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsString() positionRaw?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class DictionaryDto {
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsString() @Length(1, 32) code?: string;
  @IsOptional() @IsString() @Length(1, 32) shortName?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class CreateScanRequestDto {
  @IsOptional() @IsString() sourceId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) recentDays = 3;
  @IsOptional() @IsInt() @Min(1) @Max(20) limit = 20;
}

@Injectable()
export class PortalService {
  private readonly materialFilesPath = process.env.MATERIAL_FILES_PATH ?? "/data/material-files";
  constructor(private readonly prisma: PrismaService) {}
  async dashboard(user: { role: Role; employeeId: string | null }) {
    const scope = await this.employeeWhere(user);
    if (!scope)
      return {
        activeEmployees: 0,
        reviewMessages: 0,
        collector: { status: "OFFLINE", lastHeartbeatAt: null },
        activity: [],
      };
    const [types, activeEmployees, reviewMessages, collector] =
      await Promise.all([
        this.prisma.activityType.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
        }),
        this.prisma.employee.count({ where: { ...scope, active: true } }),
        this.prisma.integrationMessage.count({
          where: {
            status: {
              in: [
                "UNPARSED",
                "UNKNOWN_EMPLOYEE",
                "UNKNOWN_POSITION",
                "UNKNOWN_DEPARTMENT",
                "REVIEW_REQUIRED",
                "SEQUENCE_GAP",
                "SEQUENCE_CONFLICT",
                "UNKNOWN_TRAINING_TYPE",
                "UNKNOWN_TRAINING_RESULT",
                "MISSING_MENTIONS",
                "OUT_OF_WINDOW",
                "ERROR",
              ],
            },
          },
        }),
        this.prisma.collectorInstance.findFirst({
          orderBy: { lastHeartbeatAt: "desc" },
        }),
      ]);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const monthStart = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      1,
    );
    const [weekTotals, monthTotals] = await Promise.all([
      this.prisma.activityEvent.groupBy({
        by: ["activityTypeId"],
        where: { occurredAt: { gte: weekStart }, employee: scope },
        _sum: { quantity: true },
      }),
      this.prisma.activityEvent.groupBy({
        by: ["activityTypeId"],
        where: { occurredAt: { gte: monthStart }, employee: scope },
        _sum: { quantity: true },
      }),
    ]);
    const weekByType = new Map(
      weekTotals.map((total) => [
        total.activityTypeId,
        total._sum.quantity ?? 0,
      ]),
    );
    const monthByType = new Map(
      monthTotals.map((total) => [
        total.activityTypeId,
        total._sum.quantity ?? 0,
      ]),
    );
    return {
      activeEmployees,
      reviewMessages,
      collector: collector ?? { status: "OFFLINE", lastHeartbeatAt: null },
      activity: types.map((type) => ({
        id: type.id,
        code: type.code,
        name: type.name,
        weekQuantity: weekByType.get(type.id) ?? 0,
        monthQuantity: monthByType.get(type.id) ?? 0,
      })),
    };
  }
  private async departmentScope(user: {
    role: Role;
    employeeId: string | null;
  }) {
    if (user.role === Role.ADMIN) return undefined;
    if ((user.role !== Role.LEADER && user.role !== Role.EMPLOYEE) || !user.employeeId) return null;
    return (
      (
        await this.prisma.employee.findUnique({
          where: { id: user.employeeId },
          select: { departmentId: true },
        })
      )?.departmentId ?? null
    );
  }
  private async employeeWhere(user: { role: Role; employeeId: string | null }) {
    if (user.role === Role.EMPLOYEE)
      return user.employeeId ? { id: user.employeeId } : null;
    const departmentId = await this.departmentScope(user);
    return departmentId === undefined
      ? {}
      : departmentId
        ? { departmentId }
        : null;
  }
  private async materialWhere(user: { role: Role; employeeId: string | null }) {
    if (user.role === Role.ADMIN) return {};
    const departmentId = await this.departmentScope(user);
    return departmentId ? { OR: [{ isPublic: true }, { departmentId }] } : { isPublic: true };
  }
  private materialInclude() { return { department: { select: { id: true, name: true, code: true } }, attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } } }; }
  private withAttachmentUrls<T extends { attachments: { id: string }[] }>(material: T) { return { ...material, attachments: material.attachments.map((attachment) => ({ ...attachment, url: `/api/materials/attachments/${attachment.id}` })) }; }
  async materials(user: { role: Role; employeeId: string | null }) {
    return this.prisma.material.findMany({
      where: { active: true, ...(await this.materialWhere(user)) },
      include: this.materialInclude(),
      orderBy: { createdAt: "desc" },
    }).then((materials) => materials.map((material) => this.withAttachmentUrls(material)));
  }
  async adminMaterials() {
    return this.prisma.material.findMany({ include: this.materialInclude(), orderBy: { createdAt: "desc" } }).then((materials) => materials.map((material) => this.withAttachmentUrls(material)));
  }
  private async validateMaterial(dto: MaterialDto) {
    if (!dto.isPublic && !dto.departmentId) throw new BadRequestException("Укажите подразделение или включите общий доступ");
    if (dto.linkUrl) {
      let url: URL;
      try { url = new URL(dto.linkUrl); } catch { throw new BadRequestException("Укажите корректную ссылку HTTPS"); }
      if (url.protocol !== "https:") throw new BadRequestException("Разрешены только HTTPS-ссылки");
    }
    if (dto.departmentId && !(await this.prisma.department.findFirst({ where: { id: dto.departmentId, active: true } }))) throw new BadRequestException("Подразделение не найдено или архивировано");
    if (dto.attachments) {
      if (dto.attachments.length > 5) throw new BadRequestException("Можно прикрепить не более 5 файлов");
      for (const attachment of dto.attachments) {
        if (!attachment || !/^[^\\/:*?\"<>|]{1,180}$/.test(attachment.fileName) || !/^(application\/pdf|image\/(png|jpeg|webp)|text\/plain)$/.test(attachment.mimeType)) throw new BadRequestException("Недопустимый формат вложения");
        const bytes = Buffer.from(attachment.dataBase64, "base64");
        if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new BadRequestException("Размер каждого файла должен быть от 1 Б до 5 МБ");
      }
    }
  }
  private async saveAttachments(materialId: string, attachments: MaterialDto["attachments"]) {
    if (!attachments?.length) return;
    await mkdir(this.materialFilesPath, { recursive: true });
    for (const attachment of attachments) {
      const storageKey = `${randomUUID()}-${createHash("sha256").update(attachment.fileName).digest("hex").slice(0, 12)}`;
      const bytes = Buffer.from(attachment.dataBase64, "base64");
      await writeFile(join(this.materialFilesPath, storageKey), bytes, { flag: "wx" });
      await this.prisma.materialAttachment.create({ data: { materialId, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: bytes.length, storageKey } });
    }
  }
  async createMaterial(dto: MaterialDto, userId: string) {
    await this.validateMaterial(dto);
    const material = await this.prisma.material.create({ data: { title: dto.title.trim(), body: dto.body.trim(), linkUrl: dto.linkUrl?.trim() || null, isPublic: dto.isPublic, departmentId: dto.departmentId || null }, include: this.materialInclude() });
    await this.saveAttachments(material.id, dto.attachments);
    await this.prisma.auditLog.create({ data: { userId, action: "MATERIAL_CREATED", entityType: "Material", entityId: material.id, newValue: { title: material.title, isPublic: material.isPublic, departmentId: material.departmentId } } });
    return this.withAttachmentUrls(await this.prisma.material.findUniqueOrThrow({ where: { id: material.id }, include: this.materialInclude() }));
  }
  async updateMaterial(id: string, dto: MaterialDto, userId: string) {
    await this.validateMaterial(dto);
    const existing = await this.prisma.material.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Материал не найден");
    const material = await this.prisma.material.update({ where: { id }, data: { title: dto.title.trim(), body: dto.body.trim(), linkUrl: dto.linkUrl?.trim() || null, isPublic: dto.isPublic, departmentId: dto.departmentId || null, active: dto.active ?? existing.active }, include: this.materialInclude() });
    await this.saveAttachments(material.id, dto.attachments);
    await this.prisma.auditLog.create({ data: { userId, action: material.active ? "MATERIAL_UPDATED" : "MATERIAL_ARCHIVED", entityType: "Material", entityId: id, oldValue: { title: existing.title, active: existing.active }, newValue: { title: material.title, active: material.active } } });
    return this.withAttachmentUrls(await this.prisma.material.findUniqueOrThrow({ where: { id }, include: this.materialInclude() }));
  }
  async updateLeaderMaterial(id: string, dto: MaterialDto, user: { id: string; role: Role; employeeId: string | null }) {
    const scope = await this.materialWhere(user);
    const material = await this.prisma.material.findFirst({ where: { id, ...scope } });
    if (!material) throw new NotFoundException("Материал не найден");
    if (dto.isPublic !== material.isPublic || dto.departmentId !== material.departmentId || dto.active !== undefined) throw new BadRequestException("Руководитель может менять только содержание и вложения доступного материала");
    return this.updateMaterial(id, { ...dto, isPublic: material.isPublic, departmentId: material.departmentId, active: material.active }, user.id);
  }
  async attachment(id: string, user: { role: Role; employeeId: string | null }) {
    const attachment = await this.prisma.materialAttachment.findUnique({ where: { id }, include: { material: true } });
    if (!attachment || !attachment.material.active) throw new NotFoundException("Вложение не найдено");
    const scope = await this.materialWhere(user);
    if (user.role !== Role.ADMIN && !(attachment.material.isPublic || ("OR" in scope && (scope as any).OR.some((entry: any) => entry.departmentId === attachment.material.departmentId)))) throw new NotFoundException("Вложение не найдено");
    return { attachment, bytes: await readFile(join(this.materialFilesPath, attachment.storageKey)) };
  }
  async activityDetails(
    period: "week" | "month",
    user: { role: Role; employeeId: string | null },
  ) {
    const start = new Date();
    if (period === "week") {
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    } else (start.setDate(1), start.setHours(0, 0, 0, 0));
    const scope = await this.employeeWhere(user);
    if (!scope) return [];
    const events = await this.prisma.activityEvent.findMany({
      where: { occurredAt: { gte: start }, employee: scope },
      include: {
        employee: {
          select: { gameName: true, department: { select: { code: true } } },
        },
        activityType: { select: { name: true } },
        integrationMessage: {
          select: {
            guildId: true,
            channelId: true,
            sourceMessageId: true,
            textRaw: true,
            authorRaw: true,
          },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
    return events.map((event) => {
      const message = event.integrationMessage;
      const messageId =
        message?.sourceMessageId?.replace(/^[0-9]+-/, "") ?? null;
      return {
        id: event.id,
        employeeId: event.employeeId,
        occurredAt: event.occurredAt,
        quantity: event.quantity,
        employee: event.employee,
        activityType: event.activityType,
        message: message
          ? {
              ...message,
              url:
                message.guildId && message.channelId && messageId
                  ? `https://discord.com/channels/${message.guildId}/${message.channelId}/${messageId}`
                  : null,
            }
          : null,
      };
    });
  }
  async employees(
    query: EmployeeQueryDto,
    user: { role: Role; employeeId: string | null },
  ) {
    const scope = await this.employeeWhere(user);
    if (!scope)
      return { items: [], total: 0, take: query.take, skip: query.skip };
    const where: Prisma.EmployeeWhereInput = {
      ...scope,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.rankId ? { rankId: query.rankId } : {}),
      ...(query.positionId ? { positionId: query.positionId } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.search
        ? {
            OR: [
              { gameName: { contains: query.search, mode: "insensitive" } },
              {
                discordDisplayName: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: { rank: true, position: true, department: true },
        orderBy: { gameName: "asc" },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, total, take: query.take, skip: query.skip };
  }
  private periodStart(period: "week" | "month") {
    const now = new Date();
    if (period === "month")
      return new Date(now.getFullYear(), now.getMonth(), 1);
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return now;
  }
  async leadershipAnalytics(
    query: AnalyticsPeriodDto,
    user: { role: Role; employeeId: string | null },
  ) {
    const start = this.periodStart(query.period);
    const scope = await this.employeeWhere(user);
    if (!scope)
      return {
        period: query.period,
        startsAt: start,
        activityTypes: [],
        employees: [],
        departments: [],
        dynamics: [],
      };
    const [employees, events, types] = await Promise.all([
      this.prisma.employee.findMany({
        where: { ...scope, active: true },
        include: { department: true, position: true, rank: true },
        orderBy: { gameName: "asc" },
      }),
      this.prisma.activityEvent.findMany({
        where: { occurredAt: { gte: start }, employee: scope },
        select: {
          employeeId: true,
          activityTypeId: true,
          quantity: true,
          occurredAt: true,
        },
      }),
      this.prisma.activityType.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);
    const typeNames = new Map(types.map((type) => [type.id, type.name]));
    const perEmployee = new Map<string, Map<string, number>>();
    for (const event of events) {
      const values =
        perEmployee.get(event.employeeId) ?? new Map<string, number>();
      values.set(
        event.activityTypeId,
        (values.get(event.activityTypeId) ?? 0) + event.quantity,
      );
      perEmployee.set(event.employeeId, values);
    }
    const report = employees
      .map((employee) => {
        const activity =
          perEmployee.get(employee.id) ?? new Map<string, number>();
        const total = [...activity.values()].reduce(
          (sum, quantity) => sum + quantity,
          0,
        );
        return {
          id: employee.id,
          gameName: employee.gameName,
          rank: employee.rank?.name ?? "Не назначено",
          position:
            employee.position?.name ?? employee.positionRaw ?? "Не определена",
          department: employee.department?.code ?? "Не определено",
          total,
          activity: types.map((type) => ({
            name: type.name,
            quantity: activity.get(type.id) ?? 0,
          })),
        };
      })
      .sort(
        (left, right) =>
          right.total - left.total ||
          left.gameName.localeCompare(right.gameName, "ru"),
      );
    const departmentTotals = new Map<
      string,
      { name: string; total: number; employees: number }
    >();
    for (const employee of report) {
      const current = departmentTotals.get(employee.department) ?? {
        name: employee.department,
        total: 0,
        employees: 0,
      };
      current.total += employee.total;
      current.employees++;
      departmentTotals.set(employee.department, current);
    }
    const days = Array.from(
      { length: query.period === "week" ? 7 : new Date().getDate() },
      (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return {
          date: day.toISOString().slice(0, 10),
          label: day.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
          }),
          quantity: 0,
        };
      },
    );
    const dayByDate = new Map(days.map((day) => [day.date, day]));
    for (const event of events) {
      const day = dayByDate.get(event.occurredAt.toISOString().slice(0, 10));
      if (day) day.quantity += event.quantity;
    }
    return {
      period: query.period,
      startsAt: start,
      activityTypes: types.map((type) => type.name),
      employees: report,
      departments: [...departmentTotals.values()].sort(
        (left, right) => right.total - left.total,
      ),
      dynamics: days,
    };
  }
  private async validateReferences(dto: {
    rankId?: string | null;
    positionId?: string | null;
    departmentId?: string | null;
  }) {
    const checks = await Promise.all([
      dto.rankId
        ? this.prisma.rank.findFirst({
            where: { id: dto.rankId, active: true },
          })
        : true,
      dto.positionId
        ? this.prisma.position.findFirst({
            where: { id: dto.positionId, active: true },
          })
        : true,
      dto.departmentId
        ? this.prisma.department.findFirst({
            where: { id: dto.departmentId, active: true },
          })
        : true,
    ]);
    if (checks.some((value) => !value))
      throw new BadRequestException(
        "Указан неизвестный или архивный справочник",
      );
  }
  async createEmployee(dto: CreateEmployeeDto, userId: string) {
    await this.validateReferences(dto);
    const employee = await this.prisma.employee.create({
      data: dto,
      include: { rank: true, position: true, department: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "EMPLOYEE_CREATED",
        entityType: "Employee",
        entityId: employee.id,
        newValue: dto as unknown as Prisma.InputJsonValue,
      },
    });
    return employee;
  }
  async updateEmployee(id: string, dto: UpdateEmployeeDto, userId: string) {
    await this.validateReferences(dto);
    const before = await this.prisma.employee.findUniqueOrThrow({
      where: { id },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: dto,
        include: { rank: true, position: true, department: true },
      });
      if (dto.rankId !== undefined && dto.rankId !== before.rankId) {
        await tx.employeeRankHistory.updateMany({
          where: { employeeId: id, removedAt: null },
          data: { removedAt: new Date() },
        });
        if (dto.rankId)
          await tx.employeeRankHistory.create({
            data: { employeeId: id, rankId: dto.rankId, assignedBy: userId },
          });
      }
      if (
        dto.positionId !== undefined ||
        dto.departmentId !== undefined ||
        dto.positionRaw !== undefined
      )
        await tx.employeePositionHistory.create({
          data: {
            employeeId: id,
            positionId: employee.positionId,
            positionRaw:
              employee.positionRaw ??
              employee.position?.name ??
              "Не определена",
            departmentId: employee.departmentId,
          },
        });
      await tx.auditLog.create({
        data: {
          userId,
          action:
            dto.active !== undefined && dto.active !== before.active
              ? dto.active
                ? "EMPLOYEE_RESTORED"
                : "EMPLOYEE_ARCHIVED"
              : "EMPLOYEE_UPDATED",
          entityType: "Employee",
          entityId: id,
          oldValue: {
            gameName: before.gameName,
            rankId: before.rankId,
            positionId: before.positionId,
            departmentId: before.departmentId,
            active: before.active,
          },
          newValue: dto as unknown as Prisma.InputJsonValue,
        },
      });
      return employee;
    });
    return updated;
  }
  async employee(id: string, user: { role: Role; employeeId: string | null }) {
    const scope = await this.employeeWhere(user);
    if (!scope) throw new NotFoundException("Сотрудник не найден");
    const employee = await this.prisma.employee.findFirst({
      where: { id, ...scope },
      include: {
        rank: true,
        position: true,
        department: true,
        events: {
          include: { activityType: true },
          orderBy: { occurredAt: "desc" },
          take: 100,
        },
        rankHistory: {
          include: { rank: true },
          orderBy: { assignedAt: "desc" },
        },
        positionHistory: {
          include: { position: true, department: true },
          orderBy: { detectedAt: "desc" },
        },
      },
    });
    if (!employee) throw new NotFoundException("Сотрудник не найден");
    return employee;
  }
  async createManualEvent(dto: CreateManualEventDto, userId: string) {
    const event = await this.prisma.activityEvent.create({
      data: {
        employeeId: dto.employeeId,
        activityTypeId: dto.activityTypeId,
        quantity: dto.quantity,
        occurredAt: new Date(dto.occurredAt),
        sourceType: "MANUAL",
        createdBy: userId,
        metadata: { reason: dto.reason },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "ACTIVITY_EVENT_CREATED",
        entityType: "ActivityEvent",
        entityId: event.id,
        newValue: { ...dto },
      },
    });
    return event;
  }
  dictionaries() {
    return Promise.all([
      this.prisma.rank.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.position.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.activityType.findMany({ orderBy: { sortOrder: "asc" } }),
    ]).then(([ranks, positions, departments, activityTypes]) => ({
      ranks,
      positions,
      departments,
      activityTypes,
    }));
  }
  private dictionaryModel(kind: "ranks" | "positions" | "departments") {
    return kind === "ranks"
      ? this.prisma.rank
      : kind === "positions"
        ? this.prisma.position
        : this.prisma.department;
  }
  async createDictionary(
    kind: "ranks" | "positions" | "departments",
    dto: DictionaryDto,
    userId: string,
  ) {
    const model = this.dictionaryModel(kind);
    if (kind === "departments" && !dto.code)
      throw new BadRequestException("Код подразделения обязателен");
    try {
      const item = await (model as any).create({
        data:
          kind === "departments"
            ? {
                name: dto.name,
                code: dto.code!,
                sortOrder: dto.sortOrder,
                active: dto.active,
              }
            : {
                name: dto.name,
                shortName: dto.shortName,
                sortOrder: dto.sortOrder,
                active: dto.active,
              },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: "DICTIONARY_CREATED",
          entityType: kind,
          entityId: item.id,
          newValue: dto as unknown as Prisma.InputJsonValue,
        },
      });
      return item;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new BadRequestException("Значение справочника уже существует");
      throw error;
    }
  }
  async updateDictionary(
    kind: "ranks" | "positions" | "departments",
    id: string,
    dto: DictionaryDto,
    userId: string,
  ) {
    const model = this.dictionaryModel(kind);
    if (kind === "departments" && !dto.code)
      throw new BadRequestException("Код подразделения обязателен");
    try {
      const before = await (model as any).findUnique({ where: { id } });
      if (!before)
        throw new NotFoundException("Значение справочника не найдено");
      const item = await (model as any).update({
        where: { id },
        data:
          kind === "departments"
            ? {
                name: dto.name,
                code: dto.code!,
                sortOrder: dto.sortOrder,
                active: dto.active,
              }
            : {
                name: dto.name,
                shortName: dto.shortName,
                sortOrder: dto.sortOrder,
                active: dto.active,
              },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          action:
            dto.active === false && before.active
              ? "DICTIONARY_ARCHIVED"
              : "DICTIONARY_UPDATED",
          entityType: kind,
          entityId: id,
          oldValue: before as unknown as Prisma.InputJsonValue,
          newValue: dto as unknown as Prisma.InputJsonValue,
        },
      });
      return item;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new BadRequestException("Значение справочника уже существует");
      throw error;
    }
  }
  async reviewQueue(query: ReviewQueryDto) {
    const statuses: MessageStatus[] = [
      "UNPARSED",
      "UNKNOWN_EMPLOYEE",
      "UNKNOWN_POSITION",
      "UNKNOWN_DEPARTMENT",
      "REVIEW_REQUIRED",
      "SEQUENCE_GAP",
      "SEQUENCE_CONFLICT",
      "UNKNOWN_TRAINING_TYPE",
      "UNKNOWN_TRAINING_RESULT",
      "MISSING_MENTIONS",
      "OUT_OF_WINDOW",
      "ERROR",
    ];
    const where = { status: query.status ?? { in: statuses } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.integrationMessage.findMany({
        where,
        include: { discordSource: { select: { id: true, name: true } } },
        orderBy: { messageTimestamp: "desc" },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.integrationMessage.count({ where }),
    ]);
    return { items, total, take: query.take, skip: query.skip };
  }
  async unresolved() {
    const [messages, employees] = await Promise.all([
      this.prisma.integrationMessage.findMany({
        where: { status: { in: ["UNKNOWN_EMPLOYEE", "UNKNOWN_DEPARTMENT"] } },
        include: { discordSource: { select: { name: true } } },
        orderBy: { messageTimestamp: "desc" },
      }),
      this.prisma.employee.findMany({
        where: {
          active: true,
          departmentId: null,
          discordDisplayName: { not: null },
        },
        select: {
          id: true,
          gameName: true,
          discordDisplayName: true,
          positionRaw: true,
        },
      }),
    ]);
    const users = new Map<
      string,
      {
        authorRaw: string;
        sourceNames: Set<string>;
        messages: number;
        lastMessageAt: Date;
      }
    >();
    const departments = new Map<
      string,
      {
        departmentRaw: string;
        sourceNames: Set<string>;
        messages: number;
        lastMessageAt: Date;
      }
    >();
    const messageByAuthor = new Map<
      string,
      { sourceName: string; timestamp: Date }
    >();
    for (const message of messages) {
      if (message.status === "UNKNOWN_EMPLOYEE") {
        const key = message.authorRaw.trim().replace(/\s+/g, " ").toLowerCase();
        const current = users.get(key) ?? {
          authorRaw: message.authorRaw,
          sourceNames: new Set<string>(),
          messages: 0,
          lastMessageAt: message.messageTimestamp,
        };
        current.sourceNames.add(message.discordSource.name);
        current.messages++;
        if (message.messageTimestamp > current.lastMessageAt)
          current.lastMessageAt = message.messageTimestamp;
        users.set(key, current);
      }
      const authorKey = message.authorRaw
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      const latest = messageByAuthor.get(authorKey);
      if (!latest || message.messageTimestamp > latest.timestamp)
        messageByAuthor.set(authorKey, {
          sourceName: message.discordSource.name,
          timestamp: message.messageTimestamp,
        });
      if (message.status === "UNKNOWN_DEPARTMENT") {
        const match =
          /^\s*.+?\s*"\s*([^"\s]+)\s*"\s*\|/.exec(message.authorRaw) ??
          /^\s*.+?\s+([А-ЯA-Z])\s*\|/.exec(message.authorRaw);
        const departmentRaw =
          match?.[1]?.toUpperCase() ?? "Не извлечен из строки";
        const current = departments.get(departmentRaw) ?? {
          departmentRaw,
          sourceNames: new Set<string>(),
          messages: 0,
          lastMessageAt: message.messageTimestamp,
        };
        current.sourceNames.add(message.discordSource.name);
        current.messages++;
        if (message.messageTimestamp > current.lastMessageAt)
          current.lastMessageAt = message.messageTimestamp;
        departments.set(departmentRaw, current);
      }
    }
    const employeeDetails = employees
      .map((employee) => {
        const nickname = parseDiscordNickname(employee.discordDisplayName!);
        const departmentRaw = nickname?.departmentRaw ?? "Не указан в строке";
        const message = messageByAuthor.get(
          employee
            .discordDisplayName!.trim()
            .replace(/\s+/g, " ")
            .toLowerCase(),
        );
        const current = departments.get(departmentRaw) ?? {
          departmentRaw,
          sourceNames: new Set<string>(),
          messages: 0,
          lastMessageAt: new Date(0),
        };
        if (message) {
          current.sourceNames.add(message.sourceName);
          if (message.timestamp > current.lastMessageAt)
            current.lastMessageAt = message.timestamp;
        }
        current.messages++;
        departments.set(departmentRaw, current);
        return {
          employeeId: employee.id,
          gameName: employee.gameName,
          discordDisplayName: employee.discordDisplayName,
          positionRaw: employee.positionRaw,
          departmentRaw,
          sourceName: message?.sourceName ?? null,
          lastMessageAt: message?.timestamp ?? null,
        };
      })
      .sort(
        (left, right) =>
          left.departmentRaw.localeCompare(right.departmentRaw, "ru") ||
          left.gameName.localeCompare(right.gameName, "ru"),
      );
    return {
      users: [...users.values()]
        .map((user) => ({ ...user, sourceNames: [...user.sourceNames] }))
        .sort(
          (left, right) =>
            right.lastMessageAt.getTime() - left.lastMessageAt.getTime(),
        ),
      departments: [...departments.values()]
        .map((department) => ({
          ...department,
          sourceNames: [...department.sourceNames],
          lastMessageAt: department.lastMessageAt.getTime()
            ? department.lastMessageAt
            : null,
        }))
        .sort(
          (left, right) =>
            right.messages - left.messages ||
            left.departmentRaw.localeCompare(right.departmentRaw, "ru"),
        ),
      employeeDetails,
    };
  }
  async resolveEmployee(
    messageId: string,
    dto: ResolveEmployeeDto,
    userId: string,
  ) {
    const [message, employee] = await Promise.all([
      this.prisma.integrationMessage.findUnique({ where: { id: messageId } }),
      this.prisma.employee.findUnique({ where: { id: dto.employeeId } }),
    ]);
    if (!message || !employee)
      throw new NotFoundException("Запись или сотрудник не найдены");
    const normalizedAlias = message.authorRaw
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    await this.prisma.$transaction([
      this.prisma.integrationMessage.update({
        where: { id: messageId },
        data: {
          employeeId: employee.id,
          status: "REVIEW_REQUIRED",
          errorCode: null,
          errorMessage: null,
        },
      }),
      this.prisma.employeeAlias.upsert({
        where: {
          source_normalizedAlias: { source: message.source, normalizedAlias },
        },
        update: { employeeId: employee.id, alias: message.authorRaw },
        create: {
          employeeId: employee.id,
          source: message.source,
          alias: message.authorRaw,
          normalizedAlias,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: "REVIEW_EMPLOYEE_LINKED",
          entityType: "IntegrationMessage",
          entityId: messageId,
          newValue: { employeeId: employee.id, alias: message.authorRaw },
        },
      }),
    ]);
    return { ok: true };
  }
  async ignoreReviewMessage(messageId: string, userId: string) {
    await this.prisma.integrationMessage.update({
      where: { id: messageId },
      data: { status: "DUPLICATE", errorCode: "IGNORED_BY_REVIEW" },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "REVIEW_MESSAGE_IGNORED",
        entityType: "IntegrationMessage",
        entityId: messageId,
      },
    });
    return { ok: true };
  }
  async assignRank(employeeId: string, dto: AssignRankDto, userId: string) {
    const [employee, rank] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: employeeId } }),
      this.prisma.rank.findUnique({ where: { id: dto.rankId } }),
    ]);
    if (!employee || !rank)
      throw new NotFoundException("Сотрудник или звание не найдены");
    if (employee.rankId === rank.id) return employee;
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (employee.rankId)
        await tx.employeeRankHistory.updateMany({
          where: { employeeId, removedAt: null },
          data: { removedAt: now },
        });
      const value = await tx.employee.update({
        where: { id: employeeId },
        data: { rankId: rank.id },
        include: { rank: true },
      });
      await tx.employeeRankHistory.create({
        data: {
          employeeId,
          rankId: rank.id,
          assignedBy: userId,
          assignedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "EMPLOYEE_RANK_ASSIGNED",
          entityType: "Employee",
          entityId: employeeId,
          oldValue: { rankId: employee.rankId },
          newValue: { rankId: rank.id },
        },
      });
      return value;
    });
    return updated;
  }
  rankHistory(employeeId: string) {
    return this.prisma.employeeRankHistory.findMany({
      where: { employeeId },
      include: { rank: true },
      orderBy: { assignedAt: "desc" },
    });
  }
  positionHistory(employeeId: string) {
    return this.prisma.employeePositionHistory.findMany({
      where: { employeeId },
      include: { position: true, department: true },
      orderBy: { detectedAt: "desc" },
    });
  }
  async requestScan(dto: CreateScanRequestDto, userId: string) {
    if (dto.sourceId)
      await this.prisma.discordSource.findUniqueOrThrow({
        where: { id: dto.sourceId },
      });
    const request = await this.prisma.scanRequest.create({
      data: {
        sourceId: dto.sourceId,
        requestedBy: userId,
        recentDays: dto.recentDays,
        limit: dto.limit,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "DISCORD_SCAN_REQUESTED",
        entityType: "ScanRequest",
        entityId: request.id,
        newValue: {
          sourceId: dto.sourceId ?? "ALL_ENABLED_SOURCES",
          recentDays: dto.recentDays,
          limit: dto.limit,
        },
      },
    });
    return request;
  }
  scanRequests() {
    return this.prisma.scanRequest.findMany({
      include: { source: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
}

@Controller("api")
@UseGuards(SessionGuard, RoleGuard)
export class PortalController {
  constructor(private readonly portal: PortalService) {}
  @Get("dashboard") @Roles(Role.LEADER, Role.ADMIN) dashboard(
    @CurrentUser() user: { role: Role; employeeId: string | null },
  ) {
    return this.portal.dashboard(user);
  }
  @Get("activity-details") @Roles(Role.LEADER, Role.ADMIN) activityDetails(
    @Query() query: AnalyticsPeriodDto,
    @CurrentUser() user: { role: Role; employeeId: string | null },
  ) {
    return this.portal.activityDetails(query.period, user);
  }
  @Get("employees") @Roles(Role.LEADER, Role.ADMIN) employees(
    @Query() query: EmployeeQueryDto,
    @CurrentUser() user: { role: Role; employeeId: string | null },
  ) {
    return this.portal.employees(query, user);
  }
  @Get("employees/:id") @Roles(Role.EMPLOYEE, Role.LEADER, Role.ADMIN) employee(
    @Param("id") id: string,
    @CurrentUser() user: { role: Role; employeeId: string | null },
  ) {
    return this.portal.employee(id, user);
  }
  @Post("employees") @Roles(Role.ADMIN) createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.portal.createEmployee(dto, user.id);
  }
  @Patch("employees/:id") @Roles(Role.ADMIN) updateEmployee(
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.portal.updateEmployee(id, dto, user.id);
  }
  @Get("dictionaries") @Roles(Role.LEADER, Role.ADMIN) dictionaries() {
    return this.portal.dictionaries();
  }
  @Get("materials") @Roles(Role.EMPLOYEE, Role.LEADER, Role.ADMIN) materials(@CurrentUser() user: { role: Role; employeeId: string | null }) { return this.portal.materials(user); }
  @Get("admin/materials") @Roles(Role.ADMIN) adminMaterials() { return this.portal.adminMaterials(); }
  @Post("admin/materials") @Roles(Role.ADMIN) createMaterial(@Body() dto: MaterialDto, @CurrentUser() user: { id: string }) { return this.portal.createMaterial(dto, user.id); }
  @Patch("admin/materials/:id") @Roles(Role.ADMIN) updateMaterial(@Param("id") id: string, @Body() dto: MaterialDto, @CurrentUser() user: { id: string }) { return this.portal.updateMaterial(id, dto, user.id); }
  @Patch("materials/:id") @Roles(Role.LEADER) updateLeaderMaterial(@Param("id") id: string, @Body() dto: MaterialDto, @CurrentUser() user: { id: string; role: Role; employeeId: string | null }) { return this.portal.updateLeaderMaterial(id, dto, user); }
  @Get("materials/attachments/:id") @Roles(Role.EMPLOYEE, Role.LEADER, Role.ADMIN) async attachment(@Param("id") id: string, @CurrentUser() user: { role: Role; employeeId: string | null }, @Res() response: Response) { const { attachment, bytes } = await this.portal.attachment(id, user); response.setHeader("Content-Type", attachment.mimeType); response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`); response.setHeader("X-Content-Type-Options", "nosniff"); response.send(bytes); }
  @Get("leadership/analytics")
  @Roles(Role.LEADER, Role.ADMIN)
  leadershipAnalytics(
    @Query() query: AnalyticsPeriodDto,
    @CurrentUser() user: { role: Role; employeeId: string | null },
  ) {
    return this.portal.leadershipAnalytics(query, user);
  }
  @Get("my-profile") myProfile(
    @CurrentUser() user: { role: Role; employeeId: string | null },
  ) {
    if (!user.employeeId)
      throw new NotFoundException(
        "Профиль сотрудника не связан с учетной записью",
      );
    return this.portal.employee(user.employeeId, user);
  }
}

@Controller("api/admin")
@UseGuards(SessionGuard, RoleGuard)
@Roles(Role.ADMIN)
export class AdminPortalController {
  constructor(private readonly portal: PortalService) {}
  @Post("manual-events") createManualEvent(
    @Body() dto: CreateManualEventDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.portal.createManualEvent(dto, user.id);
  }
  @Get("integrations/review") reviewQueue(@Query() query: ReviewQueryDto) {
    return this.portal.reviewQueue(query);
  }
  @Get("integrations/unresolved") unresolved() {
    return this.portal.unresolved();
  }
  @Post("integrations/review/:id/employee") resolveEmployee(
    @Param("id") id: string,
    @Body() dto: ResolveEmployeeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.portal.resolveEmployee(id, dto, user.id);
  }
  @Post("integrations/review/:id/ignore") ignoreReviewMessage(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.portal.ignoreReviewMessage(id, user.id);
  }
  @Post("employees/:id/rank") assignRank(
    @Param("id") id: string,
    @Body() dto: AssignRankDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.portal.assignRank(id, dto, user.id);
  }
  @Post("dictionaries/:kind") createDictionary(
    @Param("kind") kind: "ranks" | "positions" | "departments",
    @Body() dto: DictionaryDto,
    @CurrentUser() user: { id: string },
  ) {
    if (!["ranks", "positions", "departments"].includes(kind))
      throw new NotFoundException("Справочник не найден");
    return this.portal.createDictionary(kind, dto, user.id);
  }
  @Patch("dictionaries/:kind/:id") updateDictionary(
    @Param("kind") kind: "ranks" | "positions" | "departments",
    @Param("id") id: string,
    @Body() dto: DictionaryDto,
    @CurrentUser() user: { id: string },
  ) {
    if (!["ranks", "positions", "departments"].includes(kind))
      throw new NotFoundException("Справочник не найден");
    return this.portal.updateDictionary(kind, id, dto, user.id);
  }
  @Get("employees/:id/rank-history") rankHistory(@Param("id") id: string) {
    return this.portal.rankHistory(id);
  }
  @Get("employees/:id/position-history") positionHistory(
    @Param("id") id: string,
  ) {
    return this.portal.positionHistory(id);
  }
  @Post("integrations/scan-requests") requestScan(
    @Body() dto: CreateScanRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.portal.requestScan(dto, user.id);
  }
  @Get("integrations/scan-requests") scanRequests() {
    return this.portal.scanRequests();
  }
}
