import { NextResponse } from "next/server";
import { generateNonce } from "siwe";
import { prisma } from "@/lib/db";

/**
 * Issue a one-time SIWE nonce. The client folds it into the message it asks
 * the wallet to sign; we then check both the signature AND that the nonce
 * came from us. This blocks signature replay across sessions.
 */
export async function GET() {
  const nonce = generateNonce();
  await prisma.authNonce.create({ data: { nonce } });
  return NextResponse.json({ nonce });
}

// Don't cache — every call must mint a fresh nonce.
export const dynamic = "force-dynamic";
