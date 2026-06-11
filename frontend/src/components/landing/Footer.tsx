import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative border-t border-zinc-900 bg-black">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2">
            <div className="text-xl font-bold tracking-tighter mb-3">
              Stake<span className="text-blue-500">Port</span>
            </div>
            <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
              The premier liquidity layer for physical luxury and real-world assets.
              Built with the math of Uniswap and the appraisal of Sotheby&apos;s.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Product</p>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><Link href="/markets" className="hover:text-white">Markets</Link></li>
              <li><Link href="/create" className="hover:text-white">List an Asset</Link></li>
              <li><Link href="/portfolio" className="hover:text-white">Portfolio</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Resources</p>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li><a href="#how" className="hover:text-white">How it works</a></li>
              <li><a href="#pillars" className="hover:text-white">Tech</a></li>
              <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-zinc-900 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} StakePort. Testnet only — not financial advice.</span>
          <span className="font-mono">v0.2 · phase 2</span>
        </div>
      </div>
    </footer>
  );
}
