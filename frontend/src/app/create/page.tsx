'use client';

import Navbar from '../../components/Navbar';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ASSET_FACTORY_ADDRESS, ASSET_FACTORY_ABI } from '../../constants/contracts';
import { parseEther } from 'viem'; // Use parseEther for simplified Valuation input
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateAsset() {
  const router = useRouter();
  
  // Form State
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [valuation, setValuation] = useState('');
  
  // ADD THESE 3 LINES:
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Write Hook
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  // Wait for Transaction Hook
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !symbol || !valuation || !description || !files || files.length === 0) {
        alert("Please fill in all fields and upload at least one image.");
        return;
    }

    try {
        setIsUploading(true);

        // 1. Upload Images to IPFS
        const imageUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const formData = new FormData();
            formData.append("file", files[i]);
            
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            // Format as an IPFS gateway link
            imageUrls.push(`https://gateway.pinata.cloud/ipfs/${data.ipfsHash}`);
        }

        // 2. Create the Metadata JSON object
        const metadata = {
            name: name,
            description: description,
            images: imageUrls,
        };

        // 3. Upload Metadata JSON to IPFS
        const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const jsonFile = new File([jsonBlob], "metadata.json");
        const jsonFormData = new FormData();
        jsonFormData.append("file", jsonFile);

        const metaRes = await fetch("/api/upload", { method: "POST", body: jsonFormData });
        const metaData = await metaRes.json();
        
        const finalIpfsUri = `https://gateway.pinata.cloud/ipfs/${metaData.ipfsHash}`;
        console.log("Metadata uploaded to:", finalIpfsUri);

        // 4. Trigger Smart Contract
        writeContract({
            address: ASSET_FACTORY_ADDRESS,
            abi: ASSET_FACTORY_ABI,
            functionName: 'createAsset',
            args: [
              name, 
              symbol, 
              finalIpfsUri, 
              parseEther(valuation) 
            ], 
        });

    } catch (err) {
        console.error("Upload failed", err);
        alert("Failed to upload to IPFS.");
    } finally {
        setIsUploading(false);
    }
  };

  // Redirect on Success
  useEffect(() => {
    if (isSuccess) {
        alert("Asset Created Successfully!");
        // We will redirect to dashboard or market later
        router.push('/'); 
    }
  }, [isSuccess, router]);

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="max-w-2xl mx-auto p-8 mt-10">
        <h1 className="text-4xl font-bold mb-8 text-center">List New Asset</h1>
        
        <form onSubmit={handleCreate} className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6">
            
            {/* Name Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Asset Name</label>
                <input 
                    type="text" 
                    placeholder="e.g. Rolex Daytona 2024"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            {/* Symbol Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Ticker Symbol</label>
                <input 
                    type="text" 
                    placeholder="e.g. RLX-DAYT"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 uppercase"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                />
            </div>

            {/* Valuation Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Initial Valuation (USDC)</label>
                <input 
                    type="number" 
                    placeholder="e.g. 50000"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                    value={valuation}
                    onChange={(e) => setValuation(e.target.value)}
                />
            </div>

            {/* Description Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Short Description</label>
                <textarea 
                    placeholder="Describe the asset's history, condition, and why it's valuable..."
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 h-24 resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            {/* Multiple File Upload Input */}
            <div>
                <label className="block text-gray-400 mb-2 text-sm">Upload Asset Images</label>
                <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer"
                    onChange={(e) => setFiles(e.target.files)}
                />
                <p className="text-xs text-zinc-500 mt-2">Upload multiple images. Files are stored permanently on IPFS.</p>
            </div>

            {/* Submit Button */}
            <button 
                type="submit"
                disabled={isPending || isConfirming || isUploading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition disabled:opacity-50"
            >
                {isUploading ? "Uploading to IPFS..." : isPending ? "Check Wallet..." : isConfirming ? "Minting Asset..." : "🚀 Launch Asset"}
            </button>

            {/* Error Message */}
            {error && (
                <div className="text-red-500 text-sm text-center mt-2">
                    {error.message.split('\n')[0]}
                </div>
            )}
        </form>
      </div>
    </main>
  );
}