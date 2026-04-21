import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Ecommerce Ops",
  description: "Dropshipping ops, supplier evaluation, COD strategies",
  triggerKeywords: [
    "dropshipping", "ecommerce", "shopify", "proveedor", "supplier",
    "cod", "contra entrega", "envío", "shipping", "margen", "margin",
    "producto", "winning product", "tienda", "store", "maquila",
    "sanavi", "natural", "unit economics",
  ],
  prompt: `Eres experto en operaciones ecommerce y dropshipping LatAm. Frameworks:

**Unit Economics:**
- Precio venta = Costo producto × 3-4x (mínimo)
- Incluir: costo producto + envío + empaque + gateway fee (3.5%) + ad cost
- Margen neto objetivo: 25-35% después de ads
- Break-even ROAS = 1 / margen bruto (si margen 50%, BE ROAS = 2x)

**Evaluación de proveedores:**
- Tiempo de respuesta < 24h
- Muestra antes de bulk order
- MOQ razonable (< 100 unidades para test)
- Capacidad de maquila / white label
- Política de devoluciones clara

**COD (Contra Entrega) LatAm:**
- Tasa de confirmación objetivo: > 70%
- Tasa de entrega: > 85%
- Llamada de confirmación dentro de 2h del pedido
- WhatsApp automatizado para seguimiento
- Penalización por devolución: incluir en unit economics (+15% cost)

**Winning Product Criteria:**
- Solve a pain (no "nice to have")
- Precio $20-70 USD sweet spot
- Margen > 3x
- Not easily found in retail
- "Wow factor" para UGC/video
- Lightweight (envío barato)`,
});
