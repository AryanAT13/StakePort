'use client';

// Public landing.
//
// Narrative arc (matches the brief):
//   Hero      — Vision + Problem (the manifesto)
//   Reason    — Why we exist ("Real wealth deserves real markets")
//   Mechanism — How it works (three editorial rails)
//   Guarantee — The contract (125% buyout floor)
//   CTA       — Action ("Open the terminal.")
//   Footer    — Brushed-titanium wordmark close
//
// Manifesto.tsx was deleted: its content is now the hero. The "Real wealth
// deserves real markets" line was promoted from the final CTA to a mid-page
// section because, per the brief, it was the strongest sentence on the
// previous draft and deserved earlier placement in the narrative.

import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import Reason from '@/components/landing/Reason';
import Mechanism from '@/components/landing/Mechanism';
import Guarantee from '@/components/landing/Guarantee';
import CTASection from '@/components/landing/CTASection';
import WordmarkFooter from '@/components/landing/WordmarkFooter';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-black text-white antialiased selection:bg-blue-500/30">
      <LandingNav />
      <Hero />
      <Reason />
      <Mechanism />
      <Guarantee />
      <CTASection />
      <WordmarkFooter />
    </main>
  );
}
