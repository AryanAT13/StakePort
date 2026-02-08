'use client';

import { useAccount, useReadContract } from 'wagmi';
import { REAL_WORLD_ASSET_ABI } from '../constants/contracts';
import { formatEther } from 'viem';
import { useEffect, useState, useCallback } from 'react';

// Sub-component
function SingleAssetValue({ 
    assetAddress, 
    userAddress, 
    onValueFound 
}: { 
    assetAddress: `0x${string}`, 
    userAddress: `0x${string}`,
    onValueFound: (asset: string, val: number) => void 
}) {
    const { data: balance } = useReadContract({
        address: assetAddress,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
    });

    const { data: price } = useReadContract({
        address: assetAddress,
        abi: REAL_WORLD_ASSET_ABI,
        functionName: 'getPrice',
    });

    useEffect(() => {
        if (balance && price) {
            const val = parseFloat(formatEther(balance as bigint)) * parseFloat(formatEther(price as bigint));
            // Pass the asset address AND the value back up
            onValueFound(assetAddress, val);
        }
    }, [balance, price, onValueFound, assetAddress]);

    return null;
}

export default function PortfolioValue({ assetList }: { assetList: `0x${string}`[] }) {
    const { address } = useAccount();
    const [values, setValues] = useState<Record<string, number>>({});

    // FIX 1: Use useCallback to keep this function stable across renders
    const handleValueUpdate = useCallback((asset: string, val: number) => {
        setValues(prev => {
            // FIX 2: If the value is already correct, DO NOT update state.
            // This stops the loop dead in its tracks.
            if (prev[asset] === val) return prev;
            
            return { ...prev, [asset]: val };
        });
    }, []);

    // Calculate total on the fly (derived state)
    const totalValue = Object.values(values).reduce((a, b) => a + b, 0);

    if (!address || !assetList) return <div>$0.00</div>;

    return (
        <div className="text-3xl font-bold text-white">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            
            {assetList.map(assetAddr => (
                <SingleAssetValue 
                    key={assetAddr} 
                    assetAddress={assetAddr} 
                    userAddress={address} 
                    onValueFound={handleValueUpdate} // Pass the stable function directly
                />
            ))}
        </div>
    );
}