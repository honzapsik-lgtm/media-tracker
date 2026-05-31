import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ProfileBody = {
  realName?: string;
  stateRegion?: string;
  country?: string;
  showcaseBadges?: string[];
};

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = (await request.json()) as ProfileBody;
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      realName: body.realName ?? "",
      stateRegion: body.stateRegion ?? "",
      country: body.country ?? "",
      showcaseBadges: body.showcaseBadges ?? [],
    },
  });

  return NextResponse.json(user);
}

