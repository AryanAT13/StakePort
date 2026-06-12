import os
import re
import json
import requests
import numpy as np
from io import BytesIO
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from serpapi import GoogleSearch
from sklearn.ensemble import IsolationForest

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class AssetContext(BaseModel):
    name: str
    short_desc: str
    image_url: str

class PricingContext(BaseModel):
    name: str

def extract_prices_from_text(text):
    """Finds dollar amounts in raw text (e.g., '$1,200,000' -> 1200000.0)"""
    if not text:
        return []
    matches = re.findall(r'\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)', str(text))
    prices = []
    for match in matches:
        clean_num = float(match.replace(',', ''))
        if clean_num > 10: 
            prices.append(clean_num)
    return prices

@app.post("/api/generate-desc")
async def generate_description(asset: AssetContext):
    try:
        response = requests.get(asset.image_url)
        img = Image.open(BytesIO(response.content))

        model = genai.GenerativeModel('gemini-3.5-flash')
        
        prompt = f"""
        You are an elite asset appraiser for a fractional ownership platform. 
        Analyze the provided image and the user's short description: "{asset.short_desc}".
        Write a highly professional, 2-paragraph investment prospectus for this exact {asset.name}.
        Focus on its craftsmanship, market prestige, and why it holds value. 
        Do not use robotic language. Make it sound like a Christie's or Sotheby's auction catalog.
        """
        
        result = model.generate_content([prompt, img])
        return {"description": result.text.strip()}
        
    except Exception as e:
        print(f"Description Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate description.")

@app.post("/api/fair-value")
async def get_fair_value(asset: PricingContext):
    try:
        model = genai.GenerativeModel('gemini-3.5-flash')
        route_prompt = f"""
        Categorize the following asset: "{asset.name}".
        Reply with ONLY ONE of the following words:
        REAL_ESTATE (if it's a house, land, building, address)
        VEHICLE (if it's a car, truck, motorcycle, boat)
        LUXURY_GOODS (if it's a watch, handbag, jewelry, art, collectible)
        GENERAL (if unsure)
        """
        route_response = model.generate_content(route_prompt)
        category = route_response.text.strip().upper()
        
        print(f"[{asset.name}] routed to: {category}")

        raw_prices = []
        
        if category == "LUXURY_GOODS" or category == "GENERAL":
            params = {
                "engine": "google_shopping",
                "q": asset.name,
                "api_key": SERPAPI_KEY,
                "hl": "en", "gl": "us"
            }
            search = GoogleSearch(params)
            results = search.get_dict()
            for item in results.get("shopping_results", []):
                if "extracted_price" in item:
                    raw_prices.append(item["extracted_price"])
                else:
                    raw_prices.extend(extract_prices_from_text(item.get("price")))
                    
        elif category == "VEHICLE":
            params = {
                "engine": "google",
                "q": f"{asset.name} price site:cars.com OR site:cargurus.com OR site:autotrader.com",
                "api_key": SERPAPI_KEY,
                "hl": "en", "gl": "us"
            }
            search = GoogleSearch(params)
            results = search.get_dict()
            for item in results.get("organic_results", []):
                raw_prices.extend(extract_prices_from_text(item.get("snippet")))
                
        elif category == "REAL_ESTATE":
            params = {
                "engine": "google",
                "q": f"{asset.name} price site:zillow.com OR site:redfin.com OR site:realtor.com",
                "api_key": SERPAPI_KEY,
                "hl": "en", "gl": "us"
            }
            search = GoogleSearch(params)
            results = search.get_dict()
            for item in results.get("organic_results", []):
                raw_prices.extend(extract_prices_from_text(item.get("snippet")))

        if len(raw_prices) < 3:
            return {
                "predicted_price": float(np.mean(raw_prices)) if raw_prices else 0, 
                "category": category,
                "status": "Low Data Confidence"
            }

        X = np.array(raw_prices).reshape(-1, 1)
        
        clf = IsolationForest(contamination=0.2, random_state=42) 
        predictions = clf.fit_predict(X)
        
        valid_prices = [raw_prices[i] for i in range(len(raw_prices)) if predictions[i] == 1]
        
        predicted_fair_value = float(np.median(valid_prices)) 
        
        return {
            "predicted_price": predicted_fair_value,
            "category": category,
            "data_points_analyzed": len(raw_prices),
            "valid_comps_found": len(valid_prices),
            "status": "High Confidence"
        }

    except Exception as e:
        print(f"Pricing Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate fair value.")