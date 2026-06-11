import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/auth";

/**
 * Verify a SIWE signature, upsert the user, and hand out a session cookie.
 *
 * The client side does:
 *   1. fetch /api/auth/nonce -> nonce
 *   2. build a SiweMessage(nonce, domain, address, ...)
 *   3. ask wallet to sign the message string
 *   4. POST { message, signature } here
 */
export async function POST(req: NextRequest) {
  try {
    const { message, signature } = (await req.json()) as {
      message?: string;
      signature?: string;
    };
    if (!message || !signature) {
      return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
    }

    const siwe = new SiweMessage(message);

    // Defense in depth: ensure the nonce was issued by us *and* hasn't been
    // burned already. We delete it before signature verification so a botched
    // verify still consumes the nonce (no retry-amplified guessing).
    const nonceRow = await prisma.authNonce.findUnique({ where: { nonce: siwe.nonce } });
    if (!nonceRow) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
    }
    await prisma.authNonce.delete({ where: { nonce: siwe.nonce } });

    // siwe also re-checks the nonce internally if you pass it. Belt and braces.
    const result = await siwe.verify({ signature, nonce: siwe.nonce });
    if (!result.success) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }

    const walletAddress = siwe.address.toLowerCase();

    // First time we've seen this wallet => create a stub user. The dashboard
    // will detect `onboardedAt == null` and route to the profile form.
    const user = await prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress },
      update: {},
    });

    const token = await signSession({ sub: user.id, addr: walletAddress });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        onboarded: !!user.onboardedAt,
      },
    });
  } catch (e) {
    // SiweMessage constructor throws on malformed input; that's a client bug,
    // not a server failure, so surface as 400.
    console.error("[auth/verify]", e);
    return NextResponse.json({ error: "Invalid SIWE message" }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
