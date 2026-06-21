'use client';

/**
 * Create-asset wizard — Phase 5.
 *
 * Four steps:
 *   01 Details     — name, ticker, valuation, description (editorial inputs).
 *   02 Imagery     — drag-drop multi-file upload to IPFS (Pinata).
 *   03 AI Preview  — live Gemini prospectus + ML fair-value oracle, both
 *                    surfaced BEFORE the seller mints. A fair-value deviation
 *                    >40% from the oracle raises a soft warning that the
 *                    seller can override (it's their valuation, after all).
 *   04 Launch      — review + on-chain mint, then route to the new asset.
 *
 * Why we don't write to /api/ai/prospectus here: that endpoint caches on
 * the deployed contract address — we don't have one yet. The preview-*
 * endpoints are stateless mirrors that just forward to the ai-engine. The
 * first asset-detail view after mint populates the long-lived DB cache.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog, parseEther } from 'viem';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, UploadCloud, X, Sparkles, Activity, Check, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import StepIndicator from '@/components/create/StepIndicator';
import { ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI } from '@/constants/contracts';
import { useSession } from '@/hooks/useSession';
import { formatCompactUsd } from '@/lib/format';

type FairValue = { value: number; category: string; status: string };

const INITIAL = {
  name: '',
  symbol: '',
  valuation: '',
  description: '',
  files: [] as File[],
  imageUrls: [] as string[],
  prospectus: '' as string,
  fairValue: null as FairValue | null,
};

export default function CreateAssetWizard() {
  const router = useRouter();
  const { user, loading: sessionLoading, resolved: sessionResolved } = useSession();
  const { isConnected } = useAccount();

  // ---- Auth gate (see /markets/page.tsx for routing rules) -------------
  useEffect(() => {
    if (sessionLoading || !sessionResolved) return;
    if (!user) {
      router.replace(isConnected ? '/onboarding' : '/');
      return;
    }
    if (!user.onboarded) router.replace('/onboarding');
  }, [sessionLoading, sessionResolved, user, isConnected, router]);

  // ---- Wizard state ----------------------------------------------------
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [generating, setGenerating] = useState({ prospectus: false, fairValue: false });
  const [error, setError] = useState<string | null>(null);

  // Re-entrancy guard for the launch button.
  //
  // The "two duplicate listings on a single click" bug: the launch button's
  // `disabled` only reads `isPending`, which doesn't flip until AFTER
  // handleMint reaches its `writeContract(...)` call. handleMint awaits a
  // metadata IPFS upload first (~1-2s), and during that window a second
  // click ran a second handleMint — two metadata pins, two writeContracts,
  // two deployed contracts pointing at the same IPFS URI. The first
  // asset-detail view of each then cached two DIFFERENT Gemini prospectuses
  // server-side (one per contract address), which is the AI Discrepancy
  // symptom.
  //
  // We guard with a ref instead of state because state updates are async —
  // a ref flips synchronously in the same tick. The ref + the new
  // `mintingNow` state together drive a fully-disabled button from the
  // first millisecond of the click.
  const mintingRef = useRef(false);
  const [mintingNow, setMintingNow] = useState(false);

  // ---- Step 1 validation -----------------------------------------------
  const step1Valid = useMemo(
    () => form.name.trim().length >= 2 && form.symbol.trim().length >= 1 && parseFloat(form.valuation) > 0 && form.description.trim().length >= 20,
    [form]
  );
  const step2Valid = form.imageUrls.length > 0;
  const step3Valid = form.prospectus.length > 0;

  // ---- IPFS upload (Step 2 → Step 3 boundary) --------------------------
  // We upload when the user clicks Continue from Step 2 — that way they can
  // freely add/remove files before paying the IPFS pin cost.
  async function uploadImagesToIpfs(): Promise<string[]> {
    const urls: string[] = [];
    setUploadProgress({ done: 0, total: form.files.length });
    for (let i = 0; i < form.files.length; i++) {
      const fd = new FormData();
      fd.append('file', form.files[i]!);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Image upload failed');
      const { ipfsHash } = (await res.json()) as { ipfsHash: string };
      urls.push(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      setUploadProgress({ done: i + 1, total: form.files.length });
    }
    setUploadProgress(null);
    return urls;
  }

  // ---- AI calls (run as the user enters Step 3) ------------------------
  async function generatePreviews(imageUrl: string) {
    setError(null);
    setGenerating({ prospectus: true, fairValue: true });
    // Run both in parallel — both endpoints are independent and slow.
    const prospectusPromise = fetch('/api/ai/preview-prospectus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description, imageUrl }),
    }).then(async (r) => {
      if (!r.ok) throw new Error('Prospectus generation failed');
      return (await r.json()) as { prospectus: string };
    });

    const fairValuePromise = fetch('/api/ai/preview-fair-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name }),
    }).then(async (r) => {
      if (!r.ok) throw new Error('Fair-value generation failed');
      return (await r.json()) as { fairValue: number; category: string; status: string };
    });

    const [proRes, fvRes] = await Promise.allSettled([prospectusPromise, fairValuePromise]);

    setForm((f) => ({
      ...f,
      prospectus: proRes.status === 'fulfilled' ? proRes.value.prospectus : f.prospectus,
      fairValue: fvRes.status === 'fulfilled'
        ? { value: fvRes.value.fairValue, category: fvRes.value.category, status: fvRes.value.status }
        : f.fairValue,
    }));
    setGenerating({ prospectus: false, fairValue: false });

    if (proRes.status === 'rejected' && fvRes.status === 'rejected') {
      setError('AI engine unreachable. Make sure the Python service is running.');
    }
  }

  // ---- Mint (Step 4) ---------------------------------------------------
  const { writeContract, data: txHash, isPending: writePending, reset: resetWrite, error: writeError } = useWriteContract();
  const { data: receipt, isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Release the re-entrancy guard if the wallet rejects the signature so
  // the user can press "Launch" again. (Receipt-success path doesn't need
  // a release — the next effect routes away from the page.)
  useEffect(() => {
    if (writeError) {
      mintingRef.current = false;
      setMintingNow(false);
    }
  }, [writeError]);

  // When the receipt lands, decode the AssetCreated event to find the new
  // contract address, then route to its detail page. This is what makes
  // the wizard feel "finished" — the seller lands on their live market.
  useEffect(() => {
    if (!receipt || !txSuccess) return;
    try {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ASSET_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'AssetCreated') {
            const newAddress = (decoded.args as { assetAddress: `0x${string}` }).assetAddress;
            router.push(`/asset/${newAddress}`);
            return;
          }
        } catch {/* not our event, keep scanning */}
      }
      // Fallback — receipt landed but we couldn't find the event. Bounce to
      // the markets grid so the user at least sees their listing.
      router.push('/markets');
    } catch (e) {
      console.error('[create] decode error', e);
      router.push('/markets');
    }
  }, [receipt, txSuccess, router]);

  async function handleMint() {
    // Re-entrancy guard — see the comment on mintingRef above.
    if (mintingRef.current) return;
    mintingRef.current = true;
    setMintingNow(true);
    setError(null);
    try {
      // 1. Upload the metadata JSON (the on-chain `assetUrl` points to this).
      const metadata = {
        name: form.name,
        description: form.description,
        images: form.imageUrls,
      };
      const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const fd = new FormData();
      fd.append('file', new File([blob], 'metadata.json'));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Metadata pin failed');
      const { ipfsHash } = (await res.json()) as { ipfsHash: string };
      const metadataUri = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

      // 2. Mint on-chain.
      writeContract({
        address: ASSET_FACTORY_ADDRESS,
        abi: ASSET_FACTORY_ABI,
        functionName: 'createAsset',
        args: [form.name, form.symbol.toUpperCase(), metadataUri, parseEther(form.valuation)],
      });
      // NOTE: we don't release the guard here. The button stays disabled
      // until the receipt arrives + we route away. If the wallet rejects
      // the signature, useWriteContract surfaces an error via writeError,
      // and the catch block below releases the guard so the user can retry.
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mint failed';
      setError(msg);
      resetWrite();
      mintingRef.current = false;
      setMintingNow(false);
    }
  }


  // ---- Navigation -------------------------------------------------------
  async function handleNext() {
    setError(null);
    try {
      if (step === 1) {
        if (!step1Valid) return setError('Fill in every field. Description needs at least 20 characters.');
        setStep(2);
      } else if (step === 2) {
        if (form.files.length === 0) return setError('Add at least one image.');
        if (form.imageUrls.length === 0) {
          // Upload now, then advance.
          const urls = await uploadImagesToIpfs();
          setForm((f) => ({ ...f, imageUrls: urls }));
          setStep(3);
          // Kick off AI generation immediately on entry to step 3.
          generatePreviews(urls[0]!);
        } else {
          setStep(3);
          if (!form.prospectus) generatePreviews(form.imageUrls[0]!);
        }
      } else if (step === 3) {
        if (!step3Valid) return setError('Generate the prospectus before continuing.');
        setStep(4);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }
  function handleBack() {
    if (step > 1) setStep((s) => Math.max(1, s - 1));
  }

  // ---- Render gate ------------------------------------------------------
  if (sessionLoading || !sessionResolved || !user || !user.onboarded) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xs text-zinc-500 uppercase tracking-[0.22em]">Authenticating…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 pt-12 md:pt-16 pb-24">
        <p className="eyebrow mb-4">List · New Asset</p>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.025em] leading-[1.05] mb-2">
          {step === 1 && 'Tell us about it.'}
          {step === 2 && 'Show us the asset.'}
          {step === 3 && 'Meet the appraisers.'}
          {step === 4 && 'Ready to launch.'}
        </h1>
        <p className="text-zinc-400 text-base md:text-lg mb-12 md:mb-14 max-w-xl">
          {step === 1 && 'The basics. You can edit any of this later — names and tickers are how buyers find the market.'}
          {step === 2 && 'Drop your imagery. The first photo becomes the listing thumbnail and the input to the AI appraiser.'}
          {step === 3 && 'Gemini writes the prospectus. The ML oracle scrapes real-world comps. Both run before you sign anything.'}
          {step === 4 && 'One signature deploys the contract and mints 1,000 shares to your wallet.'}
        </p>

        <StepIndicator current={step} />

        {step === 1 && <Step1 form={form} setForm={setForm} />}
        {step === 2 && <Step2 form={form} setForm={setForm} progress={uploadProgress} />}
        {step === 3 && <Step3 form={form} generating={generating} onRegenerate={() => generatePreviews(form.imageUrls[0]!)} />}
        {step === 4 && (
          <Step4
            form={form}
            onMint={handleMint}
            isPending={writePending || mintingNow}
            isConfirming={txConfirming}
          />
        )}

        {error && (
          <div className="mt-8 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Wizard footer */}
        {step !== 4 && (
          <div className="flex items-center justify-between mt-14 pt-6 border-t border-zinc-900">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={
                (step === 1 && !step1Valid) ||
                (step === 2 && (form.files.length === 0 || !!uploadProgress)) ||
                (step === 3 && !step3Valid)
              }
              className="group inline-flex items-center gap-2 rounded-full bg-white text-black px-6 py-2.5 text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_6px_24px_-10px_rgba(255,255,255,0.25)] hover:shadow-[0_14px_40px_-10px_rgba(255,255,255,0.45)]"
            >
              {uploadProgress
                ? `Pinning ${uploadProgress.done}/${uploadProgress.total}…`
                : step === 3
                ? 'Continue to launch'
                : 'Continue'}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
            </button>
          </div>
        )}

        {/* Tiny escape hatch back to markets */}
        <div className="mt-10 text-center">
          <Link href="/markets" className="text-xs text-zinc-600 hover:text-zinc-400 transition">
            Cancel and return to markets
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* STEP 1 — Details                                                       */
/* ────────────────────────────────────────────────────────────────────── */

function Step1({
  form,
  setForm,
}: {
  form: typeof INITIAL;
  setForm: React.Dispatch<React.SetStateAction<typeof INITIAL>>;
}) {
  return (
    <div className="space-y-12">
      <Field label="Asset Name">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Patek Philippe Nautilus 5711"
          maxLength={80}
          className="w-full bg-transparent border-b border-zinc-800 focus:border-white outline-none py-3 text-xl placeholder:text-zinc-700 transition"
        />
      </Field>

      <Field label="Ticker Symbol" hint="Uppercase. 3–6 characters. What the market is identified by.">
        <input
          type="text"
          value={form.symbol}
          onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase().slice(0, 6) }))}
          placeholder="e.g. PPN5711"
          maxLength={6}
          className="w-full bg-transparent border-b border-zinc-800 focus:border-white outline-none py-3 text-xl font-mono uppercase tracking-wider placeholder:text-zinc-700 transition"
        />
      </Field>

      <Field label="Initial Valuation" hint="What you believe the asset is worth, in USDC. The market is seeded at this price.">
        <div className="relative">
          <span className="absolute left-0 top-3 text-zinc-500 text-xl pointer-events-none">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={form.valuation}
            onChange={(e) => setForm((f) => ({ ...f, valuation: e.target.value }))}
            placeholder="50000"
            className="w-full bg-transparent border-b border-zinc-800 focus:border-white outline-none py-3 pl-6 pr-16 text-xl font-mono placeholder:text-zinc-700 transition"
          />
          <span className="absolute right-0 top-3.5 text-zinc-500 text-xs font-mono uppercase tracking-wider">USDC</span>
        </div>
      </Field>

      <Field label="Description" hint="Used by the AI to write your prospectus. Be specific about provenance, condition, materials.">
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value.slice(0, 500) }))}
          placeholder="A pristine 2022 Patek Philippe Nautilus 5711/1A-014 in olive green. Box and papers. Single owner since new…"
          rows={4}
          className="w-full bg-transparent border-b border-zinc-800 focus:border-white outline-none py-3 text-base placeholder:text-zinc-700 transition resize-none"
        />
        <div className="flex justify-end mt-2">
          <span className="text-[11px] text-zinc-600 font-mono tabular-nums">{form.description.length}/500</span>
        </div>
      </Field>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* STEP 2 — Imagery                                                       */
/* ────────────────────────────────────────────────────────────────────── */

function Step2({
  form,
  setForm,
  progress,
}: {
  form: typeof INITIAL;
  setForm: React.Dispatch<React.SetStateAction<typeof INITIAL>>;
  progress: { done: number; total: number } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith('image/'));
    setForm((f) => ({ ...f, files: [...f.files, ...incoming].slice(0, 8), imageUrls: [] }));
  }

  function removeAt(i: number) {
    setForm((f) => ({ ...f, files: f.files.filter((_, idx) => idx !== i), imageUrls: [] }));
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`relative rounded-2xl border-2 border-dashed transition-colors ${
          dragging ? 'border-white bg-white/[0.02]' : 'border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => addFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="py-14 px-6 text-center pointer-events-none">
          <UploadCloud className="w-7 h-7 mx-auto mb-4 text-zinc-500" strokeWidth={1.5} />
          <p className="text-sm text-zinc-200 mb-1">Drag and drop, or click to browse</p>
          <p className="text-xs text-zinc-500">Up to 8 images · JPEG / PNG / WebP</p>
        </div>
      </div>

      {form.files.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow mb-3">Selected · {form.files.length}</p>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {form.files.map((file, i) => {
              const objectUrl = URL.createObjectURL(file);
              return (
                <div key={`${file.name}-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-900 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={objectUrl} alt="" className="w-full h-full object-cover" />
                  {i === 0 && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider text-black bg-white px-1.5 py-0.5 rounded">
                      Thumbnail
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black backdrop-blur text-zinc-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {progress && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
            <span>Pinning to IPFS</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* STEP 3 — AI Preview                                                    */
/* ────────────────────────────────────────────────────────────────────── */

function Step3({
  form,
  generating,
  onRegenerate,
}: {
  form: typeof INITIAL;
  generating: { prospectus: boolean; fairValue: boolean };
  onRegenerate: () => void;
}) {
  const valuationNum = parseFloat(form.valuation) || 0;
  const fair = form.fairValue?.value ?? null;
  const pctVsFair = fair && fair > 0 ? ((valuationNum - fair) / fair) * 100 : null;
  const warning = pctVsFair !== null && Math.abs(pctVsFair) > 40;

  return (
    <div className="space-y-10">
      {/* PROSPECTUS */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> AI Prospectus
            </p>
            <p className="text-xs text-zinc-600 mt-1 font-mono">Gemini · multimodal</p>
          </div>
          {form.prospectus && (
            <button onClick={onRegenerate} className="text-xs text-zinc-400 hover:text-white transition">
              Regenerate
            </button>
          )}
        </div>

        <div className="bg-zinc-950/70 border border-zinc-900 rounded-xl p-6 min-h-[200px]">
          {generating.prospectus ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-zinc-900 rounded w-full" />
              <div className="h-3 bg-zinc-900 rounded w-5/6" />
              <div className="h-3 bg-zinc-900 rounded w-4/6" />
              <div className="h-3 bg-zinc-900 rounded w-full mt-4" />
              <div className="h-3 bg-zinc-900 rounded w-3/4" />
            </div>
          ) : form.prospectus ? (
            <p className="text-zinc-300 text-sm md:text-base leading-relaxed whitespace-pre-line">
              {form.prospectus}
            </p>
          ) : (
            <p className="text-zinc-600 text-sm">Generating prospectus…</p>
          )}
        </div>
      </section>

      {/* FAIR VALUE */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <Activity className="w-3 h-3" /> ML Fair Value Oracle
            </p>
            <p className="text-xs text-zinc-600 mt-1 font-mono">Isolation Forest · live comps</p>
          </div>
        </div>

        <div
          className={`rounded-xl p-6 border ${
            warning ? 'border-yellow-500/30 bg-yellow-500/[0.04]' : 'border-zinc-900 bg-zinc-950/70'
          }`}
        >
          {generating.fairValue ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-8 bg-zinc-900 rounded w-1/3" />
              <div className="h-3 bg-zinc-900 rounded w-1/2" />
            </div>
          ) : form.fairValue ? (
            <div>
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2">Your valuation</p>
                  <p className="text-2xl md:text-3xl font-mono font-semibold tracking-tight">
                    {formatCompactUsd(valuationNum)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2">Oracle estimate</p>
                  <p className="text-2xl md:text-3xl font-mono font-semibold tracking-tight">
                    {formatCompactUsd(form.fairValue.value)}
                  </p>
                </div>
              </div>
              {pctVsFair !== null && (
                <div className="flex items-start gap-3 pt-4 border-t border-zinc-900">
                  {warning ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                  )}
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    Your valuation is{' '}
                    <span className={`font-semibold ${warning ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {pctVsFair > 0 ? '+' : ''}{pctVsFair.toFixed(1)}%
                    </span>{' '}
                    from the oracle.
                    {warning && (
                      <span className="block text-xs text-yellow-400/80 mt-1">
                        Deviations above 40% may dissuade buyers — or invite an immediate hostile buyout if you&apos;ve underpriced.
                      </span>
                    )}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-zinc-600 mt-4 font-mono">
                Category: {form.fairValue.category} · {form.fairValue.status}
              </p>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Awaiting oracle…</p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* STEP 4 — Launch                                                        */
/* ────────────────────────────────────────────────────────────────────── */

function Step4({
  form,
  onMint,
  isPending,
  isConfirming,
}: {
  form: typeof INITIAL;
  onMint: () => void;
  isPending: boolean;
  isConfirming: boolean;
}) {
  return (
    <div>
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 mb-8">
        <p className="eyebrow mb-5">Review</p>

        <div className="flex gap-5">
          {form.imageUrls[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.imageUrls[0]} alt="" className="w-24 h-24 rounded-lg object-cover border border-zinc-900 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold tracking-tight truncate">{form.name}</h3>
            <p className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wider">{form.symbol}</p>
            <p className="text-2xl font-mono font-semibold mt-3 tabular-nums">
              {formatCompactUsd(parseFloat(form.valuation) || 0)}
            </p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-900 grid grid-cols-3 gap-4 text-center">
          <Stat label="Images" value={String(form.imageUrls.length)} />
          <Stat label="Initial Shares" value="1,000" />
          <Stat label="Network" value="On-chain" />
        </div>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed mb-6">
        Signing will deploy a fresh ERC-20 contract for this asset, mint 1,000 shares to your
        wallet, and emit the listing event. The next page is your live market.
      </p>

      <button
        onClick={onMint}
        disabled={isPending || isConfirming}
        className="w-full inline-flex items-center justify-center gap-2 bg-white text-black rounded-full py-4 font-medium transition hover:bg-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_6px_24px_-10px_rgba(255,255,255,0.25)] hover:shadow-[0_14px_40px_-10px_rgba(255,255,255,0.45)]"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
        <span>
          {isPending ? 'Confirm in wallet…' : isConfirming ? 'Minting on-chain…' : 'Sign and launch asset'}
        </span>
      </button>

      <p className="text-[11px] text-zinc-600 font-mono text-center mt-4">
        Gas estimated ~0.001 ETH · Contract deployment
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Shared field + tiny stat                                               */
/* ────────────────────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block eyebrow mb-3">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-600 mt-2">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1.5">{label}</p>
      <p className="text-sm font-mono font-semibold">{value}</p>
    </div>
  );
}
