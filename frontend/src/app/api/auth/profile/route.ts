import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Update the signed-in user's profile. Used by the onboarding form
 * (first-time submit) and by the settings page (subsequent edits).
 *
 * We intentionally do not allow editing `walletAddress` — it's the auth key.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    displayName?: string;
    avatarUrl?: string;
    interests?: string[];
    riskProfile?: string;
    ageConfirmed?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Light validation — we don't trust the client even though the cookie is
  // signed. Display name length cap, risk profile whitelist, etc.
  const displayName = body.displayName?.slice(0, 40).trim() || null;
  const avatarUrl = body.avatarUrl?.slice(0, 500) || null;
  const interests = Array.isArray(body.interests)
    ? JSON.stringify(body.interests.slice(0, 10).map((s) => String(s).slice(0, 30)))
    : undefined;
  const riskProfile =
    body.riskProfile && ["conservative", "moderate", "aggressive"].includes(body.riskProfile)
      ? body.riskProfile
      : undefined;

  const user = await prisma.user.update({
    where: { id: session.sub },
    data: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(interests !== undefined ? { interests } : {}),
      ...(riskProfile !== undefined ? { riskProfile } : {}),
      ...(typeof body.ageConfirmed === "boolean" ? { ageConfirmed: body.ageConfirmed } : {}),
      // Treat the first profile PATCH as "completed onboarding". The
      // dashboard uses this to stop redirecting back to /onboarding.
      onboardedAt: new Date(),
    },
  });

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
