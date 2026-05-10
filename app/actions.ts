"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function verifyPassword(_prevState: unknown, formData: FormData) {
  const password = formData.get("password") as string;
  const appPassword = process.env.APP_PASSWORD || "friends123";
  return password === appPassword;
}

export async function getTrips() {
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
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  if (!name || !startDate || !endDate) {
    throw new Error("Missing required fields");
  }

  const trip = await prisma.trip.create({
    data: {
      name,
      description,
      startDate,
      endDate,
    },
  });

  revalidatePath("/");
  return trip;
}

export async function getTrip(id: string) {
  const trip = await prisma.trip.findUnique({
    where: { id },
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

  return trip;
}

export async function saveAvailability(
  tripId: string,
  participantName: string,
  date: string,
  slots: number[]
) {
  let participant = await prisma.participant.findUnique({
    where: {
      tripId_name: {
        tripId,
        name: participantName,
      },
    },
  });

  if (!participant) {
    participant = await prisma.participant.create({
      data: {
        name: participantName,
        tripId,
      },
    });
  }

  await prisma.availability.upsert({
    where: {
      participantId_date: {
        participantId: participant.id,
        date,
      },
    },
    create: {
      participantId: participant.id,
      tripId,
      date,
      slots,
    },
    update: {
      slots,
    },
  });

  revalidatePath(`/trip/${tripId}`);
}

export async function addComment(
  tripId: string,
  author: string,
  content: string,
  parentId?: string | null
) {
  const comment = await prisma.comment.create({
    data: {
      tripId,
      author,
      content,
      parentId: parentId || null,
    },
  });

  revalidatePath(`/trip/${tripId}`);
  return comment;
}

export async function deleteTrip(id: string) {
  await prisma.trip.delete({ where: { id } });
  revalidatePath("/");
}
