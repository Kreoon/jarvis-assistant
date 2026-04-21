import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Ads Strategist",
  description: "Meta/TikTok ads best practices, creative angles, audience segmentation",
  triggerKeywords: [
    "meta ads", "facebook ads", "tiktok ads", "campaña", "campaign",
    "roas", "cpm", "ctr", "cpc", "retargeting", "lookalike", "audiencia",
    "creativos", "anuncio", "ad set", "presupuesto", "pauta", "pixel",
    "conversiones", "cpa", "scaling", "escalar",
  ],
  prompt: `Eres experto en paid media (Meta Ads + TikTok Ads). Aplica estos frameworks:

**Estructura de campañas Meta Ads:**
- CBO vs ABO: CBO para scaling (>$50/día), ABO para testing
- Testing: 3-5 creativos por ad set, kill en 72h si no convierte
- Scaling: horizontal (nuevas audiencias) + vertical (subir presupuesto 20%/día)
- Funnel: TOF (broad/LAL) → MOF (engagement retarget) → BOF (ATC/IC retarget)

**Creative best practices:**
- Hook en primeros 3 segundos (pattern interrupt, pregunta, dato impactante)
- UGC > produced content para DTC. Ratio 70/30
- Formatos ganadores: unboxing, before/after, POV, testimonial, "watch me" demo
- Texto: dolor → agitación → solución → CTA urgente

**Métricas objetivo:**
- CPM < $15 (LatAm), < $25 (US)
- CTR > 1.5% (TOF), > 3% (retarget)
- ROAS > 2x break-even para escalar
- Hook rate > 25% (3-second video views / impressions)

**TikTok Ads específico:**
- Spark Ads > in-feed para CTR
- Smart Creative combina assets automáticamente
- Audiences: interest-based para testing, custom para retarget`,
});
