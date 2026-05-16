/* ==========================================================================
   ### PANTALLA, ORIENTACIÓN Y CONFIGURACIÓN BASE ###
   ========================================================================== */

function lockPortrait() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("portrait").catch(() => {});
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
      .then(() => lockPortrait())
      .catch(() => {});
  } else {
    lockPortrait();
  }
}

const fps = 30;
const fpsInterval = 1000 / fps;
let then = performance.now();

// Elementos del DOM
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const fileInput = document.getElementById("file-input");
const splash = document.getElementById("splash-screen");
const loadingMsg = document.getElementById("loading-msg");
const topUI = document.getElementById("top-ui");
const controls = document.getElementById("controls-area");
const btnGrid = document.getElementById("btn-grid");
const btnTransform = document.getElementById("btn-transform");
const btnChange = document.getElementById("btn-change");

// Listas de configuración y estados base
const grids = ["tercios", "golden", "diagonales", "tri-aureos", "espiral", "fuga", "horizonte", "reframe", "masas", "focus", "paleta"];
const gridLabels = ["Regla de Tercios", "Sección Áurea", "Diagonales", "Triángulos Áureos", "Espiral Fibonacci", "Punto de Fuga", "Horizonte", "Encuadre", "Masas", "Enfoque", "Paleta"];
const colors = ["#FFFFFF", "#FF0088", "#00CCFF", "#FFCC00", "#00FF00", "#000000"];
const color_masas = ["#FFFFFF", "#FF0088", "#00CCFF", "#FFCC00", "#00FF00", "#888888"];

let gIdx = 0;
let transformIdx = 0;
let cIdx = 0;

// Variables de estado de imágenes y arrastre
let loadedImage = null;
let masasImage = null;
let isRunning = false;
let isDragging = false;
let dragMode = "none";
let imgX = 0, imgY = 0, imgScale = 1;
let initialImgX = 0, initialImgY = 0, initialScale = 1, initialDist = 0;
let initialCenter = { x: 0, y: 0 };
let startTouches = [];

// Coordenadas de herramientas específicas
let horY = 0.5, horMode = "H", fugaX = 0.5, fugaY = 0.5;
let frameX1 = 0.2, frameY1 = 0.2, frameX2 = 0.8, frameY2 = 0.8;
let activeHandle = null;

// Parámetros de efectos avanzados
let mBlur = 5, mThr = 127, mInvert = false, isBypass = false;
let pulseStartTime = 0;
let fThreshold = 40;
let paletteColors = [];
let paletteDirty = true;

function setLoading(state, text = "Cargando...") {
  loadingMsg.innerText = text;
  loadingMsg.style.display = state ? "block" : "none";

  document.querySelectorAll(".main-btn").forEach((btn) => {
    btn.disabled = state;
    btn.classList.toggle("loading", state);
  });
}

/* ==========================================================================
   ### PROCESAMIENTO DE IMÁGENES ###
   ========================================================================== */

function processImages(img) {
  let w = img.width, h = img.height;
  const isMobile = window.matchMedia("(pointer: coarse)").matches;
  let needsRotate = isMobile && w > h;

  function createVariant(maxDim) {
    let tw = img.width, th = img.height;
    let scale = Math.min(maxDim / (needsRotate ? th : tw), maxDim / (needsRotate ? tw : th));
    if (scale > 1) scale = 1;

    const tCanvas = document.createElement("canvas");
    tCanvas.width = needsRotate ? th * scale : tw * scale;
    tCanvas.height = needsRotate ? tw * scale : th * scale;

    const tCtx = tCanvas.getContext("2d");
    if (needsRotate) {
      tCtx.translate(tCanvas.width / 2, tCanvas.height / 2);
      tCtx.rotate(Math.PI / 2);
      tCtx.drawImage(img, (-tw * scale) / 2, (-th * scale) / 2, tw * scale, th * scale);
    } else {
      tCtx.drawImage(img, 0, 0, tw * scale, th * scale);
    }

    const newImg = new Image();
    newImg.src = tCanvas.toDataURL("image/jpeg", 0.8);
    return newImg;
  }

  loadedImage = createVariant(1200);
  masasImage = createVariant(600);

  loadedImage.onload = () => {
    paletteDirty = true;
    centerImage();
    if (!isRunning) {
      isRunning = true;
      requestAnimationFrame(render);
    }
    splash.style.display = "none";
    topUI.style.display = "flex";
    controls.style.display = "flex";
    setLoading(false);
  };
}

async function loadMuseumArt(retries = 3) {
  toggleFullScreen();
  setLoading(true, "Buscando imagen...");
  try {
    const page = Math.floor(Math.random() * 100) + 1;
    const resp = await fetch(`https://api.artic.edu/api/v1/artworks/search?q=painting&page=${page}&limit=20&fields=image_id`);

    if (!resp.ok) throw new Error("Error en respuesta de API");
    const data = await resp.json();
    const artworks = data.data.filter((a) => a.image_id);
    if (artworks.length === 0) throw new Error("No hay imágenes en esta página");
    
    const art = artworks[Math.floor(Math.random() * artworks.length)];
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.onload = () => processImages(tempImg);
    tempImg.onerror = () => {
      if (retries > 0) loadMuseumArt(retries - 1);
    };
    tempImg.src = `https://www.artic.edu/iiif/2/${art.image_id}/full/800,/0/default.jpg`;
  } catch (e) {
    if (retries > 0) {
      console.log(`Reintentando carga... quedan ${retries} intentos`);
      setTimeout(() => loadMuseumArt(retries - 1), 500);
    } else {
      alert("El museo no responde, intenta con una foto.");
      setLoading(false);
    }
  }
}

async function loadRandomPhoto() {
  toggleFullScreen();
  setLoading(true, "Buscando imagen...");
  const tempImg = new Image();
  tempImg.crossOrigin = "anonymous";
  const randomId = Math.floor(Math.random() * 1000);
  tempImg.src = `https://picsum.photos/1200/1600?sig=${randomId}`;

  tempImg.onload = () => processImages(tempImg);
  tempImg.onerror = () => {
    alert("Error al cargar fotografía");
    setLoading(false);
  };
}

fileInput.onchange = (e) => {
  toggleFullScreen();
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const tempImg = new Image();
    tempImg.onload = () => processImages(tempImg);
    tempImg.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

function centerImage() {
  const W = window.innerWidth, H = window.innerHeight;
  const ir = loadedImage.width / loadedImage.height;
  imgScale = (ir > W / H) ? (W / loadedImage.width) : (H / loadedImage.height);
  imgX = (W - loadedImage.width * imgScale) / 2;
  imgY = (H - loadedImage.height * imgScale) / 2;
  fugaX = 0.5;
  fugaY = 0.5;
  transformIdx = 0;
  initFrameCompL();
}

function initFrameCompL() {
  const rw = loadedImage.width, rh = loadedImage.height;
  const side = Math.min(rw, rh) * 0.9;
  frameX1 = (rw - side) / 2 / rw;
  frameY1 = (rh - side) / 2 / rh;
  frameX2 = (rw + side) / 2 / rw;
  frameY2 = (rh + side) / 2 / rh;
}

/* ==========================================================================
   ### PALETAS DE COLOR y K-MEANS ###
   ========================================================================== */

function generatePalette() {
  if (!masasImage) return;
  const tempCanvas = document.createElement("canvas");
  const tctx = tempCanvas.getContext("2d", { willReadFrequently: true });
  tempCanvas.width = masasImage.width;
  tempCanvas.height = masasImage.height;
  tctx.drawImage(masasImage, 0, 0);
  
  const data = tctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 16) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  const k = autoK(pixels);
  let clusters = kmeans(pixels, k, 8);
  clusters = filterSimilar(clusters, 38);

  clusters = clusters.map((c) => {
    const hsl = rgbToHsl(c.color);
    return { ...c, hue: hsl.h, sat: hsl.s, light: hsl.l };
  });

  clusters.sort((a, b) => {
    const scoreA = a.size * (0.5 + a.sat);
    const scoreB = b.size * (0.5 + b.sat);
    return scoreB - scoreA;
  });

  clusters = clusters.slice(0, 8);
  clusters.sort((a, b) => a.light - b.light);
  paletteColors = clusters;
  paletteDirty = false;
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = 0; s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function getBrightness(rgb) {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

function kmeans(pixels, k, iterations) {
  let centroids = Array.from({ length: k }, () => pixels[Math.floor(Math.random() * pixels.length)]);
  let clusters = [];
  
  for (let i = 0; i < iterations; i++) {
    clusters = Array.from({ length: k }, () => []);
    for (const p of pixels) {
      let bestIdx = 0, minDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist(p, centroids[c]);
        if (d < minDist) { minDist = d; bestIdx = c; }
      }
      clusters[bestIdx].push(p);
    }
    centroids = centroids.map((_, idx) => {
      if (clusters[idx].length === 0) return centroids[idx];
      let r = 0, g = 0, b = 0;
      for (const p of clusters[idx]) { r += p[0]; g += p[1]; b += p[2]; }
      const n = clusters[idx].length;
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    });
  }
  return centroids.map((c, idx) => ({
    color: c,
    size: clusters[idx].length,
    brightness: getBrightness(c),
  })).sort((a, b) => b.size - a.size);
}

function filterSimilar(colors, threshold) {
  const result = [];
  for (const c of colors) {
    const isSimilar = result.some((existing) => dist(c.color, existing.color) < threshold);
    if (!isSimilar) result.push(c);
  }
  return result;
}

function dist(a, b) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
}

function estimateColorComplexity(pixels) {
  const map = new Map();
  for (const [r, g, b] of pixels) {
    const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
    map.set(key, 1);
  }
  return map.size;
}

function autoK(pixels) {
  const complexity = estimateColorComplexity(pixels);
  let k = Math.round(complexity / 20);
  console.log(k);
  return Math.max(3, Math.min(k, 15));
}

/* ==========================================================================
   ### INTERACCIÓN (GENTURES, MOUSE y TOUCH) ###
   ========================================================================== */

function handleStart(e) {
  if (!isRunning) return;
  isDragging = true;
  startTouches = Array.from(e.touches || [e]);
  
  if (startTouches.length === 1) {
    const grid = grids[gIdx];
    if (grid === "fuga") dragMode = "fuga";
    else if (grid === "horizonte") dragMode = "horizonte";
    else if (grid === "reframe") {
      dragMode = "reframe";
      const rw = loadedImage.width * imgScale, rh = loadedImage.height * imgScale;
      const px = (startTouches[0].clientX - imgX) / rw, py = (startTouches[0].clientY - imgY) / rh;
      const d1 = Math.hypot(px - frameX1, py - frameY1), d2 = Math.hypot(px - frameX2, py - frameY2);
      activeHandle = d1 < d2 ? 1 : 2;
    } else if (grid === "masas") dragMode = "masas";
    else if (grid === "focus") dragMode = "focus";
    else {
      dragMode = "pan";
      initialImgX = imgX;
      initialImgY = imgY;
    }
  } else if (startTouches.length === 2) {
    dragMode = "zoom";
    initialDist = Math.hypot(startTouches[0].clientX - startTouches[1].clientX, startTouches[0].clientY - startTouches[1].clientY);
    initialScale = imgScale;
    initialImgX = imgX;
    initialImgY = imgY;
    initialCenter = {
      x: (startTouches[0].clientX + startTouches[1].clientX) / 2,
      y: (startTouches[0].clientY + startTouches[1].clientY) / 2,
    };
  }
}

function handleMove(e) {
  if (!isDragging || !loadedImage) return;
  const cur = Array.from(e.touches || [e]);
  const rw = loadedImage.width * imgScale, rh = loadedImage.height * imgScale;

  if (cur.length === 1 && dragMode !== "zoom") {
    let nx = (cur[0].clientX - imgX) / rw, ny = (cur[0].clientY - imgY) / rh;
    if (dragMode === "fuga") {
      fugaX = nx; fugaY = ny;
    } else if (dragMode === "horizonte") {
      if (horMode === "H") horY = Math.max(0, Math.min(1, ny));
      else fugaX = nx;
    } else if (dragMode === "reframe") {
      nx = Math.max(0, Math.min(1, nx)); ny = Math.max(0, Math.min(1, ny));
      if (activeHandle === 1) {
        frameX1 = Math.min(nx, frameX2 - 0.05); frameY1 = Math.min(ny, frameY2 - 0.05);
      } else {
        frameX2 = Math.max(nx, frameX1 + 0.05); frameY2 = Math.max(ny, frameY1 + 0.05);
      }
    } else if (dragMode === "masas") {
      let rawX = Math.max(0, Math.min(1, nx)), rawY = Math.max(0, Math.min(1, ny));
      let curveX = rawX * rawX * (3 - 2 * rawX), curveY = rawY * rawY * (3 - 2 * rawY);
      mBlur = curveY * 40; mThr = curveX * 235;
    } else if (dragMode === "focus") {
      fThreshold = 5 + Math.max(0, Math.min(1, ny)) * 200;
    } else {
      imgX = initialImgX + (cur[0].clientX - startTouches[0].clientX);
      imgY = initialImgY + (cur[0].clientY - startTouches[0].clientY);
    }
  } else if (cur.length === 2) {
    const newDist = Math.hypot(cur[0].clientX - cur[1].clientX, cur[0].clientY - cur[1].clientY);
    imgScale = Math.max(0.1, initialScale * (newDist / initialDist));
    const newCenter = { x: (cur[0].clientX + cur[1].clientX) / 2, y: (cur[0].clientY + cur[1].clientY) / 2 };
    imgX = initialImgX + (newCenter.x - initialCenter.x);
    imgY = initialImgY + (newCenter.y - initialCenter.y);
  }
}

/* ==========================================================================
   ### LOOP DE RENDER PRINCIPAL ###
   ========================================================================== */

function render(time) {
  requestAnimationFrame(render);
  let now = performance.now();
  let elapsed = now - then;
  if (elapsed < fpsInterval) return;
  then = now - (elapsed % fpsInterval);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (loadedImage) {
    const rw = Math.round(loadedImage.width * imgScale);
    const rh = Math.round(loadedImage.height * imgScale);

    ctx.drawImage(loadedImage, imgX, imgY, rw, rh);

    // Render del modo Masas
    if (grids[gIdx] === "masas" && !isBypass && masasImage) {
      ctx.save();
      ctx.filter = `grayscale(100%) blur(${mBlur}px)`;
      ctx.drawImage(masasImage, imgX, imgY, rw, rh);

      const imgData = ctx.getImageData(imgX, imgY, rw, rh);
      const data = imgData.data;
      const hex = color_masas[cIdx].replace("#", "");
      const cr = parseInt(hex.substring(0, 2), 16), cg = parseInt(hex.substring(2, 4), 16), cb = parseInt(hex.substring(4, 6), 16);

      for (let i = 0; i < data.length; i += 4) {
        let v = data[i] > mThr ? 255 : 0;
        if (mInvert) v = 255 - v;
        data[i] = v === 255 ? cr : 0;
        data[i + 1] = v === 255 ? cg : 0;
        data[i + 2] = v === 255 ? cb : 0;
      }
      ctx.filter = "none";
      ctx.putImageData(imgData, imgX, imgY);
      ctx.restore();
    }

    // Render del modo Focus (Sobel Edge Detection)
    if (grids[gIdx] === "focus" && !isBypass) {
      ctx.save();
      ctx.filter = "grayscale(0.25) brightness(0.25)";
      ctx.drawImage(loadedImage, imgX, imgY, rw, rh);
      ctx.filter = "none";

      const imgData = ctx.getImageData(imgX, imgY, rw, rh);
      const d = imgData.data;
      const w = rw, h = rh;
      const mask = new Uint8Array(w * h);

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const s11 = d[((y - 1) * w + (x - 1)) * 4], s12 = d[((y - 1) * w + x) * 4], s13 = d[((y - 1) * w + (x + 1)) * 4];
          const s21 = d[(y * w + (x - 1)) * 4], s23 = d[(y * w + (x + 1)) * 4];
          const s31 = d[((y + 1) * w + (x - 1)) * 4], s32 = d[((y + 1) * w + x) * 4], s33 = d[((y + 1) * w + (x + 1)) * 4];
          const gx = s13 + 2 * s23 + s33 - (s11 + 2 * s21 + s31);
          const gy = s31 + 2 * s32 + s33 - (s11 + 2 * s12 + s13);
          if (Math.abs(gx) + Math.abs(gy) > fThreshold) mask[y * w + x] = 1;
        }
      }
      const p32 = new Uint32Array(d.buffer);
      const hex = colors[cIdx].replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
      const color32 = (0xff << 24) | (b << 16) | (g << 8) | r;

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          if (mask[idx] || mask[idx - 1] || mask[idx + 1] || mask[idx - w] || mask[idx + w]) p32[idx] = color32;
        }
      }
      ctx.putImageData(imgData, imgX, imgY);
      ctx.restore();
    }

    // Render del modo Paleta
    if (grids[gIdx] === "paleta" && !isBypass) {
      if (paletteDirty || paletteColors.length === 0) generatePalette();
      ctx.save();
      ctx.filter = "brightness(0.35)";
      ctx.drawImage(loadedImage, imgX, imgY, rw, rh);
      ctx.restore();

      const bandW = rw / paletteColors.length;
      let offset = imgX;
      ctx.save();
      ctx.lineWidth = 1;
      for (const cluster of paletteColors) {
        const [r, g, b] = cluster.color;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(offset, imgY, bandW + 1, rh);
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeRect(offset, imgY, bandW, rh);
        ctx.restore();
        offset += bandW;
      }
      ctx.restore();
    }

    // Dibujo de las Grillas de Composición
    ctx.save();
    ctx.beginPath();
    ctx.rect(imgX, imgY, rw, rh);
    ctx.clip();

    const cx = imgX + rw / 2, cy = imgY + rh / 2;
    ctx.save();
    if (grids[gIdx] !== "tercios" && grids[gIdx] !== "paleta") {
      if (transformIdx === 1) { ctx.translate(2 * cx, 0); ctx.scale(-1, 1); }
      else if (transformIdx === 2) { ctx.translate(2 * cx, 2 * cy); ctx.rotate(Math.PI); }
      else if (transformIdx === 3) { ctx.translate(0, 2 * cy); ctx.scale(1, -1); }
    }

    ctx.strokeStyle = colors[cIdx];
    ctx.lineWidth = 1.5;
    drawGrid(grids[gIdx], imgX, imgY, rw, rh, time);
    ctx.restore();

    ctx.strokeStyle = colors[cIdx];
    ctx.lineWidth = 2;
    ctx.strokeRect(imgX, imgY, rw, rh);
  }
}

/* ==========================================================================
   ### ENRUTADO DE GRILLAS ESPECÍFICAS ###
   ========================================================================== */

function drawGrid(mode, x, y, w, h, time) {
  if (mode === "focus") return;
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;

  if (mode === "tercios") {
    if (transformIdx % 2 === 0) {
      for (let i = 1; i < 3; i++) {
        line(x + (w * i) / 3, y, x + (w * i) / 3, y + h);
        line(x, y + (h * i) / 3, x + w, y + (h * i) / 3);
      }
    } else {
      for (let i = 1; i < 3; i++) {
        for (let j = 1; j < 3; j++) {
          const nx = x + (w * i) / 3, ny = y + (h * j) / 3;
          ctx.beginPath(); ctx.arc(nx, ny, 9, 0, 6.3); ctx.stroke();
          ctx.beginPath(); ctx.arc(nx, ny, 12, 0, 6.3); ctx.stroke();
        }
      }
    }
  } else if (mode === "golden") {
    const p = 0.618;
    if (transformIdx % 2 === 0) {
      line(x + w * p, y, x + w * p, y + h); line(x + w * (1 - p), y, x + w * (1 - p), y + h);
      line(x, y + h * p, x + w, y + h * p); line(x, y + h * (1 - p), x + w, y + h * (1 - p));
    } else {
      ctx.setLineDash([5, 5]);
      [0.236, 0.382, 0.618, 0.764].forEach((pos) => {
        line(x + w * pos, y, x + w * pos, y + h); line(x, y + h * pos, x + w, y + h * pos);
      });
      ctx.setLineDash([]);
    }
  } else if (mode === "tri-aureos") {
    line(x, y + h, x + w, y);
    const dx = w, dy = -h;
    const t1 = (-h * dy) / (dx * dx + dy * dy); line(x, y, x + t1 * dx, y + h + t1 * dy);
    const t2 = (w * dx) / (dx * dx + dy * dy); line(x + w, y + h, x + t2 * dx, y + h + t2 * dy);
  } else if (mode === "espiral") {
    const phi = 1.61803398875;
    let th = h, tw = h / phi;
    if (tw > w) { tw = w; th = w * phi; }
    let cX = x + (w - tw) / 2, cY = y + (h - th) / 2, cW = tw, cH = th;

    for (let j = 0; j < 10; j++) {
      let i = (j + 1) % 4, s = Math.min(cW, cH);
      if (s < 1) break;
      let sqX = cX, sqY = cY;
      if (i === 2) sqX = cX + cW - s;
      if (i === 3) sqY = cY + cH - s;
      
      ctx.save(); ctx.globalAlpha = 0.4; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.rect(sqX, sqY, s, s); ctx.stroke(); ctx.restore();
      
      ctx.beginPath();
      if (i === 0) { ctx.arc(sqX + s, sqY + s, s, Math.PI, 1.5 * Math.PI); cX += s; cW -= s; } 
      else if (i === 1) { ctx.arc(sqX, sqY + s, s, 1.5 * Math.PI, 2 * Math.PI); cY += s; cH -= s; } 
      else if (i === 2) { ctx.arc(sqX, sqY, s, 0, 0.5 * Math.PI); cW -= s; } 
      else if (i === 3) { ctx.arc(sqX + s, sqY, s, 0.5 * Math.PI, Math.PI); cH -= s; }
      ctx.stroke();
    }
  } else if (mode === "diagonales") {
    const state = transformIdx % 4;
    const marca45 = (cx, cy) => { ctx.beginPath(); ctx.arc(cx, cy, 15, 0, 6.3); ctx.stroke(); };

    if (state === 0) line(x + w, y, x, y + h);
    else if (state === 1) {
      if (w > h) { line(x, y, x + h, y + h); marca45(x, y); line(x + w, y + h, x + w - h, y); marca45(x + w, y + h); } 
      else { line(x, y, x + w, y + w); marca45(x, y); line(x + w, y + h, x, y + h - w); marca45(x + w, y + h); }
    } else if (state === 2) line(x, y, x + w, y + h);
    else if (state === 3) {
      if (w > h) { line(x + w, y, x + w - h, y + h); marca45(x + w, y); line(x, y + h, x + h, y); marca45(x, y + h); } 
      else { line(x + w, y, x, y + w); marca45(x + w, y); line(x, y + h, x + w, y + h - w); marca45(x, y + h); }
    }
  } else if (mode === "fuga") {
    const fx = x + w * fugaX, fy = y + h * fugaY;
    ctx.setLineDash([5, 5]); line(x, fy, x + w, fy); line(fx, y, fx, y + h); ctx.setLineDash([]);
    line(x, y, fx, fy); line(x + w, y, fx, fy); line(x, y + h, fx, fy); line(x + w, y + h, fx, fy);
    
    const elapsed = time - pulseStartTime;
    if (elapsed < 1000) {
      const pulse = Math.abs(Math.sin(elapsed / 200));
      ctx.beginPath(); ctx.arc(fx, fy, 5 + pulse * 10, 0, 7);
      ctx.strokeStyle = colors[cIdx]; ctx.globalAlpha = 1 - pulse; ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = colors[cIdx]; ctx.beginPath(); ctx.arc(fx, fy, 5, 0, 7); ctx.fill();
  } else if (mode === "horizonte") {
    const numLineas = 10;
    ctx.setLineDash([]); ctx.globalAlpha = 0.8;
    if (horMode === "H") {
      const hy = y + h * horY; ctx.lineWidth = 2.5; line(x, hy, x + w, hy);
      for (let i = 1; i <= numLineas; i++) {
        const offset = Math.pow(i / numLineas, 2.0), ySuelo = hy + (y + h - hy) * offset;
        ctx.lineWidth = 1.5 * (1 - offset + 0.2); line(x, ySuelo, x + w, ySuelo);
      }
    } else {
      const vx = x + w * fugaX; ctx.lineWidth = 2.5; line(vx, y, vx, y + h);
      for (let i = 1; i <= numLineas; i++) {
        const offset = Math.pow(i / numLineas, 2.0), xPared = vx - (vx - x) * offset;
        ctx.lineWidth = 1.5 * (1 - offset + 0.2); line(xPared, y, xPared, y + h);
      }
    }
    ctx.globalAlpha = 1.0;
  } else if (mode === "reframe") {
    const x1 = Math.round(x + w * frameX1), y1 = Math.round(y + h * frameY1);
    const x2 = Math.round(x + w * frameX2), y2 = Math.round(y + h * frameY2);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(x, y, w, y1 - y); ctx.fillRect(x, y1, x1 - x, y2 - y1);
    ctx.fillRect(x2, y1, x + w - x2, y2 - y1); ctx.fillRect(x, y2, w, y + h - y2);
    
    const s = 16;
    ctx.strokeStyle = colors[cIdx]; ctx.lineWidth = 1;
    line(x1 - s, y1, x1 + s, y1); line(x1, y1 - s, x1, y1 + s);
    line(x2 + s, y2, x2 - s, y2); line(x2, y2 + s, x2, y2 - s);
  }
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* ==========================================================================
   ### EVENTOS Y MENÚS DE INTERFAZ ###
   ========================================================================== */

document.getElementById("action-local").onclick = () => { toggleFullScreen(); fileInput.click(); };
document.getElementById("action-museum").onclick = loadMuseumArt;
document.getElementById("action-photo").onclick = loadRandomPhoto;

btnChange.onclick = () => {
  splash.style.display = "flex";
  topUI.style.display = "none";
  controls.style.display = "none";
};

const gridMenu = document.getElementById("grid-menu");

function buildGridMenu() {
  gridMenu.innerHTML = "";
  gridLabels.forEach((label, index) => {
    const item = document.createElement("div");
    item.className = `grid-menu-item ${index === gIdx ? "active" : ""}`;
    item.innerText = label;
    item.onclick = (e) => {
      e.stopPropagation();
      setGrid(index);
      gridMenu.style.display = "none";
    };
    gridMenu.appendChild(item);
  });
}

function setGrid(index) {
  gIdx = index;
  btnGrid.firstChild.textContent = gridLabels[gIdx] + " ";
  transformIdx = 0;
  if (grids[gIdx] === "fuga") pulseStartTime = performance.now();
  if (grids[gIdx] === "reframe") initFrameCompL();
  if (grids[gIdx] === "paleta") paletteDirty = true;
  
  const noTransform = ["fuga", "focus", "reframe"].includes(grids[gIdx]);
  btnTransform.style.opacity = noTransform ? "0.5" : "1";
  btnTransform.style.pointerEvents = noTransform ? "none" : "auto";
  buildGridMenu();
}

buildGridMenu();

btnGrid.onclick = (e) => {
  e.stopPropagation();
  buildGridMenu();
  gridMenu.style.display = (gridMenu.style.display === "block") ? "none" : "block";
};

document.addEventListener("click", (e) => {
  if (!btnGrid.contains(e.target)) gridMenu.style.display = "none";
});

btnTransform.onclick = () => {
  if (grids[gIdx] === "masas") {
    mInvert = !mInvert;
  } else if (grids[gIdx] === "horizonte") {
    horMode = horMode === "H" ? "V" : "H";
  } else if (["fuga", "reframe", "focus"].includes(grids[gIdx])) {
    transformIdx = 0;
  } else if (grids[gIdx] === "paleta") {
    paletteDirty = true;
    generatePalette();
    transformIdx = 0;
  } else {
    transformIdx = (transformIdx + 1) % 4;
  }
};

document.getElementById("btn-color").onclick = () => {
  cIdx = (cIdx + 1) % colors.length;
  document.getElementById("color-dot").style.backgroundColor = colors[cIdx];
};

const btnReset = document.getElementById("btn-reset");
btnReset.onmousedown = btnReset.ontouchstart = (e) => {
  isBypass = true;
  if (e.cancelable) e.preventDefault();
};

btnReset.onmouseup = btnReset.ontouchend = () => {
  toggleFullScreen();
  isBypass = false;
  centerImage();
};

/* ==========================================================================
   ### LISTENERS DE INTERACCIÓN (TOUCH Y MOUSE) ###
   ========================================================================== */

canvas.addEventListener("touchstart", handleStart, { passive: false });
canvas.addEventListener("touchmove", handleMove, { passive: false });
canvas.addEventListener("touchend", () => (isDragging = false));
canvas.addEventListener("mousedown", handleStart);
window.addEventListener("mousemove", handleMove);
window.addEventListener("mouseup", () => (isDragging = false));