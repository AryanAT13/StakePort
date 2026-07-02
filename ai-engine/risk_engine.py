"""
Quant Risk Engine
=================

Classifies a real-world asset into a risk tier (conservative / moderate /
aggressive) from quantitative market features, and emits a 0-100 risk score.

Why a gradient-boosted tree and not a Hugging Face model:
    Risk classification here is a *tabular* problem — volatility, drawdown,
    liquidity, etc. HF hosts NLP/vision transformers; none of them classify
    financial risk from numeric features. Gradient-boosted decision trees
    (the XGBoost / LightGBM family) are the canonical tool for this. We use
    scikit-learn's GradientBoostingClassifier — same family, already a project
    dependency, no extra install.

Cold-start training:
    A fresh RWA exchange has no labelled history, so we bootstrap the model on
    synthetically-generated examples whose labels follow a transparent domain
    rule, then let the GBM learn a smooth, generalising decision boundary over
    them (it is NOT just replaying the rule — it interpolates between regimes
    and is robust to noise). When real labelled trades accumulate, retrain on
    those by swapping `_synthesize_training_set()` for a real loader; nothing
    else changes.

Feature vector (7 dims), all normalised to ~[0, 1]:
    0  volatility              std-dev of log returns over price history
    1  max_drawdown            worst peak-to-trough decline
    2  appreciation_consistency fraction of up-moves (higher = steadier climb)
    3  liquidity_score         pool depth relative to valuation (higher = deeper)
    4  fair_value_gap          |market cap - oracle fair value| / fair value
    5  category_risk           per-asset-class baseline (real estate low … etc.)
    6  activity                trade-count saturation (higher = more liquid book)
"""

from __future__ import annotations

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

CATEGORY_RISK = {
    "REAL_ESTATE": 0.20,
    "VEHICLE": 0.45,
    "LUXURY_GOODS": 0.55,
    "GENERAL": 0.70,
}

TIERS = ["conservative", "moderate", "aggressive"]
TIER_CENTROIDS = np.array([18.0, 50.0, 82.0])


def _domain_risk(f: np.ndarray) -> float:
    """Transparent weighted risk in [0, 1] used to LABEL synthetic samples.
    The deployed model learns from these labels but generalises beyond them."""
    volatility, drawdown, appreciation, liquidity, fv_gap, cat, activity = f
    risk = (
        0.26 * min(volatility / 0.5, 1.0)      # vol dominates
        + 0.18 * drawdown
        + 0.14 * (1.0 - appreciation)          # erratic climb = riskier
        + 0.16 * (1.0 - liquidity)             # illiquid = riskier
        + 0.10 * min(fv_gap, 1.0)              # mispriced vs oracle = riskier
        + 0.16 * cat                           # asset-class baseline
        - 0.08 * activity                      # active book = a touch safer
    )
    return float(np.clip(risk, 0.0, 1.0))


def _synthesize_training_set(n: int = 2500, seed: int = 42):
    """Generate n labelled feature vectors spanning the plausible feature space."""
    rng = np.random.default_rng(seed)
    X = np.column_stack([
        np.clip(rng.gamma(2.0, 0.12, n), 0, 1.2),   # volatility (right-skewed)
        rng.beta(2.0, 4.0, n),                       # drawdown
        rng.beta(3.0, 2.5, n),                       # appreciation_consistency
        rng.beta(2.5, 2.5, n),                       # liquidity_score
        np.clip(rng.gamma(1.5, 0.2, n), 0, 1.5),     # fair_value_gap
        rng.choice(list(CATEGORY_RISK.values()), n), # category_risk
        rng.beta(2.0, 2.0, n),                       # activity
    ])
    # Label from the domain rule, with a little Gaussian jitter so the
    # boundaries aren't razor-sharp (forces the GBM to actually generalise).
    y = np.empty(n, dtype=int)
    for i in range(n):
        r = _domain_risk(X[i]) + rng.normal(0, 0.05)
        y[i] = 0 if r < 0.38 else (1 if r < 0.63 else 2)
    return X, y


class RiskModel:
    """Lazily-trained singleton wrapper around the gradient-boosted classifier."""

    _instance: "RiskModel | None" = None

    def __init__(self):
        X, y = _synthesize_training_set()
        self.clf = GradientBoostingClassifier(
            n_estimators=160,
            max_depth=3,
            learning_rate=0.08,
            subsample=0.9,
            random_state=42,
        )
        self.clf.fit(X, y)

    @classmethod
    def get(cls) -> "RiskModel":
        if cls._instance is None:
            cls._instance = RiskModel()
        return cls._instance

    def predict(self, features: np.ndarray):
        proba = self.clf.predict_proba(features.reshape(1, -1))[0]
        # Smooth 0-100 score = probability-weighted centroid blend.
        score = float(np.dot(proba, TIER_CENTROIDS))
        tier_idx = int(np.argmax(proba))
        return score, TIERS[tier_idx], proba


def extract_features(
    price_history: list[float],
    category: str,
    valuation: float,
    fair_value: float | None,
    liquidity_usdc: float | None,
) -> np.ndarray:
    """Turn raw on-chain + oracle inputs into the 7-dim normalised feature vector.

    `price_history` is the chronological list of AMM prices (one per trade).
    Robust to thin/empty history — a brand-new market gets sensible defaults
    that lean slightly conservative until it has a track record.
    """
    prices = np.array([p for p in price_history if p and p > 0], dtype=float)

    # --- volatility: std of log returns -----------------------------------
    if prices.size >= 2:
        log_ret = np.diff(np.log(prices))
        volatility = float(np.std(log_ret))
    else:
        volatility = 0.08  # unknown → mild default

    # --- max drawdown ------------------------------------------------------
    if prices.size >= 2:
        running_max = np.maximum.accumulate(prices)
        drawdowns = (running_max - prices) / running_max
        max_drawdown = float(np.max(drawdowns))
    else:
        max_drawdown = 0.05

    # --- appreciation consistency: share of non-negative moves ------------
    if prices.size >= 2:
        diffs = np.diff(prices)
        appreciation = float(np.mean(diffs >= 0))
    else:
        appreciation = 0.5

    # --- liquidity: pool USDC relative to valuation -----------------------
    if liquidity_usdc and valuation and valuation > 0:
        # A pool holding ~half the valuation (our launch default) ≈ healthy.
        liquidity_score = float(np.clip((liquidity_usdc / valuation) / 0.5, 0, 1))
    else:
        liquidity_score = 0.4

    # --- fair-value gap ----------------------------------------------------
    if fair_value and fair_value > 0 and prices.size >= 1:
        market_cap = prices[-1] * 1000.0  # 1000 = fixed total supply
        fv_gap = float(abs(market_cap - fair_value) / fair_value)
    else:
        fv_gap = 0.15

    # --- category baseline -------------------------------------------------
    cat = CATEGORY_RISK.get((category or "GENERAL").upper(), CATEGORY_RISK["GENERAL"])

    # --- activity: saturating function of trade count ---------------------
    activity = float(np.clip(prices.size / 25.0, 0, 1))

    return np.array([
        volatility, max_drawdown, appreciation,
        liquidity_score, fv_gap, cat, activity,
    ], dtype=float)


def score_asset(
    price_history: list[float],
    category: str,
    valuation: float,
    fair_value: float | None = None,
    liquidity_usdc: float | None = None,
) -> dict:
    """Public entry point. Returns score, tier, per-class confidence, features."""
    features = extract_features(price_history, category, valuation, fair_value, liquidity_usdc)
    score, tier, proba = RiskModel.get().predict(features)
    return {
        "risk_score": round(score, 1),
        "risk_tier": tier,
        "confidence": round(float(np.max(proba)), 3),
        "probabilities": {TIERS[i]: round(float(proba[i]), 3) for i in range(3)},
        "features": {
            "volatility": round(float(features[0]), 4),
            "max_drawdown": round(float(features[1]), 4),
            "appreciation_consistency": round(float(features[2]), 4),
            "liquidity_score": round(float(features[3]), 4),
            "fair_value_gap": round(float(features[4]), 4),
            "category_risk": round(float(features[5]), 4),
            "activity": round(float(features[6]), 4),
        },
    }
