import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch Top 10 Events by Liquidity (Volume)
    const response = await fetch('https://gamma-api.polymarket.com/events?limit=10&active=true&closed=false&order=volume24hr&ascending=false', {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!response.ok) throw new Error(`PolyMarket API error: ${response.status}`);

    const data = await response.json();

    // Process the data to find the "Top Answer" for each event
    const simplifiedData = data.map((event: any) => {
      // 1. Get all markets for this event (e.g. all candidates)
      const markets = event.markets || [];

      // 2. Sort them by current price (probability) to find the winner
      // Prices are usually string JSON arrays like "["0.02", "0.98"]" (No/Yes)
      const topMarket = markets.sort((a: any, b: any) => {
        const priceA = a.outcomePrices ? JSON.parse(a.outcomePrices)[0] : 0;
        const priceB = b.outcomePrices ? JSON.parse(b.outcomePrices)[0] : 0;
        return priceB - priceA; // Descending order
      })[0];

      // 3. Determine the answer name (e.g., "Kevin Warsh" or "Yes")
      let answerName = "Yes";
      if (topMarket?.groupItemTitle) {
        answerName = topMarket.groupItemTitle;
      }

      // 4. Get the probability
      const probability = topMarket?.outcomePrices ? JSON.parse(topMarket.outcomePrices)[0] : 0;

      return {
        title: event.title,
        topAnswer: answerName,
        probability: probability
      };
    });

    return NextResponse.json(simplifiedData);

  } catch (error) {
    console.error('PolyMarket Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}