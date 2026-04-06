(function () {
    'use strict';

    // ========== OBJECT DEFINITIONS ==========

    const OBJECTS = [
        { id: 'feather',       name: 'Pana',                      mass: 0.003,  cd: 1.00, area: 0.005,   color: '#b0bec5', shape: 'feather' },
        { id: 'paper_flat',    name: 'Foaie hartie (intinsa)',     mass: 0.005,  cd: 1.28, area: 0.06,    color: '#fafafa', shape: 'sheet' },
        { id: 'paper_crumpled',name: 'Foaie hartie (mototoliata)',mass: 0.005,  cd: 0.40, area: 0.003,   color: '#e0e0e0', shape: 'crumpled' },
        { id: 'coin',          name: 'Moneda',                    mass: 0.008,  cd: 1.12, area: 0.0005,  color: '#ffd54f', shape: 'coin' },
        { id: 'tennis',        name: 'Minge tenis',               mass: 0.058,  cd: 0.50, area: 0.0034,  color: '#c6ff00', shape: 'circle' },
        { id: 'basketball',    name: 'Minge baschet',             mass: 0.625,  cd: 0.50, area: 0.0452,  color: '#ff8a65', shape: 'circle' },
        { id: 'steel_ball',    name: 'Bila otel mica',            mass: 0.028,  cd: 0.47, area: 0.00025, color: '#90a4ae', shape: 'circle' },
        { id: 'hammer',        name: 'Ciocan',                    mass: 1.0,    cd: 0.80, area: 0.01,    color: '#8d6e63', shape: 'hammer' },
        { id: 'brick',         name: 'Caramida',                  mass: 2.3,    cd: 1.05, area: 0.015,   color: '#d84315', shape: 'rect' },
        { id: 'bowling',       name: 'Bila bowling',              mass: 6.35,   cd: 0.50, area: 0.0366,  color: '#1a237e', shape: 'circle' },
    ];

    const TIPS = [
        { obj1: 'feather', obj2: 'hammer', text: 'Pana vs Ciocan — In aer, pana pluteste incet din cauza drag-ului mare. In vid (slider la 0), ambele cad IDENTIC! Asa s-a demonstrat pe Luna in misiunea Apollo 15.' },
        { obj1: 'paper_flat', obj2: 'paper_crumpled', text: 'Foaie intinsa vs Mototoliata — Aceeasi masa, dar forma diferita! Foaia intinsa are aria mult mai mare, deci frecarea cu aerul o incetineste enorm. Mototoliata cade aproape ca o bila.' },
        { obj1: 'tennis', obj2: 'bowling', text: 'Minge tenis vs Bila bowling — Forme similare (sfere), dar masa foarte diferita. Bila bowling ajunge la sol mult mai repede in aer, desi in vid ar cadea simultan.' },
        { obj1: 'coin', obj2: 'feather', text: 'Moneda vs Pana — Diferenta dramatica in aer! Moneda taie aerul cu aria ei mica, pe cand pana este franata masiv. Compara vitezele terminale!' },
        { obj1: 'basketball', obj2: 'steel_ball', text: 'Minge baschet vs Bila otel — Mingea de baschet e mai grea, dar aria ei este uriasa, rezultand intr-o viteza terminala surprinzator de mica. Bila de otel cade mult mai repede.' },
        { obj1: 'brick', obj2: 'feather', text: 'Caramida vs Pana — Diferenta extrema! Caramida aproape ca nu este afectata de aer (viteza terminala ~48 m/s), pe cand pana pluteste la doar ~3 m/s.' },
    ];

    const G = 9.80665;
    const DT = 1 / 120;
    const AIR_DENSITY_DEFAULT = 1.225;

    // ========== STATE ==========

    const state = {
        running: false,
        finished: false,
        time: 0,
        airDensity: AIR_DENSITY_DEFAULT,
        fallHeight: 20,
        obj1: null,
        obj2: null,
        sim1: null,
        sim2: null,
        graphData1: [],
        graphData2: [],
        particles: [],
        animId: null,
        tipIndex: 0,
        lastFrameTime: 0,
        accumulator: 0,
    };

    function createSimState() {
        return { y: 0, v: 0, a: G, fg: 0, fd: 0, landed: false, landTime: null };
    }

    // ========== DOM REFS ==========

    const $ = (sel) => document.querySelector(sel);
    const obj1Select = $('#object1-select');
    const obj2Select = $('#object2-select');
    const obj1Props = $('#object1-props');
    const obj2Props = $('#object2-props');
    const airSlider = $('#air-density-slider');
    const airValue = $('#air-density-value');
    const vacuumToggle = $('#vacuum-toggle');
    const heightInput = $('#height-input');
    const btnStart = $('#btn-start');
    const btnReset = $('#btn-reset');
    const canvasOverlay = $('#canvas-overlay');
    const resultBanner = $('#result-banner');
    const tipText = $('#tip-text');
    const btnNextTip = $('#btn-next-tip');
    const simCanvas = $('#sim-canvas');
    const graphCanvas = $('#graph-canvas');
    const simCtx = simCanvas.getContext('2d');
    const graphCtx = graphCanvas.getContext('2d');

    const dataEls = {
        obj1Name: $('#data-obj1-name'),
        obj2Name: $('#data-obj2-name'),
        obj1Time: $('#data-obj1-time'),
        obj2Time: $('#data-obj2-time'),
        obj1Pos: $('#data-obj1-pos'),
        obj2Pos: $('#data-obj2-pos'),
        obj1Vel: $('#data-obj1-vel'),
        obj2Vel: $('#data-obj2-vel'),
        obj1Acc: $('#data-obj1-acc'),
        obj2Acc: $('#data-obj2-acc'),
        obj1Fg: $('#data-obj1-fg'),
        obj2Fg: $('#data-obj2-fg'),
        obj1Fd: $('#data-obj1-fd'),
        obj2Fd: $('#data-obj2-fd'),
        obj1Vt: $('#data-obj1-vt'),
        obj2Vt: $('#data-obj2-vt'),
    };

    // ========== PHYSICS ==========

    function computeTerminalVelocity(obj, rho) {
        if (rho <= 0 || obj.cd <= 0 || obj.area <= 0) return Infinity;
        return Math.sqrt((2 * obj.mass * G) / (rho * obj.cd * obj.area));
    }

    function stepPhysics(sim, obj, rho) {
        if (sim.landed) return;

        sim.fg = obj.mass * G;
        sim.fd = 0.5 * rho * sim.v * sim.v * obj.cd * obj.area;
        if (sim.fd > sim.fg) sim.fd = sim.fg;

        const fNet = sim.fg - sim.fd;
        sim.a = fNet / obj.mass;

        sim.v += sim.a * DT;
        sim.y += sim.v * DT;

        if (sim.y >= state.fallHeight) {
            sim.y = state.fallHeight;
            sim.v = 0;
            sim.a = 0;
            sim.fd = sim.fg;
            sim.landed = true;
            sim.landTime = state.time;
        }
    }

    // ========== AIR PARTICLES ==========

    function initParticles(w, h) {
        state.particles = [];
        const count = 60;
        for (let i = 0; i < count; i++) {
            state.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 1 + Math.random() * 2,
                alpha: 0.1 + Math.random() * 0.25,
                speed: 0.2 + Math.random() * 0.5,
            });
        }
    }

    function updateParticles(w, h) {
        const rhoFactor = state.airDensity / AIR_DENSITY_DEFAULT;
        for (const p of state.particles) {
            p.y -= p.speed * rhoFactor;
            if (p.y < -5) {
                p.y = h + 5;
                p.x = Math.random() * w;
            }
        }
    }

    // ========== CANVAS RENDERING ==========

    function resizeCanvas(canvas) {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        return dpr;
    }

    function drawObject(ctx, shape, x, y, size, color, label) {
        ctx.save();
        ctx.translate(x, y);

        switch (shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-size * 0.3, -size * 0.3, size * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fill();
                break;

            case 'feather':
                ctx.rotate(0.15);
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.4, size * 1.2, 0, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(0, -size * 1.2);
                ctx.lineTo(0, size * 1.2);
                ctx.stroke();
                for (let i = -4; i <= 4; i++) {
                    const py = i * size * 0.25;
                    ctx.beginPath();
                    ctx.moveTo(0, py);
                    ctx.lineTo(i % 2 === 0 ? size * 0.35 : -size * 0.35, py + size * 0.1);
                    ctx.stroke();
                }
                break;

            case 'sheet':
                ctx.fillStyle = color;
                const wave = 0;
                ctx.beginPath();
                ctx.moveTo(-size, -size * 0.15 + wave);
                ctx.quadraticCurveTo(-size * 0.5, -size * 0.3 - wave, 0, -size * 0.1 + wave * 0.5);
                ctx.quadraticCurveTo(size * 0.5, size * 0.1 - wave, size, -size * 0.05 + wave);
                ctx.lineTo(size, size * 0.15 + wave);
                ctx.quadraticCurveTo(size * 0.5, size * 0.3 - wave, 0, size * 0.1 + wave * 0.5);
                ctx.quadraticCurveTo(-size * 0.5, -size * 0.1 + wave, -size, size * 0.15 + wave);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
                break;

            case 'crumpled':
                ctx.beginPath();
                const pts = 8;
                for (let i = 0; i <= pts; i++) {
                    const angle = (i / pts) * Math.PI * 2;
                    const r = size * (0.7 + 0.3 * Math.sin(angle * 3.7 + 1));
                    const px = Math.cos(angle) * r;
                    const py = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                break;

            case 'coin':
                ctx.beginPath();
                ctx.ellipse(0, 0, size, size * 0.35, 0, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(0, 0, size * 0.65, size * 0.22, 0, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.stroke();
                break;

            case 'hammer':
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(-size * 0.12, -size * 0.1, size * 0.24, size * 1.3);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(-size * 0.55, -size * 0.6, size * 1.1, size * 0.55, 3);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(-size * 0.5, -size * 0.55, size * 1.0, size * 0.15);
                break;

            case 'rect':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(-size * 0.7, -size * 0.45, size * 1.4, size * 0.9, 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 5; c++) {
                        const bx = -size * 0.6 + c * size * 0.28;
                        const by = -size * 0.35 + r * size * 0.3;
                        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                        ctx.strokeRect(bx, by, size * 0.25, size * 0.12);
                    }
                }
                break;
        }

        ctx.restore();

        ctx.save();
        ctx.font = `500 ${Math.max(10, size * 0.7)}px 'Outfit', sans-serif`;
        ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y - size - 8);
        ctx.restore();
    }

    function drawForceArrow(ctx, x, y, force, maxForce, color, direction) {
        if (force < 0.0001) return;
        const maxLen = 60;
        const len = Math.min((force / maxForce) * maxLen, maxLen);
        if (len < 3) return;

        const arrowHead = Math.min(8, len * 0.35);
        const sign = direction === 'down' ? 1 : -1;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.85;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + sign * len);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y + sign * (len + arrowHead * 0.3));
        ctx.lineTo(x - arrowHead * 0.5, y + sign * (len - arrowHead * 0.7));
        ctx.lineTo(x + arrowHead * 0.5, y + sign * (len - arrowHead * 0.7));
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function getObjectSize(obj) {
        const areaScale = Math.sqrt(obj.area) * 200;
        return Math.max(12, Math.min(32, areaScale));
    }

    function renderSimulation() {
        const dpr = resizeCanvas(simCanvas);
        const w = simCanvas.width;
        const h = simCanvas.height;
        simCtx.save();
        simCtx.scale(dpr, dpr);
        const cw = w / dpr;
        const ch = h / dpr;

        const isVacuum = state.airDensity < 0.01;

        if (isVacuum) {
            const grad = simCtx.createLinearGradient(0, 0, 0, ch);
            grad.addColorStop(0, '#050810');
            grad.addColorStop(1, '#0a0e17');
            simCtx.fillStyle = grad;
        } else {
            const grad = simCtx.createLinearGradient(0, 0, 0, ch);
            grad.addColorStop(0, '#0f1520');
            grad.addColorStop(1, '#111827');
            simCtx.fillStyle = grad;
        }
        simCtx.fillRect(0, 0, cw, ch);

        if (!isVacuum && state.particles.length > 0) {
            const rhoFactor = state.airDensity / AIR_DENSITY_DEFAULT;
            updateParticles(cw, ch);
            for (const p of state.particles) {
                simCtx.beginPath();
                simCtx.arc(p.x, p.y, p.size * rhoFactor, 0, Math.PI * 2);
                simCtx.fillStyle = `rgba(100, 150, 200, ${p.alpha * rhoFactor})`;
                simCtx.fill();
            }
        }

        if (isVacuum) {
            simCtx.save();
            simCtx.font = "600 11px 'Outfit', sans-serif";
            simCtx.fillStyle = 'rgba(0, 229, 255, 0.25)';
            simCtx.textAlign = 'center';
            simCtx.fillText('VID', cw / 2, 22);
            simCtx.restore();
        }

        const margin = { top: 50, bottom: 50, left: 40, right: 40 };
        const simH = ch - margin.top - margin.bottom;
        const simW = cw - margin.left - margin.right;

        simCtx.save();
        simCtx.strokeStyle = 'rgba(255,255,255,0.06)';
        simCtx.lineWidth = 1;
        simCtx.setLineDash([4, 6]);
        const nMarks = 5;
        for (let i = 0; i <= nMarks; i++) {
            const yy = margin.top + (i / nMarks) * simH;
            simCtx.beginPath();
            simCtx.moveTo(margin.left - 10, yy);
            simCtx.lineTo(cw - margin.right + 10, yy);
            simCtx.stroke();

            const meters = (i / nMarks) * state.fallHeight;
            simCtx.font = "400 9px 'JetBrains Mono', monospace";
            simCtx.fillStyle = 'rgba(139, 156, 192, 0.5)';
            simCtx.textAlign = 'right';
            simCtx.fillText(meters.toFixed(0) + 'm', margin.left - 14, yy + 3);
        }
        simCtx.setLineDash([]);
        simCtx.restore();

        simCtx.save();
        simCtx.strokeStyle = 'rgba(255, 82, 82, 0.4)';
        simCtx.lineWidth = 2;
        simCtx.setLineDash([8, 4]);
        const groundY = margin.top + simH;
        simCtx.beginPath();
        simCtx.moveTo(margin.left - 15, groundY);
        simCtx.lineTo(cw - margin.right + 15, groundY);
        simCtx.stroke();
        simCtx.setLineDash([]);
        simCtx.font = "500 9px 'JetBrains Mono', monospace";
        simCtx.fillStyle = 'rgba(255, 82, 82, 0.5)';
        simCtx.textAlign = 'center';
        simCtx.fillText('SOL', cw / 2, groundY + 16);
        simCtx.restore();

        const startLineY = margin.top;
        simCtx.save();
        simCtx.strokeStyle = 'rgba(0, 230, 118, 0.3)';
        simCtx.lineWidth = 1.5;
        simCtx.setLineDash([6, 4]);
        simCtx.beginPath();
        simCtx.moveTo(margin.left - 15, startLineY);
        simCtx.lineTo(cw - margin.right + 15, startLineY);
        simCtx.stroke();
        simCtx.setLineDash([]);
        simCtx.font = "500 9px 'JetBrains Mono', monospace";
        simCtx.fillStyle = 'rgba(0, 230, 118, 0.4)';
        simCtx.textAlign = 'center';
        simCtx.fillText('START', cw / 2, startLineY - 6);
        simCtx.restore();

        if (state.obj1 && state.obj2) {
            const x1 = margin.left + simW * 0.3;
            const x2 = margin.left + simW * 0.7;

            const progress1 = state.sim1 ? state.sim1.y / state.fallHeight : 0;
            const progress2 = state.sim2 ? state.sim2.y / state.fallHeight : 0;

            const drawY1 = margin.top + progress1 * simH;
            const drawY2 = margin.top + progress2 * simH;

            const size1 = getObjectSize(state.obj1);
            const size2 = getObjectSize(state.obj2);

            drawObject(simCtx, state.obj1.shape, x1, drawY1, size1, state.obj1.color, state.obj1.name);
            drawObject(simCtx, state.obj2.shape, x2, drawY2, size2, state.obj2.color, state.obj2.name);

            if (state.running || state.finished) {
                const maxForce = Math.max(
                    state.sim1.fg, state.sim2.fg,
                    state.sim1.fd, state.sim2.fd,
                    0.001
                );

                drawForceArrow(simCtx, x1 - size1 - 12, drawY1, state.sim1.fg, maxForce, '#00e676', 'down');
                drawForceArrow(simCtx, x1 + size1 + 12, drawY1, state.sim1.fd, maxForce, '#ff5252', 'up');

                drawForceArrow(simCtx, x2 - size2 - 12, drawY2, state.sim2.fg, maxForce, '#00e676', 'down');
                drawForceArrow(simCtx, x2 + size2 + 12, drawY2, state.sim2.fd, maxForce, '#ff5252', 'up');

                if (!state.finished || !state.sim1.landed || !state.sim2.landed) {
                    simCtx.save();
                    simCtx.font = "500 9px 'JetBrains Mono', monospace";
                    simCtx.textAlign = 'left';

                    const fLabels = [
                        { x: x1 - size1 - 14, y: drawY1 + 30, val: state.sim1.fg, color: '#00e676', label: 'Fg' },
                        { x: x1 + size1 + 14, y: drawY1 - 20, val: state.sim1.fd, color: '#ff5252', label: 'Fd' },
                        { x: x2 - size2 - 14, y: drawY2 + 30, val: state.sim2.fg, color: '#00e676', label: 'Fg' },
                        { x: x2 + size2 + 14, y: drawY2 - 20, val: state.sim2.fd, color: '#ff5252', label: 'Fd' },
                    ];
                    for (const fl of fLabels) {
                        if (fl.val > 0.0001) {
                            simCtx.fillStyle = fl.color;
                            simCtx.globalAlpha = 0.6;
                            simCtx.textAlign = 'center';
                            simCtx.fillText(fl.val.toFixed(3) + 'N', fl.x, fl.y);
                        }
                    }
                    simCtx.restore();
                }
            }

            if (state.sim1 && state.sim1.landed) {
                simCtx.save();
                simCtx.beginPath();
                simCtx.arc(x1, groundY, 20, 0, Math.PI * 2);
                simCtx.fillStyle = 'rgba(0, 229, 255, 0.08)';
                simCtx.fill();
                simCtx.restore();
            }
            if (state.sim2 && state.sim2.landed) {
                simCtx.save();
                simCtx.beginPath();
                simCtx.arc(x2, groundY, 20, 0, Math.PI * 2);
                simCtx.fillStyle = 'rgba(255, 109, 0, 0.08)';
                simCtx.fill();
                simCtx.restore();
            }
        }

        if (state.running) {
            simCtx.save();
            simCtx.font = "600 13px 'JetBrains Mono', monospace";
            simCtx.fillStyle = 'rgba(226, 232, 240, 0.9)';
            simCtx.textAlign = 'right';
            simCtx.fillText('t = ' + state.time.toFixed(2) + 's', cw - margin.right, 25);
            simCtx.restore();
        }

        if (state.finished) {
            simCtx.save();
            simCtx.font = "600 13px 'JetBrains Mono', monospace";
            simCtx.fillStyle = 'rgba(0, 229, 255, 0.9)';
            simCtx.textAlign = 'right';
            simCtx.fillText('t = ' + state.time.toFixed(2) + 's', cw - margin.right, 25);
            simCtx.restore();
        }

        const legendY = ch - 10;
        simCtx.save();
        simCtx.font = "400 9px 'Outfit', sans-serif";
        simCtx.textAlign = 'left';

        simCtx.fillStyle = '#00e676';
        simCtx.fillRect(margin.left, legendY - 7, 10, 3);
        simCtx.fillText('Gravitatie', margin.left + 14, legendY - 3);

        simCtx.fillStyle = '#ff5252';
        simCtx.fillRect(margin.left + 80, legendY - 7, 10, 3);
        simCtx.fillText('Drag (frecare aer)', margin.left + 94, legendY - 3);
        simCtx.restore();

        simCtx.restore();
    }

    // ========== GRAPH RENDERING ==========

    function renderGraph() {
        const dpr = resizeCanvas(graphCanvas);
        const w = graphCanvas.width;
        const h = graphCanvas.height;
        graphCtx.save();
        graphCtx.scale(dpr, dpr);
        const cw = w / dpr;
        const ch = h / dpr;

        graphCtx.fillStyle = 'transparent';
        graphCtx.clearRect(0, 0, cw, ch);

        const margin = { top: 30, bottom: 28, left: 55, right: 20 };
        const gw = cw - margin.left - margin.right;
        const gh = ch - margin.top - margin.bottom;

        graphCtx.strokeStyle = 'rgba(255,255,255,0.08)';
        graphCtx.lineWidth = 1;

        let maxV = 10;
        let maxT = 3;
        if (state.graphData1.length > 0 || state.graphData2.length > 0) {
            for (const p of state.graphData1) {
                if (p.v > maxV) maxV = p.v;
                if (p.t > maxT) maxT = p.t;
            }
            for (const p of state.graphData2) {
                if (p.v > maxV) maxV = p.v;
                if (p.t > maxT) maxT = p.t;
            }
            maxV = Math.ceil(maxV / 5) * 5 + 5;
            maxT = Math.ceil(maxT * 2) / 2 + 0.5;
        }

        if (state.obj1 && state.obj2 && !state.running && !state.finished) {
            const vt1 = computeTerminalVelocity(state.obj1, state.airDensity);
            const vt2 = computeTerminalVelocity(state.obj2, state.airDensity);
            const maxVt = Math.max(vt1, vt2);
            if (isFinite(maxVt) && maxVt > maxV) {
                maxV = Math.ceil(maxVt / 5) * 5 + 5;
            }
        }

        const nHLines = 5;
        for (let i = 0; i <= nHLines; i++) {
            const yy = margin.top + (1 - i / nHLines) * gh;
            graphCtx.beginPath();
            graphCtx.moveTo(margin.left, yy);
            graphCtx.lineTo(margin.left + gw, yy);
            graphCtx.stroke();

            const vLabel = (i / nHLines * maxV).toFixed(0);
            graphCtx.font = "400 9px 'JetBrains Mono', monospace";
            graphCtx.fillStyle = 'rgba(139, 156, 192, 0.5)';
            graphCtx.textAlign = 'right';
            graphCtx.fillText(vLabel, margin.left - 6, yy + 3);
        }

        const nVLines = 6;
        for (let i = 0; i <= nVLines; i++) {
            const xx = margin.left + (i / nVLines) * gw;
            graphCtx.beginPath();
            graphCtx.moveTo(xx, margin.top);
            graphCtx.lineTo(xx, margin.top + gh);
            graphCtx.stroke();

            const tLabel = (i / nVLines * maxT).toFixed(1);
            graphCtx.font = "400 9px 'JetBrains Mono', monospace";
            graphCtx.fillStyle = 'rgba(139, 156, 192, 0.5)';
            graphCtx.textAlign = 'center';
            graphCtx.fillText(tLabel + 's', xx, margin.top + gh + 16);
        }

        graphCtx.save();
        graphCtx.font = "400 9px 'JetBrains Mono', monospace";
        graphCtx.fillStyle = 'rgba(139, 156, 192, 0.4)';
        graphCtx.textAlign = 'center';
        graphCtx.save();
        graphCtx.translate(14, margin.top + gh / 2);
        graphCtx.rotate(-Math.PI / 2);
        graphCtx.fillText('Viteza (m/s)', 0, 0);
        graphCtx.restore();
        graphCtx.restore();

        graphCtx.strokeStyle = 'rgba(255,255,255,0.15)';
        graphCtx.lineWidth = 1.5;
        graphCtx.beginPath();
        graphCtx.moveTo(margin.left, margin.top);
        graphCtx.lineTo(margin.left, margin.top + gh);
        graphCtx.lineTo(margin.left + gw, margin.top + gh);
        graphCtx.stroke();

        function drawCurve(data, color) {
            if (data.length < 2) return;
            graphCtx.save();
            graphCtx.strokeStyle = color;
            graphCtx.lineWidth = 2;
            graphCtx.lineJoin = 'round';
            graphCtx.beginPath();
            for (let i = 0; i < data.length; i++) {
                const px = margin.left + (data[i].t / maxT) * gw;
                const py = margin.top + (1 - data[i].v / maxV) * gh;
                if (i === 0) graphCtx.moveTo(px, py);
                else graphCtx.lineTo(px, py);
            }
            graphCtx.stroke();

            if (data.length > 0) {
                const last = data[data.length - 1];
                const lx = margin.left + (last.t / maxT) * gw;
                const ly = margin.top + (1 - last.v / maxV) * gh;
                graphCtx.beginPath();
                graphCtx.arc(lx, ly, 3.5, 0, Math.PI * 2);
                graphCtx.fillStyle = color;
                graphCtx.fill();
            }

            graphCtx.restore();
        }

        drawCurve(state.graphData1, '#00e5ff');
        drawCurve(state.graphData2, '#ff6d00');

        if (state.obj1 && state.obj2 && state.airDensity > 0.01) {
            const vt1 = computeTerminalVelocity(state.obj1, state.airDensity);
            const vt2 = computeTerminalVelocity(state.obj2, state.airDensity);

            function drawVtLine(vt, color, label) {
                if (!isFinite(vt) || vt > maxV) return;
                const yy = margin.top + (1 - vt / maxV) * gh;
                graphCtx.save();
                graphCtx.strokeStyle = color;
                graphCtx.globalAlpha = 0.3;
                graphCtx.lineWidth = 1;
                graphCtx.setLineDash([3, 4]);
                graphCtx.beginPath();
                graphCtx.moveTo(margin.left, yy);
                graphCtx.lineTo(margin.left + gw, yy);
                graphCtx.stroke();
                graphCtx.setLineDash([]);

                graphCtx.globalAlpha = 0.5;
                graphCtx.font = "400 8px 'JetBrains Mono', monospace";
                graphCtx.fillStyle = color;
                graphCtx.textAlign = 'right';
                graphCtx.fillText('Vt ' + label + ': ' + vt.toFixed(1), margin.left + gw, yy - 4);
                graphCtx.restore();
            }

            drawVtLine(vt1, '#00e5ff', state.obj1.name);
            drawVtLine(vt2, '#ff6d00', state.obj2.name);
        }

        const legX = margin.left + gw - 10;
        const legY = margin.top + 8;
        graphCtx.save();
        graphCtx.font = "500 9px 'Outfit', sans-serif";
        graphCtx.textAlign = 'right';

        if (state.obj1) {
            graphCtx.fillStyle = '#00e5ff';
            graphCtx.fillRect(legX - 52, legY - 5, 10, 3);
            graphCtx.fillText(state.obj1.name, legX, legY);
        }
        if (state.obj2) {
            graphCtx.fillStyle = '#ff6d00';
            graphCtx.fillRect(legX - 52, legY + 11, 10, 3);
            graphCtx.fillText(state.obj2.name, legX, legY + 16);
        }
        graphCtx.restore();

        graphCtx.restore();
    }

    // ========== UI UPDATES ==========

    function populateSelects() {
        [obj1Select, obj2Select].forEach((sel, idx) => {
            sel.innerHTML = '';
            OBJECTS.forEach((obj) => {
                const opt = document.createElement('option');
                opt.value = obj.id;
                opt.textContent = obj.name;
                sel.appendChild(opt);
            });
            sel.selectedIndex = idx === 0 ? 0 : OBJECTS.length - 1;
        });
    }

    function getSelectedObject(selectEl) {
        return OBJECTS.find((o) => o.id === selectEl.value) || OBJECTS[0];
    }

    function renderObjProps(container, obj, accentClass) {
        const vt = computeTerminalVelocity(obj, state.airDensity);
        const vtStr = isFinite(vt) ? vt.toFixed(1) + ' m/s' : '∞ (vid)';
        container.innerHTML = `
            <span class="prop-label">Masa</span><span class="prop-value ${accentClass}">${obj.mass < 0.01 ? (obj.mass * 1000).toFixed(1) + ' g' : obj.mass.toFixed(3) + ' kg'}</span>
            <span class="prop-label">Cd</span><span class="prop-value ${accentClass}">${obj.cd.toFixed(2)}</span>
            <span class="prop-label">Aria</span><span class="prop-value ${accentClass}">${obj.area < 0.001 ? (obj.area * 10000).toFixed(2) + ' cm²' : (obj.area * 10000).toFixed(0) + ' cm²'}</span>
            <span class="prop-label">V term.</span><span class="prop-value ${accentClass}">${vtStr}</span>
        `;
    }

    function updateDataPanel() {
        const s1 = state.sim1 || createSimState();
        const s2 = state.sim2 || createSimState();

        const fmt = (v, d) => v.toFixed(d);

        const idlePreview = !state.running && !state.finished && state.obj1 && state.obj2;

        let dFg1 = s1.fg;
        let dFg2 = s2.fg;
        let dFd1 = s1.fd;
        let dFd2 = s2.fd;
        let dA1 = s1.a;
        let dA2 = s2.a;
        if (idlePreview) {
            dFg1 = state.obj1.mass * G;
            dFg2 = state.obj2.mass * G;
            dFd1 = 0;
            dFd2 = 0;
            dA1 = G;
            dA2 = G;
        }

        dataEls.obj1Name.textContent = state.obj1 ? state.obj1.name : 'Obiect 1';
        dataEls.obj2Name.textContent = state.obj2 ? state.obj2.name : 'Obiect 2';

        dataEls.obj1Time.textContent = s1.landed && s1.landTime !== null ? fmt(s1.landTime, 2) + ' s' : fmt(state.time, 2) + ' s';
        dataEls.obj2Time.textContent = s2.landed && s2.landTime !== null ? fmt(s2.landTime, 2) + ' s' : fmt(state.time, 2) + ' s';

        dataEls.obj1Pos.textContent = fmt(s1.y, 2) + ' m';
        dataEls.obj2Pos.textContent = fmt(s2.y, 2) + ' m';

        dataEls.obj1Vel.textContent = fmt(s1.v, 2) + ' m/s';
        dataEls.obj2Vel.textContent = fmt(s2.v, 2) + ' m/s';

        dataEls.obj1Acc.textContent = fmt(dA1, 2) + ' m/s²';
        dataEls.obj2Acc.textContent = fmt(dA2, 2) + ' m/s²';

        dataEls.obj1Fg.textContent = fmt(dFg1, 4) + ' N';
        dataEls.obj2Fg.textContent = fmt(dFg2, 4) + ' N';

        dataEls.obj1Fd.textContent = fmt(dFd1, 4) + ' N';
        dataEls.obj2Fd.textContent = fmt(dFd2, 4) + ' N';

        if (state.obj1) {
            const vt1 = computeTerminalVelocity(state.obj1, state.airDensity);
            dataEls.obj1Vt.textContent = isFinite(vt1) ? fmt(vt1, 1) + ' m/s' : '∞';
        }
        if (state.obj2) {
            const vt2 = computeTerminalVelocity(state.obj2, state.airDensity);
            dataEls.obj2Vt.textContent = isFinite(vt2) ? fmt(vt2, 1) + ' m/s' : '∞';
        }

        if (s1.landed) dataEls.obj1Time.classList.add('landed');
        else dataEls.obj1Time.classList.remove('landed');
        if (s2.landed) dataEls.obj2Time.classList.add('landed');
        else dataEls.obj2Time.classList.remove('landed');
    }

    function showResult() {
        if (!state.sim1 || !state.sim2) return;
        const t1 = state.sim1.landTime;
        const t2 = state.sim2.landTime;
        if (t1 === null || t2 === null) return;

        const delta = Math.abs(t1 - t2);
        let msg;
        if (delta < 0.01) {
            msg = `Ambele au ajuns simultan! Δt = ${delta.toFixed(3)}s`;
        } else {
            const first = t1 < t2 ? state.obj1.name : state.obj2.name;
            msg = `${first} a ajuns prima! Δt = <span class="delta-time">${delta.toFixed(3)}s</span>`;
        }
        resultBanner.innerHTML = msg;
        requestAnimationFrame(() => resultBanner.classList.add('visible'));
    }

    // ========== TIPS ==========

    function showTip(index) {
        const tip = TIPS[index % TIPS.length];
        tipText.textContent = tip.text;
    }

    function applyTip() {
        const tip = TIPS[state.tipIndex % TIPS.length];
        obj1Select.value = tip.obj1;
        obj2Select.value = tip.obj2;
        onObjectChange();
    }

    // ========== SIMULATION LOOP ==========

    function startSimulation() {
        if (state.running) {
            stopSimulation();
            return;
        }

        state.obj1 = getSelectedObject(obj1Select);
        state.obj2 = getSelectedObject(obj2Select);
        state.fallHeight = parseFloat(heightInput.value) || 20;
        state.airDensity = parseFloat(airSlider.value);
        state.sim1 = createSimState();
        state.sim2 = createSimState();
        state.time = 0;
        state.graphData1 = [{ t: 0, v: 0 }];
        state.graphData2 = [{ t: 0, v: 0 }];
        state.running = true;
        state.finished = false;
        state.lastFrameTime = performance.now();
        state.accumulator = 0;

        canvasOverlay.classList.add('hidden');
        resultBanner.classList.remove('visible');
        btnStart.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> STOP';
        btnStart.classList.add('running');

        disableControls(true);
        loop();
    }

    function stopSimulation() {
        state.running = false;
        state.finished = true;
        if (state.animId) {
            cancelAnimationFrame(state.animId);
            state.animId = null;
        }
        btnStart.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> START';
        btnStart.classList.remove('running');
        disableControls(false);
    }

    function resetSimulation() {
        stopSimulation();
        state.sim1 = createSimState();
        state.sim2 = createSimState();
        state.time = 0;
        state.graphData1 = [];
        state.graphData2 = [];
        state.finished = false;
        canvasOverlay.classList.remove('hidden');
        resultBanner.classList.remove('visible');
        resultBanner.innerHTML = '';
        updateDataPanel();
        renderSimulation();
        renderGraph();
    }

    function disableControls(disabled) {
        obj1Select.disabled = disabled;
        obj2Select.disabled = disabled;
        airSlider.disabled = disabled;
        vacuumToggle.disabled = disabled;
        heightInput.disabled = disabled;
    }

    let graphSampleCounter = 0;

    function loop() {
        if (!state.running) return;

        const now = performance.now();
        let frameTime = (now - state.lastFrameTime) / 1000;
        state.lastFrameTime = now;

        if (frameTime > 0.1) frameTime = 0.1;
        state.accumulator += frameTime;

        while (state.accumulator >= DT) {
            stepPhysics(state.sim1, state.obj1, state.airDensity);
            stepPhysics(state.sim2, state.obj2, state.airDensity);
            state.time += DT;
            state.accumulator -= DT;

            graphSampleCounter++;
            if (graphSampleCounter % 4 === 0) {
                if (!state.sim1.landed) {
                    state.graphData1.push({ t: state.time, v: state.sim1.v });
                }
                if (!state.sim2.landed) {
                    state.graphData2.push({ t: state.time, v: state.sim2.v });
                }
            }
        }

        if (state.sim1.landed && state.sim2.landed) {
            state.graphData1.push({ t: state.sim1.landTime, v: 0 });
            state.graphData2.push({ t: state.sim2.landTime, v: 0 });
            stopSimulation();
            showResult();
        }

        updateDataPanel();
        renderSimulation();
        renderGraph();

        if (state.running) {
            state.animId = requestAnimationFrame(loop);
        }
    }

    // ========== EVENT HANDLERS ==========

    function onObjectChange() {
        state.obj1 = getSelectedObject(obj1Select);
        state.obj2 = getSelectedObject(obj2Select);
        renderObjProps(obj1Props, state.obj1, 'obj1-accent');
        renderObjProps(obj2Props, state.obj2, 'obj2-accent');
        dataEls.obj1Name.textContent = state.obj1.name;
        dataEls.obj2Name.textContent = state.obj2.name;
        if (!state.running && !state.finished) {
            renderSimulation();
            renderGraph();
        }
    }

    function onAirDensityChange() {
        state.airDensity = parseFloat(airSlider.value);
        airValue.textContent = state.airDensity.toFixed(3) + ' kg/m³';
        vacuumToggle.checked = state.airDensity < 0.001;
        document.body.classList.toggle('vacuum-mode', state.airDensity < 0.01);
        renderObjProps(obj1Props, state.obj1, 'obj1-accent');
        renderObjProps(obj2Props, state.obj2, 'obj2-accent');
        if (!state.running) {
            renderSimulation();
            renderGraph();
            updateDataPanel();
        }
    }

    function onVacuumToggle() {
        if (vacuumToggle.checked) {
            airSlider.value = 0;
        } else {
            airSlider.value = AIR_DENSITY_DEFAULT;
        }
        onAirDensityChange();
    }

    function onHeightChange() {
        state.fallHeight = parseFloat(heightInput.value) || 20;
        if (state.fallHeight < 1) { state.fallHeight = 1; heightInput.value = 1; }
        if (state.fallHeight > 500) { state.fallHeight = 500; heightInput.value = 500; }
        if (!state.running) {
            renderSimulation();
        }
    }

    // ========== INIT ==========

    function init() {
        populateSelects();

        obj1Select.value = 'feather';
        obj2Select.value = 'hammer';

        onObjectChange();

        obj1Select.addEventListener('change', onObjectChange);
        obj2Select.addEventListener('change', onObjectChange);
        airSlider.addEventListener('input', onAirDensityChange);
        vacuumToggle.addEventListener('change', onVacuumToggle);
        heightInput.addEventListener('change', onHeightChange);
        heightInput.addEventListener('input', onHeightChange);
        btnStart.addEventListener('click', startSimulation);
        btnReset.addEventListener('click', resetSimulation);

        btnNextTip.addEventListener('click', () => {
            state.tipIndex++;
            showTip(state.tipIndex);
            applyTip();
        });

        showTip(0);

        const rect = simCanvas.parentElement.getBoundingClientRect();
        initParticles(rect.width, rect.height);

        window.addEventListener('resize', () => {
            renderSimulation();
            renderGraph();
            initParticles(simCanvas.parentElement.getBoundingClientRect().width, simCanvas.parentElement.getBoundingClientRect().height);
        });

        renderSimulation();
        renderGraph();
        updateDataPanel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
