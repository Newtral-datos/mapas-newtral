// ================================================================
// 1. MAPA BASE — con relieve Esri inyectado en el estilo
// ================================================================

const isMobile = window.innerWidth < 768;

async function initMap() {

    const styleResp = await fetch(
        'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
    );
    const style = await styleResp.json();

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

    // ── 0. INTRO: mapa global, SIN heatmap ──
    'intro': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },

    // ── 1. CONTADOR: mismo encuadre, APARECE heatmap ──
    'contador': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },

    // ── 2. Contexto general (mismo zoom global) ──
    'contexto-general': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },

    // ── 3. Zoom Mediterráneo ──
    'mediterraneo': {
        center: [15, 36], zoom: 3.5,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },

    // ── 4. Mediterráneo — matiz datos (mismo zoom) ──
    'mediterraneo-matiz': {
        center: [15, 36], zoom: 3.5,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },

    // ── 5. Med Occidental + flechas Argelia/Marruecos ──
    'med-occidental': {
        center: [-2, 35], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Morocco", "Algeria"],
            ruta_es: ["Mediterráneo Occidental"]
        }
    },

    // ── 6. Canarias — flechas Senegal etc. ──
    'canarias': {
        center: [-14, 27], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Senegal", "Morocco"],
            ruta_es: ["Ruta Atlántica a Canarias"]
        }
    },

    // ── 7. Zoom general Med — evolución (sin flechas nuevas) ──
    'mediterraneo-evolucion': {
        center: [15, 36], zoom: 3.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 8. Med — políticas (mismo zoom) ──
    'mediterraneo-politicas': {
        center: [15, 36], zoom: 3.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 9. Zoom centro África — intro Sahara ──
    'sahara-intro': {
        center: [15, 18], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 10. Flechas Sahara ──
    'sahara-flechas': {
        center: [15, 18], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Niger", "Nigeria", "Sudan"],
            ruta_es: ["Cruce del Sáhara"]
        }
    },

    // ── 11. Sahara — desapariciones (mismo zoom) ──
    'sahara-desapariciones': {
        center: [15, 18], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 12. Sahara — cita Avallone (mismo zoom) ──
    'sahara-cita': {
        center: [15, 18], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 13. Zoom Med Central ──
    'med-central': {
        center: [15, 34], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Eritrea", "Sudan", "Egypt", "Ivory Coast",
                            "Tunisia", "Syria", "Pakistan", "Bangladesh"],
            ruta_es: ["Mediterráneo Central"]
        }
    },

    // ── 14. Zoom Turquía ──
    'turquia': {
        center: [30, 39], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Syria", "Iraq", "Afghanistan"],
            ruta_es: ["Siria a Turquía", "Mediterráneo Oriental", "Irán a Turquía"]
        }
    },

    // ── 15. Turquía — cita (mismo zoom) ──
    'turquia-cita': {
        center: [30, 39], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 16. Zoom general Med — industria migración ──
    'mediterraneo-industria': {
        center: [15, 36], zoom: 3.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 17. Med — fracaso (mismo zoom) ──
    'mediterraneo-fracaso': {
        center: [15, 36], zoom: 3.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 18. Zoom Centroamérica ──
    'centroamerica': {
        center: [-82, 10], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 19. Zoom América general — políticas ──
    'america-politicas': {
        center: [-90, 18], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 20. Zoom Darién ──
    'darien': {
        center: [-77, 7], zoom: 6,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null,
        continuar: [
            {
                country_clean: ["Venezuela"],
                ruta_es: ["Darién"],
                ratioFinal: 1.0
            },
            {
                country_clean: ["Ecuador"],
                ruta_es: ["Frontera EEUU-México"],
                ratioFinal: 0.2
            }
        ]
    },

    // ── 21. Centroamérica — flechas sin texto ──
    'centroamerica-flechas': {
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
                ratioFinal: 0.8
            }
        ]
    },

    // ── 22. Zoom frontera EEUU ──
    'frontera-eeuu': {
        center: [-100, 28], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Mexico"],
            ruta_es: ["Frontera EEUU-México"]
        },
        continuar: [
            {
                country_clean: ["El Salvador", "Guatemala", "Honduras"],
                ruta_es: ["Frontera EEUU-México"],
                ratioFinal: 1.0
            },
            {
                country_clean: ["Ecuador"],
                ruta_es: ["Frontera EEUU-México"],
                ratioFinal: 1.0
            }
        ]
    },

    // ── 23. Cuerno de África ──
    'cuerno-africa': {
        center: [42, 3], zoom: 3,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Ethiopia", "Somalia"],
            ruta_es: ["Ruta Oriental desde el Cuerno de África", "Ruta al África Austral"]
        }
    },

    // ── 24. Zoom Irán ──
    'ruta-iran': {
        center: [55, 33], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Afghanistan"],
            ruta_es: ["Afganistán a Irán"]
        }
    },

    // ── 25. Zoom Myanmar ──
    'myanmar': {
        center: [93, 18], zoom: 4,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Myanmar"],
            ruta_es: ["Bahía de Bengala/Mar de Andamán", "Cruce del río Naf"]
        }
    },

    // ── 26. Solución — intro (zoom global) ──
    'solucion-intro': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 27. Zoom Centroeuropa — Ucrania ──
    'ucrania': {
        center: [25, 49], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 28. Zoom mundial — cierre Avallone ──
    'global-cierre': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 29. Global final — Ayuda en Acción ──
    'global-final': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    },

    // ── 30. Fin — botón descarga ──
    'fin': {
        center: [1, 30], zoom: 2,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    }
};


// ================================================================
// 3. CUANDO EL MAPA ESTÁ LISTO
// ================================================================
async function onMapReady(map) {

    // ── Heatmap ráster — visible desde el inicio ──
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
        paint: { 'raster-opacity': 0.85 }
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

    // Estilo de líneas: simplificado en móvil
    const lineWidthExpr = isMobile
        ? [
            'interpolate', ['linear'], ['zoom'],
            2, 1.5,
            5, 3,
            8, 5
        ]
        : [
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
        ];

    map.addLayer({
        id: 'rutas-layer',
        type: 'line',
        source: 'rutas',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
            'line-color': '#494949DD',
            'line-opacity': 1,
            'line-width': lineWidthExpr
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
// 5. SISTEMA DE ANIMACIÓN PROGRESIVA
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
    for (const anim of animacionesActivas) {
        if (coincideAnimacion(feature, anim)) {
            const desde = anim.ratioDesde;
            const hasta = anim.ratioFinal;
            return desde + (hasta - desde) * scrollProgreso;
        }
    }
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

        window.rutasOriginal.features.forEach(feature => {
            if (!coincideAnimacion(feature, anim)) return;
            const key = claveRuta(feature);
            const anterior = rutaRatios[key] || 0;
            rutaRatios[key] = Math.max(anterior, ratioAlcanzado);
        });
    }
}

// Construir la lista de animaciones para un chapter
function construirAnimaciones(chapter) {
    const lista = [];

    if (chapter.filtroNuevo) {
        const fn = chapter.filtroNuevo;
        const ratioFinal = fn.ratioFinal != null ? fn.ratioFinal : 1.0;

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

    if (chapter.continuar) {
        chapter.continuar.forEach(cont => {
            const ratioFinal = cont.ratioFinal != null ? cont.ratioFinal : 1.0;

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
// 6. SCROLLYTELLING
// ================================================================
function initScrollytelling(map) {

    const steps = document.querySelectorAll('.step');
    let activeStep = null;
    let activeStepEl = null;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const stepId = entry.target.dataset.step;
                if (stepId === activeStep) return;

                // ── Congelar animaciones del slide anterior ──
                congelarAnimaciones();

                activeStep = stepId;
                activeStepEl = entry.target;

                const chapter = chapters[stepId];
                if (!chapter) return;

                // Mover el mapa — más rápido en móvil
                map.flyTo({
                    center: chapter.center,
                    zoom: chapter.zoom,
                    pitch: chapter.pitch || 0,
                    bearing: chapter.bearing || 0,
                    duration: isMobile ? 800 : 2000,
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
                    dibujarRutas(map);
                }
            }
        });
    }, { threshold: isMobile ? 0.3 : 0.5 });

    steps.forEach(step => observer.observe(step));

    // ── Scroll continuo con throttle ──
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            if (!activeStep || !activeStepEl) { ticking = false; return; }

            const chapter = chapters[activeStep];
            if (!chapter || !chapter.layers?.rutas) { ticking = false; return; }

            const rect = activeStepEl.getBoundingClientRect();
            const windowH = window.innerHeight;

            const raw = 1 - (rect.top / windowH);
            scrollProgreso = Math.max(0, Math.min(1, (raw - 0.5) / 0.5));

            dibujarRutas(map);
            ticking = false;
        });
    });
}


// ================================================================
// 7. ARRANQUE
// ================================================================
initMap();
