import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ accelerateUrl: process.env.PRISMA_DATABASE_URL as string });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;