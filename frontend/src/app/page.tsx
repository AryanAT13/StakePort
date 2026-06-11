'use client';

// Public landing page. Composed of independent client components so each can
// own its own data fetching / scroll behaviour without prop-drilling.
//
// We deliberately do NOT auto-redirect signed-in users away from this page.
// The landing is the brand — it's fine for someone with a session to land
// here from a marketing link; the persistent "Launch App" CTA in the nav
// gets them to /markets in one click.

import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import MarketPulse from '@/components/MarketPulse';
import StatsRow from '@/components/landing/StatsRow';
import PillarsSection from '@/components/landing/PillarsSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-black text-white antialiased">
      <LandingNav />
      <Hero />

      {/* Reuse the existing Polymarket ticker — it doubles as social proof
          ("look, we're plugged into real prediction markets") and pulls the
          eye downward into the substantive content. */}
      <MarketPulse />

      <StatsRow />
      <PillarsSection />
      <HowItWorksSection />
      <CTASection />
      <Footer />
    </main>
  );
}
