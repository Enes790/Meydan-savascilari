// ============================================================================
// MUTASYON MODU (mod6.js) — v3 (yeni ikinci bot: Alan Botu + görsel efektler)
// ----------------------------------------------------------------------------
// DEĞİŞENLER:
// 1) İyileştirici bot fikri değişti: artık kimseyi KOVALAMIYOR. Sabit bir
//    "etki alanı" var; bu alanın içindeki HER bot (kendisi dahil), her 3
//    saniyede bir +200 can kazanıyor. Alan, ekranda yarı saydam bir daire
//    ile sürekli gösteriliyor.
// 2) Sürü Botu artık görsel bir efekt taşıyor: yakınında ne kadar çok bot
//    varsa, etrafında o kadar büyük/parlak bir "hız halkası" ve arkasında
//    hareket izleri (streak) beliriyor.
// 3) İki bot da klasik mor bottan farklı renkte (Sürü Botu turuncu, Alan
//    Botu turkuaz) — ama hâlâ aynı genel bot silüetini (drawEntity) kullanıyor.
// ============================================================================

(function () {
    'use strict';

    const MOD_ID = 'mutasyon';

    // --- Sürü Botu ayarları ---
    const SWARM_HP = 2200;
    const SWARM_BASE_SPEED = 1.36;
    const SWARM_SPEED_BONUS = 0.4;
    const SWARM_NEARBY_RADIUS = 150;
    const SWARM_ENGAGE_DIST = 180;
    const SWARM_SHOOT_RANGE = RANGE;
    const SWARM_SPAWN_INTERVAL = 490;
    const SWARM_COLOR = '#e67e22'; // turuncu - klasik mor bottan ayrışsın

    // --- Alan Botu ayarları (eski "iyileştirici" fikrinin yerine) ---
    const AURA_HP = 2500;
    const AURA_SPEED = 1.0;             // [VARSAYIM] yavaş, sakin dolaşır
    const AURA_HEAL_AMOUNT = 200;
    const AURA_RADIUS = 180;            // [VARSAYIM] etki alanı yarıçapı
    const AURA_HEAL_INTERVAL = 180;     // 3 saniye (60fps varsayımıyla)
    const AURA_SPAWN_INTERVAL = 900;
    const AURA_COLOR = '#16a085';       // turkuaz - hem sürü botundan hem klasikten ayrışsın
    const AURA_WANDER_INTERVAL = 240;   // [VARSAYIM] ~4 saniyede bir yeni yön seçer

    const SPAWN_WARN_FRAMES = 90;

    let swarmBots = [];
    let auraBots = [];
    let mySpawnIndicators = [];
    let swarmSpawnTimer = 0;
    let auraSpawnTimer = 0;

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
            speed: SWARM_BASE_SPEED, color: SWARM_COLOR,
            isDead: false, isActive: true,
            kbX: 0, kbY: 0, bombaBulasti: false, bombaSayaci: 0,
            lastShot: 0, shootInterval: BOT_SHOOT_INTERVAL,
            currentNearbyCount: 0 // çizimde kullanmak için burada tutuyoruz
        };
    }

    function createAuraBot(x, y) {
        return {
            x, y, radius: 20, angle: Math.random() * Math.PI * 2,
            hp: AURA_HP, maxHp: AURA_HP,
            speed: AURA_SPEED, color: AURA_COLOR,
            isDead: false, isActive: true,
            kbX: 0, kbY: 0, bombaBulasti: false, bombaSayaci: 0,
            healCooldown: AURA_HEAL_INTERVAL,
            wanderTimer: 0, wanderAngle: Math.random() * Math.PI * 2,
            pulseFlash: 0 // iyileştirme anında kısa bir parlama için
        };
    }

    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Mutasyon',

        onStart() {
            swarmBots = []; auraBots = []; mySpawnIndicators = [];
            swarmSpawnTimer = 0; auraSpawnTimer = 0;

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = []; boomerangBots = [];
            fogBots = []; nests = []; spawnIndicators = [];
        },

        onUpdate(ts) {
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];
            nests = [];

            swarmSpawnTimer += ts;
            if (swarmSpawnTimer >= SWARM_SPAWN_INTERVAL) {
                swarmSpawnTimer = 0;
                const p = randSpawnPoint();
                mySpawnIndicators.push({ x: p.x, y: p.y, timer: SPAWN_WARN_FRAMES, type: 'swarm' });
            }
            auraSpawnTimer += ts;
            if (auraSpawnTimer >= AURA_SPAWN_INTERVAL) {
                auraSpawnTimer = 0;
                const p = randSpawnPoint();
                mySpawnIndicators.push({ x: p.x, y: p.y, timer: SPAWN_WARN_FRAMES, type: 'aura' });
            }

            for (let i = mySpawnIndicators.length - 1; i >= 0; i--) {
                const ind = mySpawnIndicators[i];
                ind.timer -= ts;
                if (ind.timer <= 0) {
                    if (ind.type === 'swarm') swarmBots.push(createSwarmBot(ind.x, ind.y));
                    else auraBots.push(createAuraBot(ind.x, ind.y));
                    mySpawnIndicators.splice(i, 1);
                }
            }

            // --- Sürü Botu ---
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
                b.currentNearbyCount = yakinSayisi; // çizimde kullanılacak
                b.speed = SWARM_BASE_SPEED + (yakinSayisi * SWARM_SPEED_BONUS);

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
                            dmgMod: 1, owner: b
                        });
                        b.lastShot = Date.now();
                    }
                }
            }

            // --- Alan Botu (eski iyileştirici, artık sabit alan etkili) ---
            for (let i = auraBots.length - 1; i >= 0; i--) {
                const a = auraBots[i];

                if (a.hp <= 0 && !a.isDead) {
                    a.isDead = true;
                    spawnParticles(a.x, a.y, a.color);
                    triggerBotKill(a.x, a);
                }
                if (a.isDead) { auraBots.splice(i, 1); continue; }

                // Kimseyi kovalamıyor - sadece yavaşça, amaçsızca dolaşıyor
                a.wanderTimer -= ts;
                if (a.wanderTimer <= 0) {
                    a.wanderTimer = AURA_WANDER_INTERVAL;
                    a.wanderAngle = Math.random() * Math.PI * 2;
                }
                a.angle = a.wanderAngle;
                a.x += Math.cos(a.angle) * a.speed * ts;
                a.y += Math.sin(a.angle) * a.speed * ts;

                // Alan etkisi: 3 saniyede bir, yarıçap içindeki HERKESE (kendisi dahil) can ver
                a.healCooldown -= ts;
                if (a.healCooldown <= 0) {
                    a.healCooldown = AURA_HEAL_INTERVAL;
                    a.pulseFlash = 20; // kısa bir görsel parlama başlat
                    getActiveEnemies().forEach(e => {
                        if (getDist(a, e) < AURA_RADIUS && e.hp < e.maxHp) {
                            e.hp = Math.min(e.maxHp, e.hp + AURA_HEAL_AMOUNT);
                            addFloatingNumber(e.x, e.y, "+" + AURA_HEAL_AMOUNT, "#2ecc71");
                        }
                    });
                }
                if (a.pulseFlash > 0) a.pulseFlash -= ts;
            }
        },

        onDraw(ctx2) {
            // Doğum uyarıları
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

            // Alan botlarının etki alanı - HER ZAMAN görünür, nabız gibi hafif titriyor
            auraBots.forEach(a => {
                const pulse = Math.sin(Date.now() / 300) * 5;
                const flashBonus = a.pulseFlash > 0 ? (a.pulseFlash / 20) * 0.25 : 0;
                ctx2.save();
                ctx2.translate(a.x, a.y);
                ctx2.beginPath();
                ctx2.arc(0, 0, AURA_RADIUS + pulse, 0, Math.PI * 2);
                ctx2.fillStyle = `rgba(22, 160, 133, ${0.12 + flashBonus})`;
                ctx2.fill();
                ctx2.strokeStyle = `rgba(22, 160, 133, ${0.5 + flashBonus})`;
                ctx2.lineWidth = 2;
                ctx2.setLineDash([8, 10]);
                ctx2.stroke();
                ctx2.setLineDash([]);
                ctx2.restore();
            });

            // Sürü botlarının hız efekti - yakınında ne kadar bot varsa o kadar belirgin
            swarmBots.forEach(b => {
                const count = Math.min(5, b.currentNearbyCount);
                if (count > 0) {
                    ctx2.save();
                    ctx2.translate(b.x, b.y);
                    // parlayan halka, sayıya göre büyüyor ve güçleniyor
                    ctx2.beginPath();
                    ctx2.arc(0, 0, b.radius + 6 + count * 3, 0, Math.PI * 2);
                    ctx2.strokeStyle = `rgba(230, 126, 34, ${0.25 + count * 0.12})`;
                    ctx2.lineWidth = 3;
                    ctx2.stroke();
                    // arkasında hareket izleri (streak)
                    for (let k = 0; k < count; k++) {
                        const streakAngle = b.angle + Math.PI + (Math.random() - 0.5) * 0.6;
                        const len = 10 + count * 3;
                        ctx2.beginPath();
                        ctx2.moveTo(0, 0);
                        ctx2.lineTo(Math.cos(streakAngle) * len, Math.sin(streakAngle) * len);
                        ctx2.strokeStyle = `rgba(241, 196, 15, ${0.4 + count * 0.1})`;
                        ctx2.lineWidth = 2;
                        ctx2.stroke();
                    }
                    ctx2.restore();
                }
            });

            // Botların kendisi - ana dosyanın klasik çizim fonksiyonuyla (silüet aynı, renk farklı)
            swarmBots.forEach(b => drawEntity(b, false));
            auraBots.forEach(a => drawEntity(a, false));
        },

        onReset() {
            swarmBots = []; auraBots = []; mySpawnIndicators = [];
            swarmSpawnTimer = 0; auraSpawnTimer = 0;
        }
    };

    chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        return swarmBots.concat(auraBots).filter(e => !e.isDead);
    });

    chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID) return;
        window.GAME_EXT.modes[MOD_ID].onDraw(ctx2);
    });

    const track = document.getElementById('difficulty-track');
    if (track && !document.getElementById('diff-mutasyon')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-mutasyon';
        card.innerHTML =
            '<span>Mutasyon</span>' +
            '<small>Sürü Botu + Alan Botu<br>Klasik botlar kapalı</small>';
        track.appendChild(card);
        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        });
    }

})();
