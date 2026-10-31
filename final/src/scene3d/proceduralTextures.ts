'use client';

import * as THREE from 'three';

export type TextureStyle = 'marble' | 'wood' | 'cyber' | 'stone' | 'carpet' | 'stars';

export type ItemTextureStyle =
  | 'walnut_wood'
  | 'oak_wood'
  | 'tufted_velvet'
  | 'quilted_linen'
  | 'brushed_steel'
  | 'weathered_crate'
  | 'fractured_rubble';

const textureCache: Partial<Record<TextureStyle, THREE.CanvasTexture>> = {};
const bumpCache: Partial<Record<TextureStyle, THREE.CanvasTexture>> = {};
const itemTexCache: Partial<Record<ItemTextureStyle, THREE.CanvasTexture>> = {};
const itemBumpCache: Partial<Record<ItemTextureStyle, THREE.CanvasTexture>> = {};
const spriteCache: Record<string, THREE.CanvasTexture> = {};

/**
 * Generates high-resolution procedural CanvasTextures inspired by the Memory Palace architecture:
 * - 'wood': Royal Versailles parquet oak panels with diagonal weave, wood grain curves, and subtle brass inlay
 * - 'marble': Calacatta & Nero Marquina marble tiles with natural veining and brushed gold corner inlays
 * - 'stone': Honed ashlar stone masonry with bevel highlights and warm mortar joints
 * - 'carpet': Woven royal crimson & gold damask tapestry runner
 * - 'cyber': High-tech engineering laboratory dark slate grid with cyan/gold telemetry nodes
 * - 'stars': Deep-space nocturnal starfield with warm golden and cool sapphire nebulae
 */
export function getProceduralTexture(style: TextureStyle): THREE.CanvasTexture {
  if (textureCache[style]) {
    return textureCache[style]!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  if (style === 'marble') {
    // Base warm ivory / Calacatta marble
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    bgGrad.addColorStop(0, '#f1efe9');
    bgGrad.addColorStop(0.5, '#e5e0d5');
    bgGrad.addColorStop(1, '#ece8df');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle mineral clouds
    for (let i = 0; i < 24; i++) {
      const x = (i * 197) % 1024;
      const y = (i * 353) % 1024;
      const r = 120 + (i % 5) * 45;
      const grad = ctx.createRadialGradient(x, y, 10, x, y, r);
      grad.addColorStop(0, 'rgba(180, 172, 158, 0.14)');
      grad.addColorStop(1, 'rgba(180, 172, 158, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1024);
    }

    // Organic grey & warm gold marble veins
    for (let i = 0; i < 36; i++) {
      ctx.beginPath();
      ctx.strokeStyle =
        i % 6 === 0
          ? 'rgba(212, 175, 55, 0.24)'
          : i % 2 === 0
            ? 'rgba(100, 116, 139, 0.18)'
            : 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = i % 6 === 0 ? 2.2 : 1.5 + (i % 4) * 1.2;
      let x = (i * 131) % 1024;
      let y = 0;
      ctx.moveTo(x, y);
      for (let step = 0; step < 16; step++) {
        x += Math.sin(i * 1.7 + step * 0.65) * 45;
        y += 64;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Grand tile grid (4x4 slabs) with gold corner diamond inlays
    ctx.strokeStyle = 'rgba(120, 113, 108, 0.35)';
    ctx.lineWidth = 3;
    const step = 256;
    for (let x = 0; x <= 1024; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(1024, x);
      ctx.stroke();
    }

    // Gold diamond inlays at intersections
    ctx.fillStyle = 'rgba(212, 175, 55, 0.55)';
    for (let x = step; x < 1024; x += step) {
      for (let y = step; y < 1024; y += step) {
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + 10, y);
        ctx.lineTo(x, y + 10);
        ctx.lineTo(x - 10, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (style === 'wood') {
    // Rich warm walnut / Versailles parquet base
    ctx.fillStyle = '#4a2e1b';
    ctx.fillRect(0, 0, 1024, 1024);

    const panelSize = 256;
    const tones = ['#5c3a21', '#4f311c', '#684227', '#54351e', '#613d24'];

    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const x0 = px * panelSize;
        const y0 = py * panelSize;

        // Alternating parquet strips inside each panel
        const strips = 6;
        const stripW = panelSize / strips;
        const evenPanel = (px + py) % 2 === 0;

        for (let s = 0; s < strips; s++) {
          ctx.fillStyle = tones[(px * 3 + py * 5 + s) % tones.length];
          if (evenPanel) {
            ctx.fillRect(x0 + s * stripW, y0, stripW - 1, panelSize);
          } else {
            ctx.fillRect(x0, y0 + s * stripW, panelSize, stripW - 1);
          }

          // Fine wood grain lines
          ctx.strokeStyle = 'rgba(24, 13, 6, 0.24)';
          ctx.lineWidth = 1.2;
          for (let g = 0; g < 5; g++) {
            ctx.beginPath();
            if (evenPanel) {
              const gx = x0 + s * stripW + (g + 1) * (stripW / 6);
              ctx.moveTo(gx, y0);
              ctx.bezierCurveTo(
                gx + 4,
                y0 + panelSize * 0.33,
                gx - 4,
                y0 + panelSize * 0.66,
                gx,
                y0 + panelSize
              );
            } else {
              const gy = y0 + s * stripW + (g + 1) * (stripW / 6);
              ctx.moveTo(x0, gy);
              ctx.bezierCurveTo(
                x0 + panelSize * 0.33,
                gy + 4,
                x0 + panelSize * 0.66,
                gy - 4,
                x0 + panelSize,
                gy
              );
            }
            ctx.stroke();
          }
        }

        // Panel frame border
        ctx.strokeStyle = 'rgba(28, 16, 8, 0.72)';
        ctx.lineWidth = 4;
        ctx.strokeRect(x0 + 2, y0 + 2, panelSize - 4, panelSize - 4);

        // Subtle brass fillet line inside each parquet square
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 10, y0 + 10, panelSize - 20, panelSize - 20);
      }
    }
  } else if (style === 'stone') {
    // Architectural warm limestone / plaster ashlar masonry
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1024, 1024);

    const rows = 8;
    const rowH = 1024 / rows;
    const cols = 4;
    const colW = 1024 / cols;
    const palette = ['#263449', '#2b3950', '#233044', '#2d3c54'];

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW / 2);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;

        ctx.fillStyle = palette[(r * 3 + c + 4) % palette.length];
        ctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);

        // Top-left bevel highlight
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + rowH - 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.lineTo(x + colW - 4, y + 4);
        ctx.stroke();

        // Bottom-right bevel shadow
        ctx.strokeStyle = 'rgba(9, 13, 22, 0.55)';
        ctx.beginPath();
        ctx.moveTo(x + colW - 4, y + 4);
        ctx.lineTo(x + colW - 4, y + rowH - 4);
        ctx.lineTo(x + 4, y + rowH - 4);
        ctx.stroke();
      }
    }

    // Subtle stone speckle
    for (let i = 0; i < 1800; i++) {
      const x = (i * 613) % 1024;
      const y = (i * 997) % 1024;
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(x, y, 3, 3);
    }
  } else if (style === 'carpet') {
    // Royal crimson & gold woven tapestry carpet
    const grad = ctx.createRadialGradient(512, 512, 60, 512, 512, 680);
    grad.addColorStop(0, '#6b1426');
    grad.addColorStop(0.7, '#4c0d1b');
    grad.addColorStop(1, '#330812');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Fine woven cross-hatch threads
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1024; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    // Double ornate gold border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.78)';
    ctx.lineWidth = 14;
    ctx.strokeRect(36, 36, 1024 - 72, 1024 - 72);

    ctx.strokeStyle = 'rgba(245, 208, 97, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(64, 64, 1024 - 128, 1024 - 128);

    // Repeating geometric diamond medallions
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
    ctx.lineWidth = 3;
    for (let y = 160; y < 900; y += 176) {
      for (let x = 160; x < 900; x += 176) {
        ctx.beginPath();
        ctx.moveTo(x, y - 48);
        ctx.lineTo(x + 48, y);
        ctx.lineTo(x, y + 48);
        ctx.lineTo(x - 48, y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (style === 'cyber') {
    // High-tech architectural slate with precision glowing grid
    ctx.fillStyle = '#0b1322';
    ctx.fillRect(0, 0, 1024, 1024);

    // Sub-grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    // Major grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.26)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 1024; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    // Glowing intersection nodes
    ctx.fillStyle = 'rgba(212, 175, 55, 0.55)';
    for (let x = 128; x < 1024; x += 128) {
      for (let y = 128; y < 1024; y += 128) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'stars') {
    ctx.fillStyle = '#04070e';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle atmospheric nebula glow
    const neb1 = ctx.createRadialGradient(280, 320, 20, 280, 320, 380);
    neb1.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
    neb1.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, 1024, 1024);

    const neb2 = ctx.createRadialGradient(740, 680, 20, 740, 680, 340);
    neb2.addColorStop(0, 'rgba(212, 175, 55, 0.10)');
    neb2.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, 1024, 1024);

    // Crisp stars
    for (let i = 0; i < 750; i++) {
      const x = (i * 577) % 1024;
      const y = (i * 887) % 1024;
      const r = i % 19 === 0 ? 2.1 : i % 7 === 0 ? 1.4 : 0.9;
      ctx.fillStyle =
        i % 13 === 0
          ? '#fde68a'
          : i % 9 === 0
            ? '#bae6fd'
            : 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  textureCache[style] = texture;
  return texture;
}

/**
 * Generates matching height/bump maps so lighting catches wood grain, tile joints, and stone bevels.
 */
export function getProceduralBumpMap(style: TextureStyle): THREE.CanvasTexture {
  if (bumpCache[style]) {
    return bumpCache[style]!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);

  if (style === 'wood') {
    const panelSize = 128;
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const x0 = px * panelSize;
        const y0 = py * panelSize;
        ctx.strokeStyle = '#303030';
        ctx.lineWidth = 3;
        ctx.strokeRect(x0 + 1, y0 + 1, panelSize - 2, panelSize - 2);

        ctx.strokeStyle = '#656565';
        ctx.lineWidth = 1;
        for (let i = 16; i < panelSize; i += 16) {
          ctx.beginPath();
          if ((px + py) % 2 === 0) {
            ctx.moveTo(x0 + i, y0);
            ctx.lineTo(x0 + i, y0 + panelSize);
          } else {
            ctx.moveTo(x0, y0 + i);
            ctx.lineTo(x0 + panelSize, y0 + i);
          }
          ctx.stroke();
        }
      }
    }
  } else if (style === 'marble' || style === 'cyber') {
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  } else if (style === 'stone') {
    const rows = 8;
    const rowH = 512 / rows;
    const cols = 4;
    const colW = 512 / cols;
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 4;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW / 2);
      for (let c = -1; c <= cols; c++) {
        ctx.strokeRect(c * colW + offset, r * rowH, colW, rowH);
      }
    }
  } else if (style === 'carpet') {
    ctx.strokeStyle = '#9a9a9a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 512; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }
  }

  const bump = new THREE.CanvasTexture(canvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 4;
  bump.needsUpdate = true;

  bumpCache[style] = bump;
  return bump;
}

/**
 * Generates high-detail tactile textures specifically for 3D furniture & physical obstacles
 * (wood grain, diamond-tufted velvet, quilted linen, brushed steel louvers, timber crates, fractured rubble).
 */
export function getItemTexture(style: ItemTextureStyle): THREE.CanvasTexture {
  if (itemTexCache[style]) {
    return itemTexCache[style]!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (style === 'walnut_wood' || style === 'oak_wood') {
    const isOak = style === 'oak_wood';
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    if (isOak) {
      grad.addColorStop(0, '#7c471e');
      grad.addColorStop(0.5, '#683a16');
      grad.addColorStop(1, '#854e23');
    } else {
      grad.addColorStop(0, '#3e2313');
      grad.addColorStop(0.5, '#2f190c');
      grad.addColorStop(1, '#472816');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Plank seams
    ctx.strokeStyle = 'rgba(15, 8, 3, 0.55)';
    ctx.lineWidth = 2;
    for (let x = 64; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // Organic wood grain waves & knots
    for (let i = 0; i < 95; i++) {
      ctx.beginPath();
      ctx.strokeStyle =
        i % 3 === 0
          ? 'rgba(255, 224, 178, 0.08)'
          : 'rgba(18, 9, 4, 0.28)';
      ctx.lineWidth = 1 + (i % 3) * 0.7;
      let gx = (i * 29) % 512;
      ctx.moveTo(gx, 0);
      for (let y = 0; y <= 512; y += 32) {
        gx += Math.sin(y * 0.025 + i * 0.7) * 4.5;
        ctx.lineTo(gx, y);
      }
      ctx.stroke();
    }

    // Subtle brass border inlay
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.24)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 492, 492);
  } else if (style === 'tufted_velvet') {
    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 360);
    grad.addColorStop(0, '#881327');
    grad.addColorStop(0.6, '#690f20');
    grad.addColorStop(1, '#470914');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Diamond velvet tufting grid & deep button dimples
    const step = 64;
    ctx.strokeStyle = 'rgba(28, 4, 9, 0.65)';
    ctx.lineWidth = 2.5;
    for (let i = -512; i < 1024; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i + 512, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }

    for (let y = step / 2; y < 512; y += step) {
      for (let x = step / 2; x < 512; x += step) {
        const rad = ctx.createRadialGradient(x, y, 2, x, y, 18);
        rad.addColorStop(0, 'rgba(20, 3, 7, 0.85)');
        rad.addColorStop(0.5, 'rgba(255, 190, 200, 0.12)');
        rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();

        // Gold/brass tuft button
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'quilted_linen') {
    ctx.fillStyle = '#f5f3ef';
    ctx.fillRect(0, 0, 512, 512);

    // Woven fabric micro-threads
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 512; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Soft quilted diamond stitching
    const step = 48;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    for (let i = -512; i < 1024; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 512, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else if (style === 'brushed_steel') {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Fine horizontal brushed metal hairlines
    for (let y = 0; y < 512; y += 2) {
      ctx.strokeStyle =
        y % 4 === 0
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Modular panel seams & ventilation louvers
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 488, 488);
    ctx.strokeRect(12, 256, 488, 244);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    for (let y = 44; y < 220; y += 22) {
      ctx.fillRect(48, y, 160, 8);
      ctx.fillRect(304, y, 160, 8);
    }
  } else if (style === 'weathered_crate') {
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(0, 0, 512, 512);

    // Horizontal timber slats
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#9a5b13' : '#7c460b';
      ctx.fillRect(0, y + 2, 512, 60);
      ctx.strokeStyle = '#3f2204';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, y + 2, 508, 60);
    }

    // Outer frame & diagonal cross-brace
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 28;
    ctx.strokeRect(14, 14, 484, 484);
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(492, 492);
    ctx.moveTo(492, 20);
    ctx.lineTo(20, 492);
    ctx.stroke();

    // Corner metal brackets & rivets
    ctx.fillStyle = '#334155';
    const corners = [
      [0, 0],
      [448, 0],
      [0, 448],
      [448, 448],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx, cy, 64, 64);
    }
  } else if (style === 'fractured_rubble') {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 512, 512);

    // Aggregate concrete & plaster patches
    const tones = ['#64748b', '#334155', '#52525b', '#78716c', '#475569'];
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = tones[i % tones.length];
      const rx = (i * 173) % 512;
      const ry = (i * 293) % 512;
      const rw = 18 + (i % 5) * 14;
      const rh = 14 + (i % 4) * 16;
      ctx.fillRect(rx, ry, rw, rh);
    }

    // Deep fracture lines
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    for (let c = 0; c < 18; c++) {
      let x = (c * 89) % 512;
      let y = (c * 151) % 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += Math.cos(c * 2.1 + s) * 38;
        y += Math.sin(c * 1.4 + s) * 38;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  itemTexCache[style] = tex;
  return tex;
}

export function getItemBumpMap(style: ItemTextureStyle): THREE.CanvasTexture {
  if (itemBumpCache[style]) {
    return itemBumpCache[style]!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  if (style === 'walnut_wood' || style === 'oak_wood') {
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 2;
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = '#686868';
    ctx.lineWidth = 1;
    for (let i = 0; i < 64; i++) {
      const gx = (i * 19) % 256;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 6, 85, gx - 6, 170, gx, 256);
      ctx.stroke();
    }
  } else if (style === 'tufted_velvet' || style === 'quilted_linen') {
    const step = 32;
    ctx.strokeStyle = '#303030';
    ctx.lineWidth = 2;
    for (let i = -256; i < 512; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  } else if (style === 'weathered_crate') {
    ctx.strokeStyle = '#252525';
    ctx.lineWidth = 3;
    for (let y = 0; y < 256; y += 32) {
      ctx.strokeRect(2, y, 252, 30);
    }
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#b5b5b5';
    ctx.strokeRect(6, 6, 244, 244);
  } else if (style === 'fractured_rubble') {
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#484848';
      ctx.fillRect((i * 73) % 256, (i * 137) % 256, 14, 14);
    }
  } else if (style === 'brushed_steel') {
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
  }

  const bump = new THREE.CanvasTexture(canvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 4;
  bump.needsUpdate = true;

  itemBumpCache[style] = bump;
  return bump;
}

/**
 * Memory Palace-style high-DPI glassmorphic floating pill sprite texture (`640x160`)
 * for crisp, zero-flicker 3D architectural and physics telemetry plaques.
 */
export function getGlassPillTexture(opts: {
  badge: string;
  title: string;
  subtitle?: string;
  accentColor: string;
  badgeBg?: string;
}): THREE.CanvasTexture {
  const key = `${opts.badge}|${opts.title}|${opts.subtitle ?? ''}|${opts.accentColor}|${opts.badgeBg ?? ''}`;
  if (spriteCache[key]) {
    return spriteCache[key];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 640, 160);

  // Outer pill shadow & dark glassmorphic background
  const x = 16;
  const y = 18;
  const w = 608;
  const h = 124;
  const r = 62;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, 'rgba(10, 16, 29, 0.92)');
  bgGrad.addColorStop(1, 'rgba(6, 10, 19, 0.96)');
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Glowing outer rim
  ctx.lineWidth = 4;
  ctx.strokeStyle = opts.accentColor;
  ctx.stroke();

  // Subtle inner gold/white hairline
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 6, w - 12, h - 12, r - 6);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.stroke();
  ctx.restore();

  // Left circular status badge
  const cx = x + 64;
  const cy = y + h / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.fillStyle = opts.badgeBg ?? opts.accentColor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.stroke();

  // Badge text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.badge.slice(0, 5), cx, cy + 1);

  // Main Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 31px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const maxTitleWidth = 450;
  let displayTitle = opts.title;
  if (ctx.measureText(displayTitle).width > maxTitleWidth) {
    while (
      displayTitle.length > 4 &&
      ctx.measureText(displayTitle + '…').width > maxTitleWidth
    ) {
      displayTitle = displayTitle.slice(0, -1);
    }
    displayTitle += '…';
  }
  ctx.fillText(displayTitle, x + 124, opts.subtitle ? y + 48 : cy);

  // Subtitle / Telemetry metric
  if (opts.subtitle) {
    ctx.fillStyle = opts.accentColor;
    ctx.font = '600 23px "SF Mono", "Fira Code", monospace';
    ctx.fillText(opts.subtitle, x + 124, y + 88);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  spriteCache[key] = texture;
  return texture;
}
