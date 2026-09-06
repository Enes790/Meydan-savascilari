// ============================================================================
// KARAKTER: YAPRAKÇI (mod2.js) — v3
// ----------------------------------------------------------------------------
// BU SÜRÜMDE DEĞİŞENLER:
// 1) "Süper hasar" geri alındı - MID/SIDE/RAIN hasarları orijinal değerlere
//    (500/400/400) döndü. İtiş (KNOCKBACK_MAG=50) olduğu gibi bırakıldı
//    (geri alınması istenmedi).
// 2) ULTİ eklendi: Ninja'nın zaman alanıyla aynı yarıçapta (114) bir alan
//    oluşturur. Alandaki düşmanlar saniyede 150 hasar alır VE yavaşlar.
//    Oyuncu kendi alanının içindeyken attığı yapraklar düşmana İKİ KEZ
//    vurur, artı 300 sabit bonus hasar ekler.
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'yaprakci';
    const CHAR_COLOR = '#229954';
    const CHAR_HP = 2600;    // [VARSAYIM]
    const CHAR_SPEED = 4.2;  // [VARSAYIM]

    const LEAF_RANGE = 420 * 0.85; // 357 (önceki turda %15 küçültülmüştü)
    const LEAF_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.85;
    const MID_DAMAGE = 500;   // orijinaline döndürüldü
    const SIDE_DAMAGE = 400;  // orijinaline döndürüldü
    const SIDE_OFFSET = 12;
    const SIDE_DELAY_MS = 100;
    const KNOCKBACK_MAG = 50; // önceki turda istenen güçlü itiş - korunuyor
    const LEAF_HIT_PAD = 8;
    const OBSTACLE_DAMAGE = 150;

    const RAIN_COUNT = 6;
    const RAIN_SPREAD = Math.PI / 3;
    const RAIN_DAMAGE = 400; // yan yaprak hasarıyla eşleştirildi (orijinal)
    const RAIN_COOLDOWN_FRAMES = 900;

    // Ulti sabitleri
    const ULTI_ZONE_RADIUS = 114; // "ninjaninki kadar" - ninja'nın güncel zaman alanı yarıçapı
    const ULTI_ZONE_DURATION = 360; // 6 saniye (ninja'nınkiyle aynı süre)
    const ULTI_ZONE_DPS = 150;
    const ULTI_SLOW_FACTOR = 0.4; // [VARSAYIM] yavaşlatma oranı belirtilmedi, %60 yavaşlatma seçtim
    const ULTI_BONUS_DAMAGE = 300;

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
            angle, dmg
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

    // ------------------------------------------------------------------
    // Ulti: yavaşlatan + hasar veren alan
    // ------------------------------------------------------------------
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        leafZones.push({ x: this.x, y: this.y, radius: ULTI_ZONE_RADIUS, life: ULTI_ZONE_DURATION, tickTimer: 0 });
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
        // Yavaşlatılmış düşmanların hızını geri yükle (obje referansları
        // zaten temizleniyor ama garanti olsun diye)
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

        // Ulti alanları
        leafZones.forEach(z => {
            ctx2.save();
            ctx2.translate(z.x, z.y);
            ctx2.globalAlpha = Math.min(0.9, z.life / 60) * 0.35;
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#229954'; ctx2.fill();
            ctx2.globalAlpha = Math.min(0.9, z.life / 60);
            ctx2.strokeStyle = '#2ecc71'; ctx2.lineWidth = 3; ctx2.setLineDash([10, 15]);
            ctx2.stroke();
            ctx2.restore();
        });

        leafBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.angle);
            ctx2.beginPath(); ctx2.moveTo(-11, 0); ctx2.lineTo(-4, 0);
            ctx2.strokeStyle = '#6b4226'; ctx2.lineWidth = 2; ctx2.setLineDash([]); ctx2.stroke();
            ctx2.beginPath(); ctx2.ellipse(2, 0, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = '#27ae60'; ctx2.fill();
            ctx2.strokeStyle = '#1e8449'; ctx2.lineWidth = 1.5; ctx2.stroke();
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
        // --- Ulti alanları: hasar + yavaşlatma ---
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

        // --- Mermiler ---
        for (let i = leafBullets.length - 1; i >= 0; i--) {
            const b = leafBullets[i];
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
                        // Alan içindeyken: iki kez vurur + 300 sabit bonus
                        e.hp -= b.dmg; addFloatingNumber(e.x, e.y - 6, b.dmg, "#27ae60");
                        e.hp -= b.dmg; addFloatingNumber(e.x, e.y + 10, b.dmg, "#27ae60");
                        e.hp -= ULTI_BONUS_DAMAGE; addFloatingNumber(e.x, e.y + 24, ULTI_BONUS_DAMAGE, "#f1c40f");
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
