async function initMap() {

    // 1a. Descargar el estilo base de Carto
    const styleResp = await fetch(
        'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
    );
    const style = await styleResp.json();

    // 1b. Inyectar la fuente de relieve Esri
    style.sources['esri-relief'] = {
        type: 'raster',
        tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: '&copy; Esri'
    };

    // 1c. Encontrar la primera capa de etiquetas (tipo symbol)
    //     para insertar el relieve justo debajo de ellas
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

    // 1d. Traducir etiquetas al español directamente en el estilo
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

    // 1e. Crear el mapa con el estilo ya modificado
    const map = new maplibregl.Map({
        container: 'map',
        style: style,
        center: [10, 25],
        zoom: 2.2,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        interactive: false
    });

    // Cuando el mapa esté listo, añadir las capas de datos
    map.on('load', () => onMapReady(map));
}


// ================================================================
// 2. CONFIGURACIÓN DE CADA SLIDE
// ================================================================
const chapters = {

    // ── INTRO Y CONTEXTO (sin flechas) ──
    'intro': {
        center: [10, 25], zoom: 2.2,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },
    'mediterraneo': {
        center: [15, 36], zoom: 4.5,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },
    'global-contexto': {
        center: [10, 25], zoom: 2.2,
        layers: { heatmap: true, rutas: false },
        filtroNuevo: null
    },

    // ── AMÉRICA ──
    'america-venezuela': {
        center: [-73, 7], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Venezuela"],
            ruta_es: ["Darién"]
        }
    },
    // Ecuador: solo el primer tercio de la ruta
    'america-ecuador': {
        center: [-77, 4], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Ecuador"],
            ruta_es: ["Frontera EEUU-México"],
            ratioFinal: 0.25
        }
    },
    'america-centro': {
        center: [-88, 14], zoom: 5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["El Salvador", "Guatemala", "Honduras"],
            ruta_es: ["Frontera EEUU-México"],
            ratioFinal: 0.55
        },
        continuar: [{
            country_clean: ["Ecuador"],
            ruta_es: ["Frontera EEUU-México"],
            ratioFinal: 0.55
        }]
    },
    'america-norte': {
        center: [-102, 25], zoom: 4.5,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: {
            country_clean: ["Mexico"],
            ruta_es: ["Frontera EEUU-México"]
        },
        continuar: [{
            country_clean: ["Ecuador"],
            ruta_es: ["Frontera EEUU-México"],
            ratioFinal: 1.0
        },
        {
            country_clean: ["El Salvador", "Guatemala", "Honduras"],
            ruta_es: ["Frontera EEUU-México"],
            ratioFinal: 1.0
        }]
    },

    // ── CUERNO DE ÁFRICA ──
    'africa-cuerno': {
        center: [42, 8], zoom: 4.5,
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
        center: [20, 20], zoom: 2.2,
        layers: { heatmap: true, rutas: true },
        filtroNuevo: null
    }
};


// ================================================================
// 3. CUANDO EL MAPA ESTÁ LISTO — capas de datos
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

    // ── Lanzar contador con retardo ──
    setTimeout(() => startCounterAnimation(map), 3000);

    // ── Iniciar scrollytelling ──
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
// 6. ANIMACIÓN DE RUTAS (sistema acumulativo)
// ================================================================
window.filtrosCompletados = [];
window.filtroActivo = null;
let progresoMaximo = 0;
let progresoBase = 0;

function coincideFiltro(feature, filtro) {
    if (!filtro) return false;
    const country = feature.properties.country_clean || '';
    const ruta = feature.properties.ruta_es || '';
    const fc = filtro.country_clean || [];
    const fr = filtro.ruta_es || [];
    const okC = fc.length === 0 || fc.includes(country);
    const okR = fr.length === 0 || fr.includes(ruta);
    return okC && okR;
}

function actualizarRutas(map, progreso) {
    if (!window.rutasOriginal) return;

    progresoMaximo = Math.max(progresoMaximo, progreso);

    const completados = window.filtrosCompletados;
    const nuevo = window.filtroActivo;

    if (completados.length === 0 && !nuevo) return;

    // Precalcular la longitud máxima de las flechas nuevas
    let longMaxima = 0;
    if (nuevo) {
        window.rutasOriginal.features.forEach(feature => {
            if (feature.geometry.type !== 'LineString' &&
                feature.geometry.type !== 'MultiLineString') return;
            if (!coincideFiltro(feature, nuevo)) return;

            try {
                const linea = feature.geometry.type === 'MultiLineString'
                    ? turf.lineString(feature.geometry.coordinates.flat())
                    : feature;
                const l = turf.length(linea, { units: 'kilometers' });
                if (l > longMaxima) longMaxima = l;
            } catch (e) {}
        });
    }

    const recortadas = [];
    const puntas = [];

    window.rutasOriginal.features.forEach(feature => {
        if (feature.geometry.type !== 'LineString' &&
            feature.geometry.type !== 'MultiLineString') return;

        let esCompletada = false;
        for (const filtro of completados) {
            if (coincideFiltro(feature, filtro)) {
                esCompletada = true;
                break;
            }
        }

        const esNueva = coincideFiltro(feature, nuevo);

        if (!esCompletada && !esNueva) return;

        try {
            const linea = feature.geometry.type === 'MultiLineString'
                ? turf.lineString(feature.geometry.coordinates.flat())
                : feature;

            const longTotal = turf.length(linea, { units: 'kilometers' });

            let ratio;
            if (esCompletada) {
                ratio = 1;
            } else {
                const kmRecorridos = progresoMaximo * longMaxima;
                ratio = Math.min(kmRecorridos / longTotal, 1);
            }

            const longParcial = longTotal * ratio;
            if (longParcial <= 0) return;

            const trozo = turf.lineSliceAlong(linea, 0, longParcial, {
                units: 'kilometers'
            });

            trozo.properties = { ...feature.properties };
            recortadas.push(trozo);

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
    // ── Rutas parciales (continuaciones entre slides) ──
    if (window.filtrosParciales) {
        window.filtrosParciales.forEach(parcial => {
            window.rutasOriginal.features.forEach(feature => {
                if (feature.geometry.type !== 'LineString' &&
                    feature.geometry.type !== 'MultiLineString') return;
                if (!coincideFiltro(feature, parcial)) return;
                
                // Evitar duplicados con completadas o nuevas
                if (recortadas.some(r =>
                    r.properties.country_clean === feature.properties.country_clean &&
                    r.properties.ruta_es === feature.properties.ruta_es)) return;
                
                try {
                    const linea = feature.geometry.type === 'MultiLineString'
                        ? turf.lineString(feature.geometry.coordinates.flat())
                        : feature;
                    const longTotal = turf.length(linea, { units: 'kilometers' });
                
                    // Dibujar hasta el ratio que se haya alcanzado o animando hacia ratioFinal
                    const ratioDesde = parcial.ratioAlcanzado || 0;
                    const ratioHasta = parcial.ratioFinal || 1;
                    const ratioActual = ratioDesde + (ratioHasta - ratioDesde) * progresoMaximo;
                    const longParcial = longTotal * ratioActual;
                    if (longParcial <= 0) return;
                
                    const trozo = turf.lineSliceAlong(linea, 0, longParcial, {
                        units: 'kilometers'
                    });
                    trozo.properties = { ...feature.properties };
                    recortadas.push(trozo);
                
                    const coords = trozo.geometry.coordinates;
                    if (coords.length >= 2) {
                        const penultimo = coords[coords.length - 2];
                        const ultimo = coords[coords.length - 1];
                        const bearing = turf.bearing(
                            turf.point(penultimo), turf.point(ultimo)
                        );
                        puntas.push(turf.point(ultimo, {
                            bearing, fallecidos: feature.properties.fallecidos || 0
                        }));
                    }
                } catch (e) {}
            });
        });
    }
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

                // ── Sistema acumulativo ──
                // ── Sistema acumulativo ──
                // Completar el filtro anterior solo si no tenía ratioFinal < 1
                if (window.filtroActivo) {
                    const rf = window.filtroActivo.ratioFinal;
                    if (!rf || rf >= 1) {
                        window.filtrosCompletados.push(window.filtroActivo);
                    } else {
                        // Guardarlo como parcial: se recuerda su ratio alcanzado
                        if (!window.filtrosParciales) window.filtrosParciales = [];
                        window.filtrosParciales.push({
                            ...window.filtroActivo,
                            ratioAlcanzado: rf
                        });
                    }
                }

                // Procesar continuaciones: avanzar rutas parciales
                if (chapter.continuar) {
                    chapter.continuar.forEach(cont => {
                        if (!window.filtrosParciales) window.filtrosParciales = [];
                        // Buscar si ya existe como parcial y actualizar
                        const idx = window.filtrosParciales.findIndex(p =>
                            JSON.stringify(p.country_clean) === JSON.stringify(cont.country_clean) &&
                            JSON.stringify(p.ruta_es) === JSON.stringify(cont.ruta_es)
                        );
                        if (cont.ratioFinal >= 1) {
                            // Se completa: mover a completados
                            if (idx !== -1) window.filtrosParciales.splice(idx, 1);
                            window.filtrosCompletados.push({
                                country_clean: cont.country_clean,
                                ruta_es: cont.ruta_es
                            });
                        } else {
                            const entry = {
                                country_clean: cont.country_clean,
                                ruta_es: cont.ruta_es,
                                ratioAlcanzado: cont.ratioDesde || (idx !== -1 ? window.filtrosParciales[idx].ratioAlcanzado : 0),
                                ratioFinal: cont.ratioFinal
                            };
                            if (idx !== -1) window.filtrosParciales[idx] = entry;
                            else window.filtrosParciales.push(entry);
                        }
                    });
                }

                window.filtroActivo = chapter.filtroNuevo || null;
                progresoMaximo = 0;

                const rect = entry.target.getBoundingClientRect();
                progresoBase = 1 - (rect.top / window.innerHeight);

                if (!chapter.layers?.rutas) {
                    limpiarRutas(map);
                }
                else if (!window.filtroActivo && window.filtrosCompletados.length > 0) {
                    actualizarRutas(map, 1);
                }
            }
        });
    }, { threshold: 0.5 });

    steps.forEach(step => observer.observe(step));

    // ── Scroll continuo para animación de flechas ──
    window.addEventListener('scroll', () => {
        const windowH = window.innerHeight;

        const activeEl = document.querySelector(`.step[data-step="${activeStep}"]`);
        if (!activeEl) return;

        const chapter = chapters[activeStep];
        if (!chapter) return;

        const rect = activeEl.getBoundingClientRect();
        const progresoRaw = 1 - (rect.top / windowH);

        const rango = 1 - progresoBase;
        const progresoNorm = rango > 0
            ? Math.max(0, Math.min(1, (progresoRaw - progresoBase) / rango))
            : 0;

        if (chapter.layers?.rutas &&
            (window.filtroActivo || window.filtrosCompletados.length > 0)) {
            actualizarRutas(map, progresoNorm);
        }
    });
}


// ================================================================
// 8. ARRANQUE
// ================================================================
initMap();
