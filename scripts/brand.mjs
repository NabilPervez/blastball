// Blastball brand artwork as code, so every icon and splash is generated from one design.

export const COLORS = { base: '#0B0B0F', surface: '#16161D', orange: '#FF7A1A', ember: '#FFC93C', text: '#F2F2F5', muted: '#9A9AA8' };

/**
 * The app icon: an ember-lit ball with seams and a spark.
 * - rounded: rounded-square badge (favicons, "any" icons)
 * - maskable: full-bleed background, artwork kept inside the 80% safe zone
 * - mono: single-colour silhouette on transparent (for monochrome / themed icons)
 */
export function iconSvg({ rounded = true, maskable = false, mono = false } = {}) {
  const scale = maskable ? 0.82 : 1;
  const t = (256 * (1 - scale)).toFixed(2);
  const bg = mono
    ? ''
    : `<defs>
        <radialGradient id="glow" cx="50%" cy="46%" r="60%">
          <stop offset="0" stop-color="#3a1a07"/><stop offset="0.55" stop-color="#1a0f0a"/><stop offset="1" stop-color="${COLORS.base}"/>
        </radialGradient>
        <radialGradient id="ball" cx="38%" cy="32%" r="75%">
          <stop offset="0" stop-color="#FFC27A"/><stop offset="0.45" stop-color="${COLORS.orange}"/><stop offset="1" stop-color="#C9480A"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" ${rounded && !maskable ? 'rx="112"' : ''} fill="url(#glow)"/>`;
  const ballFill = mono ? '#FFFFFF' : 'url(#ball)';
  const seam = mono ? 'black' : COLORS.base;
  const spark = mono ? '#FFFFFF' : COLORS.ember;
  // In mono mode, seams are cut out with a mask so the silhouette stays one colour.
  const seams = `<path d="M178 132 C 238 196, 238 316, 178 380" fill="none" stroke="${seam}" stroke-width="16" stroke-linecap="round"/>
      <path d="M334 132 C 274 196, 274 316, 334 380" fill="none" stroke="${seam}" stroke-width="16" stroke-linecap="round"/>`;
  const art = mono
    ? `<defs><mask id="m"><rect width="512" height="512" fill="black"/><circle cx="256" cy="256" r="150" fill="white"/>${seams}</mask></defs>
       <rect width="512" height="512" fill="${ballFill}" mask="url(#m)"/>`
    : `<circle cx="256" cy="262" r="150" fill="#000" opacity="0.35"/>
       <circle cx="256" cy="256" r="150" fill="${ballFill}"/>
       ${seams}
       <ellipse cx="212" cy="196" rx="58" ry="34" fill="#fff" opacity="0.22" transform="rotate(-28 212 196)"/>`;
  const sparkPath = `<path d="M352 118 L362 146 L390 156 L362 166 L352 194 L342 166 L314 156 L342 146 Z" fill="${spark}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    ${bg}
    <g transform="translate(${t} ${t}) scale(${scale})">${art}${sparkPath}</g>
  </svg>`;
}

/** A small glyph icon for app shortcuts (Today / Games / Vote / History). */
export function shortcutSvg(glyph) {
  const glyphs = {
    today: `<circle cx="48" cy="48" r="18" fill="none" stroke="${COLORS.orange}" stroke-width="7"/><circle cx="48" cy="48" r="7" fill="${COLORS.orange}"/>`,
    games: `<path d="M48 22 L74 48 L48 74 L22 48 Z" fill="none" stroke="${COLORS.orange}" stroke-width="7" stroke-linejoin="round"/><circle cx="48" cy="48" r="7" fill="${COLORS.ember}"/>`,
    vote: `<path d="M48 18 L56 40 L78 48 L56 56 L48 78 L40 56 L18 48 L40 40 Z" fill="${COLORS.ember}"/>`,
    history: `<path d="M30 22 H66 M30 74 H66 M34 22 C34 44, 62 52, 62 74 M62 22 C62 44, 34 52, 34 74" fill="none" stroke="${COLORS.orange}" stroke-width="7" stroke-linecap="round"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <rect width="96" height="96" rx="22" fill="${COLORS.surface}"/>${glyphs[glyph]}</svg>`;
}

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=Inter:wght@400;600&display=block" rel="stylesheet">`;

const page = (w, h, body, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${COLORS.base};color:${COLORS.text};font-family:Inter,system-ui,sans-serif}
  .word{font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:.02em;line-height:.9}
  .word span{color:${COLORS.orange}}
  .glow{position:absolute;inset:0;background:radial-gradient(60% 45% at 50% 42%, rgba(255,122,26,.22), transparent 70%)}
  ${extraCss}
</style></head><body>${body}</body></html>`;

/** iOS launch screen: icon, wordmark and tagline, centred. Sizes are in CSS pixels. */
export function splashHtml(w, h) {
  const icon = Math.round(Math.min(w, h) * 0.34);
  const word = Math.round(Math.min(w, h) * 0.13);
  return page(
    w,
    h,
    `<div class="glow"></div>
     <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(word * 0.35)}px">
       <div style="width:${icon}px;height:${icon}px">${iconSvg({ rounded: false, maskable: true }).replace('width="512" height="512"', `width="${icon}" height="${icon}"`).replace('<rect width="512" height="512"  fill="url(#glow)"/>', '')}</div>
       <div class="word" style="font-size:${word}px">BLAST<span>BALL</span></div>
       <div style="color:${COLORS.muted};font-size:${Math.round(word * 0.26)}px;letter-spacing:.04em">The league that plays itself</div>
     </div>`,
  );
}

/** Social share card (Open Graph / Twitter), 1200×630. */
export function ogHtml() {
  return page(
    1200,
    630,
    `<div class="glow" style="background:radial-gradient(50% 70% at 22% 50%, rgba(255,122,26,.25), transparent 70%)"></div>
     <div style="position:absolute;inset:0;display:flex;align-items:center;gap:56px;padding:0 90px">
       <div style="width:300px;height:300px;flex:none">${iconSvg({ rounded: true }).replace('width="512" height="512"', 'width="300" height="300"')}</div>
       <div>
         <div class="word" style="font-size:132px">BLAST<span>BALL</span></div>
         <div style="font-size:38px;margin-top:18px;font-weight:600">A strange sports league that plays itself.</div>
         <div style="font-size:28px;margin-top:14px;color:${COLORS.muted}">Watch · Bet · Vote · Bend reality. Free, offline, in your browser.</div>
       </div>
     </div>`,
  );
}

/**
 * iOS devices that need their own launch image (portrait). width/height in CSS px.
 * Covers every iPhone and iPad still receiving iOS updates, plus common older sizes.
 */
export const SPLASH_DEVICES = [
  { name: 'iphone-16-pro-max', w: 440, h: 956, dpr: 3 },
  { name: 'iphone-16-pro', w: 402, h: 874, dpr: 3 },
  { name: 'iphone-15-pro-max', w: 430, h: 932, dpr: 3 },
  { name: 'iphone-15-pro', w: 393, h: 852, dpr: 3 },
  { name: 'iphone-14-plus', w: 428, h: 926, dpr: 3 },
  { name: 'iphone-14', w: 390, h: 844, dpr: 3 },
  { name: 'iphone-13-mini', w: 375, h: 812, dpr: 3 },
  { name: 'iphone-11-pro-max', w: 414, h: 896, dpr: 3 },
  { name: 'iphone-11', w: 414, h: 896, dpr: 2 },
  { name: 'iphone-8-plus', w: 414, h: 736, dpr: 3 },
  { name: 'iphone-se', w: 375, h: 667, dpr: 2 },
  { name: 'iphone-se-1', w: 320, h: 568, dpr: 2 },
  { name: 'ipad-pro-13', w: 1032, h: 1376, dpr: 2 },
  { name: 'ipad-pro-12-9', w: 1024, h: 1366, dpr: 2 },
  { name: 'ipad-pro-11', w: 834, h: 1194, dpr: 2 },
  { name: 'ipad-air', w: 820, h: 1180, dpr: 2 },
  { name: 'ipad-10-2', w: 810, h: 1080, dpr: 2 },
  { name: 'ipad-mini', w: 744, h: 1133, dpr: 2 },
  { name: 'ipad-9-7', w: 768, h: 1024, dpr: 2 },
];
