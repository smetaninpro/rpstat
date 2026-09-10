import { NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PortalService } from "./portal";

describe("PortalService personnel access", () => {
  const employee = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const prisma = {
    employee,
    rank: { findFirst: jest.fn() },
    position: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    $transaction: jest.fn(),
    auditLog: { create: jest.fn() },
    material: { findMany: jest.fn() },
  } as never;
  const service = new PortalService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("limits a linked leader list to their department", async () => {
    employee.findUnique.mockResolvedValue({ departmentId: "department-a" });
    employee.findMany.mockResolvedValue([]);
    employee.count.mockResolvedValue(0);
    (prisma as any).$transaction.mockResolvedValue([[], 0]);
    await service.employees(
      { take: 25, skip: 0 },
      { role: Role.LEADER, employeeId: "leader" },
    );
    expect((prisma as any).$transaction).toHaveBeenCalled();
    expect(employee.findUnique).toHaveBeenCalledWith({
      where: { id: "leader" },
      select: { departmentId: true },
    });
  });

  it("returns no list records for an unlinked leader", async () => {
    await expect(
      service.employees(
        { take: 25, skip: 0 },
        { role: Role.LEADER, employeeId: null },
      ),
    ).resolves.toMatchObject({ items: [], total: 0 });
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  it("does not disclose an employee outside the caller scope", async () => {
    employee.findUnique.mockResolvedValue({ departmentId: "department-a" });
    employee.findFirst.mockResolvedValue(null);
    await expect(
      service.employee("other-department", {
        role: Role.LEADER,
        employeeId: "leader",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other-department", departmentId: "department-a" },
      }),
    );
  });

  it("shows public and own-department materials to a leader", async () => {
    employee.findUnique.mockResolvedValue({ departmentId: "department-a" });
    (prisma as any).material.findMany.mockResolvedValue([]);
    await service.materials({ role: Role.LEADER, employeeId: "leader" });
    expect((prisma as any).material.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ isPublic: true }, { departmentId: "department-a" }] }),
    }));
  });

  it("shows only public materials to an employee without a department", async () => {
    employee.findUnique.mockResolvedValue({ departmentId: null });
    (prisma as any).material.findMany.mockResolvedValue([]);
    await service.materials({ role: Role.EMPLOYEE, employeeId: "employee" });
    expect((prisma as any).material.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isPublic: true }),
    }));
  });

  it("limits an employee profile lookup to the linked employee", async () => {
    employee.findFirst.mockResolvedValue(null);
    await expect(
      service.employee("another-employee", {
        role: Role.EMPLOYEE,
        employeeId: "own-employee",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "own-employee" },
      }),
    );
  });
});
