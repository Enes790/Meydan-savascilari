<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>KOLEKSİYONCU - Öğretici Oda Prototipi</title>
<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#05070a; font-family:'Segoe UI',Arial,sans-serif; touch-action:none; -webkit-user-select:none; user-select:none; }
    #gameCanvas { display:block; width:100%; height:100%; touch-action:none; }

    /* ==== TALİMAT PANELİ ==== */
    #tutorialPanel {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 15, 25, 0.92);
        border: 2px solid #3e5078;
        border-radius: 8px;
        padding: 12px 20px;
        color: #e8f4ff;
        font-size: clamp(0.9rem, 3vw, 1.1rem);
        text-align: center;
        max-width: 90%;
        z-index: 30;
        pointer-events: none;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        transition: opacity 0.3s;
    }
    #tutorialPanel.hidden { opacity: 0; }
    #tutorialPanel .step-num {
        color: #f1c40f;
        font-weight: 700;
        font-size: 0.85em;
        letter-spacing: 0.1em;
        display: block;
        margin-bottom: 4px;
    }
    #tutorialPanel .task-text {
        line-height: 1.4;
    }

    /* ==== GÖREV LİSTESİ ==== */
    #taskList {
        position: absolute;
        top: 20px;
        left: 20px;
        background: rgba(10, 15, 25, 0.85);
        border: 1px solid #2e3d5e;
        border-radius: 6px;
        padding: 10px 14px;
        z-index: 30;
        font-size: clamp(0.75rem, 2.5vw, 0.9rem);
        pointer-events: none;
    }
    #taskList .task {
        color: #6f7d92;
        margin: 3px 0;
        letter-spacing: 0.04em;
    }
    #taskList .task.done {
        color: #2ecc71;
        text-decoration: line-through;
    }
    #taskList .task.active {
        color: #f1c40f;
        font-weight: 700;
    }

    /* ==== JOYSTICK VURGU (aktif adım için) ==== */
    .joystick-glow {
        position: absolute;
        bottom: 60px;
        width: 140px;
        height: 140px;
        border-radius: 50%;
        pointer-events: none;
        border: 3px dashed #f1c40f;
        animation: pulseGlow 1.2s ease-in-out infinite;
        z-index: 25;
        opacity: 0;
        transition: opacity 0.3s;
    }
    .joystick-glow.visible { opacity: 1; }
    #leftGlow { left: 30px; }
    #rightGlow { right: 30px; }
    @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(241,196,15,0.6); }
        50% { box-shadow: 0 0 0 15px rgba(241,196,15,0); }
    }
</style>
</head>
<body>

<canvas id="gameCanvas"></canvas>

<div id="taskList">
    <div class="task active" id="task-1">1. Hareket etmeyi öğren</div>
    <div class="task" id="task-2">2. Sis botunu yok et</div>
    <div class="task" id="task-3">3. Anahtarı al</div>
    <div class="task" id="task-4">4. Kapıyı aç</div>
</div>

<div id="tutorialPanel">
    <span class="step-num" id="stepNum">ADIM 1</span>
    <span class="task-text" id="stepText">Hareket etmek için SOL joystick'i kullan</span>
</div>

<div id="leftGlow" class="joystick-glow"></div>
<div id="rightGlow" class="joystick-glow"></div>

<script>
(function() {
    'use strict';

    // ==========================================
    // SABİTLER
    // ==========================================
    const ROOM_WIDTH = 600;
    const ROOM_HEIGHT = 800;
    const WALL_THICKNESS = 30;
    const CAMERA_ZOOM = 0.85;

    const player = {
        x: ROOM_WIDTH / 2,
        y: ROOM_HEIGHT - 150,
        radius: 20,
        speed: 220,
        angle: 0,
        ammo: 1,
        maxAmmo: 1,
        reloadSpeed: 0.008,
        lastShot: 0
    };

    // Sis botu (öğretici düşman)
    const sisBotu = {
        x: ROOM_WIDTH / 2,
        y: 200,
        radius: 32,
        hp: 1200,
        maxHp: 1200,
        isDead: false,
        angle: 0,
        lastShot: 0,
        shootInterval: 2200,
        isActive: false,
        color: '#7f8c8d',
        bullets: []
    };

    const playerBullets = [];
    let particles = [];

    // Kapı
    const kapi = {
        x: ROOM_WIDTH / 2 - 60,
        y: 0,
        width: 120,
        height: WALL_THICKNESS,
        acik: false
    };

    // Anahtar
    const anahtar = {
        x: ROOM_WIDTH / 2,
        y: 100,
        radius: 14,
        alindi: false
    };

    // ==========================================
    // ÖĞRETİM DURUMU (TUTORIAL STATE)
    // ==========================================
    const tutorial = {
        step: 1,          // 1-4 arası
        moveLearned: false,
        moveThreshold: 1.5, // 1.5 saniye hareket edince öğrenilmiş sayılır
        moveTimer: 0,
        shootLearned: false,
        keyLearned: false,
        doorLearned: false,
        completed: false
    };

    // ==========================================
    // KAMERA
    // ==========================================
    const camera = { x: player.x, y: player.y };
    const cameraLerp = 4;

    // ==========================================
    // CANVAS
    // ==========================================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ==========================================
    // JOYSTICK SİSTEMİ
    // ==========================================
    const joystickConfig = {
        baseRadius: 55,
        stickRadius: 22,
        maxStickDistance: 45,
        deadZone: 0.15
    };

    const leftJoystick = { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0, pointerId: null };
    const rightJoystick = { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0, pointerId: null };
    const pointerMap = new Map();

    function getCanvasCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        const isLeft = x < canvas.width / 2;
        const joy = isLeft ? leftJoystick : rightJoystick;
        if (joy.active) return;
        joy.active = true;
        joy.baseX = x;
        joy.baseY = y;
        joy.stickX = 0;
        joy.stickY = 0;
        joy.pointerId = e.pointerId;
        pointerMap.set(e.pointerId, isLeft ? 'left' : 'right');
    });

    canvas.addEventListener('pointermove', e => {
        e.preventDefault();
        const side = pointerMap.get(e.pointerId);
        if (!side) return;
        const joy = side === 'left' ? leftJoystick : rightJoystick;
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        let dx = x - joy.baseX;
        let dy = y - joy.baseY;
        const dist = Math.hypot(dx, dy);
        const maxDist = joystickConfig.maxStickDistance;
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
        let nx = dx / maxDist;
        let ny = dy / maxDist;
        const mag = Math.hypot(nx, ny);
        if (mag < joystickConfig.deadZone) { nx = 0; ny = 0; }
        joy.stickX = nx;
        joy.stickY = ny;
    });

    function releasePointer(e) {
        e.preventDefault();
        const side = pointerMap.get(e.pointerId);
        if (side) {
            const joy = side === 'left' ? leftJoystick : rightJoystick;
            joy.active = false;
            joy.stickX = 0;
            joy.stickY = 0;
            joy.pointerId = null;
            pointerMap.delete(e.pointerId);
        }
    }
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);

    // ==========================================
    // ATEŞ ETME
    // ==========================================
    function firePlayerBullet(angle) {
        if (player.ammo < 1) return;
        player.ammo--;
        player.lastShot = performance.now();
        playerBullets.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * 500,
            vy: Math.sin(angle) * 500,
            radius: 6,
            life: 1.2
        });
        spawnParticles(player.x, player.y, '#f1c40f', 5);
    }

    // ==========================================
    // PARTİKÜLLER
    // ==========================================
    function spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 50 + Math.random() * 150;
            particles.push({
                x, y,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.7,
                color,
                size: 2 + Math.random() * 3
            });
        }
    }

    // ==========================================
    // GÜNCELLEME
    // ==========================================
    let lastTime = 0;

    function update(dt) {
        // Oyuncu hareket
        const mx = leftJoystick.stickX;
        const my = leftJoystick.stickY;
        const isMoving = Math.hypot(mx, my) > joystickConfig.deadZone;

        if (isMoving) {
            player.x += mx * player.speed * dt;
            player.y += my * player.speed * dt;
            player.angle = Math.atan2(my, mx);
            tutorial.moveTimer += dt;
            if (tutorial.moveTimer >= tutorial.moveThreshold && !tutorial.moveLearned) {
                tutorial.moveLearned = true;
                advanceStep();
            }
        }

        // Sağ joystick ile nişan + ateş
        const rx = rightJoystick.stickX;
        const ry = rightJoystick.stickY;
        const rightMag = Math.hypot(rx, ry);
        if (rightMag > joystickConfig.deadZone) {
            player.angle = Math.atan2(ry, rx);
            // Otomatik ateş (cephane varsa)
            if (player.ammo >= 1 && performance.now() - player.lastShot > 300) {
                firePlayerBullet(player.angle);
                if (!tutorial.shootLearned) {
                    tutorial.shootLearned = true;
                }
            }
        }

        // Cephane yenileme
        if (player.ammo < player.maxAmmo) {
            player.ammo += player.reloadSpeed * dt * 60;
            if (player.ammo > player.maxAmmo) player.ammo = player.maxAmmo;
        }

        // Duvarlara sınırlama
        player.x = Math.max(WALL_THICKNESS + player.radius, Math.min(ROOM_WIDTH - WALL_THICKNESS - player.radius, player.x));
        const minY = kapi.acik && player.x > kapi.x && player.x < kapi.x + kapi.width
            ? -100
            : WALL_THICKNESS + player.radius;
        player.y = Math.max(minY, Math.min(ROOM_HEIGHT - WALL_THICKNESS - player.radius, player.y));

        // Kamera takip
        const lerpF = 1 - Math.exp(-dt * cameraLerp);
        camera.x += (player.x - camera.x) * lerpF;
        camera.y += (player.y - camera.y) * lerpF;

        // Sis botu aktif olma (adım 2'ye geçince)
        if (tutorial.step >= 2 && !sisBotu.isDead) {
            sisBotu.isActive = true;
        }

        // Sis botu güncelleme
        if (sisBotu.isActive && !sisBotu.isDead) {
            sisBotu.angle = Math.atan2(player.y - sisBotu.y, player.x - sisBotu.x);
            // Ateş
            if (performance.now() - sisBotu.lastShot > sisBotu.shootInterval) {
                sisBotu.lastShot = performance.now();
                const ang = sisBotu.angle + (Math.random() - 0.5) * 0.2;
                sisBotu.bullets.push({
                    x: sisBotu.x, y: sisBotu.y,
                    vx: Math.cos(ang) * 180,
                    vy: Math.sin(ang) * 180,
                    radius: 8,
                    life: 3
                });
            }
        }

        // Sis botu mermileri
        for (let i = sisBotu.bullets.length - 1; i >= 0; i--) {
            const b = sisBotu.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0 || b.x < 0 || b.x > ROOM_WIDTH || b.y < 0 || b.y > ROOM_HEIGHT) {
                sisBotu.bullets.splice(i, 1);
                continue;
            }
            if (Math.hypot(b.x - player.x, b.y - player.y) < b.radius + player.radius) {
                spawnParticles(player.x, player.y, '#e74c3c', 8);
                sisBotu.bullets.splice(i, 1);
            }
        }

        // Oyuncu mermileri
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const b = playerBullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0 || b.x < 0 || b.x > ROOM_WIDTH || b.y < 0 || b.y > ROOM_HEIGHT) {
                playerBullets.splice(i, 1);
                continue;
            }
            // Sis botuna çarpma
            if (!sisBotu.isDead && Math.hypot(b.x - sisBotu.x, b.y - sisBotu.y) < b.radius + sisBotu.radius) {
                sisBotu.hp -= 400;
                spawnParticles(b.x, b.y, '#e67e22', 6);
                playerBullets.splice(i, 1);
                if (sisBotu.hp <= 0) {
                    sisBotu.isDead = true;
                    sisBotu.isActive = false;
                    spawnParticles(sisBotu.x, sisBotu.y, '#7f8c8d', 20);
                    if (tutorial.step === 2) advanceStep();
                }
            }
        }

        // Anahtar alma
        if (!anahtar.alindi && Math.hypot(player.x - anahtar.x, player.y - anahtar.y) < anahtar.radius + player.radius + 10) {
            anahtar.alindi = true;
            if (tutorial.step === 3) advanceStep();
        }

        // Kapı açma
        if (anahtar.alindi && !kapi.acik && player.y < kapi.y + kapi.height + 30
            && player.x > kapi.x - 20 && player.x < kapi.x + kapi.width + 20) {
            kapi.acik = true;
            if (tutorial.step === 4) advanceStep();
        }

        // Partiküller
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ==========================================
    // ÖĞRETİM ADIMLARI
    // ==========================================
    const stepTexts = {
        1: 'Hareket etmek için SOL joystick\'i kullan',
        2: 'Sağ joystick\'i sürükleyerek nişan al ve SİS BOTUNU yok et',
        3: 'Yukarıdaki ANAHTARI al',
        4: 'Yukarıdaki KAPIYI aç (anahtarı aldın)'
    };

    function advanceStep() {
        if (tutorial.step >= 4) {
            tutorial.completed = true;
            document.getElementById('tutorialPanel').classList.add('hidden');
            document.getElementById('task-4').classList.remove('active');
            document.getElementById('task-4').classList.add('done');
            setTimeout(() => {
                const panel = document.getElementById('tutorialPanel');
                panel.classList.remove('hidden');
                document.getElementById('stepNum').textContent = 'TEBRİKLER';
                document.getElementById('stepText').textContent = 'Öğretici tamamlandı! Koridora ilerleyebilirsin.';
                setTimeout(() => panel.classList.add('hidden'), 3000);
            }, 400);
            return;
        }
        tutorial.step++;
        // Görev listesi güncelle
        document.getElementById('task-' + (tutorial.step - 1)).classList.remove('active');
        document.getElementById('task-' + (tutorial.step - 1)).classList.add('done');
        document.getElementById('task-' + tutorial.step).classList.add('active');
        // Panel güncelle
        document.getElementById('stepNum').textContent = 'ADIM ' + tutorial.step;
        document.getElementById('stepText').textContent = stepTexts[tutorial.step];
        // Joystick vurgu
        updateJoystickGlow();
    }

    function updateJoystickGlow() {
        const leftGlow = document.getElementById('leftGlow');
        const rightGlow = document.getElementById('rightGlow');
        leftGlow.classList.remove('visible');
        rightGlow.classList.remove('visible');
        if (tutorial.step === 1) leftGlow.classList.add('visible');
        if (tutorial.step === 2) rightGlow.classList.add('visible');
    }
    updateJoystickGlow();

    // ==========================================
    // ÇİZİM
    // ==========================================
    function draw() {
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // Kamerayı merkeze al
        const cx = canvas.width / 2 - camera.x * CAMERA_ZOOM;
        const cy = canvas.height / 2 - camera.y * CAMERA_ZOOM;
        ctx.translate(cx, cy);
        ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);

        // Zemin
        ctx.fillStyle = '#16202b';
        ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

        // Duvar desenleri
        ctx.strokeStyle = '#0e1620';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < ROOM_WIDTH; gx += 40) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, ROOM_HEIGHT);
            ctx.stroke();
        }
        for (let gy = 0; gy < ROOM_HEIGHT; gy += 40) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(ROOM_WIDTH, gy);
            ctx.stroke();
        }

        // Duvarlar
        ctx.fillStyle = '#05080c';
        ctx.fillRect(0, 0, WALL_THICKNESS, ROOM_HEIGHT);
        ctx.fillRect(ROOM_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, ROOM_HEIGHT);
        ctx.fillRect(0, ROOM_HEIGHT - WALL_THICKNESS, ROOM_WIDTH, WALL_THICKNESS);

        // Üst duvar (kapı hariç)
        if (kapi.acik) {
            ctx.fillRect(0, 0, kapi.x, WALL_THICKNESS);
            ctx.fillRect(kapi.x + kapi.width, 0, ROOM_WIDTH - (kapi.x + kapi.width), WALL_THICKNESS);
        } else {
            ctx.fillRect(0, 0, ROOM_WIDTH, WALL_THICKNESS);
        }

        // Kapı
        if (!kapi.acik) {
            ctx.fillStyle = anahtar.alindi ? '#2ecc71' : '#5d6d7e';
            ctx.fillRect(kapi.x, kapi.y, kapi.width, kapi.height);
            // Kilit simgesi
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(kapi.x + kapi.width / 2, kapi.y + kapi.height / 2, 6, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#1a3a1a';
            ctx.fillRect(kapi.x, kapi.y, kapi.width, kapi.height);
            // Açık işareti
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.arc(kapi.x + kapi.width / 2, kapi.y + kapi.height / 2, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Anahtar
        if (!anahtar.alindi) {
            const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
            ctx.save();
            ctx.translate(anahtar.x, anahtar.y);
            ctx.scale(pulse, pulse);
            // Parlama
            ctx.beginPath();
            ctx.arc(0, 0, anahtar.radius + 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(241,196,15,0.15)';
            ctx.fill();
            // Anahtar gövdesi
            ctx.beginPath();
            ctx.arc(0, 0, anahtar.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#f1c40f';
            ctx.fill();
            ctx.strokeStyle = '#d4ac0d';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Delik
            ctx.beginPath();
            ctx.arc(0, 0, anahtar.radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#0a0a0a';
            ctx.fill();
            ctx.restore();
        }

        // Sis botu
        if (!sisBotu.isDead && sisBotu.isActive) {
            ctx.save();
            ctx.translate(sisBotu.x, sisBotu.y);
            // Sis bulutu
            for (let i = 0; i < 3; i++) {
                const ang = performance.now() / 500 + i * 2.1;
                ctx.beginPath();
                ctx.arc(Math.cos(ang) * 12, Math.sin(ang) * 12, sisBotu.radius * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(127, 140, 141, ${0.3 - i * 0.08})`;
                ctx.fill();
            }
            // Ana gövde
            ctx.beginPath();
            ctx.arc(0, 0, sisBotu.radius, 0, Math.PI * 2);
            ctx.fillStyle = sisBotu.color;
            ctx.fill();
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 3;
            ctx.stroke();
            // Gözler
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(-8, -4, 4, 0, Math.PI * 2);
            ctx.arc(8, -4, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Can barı
            const barW = 60;
            const barX = sisBotu.x - barW / 2;
            const barY = sisBotu.y - sisBotu.radius - 15;
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(barX, barY, barW, 6);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(barX, barY, barW * (sisBotu.hp / sisBotu.maxHp), 6);
        }

        // Sis botu mermileri
        sisBotu.bullets.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#95a5a6';
            ctx.fill();
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Oyuncu mermileri
        playerBullets.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#f1c40f';
            ctx.fill();
            ctx.strokeStyle = '#d4ac0d';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Oyuncu
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.beginPath();
        ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#3e5c76';
        ctx.fill();
        ctx.strokeStyle = '#1f2d3d';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Nişan oku
        ctx.rotate(player.angle);
        ctx.beginPath();
        ctx.moveTo(player.radius - 4, 0);
        ctx.lineTo(player.radius + 14, 0);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();
        // Ok başı
        ctx.beginPath();
        ctx.moveTo(player.radius + 16, 0);
        ctx.lineTo(player.radius + 8, -7);
        ctx.lineTo(player.radius + 8, 7);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        // Partiküller
        particles.forEach(p => {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.restore();

        // Joystick'ler (ekran koordinatında)
        drawJoystick(leftJoystick);
        drawJoystick(rightJoystick);
    }

    function drawJoystick(joy) {
        if (!joy.active) return;
        // Base
        ctx.beginPath();
        ctx.arc(joy.baseX, joy.baseY, joystickConfig.baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Stick
        const sx = joy.baseX + joy.stickX * joystickConfig.maxStickDistance;
        const sy = joy.baseY + joy.stickY * joystickConfig.maxStickDistance;
        ctx.beginPath();
        ctx.arc(sx, sy, joystickConfig.stickRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(241,196,15,0.6)';
        ctx.fill();
    }

    // ==========================================
    // OYUN DÖNGÜSÜ
    // ==========================================
    function gameLoop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        update(dt);
        draw();
        requestAnimationFrame(gameLoop);
    }

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);

})();
</script>
</body>
</html>