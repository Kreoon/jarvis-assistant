import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "../public/icons");

mkdirSync(outputDir, { recursive: true });

// Intentar cargar sharp, si falla usar @resvg/resvg-js
let renderSvgToPng;

try {
  const sharp = (await import("sharp")).default;
  renderSvgToPng = async (svgBuffer, size) => {
    return sharp(svgBuffer).resize(size, size).png().toBuffer();
  };
  console.log("Usando sharp para renderizar iconos.");
} catch {
  console.log("sharp no disponible, usando @resvg/resvg-js como fallback.");
  const { Resvg } = await import("@resvg/resvg-js");
  renderSvgToPng = async (svgBuffer, size) => {
    const resvg = new Resvg(svgBuffer, {
      fitTo: { mode: "width", value: size },
    });
    const pngData = resvg.render();
    return pngData.asPng();
  };
}

/**
 * Genera el SVG del ícono de Jarvis.
 * @param {number} size - Lado del cuadrado en px
 * @param {number} paddingFraction - Fracción de padding para safe area (maskable)
 */
function buildSvg(size, paddingFraction = 0) {
  const padding = Math.round(size * paddingFraction);
  const innerSize = size - padding * 2;
  const radius = Math.round(innerSize * 0.225); // ~22.5% iOS-style
  const fontSize = Math.round(innerSize * 0.55);
  const cx = size / 2;
  const cy = size / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect
    x="${padding}"
    y="${padding}"
    width="${innerSize}"
    height="${innerSize}"
    rx="${radius}"
    ry="${radius}"
    fill="#0a0a0b"
  />
  <text
    x="${cx}"
    y="${cy}"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="SF Pro Display, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    font-weight="600"
    font-size="${fontSize}"
    fill="#5e8eff"
  >J</text>
</svg>`;
}

const icons = [
  { name: "icon-192.png", size: 192, padding: 0 },
  { name: "icon-256.png", size: 256, padding: 0 },
  { name: "icon-384.png", size: 384, padding: 0 },
  { name: "icon-512.png", size: 512, padding: 0 },
  { name: "apple-touch-icon.png", size: 180, padding: 0 },
  { name: "favicon-32.png", size: 32, padding: 0 },
  { name: "maskable-512.png", size: 512, padding: 0.1 }, // 10% safe area por lado
];

for (const icon of icons) {
  const svg = buildSvg(icon.size, icon.padding);
  const svgBuffer = Buffer.from(svg);
  const pngBuffer = await renderSvgToPng(svgBuffer, icon.size);
  const outputPath = join(outputDir, icon.name);
  writeFileSync(outputPath, pngBuffer);
  console.log(`Generado: public/icons/${icon.name} (${icon.size}x${icon.size})`);
}

console.log("\nTodos los iconos generados correctamente.");
