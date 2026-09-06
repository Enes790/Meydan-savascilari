// ========== mod7.js (BUZUL ÇAĞI) - HEYKEL GÜÇLENDİRİLDİ, CAN KAYBI KALDIRILDI ==========
// - Heykel saldırı başına can kaybetmez.
// - Heykel canı: 11100 (10800 + 300).
// - Heykel yok olunca 4 Buz Slime çıkar.
// - Heykel menzili: 50, hasarı: 220, yapım süresi: 5 saniye.
// - Heykel Tıraşı canı: 1300, menzili: 160, hasarı: 300.

(function () {
    'use strict';

    const MOD_ID = 'buzul';

    // Buz Slime
    const SLIME_HP = 600;
    const SLIME_SPEED = 2.5;
    const SLIME_RADIUS = 12;
    const SLIME_DAMAGE = 150;

    // Buz Botu
    const BUZ_BOT_HP = 4500;
    const BUZ_BOT_SPEED = 0.8;
    const BUZ_BOT_RADIUS = 22;
    const BUZ_BOT_TEMAS_HASAR = 500;
    const BUZ_BOT_ITME_MESAFE = 25;
    const BUZ_BOT_PATLAMA_YARICAP = 68;
    const BUZ_BOT_PATLAMA_HASAR = 150;
    const BUZ_BOT_SPAWN_INTERVAL = 900;
    const BUZ_BOT_SPAWN_WARN = 180;
    const BUZ_BOT_SALDIRI_ARALIK = 2000;
    const BUZ_BOT_VURUS_ANIM = 12;

    // Buz Ciritçisi
    const CIRITCI_HP = 2500;
    const CIRITCI_SPEED = 0.8;
    const CIRITCI_RADIUS = 18;
    const CIRITCI_SHOOT_RANGE = 261;
    const CIRITCI_SHOOT_INTERVAL = 1500;
    const CIRITCI_DAMAGE = 400;
    const CIRITCI_RESPAWN_TIME = 370;
    const CIRITCI_SPAWN_WARN = 90;
    const CIRITCI_MERMI_HIZ = BOT_BULLET_SPEED * 0.87;

    // Heykel Tıraşı
    const HEYKEL_TIRASI_HP = 1300;          // 1000 + 300
    const HEYKEL_TIRASI_SPEED = 0.5;
    const HEYKEL_TIRASI_RADIUS = 18;
    const HEYKEL_TIRASI_MENZIL = 160;       // arttırıldı
    const HEYKEL_TIRASI_HASAR = 300;        // 100 + 200
    const HEYKEL_TIRASI_SPAWN_INTERVAL = 1200;
    const HEYKEL_TIRASI_SPAWN_WARN = 180;
    const HEYKEL_INSAA_SURESI = 300;        // 5 saniye (6 - 1)

    // Heykel
    const HEYKEL_HP = 11100;                // 10800 + 300
    const HEYKEL_SPEED = 0.6;
    const HEYKEL_RADIUS = 30;
    const HEYKEL_SALDIRI_HASAR = 220;       // 20 + 200
    const HEYKEL_ITME_MESAFE = 25;
    const HEYKEL_SALDIRI_MENZIL = 50;       // arttırıldı
    const HEYKEL_SALDIRI_ARALIK = 100;
    // Heykel saldırı can kaybı kaldırıldı (HEYKEL_SALDIRI_CAN_KAYBI yok)
    const HEYKEL_PASIF_CAN_KAYBI = 300;
    const HEYKEL_PASIF_KAYIP_ARALIK = 180;
    const HEYKEL_IYILESTIRME = 100;

    let buzSlimeLari = [];
    let buzBotlari = [];
    let ciritciBotlari = [];
    let heykelTirasiBotlari = [];
    let heykeller = [];
    let buzBotSpawnTimer = 0;
    let buzBotSpawnUyarilari = [];
    let ciritciRespawnTimer = -1;
    let ciritciSpawnUyarilari = [];
    let heykelTirasiSpawnTimer = 0;
    let heykelTirasiSpawnUyarilari = [];
    let sonTemasZamani = {};

    const originalSpawnObstacle = window.spawnObstacle;

    // ========== MOD TANIMI ==========
    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Buzul Çağı',
        onStart: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            heykelTirasiBotlari = [];
            heykeller = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            ciritciSpawnUyarilari = [];
            heykelTirasiSpawnTimer = 0;
            heykelTirasiSpawnUyarilari = [];
            sonTemasZamani = {};

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];

            const cx = canvas.width - 150;
            const cy = canvas.height / 2;
            ciritciSpawnUyarilari.push({ x: cx, y: cy, timer: CIRITCI_SPAWN_WARN });

            window.spawnObstacle = function () {
                if (window.GAME_MODE !== MOD_ID) {
                    if (originalSpawnObstacle) originalSpawnObstacle();
                    return;
                }
                if (obstacles.length >= 12) return;
                const margin = 40;
                const x = Math.random() * (canvas.width - margin * 2) + margin;
                const y = Math.random() * (canvas.height - margin * 2) + margin;
                obstacles.push({ x, y, radius: 35 + Math.random() * 15, hp: 800, maxHp: 800 });
            };
        },
        onUpdate: function (ts) {
            slimeTimer = 0;
            stationaryTimer = 0;
            boomerangTimer = 0;
            fogBotTimer = 0;
            spawnIndicators = [];

            // Siperlerden buz slime çıkarma
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                if (o.hp <= 0) {
                    for (let k = 0; k < 2; k++) {
                        const offsetX = (Math.random() - 0.5) * 30;
                        const offsetY = (Math.random() - 0.5) * 30;
                        buzSlimeLari.push({
                            x: o.x + offsetX, y: o.y + offsetY,
                            radius: SLIME_RADIUS,
                            hp: SLIME_HP, maxHp: SLIME_HP,
                            speed: SLIME_SPEED, baseSpeed: SLIME_SPEED,
                            angle: Math.random() * Math.PI * 2,
                            isDead: false, isActive: true,
                            color: '#aed6f1', kbX: 0, kbY: 0,
                            oSp: SLIME_SPEED, oR: SLIME_RADIUS
                        });
                    }
                    spawnParticles(o.x, o.y, '#5dade2', 'normal');
                }
            }

            // Ciritçi spawn uyarıları
            for (let i = ciritciSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = ciritciSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    ciritciBotlari.push({
                        x: u.x, y: u.y,
                        radius: CIRITCI_RADIUS,
                        hp: CIRITCI_HP, maxHp: CIRITCI_HP,
                        speed: CIRITCI_SPEED, baseSpeed: CIRITCI_SPEED,
                        angle: 0, lastShot: 0,
                        isDead: false, isActive: true,
                        color: '#5dade2', kbX: 0, kbY: 0,
                        oSp: CIRITCI_SPEED, oR: CIRITCI_RADIUS
                    });
                    ciritciSpawnUyarilari.splice(i, 1);
                }
            }

            // Ciritçi respawn
            if (ciritciRespawnTimer >= 0) {
                ciritciRespawnTimer -= ts;
                if (ciritciRespawnTimer <= 0) {
                    ciritciRespawnTimer = -1;
                    const x = Math.random() > 0.5 ? canvas.width - 120 : 120;
                    const y = Math.random() * (canvas.height - 240) + 120;
                    ciritciSpawnUyarilari.push({ x, y, timer: CIRITCI_SPAWN_WARN });
                }
            }

            // Buz Botu spawn
            buzBotSpawnTimer += ts;
            if (buzBotSpawnTimer >= BUZ_BOT_SPAWN_INTERVAL) {
                buzBotSpawnTimer = 0;
                if (buzBotlari.length < 2) {
                    const x = Math.random() * (canvas.width - 200) + 100;
                    const y = Math.random() * (canvas.height - 200) + 100;
                    buzBotSpawnUyarilari.push({ x, y, timer: BUZ_BOT_SPAWN_WARN });
                }
            }

            for (let i = buzBotSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = buzBotSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    const yeniBot = {
                        x: u.x, y: u.y,
                        radius: BUZ_BOT_RADIUS,
                        hp: BUZ_BOT_HP, maxHp: BUZ_BOT_HP,
                        speed: BUZ_BOT_SPEED, baseSpeed: BUZ_BOT_SPEED,
                        angle: 0, isDead: false, isActive: true,
                        color: '#2e86c1', kbX: 0, kbY: 0,
                        oSp: BUZ_BOT_SPEED, oR: BUZ_BOT_RADIUS,
                        vurusAnimasyon: 0
                    };
                    buzBotlari.push(yeniBot);
                    sonTemasZamani[yeniBot] = 0;
                    buzBotSpawnUyarilari.splice(i, 1);
                }
            }

            // Heykel Tıraşı spawn
            heykelTirasiSpawnTimer += ts;
            if (heykelTirasiSpawnTimer >= HEYKEL_TIRASI_SPAWN_INTERVAL) {
                heykelTirasiSpawnTimer = 0;
                if (heykelTirasiBotlari.length < 1) {
                    const x = Math.random() * (canvas.width - 200) + 100;
                    const y = Math.random() * (canvas.height - 200) + 100;
                    heykelTirasiSpawnUyarilari.push({ x, y, timer: HEYKEL_TIRASI_SPAWN_WARN });
                }
            }

            for (let i = heykelTirasiSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = heykelTirasiSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    heykelTirasiBotlari.push({
                        x: u.x, y: u.y,
                        radius: HEYKEL_TIRASI_RADIUS,
                        hp: HEYKEL_TIRASI_HP, maxHp: HEYKEL_TIRASI_HP,
                        speed: HEYKEL_TIRASI_SPEED, baseSpeed: HEYKEL_TIRASI_SPEED,
                        angle: 0, lastShot: 0,
                        insaatSure: -1,
                        isDead: false, isActive: true,
                        color: '#8e44ad', kbX: 0, kbY: 0,
                        oSp: HEYKEL_TIRASI_SPEED, oR: HEYKEL_TIRASI_RADIUS
                    });
                    heykelTirasiSpawnUyarilari.splice(i, 1);
                }
            }

            // Heykel Tıraşı güncelleme
            for (let i = heykelTirasiBotlari.length - 1; i >= 0; i--) {
                const h = heykelTirasiBotlari[i];

                if (h.hp <= 0 && !h.isDead) {
                    h.isDead = true;
                    spawnParticles(h.x, h.y, '#8e44ad', 'smoke');
                    triggerBotKill(h.x, h);
                }
                if (h.isDead) { heykelTirasiBotlari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;

                if (h.insaatSure === -1 && heykeller.length === 0 && canSeePlayer) {
                    h.insaatSure = HEYKEL_INSAA_SURESI;
                    h.insaatX = h.x;
                    h.insaatY = h.y;
                }

                if (h.insaatSure > 0) {
                    h.insaatSure -= ts;
                    if (Math.random() < 0.2) {
                        spawnParticles(h.x + (Math.random()-0.5)*15, h.y + (Math.random()-0.5)*15, '#aed6f1', 'smoke');
                    }
                    if (h.insaatSure <= 0) {
                        heykeller.push({
                            x: h.x, y: h.y,
                            radius: HEYKEL_RADIUS,
                            hp: HEYKEL_HP, maxHp: HEYKEL_HP,
                            speed: HEYKEL_SPEED,
                            angle: 0,
                            isDead: false, isActive: true,
                            color: '#85c1e9',
                            kbX: 0, kbY: 0,
                            oSp: HEYKEL_SPEED, oR: HEYKEL_RADIUS,
                            pasifKayipTimer: 0,
                            saldiriAnim: 0,
                            lastShot: 0
                        });
                        h.insaatSure = -1;
                    }
                } else {
                    if (heykeller.length > 0) {
                        const heykel = heykeller[0];
                        const d = getDist(h, heykel);
                        if (d > 50) {
                            const ang = getAngle(h, heykel);
                            h.x += Math.cos(ang) * h.speed * ts;
                            h.y += Math.sin(ang) * h.speed * ts;
                        } else {
                            heykel.hp = Math.min(heykel.maxHp, heykel.hp + HEYKEL_IYILESTIRME * ts / 60);
                        }
                    } else {
                        if (canSeePlayer) {
                            const ang = getAngle(player, h);
                            h.x += Math.cos(ang) * h.speed * ts;
                            h.y += Math.sin(ang) * h.speed * ts;
                        }
                    }

                    if (canSeePlayer && getDist(h, player) < HEYKEL_TIRASI_MENZIL + player.radius) {
                        if (Date.now() - h.lastShot > 1500) {
                            h.lastShot = Date.now();
                            player.hp -= HEYKEL_TIRASI_HASAR;
                            addFloatingNumber(player.x, player.y, HEYKEL_TIRASI_HASAR, "#8e44ad");
                            player.lastHitTime = Date.now();
                        }
                    }
                }

                if (Math.abs(h.kbX) > 0.1 || Math.abs(h.kbY) > 0.1) {
                    h.x += h.kbX * ts;
                    h.y += h.kbY * ts;
                    h.kbX *= 0.85;
                    h.kbY *= 0.85;
                }

                h.x = clampPos(h.x, h.radius + WALL_THICKNESS, canvas.width - h.radius - WALL_THICKNESS);
                h.y = clampPos(h.y, h.radius + WALL_THICKNESS, canvas.height - h.radius - WALL_THICKNESS);
                resolveObstacleCollision(h);
            }

            // Heykel güncelleme
            for (let i = heykeller.length - 1; i >= 0; i--) {
                const hey = heykeller[i];

                if (hey.hp <= 0 && !hey.isDead) {
                    hey.isDead = true;
                    spawnParticles(hey.x, hey.y, '#85c1e9', 'smoke');
                    // Heykel yok olunca 4 Buz Slime çıkar
                    for (let k = 0; k < 4; k++) {
                        const offsetX = (Math.random() - 0.5) * 50;
                        const offsetY = (Math.random() - 0.5) * 50;
                        buzSlimeLari.push({
                            x: hey.x + offsetX, y: hey.y + offsetY,
                            radius: SLIME_RADIUS,
                            hp: SLIME_HP, maxHp: SLIME_HP,
                            speed: SLIME_SPEED, baseSpeed: SLIME_SPEED,
                            angle: Math.random() * Math.PI * 2,
                            isDead: false, isActive: true,
                            color: '#aed6f1', kbX: 0, kbY: 0,
                            oSp: SLIME_SPEED, oR: SLIME_RADIUS
                        });
                    }
                    triggerBotKill(hey.x, hey);
                }
                if (hey.isDead) { heykeller.splice(i, 1); continue; }

                hey.pasifKayipTimer += ts;
                if (hey.pasifKayipTimer >= HEYKEL_PASIF_KAYIP_ARALIK) {
                    hey.pasifKayipTimer = 0;
                    hey.hp -= HEYKEL_PASIF_CAN_KAYBI;
                    addFloatingNumber(hey.x, hey.y, HEYKEL_PASIF_CAN_KAYBI, "#85c1e9");
                }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    hey.angle = Math.atan2(player.y - hey.y, player.x - hey.x);
                    const d = getDist(hey, player);
                    if (d > HEYKEL_SALDIRI_MENZIL + hey.radius) {
                        hey.x += Math.cos(hey.angle) * hey.speed * ts;
                        hey.y += Math.sin(hey.angle) * hey.speed * ts;
                    }

                    // Saldırı: 100ms aralıklarla, 220 hasar, can kaybı yok
                    if (d < HEYKEL_SALDIRI_MENZIL + hey.radius + player.radius) {
                        if (Date.now() - hey.lastShot > HEYKEL_SALDIRI_ARALIK) {
                            hey.lastShot = Date.now();
                            player.hp -= HEYKEL_SALDIRI_HASAR;
                            addFloatingNumber(player.x, player.y, HEYKEL_SALDIRI_HASAR, "#85c1e9");
                            player.lastHitTime = Date.now();
                            const itmeAci = getAngle(hey, player);
                            player.x += Math.cos(itmeAci) * HEYKEL_ITME_MESAFE;
                            player.y += Math.sin(itmeAci) * HEYKEL_ITME_MESAFE;
                            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                            // Saldırı başına can kaybı kaldırıldı
                        }
                    }
                }

                if (Math.abs(hey.kbX) > 0.1 || Math.abs(hey.kbY) > 0.1) {
                    hey.x += hey.kbX * ts;
                    hey.y += hey.kbY * ts;
                    hey.kbX *= 0.85;
                    hey.kbY *= 0.85;
                }

                hey.x = clampPos(hey.x, hey.radius + WALL_THICKNESS, canvas.width - hey.radius - WALL_THICKNESS);
                hey.y = clampPos(hey.y, hey.radius + WALL_THICKNESS, canvas.height - hey.radius - WALL_THICKNESS);
                resolveObstacleCollision(hey);
            }

            // Buz Slime güncelleme
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
                            vx: Math.cos(c.angle) * CIRITCI_MERMI_HIZ,
                            vy: Math.sin(c.angle) * CIRITCI_MERMI_HIZ,
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
                    for (let k = 0; k < 6; k++) {
                        const ang = Math.random() * Math.PI * 2;
                        const dist = Math.random() * 20;
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
            heykelTirasiBotlari = [];
            heykeller = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            ciritciSpawnUyarilari = [];
            heykelTirasiSpawnTimer = 0;
            heykelTirasiSpawnUyarilari = [];
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
        extras = extras.concat(heykelTirasiBotlari.filter(b => !b.isDead));
        extras = extras.concat(heykeller.filter(b => !b.isDead));
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

        ciritciSpawnUyarilari.forEach(u => {
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx.beginPath();
            ctx.arc(0, 0, CIRITCI_RADIUS + 12, 0, Math.PI * 2);
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#5dade2';
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(Math.ceil(u.timer / 60), 0, 5);
            ctx.restore();
        });

        heykelTirasiSpawnUyarilari.forEach(u => {
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx.beginPath();
            ctx.arc(0, 0, HEYKEL_TIRASI_RADIUS + 12, 0, Math.PI * 2);
            ctx.strokeStyle = '#8e44ad';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#8e44ad';
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(Math.ceil(u.timer / 60), 0, 5);
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
                for (let k = 0; k < 4; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const dist = b.radius + animOrani * 15;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(ang) * b.radius * 0.5, Math.sin(ang) * b.radius * 0.5);
                    ctx.lineTo(Math.cos(ang) * dist, Math.sin(ang) * dist);
                    ctx.stroke();
                }
            }

            const animScale = b.vurusAnimasyon > 0 ? 1.1 : 1;
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
            const gradyan = ctx.createLinearGradient(12, 0, 34, 0);
            gradyan.addColorStop(0, '#aed6f1');
            gradyan.addColorStop(1, '#eaf2f8');
            ctx.fillStyle = gradyan;
            ctx.fillRect(12, -2.5, 22, 5);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(36, 0);
            ctx.lineTo(28, -7);
            ctx.lineTo(28, 7);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 1.5;
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

        // Heykel Tıraşı (görsel iyileştirildi)
        heykelTirasiBotlari.forEach(h => {
            if (h.isDead) return;
            ctx.save();
            ctx.translate(h.x, h.y);

            const yurumeOffset = Math.sin(Date.now() / 150) * 2;
            ctx.translate(0, yurumeOffset);

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(0, h.radius * 0.6, h.radius * 0.8, h.radius * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-18, -h.radius - 15, 36, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-18, -h.radius - 15, 36 * (h.hp / h.maxHp), 5);

            ctx.rotate(h.angle);
            ctx.fillStyle = '#8e44ad';
            ctx.beginPath();
            ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#aed6f1';
            ctx.fillRect(10, -2, 8, 3);
            ctx.fillStyle = '#85c1e9';
            ctx.fillRect(18, -4, 4, 8);

            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 3;
            ctx.beginPath();
            ctx.arc(8, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(8, 5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            if (h.insaatSure > 0) {
                ctx.save();
                ctx.translate(h.x, h.y);
                ctx.globalAlpha = 0.7;
                const ilerleme = 1 - (h.insaatSure / HEYKEL_INSAA_SURESI);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(-20, -h.radius - 30, 40, 6);
                ctx.fillStyle = '#85c1e9';
                ctx.fillRect(-20, -h.radius - 30, 40 * ilerleme, 6);
                ctx.restore();
            }
        });

        // Heykel (görsel iyileştirildi)
        heykeller.forEach(hey => {
            if (hey.isDead) return;
            ctx.save();
            ctx.translate(hey.x, hey.y);

            const yurumeOffset = Math.sin(Date.now() / 200) * 3;
            ctx.translate(0, yurumeOffset);

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(0, hey.radius * 0.7, hey.radius * 0.9, hey.radius * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-30, -hey.radius - 15, 60, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-30, -hey.radius - 15, 60 * (hey.hp / hey.maxHp), 5);

            ctx.rotate(hey.angle);
            ctx.fillStyle = '#85c1e9';
            ctx.beginPath();
            ctx.moveTo(hey.radius, 0);
            ctx.lineTo(hey.radius * 0.4, -hey.radius);
            ctx.lineTo(-hey.radius * 0.8, -hey.radius * 0.7);
            ctx.lineTo(-hey.radius * 0.8, hey.radius * 0.7);
            ctx.lineTo(hey.radius * 0.4, hey.radius);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.arc(0, 0, hey.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            const hasarOrani = 1 - (hey.hp / hey.maxHp);
            if (hasarOrani > 0.3) {
                ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.8, hasarOrani)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(5, 0);
                ctx.lineTo(15, 10);
                ctx.lineTo(10, 20);
                ctx.stroke();
            }
            if (hasarOrani > 0.6) {
                ctx.beginPath();
                ctx.moveTo(-8, 5);
                ctx.lineTo(-15, 15);
                ctx.stroke();
            }

            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.arc(10, -6, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(10, 6, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#1a5276';
            ctx.beginPath();
            ctx.arc(11, -6, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(11, 6, 2, 0, Math.PI * 2);
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
            '<small>Buz Botu + Ciritçi + Heykel Tıraşı</small>';
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