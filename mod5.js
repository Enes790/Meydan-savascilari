// ============================================================================
// MUTASYON MODU (mod6.js) — v2, sıfırdan doğru kurulmuş versiyon
// ----------------------------------------------------------------------------
// Önceki sürümdeki hatalar burada YOK:
// - DOMContentLoaded kullanılmıyor (script zaten sayfa sonunda çalışıyor)
// - window.draw/window.update sarmalanmıyor (hook sistemi kullanılıyor,
//   başka mod dosyalarıyla çakışmıyor)
// - Elle mermi çarpışma kontrolü YOK (getExtraEnemies sayesinde ana oyun
//   hasarı zaten otomatik ve doğru veriyor)
// - Can kontrolü var (hp<=0 olunca gerçekten ölüyor)
// - Görünmezlik kontrolü var (oyuncu görünmezken botlar onu hedeflemiyor)
// - Bot doğmadan önce kırmızı uyarı çemberi çıkıyor
// - Botlar drawEntity() ile çiziliyor -> klasik mor bot ile birebir aynı görünüm
//
// BOTLAR:
// 1) SÜRÜ BOTU: yakınında ne kadar çok bot varsa o kadar hızlanır
//    (her yakın bot için +0.4 hız, anlık, uzaklaşınca gider). Buna karşılık
//    canı normal bottan 800 az.
// 2) İYİLEŞTİRİCİ BOT: oyuncuya hiç saldırmaz, sadece yakınındaki yaralı
//    botu iyileştirir. Saldırmadığı için kendi başına tehlikesizdir ama
//    öldürülmezse diğer botları sürekli güçlendirir.
//
// Mutasyon modunda: klasik mor botlar (bot, bot2), slime, duran bot,
// bumerang bot, sis botu, yuva HİÇBİRİ doğmuyor — sadece bu iki yeni bot var.
// ============================================================================

(function () {
    'use strict';

    const MOD_ID = 'mutasyon';

    // --- Sürü Botu ayarları ---
    const SWARM_HP = 2200;                  // 3000 - 800
    const SWARM_BASE_SPEED = 1.36;          // klasik bot ile aynı temel hız
    const SWARM_SPEED_BONUS = 0.4;          // her yakın bot için ekstra hız
    const SWARM_NEARBY_RADIUS = 150;        // [VARSAYIM] "yakın" sayılma mesafesi
    const SWARM_ENGAGE_DIST = 180;          // bu mesafeden yakına gelince durup ateş eder
    const SWARM_SHOOT_RANGE = RANGE;
    const SWARM_SPAWN_INTERVAL = 490;       // [VARSAYIM] ~8.2 saniyede bir doğar

    // --- İyileştirici Bot ayarları ---
    const HEALER_HP = 2500;                 // [VARSAYIM]
    const HEALER_SPEED = 1.2;               // [VARSAYIM]
    const HEALER_HEAL_AMOUNT = 300;         // [VARSAYIM]
    const HEALER_HEAL_RADIUS = 220;         // [VARSAYIM]
    const HEALER_HEAL_INTERVAL = 120;       // 2 saniyede bir iyileştirir
    const HEALER_SPAWN_INTERVAL = 900;      // [VARSAYIM] ~15 saniyede bir doğar (nadir)
    const HEALER_STOP_DIST = 60;            // hedefine bu kadar yaklaşınca durur

    const SPAWN_WARN_FRAMES = 90;           // 1.5 saniye önceden uyarı çıkar

    let swarmBots = [];
    let healerBots = [];
    let mySpawnIndicators = []; // {x,y,timer,type}
    let swarmSpawnTimer = 0;
    let healerSpawnTimer = 0;

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args, prevResult);
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
            speed: SWARM_BASE_SPEED, color: '#9b59b6',
            isDead: false, isActive: true,
            kbX: 0, kbY: 0, bombaBulasti: false, bombaSayaci: 0,
            lastShot: 0, shootInterval: BOT_SHOOT_INTERVAL
        };
    }

    function createHealerBot(x, y) {
        return {
            x, y, radius: 20, angle: 0,
            hp: HEALER_HP, maxHp: HEALER_HP,
            speed: HEALER_SPEED, color: '#9b59b6', // klasik mor renk, aynı görünüm
            isDead: false, isActive: true,
            kbX: 0, kbY: 0, bombaBulasti: false, bombaSayaci: 0,
            healCooldown: 0
        };
    }

    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Mutasyon',

        onStart() {
            swarmBots = []; healerBots = []; mySpawnIndicators = [];
            swarmSpawnTimer = 0; healerSpawnTimer = 0;

            // Klasik botları tamamen kapat
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = []; boomerangBots = [];
            fogBots = []; nests = []; spawnIndicators = [];
        },

        onUpdate(ts) {
            // Klasik spawn zamanlayıcılarını sürekli sıfırla, hiçbiri doğmasın
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];
            nests = []; // 10 öldürmede otomatik doğan yuvayı da engelle

            // --- Kendi spawn zamanlayıcılarımız ---
            swarmSpawnTimer += ts;
            if (swarmSpawnTimer >= SWARM_SPAWN_INTERVAL) {
                swarmSpawnTimer = 0;
                const p = randSpawnPoint();
                mySpawnIndicators.push({ x: p.x, y: p.y, timer: SPAWN_WARN_FRAMES, type: 'swarm' });
            }
            healerSpawnTimer += ts;
            if (healerSpawnTimer >= HEALER_SPAWN_INTERVAL) {
                healerSpawnTimer = 0;
                const p = randSpawnPoint();
                mySpawnIndicators.push({ x: p.x, y: p.y, timer: SPAWN_WARN_FRAMES, type: 'healer' });
            }

            // Uyarı süresi bitince gerçek botu doğur
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

                // Can kontrolü - bu kontrol olmazsa bot asla ölmez
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { swarmBots.splice(i, 1); continue; }

                // Hız hesabı: yakındaki her bota göre anlık artış
                let yakinSayisi = 0;
                getActiveEnemies().forEach(e => {
                    if (e !== b && getDist(b, e) < SWARM_NEARBY_RADIUS) yakinSayisi++;
                });
                b.speed = SWARM_BASE_SPEED + (yakinSayisi * SWARM_SPEED_BONUS);

                // Görünmezlik kontrolü - bu olmazsa bot görünmez oyuncuyu da görür
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
                // canSeePlayer false ise (oyuncu ölü ya da görünmezse) bot olduğu yerde kalır
            }

            // --- İyileştirici Bot davranışı ---
            for (let i = healerBots.length - 1; i >= 0; i--) {
                const h = healerBots[i];

                if (h.hp <= 0 && !h.isDead) {
                    h.isDead = true;
                    spawnParticles(h.x, h.y, h.color);
                    triggerBotKill(h.x, h);
                }
                if (h.isDead) { healerBots.splice(i, 1); continue; }

                // En yakın yaralı dostu bul (kendisi hariç)
                let hedef = null, hedefMesafe = Infinity;
                getActiveEnemies().forEach(e => {
                    if (e === h) return;
                    if (e.hp < e.maxHp) {
                        const d = getDist(h, e);
                        if (d < hedefMesafe) { hedefMesafe = d; hedef = e; }
                    }
                });

                if (hedef) {
                    h.angle = Math.atan2(hedef.y - h.y, hedef.x - h.x);
                    if (hedefMesafe > HEALER_STOP_DIST) {
                        h.x += Math.cos(h.angle) * h.speed * ts;
                        h.y += Math.sin(h.angle) * h.speed * ts;
                    }
                    h.healCooldown -= ts;
                    if (hedefMesafe < HEALER_HEAL_RADIUS && h.healCooldown <= 0) {
                        hedef.hp = Math.min(hedef.maxHp, hedef.hp + HEALER_HEAL_AMOUNT);
                        addFloatingNumber(hedef.x, hedef.y, "+" + HEALER_HEAL_AMOUNT, "#2ecc71");
                        h.healCooldown = HEALER_HEAL_INTERVAL;
                    }
                }
                // hedef yoksa olduğu yerde durur, oyuncuya hiç saldırmaz
            }
        },

        onDraw(ctx2) {
            // Kendi doğum uyarılarımız - ana oyununkiyle aynı görsel stil
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

            // Botları, ana dosyanın KENDİ çizim fonksiyonuyla çiz -> klasik görünüm bedava
            swarmBots.forEach(b => drawEntity(b, false));
            healerBots.forEach(h => drawEntity(h, false));
        },

        onReset() {
            swarmBots = []; healerBots = []; mySpawnIndicators = [];
            swarmSpawnTimer = 0; healerSpawnTimer = 0;
        }
    };

    // Ana oyun her karede bunu çağırıyor (mod aktif olsun olmasın) - bu yüzden
    // mod aktif değilse kendi botlarımızı hiç karıştırmamalıyız
    chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        return swarmBots.concat(healerBots).filter(e => !e.isDead);
    });

    // onDraw hook'u da mod fark etmeksizin her karede çağrılıyor, aynı sebeple koruyoruz
    chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID) return;
        // asıl çizim işi zaten modes[MOD_ID].onDraw içinde ana kod tarafından
        // otomatik çağrılmıyor - o yüzden burada manuel çağırıyoruz
        window.GAME_EXT.modes[MOD_ID].onDraw(ctx2);
    });

    // --- Mod seçim kartı ---
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
            // Zorluk seçimine dokunmuyoruz, oyuncu Kolay/Klasik'i istediği gibi seçebilir
        });
    }

})();
