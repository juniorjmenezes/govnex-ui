#!/usr/bin/env node
/**
 * Verifica o contraste WCAG 2.x dos pares de tokens de `src/styles.css` nos
 * temas claro (`:root`) e escuro (`.dark`). Falha (exit 1) se algum par
 * ficar abaixo de 4,5:1 (texto normal, nível AA).
 *
 * Uso: `npm run contrast:check`.
 *
 * Os pares cobrem o texto sobre as superfícies, os tokens semânticos
 * (sólido com `-foreground`, texto sobre `-soft`, texto sobre card/fundo), o
 * destaque de fallback e o item ativo da sidebar. Como o destaque é
 * sobrescrito em tempo de execução por produto/gabinete, também são testadas
 * cores de exemplo (`SAMPLE_ACCENTS`) com a mesma regra de texto legível que
 * os consumidores aplicam (preto ou branco pela luminância).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_RATIO = 4.5;
const SAMPLE_ACCENTS = [
    '#2563EB',
    '#16A34A',
    '#7C3AED',
    '#DC2626',
    '#0F766E',
    '#EAB308',
    '#F97316',
    '#06B6D4',
];

const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/styles.css'),
    'utf8',
);

function block(selector) {
    const start = css.indexOf(`${selector} {`);

    if (start < 0) {
        throw new Error(`Bloco ${selector} não encontrado`);
    }

    const body = css.slice(
        css.indexOf('{', start) + 1,
        css.indexOf('\n}', start),
    );
    const tokens = {};

    for (const match of body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .matchAll(/--([\w-]+):\s*([^;]+);/g)) {
        tokens[match[1]] = match[2].trim().replace(/\s+/g, ' ');
    }

    return tokens;
}

const light = block(':root');
const themes = { claro: light, escuro: { ...light, ...block('.dark') } };

// ---- conversão de cor ------------------------------------------------------

const toLinear = (c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const toGamma = (c) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const clamp = (v) => Math.min(1, Math.max(0, v));

function oklchToSrgb([l, c, h]) {
    const rad = (h * Math.PI) / 180;
    const a = c * Math.cos(rad);
    const b = c * Math.sin(rad);
    const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

    return [
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ].map((v) => clamp(toGamma(v)));
}

function srgbToOklch(rgb) {
    const [r, g, b] = rgb.map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

    return [
        L,
        Math.hypot(A, B),
        ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
    ];
}

/** Resolve um valor de token para { rgb: [0..1]x3, alpha }. */
function parse(value, tokens, depth = 0) {
    if (depth > 10) {
        throw new Error(`Referência circular em ${value}`);
    }

    const ref = value.match(/^var\(--([\w-]+)\)$/);

    if (ref) {
        return parse(tokens[ref[1]], tokens, depth + 1);
    }

    const hex = value.match(/^#([0-9a-f]{6})$/i);

    if (hex) {
        return {
            rgb: hex[1].match(/.{2}/g).map((p) => parseInt(p, 16) / 255),
            alpha: 1,
        };
    }

    const oklch = value.match(
        /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/,
    );

    if (oklch) {
        const alpha =
            oklch[4] === undefined
                ? 1
                : Number(oklch[4]) / (oklch[5] === '%' ? 100 : 1);

        return {
            rgb: oklchToSrgb([
                Number(oklch[1]),
                Number(oklch[2]),
                Number(oklch[3]),
            ]),
            alpha,
        };
    }

    throw new Error(`Cor não suportada: ${value}`);
}

/** Composição alfa (em sRGB, como o navegador) de `top` sobre `bottom`. */
function over(top, bottom, alpha = top.alpha) {
    return {
        rgb: top.rgb.map((c, i) => c * alpha + bottom.rgb[i] * (1 - alpha)),
        alpha: 1,
    };
}

/**
 * `color-mix(in oklab, a p, b)`. Em oklab não há interpolação de matiz, então
 * misturar com um cinza quente não "passa" por outras cores (em oklch, azul +
 * cinza de matiz 49 atravessava o magenta).
 */
function mixOklab(a, b, p) {
    const toLab = ([l, c, h]) => [
        l,
        c * Math.cos((h * Math.PI) / 180),
        c * Math.sin((h * Math.PI) / 180),
    ];
    const [l1, a1, b1] = toLab(srgbToOklch(a.rgb));
    const [l2, a2, b2] = toLab(srgbToOklch(b.rgb));
    const L = l1 * p + l2 * (1 - p);
    const A = a1 * p + a2 * (1 - p);
    const B = b1 * p + b2 * (1 - p);

    return {
        rgb: oklchToSrgb([
            L,
            Math.hypot(A, B),
            ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
        ]),
        alpha: 1,
    };
}

function luminance({ rgb }) {
    const [r, g, b] = rgb.map(toLinear);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
}

/**
 * Texto legível sobre o destaque: preto ou branco, o que der mais contraste
 * (mesma regra do `OfficeTheme` do GAB).
 */
function readableOn(color) {
    const dark = parse('#111111', {});
    const white = parse('#ffffff', {});

    return ratio(dark, color) >= ratio(white, color) ? dark : white;
}

// ---- pares -----------------------------------------------------------------

const semantic = ['destructive', 'success', 'warning', 'info'];
const failures = [];
const rows = [];

for (const [theme, tokens] of Object.entries(themes)) {
    const t = (name) => parse(`var(--${name})`, tokens);
    const check = (label, fg, bg) => {
        const value = ratio(fg, bg);
        const ok = value >= MIN_RATIO;
        rows.push({
            tema: theme,
            par: label,
            contraste: value.toFixed(2),
            ok: ok ? 'ok' : 'FALHA',
        });

        if (!ok) {
            failures.push(`${theme}: ${label} = ${value.toFixed(2)}`);
        }
    };
    const pair = (fg, bg) => check(`${fg} / ${bg}`, t(fg), t(bg));

    pair('foreground', 'background');
    pair('card-foreground', 'card');
    pair('popover-foreground', 'popover');
    pair('muted-foreground', 'background');
    pair('muted-foreground', 'card');
    pair('muted-foreground', 'muted');
    pair('secondary-foreground', 'secondary');
    pair('accent-foreground', 'accent');
    pair('primary-foreground', 'primary');
    pair('sidebar-foreground', 'sidebar');
    pair('sidebar-accent-foreground', 'sidebar-accent');

    for (const name of semantic) {
        pair(`${name}-foreground`, name);
        pair(name, `${name}-soft`);
        pair(name, 'card');
        pair(name, 'background');
    }

    // Rótulo de grupo da sidebar: `text-sidebar-foreground/70`.
    check(
        'sidebar-foreground/70 / sidebar',
        over(t('sidebar-foreground'), t('sidebar'), 0.7),
        t('sidebar'),
    );

    // Item ativo da sidebar: texto = mistura 50/50 (oklab) do destaque com o
    // texto da sidebar; fundo = destaque a 10% sobre a sidebar. Vale para o destaque
    // de fallback e para as cores de exemplo de gabinete.
    const accents = [
        ['sidebar-primary (fallback)', t('sidebar-primary')],
        ...SAMPLE_ACCENTS.map((hex) => [hex, parse(hex, {})]),
    ];

    for (const [label, accent] of accents) {
        const text = mixOklab(accent, t('sidebar-foreground'), 0.5);
        const bg = over(accent, t('sidebar'), 0.1);
        check(`sidebar ativo ${label}`, text, bg);
    }

    for (const hex of SAMPLE_ACCENTS) {
        const accent = parse(hex, {});
        check(`${hex} / texto legível`, readableOn(accent), accent);
    }
}

console.table(rows);

if (failures.length > 0) {
    console.error(
        `\n${failures.length} par(es) abaixo de ${MIN_RATIO}:1:\n- ${failures.join('\n- ')}`,
    );
    process.exit(1);
}

console.log(`\nTodos os pares ≥ ${MIN_RATIO}:1 nos dois temas.`);
