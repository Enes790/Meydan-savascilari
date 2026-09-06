// ============================================================================
// MUTASYON MODU (mod6.js) — v4
// ----------------------------------------------------------------------------
// DEĞİŞENLER:
// 1) İyileştirici Bot artık BOT2'NİN YERİNE geçiyor: kendi zamanlayıcısı yok,
//    tıpkı bot2 gibi 7 öldürmeden sonra doğuyor, ölünce klasik bot2 gibi
//    yeniden doğuyor. Gerçek bot2 kalıcı olarak devre dışı bırakıldı (ana
//    kodun onu kendiliğinden aktif etmeye çalışmasına karşı her karede
//    zorla kapalı tutuluyor).
// 2) İyileştirici Bot artık SADECE iyileştirmiyor, oyuncuya da saldırıyor
//    (300 hasar). Görünümü klasik mor botla neredeyse aynı (rengi bile mor)
//    ama üzerinde küçük bir "kabarcık" işareti var - bu onu ayırt ediyor.
// 3) Sürü Botu'nun hasarı artık 400. Rengi, yakınında bot arttıkça SARIDAN
//    TURUNCUYA doğru kayıyor. Etrafındaki hareket çizgileri, o anki
//    rengin YAKLAŞIK TERSİ (ters renk) ile çiziliyor.
// 4) Özel hasar değerleri (300/400) için ana dosyanın mermi fonksiyonu
//    SARILIYOR ama sadece bizim etiketlediğimiz mermi tiplerine bakılıyor,
//    her şeyin geri kalanı olduğu gibi orijinal fonksiyona bırakılıyor.
// ============================================================================

(function () {
    'use strict';

    const MOD_ID = 'mutasyon';

    // --- Sürü Botu ---
    const SWARM_HP = 2200;
    const SWARM_BASE_SPEED = 1.36;
    const SWARM_SPEED_BONUS = 0.4;
    const SWARM_NEARBY_RADIUS = 150;
    const SWARM_ENGAGE_DIST = 180;
    const SWARM_SHOOT_RANGE = RANGE;
    const SWARM_SPAWN_INTERVAL = 490;
    const SWARM_DAMAGE = 400;
    const SWARM_COLOR_LOW = '#f1c40f';  // az bot varken: sarı
    const SWARM_COLOR_HIGH = '#e67e22'; // çok bot varken: turuncu
    const SPAWN_WARN_FRAMES = 90;

    // --- İyileştirici Bot (bot2'nin yerine geçiyor) ---
    const HEALER_HP = 2000;
    const HEALER_SPEED = 1.36;          // klasik moddaki sabit hız, zorluktan etkilenmiyor
    const HEALER_DAMAGE = 300;
    const HEALER_ENGAGE_DIST = 180;
    const HEALER_SHOOT_RANGE = RANGE;
    const HEALER_HEAL_RADIUS = Math.round(114 * 0.6); // ninja alanının (114) %40 küçüğü = 68
    const HEALER_HEAL_INTERVAL = 180;   // 3 saniye
    const HEALER_HEAL_OTHERS = 200;
    const HEALER_HEAL_SELF = 400;
    const HEALER_SPAWN_KILL_THRESHOLD = 7; // bot2 ile aynı eşik
    const HEALER_RESPAWN_TIME = BOT_RESPAWN_TIME; // bot2 ile aynı bekleme süresi
    const HEALER_COLOR = '#9b59b6'; // klasik mor - bilerek aynı

    let swarmBots = [];
    let healerBots = []; // en fazla 1 eleman tutar, bot2 mantığına benzer
    let mySpawnIndicators = [];
    let swarmSpawnTimer = 0;

    let healerUnlocked = false;     // 7 öldürmeye ulaşıldı mı
    let healerRespawnTimer = -1;    // -1: beklemede değil

    // ---- Renk yardımcı fonksiyonları ----
    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        return { r: parseInt(hex.substr(0, 2), 16), g: parseInt(hex.substr(2, 2), 16), b: parseInt(hex.substr(4, 2), 16) };
    }
    function rgbToHex(r, g, b) {
        const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        return '#' + c(r) + c(g) + c(b);
    }
    function lerpColor(hexA, hexB, t) {
        const a = hexToRgb(hexA), b = hexToRgb(hexB);
        return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
    }
    function invertHex(hex) {
        const c = hexToRgb(hex);
        return rgbToHex(255 - c.r, 255 - c.g, 255 - c.b);
    }

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

    function randSpawnPoint() {
        return {
            x: Math.random() * (canvas.width - 200) + 100,
            y: Math.random() * (canvas.height - 200) + 100
        };
    }

    function createSwarmBot(x, y) {
        return {
            x, y, radius: 20, angle: 0,
            hp: SWARM_HP, maxHp: SWARM_HP,
            speed: SWARM_BASE_SPEED, color: SWARM_COLOR_LOW,
            isDead: false, isActive: true,
            kbX: 0, kbY: 0, bombaBulasti: false, bombaSayaci: 0,
            lastShot: 0, shootInterval: BOT_SHOOT_INTERVAL,
            currentNearbyCount: 0
        };
    }

    function createHealerBot(x, y) {
        return {
            x, y, radius: 20, angle: Math.PI,
            hp: HEALER_HP, maxHp: HEALER_HP,
            speed: HEALER_SPEED, color: HEALER_COLOR,
            isDead: false, isActive: true,
            kbX: 0, kbY: 0, bombaBulasti: false, bombaSayaci: 0,
            lastShot: 0, shootInterval: BOT_SHOOT_INTERVAL,
            healCooldown: HEALER_HEAL_INTERVAL,
            pulseFlash: 0
        };
    }

    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Mutasyon',

        onStart() {
            swarmBots = []; healerBots = []; mySpawnIndicators = [];
            swarmSpawnTimer = 0; healerUnlocked = false; healerRespawnTimer = -1;

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = []; boomerangBots = [];
            fogBots = []; nests = []; spawnIndicators = [];
        },

        onUpdate(ts) {
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];
            nests = [];

            // Ana kod her 7 öldürmede bot2'yi aktif etmeye çalışıyor - engelliyoruz
            bot2.isActive = false; bot2.isDead = true;

            // --- Sürü Botu spawn ---
            swarmSpawnTimer += ts;
            if (swarmSpawnTimer >= SWARM_SPAWN_INTERVAL) {
                swarmSpawnTimer = 0;
                const p = randSpawnPoint();
                mySpawnIndicators.push({ x: p.x, y: p.y, timer: SPAWN_WARN_FRAMES, type: 'swarm' });
            }

            // --- İyileştirici Bot: bot2 mantığı (7 öldürmede aç, ölünce yeniden doğ) ---
            if (!healerUnlocked && botsKilled >= HEALER_SPAWN_KILL_THRESHOLD) {
                healerUnlocked = true;
                const p = randSpawnPoint();
                mySpawnIndicators.push({ x: p.x, y: p.y, timer: SPAWN_WARN_FRAMES, type: 'healer' });
            }
            if (healerRespawnTimer >= 0) {
                healerRespawnTimer -= ts;
                if (healerRespawnTimer <= 0) {
                    healerRespawnTimer = -1;
                    const p = randSpawnPoint();
                    healerBots.push(createHealerBot(p.x, p.y));
                }
            }

            for (let i = mySpawnIndicators.length - 1; i >= 0; i--) {
                const ind = mySpawnIndicators[i];
                ind.timer -= ts;
                if (ind.timer <= 0) {
                    if (ind.type === 'swarm') swarmBots.push(createSwarmBot(ind.x, ind.y));
                    else healerBots.push(createHealerBot(ind.x, ind.y));
                    mySpawnIndicators.splice(i, 1);
                }
            }

            // --- Sürü Botu davranışı ---
            for (let i = swarmBots.length - 1; i >= 0; i--) {
                const b = swarmBots[i];

                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { swarmBots.splice(i, 1); continue; }

                let yakinSayisi = 0;
                getActiveEnemies().forEach(e => {
                    if (e !== b && getDist(b, e) < SWARM_NEARBY_RADIUS) yakinSayisi++;
                });
                b.currentNearbyCount = yakinSayisi;
                b.speed = SWARM_BASE_SPEED + (yakinSayisi * SWARM_SPEED_BONUS);
                b.color = lerpColor(SWARM_COLOR_LOW, SWARM_COLOR_HIGH, Math.min(1, yakinSayisi / 5));

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    const d = getDist(b, player);
                    if (d > SWARM_ENGAGE_DIST) {
                        b.x += Math.cos(b.angle) * b.speed * ts;
                        b.y += Math.sin(b.angle) * b.speed * ts;
                    }
                    if (d < SWARM_SHOOT_RANGE && Date.now() - b.lastShot > b.shootInterval) {
                        botBullets.push({
                            x: b.x, y: b.y, sx: b.x, sy: b.y,
                            vx: Math.cos(b.angle) * BOT_BULLET_SPEED,
                            vy: Math.sin(b.angle) * BOT_BULLET_SPEED,
                            type: 'swarm_attack', owner: b
                        });
                        b.lastShot = Date.now();
                    }
                }
            }

            // --- İyileştirici Bot davranışı ---
            for (let i = healerBots.length - 1; i >= 0; i--) {
                const h = healerBots[i];

                if (h.hp <= 0 && !h.isDead) {
                    h.isDead = true;
                    spawnParticles(h.x, h.y, h.color);
                    triggerBotKill(h.x, h);
                    healerRespawnTimer = HEALER_RESPAWN_TIME;
                }
                if (h.isDead) { healerBots.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    h.angle = Math.atan2(player.y - h.y, player.x - h.x);
                    const d = getDist(h, player);
                    if (d > HEALER_ENGAGE_DIST) {
                        h.x += Math.cos(h.angle) * h.speed * ts;
                        h.y += Math.sin(h.angle) * h.speed * ts;
                    }
                    if (d < HEALER_SHOOT_RANGE && Date.now() - h.lastShot > h.shootInterval) {
                        botBullets.push({
                            x: h.x, y: h.y, sx: h.x, sy: h.y,
                            vx: Math.cos(h.angle) * BOT_BULLET_SPEED,
                            vy: Math.sin(h.angle) * BOT_BULLET_SPEED,
                            type: 'healer_attack', owner: h
                        });
                        h.lastShot = Date.now();
                    }
                }

                h.healCooldown -= ts;
                if (h.healCooldown <= 0) {
                    h.healCooldown = HEALER_HEAL_INTERVAL;
                    h.pulseFlash = 20;
                    h.hp = Math.min(h.maxHp, h.hp + HEALER_HEAL_SELF);
                    addFloatingNumber(h.x, h.y, "+" + HEALER_HEAL_SELF, "#2ecc71");
                    getActiveEnemies().forEach(e => {
                        if (e === h) return;
                        if (getDist(h, e) < HEALER_HEAL_RADIUS && e.hp < e.maxHp) {
                            e.hp = Math.min(e.maxHp, e.hp + HEALER_HEAL_OTHERS);
                            addFloatingNumber(e.x, e.y, "+" + HEALER_HEAL_OTHERS, "#2ecc71");
                        }
                    });
                }
                if (h.pulseFlash > 0) h.pulseFlash -= ts;
            }
        },

        onDraw(ctx2) {
            mySpawnIndicators.forEach(ind => {
                ctx2.save();
                ctx2.translate(ind.x, ind.y);
                ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
                ctx2.beginPath(); ctx2.arc(0, 0, 30, 0, Math.PI * 2);
                ctx2.strokeStyle = '#e74c3c'; ctx2.lineWidth = 4; ctx2.stroke();
                ctx2.globalAlpha = 1;
                ctx2.fillStyle = '#e74c3c'; ctx2.font = "bold 16px Arial"; ctx2.textAlign = "center";
                ctx2.fillText(Math.ceil(ind.timer / 60), 0, 6);
                ctx2.restore();
            });

            healerBots.forEach(h => {
                if (h.pulseFlash > 0) {
                    ctx2.save();
                    ctx2.translate(h.x, h.y);
                    const alpha = (h.pulseFlash / 20) * 0.5;
                    ctx2.beginPath(); ctx2.arc(0, 0, HEALER_HEAL_RADIUS, 0, Math.PI * 2);
                    ctx2.fillStyle = `rgba(46, 204, 113, ${alpha * 0.4})`;
                    ctx2.fill();
                    ctx2.strokeStyle = `rgba(46, 204, 113, ${alpha})`;
                    ctx2.lineWidth = 2;
                    ctx2.stroke();
                    ctx2.restore();
                }
            });

            swarmBots.forEach(b => {
                const count = Math.min(5, b.currentNearbyCount);
                if (count > 0) {
                    const oppositeColor = invertHex(b.color);
                    ctx2.save();
                    ctx2.translate(b.x, b.y);
                    ctx2.beginPath();
                    ctx2.arc(0, 0, b.radius + 6 + count * 3, 0, Math.PI * 2);
                    ctx2.strokeStyle = oppositeColor;
                    ctx2.globalAlpha = 0.3 + count * 0.1;
                    ctx2.lineWidth = 3;
                    ctx2.stroke();
                    ctx2.globalAlpha = 1;
                    for (let k = 0; k < count; k++) {
                        const streakAngle = b.angle + Math.PI + (Math.random() - 0.5) * 0.6;
                        const len = 10 + count * 3;
                        ctx2.beginPath();
                        ctx2.moveTo(0, 0);
                        ctx2.lineTo(Math.cos(streakAngle) * len, Math.sin(streakAngle) * len);
                        ctx2.strokeStyle = oppositeColor;
                        ctx2.lineWidth = 2;
                        ctx2.stroke();
                    }
                    ctx2.restore();
                }
            });

            swarmBots.forEach(b => drawEntity(b, false));
            healerBots.forEach(h => drawEntity(h, false));

            healerBots.forEach(h => {
                ctx2.save();
                ctx2.translate(h.x, h.y - h.radius - 22);
                ctx2.beginPath();
                ctx2.arc(0, 0, 8, 0, Math.PI * 2);
                ctx2.fillStyle = 'rgba(46, 204, 113, 0.85)';
                ctx2.fill();
                ctx2.strokeStyle = '#fff';
                ctx2.lineWidth = 1.5;
                ctx2.stroke();
                ctx2.beginPath();
                ctx2.arc(-2.5, -2.5, 2, 0, Math.PI * 2);
                ctx2.fillStyle = 'rgba(255,255,255,0.8)';
                ctx2.fill();
                ctx2.restore();
            });
        },

        onReset() {
            swarmBots = []; healerBots = []; mySpawnIndicators = [];
            swarmSpawnTimer = 0; healerUnlocked = false; healerRespawnTimer = -1;
        }
    };

    chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        return swarmBots.concat(healerBots).filter(e => !e.isDead);
    });

    chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID) return;
        window.GAME_EXT.modes[MOD_ID].onDraw(ctx2);
    });

    const originalUpdateBulletLogic = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (isBot && window.GAME_MODE === MOD_ID) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (b.type !== 'swarm_attack' && b.type !== 'healer_attack') continue;

                b.x += b.vx * ts; b.y += b.vy * ts;

                const outOfRange = getDist(b, { x: b.sx, y: b.sy }) > RANGE;
                const hitWall = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5 ||
                                 b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;

                if (!player.isDead && getDist(b, player) < player.radius + 12) {
                    const dmg = b.type === 'swarm_attack' ? SWARM_DAMAGE : HEALER_DAMAGE;
                    player.hp -= dmg;
                    addFloatingNumber(player.x, player.y, dmg, "#e74c3c");
                    player.lastHitTime = Date.now();
                    if (player.isInvisible) { player.isInvisible = false; player.invisTimer = 0; }
                    list.splice(i, 1);
                    continue;
                }
                if (outOfRange || hitWall) {
                    list.splice(i, 1);
                }
            }
        }
        originalUpdateBulletLogic(list, isBot, ts);
    };

    const track = document.getElementById('difficulty-track');
    if (track && !document.getElementById('diff-mutasyon')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-mutasyon';
        card.innerHTML =
            '<span>Mutasyon</span>' +
            '<small>Sürü Botu + İyileştirici Bot<br>Klasik botlar kapalı</small>';
        track.appendChild(card);
        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        });
    }

})();
