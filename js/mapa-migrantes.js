// ================================================================
// 1. MAPA BASE — con relieve Esri inyectado en el estilo
// ================================================================

async function initMap() {

    const styleResp = await fetch(
        'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
    );
    const style = await styleResp.json();

    // Inyectar relieve Esri
    style.sources['esri-relief'] = {
        type: 'raster',
        tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: '&copy; Esri'
    };

    const firstLabelIdx = style.layers.findIndex(
        l => l.type === 'symbol' && l.layout?.['text-field']
    );

    const relieveLayer = {
        id: 'relieve',
        type: 'raster',
        source: 'esri-relief',
        paint: {
            'raster-opacity': 0.6,
            'raster-brightness-max': 0.9
        }
    };

    if (firstLabelIdx !== -1) {
        style.layers.splice(firstLabelIdx, 0, relieveLayer);
    } else {
        style.layers.push(relieveLayer);
    }

    // Etiquetas en español
    style.layers.forEach(layer => {
        if (layer.type === 'symbol' && layer.layout?.['text-field']) {
            layer.layout['text-field'] = [
                'coalesce',
                ['get', 'name:es'],
                ['get', 'name_es'],
                ['get', 'name']
            ];
        }
    });

    const map = new maplibregl.Map({
        container: 'map',
        style: style,
        center: [1, 30],
        zoom: 2,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        interactive: false
    });

    map.on('load', () => onMapReady(map));
}


// ================================================================
// 2. CONFIGURACIÓN DE CADA SLIDE
// ================================================================

const chapters = {

    // ── INTRO Y CONTEXTO ──
    'intro': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },
    'mediterraneo': {
        center: [15, 36], zoom: 4.5,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },
    'global-contexto': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },

    // ── AMÉRICA ──

    // Venezuela → Darién: ruta corta, se completa entera aquí
    'america-venezuela': {
        center: [-73, 7], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Venezuela"],
            ruta_es: ["Darién"]
        }
    },

    // Ecuador inicia su viaje al norte — solo hasta ~25%
    'america-ecuador': {
        center: [-77, 4], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Ecuador"],
            ruta_es: ["Frontera EEUU-México"],
            ratioFinal: 0.25
        }
    },

    // Centroamérica: sus flechas empiezan (hasta ~55%).
    // Ecuador sigue avanzando hasta ~55%.
    'america-centro': {
        center: [-88, 14], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["El Salvador", "Guatemala", "Honduras"],
            ruta_es: ["Frontera EEUU-México"],
            ratioFinal: 0.55
        },
        continuar: [
            {
                country_clean: ["Ecuador"],
                ruta_es: ["Frontera EEUU-México"],
                ratioFinal: 0.70
            }
        ]
    },

    // México + todo llega al 100%
    'america-norte': {
        center: [-102, 25], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Mexico"],
            ruta_es: ["Frontera EEUU-México"]
            // sin ratioFinal → 1.0 por defecto
        },
        continuar: [
            {
                country_clean: ["Ecuador"],
                ruta_es: ["Frontera EEUU-México"],
                ratioFinal: 1.0
            },
            {
                country_clean: ["El Salvador", "Guatemala", "Honduras"],
                ruta_es: ["Frontera EEUU-México"],
                ratioFinal: 1.0
            }
        ]
    },

    // ── CUERNO DE ÁFRICA ──
    'africa-cuerno': {
        center: [42, 8], zoom: 3.2,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Ethiopia"],
            ruta_es: ["Ruta Oriental desde el Cuerno de África", "Ruta al África Austral"]
        }
    },

    // ── CRUCE DEL SÁHARA ──
    'africa-sahara': {
        center: [15, 18], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Niger", "Nigeria", "Sudan"],
            ruta_es: ["Cruce del Sáhara"]
        }
    },

    // ── MEDITERRÁNEO CENTRAL ──
    'africa-med-central': {
        center: [15, 32], zoom: 3.8,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Eritrea", "Sudan", "Egypt", "Ivory Coast",
                            "Tunisia", "Syria", "Pakistan", "Bangladesh"],
            ruta_es: ["Mediterráneo Central"]
        }
    },

    // ── MEDITERRÁNEO OCCIDENTAL + CANARIAS ──
    'africa-med-occidental': {
        center: [-8, 30], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Morocco", "Algeria", "Senegal"],
            ruta_es: ["Mediterráneo Occidental", "Ruta Atlántica a Canarias"]
        }
    },

    // ── ORIENTE MEDIO ──
    'oriente-afganistan': {
        center: [55, 33], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Afghanistan"],
            ruta_es: ["Afganistán a Irán", "Irán a Turquía"]
        }
    },
    'oriente-siria': {
        center: [37, 36], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Syria", "Iraq", "Afghanistan"],
            ruta_es: ["Siria a Turquía", "Mediterráneo Oriental"]
        }
    },

    // ── ASIA ──
    'asia-myanmar': {
        center: [93, 18], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Myanmar"],
            ruta_es: ["Bahía de Bengala/Mar de Andamán", "Cruce del río Naf"]
        }
    },

    // ── VISTA GLOBAL FINAL ──
    'global-final': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    }
};


// ================================================================
// 3. CUANDO EL MAPA ESTÁ LISTO
// ================================================================
async function onMapReady(map) {

    // ── Heatmap ráster ──
    map.addSource('heatmap-raster', {
        type: 'image',
        url: 'datos/heatmap-puntos.png',
        coordinates: [
            [-142.9954132161899, 74.43653430020457],
            [133.0917680580626, 74.43653430020457],
            [133.0917680580626, -62.7400736805484],
            [-142.9954132161899, -62.7400736805484]
        ]
    });

    map.addLayer({
        id: 'heatmap-layer',
        type: 'raster',
        source: 'heatmap-raster',
        paint: { 'raster-opacity': 0 }
    });

    // ── Rutas GeoJSON ──
    const rutasResponse = await fetch('datos/RUTAS-SUAVIZADAS.geojson');
    const rutasOriginal = await rutasResponse.json();
    window.rutasOriginal = rutasOriginal;

    // Precalcular longitudes
    window.rutasLongitudes = new Map();
    rutasOriginal.features.forEach(feature => {
        if (feature.geometry.type !== 'LineString' &&
            feature.geometry.type !== 'MultiLineString') return;
        try {
            const linea = feature.geometry.type === 'MultiLineString'
                ? turf.lineString(feature.geometry.coordinates.flat())
                : feature;
            const l = turf.length(linea, { units: 'kilometers' });
            const key = claveRuta(feature);
            window.rutasLongitudes.set(key, l);
        } catch (e) {}
    });

    map.addSource('rutas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
        id: 'rutas-layer',
        type: 'line',
        source: 'rutas',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
            'line-color': '#494949DD',
            'line-opacity': 1,
            'line-width': [
                'interpolate', ['linear'], ['zoom'],
                2, [
                    'step', ['get', 'fallecidos'],
                    1.5, 172.83, 2, 333.88, 2.6, 904, 3, 1671.5, 3.2
                ],
                5, [
                    'step', ['get', 'fallecidos'],
                    3, 172.83, 4, 333.88, 5.2, 904, 6, 1671.5, 6.4
                ],
                8, [
                    'step', ['get', 'fallecidos'],
                    5, 172.83, 7, 333.88, 9, 904, 10.5, 1671.5, 11
                ]
            ]
        }
    });

    // ── Puntas de flecha ──
    map.addSource('rutas-puntas', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    crearIconoFlecha(map);

    map.addLayer({
        id: 'rutas-puntas-layer',
        type: 'symbol',
        source: 'rutas-puntas',
        layout: {
            'icon-image': 'arrow',
            'icon-size': [
                'step', ['get', 'fallecidos'],
                0.35, 172.83, 0.5, 333.88, 0.65, 904, 0.8, 1671.5, 0.95
            ],
            'icon-rotate': ['get', 'bearing'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true
        }
    });

    setTimeout(() => startCounterAnimation(map), 1000);
    initScrollytelling(map);
}


// ================================================================
// 4. ICONO DE FLECHA
// ================================================================
function crearIconoFlecha(map) {
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#494949DD';
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size, size * 0.85);
    ctx.lineTo(size / 2, size * 0.50);
    ctx.lineTo(0, size * 0.85);
    ctx.closePath();
    ctx.fill();

    map.addImage('arrow', ctx.getImageData(0, 0, size, size), {
        pixelRatio: 2
    });
}


// ================================================================
// 5. CONTADOR ANIMADO
// ================================================================
const TARGET_COUNT = 30230;
const COUNTER_DURATION = 4000;
let introAnimated = false;

function startCounterAnimation(map) {
    if (introAnimated) return;
    introAnimated = true;

    const counterEl = document.getElementById('death-counter');
    if (!counterEl) return;

    const startTime = performance.now();

    function tick(now) {
        const elapsed = now - startTime;
        const progreso = Math.min(elapsed / COUNTER_DURATION, 1);
        const eased = 1 - Math.pow(1 - progreso, 3);

        const value = Math.floor(TARGET_COUNT * eased);
        counterEl.textContent = value.toLocaleString('es-ES');

        map.setPaintProperty('heatmap-layer', 'raster-opacity', eased * 0.85);

        if (progreso < 1) {
            requestAnimationFrame(tick);
        }
    }

    requestAnimationFrame(tick);
}


// ================================================================
// 6. SISTEMA DE ANIMACIÓN PROGRESIVA
// ================================================================

// Genera una clave única para cada feature
function claveRuta(feature) {
    return (feature.properties.country_clean || '') + '|' +
           (feature.properties.ruta_es || '');
}

// Registro global: clave → ratio acumulado (0..1)
// Nunca retrocede
const rutaRatios = {};

// Lista de animaciones activas en el slide actual.
// Cada entrada: { country_clean, ruta_es, ratioDesde, ratioFinal }
let animacionesActivas = [];

// Progreso del scroll dentro del slide actual (0..1)
let scrollProgreso = 0;

function coincideAnimacion(feature, anim) {
    const country = feature.properties.country_clean || '';
    const ruta = feature.properties.ruta_es || '';
    const fc = anim.country_clean || [];
    const fr = anim.ruta_es || [];
    const okC = fc.length === 0 || fc.includes(country);
    const okR = fr.length === 0 || fr.includes(ruta);
    return okC && okR;
}

function getRatioActual(feature) {
    // Buscar si esta feature tiene una animación activa
    for (const anim of animacionesActivas) {
        if (coincideAnimacion(feature, anim)) {
            // Interpolar entre ratioDesde y ratioFinal según scroll
            const desde = anim.ratioDesde;
            const hasta = anim.ratioFinal;
            return desde + (hasta - desde) * scrollProgreso;
        }
    }
    // Si no tiene animación activa, devolver el ratio congelado
    const key = claveRuta(feature);
    return rutaRatios[key] || 0;
}

function dibujarRutas(map) {
    if (!window.rutasOriginal) return;

    const recortadas = [];
    const puntas = [];

    window.rutasOriginal.features.forEach(feature => {
        if (feature.geometry.type !== 'LineString' &&
            feature.geometry.type !== 'MultiLineString') return;

        const ratio = getRatioActual(feature);
        if (ratio <= 0) return;

        try {
            const linea = feature.geometry.type === 'MultiLineString'
                ? turf.lineString(feature.geometry.coordinates.flat())
                : feature;

            const key = claveRuta(feature);
            const longTotal = window.rutasLongitudes.get(key);
            if (!longTotal) return;

            const longParcial = longTotal * Math.min(ratio, 1);
            if (longParcial <= 0) return;

            const trozo = turf.lineSliceAlong(linea, 0, longParcial, {
                units: 'kilometers'
            });

            trozo.properties = { ...feature.properties };
            recortadas.push(trozo);

            // Punta de flecha
            const coords = trozo.geometry.coordinates;
            if (coords.length >= 2) {
                const penultimo = coords[coords.length - 2];
                const ultimo = coords[coords.length - 1];
                const bearing = turf.bearing(
                    turf.point(penultimo),
                    turf.point(ultimo)
                );
                puntas.push(turf.point(ultimo, {
                    bearing: bearing,
                    fallecidos: feature.properties.fallecidos || 0
                }));
            }
        } catch (e) {}
    });

    map.getSource('rutas').setData({
        type: 'FeatureCollection', features: recortadas
    });
    map.getSource('rutas-puntas').setData({
        type: 'FeatureCollection', features: puntas
    });
}

function limpiarRutas(map) {
    map.getSource('rutas').setData({
        type: 'FeatureCollection', features: []
    });
    map.getSource('rutas-puntas').setData({
        type: 'FeatureCollection', features: []
    });
}

// Congelar el progreso actual de todas las animaciones activas
function congelarAnimaciones() {
    for (const anim of animacionesActivas) {
        const ratioAlcanzado = anim.ratioDesde +
            (anim.ratioFinal - anim.ratioDesde) * scrollProgreso;

        // Aplicar a todas las features que coincidan
        window.rutasOriginal.features.forEach(feature => {
            if (!coincideAnimacion(feature, anim)) return;
            const key = claveRuta(feature);
            const anterior = rutaRatios[key] || 0;
            // Nunca retrocede
            rutaRatios[key] = Math.max(anterior, ratioAlcanzado);
        });
    }
}

// Construir la lista de animaciones para un chapter
function construirAnimaciones(chapter) {
    const lista = [];

    // Flechas nuevas
    if (chapter.filtroNuevo) {
        const fn = chapter.filtroNuevo;
        const ratioFinal = fn.ratioFinal != null ? fn.ratioFinal : 1.0;

        // Para cada combinación country×ruta, el ratioDesde es
        // lo que ya se haya acumulado previamente (normalmente 0)
        // Usamos un representante para obtener el ratioDesde
        let ratioDesde = 0;
        if (fn.country_clean && fn.ruta_es) {
            window.rutasOriginal.features.forEach(feature => {
                if (coincideAnimacion(feature, fn)) {
                    const key = claveRuta(feature);
                    ratioDesde = Math.max(ratioDesde, rutaRatios[key] || 0);
                }
            });
        }

        lista.push({
            country_clean: fn.country_clean,
            ruta_es: fn.ruta_es,
            ratioDesde: ratioDesde,
            ratioFinal: ratioFinal
        });
    }

    // Continuaciones
    if (chapter.continuar) {
        chapter.continuar.forEach(cont => {
            const ratioFinal = cont.ratioFinal != null ? cont.ratioFinal : 1.0;

            // ratioDesde = lo máximo acumulado hasta ahora
            let ratioDesde = 0;
            window.rutasOriginal.features.forEach(feature => {
                if (coincideAnimacion(feature, cont)) {
                    const key = claveRuta(feature);
                    ratioDesde = Math.max(ratioDesde, rutaRatios[key] || 0);
                }
            });

            lista.push({
                country_clean: cont.country_clean,
                ruta_es: cont.ruta_es,
                ratioDesde: ratioDesde,
                ratioFinal: ratioFinal
            });
        });
    }

    return lista;
}


// ================================================================
// 7. SCROLLYTELLING
// ================================================================
function initScrollytelling(map) {

    const steps = document.querySelectorAll('.step');
    let activeStep = null;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const stepId = entry.target.dataset.step;
                if (stepId === activeStep) return;

                // ── Congelar animaciones del slide anterior ──
                congelarAnimaciones();

                activeStep = stepId;

                const chapter = chapters[stepId];
                if (!chapter) return;

                // Mover el mapa
                map.flyTo({
                    center: chapter.center,
                    zoom: chapter.zoom,
                    pitch: chapter.pitch || 0,
                    bearing: chapter.bearing || 0,
                    duration: 2000,
                    essential: true
                });

                // Visibilidad de capas
                if (chapter.layers) {
                    map.setLayoutProperty('heatmap-layer', 'visibility',
                        chapter.layers.heatmap ? 'visible' : 'none');
                    map.setLayoutProperty('rutas-layer', 'visibility',
                        chapter.layers.rutas ? 'visible' : 'none');
                    map.setLayoutProperty('rutas-puntas-layer', 'visibility',
                        chapter.layers.rutas ? 'visible' : 'none');
                }

                // ── Construir nuevas animaciones ──
                scrollProgreso = 0;
                animacionesActivas = construirAnimaciones(chapter);

                // Si no tiene rutas, limpiar
                if (!chapter.layers?.rutas) {
                    limpiarRutas(map);
                } else {
                    // Dibujar estado inicial (las congeladas + inicio de nuevas)
                    dibujarRutas(map);
                }
            }
        });
    }, { threshold: 0.5 });

    steps.forEach(step => observer.observe(step));

    // ── Scroll continuo ──
    window.addEventListener('scroll', () => {
        if (!activeStep) return;

        const chapter = chapters[activeStep];
        if (!chapter || !chapter.layers?.rutas) return;

        const activeEl = document.querySelector(`.step[data-step="${activeStep}"]`);
        if (!activeEl) return;

        const rect = activeEl.getBoundingClientRect();
        const windowH = window.innerHeight;

        // Progreso: 0 cuando el step entra, 1 cuando sale
        // El step se activa cuando su centro está en pantalla (threshold 0.5)
        // así que mapeamos desde ese punto hasta que desaparece
        const raw = 1 - (rect.top / windowH);
        scrollProgreso = Math.max(0, Math.min(1, (raw - 0.5) / 0.5));

        dibujarRutas(map);
    });
}


// ================================================================
// 8. ARRANQUE
// ================================================================
initMap();
