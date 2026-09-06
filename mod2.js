// ============================================================================
// KARAKTER: YAPRAKÇI (mod2.js) — v4
// ----------------------------------------------------------------------------
// BU SÜRÜMDE DEĞİŞENLER:
// 1) İtiş tekrar ÇOK küçüldü (50 -> 2.5) - önceki "sanki uçuyormuş gibi"
//    isteği geri alındı, en baştaki "çok çok çok az" isteğine dönüldü.
// 2) Siper hasarı 150 -> 30.
// 3) Ulti alanı süresi 6sn -> 4sn (240 kare).
// 4) Alan görseli iyileştirildi: radyal gradyan dolgu, nabız gibi atan dış
//    çember, dönen iç kesikli halka (ninja'nın alanına benzer ama kendi
//    temasında).
// 5) Yaprak mermisi görseli iyileştirildi: damar detaylı yaprak, gölge,
//    ve doğuş anında küçükten büyüğe büyüyen ("yavaş girme") animasyon.
// 6) Mermi hızı biraz daha azaltıldı (normalin %85'i -> %75'i).
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'yaprakci';
    const CHAR_COLOR = '#229954';
    const CHAR_HP = 2600;    // [VARSAYIM]
    const CHAR_SPEED = 4.2;  // [VARSAYIM]

    const LEAF_RANGE = 420 * 0.85; // 357
    const LEAF_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.75; // biraz daha yavaşlatıldı
    const MID_DAMAGE = 500;
    const SIDE_DAMAGE = 400;
    const SIDE_OFFSET = 12;
    const SIDE_DELAY_MS = 100;
    const KNOCKBACK_MAG = 2.5; // ÇOK ÇOK ÇOK az itiş - orijinal isteğe dönüldü
    const LEAF_HIT_PAD = 8;
    const OBSTACLE_DAMAGE = 30; // 150 -> 30

    const RAIN_COUNT = 6;
    const RAIN_SPREAD = Math.PI / 3;
    const RAIN_DAMAGE = 400;
    const RAIN_COOLDOWN_FRAMES = 900;

    const ULTI_ZONE_RADIUS = 114;
    const ULTI_ZONE_DURATION = 240; // 4 saniye (6sn'den kısaltıldı)
    const ULTI_ZONE_DPS = 150;
    const ULTI_SLOW_FACTOR = 0.4;
    const ULTI_BONUS_DAMAGE = 300;

    const SPAWN_GROW_FRAMES = 10; // mermi doğarken küçükten büyüğe büyüme süresi

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let leafBullets = [];
    let leafZones = [];
    let capturedAimActive = false;

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult;
        };
    }

    function spawnLeaf(x, y, angle, dmg) {
        leafBullets.push({
            x, y, sx: x, sy: y,
            vx: Math.cos(angle) * LEAF_BULLET_SPEED, vy: Math.sin(angle) * LEAF_BULLET_SPEED,
            angle, dmg, age: 0
        });
    }

    function playerInOwnZone() {
        return leafZones.some(z => getDist(player, z) < z.radius);
    }

    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);

        const fx = this.x, fy = this.y;
        const perpAngle = a + Math.PI / 2;

        spawnLeaf(fx, fy, a, MID_DAMAGE);
        this.consumeAmmo();

        setTimeout(() => {
            if (!gameStarted || this.isDead) return;
            [-SIDE_OFFSET, SIDE_OFFSET].forEach(off => {
                spawnLeaf(
                    fx + Math.cos(perpAngle) * off,
                    fy + Math.sin(perpAngle) * off,
                    a, SIDE_DAMAGE
                );
            });
        }, SIDE_DELAY_MS);
    };

    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;

        const angle = a !== undefined ? a : this.angle;
        for (let i = 0; i < RAIN_COUNT; i++) {
            const off = -RAIN_SPREAD / 2 + (RAIN_SPREAD / (RAIN_COUNT - 1)) * i;
            spawnLeaf(this.x, this.y, angle + off, RAIN_DAMAGE);
        }
        addFloatingNumber(this.x, this.y - 30, "YAPRAK YAĞMURU!", "#229954");
        this.gadgetReady = false;
        this.gadgetCooldown = RAIN_COOLDOWN_FRAMES;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
    };

    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        leafZones.push({ x: this.x, y: this.y, radius: ULTI_ZONE_RADIUS, life: ULTI_ZONE_DURATION, maxLife: ULTI_ZONE_DURATION, tickTimer: 0 });
        addFloatingNumber(this.x, this.y - 40, "YAPRAK ALANI!", "#229954");

        this.ultReady = false; this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    const originalChargeUlti = window.chargeUlti;
    window.chargeUlti = function (amount) {
        if (player.charType !== CHAR_ID) return originalChargeUlti(amount);
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge === 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", "#f1c40f");
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    };

    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Yaprakçı</span>' +
            '<small>Hasar: 500+400x2<br>Güç: Yaprak Alanı</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    chainHook('onReset', function () {
        leafBullets = [];
        leafZones = [];
    });

    const originalDraw = window.draw;
    window.draw = function () {
        capturedAimActive = aimData.active;
        const shouldSuppress = (player.charType === CHAR_ID) && aimData.active;
        if (shouldSuppress) aimData.active = false;
        originalDraw();
        if (shouldSuppress) aimData.active = true;
    };

    chainHook('onDraw', function (ctx2) {
        if (player.charType === CHAR_ID && !player.isDead && capturedAimActive && player.ammo >= 1) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(aimData.angle);
            ctx2.beginPath(); ctx2.moveTo(0, 0); ctx2.lineTo(LEAF_RANGE, 0);
            ctx2.strokeStyle = 'rgba(34, 153, 84, 0.85)'; ctx2.lineWidth = 3; ctx2.setLineDash([10, 6]);
            ctx2.stroke();
            ctx2.restore();
        }

        // --- Güzelleştirilmiş ulti alanı ---
        leafZones.forEach(z => {
            const lifeRatio = Math.max(0, z.life / z.maxLife);
            const pulse = 1 + Math.sin(Date.now() / 180) * 0.04;
            ctx2.save();
            ctx2.translate(z.x, z.y);

            // Radyal gradyan dolgu
            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, z.radius * pulse);
            grad.addColorStop(0, `rgba(46, 204, 113, ${0.28 * lifeRatio})`);
            grad.addColorStop(0.7, `rgba(34, 153, 84, ${0.18 * lifeRatio})`);
            grad.addColorStop(1, `rgba(34, 153, 84, 0)`);
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * pulse, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();

            // Dış nabız çemberi
            ctx2.globalAlpha = 0.8 * lifeRatio;
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * pulse, 0, Math.PI * 2);
            ctx2.strokeStyle = '#2ecc71'; ctx2.lineWidth = 2.5; ctx2.setLineDash([]);
            ctx2.stroke();

            // Dönen iç kesikli halka
            ctx2.rotate(Date.now() / 500);
            ctx2.globalAlpha = 0.7 * lifeRatio;
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * 0.82, 0, Math.PI * 2);
            ctx2.strokeStyle = '#a9dfbf'; ctx2.lineWidth = 2; ctx2.setLineDash([9, 14]);
            ctx2.stroke();
            ctx2.setLineDash([]);

            // İç desen: dönen küçük yaprak motifleri (üç farklı yarıçapta,
            // ters yönlerde dönerek daha "canlı" bir doku hissi verir)
            const drawMiniLeaf = (angle, dist, size) => {
                ctx2.save();
                ctx2.rotate(angle);
                ctx2.translate(dist, 0);
                ctx2.rotate(Math.PI / 2);
                ctx2.beginPath(); ctx2.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
                ctx2.fillStyle = `rgba(169, 223, 191, ${0.55 * lifeRatio})`;
                ctx2.fill();
                ctx2.beginPath(); ctx2.moveTo(-size * 0.7, 0); ctx2.lineTo(size * 0.9, 0);
                ctx2.strokeStyle = `rgba(20, 90, 50, ${0.4 * lifeRatio})`; ctx2.lineWidth = 1;
                ctx2.stroke();
                ctx2.restore();
            };
            ctx2.save();
            ctx2.rotate(-Date.now() / 700); // dışa göre ters yönde döner
            for (let i = 0; i < 5; i++) drawMiniLeaf((i * Math.PI * 2) / 5, z.radius * 0.5, 7);
            ctx2.restore();
            ctx2.save();
            ctx2.rotate(Date.now() / 900);
            for (let i = 0; i < 7; i++) drawMiniLeaf((i * Math.PI * 2) / 7, z.radius * 0.68, 5);
            ctx2.restore();

            // Merkezden dışa ince damar çizgileri (mandala benzeri doku)
            ctx2.globalAlpha = 0.25 * lifeRatio;
            ctx2.strokeStyle = '#a9dfbf'; ctx2.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const veinAngle = (i * Math.PI * 2) / 8;
                ctx2.beginPath();
                ctx2.moveTo(Math.cos(veinAngle) * z.radius * 0.15, Math.sin(veinAngle) * z.radius * 0.15);
                ctx2.lineTo(Math.cos(veinAngle) * z.radius * 0.78, Math.sin(veinAngle) * z.radius * 0.78);
                ctx2.stroke();
            }

            ctx2.restore();
        });

        // --- Güzelleştirilmiş yaprak mermisi ---
        leafBullets.forEach(b => {
            const growT = Math.min(1, (b.age || 0) / SPAWN_GROW_FRAMES);
            const scale = 0.35 + 0.65 * growT; // küçükten büyüğe
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.angle);
            ctx2.scale(scale, scale);

            // Hafif gölge
            ctx2.beginPath(); ctx2.ellipse(1, 2, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,0.25)'; ctx2.fill();

            // Ahşap sap
            ctx2.beginPath(); ctx2.moveTo(-12, 0); ctx2.lineTo(-4, 0);
            ctx2.strokeStyle = '#6b4226'; ctx2.lineWidth = 2; ctx2.stroke();

            // Yaprak gövdesi (gradyanlı)
            const leafGrad = ctx2.createLinearGradient(-6, 0, 8, 0);
            leafGrad.addColorStop(0, '#1e8449');
            leafGrad.addColorStop(1, '#2ecc71');
            ctx2.beginPath(); ctx2.ellipse(2, 0, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = leafGrad; ctx2.fill();
            ctx2.strokeStyle = '#145a32'; ctx2.lineWidth = 1.5; ctx2.stroke();

            // Orta damar
            ctx2.beginPath(); ctx2.moveTo(-6, 0); ctx2.lineTo(10, 0);
            ctx2.strokeStyle = 'rgba(20,90,50,0.6)'; ctx2.lineWidth = 1; ctx2.stroke();

            ctx2.restore();
        });
    });

    let lastTimeLeaf = 0;
    function leafLoop(t) {
        if (!lastTimeLeaf) lastTimeLeaf = t;
        const ts = Math.min(3, (t - lastTimeLeaf) / 16.666);
        lastTimeLeaf = t;
        if (gameStarted) leafUpdate(ts);
        ensureLeafUI();
        requestAnimationFrame(leafLoop);
    }
    requestAnimationFrame(leafLoop);

    function ensureLeafUI() {
        if (!gameStarted) return;
        if (player.charType === CHAR_ID) {
            if (gadgetBtn && gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';
            if (gadgetBtn && gadgetBtn.dataset.yaprakLabelSet !== '1') {
                gadgetBtn.innerHTML = 'YAPRAK<br>YAĞMURU<br><span id="gadget-timer"></span>';
                gadgetBtn.dataset.yaprakLabelSet = '1';
            }
        } else if (gadgetBtn && gadgetBtn.dataset.yaprakLabelSet === '1') {
            gadgetBtn.dataset.yaprakLabelSet = '0';
        }
    }

    function leafUpdate(ts) {
        for (let i = leafZones.length - 1; i >= 0; i--) {
            const z = leafZones[i];
            z.life -= ts;
            z.tickTimer = (z.tickTimer || 0) + ts;
            const doTick = z.tickTimer >= 60;
            if (doTick) z.tickTimer = 0;

            getActiveEnemies().forEach(e => {
                const inZone = getDist(z, e) < z.radius;
                if (inZone) {
                    e.hp -= (ULTI_ZONE_DPS / 60) * ts;
                    if (doTick) addFloatingNumber(e.x, e.y, ULTI_ZONE_DPS, "#229954");
                    if (!e._leafSlowed) {
                        e._leafOrigSpeed = e.speed;
                        e.speed = e.speed * ULTI_SLOW_FACTOR;
                        e._leafSlowed = true;
                    }
                } else if (e._leafSlowed) {
                    e.speed = e._leafOrigSpeed;
                    e._leafSlowed = false;
                }
            });

            if (z.life <= 0) {
                getActiveEnemies().forEach(e => {
                    if (e._leafSlowed) { e.speed = e._leafOrigSpeed; e._leafSlowed = false; }
                });
                leafZones.splice(i, 1);
            }
        }

        for (let i = leafBullets.length - 1; i >= 0; i--) {
            const b = leafBullets[i];
            b.age = (b.age || 0) + ts;
            b.x += b.vx * ts; b.y += b.vy * ts;

            const hw = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - (WALL_THICKNESS + 5) ||
                b.y < WALL_THICKNESS + 5 || b.y > canvas.height - (WALL_THICKNESS + 5);
            const traveled = getDist({ x: b.sx, y: b.sy }, b);
            const oor = traveled > LEAF_RANGE;

            if (hw || oor) { leafBullets.splice(i, 1); continue; }

            let hitObstacle = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(b, o) < o.radius + LEAF_HIT_PAD) {
                    o.hp -= OBSTACLE_DAMAGE;
                    hitObstacle = true;
                    break;
                }
            }
            if (hitObstacle) { leafBullets.splice(i, 1); continue; }

            let hit = false;
            for (const e of getActiveEnemies()) {
                if (getDist(b, e) < e.radius + LEAF_HIT_PAD) {
                    if (playerInOwnZone()) {
                        // DÜZELTME: artık iki kez değil, TEK vuruş + 300 sabit bonus
                        e.hp -= b.dmg; addFloatingNumber(e.x, e.y - 6, b.dmg, "#27ae60");
                        e.hp -= ULTI_BONUS_DAMAGE; addFloatingNumber(e.x, e.y + 10, ULTI_BONUS_DAMAGE, "#f1c40f");
                    } else {
                        e.hp -= b.dmg; addFloatingNumber(e.x, e.y, b.dmg, "#27ae60");
                    }
                    e.kbX = (e.kbX || 0) + Math.cos(b.angle) * KNOCKBACK_MAG;
                    e.kbY = (e.kbY || 0) + Math.sin(b.angle) * KNOCKBACK_MAG;
                    hit = true;
                    break;
                }
            }
            if (hit) { leafBullets.splice(i, 1); continue; }
        }
    }

})();
