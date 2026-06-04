// ================================================================
//  Mapa de preguntas parlamentarias
// ================================================================

let map, isCanariasView = false;
let popupData = [];
let popupIndex = 0;
let hoverPopup = null;
let clickPopup = null;
let activeTipo = 'ambos';
let puntosGeoJSON = null;
let hoveredMuniId = null;
let searchMuniHighlightId = null;
let selectedMuniId = null;

// Filtros activos
let partidosActivos = new Set();
let keywordsActivas = new Set();

// Drawer
let drawerPreguntas = [];
let drawerPreguntasBase = [];
const DRAWER_THRESHOLD = 3;

const USE_PMTILES    = false;
const HOVER_MIN_ZOOM = 7;

const CONFIG = {
  pmtilesFile:   'datos/municipios_preguntas.pmtiles',
  puntosFile:    'datos/puntos_preguntas.pmtiles',
  limitesFile:   'datos/limites_espana.pmtiles',
  geojsonMunis:  'datos/municipios_preguntas.geojson',
  geojsonPuntos: 'datos/puntos_preguntas.geojson',
  sourceLayerMuni:   'municipios_preguntas',
  sourceLayerPuntos: 'puntos_preguntas',
  searchZoom: 10.5,

  fields: {
    municipio:  'municipio',
    lugar:      'lugar',
    pregunta:   'pregunta',
    partido:    'partido',
    autores:    'autores',
    tipo:       'tipo',
    enlace:     'enlace',
    nPreguntas: 'n_preguntas',
    muniPadre:  'municipio_padre',
    id:         'id'
  },

  views: {
    peninsula: { center: [-3.7038, 40.4168], zoom: 5.5 },
    canarias:  { center: [-15.7, 28.3], zoom: 7 }
  },

  partidos: {
    'PP':       '#1e4a90',
    'PSOE':     '#f31912',
    'Vox':      '#66bc29',
    'Sumar':    '#e51c55',
    'ERC':      '#FFB232',
    'Junts':    '#00c3b2',
    'PNV':      '#499e37',
    'Bildu':    '#00c19f',
    'BNG':      '#6aade4',
    'UPN':      '#0033a0',
    'CC':       '#ffcb05',
    'Podemos':  '#9169f4',
    '_default': '#888888'
  }
};

// ============================================================
//  UTILIDADES
// ============================================================

function normalizar(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function colorPartido(p) {
  if (!p) return CONFIG.partidos._default;
  const key = Object.keys(CONFIG.partidos).find(
    k => k !== '_default' && p.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CONFIG.partidos[key] : CONFIG.partidos._default;
}

function colorPuntoExpression() {
  const expr = ['match', ['get', CONFIG.fields.partido]];
  for (const [nombre, color] of Object.entries(CONFIG.partidos)) {
    if (nombre === '_default') continue;
    expr.push(nombre, color);
  }
  expr.push(CONFIG.partidos._default);
  return expr;
}

function rampaMunicipios() {
  return [
    'case',
    ['any',
      ['!', ['has', CONFIG.fields.nPreguntas]],
      ['==', ['get', CONFIG.fields.nPreguntas], 0],
      ['==', ['get', CONFIG.fields.nPreguntas], null]
    ],
    '#f8f8f6',
    [
      'interpolate', ['linear'],
      ['to-number', ['get', CONFIG.fields.nPreguntas], 0],
      1,  '#c7e9c0',
      3,  '#a1d99b',
      5,  '#74c476',
      10, '#41ab5d',
      20, '#238b45',
      50, '#005a32'
    ]
  ];
}

function formatAutores(texto) {
  if (!texto) return '';
  const lista = texto.split(',').map(a => a.trim());
  if (lista.length <= 3) return lista.join(', ');
  return lista.slice(0, 3).join(', ') + ' (…)';
}

function interpolateGreen(t) {
  const stops = [
    [0,[199,233,192]],[0.2,[161,217,155]],[0.4,[116,196,118]],
    [0.6,[65,171,93]],[0.8,[35,139,69]],[1,[0,90,50]]
  ];
  let i = 0;
  while (i < stops.length - 1 && stops[i+1][0] < t) i++;
  const [t0,c0] = stops[i];
  const [t1,c1] = stops[Math.min(i+1, stops.length-1)];
  const f = t1===t0 ? 0 : (t-t0)/(t1-t0);
  return `rgb(${Math.round(c0[0]+(c1[0]-c0[0])*f)},${Math.round(c0[1]+(c1[1]-c0[1])*f)},${Math.round(c0[2]+(c1[2]-c0[2])*f)})`;
}

function contarPorMunicipio(featuresArray) {
  const conteo = {};
  featuresArray.forEach(f => {
    const muni = (f.properties[CONFIG.fields.muniPadre] || '').trim();
    if (muni) conteo[muni] = (conteo[muni] || 0) + 1;
  });
  return conteo;
}

function applyMuniFilterAndGradient(conteoPorMuni) {
  const muniNames = Object.keys(conteoPorMuni);
  if (!muniNames.length) {
    map.setFilter('capa-municipios', ['==', ['get', CONFIG.fields.municipio], '__ninguno__']);
    return;
  }
  map.setFilter('capa-municipios', ['in', ['get', CONFIG.fields.municipio], ['literal', muniNames]]);
  const maxCount = Math.max(...Object.values(conteoPorMuni), 1);
  const colorExpr = ['match', ['get', CONFIG.fields.municipio]];
  for (const [muni, count] of Object.entries(conteoPorMuni)) {
    colorExpr.push(muni, interpolateGreen(Math.min(count / Math.max(maxCount, 10), 1)));
  }
  colorExpr.push('#f8f8f6');
  map.setPaintProperty('capa-municipios', 'fill-color', colorExpr);
}

function featureRef(id) {
  return USE_PMTILES
    ? { source: 'src-municipios', sourceLayer: CONFIG.sourceLayerMuni, id }
    : { source: 'src-municipios', id };
}

// ============================================================
//  FILTROS COMBINADOS
// ============================================================

function featuresActivas() {
  if (!puntosGeoJSON) return [];
  let idsKeywords = null;
  if (keywordsActivas.size > 0) {
    idsKeywords = new Set();
    keywordsActivas.forEach(k => {
      (palabrasIndice[k] || []).forEach(id => idsKeywords.add(id));
    });
  }
  return puntosGeoJSON.features.filter(f => {
    const p = f.properties;
    if (partidosActivos.size > 0 && !partidosActivos.has(p[CONFIG.fields.partido])) return false;
    if (idsKeywords !== null && !idsKeywords.has(p[CONFIG.fields.id])) return false;
    return true;
  });
}

function applyFiltrosCombinados() {
  const activas   = featuresActivas();
  const hayFiltro = partidosActivos.size > 0 || keywordsActivas.size > 0;

  const baseFilter = ['!=', ['get', CONFIG.fields.tipo], 'municipio'];
  if (!hayFiltro) {
    map.setFilter('capa-puntos', baseFilter);
  } else {
    const ids = activas.map(f => f.properties[CONFIG.fields.id]).filter(v => v != null);
    map.setFilter('capa-puntos', ['all', baseFilter, ['in', ['get', CONFIG.fields.id], ['literal', ids]]]);
  }

  if (!hayFiltro) {
    map.setFilter('capa-municipios', null);
    map.setPaintProperty('capa-municipios', 'fill-color', rampaMunicipios());
  } else {
    applyMuniFilterAndGradient(contarPorMunicipio(activas));
  }

  document.querySelectorAll('.partido-btn').forEach(btn => {
    btn.classList.toggle('active', partidosActivos.has(btn.dataset.partido));
  });
  document.getElementById('btn-clear-partidos').classList.toggle('visible', partidosActivos.size > 0);
  actualizarChipsKeyword();

  // Si el drawer está abierto, refresca su lista con los nuevos filtros
  if (document.getElementById('drawer').classList.contains('open') && drawerPreguntasBase.length) {
    drawerPreguntas = filtrarPreguntas(drawerPreguntasBase);
    document.getElementById('drawer-muni-count').textContent = drawerPreguntas.length + ' preguntas';
    document.getElementById('drawer-partido-filter').value = 'todos';
    filtrarYRenderDrawer();
  }
}

function clearTodosFiltros() {
  partidosActivos.clear();
  keywordsActivas.clear();
  document.getElementById('search-pregunta').value = '';
  document.getElementById('search-municipio').value = '';
  if (searchMuniHighlightId !== null) {
    setHover(searchMuniHighlightId, false);
    searchMuniHighlightId = null;
  }
  applyFiltrosCombinados();
}


function preguntasDeMunicipioSinFiltro(muniName) {
  if (!puntosGeoJSON) return [];
  const raw = puntosGeoJSON.features
    .filter(f => (f.properties[CONFIG.fields.muniPadre] || '').trim() === muniName)
    .map(f => f.properties);
  const seen = new Set();
  return raw.filter(p => {
    const dup = seen.has(p[CONFIG.fields.id] || p[CONFIG.fields.pregunta]);
    seen.add(p[CONFIG.fields.id] || p[CONFIG.fields.pregunta]);
    return !dup;
  });
}

// ============================================================
//  POPUP
// ============================================================

function filtrarPreguntas(preguntas) {
  if (!puntosGeoJSON) return preguntas;
  const hayFiltro = partidosActivos.size > 0 || keywordsActivas.size > 0;
  if (!hayFiltro) return preguntas;
  const idsActivos = new Set(featuresActivas().map(f => f.properties[CONFIG.fields.id]));
  return preguntas.filter(p => idsActivos.has(p[CONFIG.fields.id]));
}

function buildPopupHTML(items, idx, interactive = true) {
  if (!items || !items.length) return buildEmptyPopupHTML();
  const total = items.length;
  const d = items[idx];

  let nav = '';
  if (total > 1 && interactive) {
    nav = `<div class="popup-nav">
        <button onclick="popupPrev()">‹</button>
        <span>${idx+1} / ${total}</span>
        <button onclick="popupNext()">›</button>
      </div>`;
  } else if (total > 1 && !interactive) {
    nav = `<div class="popup-nav"><span style="margin:auto;font-size:0.75rem">1 / ${total} — clic para explorar</span></div>`;
  }

  const pColor = colorPartido(d[CONFIG.fields.partido]);
  return `${nav}
    <div class="popup-card">
      <div class="popup-pregunta">${d[CONFIG.fields.pregunta] || '—'}</div>
      <div class="popup-partido" style="color:${pColor}">${d[CONFIG.fields.partido] || ''}</div>
      <div class="popup-autores">${formatAutores(d[CONFIG.fields.autores])}</div>
      ${d[CONFIG.fields.enlace] ? `<a class="popup-link" href="${d[CONFIG.fields.enlace]}" target="_blank" rel="noopener">Ver pregunta &#x1F855;</a>` : ''}
    </div>`;
}

/**
 * Popup resumen para municipios con muchas preguntas (>DRAWER_THRESHOLD).
 * Muestra solo el conteo y un botón que abre el drawer.
 */
function buildResumenPopupHTML(muniName, total) {
  return `<div class="popup-resumen">
      <div class="popup-resumen-text">Los diputados han hecho</div>
      <div class="popup-resumen-n">${total} preguntas</div>
      <div class="popup-resumen-muni">sobre ${muniName}.</div>
      <button class="popup-resumen-btn" onclick="event.stopPropagation(); abrirDrawer('${muniName.replace(/'/g, "\\'")}')">Click aquí para verlas</button>
    </div>`;
}

function buildEmptyPopupHTML() {
  return `<div class="popup-card">
      <div class="popup-pregunta" style="color:#888;font-style:italic;">
        No se han encontrado preguntas con los filtros seleccionados.
      </div>
    </div>`;
}

window.popupNext = function () {
  if (!popupData.length) return;
  popupIndex = (popupIndex + 1) % popupData.length;
  clickPopup?.setHTML(buildPopupHTML(popupData, popupIndex, true));
};
window.popupPrev = function () {
  if (!popupData.length) return;
  popupIndex = (popupIndex - 1 + popupData.length) % popupData.length;
  clickPopup?.setHTML(buildPopupHTML(popupData, popupIndex, true));
};

// ============================================================
//  DRAWER LATERAL — lista de preguntas
// ============================================================


window.abrirDrawer = function (muniName) {
  clickPopup.remove();
  hoverPopup.remove();

  const datos = preguntasDeMunicipio(muniName);
  drawerPreguntasBase = preguntasDeMunicipioSinFiltro(muniName);
  drawerPreguntas = datos;

  // Cabecera
  document.getElementById('drawer-muni-name').textContent = muniName;
  document.getElementById('drawer-muni-count').textContent = datos.length + ' preguntas';

  // Resetear filtros del drawer
  document.getElementById('drawer-search').value = '';
  const selPartido = document.getElementById('drawer-partido-filter');
  selPartido.value = 'todos';

  // Poblar el select de partidos con los que existan en este municipio
  const partidosEnMuni = [...new Set(datos.map(p => p[CONFIG.fields.partido]).filter(Boolean))].sort();
  selPartido.innerHTML = '<option value="todos">Todos</option>';
  partidosEnMuni.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    selPartido.appendChild(opt);
  });

  renderDrawerList(datos);
  document.getElementById('drawer').classList.add('open');
};

function cerrarDrawer() {
  document.getElementById('drawer').classList.remove('open');
  drawerPreguntas = [];
  drawerPreguntasBase = [];
  if (selectedMuniId !== null) {
    setHover(selectedMuniId, false);
    selectedMuniId = null;
  }
}

/**
 * Filtra y renderiza la lista del drawer según los filtros internos.
 */
function filtrarYRenderDrawer() {
  const q        = normalizar(document.getElementById('drawer-search').value.trim());
  const partido  = document.getElementById('drawer-partido-filter').value;

  let datos = drawerPreguntas;

  if (partido !== 'todos') {
    datos = datos.filter(p => p[CONFIG.fields.partido] === partido);
  }

  if (q.length >= 2) {
    datos = datos.filter(p =>
      normalizar(p[CONFIG.fields.pregunta] || '').includes(q)
    );
  }

  renderDrawerList(datos);
}

function renderDrawerList(datos) {
  const container = document.getElementById('drawer-list');
  const countEl   = document.getElementById('drawer-result-count');

  countEl.textContent = datos.length + ' pregunta' + (datos.length !== 1 ? 's' : '');

  if (!datos.length) {
    container.innerHTML = '<div style="padding:20px 18px;color:#888;font-size:0.82rem;font-style:italic;">Sin resultados para estos filtros.</div>';
    return;
  }

  // Construir HTML de golpe para rendimiento
  const html = datos.map(p => {
    const pColor  = colorPartido(p[CONFIG.fields.partido]);
    const enlace  = p[CONFIG.fields.enlace]
      ? `<a class="drawer-pregunta-link" href="${p[CONFIG.fields.enlace]}" target="_blank" rel="noopener">Ver ↗</a>`
      : '';
    const autores = formatAutores(p[CONFIG.fields.autores]);

    return `<div class="drawer-row">
        <span class="drawer-partido-tag" style="background:${pColor}">${p[CONFIG.fields.partido] || '—'}</span>
        <div style="flex:1;min-width:0">
          <div class="drawer-pregunta-text">${p[CONFIG.fields.pregunta] || '—'} ${enlace}</div>
          ${autores ? `<div class="drawer-autores">${autores}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = html;
}

// ============================================================
//  RESALTADO DE BORDE
// ============================================================

function addHoverLayers() {
  map.addLayer({
    id: 'capa-municipios-hover',
    type: 'line',
    source: 'src-municipios',
    ...(USE_PMTILES && { 'source-layer': CONFIG.sourceLayerMuni }),
    paint: {
      'line-color': '#111',
      'line-width': ['case', ['boolean', ['feature-state', 'hovered'], false], 2.5, 0],
      'line-opacity': ['case', ['boolean', ['feature-state', 'hovered'], false], 1, 0]
    }
  });
}

function setHover(id, state) {
  if (id === null) return;
  map.setFeatureState(featureRef(id), { hovered: state });
}

// ============================================================
//  HELPER
// ============================================================

function preguntasDeMunicipio(muniName) {
  if (!puntosGeoJSON) return [];
  const raw = puntosGeoJSON.features
    .filter(f => (f.properties[CONFIG.fields.muniPadre] || '').trim() === muniName)
    .map(f => f.properties);
  const datos = filtrarPreguntas(raw);
  const seen = new Set();
  return datos.filter(p => {
    const dup = seen.has(p[CONFIG.fields.id] || p[CONFIG.fields.pregunta]);
    seen.add(p[CONFIG.fields.id] || p[CONFIG.fields.pregunta]);
    return !dup;
  });
}

// ============================================================
//  ÍNDICE DE PALABRAS + CHIPS
// ============================================================

let palabrasIndice = {};

function actualizarChipsKeyword() {
  const tag = document.getElementById('keyword-tag');
  if (!tag) return;
  tag.innerHTML = '';
  if (keywordsActivas.size === 0) { tag.style.display = 'none'; return; }
  tag.style.display = 'flex';
  keywordsActivas.forEach(palabra => {
    const chip = document.createElement('span');
    chip.className = 'keyword-chip';
    chip.innerHTML = `${palabra} <span class="chip-x">×</span>`;
    chip.querySelector('.chip-x').addEventListener('click', () => {
      keywordsActivas.delete(palabra);
      applyFiltrosCombinados();
    });
    tag.appendChild(chip);
  });
}

// ============================================================
//  BUSCADORES
// ============================================================

let municipiosIndex = [];

function buildIndices() {
  fetch('datos/municipios_indice.json')
    .then(r => r.json())
    .then(data => { municipiosIndex = data; setupSearchMunicipios(); })
    .catch(err => console.error('Error índice municipios:', err));

  fetch('datos/palabras_indice.json')
    .then(r => r.json())
    .then(data => { palabrasIndice = data; setupSearchPreguntas(); })
    .catch(err => console.error('Error índice palabras:', err));
}

function setupSearchMunicipios() {
  const input   = document.getElementById('search-municipio');
  const results = document.getElementById('search-results');

  input.addEventListener('input', () => {
    const q = normalizar(input.value.trim());
    results.innerHTML = '';
    if (q.length < 2) { results.style.display = 'none'; return; }
    const matches = municipiosIndex
      .filter(m => normalizar(m.name).includes(q))
      .sort((a,b) => b.nPreguntas - a.nPreguntas)
      .slice(0, 8);
    if (!matches.length) { results.style.display = 'none'; return; }
    matches.forEach(m => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `<span>${m.name}</span><span class="search-count">${m.nPreguntas}</span>`;
      div.addEventListener('click', () => {
        input.value = m.name;
        results.style.display = 'none';
        map.flyTo({ center: m.center, zoom: CONFIG.searchZoom, speed: 1.2 });
        if (searchMuniHighlightId !== null) setHover(searchMuniHighlightId, false);
        searchMuniHighlightId = m.name;
        map.once('moveend', () => setHover(searchMuniHighlightId, true));
      });
      results.appendChild(div);
    });
    results.style.display = 'block';
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box')) results.style.display = 'none';
  });
}

function setupSearchPreguntas() {
  const input   = document.getElementById('search-pregunta');
  const results = document.getElementById('search-results-preg');
  let timer;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = '';
      if (q.length < 3) { results.style.display = 'none'; return; }
      const matches = Object.keys(palabrasIndice)
        .filter(p => p.includes(q))
        .sort((a,b) => palabrasIndice[b].length - palabrasIndice[a].length)
        .slice(0, 10);
      if (!matches.length) { results.style.display = 'none'; return; }
      matches.forEach(palabra => {
        const n = palabrasIndice[palabra].length;
        const yaActiva = keywordsActivas.has(palabra);
        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerHTML = `<span>${yaActiva ? '✓ ' : ''}${palabra}</span><span class="search-count">${n}</span>`;
        div.style.opacity = yaActiva ? '0.5' : '1';
        div.addEventListener('click', () => {
          if (!keywordsActivas.has(palabra)) {
            keywordsActivas.add(palabra);
            applyFiltrosCombinados();
          }
          input.value = '';
          results.style.display = 'none';
        });
        results.appendChild(div);
      });
      results.style.display = 'block';
    }, 150);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box-preg')) results.style.display = 'none';
  });
}

// ============================================================
//  INIT
// ============================================================

if (typeof pmtiles !== 'undefined') {
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
}

document.addEventListener('DOMContentLoaded', () => {
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'carto-light': {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'],
          tileSize: 256, attribution: '© CARTO'
        }
      },
      layers: [{ id: 'base', type: 'raster', source: 'carto-light' }]
    },
    center: CONFIG.views.peninsula.center,
    zoom:   CONFIG.views.peninsula.zoom,
    dragRotate: false,
    attributionControl: false
  });

  hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '320px' });
  clickPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: true,  maxWidth: '320px' });

  clickPopup.on('close', () => {
    if (selectedMuniId !== null) {
      setHover(selectedMuniId, false);
      selectedMuniId = null;
    }
  });

  map.on('load', () => {

    // ---- Fuentes ----
    map.addSource('src-puntos', { type: 'geojson', data: CONFIG.geojsonPuntos });

    if (USE_PMTILES) {
      map.addSource('src-municipios', {
        type: 'vector',
        url: `pmtiles://${CONFIG.pmtilesFile}`,
        promoteId: { [CONFIG.sourceLayerMuni]: CONFIG.fields.municipio }
      });
    } else {
      map.addSource('src-municipios', {
        type: 'geojson',
        data: CONFIG.geojsonMunis,
        promoteId: CONFIG.fields.municipio
      });
    }

    // ---- Capas ----
    map.addLayer({
      id: 'capa-municipios', type: 'fill', source: 'src-municipios',
      ...(USE_PMTILES && { 'source-layer': CONFIG.sourceLayerMuni }),
      paint: {
        'fill-color': rampaMunicipios(),
        'fill-opacity': 0.75,
        'fill-outline-color': 'rgba(0,0,0,0.1)'
      }
    });

    addHoverLayers();

    map.addLayer({
      id: 'capa-puntos', type: 'circle', source: 'src-puntos',
      filter: ['!=', ['get', CONFIG.fields.tipo], 'municipio'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 6, 14, 10],
        'circle-color': colorPuntoExpression(),
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 0.4,
        'circle-opacity': 0.88
      }
    });

    map.addSource('limites', { type: 'vector', url: `pmtiles://${CONFIG.limitesFile}` });
    map.addLayer({
      id: 'provincias-line', type: 'line', source: 'limites',
      'source-layer': 'provincias',
      paint: { 'line-color': '#494949', 'line-width': 0.4, 'line-opacity': 0.5 }
    });
    map.addLayer({
      id: 'ccaa-line', type: 'line', source: 'limites',
      'source-layer': 'ccaa',
      paint: { 'line-color': '#494949', 'line-width': 0.8 }
    });

    // ---- Carga GeoJSON + índices ----
    fetch(CONFIG.geojsonPuntos)
      .then(r => r.json())
      .then(data => { puntosGeoJSON = data; buildIndices(); });

    // ============================================================
    //  HOVER — municipios
    // ============================================================

    const esTactil = window.matchMedia('(hover: none)').matches;

    map.on('mousemove', 'capa-municipios', (e) => {
      if (esTactil) return;
      if (!e.features.length) return;
      if (map.getZoom() < HOVER_MIN_ZOOM) return;
      if (clickPopup.isOpen()) return;

      map.getCanvas().style.cursor = 'pointer';
      const muniName = (e.features[0].properties[CONFIG.fields.municipio] || '').trim();

      if (hoveredMuniId !== muniName) {
        if (hoveredMuniId !== selectedMuniId) setHover(hoveredMuniId, false);
        hoveredMuniId = muniName;
        setHover(hoveredMuniId, true);
      }

      const datos = preguntasDeMunicipio(muniName);
      popupData  = datos;
      popupIndex = 0;

      // En hover siempre mostramos el resumen si >THRESHOLD, sino preview sin flechas
      let html;
      if (datos.length > DRAWER_THRESHOLD) {
        html = buildResumenPopupHTML(muniName, datos.length);
      } else {
        html = datos.length > 0 ? buildPopupHTML(datos, 0, false) : buildEmptyPopupHTML();
      }
      hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    map.on('mouseleave', 'capa-municipios', () => {
      map.getCanvas().style.cursor = '';
      if (hoveredMuniId !== null && hoveredMuniId !== selectedMuniId) {
        setHover(hoveredMuniId, false);
      }
      hoveredMuniId = null;
      hoverPopup.remove();
    });

    // ============================================================
    //  CLICK — municipios (bifurca según nº preguntas)
    // ============================================================

    map.on('click', 'capa-municipios', (e) => {
      if (!e.features.length) return;
      const muniName = (e.features[0].properties[CONFIG.fields.municipio] || '').trim();

      if (selectedMuniId !== null) setHover(selectedMuniId, false);
      selectedMuniId = muniName;
      setHover(selectedMuniId, true);

      const datos = preguntasDeMunicipio(muniName);

      hoverPopup.remove();

      if (datos.length > DRAWER_THRESHOLD) {
        // Popup resumen con botón → drawer
        popupData  = datos;
        popupIndex = 0;
        clickPopup
          .setLngLat(e.lngLat)
          .setHTML(buildResumenPopupHTML(muniName, datos.length))
          .addTo(map);
      } else {
        // Popup paginado normal
        popupData  = datos;
        popupIndex = 0;
        clickPopup
          .setLngLat(e.lngLat)
          .setHTML(datos.length > 0 ? buildPopupHTML(datos, 0, true) : buildEmptyPopupHTML())
          .addTo(map);
      }
    });

    // ============================================================
    //  HOVER + CLICK — puntos (siempre popup normal)
    // ============================================================

    map.on('mousemove', 'capa-puntos', (e) => {
      if (esTactil) return;
      if (map.getZoom() < HOVER_MIN_ZOOM) return;
      if (clickPopup.isOpen()) return;
      map.getCanvas().style.cursor = 'pointer';
      const hits  = map.queryRenderedFeatures(e.point, { layers: ['capa-puntos'] });
      const datos = filtrarPreguntas(hits.map(f => f.properties));
      if (!datos.length) { hoverPopup.remove(); return; }
      popupData  = datos;
      popupIndex = 0;
      hoverPopup.setLngLat(e.lngLat).setHTML(buildPopupHTML(datos, 0, false)).addTo(map);
    });

    map.on('mouseleave', 'capa-puntos', () => {
      map.getCanvas().style.cursor = '';
      hoverPopup.remove();
    });

    map.on('click', 'capa-puntos', (e) => {
      const hits  = map.queryRenderedFeatures(e.point, { layers: ['capa-puntos'] });
      const datos = filtrarPreguntas(hits.map(f => f.properties));
      if (!datos.length) return;
      popupData  = datos;
      popupIndex = 0;
      hoverPopup.remove();
      clickPopup.setLngLat(e.lngLat).setHTML(buildPopupHTML(datos, 0, true)).addTo(map);
    });

    // ============================================================
    //  DRAWER — eventos
    // ============================================================

    document.getElementById('btn-close-drawer').addEventListener('click', cerrarDrawer);

    document.getElementById('drawer-search').addEventListener('input', filtrarYRenderDrawer);
    document.getElementById('drawer-partido-filter').addEventListener('change', filtrarYRenderDrawer);

    // ============================================================
    //  PANEL — Tipo de capa
    // ============================================================

    document.querySelectorAll('#tipo-btns button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tipo-btns button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTipo = btn.dataset.tipo;
        const showMuni   = activeTipo === 'municipio' || activeTipo === 'ambos';
        const showPuntos = activeTipo === 'lugar'     || activeTipo === 'ambos';
        map.setLayoutProperty('capa-municipios',       'visibility', showMuni   ? 'visible' : 'none');
        map.setLayoutProperty('capa-municipios-hover', 'visibility', showMuni   ? 'visible' : 'none');
        map.setLayoutProperty('capa-puntos',           'visibility', showPuntos ? 'visible' : 'none');
      });
    });

    // ============================================================
    //  PANEL — Filtro partidos
    // ============================================================

    const contenedorBtns = document.getElementById('partido-btns');
    Object.entries(CONFIG.partidos).forEach(([nombre, color]) => {
      if (nombre === '_default') return;
      const btn = document.createElement('button');
      btn.className       = 'partido-btn';
      btn.dataset.partido = nombre;
      btn.innerHTML       = `<span class="partido-dot" style="background:${color};"></span>${nombre}`;
      btn.addEventListener('click', () => {
        partidosActivos.has(nombre) ? partidosActivos.delete(nombre) : partidosActivos.add(nombre);
        applyFiltrosCombinados();
      });
      contenedorBtns.appendChild(btn);
    });

    document.getElementById('btn-clear-partidos').addEventListener('click', () => {
      partidosActivos.clear();
      applyFiltrosCombinados();
    });

    // ============================================================
    //  PANEL — Botones auxiliares
    // ============================================================

    document.getElementById('btn-canarias').addEventListener('click', () => {
      isCanariasView = !isCanariasView;
      map.flyTo({ ...(isCanariasView ? CONFIG.views.canarias : CONFIG.views.peninsula), essential: true });
      document.getElementById('btn-canarias').textContent = isCanariasView ? 'Península ✈️' : 'Canarias ✈️';
    });

    document.getElementById('btn-azar').addEventListener('click', () => {
      const layers = [];
      if (activeTipo === 'municipio' || activeTipo === 'ambos') layers.push('capa-municipios');
      if (activeTipo === 'lugar'     || activeTipo === 'ambos') layers.push('capa-puntos');
      const features = map.queryRenderedFeatures({ layers });
      if (!features.length) return;
      const f      = features[Math.floor(Math.random() * features.length)];
      const center = f.geometry.type === 'Point'
        ? f.geometry.coordinates
        : turf.center(f).geometry.coordinates;
      const lngLat = new maplibregl.LngLat(center[0], center[1]);
      map.flyTo({ center, zoom: 11 });
      map.once('moveend', () => {
        if (f.layer.id === 'capa-puntos') {
          const hits  = map.queryRenderedFeatures(map.project(center), { layers: ['capa-puntos'] });
          const datos = filtrarPreguntas(hits.map(h => h.properties));
          if (!datos.length) return;
          popupData  = datos;
          popupIndex = 0;
          clickPopup.setLngLat(lngLat).setHTML(buildPopupHTML(datos, 0, true)).addTo(map);
        } else if (f.layer.id === 'capa-municipios') {
          const muniName = (f.properties[CONFIG.fields.municipio] || '').trim();
          const datos    = preguntasDeMunicipio(muniName);
          popupData  = datos;
          popupIndex = 0;
          if (datos.length > DRAWER_THRESHOLD) {
            clickPopup.setLngLat(lngLat).setHTML(buildResumenPopupHTML(muniName, datos.length)).addTo(map);
          } else {
            clickPopup
              .setLngLat(lngLat)
              .setHTML(datos.length > 0 ? buildPopupHTML(datos, 0, true) : buildEmptyPopupHTML())
              .addTo(map);
          }
        }
      });
    });

    // ============================================================
    //  PANEL — Clear all
    // ============================================================

    document.getElementById('btn-clear-all').addEventListener('click', clearTodosFiltros);

    // ============================================================
    //  PANEL — Abrir / Cerrar
    // ============================================================

    document.getElementById('btn-close-panel').addEventListener('click', () => {
      document.getElementById('panel').classList.add('closed');
      document.getElementById('btn-open-panel').classList.add('visible');
      setTimeout(() => map.resize(), 400);
    });

    document.getElementById('btn-open-trigger').addEventListener('click', () => {
      document.getElementById('panel').classList.remove('closed');
      document.getElementById('btn-open-panel').classList.remove('visible');
      setTimeout(() => map.resize(), 400);
    });

    document.getElementById('btn-info').addEventListener('click', () => {
      document.getElementById('info-modal').style.display = 'flex';
    });

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');
  });
});
