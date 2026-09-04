// ============================================================================
// KARAKTER: KUKLACI (mod1.js) — v2 (düzeltmeler)
// ----------------------------------------------------------------------------
// Ana dosyaya dokunulmadan, ayrı script olarak çalışır.
//
// BU SÜRÜMDE DÜZELTİLENLER:
// 1) Alan yığılma hatası: kFieldActive artık ATIŞ ANINDA işaretleniyor
//    (mermi düşmeden önce ikinci atış yapılırsa da doğru "basit" davranıyor).
// 2) Ulti mesafe okuma hatası: ultiBtn'in sürükleme mesafesi (ultAim.pull)
//    ana dosyanın actionFunc'ı tarafından fireUlti'ye iletilmiyordu (sadece
//    açı iletiliyordu). Artık ultAim.pull DOĞRUDAN paylaşılan objeden
//    okunuyor, parametre olarak gelmese bile.
//    NOT: Kirpi'nin ultisi aslında ultiBtn'e basılı tutup sürüklemekle değil,
//    "ultiBtn'e dokun -> hazırlık moduna gir -> normal ateş kontrolüyle
//    (sağ joystick/fare) nişan al ve fırlat" şeklinde çalışıyor. Bu akış ana
//    dosyada ultiBtn'e ÖZEL, halihazırda bağlanmış (ve dışarıdan
//    değiştirilemeyen) bir olay dinleyicisiyle kilitli. Bu yüzden BİREBİR
//    aynı etkileşimi dışarıdan bir script ile kuramadım - ana dosyaya
//    dokunmadan mümkün değil. Bunun yerine ultiBtn'i basılı tutup sürükleme
//    ile mesafe seçme (işlevsel olarak aynı sonucu veren) bir çözüm
//    uyguladım. Ana dosyaya küçük bir hook eklenirse (örn. ultiBtn'in
//    actionFunc'ının pull'u da iletmesi) birebir Kirpi mekaniğine
//    geçirilebilir.
// 3) Nişan çizgileri: ana atış ve ulti için Kirpi tarzı kesikli çizgi +
//    iniş noktası dairesi eklendi (draw() sarmalanarak).
// 4) Çekiş mesafesine göre patlama/alan yarıçapı da büyüyüp küçülüyor.
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'kuklaci';
    const CHAR_COLOR = '#8e44ad';
    const CHAR_HP = 3200;      // [VARSAYIM]
    const CHAR_SPEED = 3.6;    // [VARSAYIM]

    const MAIN_IMPACT_DAMAGE = 700;
    const MAIN_IMPACT_RADIUS_MIN = 60;   // [VARSAYIM] yakın atışta küçük alan
    const MAIN_IMPACT_RADIUS_MAX = 120;  // [VARSAYIM] uzak atışta büyük alan
    const FIELD_DPS = 100;
    const FIELD_DURATION_FRAMES = 120; // 2 saniye
    const FIELD_RADIUS_MIN = 60;
    const FIELD_RADIUS_MAX = 120;

    const ULTI_EXPLOSION_DAMAGE = 500;  // [VARSAYIM]
    const ULTI_EXPLOSION_RADIUS_MIN = 90;   // [VARSAYIM]
    const ULTI_EXPLOSION_RADIUS_MAX = 170;  // [VARSAYIM]
    const PUPPET_HP = 400;
    const PUPPET_DAMAGE = 700;
    const PUPPET_ATTACK_INTERVAL = 72;  // [VARSAYIM]
    const PUPPET_SPEED = 2.5;           // [VARSAYIM]
    const PUPPET_RADIUS = 18;
    const PUPPET_SOAK_DAMAGE = 150;     // [VARSAYIM]

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let kBolts = [];
    let kZones = [];
    let kPuppets = [];

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

    function lerp(a, b, t) { return a + (b - a) * t; }

    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);

        let pullMag = Math.min(1, Math.hypot(aimData.x, aimData.y));
        if (aimData.isMouse || pullMag < 0.1) pullMag = 1;
        const targetDist = Math.max(70, pullMag * RANGE * 0.78);
        const targetX = this.x + Math.cos(a) * targetDist;
        const targetY = this.y + Math.sin(a) * targetDist;

        const isSimple = !!this.kFieldActive;
        if (!isSimple) this.kFieldActive = true;

        kBolts.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            targetX, targetY, flightProgress: 0, isLanded: false,
            isUlti: false, simple: isSimple, pullMag
        });
        this.consumeAmmo();
    };

    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        let pullMag = (pullOverride !== undefined) ? pullOverride
            : (ultAim && ultAim.pull !== undefined ? Math.max(0, Math.min(1, ultAim.pull)) : 1);
        if (pullMag < 0.05) pullMag = 1;

        const targetDist = Math.max(70, RANGE * 0.9 * pullMag);
        const tx = clampPos(this.x + Math.cos(a) * targetDist, WALL_THICKNESS + 45, canvas.width - WALL_THICKNESS - 45);
        const ty = clampPos(this.y + Math.sin(a) * targetDist, WALL_THICKNESS + 45, canvas.height - WALL_THICKNESS - 45);

        kBolts.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            targetX: tx, targetY: ty, flightProgress: 0, isLanded: false,
            isUlti: true, simple: false, pullMag
        });
        addFloatingNumber(this.x, this.y - 40, "KUKLA ÇAĞRISI!", "#8e44ad");

        this.ultReady = false; this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) this.kFieldActive = false;
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

    const originalStartGame = window.startGame;
    window.startGame = function () {
        originalStartGame();
        if (selectedCharacter === CHAR_ID) {
            if (ultiBtn) ultiBtn.style.display = 'flex';
        }
        kBolts = []; kZones = []; kPuppets = [];
    };

    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Kuklacı</span>' +
            '<small>Hasar: 700+Alan<br>Güç: Kukla Ordusu</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    chainHook('onReset', function () {
        kBolts = []; kZones = []; kPuppets = [];
        if (player) player.kFieldActive = false;
    });

    chainHook('onDraw', function (ctx2) {
        if (player.charType === CHAR_ID && !player.isDead && aimData.active && player.ammo >= 1) {
            let pullMag = Math.min(1, Math.hypot(aimData.x, aimData.y));
            if (aimData.isMouse || pullMag < 0.1) pullMag = 1;
            const targetDist = Math.max(70, pullMag * RANGE * 0.78);
            const tx = player.x + Math.cos(aimData.angle) * targetDist;
            const ty = player.y + Math.sin(aimData.angle) * targetDist;
            const rad = lerp(MAIN_IMPACT_RADIUS_MIN, MAIN_IMPACT_RADIUS_MAX, pullMag);
            drawTargetPreview(ctx2, player.x, player.y, tx, ty, rad, '#8e44ad', 'rgba(142,68,173,0.28)');
        }
        if (player.charType === CHAR_ID && !player.isDead && ultAim.active && player.ultReady) {
            let pullMag = Math.max(0, Math.min(1, ultAim.pull !== undefined ? ultAim.pull : 1));
            if (pullMag < 0.05) pullMag = 1;
            const targetDist = Math.max(70, RANGE * 0.9 * pullMag);
            const tx = player.x + Math.cos(ultAim.angle) * targetDist;
            const ty = player.y + Math.sin(ultAim.angle) * targetDist;
            const rad = lerp(ULTI_EXPLOSION_RADIUS_MIN, ULTI_EXPLOSION_RADIUS_MAX, pullMag);
            drawTargetPreview(ctx2, player.x, player.y, tx, ty, rad, '#6c3483', 'rgba(108,52,131,0.28)');
        }

        kZones.forEach(z => {
            ctx2.save();
            ctx2.translate(z.x, z.y);
            ctx2.globalAlpha = Math.min(0.5, z.life / 30);
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#8e44ad'; ctx2.fill();
            ctx2.strokeStyle = '#c39bd3'; ctx2.lineWidth = 2; ctx2.setLineDash([8, 10]); ctx2.stroke();
            ctx2.restore();
        });
        kBolts.forEach(b => {
            if (b.isLanded) return;
            const h = Math.sin((b.flightProgress || 0) * Math.PI);
            const scale = 1 + h * 1.1;
            ctx2.save();
            ctx2.translate(b.x, b.y + h * 22);
            ctx2.beginPath(); ctx2.ellipse(0, 22, 10, 4, 0, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,0.3)'; ctx2.fill();
            ctx2.scale(scale, scale);
            ctx2.beginPath(); ctx2.arc(0, 0, b.isUlti ? 13 : 9, 0, Math.PI * 2);
            ctx2.fillStyle = b.isUlti ? '#6c3483' : '#8e44ad';
            ctx2.fill();
            ctx2.strokeStyle = '#c39bd3'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });
        kPuppets.forEach(p => {
            ctx2.save();
            ctx2.translate(p.x, p.y);
            ctx2.fillStyle = '#444'; ctx2.fillRect(-16, -p.radius - 12, 32, 4);
            ctx2.fillStyle = '#8e44ad'; ctx2.fillRect(-16, -p.radius - 12, Math.max(0, p.hp) / p.maxHp * 32, 4);
            ctx2.beginPath(); ctx2.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#a569bd'; ctx2.fill();
            ctx2.strokeStyle = '#5b2c6f'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        });
    });

    function drawTargetPreview(ctx2, sx, sy, tx, ty, radius, strokeColor, fillColor) {
        ctx2.save();
        ctx2.beginPath(); ctx2.moveTo(sx, sy); ctx2.lineTo(tx, ty);
        ctx2.strokeStyle = 'rgba(255,255,255,0.3)'; ctx2.lineWidth = 2; ctx2.setLineDash([5, 5]); ctx2.stroke();
        ctx2.beginPath(); ctx2.arc(tx, ty, radius, 0, Math.PI * 2);
        ctx2.fillStyle = fillColor; ctx2.fill();
        ctx2.strokeStyle = strokeColor; ctx2.lineWidth = 2; ctx2.setLineDash([]); ctx2.stroke();
        ctx2.restore();
    }

    let kLastTime = 0;
    function kLoop(t) {
        if (!kLastTime) kLastTime = t;
        const ts = Math.min(3, (t - kLastTime) / 16.666);
        kLastTime = t;
        if (gameStarted) kUpdate(ts);
        requestAnimationFrame(kLoop);
    }
    requestAnimationFrame(kLoop);

    function kUpdate(ts) {
        for (let i = kBolts.length - 1; i >= 0; i--) {
            const b = kBolts[i];
            const d = getDist(b, { x: b.targetX, y: b.targetY });
            const move = PLAYER_BULLET_SPEED * 1.3 * ts;
            if (d <= move) {
                b.x = b.targetX; b.y = b.targetY; b.isLanded = true;
                landBolt(b);
                kBolts.splice(i, 1);
            } else {
                const ang = Math.atan2(b.targetY - b.y, b.targetX - b.x);
                b.x += Math.cos(ang) * move; b.y += Math.sin(ang) * move;
                const totalDist = getDist({ x: b.sx, y: b.sy }, { x: b.targetX, y: b.targetY }) || 1;
                b.flightProgress = 1 - (d / totalDist);
            }
        }

        for (let i = kZones.length - 1; i >= 0; i--) {
            const z = kZones[i];
            z.life -= ts;
            z.tickTimer = (z.tickTimer || 0) + ts;
            const doTick = z.tickTimer >= 60;
            if (doTick) z.tickTimer = 0;
            getActiveEnemies().forEach(e => {
                if (getDist(z, e) < z.radius) {
                    e.hp -= (FIELD_DPS / 60) * ts;
                    if (doTick) addFloatingNumber(e.x, e.y, FIELD_DPS, "#8e44ad");
                }
            });
            if (z.life <= 0) kZones.splice(i, 1);
        }
        const pendingFieldBolt = kBolts.some(b => !b.isUlti && !b.simple);
        if (kZones.length === 0 && !pendingFieldBolt && player) player.kFieldActive = false;

        for (let i = kPuppets.length - 1; i >= 0; i--) {
            const p = kPuppets[i];
            if (p.hp <= 0) {
                spawnParticles(p.x, p.y, '#8e44ad');
                kPuppets.splice(i, 1);
                continue;
            }
            const enemies = getActiveEnemies();
            let nearest = null, nearestDist = Infinity;
            enemies.forEach(e => {
                const dd = getDist(p, e);
                if (dd < nearestDist) { nearestDist = dd; nearest = e; }
            });
            p.attackCooldown = Math.max(0, (p.attackCooldown || 0) - ts);
            if (nearest) {
                const attackRange = p.radius + nearest.radius + 8;
                if (nearestDist > attackRange) {
                    const ang = Math.atan2(nearest.y - p.y, nearest.x - p.x);
                    p.x += Math.cos(ang) * PUPPET_SPEED * ts;
                    p.y += Math.sin(ang) * PUPPET_SPEED * ts;
                } else if (p.attackCooldown <= 0) {
                    nearest.hp -= PUPPET_DAMAGE;
                    addFloatingNumber(nearest.x, nearest.y, PUPPET_DAMAGE, "#8e44ad");
                    p.attackCooldown = PUPPET_ATTACK_INTERVAL;
                }
            }
            for (let j = botBullets.length - 1; j >= 0; j--) {
                const bb = botBullets[j];
                if (getDist(bb, p) < p.radius + 10) {
                    p.hp -= PUPPET_SOAK_DAMAGE;
                    addFloatingNumber(p.x, p.y, PUPPET_SOAK_DAMAGE, "#e74c3c");
                    botBullets.splice(j, 1);
                    break;
                }
            }
        }
    }

    function landBolt(b) {
        spawnParticles(b.x, b.y, b.isUlti ? '#6c3483' : '#8e44ad', b.isUlti ? 'smoke' : 'normal');

        if (b.isUlti) {
            screenShake = 12;
            const explosionRadius = lerp(ULTI_EXPLOSION_RADIUS_MIN, ULTI_EXPLOSION_RADIUS_MAX, b.pullMag !== undefined ? b.pullMag : 1);
            getActiveEnemies().forEach(e => {
                if (getDist(b, e) < explosionRadius + e.radius) {
                    e.hp -= ULTI_EXPLOSION_DAMAGE;
                    addFloatingNumber(e.x, e.y, ULTI_EXPLOSION_DAMAGE, "#6c3483");
                }
            });
            const enemiesAtCast = getActiveEnemies();
            enemiesAtCast.forEach(e => {
                kPuppets.push({
                    x: e.x, y: e.y, radius: PUPPET_RADIUS,
                    hp: PUPPET_HP, maxHp: PUPPET_HP, attackCooldown: 0
                });
            });
            addFloatingNumber(b.x, b.y - 20, "KUKLALAR GELDİ!", "#8e44ad");
            return;
        }

        const impactRadius = lerp(MAIN_IMPACT_RADIUS_MIN, MAIN_IMPACT_RADIUS_MAX, b.pullMag !== undefined ? b.pullMag : 1);
        getActiveEnemies().forEach(e => {
            if (getDist(b, e) < impactRadius + e.radius) {
                e.hp -= MAIN_IMPACT_DAMAGE;
                addFloatingNumber(e.x, e.y, MAIN_IMPACT_DAMAGE, "#8e44ad");
            }
        });

        if (b.simple) return;

        const fieldRadius = lerp(FIELD_RADIUS_MIN, FIELD_RADIUS_MAX, b.pullMag !== undefined ? b.pullMag : 1);
        kZones.push({ x: b.x, y: b.y, radius: fieldRadius, life: FIELD_DURATION_FRAMES, tickTimer: 0 });
    }

})();
