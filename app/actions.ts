"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSession,
  destroySession,
  isAuthenticated,
  requireAuth,
  verifyPasswordMatch,
} from "@/lib/auth";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(s + "T00:00:00Z").getTime()), {
    message: "Invalid calendar date",
  });

const createTripSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

const saveAvailabilitySchema = z.object({
  tripId: z.string().uuid(),
  participantName: z.string().trim().min(1).max(80),
  date: dateStringSchema,
  slots: z.array(z.number().int().min(0).max(23)).max(24),
});

const addCommentSchema = z.object({
  tripId: z.string().uuid(),
  author: z.string().trim().min(1).max(80),
  content: z.string().trim().min(1).max(5000),
  parentId: z.string().uuid().nullable().optional(),
});

export async function verifyPassword(_prevState: unknown, formData: FormData) {
  const password = (formData.get("password") as string) ?? "";
  if (!verifyPasswordMatch(password)) {
    return false;
  }
  await createSession();
  return true;
}

export async function logout(): Promise<void> {
  await destroySession();
  revalidatePath("/");
}

export async function checkAuth(): Promise<boolean> {
  return isAuthenticated();
}

export async function getTrips() {
  await requireAuth();
  return prisma.trip.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          participants: true,
          comments: true,
        },
      },
    },
  });
}

export async function createTrip(formData: FormData) {
  await requireAuth();
  const parsed = createTripSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });

  const trip = await prisma.trip.create({
    data: {
      name: parsed.name,
      description: parsed.description ?? null,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    },
  });

  revalidatePath("/");
  return trip;
}

export async function getTrip(id: string) {
  await requireAuth();
  const parsedId = z.string().uuid().parse(id);
  return prisma.trip.findUnique({
    where: { id: parsedId },
    include: {
      participants: {
        include: {
          availabilities: true,
        },
      },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
}

export async function saveAvailability(
  tripId: string,
  participantName: string,
  date: string,
  slots: number[]
) {
  await requireAuth();
  const input = saveAvailabilitySchema.parse({
    tripId,
    participantName,
    date,
    slots,
  });

  const participant = await prisma.participant.upsert({
    where: {
      tripId_name: { tripId: input.tripId, name: input.participantName },
    },
    create: { tripId: input.tripId, name: input.participantName },
    update: {},
  });

  await prisma.availability.upsert({
    where: {
      participantId_date: {
        participantId: participant.id,
        date: input.date,
      },
    },
    create: {
      participantId: participant.id,
      tripId: input.tripId,
      date: input.date,
      slots: input.slots,
    },
    update: { slots: input.slots },
  });

  revalidatePath(`/trip/${input.tripId}`);
}

export async function addComment(
  tripId: string,
  author: string,
  content: string,
  parentId?: string | null
) {
  await requireAuth();
  const input = addCommentSchema.parse({
    tripId,
    author,
    content,
    parentId: parentId ?? null,
  });

  const comment = await prisma.comment.create({
    data: {
      tripId: input.tripId,
      author: input.author,
      content: input.content,
      parentId: input.parentId ?? null,
    },
  });

  revalidatePath(`/trip/${input.tripId}`);
  return comment;
}

export async function deleteTrip(id: string) {
  await requireAuth();
  const parsedId = z.string().uuid().parse(id);
  await prisma.trip.delete({ where: { id: parsedId } });
  revalidatePath("/");
}
