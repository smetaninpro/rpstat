import { Body, Controller, Get, Headers, Injectable, Param, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { ArrayMaxSize, IsArray, IsISO8601, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from './prisma.service';
import { validateDiscordUrl } from './sources';
import { Request } from 'express';
import { parseDiscordNickname } from './discord-nickname';
import { parseTrainingMessage } from './training-parser';

class AuthorDto { @IsOptional() @IsString() discordUserId?: string; @IsString() @Length(1, 256) displayName!: string; }
class AttachmentDto { @IsOptional() @IsString() @Length(1, 512) filename?: string; @IsOptional() @IsString() @Length(1, 128) contentType?: string; @IsOptional() @IsString() @Length(1, 2048) url?: string; }
class RawMessageDto { @IsString() source!: string; @IsOptional() @IsString() guildId?: string; @IsOptional() @IsString() channelId?: string; @IsOptional() @IsString() messageId?: string; @ValidateNested() @Type(() => AuthorDto) author!: AuthorDto; @IsArray() @ValidateNested({ each: true }) @Type(() => AuthorDto) mentions!: AuthorDto[]; @IsString() @Length(0, 10000) text!: string; @IsISO8601() timestamp!: string; @IsISO8601() collectedAt!: string; @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[]; }
class SubmitMessagesDto { @IsString() sourceId!: string; @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RawMessageDto) messages!: RawMessageDto[]; }
class HeartbeatDto { @IsString() @Length(1, 100) name!: string; @IsString() @Length(1, 100) version!: string; @IsString() @Length(1, 40) status!: string; @IsOptional() @IsString() @Length(1, 1000) lastError?: string; }
function fingerprint(message: RawMessageDto) { return createHash('sha256').update([message.source, message.channelId ?? '', message.author.discordUserId ?? message.author.displayName, message.timestamp, message.text].join('\n')).digest('hex'); }
function parseSequence(text: string, max: number) { const match = /^\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/.exec(text); if (!match) return { status: 'UNPARSED' as const }; const from = Number(match[1]); const to = Number(match[2] ?? match[1]); if (to < from) return { status: 'UNPARSED' as const }; const quantity = to - from + 1; if (quantity > max) return { status: 'REVIEW_REQUIRED' as const, from, to, quantity }; return { status: 'PARSED' as const, from, to, quantity }; }
@Injectable()
export class CollectorService {
  constructor(private readonly prisma: PrismaService) {}
  async config() { const sources = await this.prisma.discordSource.findMany({ where: { enabled: true }, select: { id: true, name: true, channelUrl: true, enabled: true, lookbackDays: true, parserMode: true } }); sources.forEach((source) => validateDiscordUrl(source.channelUrl)); return { globalLookbackDays: 3, allowedGuildId: process.env.ALLOWED_DISCORD_GUILD_ID ?? '', sources }; }
  async registerRequest(requestId: string) { try { await this.prisma.collectorRequest.create({ data: { requestId } }); } catch { throw new UnauthorizedException(); } }
  heartbeat(dto: HeartbeatDto) { return this.prisma.collectorInstance.upsert({ where: { name: dto.name }, update: { version: dto.version, status: dto.status, lastError: dto.lastError, lastHeartbeatAt: new Date() }, create: { name: dto.name, version: dto.version, status: dto.status, lastError: dto.lastError, lastHeartbeatAt: new Date() } }); }
  async claimScanRequest() { const request = await this.prisma.scanRequest.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } }); if (!request) return null; const claimed = await this.prisma.scanRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'RUNNING', startedAt: new Date() } }); return claimed.count ? request : null; }
  completeScanRequest(id: string, result: unknown) { return this.prisma.scanRequest.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date(), result: result as Prisma.InputJsonValue } }); }
  failScanRequest(id: string, errorMessage: string) { return this.prisma.scanRequest.update({ where: { id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage } }); }
  async submit(dto: SubmitMessagesDto) {
    const source = await this.prisma.discordSource.findUniqueOrThrow({ where: { id: dto.sourceId }, include: { rules: { where: { enabled: true }, orderBy: { priority: 'desc' } } } });
    const cutoff = new Date(Date.now() - (source.lookbackDays ?? 3) * 86400000); const max = Number(process.env.MAX_SEQUENCE_RANGE ?? 30); let accepted = 0;
    for (const message of dto.messages) {
      if (message.source !== 'discord-web' || message.guildId !== source.guildId || message.channelId !== source.channelId) continue;
      const timestamp = new Date(message.timestamp); const id = message.messageId ?? null; const fp = fingerprint(message);
      try {
        const stored = await this.prisma.integrationMessage.create({ data: { sourceId: source.id, source: message.source, sourceMessageId: id, guildId: message.guildId, channelId: message.channelId, authorDiscordId: message.author.discordUserId, authorRaw: message.author.displayName, textRaw: message.text, attachments: (message.attachments ?? []) as unknown as Prisma.InputJsonValue, messageTimestamp: timestamp, collectedAt: new Date(message.collectedAt), fingerprint: fp, status: timestamp < cutoff ? 'OUT_OF_WINDOW' : source.parserMode === 'SEQUENCE_RANGE' ? 'UNPARSED' : 'REVIEW_REQUIRED' } });
        if (timestamp < cutoff) continue;
        if (source.parserMode === 'TRAINING_MESSAGE') { await this.processTrainingMessage(stored.id, source.id, message, timestamp); accepted++; continue; }
        if (source.parserMode !== 'SEQUENCE_RANGE') continue;
        const parsed = parseSequence(message.text, max);
        if (parsed.status !== 'PARSED') { await this.prisma.integrationMessage.update({ where: { id: stored.id }, data: { status: parsed.status, parsedFrom: parsed.from, parsedTo: parsed.to, parsedQuantity: parsed.quantity } }); continue; }
        const nickname = parseDiscordNickname(message.author.displayName);
        let employee = await this.prisma.employee.findFirst({ where: message.author.discordUserId ? { discordUserId: message.author.discordUserId } : { aliases: { some: { source: 'discord-web', normalizedAlias: message.author.displayName.trim().toLowerCase() } } } });
        if (!employee && nickname) employee = await this.createEmployeeFromNickname(message.author, nickname);
        if (employee && nickname) await this.updateEmployeeFromNickname(employee.id, nickname, stored.id);
        const quantity = source.countMode === 'ATTACHMENTS' ? message.attachments?.length ?? 0 : source.countMode === 'LINES' ? message.text.split(/\r?\n/).filter((line) => line.trim()).length : 0;
        if (!quantity) { await this.prisma.integrationMessage.update({ where: { id: stored.id }, data: { status: 'REVIEW_REQUIRED', parsedFrom: parsed.from, parsedTo: parsed.to, parsedQuantity: 0, errorCode: 'MISSING_ATTACHMENTS' } }); continue; }
        if (!employee || !source.rules[0]?.activityTypeId) { await this.prisma.integrationMessage.update({ where: { id: stored.id }, data: { status: 'UNKNOWN_EMPLOYEE', parsedFrom: parsed.from, parsedTo: parsed.to, parsedQuantity: quantity } }); continue; }
        const lastItem = await this.prisma.sourceSequenceItem.findFirst({ where: { sourceId: source.id }, orderBy: { sequenceNumber: 'desc' }, select: { sequenceNumber: true } });
        const hasGap = Boolean(lastItem && parsed.from > lastItem.sequenceNumber + 1);
        try { await this.prisma.$transaction(async (tx) => { for (let number = parsed.from; number <= parsed.to; number++) await tx.sourceSequenceItem.create({ data: { sourceId: source.id, sequenceNumber: number, integrationMessageId: stored.id, employeeId: employee.id } }); const event = await tx.activityEvent.create({ data: { employeeId: employee.id, activityTypeId: source.rules[0].activityTypeId!, quantity, occurredAt: timestamp, sourceType: 'DISCORD', sourceId: source.id, integrationMessageId: stored.id } }); await tx.integrationMessage.update({ where: { id: stored.id }, data: { status: hasGap ? 'SEQUENCE_GAP' : 'PARSED', parsedFrom: parsed.from, parsedTo: parsed.to, parsedQuantity: quantity } }); await tx.sourceSequenceItem.updateMany({ where: { integrationMessageId: stored.id }, data: { activityEventId: event.id } }); }); accepted++; } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') await this.prisma.integrationMessage.update({ where: { id: stored.id }, data: { status: 'SEQUENCE_CONFLICT' } }); else await this.prisma.integrationMessage.update({ where: { id: stored.id }, data: { status: 'ERROR', errorCode: 'ACTIVITY_EVENT_FAILED', errorMessage: 'Не удалось сохранить статистическое событие' } }); }
      } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error; /* Duplicate source message or fingerprint: idempotent delivery. */ }
    }
    return { accepted };
  }
  private async updateEmployeeFromNickname(employeeId: string, nickname: { positionRaw: string; departmentRaw?: string; gameName: string }, messageId: string) {
    const normalizedPosition = nickname.positionRaw.toLowerCase();
    const [positionAlias, department, employee] = await Promise.all([
      this.prisma.positionAlias.findUnique({ where: { normalizedAlias: normalizedPosition }, include: { position: true } }),
      nickname.departmentRaw ? this.prisma.department.findUnique({ where: { code: nickname.departmentRaw } }) : null,
      this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    ]);
    // The game name is stable identity data; only organization fields are refreshed from Discord.
    const update: { positionRaw: string; positionId?: string; departmentId?: string } = { positionRaw: nickname.positionRaw };
    if (positionAlias && !employee.manualPositionOverride) update.positionId = positionAlias.positionId;
    if (department) update.departmentId = department.id;
    const detectedPositionId = positionAlias?.positionId ?? null; const detectedDepartmentId = department?.id ?? null;
    if (employee.positionRaw !== nickname.positionRaw || employee.positionId !== detectedPositionId || employee.departmentId !== detectedDepartmentId) await this.prisma.employeePositionHistory.create({ data: { employeeId, positionId: detectedPositionId, positionRaw: nickname.positionRaw, departmentId: detectedDepartmentId, sourceMessageId: messageId } });
    await this.prisma.employee.update({ where: { id: employeeId }, data: update });
    if (!positionAlias || !department) await this.prisma.integrationMessage.update({ where: { id: messageId }, data: { status: !positionAlias ? 'UNKNOWN_POSITION' : 'UNKNOWN_DEPARTMENT' } });
  }
  private async createEmployeeFromNickname(author: AuthorDto, nickname: { positionRaw: string; departmentRaw?: string; gameName: string }) {
    const normalizedAlias = author.displayName.trim().replace(/\s+/g, ' ').toLowerCase();
    const [positionAlias, department] = await Promise.all([
      this.prisma.positionAlias.findUnique({ where: { normalizedAlias: nickname.positionRaw.toLowerCase() } }),
      nickname.departmentRaw ? this.prisma.department.findUnique({ where: { code: nickname.departmentRaw } }) : null,
    ]);
    const employee = await this.prisma.employee.create({ data: { gameName: nickname.gameName, discordUserId: author.discordUserId, discordDisplayName: author.displayName, positionRaw: nickname.positionRaw, positionId: positionAlias?.positionId, departmentId: department?.id } });
    await this.prisma.employeeAlias.create({ data: { employeeId: employee.id, source: 'discord-web', alias: author.displayName, normalizedAlias } });
    return employee;
  }
  private async processTrainingMessage(messageId: string, sourceId: string, message: RawMessageDto, occurredAt: Date) {
    if (message.mentions.length < 2) { await this.prisma.integrationMessage.update({ where: { id: messageId }, data: { status: 'MISSING_MENTIONS' } }); return; }
    const [instructor, student] = await Promise.all([this.findEmployee(message.mentions[0]), this.findEmployee(message.mentions[1])]);
    if (!instructor || !student) { await this.prisma.integrationMessage.update({ where: { id: messageId }, data: { status: 'UNKNOWN_EMPLOYEE' } }); return; }
    const parsed = parseTrainingMessage(message.text);
    if (!parsed.items.length) { await this.prisma.integrationMessage.update({ where: { id: messageId }, data: { status: 'UNKNOWN_TRAINING_TYPE' } }); return; }
    if (parsed.result === 'UNKNOWN' && parsed.items.some((item) => item.type === 'EXAM')) { await this.prisma.integrationMessage.update({ where: { id: messageId }, data: { status: 'UNKNOWN_TRAINING_RESULT' } }); return; }
    const examActivity = await this.prisma.activityType.findUnique({ where: { code: 'EXAM_ACCEPTED' } });
    await this.prisma.$transaction(async (tx) => { const session = await tx.trainingSession.create({ data: { sourceId, integrationMessageId: messageId, instructorEmployeeId: instructor.id, studentEmployeeId: student.id, occurredAt, overallStatus: parsed.result, items: { create: parsed.items.map((item, sortOrder) => ({ ...item, sortOrder })) } } }); await tx.trainingResult.createMany({ data: parsed.items.map((item) => ({ employeeId: student.id, trainingSessionId: session.id, type: item.type, status: item.status, occurredAt })) }); if (examActivity) { const exams = parsed.items.filter((item) => item.type === 'EXAM').length; if (exams) await tx.activityEvent.create({ data: { employeeId: instructor.id, activityTypeId: examActivity.id, quantity: exams, occurredAt, sourceType: 'DISCORD', sourceId, integrationMessageId: messageId } }); } await tx.integrationMessage.update({ where: { id: messageId }, data: { status: 'PARSED' } }); });
  }
  private findEmployee(mention: AuthorDto) { const normalizedAlias = mention.displayName.replace(/^@/, '').trim().replace(/\s+/g, ' ').toLowerCase(); return this.prisma.employee.findFirst({ where: mention.discordUserId ? { OR: [{ discordUserId: mention.discordUserId }, { aliases: { some: { source: 'discord-web', normalizedAlias } } }] } : { aliases: { some: { source: 'discord-web', normalizedAlias } } } }); }
}
@Controller('api/internal')
export class CollectorController {
  constructor(private readonly collector: CollectorService) {}
  private async verify(timestamp: string, requestId: string, signature: string, raw: Buffer | undefined) { const secret = process.env.COLLECTOR_SHARED_SECRET; if (!secret || Buffer.byteLength(secret) < 32 || !raw || !/^[0-9a-f-]{36}$/i.test(requestId) || Math.abs(Date.now() - Number(timestamp)) > 300000) throw new UnauthorizedException(); const expected = createHmac('sha256', secret).update(`${timestamp}.${requestId}.`).update(raw).digest('hex'); if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new UnauthorizedException(); await this.collector.registerRequest(requestId); }
  @Get('collector/config') async config(@Headers('x-collector-timestamp') timestamp: string, @Headers('x-collector-request-id') requestId: string, @Headers('x-collector-signature') signature: string) { await this.verify(timestamp, requestId, signature, Buffer.from('')); return this.collector.config(); }
  @Post('integrations/discord/messages') async messages(@Headers('x-collector-timestamp') timestamp: string, @Headers('x-collector-request-id') requestId: string, @Headers('x-collector-signature') signature: string, @Body() dto: SubmitMessagesDto, @Req() request: RawBodyRequest<Request>) { await this.verify(timestamp, requestId, signature, request.rawBody); return this.collector.submit(dto); }
  @Post('collector/heartbeat') async heartbeat(@Headers('x-collector-timestamp') timestamp: string, @Headers('x-collector-request-id') requestId: string, @Headers('x-collector-signature') signature: string, @Body() dto: HeartbeatDto, @Req() request: RawBodyRequest<Request>) { await this.verify(timestamp, requestId, signature, request.rawBody); return this.collector.heartbeat(dto); }
  @Post('collector/scan-requests/claim') async claimScanRequest(@Headers('x-collector-timestamp') timestamp: string, @Headers('x-collector-request-id') requestId: string, @Headers('x-collector-signature') signature: string, @Req() request: RawBodyRequest<Request>) { await this.verify(timestamp, requestId, signature, request.rawBody); return this.collector.claimScanRequest(); }
  @Post('collector/scan-requests/:id/complete') async completeScanRequest(@Param('id') id: string, @Headers('x-collector-timestamp') timestamp: string, @Headers('x-collector-request-id') requestId: string, @Headers('x-collector-signature') signature: string, @Body() dto: { result: unknown }, @Req() request: RawBodyRequest<Request>) { await this.verify(timestamp, requestId, signature, request.rawBody); return this.collector.completeScanRequest(id, dto.result); }
  @Post('collector/scan-requests/:id/fail') async failScanRequest(@Param('id') id: string, @Headers('x-collector-timestamp') timestamp: string, @Headers('x-collector-request-id') requestId: string, @Headers('x-collector-signature') signature: string, @Body() dto: { errorMessage: string }, @Req() request: RawBodyRequest<Request>) { await this.verify(timestamp, requestId, signature, request.rawBody); return this.collector.failScanRequest(id, dto.errorMessage); }
}
export { parseSequence };
