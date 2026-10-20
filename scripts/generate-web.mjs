// OJO: este archivo existe en DOS repos y tiene que ser idéntico:
//   - activa-vgg/scripts/generate-web.mjs (el original, se corre a mano)
//   - activa-local-web/scripts/generate-web.mjs (lo corre GitHub Actions cada hora, .github/workflows/refresh-negocios.yml)
// Si lo cambiás en uno, copialo al otro.
// Generates the public, static business pages published to GitHub Pages
// from the separate josiasbongiovanni-cmd/activa-local-web repo (kept public
// and apart from this one, which stays private). No server, no CI — run
// manually whenever business data should be refreshed:
//   git clone https://github.com/josiasbongiovanni-cmd/activa-local-web.git ../activa-local-web
//   npm run generate:web
//   cd ../activa-local-web && git add -A && git commit -m "Refresh" && git push
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  // En tu Mac se lee .env.local; en GitHub Actions (repo de la web) vienen de las variables de entorno.
  const envPath = join(__dirname, '..', '.env.local');
  if (!existsSync(envPath)) {
    return {
      EXPO_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    };
  }
  const text = readFileSync(envPath, 'utf8');
  const vars = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

const outDir = process.argv[2];
if (!outDir) {
  console.error('Uso: node scripts/generate-web.mjs <ruta al checkout de activa-local-web>');
  process.exit(1);
}

const env = loadEnvLocal();
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function waLink(phone, text) {
  const digits = String(phone ?? '').replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function page({ title, description, bodyHtml }) {
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<style>
  :root { --brand: #2E5CFF; --ink: #171A24; --muted: #787D8C; --line: #E9EBF3; --bg: #F4F5FA; --panel: #FFFFFF; --green: #1FAE6E; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 48px; }
  a { color: inherit; text-decoration: none; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
  .logo { width: 72px; height: 72px; border-radius: 18px; object-fit: cover; background: var(--line); }
  .header { display: flex; align-items: center; gap: 14px; }
  h1 { font-size: 20px; margin: 0; }
  .cat { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .desc { font-size: 14px; line-height: 1.5; color: var(--ink); margin-top: 6px; }
  .meta-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); margin-top: 6px; }
  .btn { display: block; text-align: center; padding: 13px; border-radius: 12px; font-weight: 600; font-size: 14px; margin-top: 8px; }
  .btn-green { background: var(--green); color: #fff; }
  .btn-brand { background: var(--brand); color: #fff; }
  .btn-outline { background: #fff; border: 1.5px solid var(--brand); color: var(--brand); }
  .product { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
  .product:last-child { border-bottom: none; }
  .price { font-weight: 600; color: var(--muted); }
  .footer { text-align: center; font-size: 12px; color: var(--muted); margin-top: 24px; }
  .footer a { color: var(--brand); font-weight: 600; }
</style>
</head>
<body>
<div class="wrap">
${bodyHtml}
<p class="footer">Powered by <a href="https://github.com/josiasbongiovanni-cmd/activa-local-web">Activa Local</a></p>
</div>
</body>
</html>`;
}

function businessPage(biz, products) {
  const whatsapp = biz.phone
    ? `<a class="btn btn-green" href="${waLink(biz.phone, `Hola, te escribo desde tu página de Activa Local.`)}">Escribir por WhatsApp</a>`
    : '';
  const productsHtml = products.length
    ? `<div class="card"><strong>Catálogo</strong>${products
        .slice(0, 12)
        .map((p) => `<div class="product" id="p-${esc(p.id)}"><span>${esc(p.name)}</span><span class="price">${p.price > 0 ? formatARS(p.price) : 'Consultar'}</span></div>`)
        .join('')}</div>`
    : '';
  const body = `
<div class="card">
  <div class="header">
    ${biz.logo_url ? `<img class="logo" src="${esc(biz.logo_url)}" alt="${esc(biz.name)}" />` : `<div class="logo" style="display:flex;align-items:center;justify-content:center;font-size:28px;">${esc(biz.emoji ?? '🏪')}</div>`}
    <div>
      <h1>${esc(biz.name)}</h1>
      <div class="cat">${esc(biz.cat)} · ${esc(biz.city)}</div>
    </div>
  </div>
  ${biz.description ? `<p class="desc">${esc(biz.description)}</p>` : ''}
  ${biz.hours && biz.hours !== '—' ? `<div class="meta-row">🕒 ${esc(biz.hours)}</div>` : ''}
  ${biz.address ? `<div class="meta-row">📍 ${esc(biz.address)}</div>` : ''}
</div>
${productsHtml}
${whatsapp}
<a class="btn btn-brand" href="activavgg://cliente/negocio/${biz.id}">Ver en la app Activa Local</a>
`;
  return page({ title: `${biz.name} · Activa Local`, description: biz.description || `${biz.name} en ${biz.city} — Activa Local`, bodyHtml: body });
}

function indexPage(businesses) {
  const byCity = new Map();
  for (const b of businesses) {
    if (!byCity.has(b.city)) byCity.set(b.city, []);
    byCity.get(b.city).push(b);
  }
  const sections = [...byCity.entries()]
    .map(
      ([city, list]) => `
<div class="card">
  <strong>${esc(city)}</strong>
  ${list
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => `<div class="product"><a href="negocio/${b.id}/">${esc(b.name)}</a><span class="price">${esc(b.cat)}</span></div>`)
    .join('')}
</div>`
    )
    .join('');
  const body = `
<div class="card">
  <h1>Activa Local</h1>
  <p class="desc">Negocios y servicios de tu ciudad, todos en un solo lugar.</p>
  <a class="btn btn-outline" href="activavgg://">Abrir la app</a>
</div>
${sections}
`;
  return page({ title: 'Activa Local — Negocios de tu ciudad', description: 'Directorio de negocios locales de Activa Local.', bodyHtml: body });
}

// ---- Centro de Ayuda público (/ayuda) ------------------------------------------------------------
// Sale del mismo archivo que usa la app (src/config/help-articles.json), así que se edita en un solo
// lugar. Es la URL de soporte para las tiendas y sirve también como página de eliminación de cuenta
// (ver el artículo #quiero-eliminar-mi-cuenta).
function helpPage() {
  const data = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'config', 'help-articles.json'), 'utf8'));
  const support = readFileSync(join(__dirname, '..', 'src', 'config', 'support.ts'), 'utf8');
  const hours = (support.match(/SUPPORT_HOURS:[^=]*=\s*'([^']*)'/) ?? [])[1] ?? '';
  const email = (support.match(/SUPPORT_EMAIL\s*=\s*'([^']*)'/) ?? [])[1] ?? 'admin.activavgg@gmail.com';
  const phone = (support.match(/SUPPORT_WHATSAPP_NUMBER\s*=\s*'([^']*)'/) ?? [])[1] ?? '5493417381220';

  const byId = new Map(data.articles.map((a) => [a.id, a]));
  const articleHtml = (a) => `
<details class="art" id="${esc(a.id)}" data-role="${esc(a.role)}" data-text="${esc([a.title, a.answer, ...a.steps, a.note, ...a.keywords].join(' '))}">
  <summary>${esc(a.title)}</summary>
  <p class="lead">${esc(a.answer)}</p>
  <ol>${a.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>
  ${a.note ? `<p class="note"><strong>Si no se resuelve:</strong> ${esc(a.note)}</p>` : ''}
  ${a.related.length ? `<p class="rel">Te puede interesar: ${a.related.filter((r) => byId.has(r)).map((r) => `<a href="#${esc(r)}">${esc(byId.get(r).title)}</a>`).join(' · ')}</p>` : ''}
</details>`;

  const sections = data.categories
    .map((c) => `
<section class="cat" data-role="${esc(c.role)}">
  <h2>${esc(c.title)}</h2>
  ${data.articles.filter((a) => a.category === c.id).map(articleHtml).join('')}
</section>`)
    .join('');

  const wa = `https://wa.me/${phone}?text=${encodeURIComponent('Hola, necesito ayuda con Activa Local.')}`;
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ayuda — Activa Local</title>
<meta name="description" content="Centro de Ayuda de Activa Local: cuenta y acceso, pedidos, envíos, plan y pagos." />
<style>
  :root { --brand: #2E5CFF; --ink: #171A24; --muted: #787D8C; --bg: #F4F5FA; --panel: #FFFFFF; --line: #E9EBF3; --green: #1FAE6E; --amberbg: #FFE7DA; --amberink: #B84B1A; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.55; }
  header { background: linear-gradient(135deg, #FF7A3D, #7B4FE0 55%, #2E5CFF); color: #fff; padding: 32px 20px; }
  header div, main { max-width: 760px; margin: 0 auto; }
  header h1 { margin: 0; font-size: 26px; } header p { margin: 6px 0 0; opacity: .9; font-size: 14px; }
  main { padding: 20px 20px 56px; }
  .tools { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
  input[type=search] { width: 100%; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; font-size: 15px; background: #fff; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .chip { border: 1px solid var(--line); background: #fff; padding: 7px 14px; border-radius: 999px; font-size: 13px; cursor: pointer; color: var(--ink); }
  .chip.on { background: var(--brand); border-color: var(--brand); color: #fff; }
  h2 { font-size: 16px; margin: 22px 0 8px; }
  .art { background: var(--panel); border-radius: 14px; padding: 12px 16px; margin-bottom: 8px; }
  .art summary { cursor: pointer; font-weight: 600; font-size: 15px; }
  .art .lead { margin: 10px 0 6px; font-size: 14.5px; }
  .art ol { margin: 6px 0 10px 20px; padding: 0; font-size: 14px; } .art li { margin-bottom: 4px; }
  .note { background: var(--amberbg); color: var(--amberink); padding: 10px 12px; border-radius: 10px; font-size: 13.5px; margin: 8px 0; }
  .rel { font-size: 13px; color: var(--muted); margin: 8px 0 2px; } .rel a { color: var(--brand); }
  .art:target { outline: 2px solid var(--brand); }
  .empty { display: none; text-align: center; color: var(--muted); padding: 24px 0; }
  .contact { background: var(--panel); border-radius: 14px; padding: 18px; margin-top: 24px; text-align: center; }
  .contact a.btn { display: inline-block; background: var(--green); color: #fff; padding: 12px 22px; border-radius: 12px; font-weight: 700; text-decoration: none; margin: 8px 0; }
  .contact p { margin: 4px 0; font-size: 13.5px; color: var(--muted); } .contact p a { color: var(--brand); }
  .hidden { display: none !important; }
</style>
</head>
<body>
<header><div><h1>Centro de Ayuda</h1><p>Activa Local</p></div></header>
<main>
  <div class="tools">
    <input id="q" type="search" placeholder="Buscá tu duda: contraseña, pedido, envío…" autocomplete="off" />
    <div class="chips">
      <button class="chip on" data-aud="todos">Todo</button>
      <button class="chip" data-aud="comercio">Tengo un negocio</button>
      <button class="chip" data-aud="vecino">Soy vecino</button>
    </div>
  </div>
  ${sections}
  <p class="empty" id="empty">No encontramos nada con eso. Probá con otras palabras o escribinos.</p>
  <div class="contact">
    <strong>¿Seguís con dudas?</strong>
    <p><a class="btn" href="${esc(wa)}">Hablar con una persona</a></p>
    ${hours ? `<p>Horario de atención: ${esc(hours)}</p>` : ''}
    <p>Correo: <a href="mailto:${esc(email)}">${esc(email)}</a></p>
    <p>Nunca te vamos a pedir tu contraseña ni códigos por WhatsApp.</p>
  </div>
</main>
<script>
  var norm = function (t) { return t.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ\\s]/g, ' ').replace(/\\s+/g, ' ').trim(); };
  var aud = 'todos', q = document.getElementById('q');
  function apply() {
    var tokens = norm(q.value).split(' ').filter(Boolean), shown = 0;
    document.querySelectorAll('.art').forEach(function (el) {
      var roleOk = aud === 'todos' || el.dataset.role === 'todos' || el.dataset.role === aud;
      var text = norm(el.dataset.text), textOk = tokens.every(function (t) { return text.indexOf(t) !== -1; });
      var ok = roleOk && textOk; el.classList.toggle('hidden', !ok); if (ok) shown++;
    });
    document.querySelectorAll('.cat').forEach(function (c) { c.classList.toggle('hidden', !c.querySelector('.art:not(.hidden)')); });
    document.getElementById('empty').style.display = shown ? 'none' : 'block';
  }
  q.addEventListener('input', apply);
  document.querySelectorAll('.chip').forEach(function (b) {
    b.addEventListener('click', function () {
      aud = b.dataset.aud;
      document.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('on', x === b); });
      apply();
    });
  });
  if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t && t.tagName === 'DETAILS') t.open = true; }
  window.addEventListener('hashchange', function () { var t = document.getElementById(location.hash.slice(1)); if (t && t.tagName === 'DETAILS') t.open = true; });
</script>
</body>
</html>`;
}

async function main() {
  // npm run generate:web -- --only-help   →  solo regenera /ayuda (no toca las páginas de negocios)
  const helpSource = join(__dirname, '..', 'src', 'config', 'help-articles.json');
  const withHelp = existsSync(helpSource) && !process.argv.includes('--businesses-only');
  if (process.argv.includes('--only-help')) {
    mkdirSync(join(outDir, 'ayuda'), { recursive: true });
    writeFileSync(join(outDir, 'ayuda', 'index.html'), helpPage());
    console.log(`Página de ayuda generada en ${join(outDir, 'ayuda')}`);
    return;
  }
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*, products(*)')
    .eq('status', 'activo')
    .eq('is_deleted', false);
  if (error) {
    console.error('Error al leer negocios:', error.message);
    process.exit(1);
  }

  if (!businesses || businesses.length === 0) {
    console.error('La base no devolvió ningún negocio activo: se frena sin tocar nada.');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), indexPage(businesses));
  writeFileSync(join(outDir, '.nojekyll'), '');

  for (const biz of businesses) {
    const bizDir = join(outDir, 'negocio', biz.id);
    mkdirSync(bizDir, { recursive: true });
    writeFileSync(join(bizDir, 'index.html'), businessPage(biz, [...(biz.products ?? [])].sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9))));
  }

  // Se borran las páginas de negocios que ya no están activos (eliminados o suspendidos): si no,
  // seguirían públicas aunque el negocio ya no exista en la app.
  const activeIds = new Set(businesses.map((b) => b.id));
  const negociosDir = join(outDir, 'negocio');
  let removed = 0;
  if (existsSync(negociosDir)) {
    const stale = readdirSync(negociosDir).filter((dir) => !activeIds.has(dir));
    // Freno de seguridad: si de golpe habría que borrar muchas páginas, algo anda mal (por ejemplo, la base
    // devolvió una lista incompleta). No se borra nada y la ejecución falla.
    if (stale.length > 10 && !process.argv.includes('--allow-mass-delete')) {
      console.error(`Se iban a borrar ${stale.length} páginas de golpe: se frena por seguridad.`);
      process.exit(1);
    }
    for (const dir of stale) {
      rmSync(join(negociosDir, dir), { recursive: true, force: true });
      removed++;
    }
  }

  if (withHelp) {
    mkdirSync(join(outDir, 'ayuda'), { recursive: true });
    writeFileSync(join(outDir, 'ayuda', 'index.html'), helpPage());
  }
  console.log(`Generadas ${businesses.length} páginas de negocio (${removed} páginas de negocios inactivos borradas)${withHelp ? ' y la página de ayuda' : ''} en ${outDir}`);
}

main();
