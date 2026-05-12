// ================================================================
//  Mapa de preguntas parlamentarias - CORREGIDO
// ================================================================

let map, isCanariasView = false;
let popupData = [];
let popupIndex = 0;
let activePopup = null;
let activeTipo = 'ambos';
let puntosGeoJSON = null;
let filtroActivo = { tipo: 'ninguno', valor: null };

// --- Configuración ---
const USE_PMTILES = true;

const CONFIG = {
  pmtilesFile: 'datos/municipios_preguntas.pmtiles',
  puntosFile:  'datos/puntos_preguntas.pmtiles',
  limitesFile: 'datos/limites_espana.pmtiles',
  geojsonMunis:  'datos/municipios_preguntas.geojson',
  geojsonPuntos: 'datos/puntos_preguntas.geojson',
  sourceLayerMuni:   'municipios_preguntas',
  sourceLayerPuntos: 'puntos_preguntas',
  searchZoom: 12,

  fields: {
    municipio:  'municipio',
    lugar:      'lugar',
    pregunta:   'pregunta',
    partido:    'partido',
    autores:    'autores',
    tipo:       'tipo',
    enlace:     'enlace',
    nPreguntas: 'n_preguntas',
    muniPadre:  'municipio_padre' // Consistencia en el nombre del campo
  },

  views: {
    peninsula: { center: [-3.7038, 40.4168], zoom: 5.5 },
    canarias:  { center: [-15.7, 28.3], zoom: 7 }
  },

  partidos: {
    'PP':       '#0266b1',
    'PSOE':     '#e30613',
    'Vox':      '#63be21',
    'Sumar':    '#e5007e',
    'ERC':      '#ffb232',
    'Junts':    '#00c1c4',
    'PNV':      '#dc0000',
    'Bildu':    '#8bba42',
    'BNG':      '#76b3dd',
    'UPN':      '#0033a0',
    'CC':       '#ffcd00',
    'Podemos':  '#6b2f6b',
    '_default': '#888888'
  }
};

// ============================================================
//  UTILIDADES
// ============================================================

function filtrarPreguntas(preguntas) {
  if (filtroActivo.tipo === 'ninguno') return preguntas;

  if (filtroActivo.tipo === 'partido') {
    return preguntas.filter(p => p[CONFIG.fields.partido] === filtroActivo.valor);
  }

  if (filtroActivo.tipo === 'diputado') {
    return preguntas.filter(p =>
      (p[CONFIG.fields.autores] || '').includes(filtroActivo.valor)
    );
  }
  return preguntas;
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
    [0,   [199, 233, 192]],
    [0.2, [161, 217, 155]],
    [0.4, [116, 196, 118]],
    [0.6, [65, 171, 93]],
    [0.8, [35, 139, 69]],
    [1,   [0, 90, 50]]
  ];
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1][0] < t) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const f = (t - t0) / (t1 - t0);
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
  return `rgb(${r},${g},${b})`;
}

function contarPorMunicipio(featuresArray) {
  const conteo = {};
  featuresArray.forEach(f => {
    const muni = (f.properties[CONFIG.fields.muniPadre] || '').trim();
    if (muni) {
      conteo[muni] = (conteo[muni] || 0) + 1;
    }
  });
  return conteo;
}

function applyMuniFilterAndGradient(conteoPorMuni) {
  const muniNames = Object.keys(conteoPorMuni);

  if (muniNames.length === 0) {
    map.setFilter('capa-municipios', ['==', ['get', CONFIG.fields.municipio], '__ninguno__']);
    return;
  }

  // Filtramos la capa de municipios para que solo aparezcan los que tienen preguntas del filtro
  map.setFilter('capa-municipios', [
    'in',
    ['get', CONFIG.fields.municipio],
    ['literal', muniNames]
  ]);

  const maxCount = Math.max(...Object.values(conteoPorMuni), 1);
  const colorExpr = ['match', ['get', CONFIG.fields.municipio]];

  for (const [muni, count] of Object.entries(conteoPorMuni)) {
    const t = Math.min(count / Math.max(maxCount, 10), 1);
    colorExpr.push(muni, interpolateGreen(t));
  }
  colorExpr.push('#f8f8f6'); // Fallback color

  map.setPaintProperty('capa-municipios', 'fill-color', colorExpr);
}

// ============================================================
//  POPUP PAGINADO
// ============================================================

function buildPopupHTML(items, idx) {
  if (!items || items.length === 0) return buildEmptyPopupHTML();
  const total = items.length;
  const d = items[idx];

  let nav = '';
  if (total > 1) {
    nav = `
      <div class="popup-nav">
        <button onclick="popupPrev()">‹</button>
        <span>${idx + 1} / ${total}</span>
        <button onclick="popupNext()">›</button>
      </div>`;
  }

  const pColor = colorPartido(d[CONFIG.fields.partido]);
  return `
    ${nav}
    <div class="popup-card">
      <div class="popup-pregunta">${d[CONFIG.fields.pregunta] || '—'}</div>
      <div class="popup-partido" style="color:${pColor}">${d[CONFIG.fields.partido] || ''}</div>
      <div class="popup-autores">${formatAutores(d[CONFIG.fields.autores])}</div>
      ${d[CONFIG.fields.enlace]
        ? `<a class="popup-link" href="${d[CONFIG.fields.enlace]}" target="_blank" rel="noopener">Ver pregunta &#x1F855;</a>`
        : ''}
    </div>`;
}

function buildEmptyPopupHTML() {
  return `
    <div class="popup-card">
      <div class="popup-pregunta" style="color:#888; font-style:italic;">
        No se han encontrado preguntas con los filtros seleccionados.
      </div>
    </div>`;
}

window.popupNext = function () {
  if (!popupData.length) return;
  popupIndex = (popupIndex + 1) % popupData.length;
  activePopup?.setHTML(buildPopupHTML(popupData, popupIndex));
};
window.popupPrev = function () {
  if (!popupData.length) return;
  popupIndex = (popupIndex - 1 + popupData.length) % popupData.length;
  activePopup?.setHTML(buildPopupHTML(popupData, popupIndex));
};

// ============================================================
//  BUSCADORES
// ============================================================

let municipiosIndex = [];
let diputadosIndex = [];

function buildIndices() {
  if (!puntosGeoJSON) return;

  fetch(CONFIG.geojsonMunis)
    .then(r => r.json())
    .then(geojson => {
      municipiosIndex = geojson.features.map(f => ({
        name: f.properties[CONFIG.fields.municipio] || '',
        nPreguntas: f.properties[CONFIG.fields.nPreguntas] || 0,
        center: turf.center(f).geometry.coordinates
      }));

      const setDip = new Set();
      puntosGeoJSON.features.forEach(f => {
        const autores = f.properties[CONFIG.fields.autores];
        if (!autores) return;
        autores.split(',').forEach(a => {
          const name = a.trim();
          if (name && name !== '(…)') setDip.add(name);
        });
      });
      diputadosIndex = [...setDip].sort();

      setupSearchMunicipios();
      setupSearchDiputados();
    });
}

function setupSearchMunicipios() {
  const input = document.getElementById('search-municipio');
  const results = document.getElementById('search-results');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (q.length < 2) { results.style.display = 'none'; return; }

    const matches = municipiosIndex
      .filter(m => m.name.toLowerCase().includes(q))
      .sort((a, b) => b.nPreguntas - a.nPreguntas)
      .slice(0, 8);

    if (!matches.length) { results.style.display = 'none'; return; }

    matches.forEach(m => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `<span>${m.name}</span><span class="search-count">${m.nPreguntas}</span>`;
      div.addEventListener('click', () => {
        map.flyTo({ center: m.center, zoom: CONFIG.searchZoom, speed: 1.2 });
        input.value = m.name;
        results.style.display = 'none';
      });
      results.appendChild(div);
    });
    results.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) results.style.display = 'none';
  });
}

function setupSearchDiputados() {
  const input = document.getElementById('search-diputado');
  const results = document.getElementById('search-results-dip');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';

    if (q.length < 2) {
      results.style.display = 'none';
      if (q.length === 0) clearFilters();
      return;
    }

    const matches = diputadosIndex
      .filter(d => d.toLowerCase().includes(q))
      .slice(0, 8);

    if (!matches.length) { results.style.display = 'none'; return; }

    matches.forEach(name => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.textContent = name;
      div.addEventListener('click', () => {
        input.value = name;
        results.style.display = 'none';
        applyDiputadoFilter(name);
      });
      results.appendChild(div);
    });
    results.style.display = 'block';
  });
}

function applyDiputadoFilter(name) {
  filtroActivo = { tipo: 'diputado', valor: name };
  map.setFilter('capa-puntos', [
    'all',
    ['!=', ['get', 'tipo'], 'municipio'],
    ['in', name, ['get', CONFIG.fields.autores]]
  ]);

  if (puntosGeoJSON) {
    const filtered = puntosGeoJSON.features.filter(f =>
      (f.properties[CONFIG.fields.autores] || '').includes(name)
    );
    applyMuniFilterAndGradient(contarPorMunicipio(filtered));
  }
}

function clearFilters() {
  filtroActivo = { tipo: 'ninguno', valor: null };
  map.setFilter('capa-puntos', ['!=', ['get', 'tipo'], 'municipio']);
  map.setFilter('capa-municipios', null);
  map.setPaintProperty('capa-municipios', 'fill-color', rampaMunicipios());
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
          tileSize: 256,
          attribution: '© CARTO'
        }
      },
      layers: [{ id: 'base', type: 'raster', source: 'carto-light' }]
    },
    center: CONFIG.views.peninsula.center,
    zoom: CONFIG.views.peninsula.zoom,
    dragRotate: false,
    attributionControl: false
  });

  activePopup = new maplibregl.Popup({ closeButton: true, maxWidth: '320px' });

  map.on('load', () => {
    // Fuentes
    map.addSource('src-puntos', { type: 'geojson', data: CONFIG.geojsonPuntos });

    if (USE_PMTILES) {
      map.addSource('src-municipios', { type: 'vector', url: `pmtiles://${CONFIG.pmtilesFile}` });
    } else {
      map.addSource('src-municipios', { type: 'geojson', data: CONFIG.geojsonMunis });
    }

    // Capa Municipios
    map.addLayer({
      id: 'capa-municipios', 
      type: 'fill', 
      source: 'src-municipios',
      ...(USE_PMTILES && { 'source-layer': CONFIG.sourceLayerMuni }),
      paint: {
        'fill-color': rampaMunicipios(),
        'fill-opacity': 0.75,
        'fill-outline-color': 'rgba(0,0,0,0.1)'
      }
    });

    // Capa Puntos
    map.addLayer({
      id: 'capa-puntos', type: 'circle', source: 'src-puntos',
      filter: ['!=', ['get', 'tipo'], 'municipio'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 6, 14, 10],
        'circle-color': colorPuntoExpression(),
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.2,
        'circle-opacity': 0.88
      }
    });

    // Límites
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

    // Carga de datos para búsqueda
    fetch(CONFIG.geojsonPuntos)
      .then(r => r.json())
      .then(data => {
        puntosGeoJSON = data;
        buildIndices();
      });

    // Clicks
    map.on('click', 'capa-municipios', (e) => {
      if (!e.features.length) return;
      const feat = e.features[0];
      const muniName = (feat.properties[CONFIG.fields.municipio] || '').trim();

      if (puntosGeoJSON) {
        const preguntas = puntosGeoJSON.features
          .filter(f => (f.properties[CONFIG.fields.muniPadre] || '').trim() === muniName)
          .map(f => f.properties);

        popupData = filtrarPreguntas(preguntas);
        // Eliminar duplicados por ID de pregunta
        const seen = new Set();
        popupData = popupData.filter(p => {
          const duplicate = seen.has(p.id || p.pregunta);
          seen.add(p.id || p.pregunta);
          return !duplicate;
        });

        popupIndex = 0;
        activePopup.setLngLat(e.lngLat)
          .setHTML(popupData.length > 0 ? buildPopupHTML(popupData, 0) : buildEmptyPopupHTML())
          .addTo(map);
      }
    });

    map.on('click', 'capa-puntos', (e) => {
      const allFeats = map.queryRenderedFeatures(e.point, { layers: ['capa-puntos'] });
      popupData = filtrarPreguntas(allFeats.map(f => f.properties));
      if (!popupData.length) return;
      popupIndex = 0;
      activePopup.setLngLat(e.lngLat).setHTML(buildPopupHTML(popupData, 0)).addTo(map);
    });

    ['capa-municipios', 'capa-puntos'].forEach(layer => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // Panel Controles
    document.querySelectorAll('#tipo-btns button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tipo-btns button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTipo = btn.dataset.tipo;
        const showMuni   = activeTipo === 'municipio' || activeTipo === 'ambos';
        const showPuntos = activeTipo === 'lugar'     || activeTipo === 'ambos';
        map.setLayoutProperty('capa-municipios', 'visibility', showMuni ? 'visible' : 'none');
        map.setLayoutProperty('capa-puntos', 'visibility', showPuntos ? 'visible' : 'none');
      });
    });

    // Filtro Partidos
    const sel = document.getElementById('partido-filter');
    Object.keys(CONFIG.partidos).forEach(p => {
      if (p === '_default') return;
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      sel.appendChild(opt);
    });

    sel.addEventListener('change', () => {
      const val = sel.value;
      if (val === 'todos') {
        clearFilters();
      } else {
        filtroActivo = { tipo: 'partido', valor: val };
        map.setFilter('capa-puntos', ['all', ['!=', ['get', 'tipo'], 'municipio'], ['==', ['get', CONFIG.fields.partido], val]]);
        if (puntosGeoJSON) {
          const filtered = puntosGeoJSON.features.filter(f => f.properties[CONFIG.fields.partido] === val);
          applyMuniFilterAndGradient(contarPorMunicipio(filtered));
        }
      }
    });

    // Botones auxiliares
    document.getElementById('btn-canarias').addEventListener('click', () => {
      isCanariasView = !isCanariasView;
      map.flyTo({ ...(isCanariasView ? CONFIG.views.canarias : CONFIG.views.peninsula), essential: true });
      document.getElementById('btn-canarias').textContent = isCanariasView ? 'Península ✈️' : 'Canarias ✈️';
    });

    document.getElementById('btn-azar').addEventListener('click', () => {
      const layers = [];
      if (activeTipo === 'municipio' || activeTipo === 'ambos') layers.push('capa-municipios');
      if (activeTipo === 'lugar' || activeTipo === 'ambos') layers.push('capa-puntos');
      
      const features = map.queryRenderedFeatures({ layers });
      if (!features.length) return;
      
      const f = features[Math.floor(Math.random() * features.length)];
      const center = f.geometry.type === 'Point' ? f.geometry.coordinates : turf.center(f).geometry.coordinates;
      
      map.flyTo({ center, zoom: 11 });
      map.once('moveend', () => {
         // Simular click para abrir popup
         map.fire('click', { lngLat: maplibregl.LngLat.fromArray(center), point: map.project(center) });
      });
    });

    // Interfaz panel
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
      const modal = document.getElementById('info-modal');
      modal.style.display = 'flex';
    });
  });
});