// ========== mod2.js (YAPRAKÇI) - DİKENLİ KÖK BİTKİSİ ==========
// - Zıplama kaldırıldı, yerine bitki çağırma geldi.
// - Bitki düşman mermilerini engeller, botlar bitkiyi hedef alır.
// - Bitki her saniyede 1 yaprak mermisi atar, her atışta 100 can kaybeder.
// - Ulti bitkiyi iyileştirir.
// - Bitki yok edilince çevreye hasar ve güçlü itme uygular.
// - Ulti bonus hasarı 100'e düşürüldü, mermiler ikinci kez vurmaz.
// - Tüm güncellemeler hook'lara bağlandı (window.update/chargeUlti override yok).

(function () {
    'use strict';

    const CHAR_ID = 'yaprakci';
    const CHAR_COLOR = '#229954';
    const CHAR_HP = 2600;
    const CHAR_SPEED = 4.2;

    const LEAF_RANGE = 357;
    const LEAF_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.75;
    const MID_DAMAGE = 500;
    const SIDE_DAMAGE = 400;
    const SIDE_OFFSET = 12;
    const SIDE_DELAY_MS = 100;
    const KNOCKBACK_MAG = 2.5;
    const LEAF_HIT_PAD = 8;
    const OBSTACLE_DAMAGE = 30;

    // Dikenli Kök Bitkisi
    const PLANT_MAX_HP = 800;             // başlangıç canı
    const PLANT_DURATION = 600;           // 600 frame ≈ 10 saniye
    const PLANT_ATTACK_INTERVAL = 60;     // 1 saniyede 1 atış (60 frame)
    const PLANT_DAMAGE = 500;             // yaprakçının orta mermisiyle aynı
    const PLANT_ATTACK_RADIUS = 300;      // bitki bu menzilde düşman görürse ateş eder
    const PLANT_RADIUS = 40;              // bitki gövde yarıçapı
    const PLANT_SELF_DAMAGE_PER_SHOT = 100; // her atışta kaybettiği can
    const PLANT_EXPLOSION_DAMAGE = 150;   // yok olunca verdiği hasar
    const PLANT_EXPLOSION_KNOCKBACK = 40; // itme gücü (Buz Botu benzeri)
    const PLANT_COOLDOWN = 900;           // gadget bekleme süresi

    const FOLLOW_BUFF_DURATION = 900;
    const FOLLOW_GADGET2_COOLDOWN = 1200;

    const ULTI_ZONE_RADIUS = 96;
    const ULTI_ZONE_DURATION = 480;
    const ULTI_ZONE_DPS = 150;
    const ULTI_SLOW_FACTOR = 0.4;
    const ULTI_BONUS_DAMAGE = 100;        // eski 300'den düşürüldü
    const ULTI_HIT_HEAL = 50;
    const ULTI_STANDING_HEAL_PER_SEC = 200;

    const SPAWN_GROW_FRAMES = 10;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let leafBullets = [];
    let leafZones = [];
    let leafPlants = [];   // aktif bitkiler (maks 1)
    let wasJumping = false;

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    function spawnLeaf(x, y, angle, dmg, isFromPlant = false) {
        leafBullets.push({
            x, y, sx: x, sy: y,
            vx: Math.cos(angle) * LEAF_BULLET_SPEED,
            vy: Math.sin(angle) * LEAF_BULLET_SPEED,
            angle, dmg, age: 0, hitTargets: [],
            isFromPlant: isFromPlant
        });
    }

    function playerInOwnZone() {
        return leafZones.some(z => getDist(player, z) < z.radius);
    }

    // ========== TEMEL SALDIRI ==========
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);

        const fx = this.x, fy = this.y;
        const perpAngle = a + Math.PI / 2;

        spawnLeaf(fx, fy, a, MID_DAMAGE, false);
        this.consumeAmmo();

        setTimeout(() => {
            if (!gameStarted || this.isDead) return;
            [-SIDE_OFFSET, SIDE_OFFSET].forEach(off => {
                spawnLeaf(
                    fx + Math.cos(perpAngle) * off,
                    fy + Math.sin(perpAngle) * off,
                    a, SIDE_DAMAGE, false
                );
            });
        }, SIDE_DELAY_MS);
    };

    // ========== AKSESUAR 1: Dikenli Kök Bitkisi ==========
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;
        if (leafPlants.length >= 1) {
            addFloatingNumber(this.x, this.y - 30, "ZATEN BİR BİTKİ VAR!", "#e74c3c");
            return;
        }

        // Bitkiyi oyuncunun biraz önüne dik (veya direkt üzerine)
        const plantX = this.x + Math.cos(this.angle) * 30;
        const plantY = this.y + Math.sin(this.angle) * 30;
        leafPlants.push({
            x: plantX, y: plantY,
            radius: PLANT_RADIUS,
            hp: PLANT_MAX_HP,
            maxHp: PLANT_MAX_HP,
            life: PLANT_DURATION,
            attackTimer: 0,
            isDead: false,
            age: 0
        });
        addFloatingNumber(plantX, plantY - 20, "DİKENLİ KÖK BİTKİSİ!", "#229954");

        this.gadgetReady = false;
        this.gadgetCooldown = PLANT_COOLDOWN;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
        if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(PLANT_COOLDOWN / 60) + "s";
    };

    // ========== AKSESUAR 2: TAKİP EDEN ALAN ==========
    const originalActivateGadget2 = Player.prototype.activateGadget2;
    Player.prototype.activateGadget2 = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget2.call(this, a, pull);
        if (!this.gadget2Ready || this.isDead) return;

        this.kFollowUltiBuff = true;
        this.kFollowUltiBuffTimer = FOLLOW_BUFF_DURATION;
        addFloatingNumber(this.x, this.y - 30, "TAKİP EDEN ALAN HAZIR!", "#229954");

        this.gadget2Ready = false;
        this.gadget2Cooldown = FOLLOW_GADGET2_COOLDOWN;
        if (gadgetBtn2) gadgetBtn2.classList.add('cooldown');
        if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(FOLLOW_GADGET2_COOLDOWN / 60) + "s";
    };

    // ========== ULTİ ==========
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        const willFollow = !!this.kFollowUltiBuff;
        leafZones.push({
            x: this.x, y: this.y, radius: ULTI_ZONE_RADIUS, life: ULTI_ZONE_DURATION,
            maxLife: ULTI_ZONE_DURATION, tickTimer: 0, followsPlayer: willFollow
        });
        addFloatingNumber(this.x, this.y - 40, willFollow ? "TAKİP EDEN ALAN!" : "YAPRAK ALANI!", "#229954");

        if (willFollow) { this.kFollowUltiBuff = false; this.kFollowUltiBuffTimer = 0; }

        this.ultReady = false; this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ========== ULTİ DOLDURMA (hook ile) ==========
    chainHook('onChargeUlti', function (amount) {
        if (player.charType !== CHAR_ID) return;
        // Orijinal chargeUlti zaten çalıştı, burada ekstra işlem yapmaya gerek yok.
        // Ama Yaprakçı için ulti dolum hızı yarıya indirilmişti.
        // Bu işlemi orijinal fonksiyon zaten yapıyor, biz sadece burada ekstra kontrol yapabiliriz.
    });

    // ========== KARAKTER KARTI ==========
    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Yaprakçı</span>' +
            '<small>Hasar: 500+400x2<br>Güç: Dikenli Kök + Alan</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ========== HOOK: RESET ==========
    chainHook('onReset', function () {
        leafBullets = [];
        leafZones = [];
        leafPlants = [];
    });

    // ========== HOOK: DRAW ==========
    chainHook('onDraw', function (ctx2) {
        if (player.charType !== CHAR_ID) return;

        // Ulti alanları
        leafZones.forEach(z => {
            const lifeRatio = Math.max(0, z.life / z.maxLife);
            const pulse = 1 + Math.sin(Date.now() / 180) * 0.04;
            ctx2.save();
            ctx2.translate(z.x, z.y);

            const grad = ctx2.createRadialGradient(0, 0, 0, 0, 0, z.radius * pulse);
            grad.addColorStop(0, `rgba(46, 204, 113, ${0.28 * lifeRatio})`);
            grad.addColorStop(0.7, `rgba(34, 153, 84, ${0.18 * lifeRatio})`);
            grad.addColorStop(1, `rgba(34, 153, 84, 0)`);
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * pulse, 0, Math.PI * 2);
            ctx2.fillStyle = grad; ctx2.fill();

            ctx2.globalAlpha = 0.8 * lifeRatio;
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * pulse, 0, Math.PI * 2);
            ctx2.strokeStyle = '#2ecc71'; ctx2.lineWidth = 2.5; ctx2.stroke();

            ctx2.rotate(Date.now() / 500);
            ctx2.globalAlpha = 0.7 * lifeRatio;
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius * 0.82, 0, Math.PI * 2);
            ctx2.strokeStyle = '#a9dfbf'; ctx2.lineWidth = 2; ctx2.setLineDash([9, 14]);
            ctx2.stroke(); ctx2.setLineDash([]);

            ctx2.restore();
        });

        // Yaprak mermileri
        leafBullets.forEach(b => {
            const growT = Math.min(1, (b.age || 0) / SPAWN_GROW_FRAMES);
            const scale = 0.35 + 0.65 * growT;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.angle);
            ctx2.scale(scale, scale);

            ctx2.beginPath(); ctx2.ellipse(1, 2, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,0.25)'; ctx2.fill();

            ctx2.beginPath(); ctx2.moveTo(-12, 0); ctx2.lineTo(-4, 0);
            ctx2.strokeStyle = '#6b4226'; ctx2.lineWidth = 2; ctx2.stroke();

            const leafGrad = ctx2.createLinearGradient(-6, 0, 8, 0);
            leafGrad.addColorStop(0, '#1e8449');
            leafGrad.addColorStop(1, '#2ecc71');
            ctx2.beginPath(); ctx2.ellipse(2, 0, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = leafGrad; ctx2.fill();
            ctx2.strokeStyle = '#145a32'; ctx2.lineWidth = 1.5; ctx2.stroke();

            ctx2.beginPath(); ctx2.moveTo(-6, 0); ctx2.lineTo(10, 0);
            ctx2.strokeStyle = 'rgba(20,90,50,0.6)'; ctx2.lineWidth = 1; ctx2.stroke();

            ctx2.restore();
        });

        // Dikenli Kök Bitkisi
        leafPlants.forEach(p => {
            if (p.isDead) return;
            const lifeRatio = Math.max(0, p.life / PLANT_DURATION);
            ctx2.save();
            ctx2.translate(p.x, p.y);

            // Gövde
            ctx2.fillStyle = '#8B4513';
            ctx2.beginPath();
            ctx2.ellipse(0, 0, p.radius * 0.7, p.radius * 0.9, 0, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#5D3A1A';
            ctx2.lineWidth = 2;
            ctx2.stroke();

            // Dikenler
            for (let i = 0; i < 6; i++) {
                const ang = (i / 6) * Math.PI * 2 + Date.now() / 800;
                const dx = Math.cos(ang) * p.radius * 1.1;
                const dy = Math.sin(ang) * p.radius * 1.1;
                ctx2.beginPath();
                ctx2.moveTo(0, 0);
                ctx2.lineTo(dx, dy);
                ctx2.strokeStyle = '#2E8B57';
                ctx2.lineWidth = 3;
                ctx2.stroke();
            }

            // Can barı
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-20, -p.radius - 15, 40, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-20, -p.radius - 15, 40 * (p.hp / p.maxHp), 4);

            ctx2.restore();
        });
    });

    // ========== HOOK: UPDATE ==========
    chainHook('onUpdate', function (ts) {
        if (player.charType !== CHAR_ID) return;
        leafUpdate(ts);
        ensureLeafUI();
    });

    // ========== BOT HEDEFLEME: Bitkiyi hedef listesine ekle ==========
    chainHook('getExtraTargets', function () {
        if (player.charType !== CHAR_ID) return [];
        return leafPlants.filter(p => !p.isDead).map(p => ({
            x: p.x, y: p.y, radius: p.radius, hp: p.hp, maxHp: p.maxHp,
            isPlant: true, isActive: true
        }));
    });

    // ========== BOT HEDEF SEÇİMİ: Bitkiyi hedef al ==========
    chainHook('getBotTarget', function (bot) {
        if (player.charType !== CHAR_ID || leafPlants.length === 0) return null;
        const plant = leafPlants.find(p => !p.isDead);
        if (plant && getDist(bot, plant) < 400) {
            return plant;
        }
        return null;
    });

    // ========== UI GÜNCELLEME ==========
    function ensureLeafUI() {
        if (!gameStarted) return;
        if (player.charType === CHAR_ID) {
            if (gadgetBtn) gadgetBtn.style.display = 'flex';
            if (gadgetBtn2) gadgetBtn2.style.display = 'flex';
            if (ultiBtn) ultiBtn.style.display = 'flex';

            if (gadgetBtn && gadgetBtn.dataset.yaprakLabelSet !== '1') {
                gadgetBtn.innerHTML = 'DİKENLİ<br>KÖK BİTKİ<br><span id="gadget-timer"></span>';
                gadgetBtn.dataset.yaprakLabelSet = '1';
            }
            if (gadgetBtn2 && gadgetBtn2.dataset.yaprakLabelSet !== '1') {
                gadgetBtn2.innerHTML = 'TAKİP<br>EDEN ALAN<br><span id="gadget-timer-2"></span>';
                gadgetBtn2.dataset.yaprakLabelSet = '1';
            }

            if (player.gadgetCooldown > 0) {
                if (gadgetTimerText) gadgetTimerText.innerText = Math.ceil(player.gadgetCooldown / 60) + "s";
                gadgetBtn.classList.add('cooldown');
            } else {
                if (gadgetTimerText) gadgetTimerText.innerText = "";
                gadgetBtn.classList.remove('cooldown');
            }
            if (player.gadget2Cooldown > 0) {
                if (gadgetTimerText2) gadgetTimerText2.innerText = Math.ceil(player.gadget2Cooldown / 60) + "s";
                gadgetBtn2.classList.add('cooldown');
            } else {
                if (gadgetTimerText2) gadgetTimerText2.innerText = "";
                gadgetBtn2.classList.remove('cooldown');
            }
        }

        // Takip eden alan buff süresi
        if (player.charType === CHAR_ID && player.kFollowUltiBuff) {
            player.kFollowUltiBuffTimer -= 1;
            if (player.kFollowUltiBuffTimer <= 0) {
                player.kFollowUltiBuff = false;
                addFloatingNumber(player.x, player.y, "ALAN TAKİBİ SÖNDÜ", "#7f8c8d");
            }
        }
    }

    // ========== MERMİ, ALAN VE BİTKİ GÜNCELLEME ==========
    function leafUpdate(ts) {
        // ---- Bitki güncelle ----
        for (let i = leafPlants.length - 1; i >= 0; i--) {
            const p = leafPlants[i];
            if (p.isDead) { leafPlants.splice(i, 1); continue; }

            p.age += ts;
            p.life -= ts;
            p.attackTimer += ts;

            // Bitki süresi doldu veya canı bitti
            if (p.life <= 0 || p.hp <= 0) {
                explodePlant(p);
                leafPlants.splice(i, 1);
                continue;
            }

            // Bitkiye ulti alanı iyileştirmesi
            leafZones.forEach(z => {
                if (getDist(p, z) < z.radius) {
                    p.hp = Math.min(p.maxHp, p.hp + (ULTI_STANDING_HEAL_PER_SEC / 60) * ts);
                }
            });

            // Botlar bitkiye saldırabilir: çarpışma ve hasar alma
            getActiveEnemies().forEach(e => {
                if (e.isPlant) return;
                // Botların bitkiye temas hasarı (opsiyonel, yok sayılabilir)
                // Ama bot mermileri zaten getExtraTargets ile bitkiye çarpar.
            });

            // Saldırı: her 1 saniyede bir düşmana yaprak mermisi at
            if (p.attackTimer >= PLANT_ATTACK_INTERVAL) {
                p.attackTimer = 0;
                const target = getActiveEnemies().find(e => getDist(p, e) < PLANT_ATTACK_RADIUS);
                if (target) {
                    const angle = getAngle(p, target);
                    spawnLeaf(p.x, p.y, angle, PLANT_DAMAGE, true);
                    p.hp -= PLANT_SELF_DAMAGE_PER_SHOT;
                    addFloatingNumber(p.x, p.y - 20, "-" + PLANT_SELF_DAMAGE_PER_SHOT, "#e74c3c");
                    if (p.hp <= 0) {
                        explodePlant(p);
                        leafPlants.splice(i, 1);
                        continue;
                    }
                }
            }
        }

        // ---- Ulti alanları ----
        for (let i = leafZones.length - 1; i >= 0; i--) {
            const z = leafZones[i];
            if (z.followsPlayer) { z.x = player.x; z.y = player.y; }
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

            if (getDist(player, z) < z.radius && !player.isDead) {
                player.hp = Math.min(player.maxHp, player.hp + (ULTI_STANDING_HEAL_PER_SEC / 60) * ts);
                if (doTick) addFloatingNumber(player.x, player.y - 20, "+" + ULTI_STANDING_HEAL_PER_SEC, "#2ecc71");
            }

            if (z.life <= 0) {
                getActiveEnemies().forEach(e => {
                    if (e._leafSlowed) { e.speed = e._leafOrigSpeed; e._leafSlowed = false; }
                });
                leafZones.splice(i, 1);
            }
        }

        // ---- Yaprak mermileri ----
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

            const inZone = playerInOwnZone();
            if (inZone) {
                for (const e of getActiveEnemies()) {
                    if (b.hitTargets.includes(e)) continue;
                    if (getDist(b, e) < e.radius + LEAF_HIT_PAD) {
                        b.hitTargets.push(e);
                        let totalDmg = b.dmg + ULTI_BONUS_DAMAGE;
                        e.hp -= totalDmg;
                        addFloatingNumber(e.x, e.y - 6, totalDmg, "#27ae60");
                        e.kbX = (e.kbX || 0) + Math.cos(b.angle) * KNOCKBACK_MAG;
                        e.kbY = (e.kbY || 0) + Math.sin(b.angle) * KNOCKBACK_MAG;
                        if (!b.isFromPlant) {
                            player.hp = Math.min(player.maxHp, player.hp + ULTI_HIT_HEAL);
                            addFloatingNumber(player.x, player.y, "+" + ULTI_HIT_HEAL, "#2ecc71");
                        }
                        leafBullets.splice(i, 1);
                        break;
                    }
                }
                continue;
            }

            let hit = false;
            for (const e of getActiveEnemies()) {
                if (getDist(b, e) < e.radius + LEAF_HIT_PAD) {
                    e.hp -= b.dmg;
                    addFloatingNumber(e.x, e.y, b.dmg, "#27ae60");
                    e.kbX = (e.kbX || 0) + Math.cos(b.angle) * KNOCKBACK_MAG;
                    e.kbY = (e.kbY || 0) + Math.sin(b.angle) * KNOCKBACK_MAG;
                    hit = true;
                    break;
                }
            }
            if (hit) { leafBullets.splice(i, 1); continue; }
        }
    }

    function explodePlant(p) {
        spawnParticles(p.x, p.y, '#229954', 'smoke');
        addFloatingNumber(p.x, p.y, "BİTKİ PATLADI!", "#e74c3c");
        explosions.push({x: p.x, y: p.y, radius: 10, maxRadius: 80, life: 15, maxLife: 15});
        getActiveEnemies().forEach(e => {
            const d = getDist(p, e);
            if (d < 100 + e.radius) {
                e.hp -= PLANT_EXPLOSION_DAMAGE;
                addFloatingNumber(e.x, e.y, PLANT_EXPLOSION_DAMAGE, "#e74c3c");
                const angle = getAngle(p, e);
                e.kbX = Math.cos(angle) * PLANT_EXPLOSION_KNOCKBACK;
                e.kbY = Math.sin(angle) * PLANT_EXPLOSION_KNOCKBACK;
            }
        });
    }
})();