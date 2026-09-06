// ========== mod7.js (BUZUL ÇAĞI) - BUZ BOTU SLIME GİBİ, SİPERLER KLASİK DÜZENDE ==========
// - Buz Botu periyodik spawn olur (15 saniyede bir, maksimum 3).
// - Siperler klasik moddaki gibi üst üste binebilir, merkez dahil her yerde doğabilir,
//   ama duvarlardan uzaklık zorunluluğu korunur.
// - Buz Ciritçisi oyun başında sahadadır, ölünce 370 frame sonra yeniden doğar.
// - Buz Bumerangı klasik bumerang botu gibi periyodik spawn olur, bumerang fırlatır.
// - Siperlerden çıkan Buz Slime'lar skor artırmaz.
// - Görsel iyileştirmeler: saldırı animasyonu, mızrak tasarımı, bumerang alanı.

(function () {
    'use strict';

    const MOD_ID = 'buzul';

    // Buz Slime
    const SLIME_HP = 600;
    const SLIME_SPEED = 2.5;
    const SLIME_RADIUS = 12;
    const SLIME_DAMAGE = 150;

    // Buz Botu (periyodik spawn)
    const BUZ_BOT_HP = 5000;
    const BUZ_BOT_SPEED = 0.8;
    const BUZ_BOT_RADIUS = 22;
    const BUZ_BOT_TEMAS_HASAR = 600;
    const BUZ_BOT_ITME_MESAFE = 25;
    const BUZ_BOT_PATLAMA_YARICAP = 68;
    const BUZ_BOT_PATLAMA_HASAR = 200;
    const BUZ_BOT_SPAWN_INTERVAL = 900;   // 15 saniye
    const BUZ_BOT_SPAWN_WARN = 180;       // 3 saniye uyarı
    const BUZ_BOT_SALDIRI_ARALIK = 2000;  // 2 saniyede bir temas vuruşu
    const BUZ_BOT_VURUS_ANIM = 12;

    // Buz Ciritçisi
    const CIRITCI_HP = 2500;
    const CIRITCI_SPEED = 0.8;
    const CIRITCI_RADIUS = 18;
    const CIRITCI_SHOOT_RANGE = 300;
    const CIRITCI_SHOOT_INTERVAL = 1500;
    const CIRITCI_DAMAGE = 400;
    const CIRITCI_RESPAWN_TIME = 370;     // 6.17 saniye

    // Buz Bumerangı
    const BUMERANG_HP = 1500;
    const BUMERANG_SPEED = 1.2;
    const BUMERANG_RADIUS = 16;
    const BUMERANG_ALAN_YARICAP = 68;
    const BUMERANG_ALAN_OYUNCU_HASAR = 100;
    const BUMERANG_ALAN_SIPER_HASAR = 90;
    const BUMERANG_SPAWN_INTERVAL = 1200; // 20 saniye
    const BUMERANG_SPAWN_WARN = 180;
    const BUMERANG_MENZIL = RANGE * 2.5;
    const BUMERANG_HASAR_GIDIS = 300;
    const BUMERANG_HASAR_DONUS = 500;
    const BUMERANG_MERMI_HIZ = BOT_BULLET_SPEED * 0.7;
    const BUMERANG_MAX_HITS = 3;

    let buzSlimeLari = [];
    let buzBotlari = [];
    let ciritciBotlari = [];
    let buzBumeranglari = [];
    let buzBumerangMermileri = [];
    let buzBotSpawnTimer = 0;
    let buzBotSpawnUyarilari = [];
    let ciritciRespawnTimer = -1;
    let bumerangSpawnTimer = 0;
    let bumerangSpawnUyarilari = [];
    let sonTemasZamani = {};

    // Orijinal spawnObstacle fonksiyonunu yedekle
    const originalSpawnObstacle = window.spawnObstacle;

    // ========== MOD TANIMI ==========
    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Buzul Çağı',
        onStart: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            buzBumeranglari = [];
            buzBumerangMermileri = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            bumerangSpawnTimer = 0;
            bumerangSpawnUyarilari = [];
            sonTemasZamani = {};

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];

            // Oyun başında bir Buz Ciritçisi
            ciritciBotlari.push({
                x: canvas.width - 150, y: canvas.height / 2,
                radius: CIRITCI_RADIUS,
                hp: CIRITCI_HP,
                maxHp: CIRITCI_HP,
                speed: CIRITCI_SPEED,
                baseSpeed: CIRITCI_SPEED,
                angle: 0,
                lastShot: 0,
                isDead: false,
                isActive: true,
                color: '#5dade2',
                kbX: 0, kbY: 0,
                oSp: CIRITCI_SPEED,
                oR: CIRITCI_RADIUS
            });

            // Buzul modunda özel siper spawn: her yerde, üst üste binebilir, ama duvarlardan uzak
            window.spawnObstacle = function () {
                if (window.GAME_MODE !== MOD_ID) {
                    if (originalSpawnObstacle) originalSpawnObstacle();
                    return;
                }
                if (obstacles.length >= 12) return;
                const margin = 40; // duvarlardan minimum uzaklık (klasik mantık korunur)
                const x = Math.random() * (canvas.width - margin * 2) + margin;
                const y = Math.random() * (canvas.height - margin * 2) + margin;
                obstacles.push({
                    x, y,
                    radius: 35 + Math.random() * 15,
                    hp: 800,
                    maxHp: 800
                });
            };
        },
        onUpdate: function (ts) {
            slimeTimer = 0;
            stationaryTimer = 0;
            boomerangTimer = 0;
            fogBotTimer = 0;
            spawnIndicators = [];

            // Siperlerden buz slime çıkarma (skor artırmaz)
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                if (o.hp <= 0) {
                    for (let k = 0; k < 2; k++) {
                        const offsetX = (Math.random() - 0.5) * 30;
                        const offsetY = (Math.random() - 0.5) * 30;
                        buzSlimeLari.push({
                            x: o.x + offsetX, y: o.y + offsetY,
                            radius: SLIME_RADIUS,
                            hp: SLIME_HP,
                            maxHp: SLIME_HP,
                            speed: SLIME_SPEED,
                            baseSpeed: SLIME_SPEED,
                            angle: Math.random() * Math.PI * 2,
                            isDead: false,
                            isActive: true,
                            color: '#aed6f1',
                            kbX: 0, kbY: 0,
                            oSp: SLIME_SPEED,
                            oR: SLIME_RADIUS
                        });
                    }
                    spawnParticles(o.x, o.y, '#5dade2', 'normal');
                }
            }

            // Buz Botu periyodik spawn
            buzBotSpawnTimer += ts;
            if (buzBotSpawnTimer >= BUZ_BOT_SPAWN_INTERVAL && buzBotlari.length < 3) {
                buzBotSpawnTimer = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                buzBotSpawnUyarilari.push({ x, y, timer: BUZ_BOT_SPAWN_WARN });
            }

            for (let i = buzBotSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = buzBotSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    const yeniBot = {
                        x: u.x, y: u.y,
                        radius: BUZ_BOT_RADIUS,
                        hp: BUZ_BOT_HP,
                        maxHp: BUZ_BOT_HP,
                        speed: BUZ_BOT_SPEED,
                        baseSpeed: BUZ_BOT_SPEED,
                        angle: 0,
                        isDead: false,
                        isActive: true,
                        color: '#2e86c1',
                        kbX: 0, kbY: 0,
                        oSp: BUZ_BOT_SPEED,
                        oR: BUZ_BOT_RADIUS,
                        vurusAnimasyon: 0
                    };
                    buzBotlari.push(yeniBot);
                    sonTemasZamani[yeniBot] = 0;
                    buzBotSpawnUyarilari.splice(i, 1);
                }
            }

            // Buz Ciritçisi respawn
            if (ciritciRespawnTimer >= 0) {
                ciritciRespawnTimer -= ts;
                if (ciritciRespawnTimer <= 0) {
                    ciritciRespawnTimer = -1;
                    const x = Math.random() > 0.5 ? canvas.width - 120 : 120;
                    const y = Math.random() * (canvas.height - 240) + 120;
                    ciritciBotlari.push({
                        x, y,
                        radius: CIRITCI_RADIUS,
                        hp: CIRITCI_HP,
                        maxHp: CIRITCI_HP,
                        speed: CIRITCI_SPEED,
                        baseSpeed: CIRITCI_SPEED,
                        angle: Math.PI,
                        lastShot: 0,
                        isDead: false,
                        isActive: true,
                        color: '#5dade2',
                        kbX: 0, kbY: 0,
                        oSp: CIRITCI_SPEED,
                        oR: CIRITCI_RADIUS
                    });
                }
            }

            // Buz Bumerangı spawn
            bumerangSpawnTimer += ts;
            if (bumerangSpawnTimer >= BUMERANG_SPAWN_INTERVAL && buzBumeranglari.length < 3) {
                bumerangSpawnTimer = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                bumerangSpawnUyarilari.push({ x, y, timer: BUMERANG_SPAWN_WARN });
            }

            for (let i = bumerangSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = bumerangSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    buzBumeranglari.push({
                        x: u.x, y: u.y,
                        radius: BUMERANG_RADIUS,
                        hp: BUMERANG_HP,
                        maxHp: BUMERANG_HP,
                        speed: BUMERANG_SPEED,
                        angle: 0,
                        lastShot: 0,
                        shootInterval: 2000,
                        isDead: false,
                        isActive: true,
                        color: '#5dade2',
                        kbX: 0, kbY: 0,
                        oSp: BUMERANG_SPEED,
                        oR: BUMERANG_RADIUS,
                        alanHasarTimer: 0
                    });
                    bumerangSpawnUyarilari.splice(i, 1);
                }
            }

            // Buz Bumerangı güncelleme
            for (let i = buzBumeranglari.length - 1; i >= 0; i--) {
                const b = buzBumeranglari[i];

                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, '#aed6f1', 'normal');
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { buzBumeranglari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    const d = getDist(b, player);
                    if (d > 200) {
                        b.x += Math.cos(b.angle) * b.speed * ts;
                        b.y += Math.sin(b.angle) * b.speed * ts;
                    }

                    if (d < BUMERANG_MENZIL && Date.now() - b.lastShot > b.shootInterval) {
                        b.lastShot = Date.now();
                        buzBumerangMermileri.push({
                            x: b.x, y: b.y,
                            sx: b.x, sy: b.y,
                            vx: Math.cos(b.angle) * BUMERANG_MERMI_HIZ,
                            vy: Math.sin(b.angle) * BUMERANG_MERMI_HIZ,
                            returning: false,
                            hitTargets: [],
                            hasarGidis: BUMERANG_HASAR_GIDIS,
                            hasarDonus: BUMERANG_HASAR_DONUS,
                            maxHits: BUMERANG_MAX_HITS,
                            owner: b,
                            alanHasarTimer: 0
                        });
                    }
                }

                if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                    b.x += b.kbX * ts;
                    b.y += b.kbY * ts;
                    b.kbX *= 0.85;
                    b.kbY *= 0.85;
                }

                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }

            // Bumerang mermileri güncelleme
            for (let i = buzBumerangMermileri.length - 1; i >= 0; i--) {
                const m = buzBumerangMermileri[i];

                m.alanHasarTimer += ts;
                if (m.alanHasarTimer >= 60) {
                    m.alanHasarTimer = 0;
                    if (!player.isDead && getDist(m, player) < BUMERANG_ALAN_YARICAP + player.radius) {
                        player.hp -= BUMERANG_ALAN_OYUNCU_HASAR;
                        addFloatingNumber(player.x, player.y, BUMERANG_ALAN_OYUNCU_HASAR, "#5dade2");
                        player.lastHitTime = Date.now();
                    }
                    for (const o of obstacles) {
                        if (getDist(m, o) < BUMERANG_ALAN_YARICAP + o.radius) {
                            o.hp -= BUMERANG_ALAN_SIPER_HASAR;
                            addFloatingNumber(o.x, o.y, BUMERANG_ALAN_SIPER_HASAR, "#5dade2");
                        }
                    }
                }

                if (!m.returning) {
                    m.x += m.vx * ts;
                    m.y += m.vy * ts;

                    const outOfRange = getDist(m, {x: m.sx, y: m.sy}) > BUMERANG_MENZIL;
                    const hitWall = m.x < WALL_THICKNESS + 5 || m.x > canvas.width - WALL_THICKNESS - 5 ||
                                    m.y < WALL_THICKNESS + 5 || m.y > canvas.height - WALL_THICKNESS - 5;

                    let hitObs = false;
                    for (const o of obstacles.concat(cactusWalls || [])) {
                        if (getDist(m, o) < o.radius + 5) {
                            o.hp -= 100;
                            hitObs = true;
                            break;
                        }
                    }

                    if (outOfRange || hitWall || hitObs) {
                        m.returning = true;
                        m.hitTargets = [];
                    } else {
                        getActiveEnemies().forEach(e => {
                            if (m.hitTargets.includes(e)) return;
                            if (getDist(m, e) < e.radius + 12) {
                                e.hp -= m.hasarGidis;
                                addFloatingNumber(e.x, e.y, m.hasarGidis, "#5dade2");
                                m.hitTargets.push(e);
                                if (m.hitTargets.length >= m.maxHits) {
                                    m.returning = true;
                                    m.hitTargets = [];
                                }
                            }
                        });
                    }
                } else {
                    const ang = getAngle(m, m.owner);
                    m.vx = Math.cos(ang) * BUMERANG_MERMI_HIZ;
                    m.vy = Math.sin(ang) * BUMERANG_MERMI_HIZ;
                    m.x += m.vx * ts;
                    m.y += m.vy * ts;

                    getActiveEnemies().forEach(e => {
                        if (m.hitTargets.includes(e)) return;
                        if (getDist(m, e) < e.radius + 12) {
                            e.hp -= m.hasarDonus;
                            addFloatingNumber(e.x, e.y, m.hasarDonus, "#5dade2");
                            m.hitTargets.push(e);
                        }
                    });

                    if (getDist(m, m.owner) < m.owner.radius + 15) {
                        buzBumerangMermileri.splice(i, 1);
                        continue;
                    }
                }
            }

            // Buz Slime güncelleme (skor artırmaz)
            for (let i = buzSlimeLari.length - 1; i >= 0; i--) {
                const b = buzSlimeLari[i];

                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                }
                if (b.isDead) { buzSlimeLari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                }

                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);

                if (!player.isDead && !player.jumpInvulnerable && getDist(b, player) < b.radius + player.radius) {
                    player.hp -= SLIME_DAMAGE;
                    addFloatingNumber(player.x, player.y, SLIME_DAMAGE, "#e74c3c");
                    player.lastHitTime = Date.now();
                    b.hp = 0;
                }
            }

            // Buz Ciritçisi güncelleme
            for (let i = ciritciBotlari.length - 1; i >= 0; i--) {
                const c = ciritciBotlari[i];

                if (c.hp <= 0 && !c.isDead) {
                    c.isDead = true;
                    spawnParticles(c.x, c.y, c.color);
                    triggerBotKill(c.x, c);
                    ciritciRespawnTimer = CIRITCI_RESPAWN_TIME;
                }
                if (c.isDead) { ciritciBotlari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    c.angle = Math.atan2(player.y - c.y, player.x - c.x);
                    const d = getDist(c, player);
                    if (d > CIRITCI_SHOOT_RANGE) {
                        c.x += Math.cos(c.angle) * c.speed * ts;
                        c.y += Math.sin(c.angle) * c.speed * ts;
                    } else if (d < 150) {
                        c.x -= Math.cos(c.angle) * c.speed * ts;
                        c.y -= Math.sin(c.angle) * c.speed * ts;
                    }

                    if (d < CIRITCI_SHOOT_RANGE && Date.now() - c.lastShot > CIRITCI_SHOOT_INTERVAL) {
                        c.lastShot = Date.now();
                        botBullets.push({
                            x: c.x, y: c.y,
                            sx: c.x, sy: c.y,
                            vx: Math.cos(c.angle) * BOT_BULLET_SPEED,
                            vy: Math.sin(c.angle) * BOT_BULLET_SPEED,
                            dmgMod: 1,
                            type: 'ciritci_mizrak',
                            owner: c
                        });
                    }
                }

                if (Math.abs(c.kbX) > 0.1 || Math.abs(c.kbY) > 0.1) {
                    c.x += c.kbX * ts;
                    c.y += c.kbY * ts;
                    c.kbX *= 0.85;
                    c.kbY *= 0.85;
                }

                c.x = clampPos(c.x, c.radius + WALL_THICKNESS, canvas.width - c.radius - WALL_THICKNESS);
                c.y = clampPos(c.y, c.radius + WALL_THICKNESS, canvas.height - c.radius - WALL_THICKNESS);
                resolveObstacleCollision(c);
            }

            // Buz Botu güncelleme
            for (let i = buzBotlari.length - 1; i >= 0; i--) {
                const b = buzBotlari[i];

                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    if (!player.isDead && getDist(b, player) < BUZ_BOT_PATLAMA_YARICAP + player.radius) {
                        player.hp -= BUZ_BOT_PATLAMA_HASAR;
                        addFloatingNumber(player.x, player.y, BUZ_BOT_PATLAMA_HASAR, "#e74c3c");
                        player.lastHitTime = Date.now();
                    }
                    for (let k = 0; k < 12; k++) {
                        const ang = Math.random() * Math.PI * 2;
                        const dist = Math.random() * 30;
                        spawnParticles(b.x + Math.cos(ang) * dist, b.y + Math.sin(ang) * dist, '#aed6f1', 'normal');
                    }
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { buzBotlari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    const d = getDist(b, player);
                    if (d > b.radius + player.radius + 5) {
                        b.x += Math.cos(b.angle) * b.speed * ts;
                        b.y += Math.sin(b.angle) * b.speed * ts;
                    } else {
                        const simdi = Date.now();
                        if (simdi - sonTemasZamani[b] >= BUZ_BOT_SALDIRI_ARALIK) {
                            sonTemasZamani[b] = simdi;
                            player.hp -= BUZ_BOT_TEMAS_HASAR;
                            addFloatingNumber(player.x, player.y, BUZ_BOT_TEMAS_HASAR, "#e74c3c");
                            player.lastHitTime = Date.now();
                            const itmeAci = getAngle(b, player);
                            player.x += Math.cos(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            player.y += Math.sin(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                            b.vurusAnimasyon = BUZ_BOT_VURUS_ANIM;
                        }
                    }
                }

                if (b.vurusAnimasyon > 0) b.vurusAnimasyon -= ts;

                if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                    b.x += b.kbX * ts;
                    b.y += b.kbY * ts;
                    b.kbX *= 0.85;
                    b.kbY *= 0.85;
                }

                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }
        },
        onReset: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            buzBumeranglari = [];
            buzBumerangMermileri = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            bumerangSpawnTimer = 0;
            bumerangSpawnUyarilari = [];
            sonTemasZamani = {};

            if (originalSpawnObstacle) {
                window.spawnObstacle = originalSpawnObstacle;
            }
        }
    };

    // ========== EK DÜŞMANLAR ==========
    const originalGetExtraEnemies = window.GAME_EXT.hooks.getExtraEnemies;
    window.GAME_EXT.hooks.getExtraEnemies = function () {
        let extras = [];
        if (typeof originalGetExtraEnemies === 'function') {
            extras = originalGetExtraEnemies() || [];
        }
        extras = extras.concat(buzSlimeLari.filter(b => !b.isDead));
        extras = extras.concat(buzBotlari.filter(b => !b.isDead));
        extras = extras.concat(ciritciBotlari.filter(b => !b.isDead));
        extras = extras.concat(buzBumeranglari.filter(b => !b.isDead));
        return extras;
    };

    // ========== ÇİZİM ==========
    const originalDraw = window.draw;
    window.draw = function () {
        if (window.GAME_MODE === MOD_ID && gameStarted) {
            const gercekEngeller = obstacles;
            obstacles = [];
            originalDraw();
            obstacles = gercekEngeller;

            for (const o of obstacles) {
                ctx.save();
                ctx.translate(o.x, o.y);
                ctx.fillStyle = '#5dade2';
                ctx.beginPath();
                ctx.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 10);
                ctx.fill();
                ctx.strokeStyle = '#2e86c1';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(-15, -o.radius - 15, 30 * (o.hp / o.maxHp), 4);
                ctx.restore();
            }
        } else {
            originalDraw();
        }

        if (!gameStarted || window.GAME_MODE !== MOD_ID) return;

        // Spawn uyarıları
        buzBotSpawnUyarilari.forEach(u => {
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx.beginPath();
            ctx.arc(0, 0, BUZ_BOT_RADIUS + 15, 0, Math.PI * 2);
            ctx.strokeStyle = '#2e86c1';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#2e86c1';
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.fillText(Math.ceil(u.timer / 60), 0, 6);
            ctx.restore();
        });

        bumerangSpawnUyarilari.forEach(u => {
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx.beginPath();
            ctx.arc(0, 0, BUMERANG_RADIUS + 12, 0, Math.PI * 2);
            ctx.strokeStyle = '#aed6f1';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#aed6f1';
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(Math.ceil(u.timer / 60), 0, 5);
            ctx.restore();
        });

        // Buz Botları
        buzBotlari.forEach(b => {
            if (b.isDead) return;
            ctx.save();
            ctx.translate(b.x, b.y);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-25, -b.radius - 15, 50, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-25, -b.radius - 15, 50 * (b.hp / b.maxHp), 5);

            if (b.vurusAnimasyon > 0) {
                const animOrani = b.vurusAnimasyon / BUZ_BOT_VURUS_ANIM;
                ctx.strokeStyle = `rgba(174, 214, 241, ${animOrani})`;
                ctx.lineWidth = 3;
                for (let k = 0; k < 6; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const dist = b.radius + animOrani * 20;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(ang) * b.radius * 0.5, Math.sin(ang) * b.radius * 0.5);
                    ctx.lineTo(Math.cos(ang) * dist, Math.sin(ang) * dist);
                    ctx.stroke();
                }
            }

            const animScale = b.vurusAnimasyon > 0 ? 1.15 : 1;
            ctx.scale(animScale, animScale);

            ctx.rotate(b.angle);
            ctx.fillStyle = '#2e86c1';
            ctx.beginPath();
            ctx.moveTo(b.radius, 0);
            ctx.lineTo(b.radius * 0.4, -b.radius);
            ctx.lineTo(-b.radius * 0.8, -b.radius * 0.7);
            ctx.lineTo(-b.radius * 0.8, b.radius * 0.7);
            ctx.lineTo(b.radius * 0.4, b.radius);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#1a5276';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.arc(0, 0, b.radius * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(8, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(8, 5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Buz Ciritçileri
        ciritciBotlari.forEach(c => {
            if (c.isDead) return;
            ctx.save();
            ctx.translate(c.x, c.y);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-20, -c.radius - 15, 40, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-20, -c.radius - 15, 40 * (c.hp / c.maxHp), 5);

            ctx.rotate(c.angle);
            ctx.fillStyle = '#5dade2';
            ctx.beginPath();
            ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2e86c1';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Buz mızrağı
            ctx.fillStyle = '#aed6f1';
            ctx.fillRect(12, -2, 22, 4);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(34, 0);
            ctx.lineTo(26, -6);
            ctx.lineTo(26, 6);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(14, -2);
            ctx.lineTo(22, 2);
            ctx.stroke();
            ctx.fillStyle = '#1a5276';
            ctx.beginPath();
            ctx.arc(6, -5, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(6, 5, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Buz Bumerangları
        buzBumeranglari.forEach(b => {
            if (b.isDead) return;
            ctx.save();
            ctx.translate(b.x, b.y);

            ctx.rotate(Date.now() / 100 + b.angle);
            ctx.fillStyle = '#5dade2';
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(-6, 12);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-6, -12);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#2e86c1';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.rotate(-(Date.now() / 100 + b.angle));
            ctx.fillStyle = '#1a5276';
            ctx.beginPath();
            ctx.arc(8, 0, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-20, -b.radius - 12, 40, 4);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-20, -b.radius - 12, 40 * (b.hp / b.maxHp), 4);
            ctx.restore();
        });

        // Bumerang mermileri (altında buz alanı)
        buzBumerangMermileri.forEach(m => {
            ctx.beginPath();
            ctx.arc(m.x, m.y, BUMERANG_ALAN_YARICAP, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(174, 214, 241, 0.25)';
            ctx.fill();

            ctx.save();
            ctx.translate(m.x, m.y);
            ctx.rotate(Date.now() / 80);
            ctx.fillStyle = '#aed6f1';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-5, 8);
            ctx.lineTo(-3, 0);
            ctx.lineTo(-5, -8);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        });

        // Buz Slime'ları
        buzSlimeLari.forEach(b => {
            if (b.isDead) return;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-10, -b.radius - 10, 20, 3);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-10, -b.radius - 10, 20 * (b.hp / b.maxHp), 3);
            ctx.rotate(b.angle);
            ctx.fillStyle = '#aed6f1';
            ctx.beginPath();
            ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#2e86c1';
            ctx.beginPath();
            ctx.arc(4, -3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(4, 3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    };

    // ========== MOD SEÇİM KARTI + OK BUTONLARI ==========
    const track = document.getElementById('difficulty-track');
    if (track) {
        track.style.touchAction = 'pan-y';
        track.style.webkitOverflowScrolling = 'touch';
        track.style.overflowY = 'scroll';
        track.style.maxHeight = '70vh';
        track.style.scrollSnapType = 'none';
    }

    if (track && !document.getElementById('diff-buzul')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-buzul';
        card.style.flex = '0 0 auto';
        card.style.width = 'min(76vw,300px)';
        card.style.margin = '5px auto';
        card.style.padding = '15px 10px';
        card.innerHTML =
            '<span>Buzul Çağı</span>' +
            '<small>Buz Botu + Ciritçi + Bumerang<br>Siperler buz keser</small>';
        track.appendChild(card);

        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        });
        card.addEventListener('touchstart', (e) => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        }, { passive: true });
    }

    const difficultyScreen = document.getElementById('difficulty-screen');
    if (difficultyScreen && !document.getElementById('mod-up-btn')) {
        const upBtn = document.createElement('button');
        upBtn.id = 'mod-up-btn';
        upBtn.textContent = '▲';
        upBtn.style.cssText = `
            position: absolute;
            right: 8px;
            top: 20%;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            color: #fff;
            border: 2px solid rgba(255,255,255,0.5);
            font-size: 20px;
            cursor: pointer;
            z-index: 70;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            touch-action: manipulation;
        `;

        const downBtn = document.createElement('button');
        downBtn.id = 'mod-down-btn';
        downBtn.textContent = '▼';
        downBtn.style.cssText = upBtn.style.cssText;
        downBtn.style.top = 'auto';
        downBtn.style.bottom = '20%';

        function getSelectedIndex() {
            const cards = document.querySelectorAll('.diff-card');
            for (let i = 0; i < cards.length; i++) {
                if (cards[i].classList.contains('selected')) return i;
            }
            return 0;
        }

        function selectCardByIndex(index) {
            const cards = document.querySelectorAll('.diff-card');
            if (cards.length === 0) return;
            if (index < 0) index = 0;
            if (index >= cards.length) index = cards.length - 1;
            cards.forEach(c => c.classList.remove('selected'));
            cards[index].classList.add('selected');
            cards[index].scrollIntoView({ behavior: 'smooth', block: 'center' });

            const cardId = cards[index].id;
            if (cardId === 'diff-normal') window.GAME_MODE = 'arena';
            else if (cardId === 'diff-easy') { /* kolay klasik */ }
            else if (cardId === 'diff-buzul') window.GAME_MODE = 'buzul';
        }

        function moveSelection(direction) {
            const current = getSelectedIndex();
            const newIndex = direction === 'up' ? current - 1 : current + 1;
            selectCardByIndex(newIndex);
        }

        upBtn.addEventListener('click', (e) => { e.preventDefault(); moveSelection('up'); });
        downBtn.addEventListener('click', (e) => { e.preventDefault(); moveSelection('down'); });
        upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); moveSelection('up'); }, { passive: false });
        downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); moveSelection('down'); }, { passive: false });

        difficultyScreen.appendChild(upBtn);
        difficultyScreen.appendChild(downBtn);
    }

})();