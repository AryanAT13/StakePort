import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Returns the currently signed-in user, or `null` if anonymous.
 * Used by the client to (a) gate onboarding and (b) hydrate the navbar.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    // Token survived but the row was deleted. Treat as logged-out; the client
    // can re-sign-in to mint a fresh user.
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      ageConfirmed: user.ageConfirmed,
      interests: user.interests ? (JSON.parse(user.interests) as string[]) : [],
      riskProfile: user.riskProfile,
      onboarded: !!user.onboardedAt,
    },
  });
}

export const dynamic = "force-dynamic";
