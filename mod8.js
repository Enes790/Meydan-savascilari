// ========== mod7.js (BUZUL ÇAĞI) - TAM GÜNCELLEME ==========
// - Buz Bumerangı kaldırıldı.
// - Buz Cevheri eklendi: 1600 can, 5 saniyede bir doğar, siperlerden %70 çıkar.
// - Kamp Ateşi siperi eklendi: 3000 can, 8 sn dayanır, kömür +4 sn, %10 mermi yavaşlatma.
// - Kömür sistemi: Buz Cevheri ölünce bırakır, otomatik toplanır, kamp ateşi yoksa işlevsiz.
// - Botlar kamp ateşine kilitlenebilir (oyuncudan yakınsa).
// - Spawn limitleri: Buz Botu max 3, Ciritçi max 2, Buz Cevheri max 3.

(function () {
    'use strict';

    const MOD_ID = 'buzul';

    // Buz Slime
    const SLIME_HP = 600;
    const SLIME_SPEED = 2.5;
    const SLIME_RADIUS = 12;
    const SLIME_DAMAGE = 150;

    // Buz Botu
    const BUZ_BOT_HP = 5000;
    const BUZ_BOT_SPEED = 0.8;
    const BUZ_BOT_RADIUS = 22;
    const BUZ_BOT_TEMAS_HASAR = 600;
    const BUZ_BOT_ITME_MESAFE = 25;
    const BUZ_BOT_PATLAMA_YARICAP = 68;
    const BUZ_BOT_PATLAMA_HASAR = 200;
    const BUZ_BOT_SPAWN_INTERVAL = 900;   // 15 saniye
    const BUZ_BOT_SPAWN_WARN = 180;
    const BUZ_BOT_SALDIRI_ARALIK = 2000;
    const BUZ_BOT_VURUS_ANIM = 12;

    // Buz Ciritçisi
    const CIRITCI_HP = 2500;
    const CIRITCI_SPEED = 0.8;
    const CIRITCI_RADIUS = 18;
    const CIRITCI_SHOOT_RANGE = 300;
    const CIRITCI_SHOOT_INTERVAL = 1500;
    const CIRITCI_DAMAGE = 400;
    const CIRITCI_RESPAWN_TIME = 370;
    const CIRITCI_SPAWN_WARN = 90;

    // Buz Cevheri
    const CEVHER_HP = 1600;
    const CEVHER_SPEED = 1.6;
    const CEVHER_RADIUS = 18;
    const CEVHER_SPAWN_INTERVAL = 300;    // 5 saniye
    const CEVHER_SPAWN_WARN = 90;         // 1.5 saniye uyarı
    const CEVHER_MERMI_HASAR = 40;
    const CEVHER_BUZ_ALEV_HASAR = 15;     // saniyede
    const CEVHER_BUZ_ALEV_SURE = 180;     // 3 saniye
    const CEVHER_KONI_ACI = (130 * Math.PI) / 180; // 130 derece
    const CEVHER_MERMI_SAYISI = 8;
    const CEVHER_MERMI_ARALIK = 6;        // 0.1 saniye (60fps)
    const CEVHER_SALDIRI_INTERVAL = 2000; // 2 saniyede bir
    const CEVHER_KOMUR_SURE = 480;        // 8 saniye

    // Kamp Ateşi
    const KAMP_HP = 3000;
    const KAMP_DOGAL_OMUR = 480;          // 8 saniye (frame)
    const KAMP_CAN_KAYBI = 375 / 60;      // saniyede 375
    const KAMP_AURA_YARICAP = 130;
    const KAMP_IYILESTIRME = 200;         // saniyede oyuncuya
    const KAMP_DUSMAN_YAVASLATMA = 0.5;   // %50 yavaşlatma
    const KAMP_MERMI_YAVASLATMA = 0.1;    // %10 mermi yavaşlatma
    const KAMP_DALGA_HASAR = 600;
    const KAMP_DALGA_YAVASLATMA = 2;      // 2 saniye
    const KAMP_KILL_GERI_GELME = 20;
    const KAMP_KOMUR_SURE_EKLE = 240;     // +4 saniye

    let buzSlimeLari = [];
    let buzBotlari = [];
    let ciritciBotlari = [];
    let buzCevherleri = [];
    let komurlar = [];
    let kampAtesi = null;
    let buzBotSpawnTimer = 0;
    let buzBotSpawnUyarilari = [];
    let ciritciRespawnTimer = -1;
    let ciritciSpawnUyarilari = [];
    let cevherSpawnTimer = 0;
    let cevherSpawnUyarilari = [];
    let sonTemasZamani = {};
    let kampYokOlduktanSonraKills = 0;

    const originalSpawnObstacle = window.spawnObstacle;

    // ========== MOD TANIMI ==========
    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Buzul Çağı',
        onStart: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            buzCevherleri = [];
            komurlar = [];
            kampAtesi = null;
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            ciritciSpawnUyarilari = [];
            cevherSpawnTimer = 0;
            cevherSpawnUyarilari = [];
            sonTemasZamani = {};
            kampYokOlduktanSonraKills = 0;

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];

            // Oyun başında bir Buz Ciritçisi
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

            // Siperlerden buz slime ve buz cevheri çıkarma
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                if (o.hp <= 0) {
                    // Buz Slime
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
                    // Buz Cevheri %70 ihtimal
                    if (Math.random() < 0.7 && buzCevherleri.length < 3) {
                        buzCevherleri.push(cevherOlustur(o.x, o.y));
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

            // Buz Botu spawn (limit kontrollü)
            buzBotSpawnTimer += ts;
            if (buzBotSpawnTimer >= BUZ_BOT_SPAWN_INTERVAL) {
                buzBotSpawnTimer = 0;
                if (buzBotlari.length < 3) {
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

            // Buz Cevheri spawn (5 saniyede bir, limit 3)
            cevherSpawnTimer += ts;
            if (cevherSpawnTimer >= CEVHER_SPAWN_INTERVAL) {
                cevherSpawnTimer = 0;
                if (buzCevherleri.length < 3) {
                    const x = Math.random() * (canvas.width - 200) + 100;
                    const y = Math.random() * (canvas.height - 200) + 100;
                    cevherSpawnUyarilari.push({ x, y, timer: CEVHER_SPAWN_WARN });
                }
            }

            for (let i = cevherSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = cevherSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    buzCevherleri.push(cevherOlustur(u.x, u.y));
                    cevherSpawnUyarilari.splice(i, 1);
                }
            }

            // Kamp Ateşi: 20 kill sonra geri gelir
            if (!kampAtesi) {
                if (kampYokOlduktanSonraKills >= KAMP_KILL_GERI_GELME) {
                    kampAtesi = {
                        x: canvas.width / 2,
                        y: canvas.height / 2,
                        radius: 35,
                        hp: KAMP_HP,
                        maxHp: KAMP_HP,
                        kalanSure: KAMP_DOGAL_OMUR,
                        aktif: true
                    };
                    kampYokOlduktanSonraKills = 0;
                    addFloatingNumber(kampAtesi.x, kampAtesi.y - 40, "KAMP ATEŞİ ÇIKTI!", "#f1c40f");
                }
            } else if (kampAtesi.aktif) {
                // Kamp ateşi can kaybı
                kampAtesi.hp -= KAMP_CAN_KAYBI * ts;
                kampAtesi.kalanSure -= ts;

                // Aura etkileri
                if (!player.isDead && getDist(player, kampAtesi) < KAMP_AURA_YARICAP + player.radius) {
                    player.hp = Math.min(player.maxHp, player.hp + KAMP_IYILESTIRME * ts / 60);
                    if (Math.random() < 0.02) addFloatingNumber(player.x, player.y - 20, "+" + KAMP_IYILESTIRME, "#2ecc71");
                }

                getActiveEnemies().forEach(e => {
                    if (getDist(e, kampAtesi) < KAMP_AURA_YARICAP + e.radius) {
                        e.speed = (e.oSp || e.speed) * KAMP_DUSMAN_YAVASLATMA;
                    } else {
                        e.speed = e.oSp || e.speed;
                    }
                });

                // Mermi yavaşlatma
                botBullets.forEach(b => {
                    if (getDist(b, kampAtesi) < KAMP_AURA_YARICAP) {
                        b.vx *= (1 - KAMP_MERMI_YAVASLATMA);
                        b.vy *= (1 - KAMP_MERMI_YAVASLATMA);
                    }
                });

                if (kampAtesi.hp <= 0 || kampAtesi.kalanSure <= 0) {
                    // Ateş dalgası
                    getActiveEnemies().forEach(e => {
                        if (getDist(kampAtesi, e) < 200 + e.radius) {
                            e.hp -= KAMP_DALGA_HASAR;
                            addFloatingNumber(e.x, e.y, KAMP_DALGA_HASAR, "#f1c40f");
                            e.speed = (e.oSp || e.speed) * 0.5;
                        }
                    });
                    explosions.push({x: kampAtesi.x, y: kampAtesi.y, radius: 10, maxRadius: 200, life: 20, maxLife: 20});
                    screenShake = 8;
                    kampAtesi = null;
                    kampYokOlduktanSonraKills = 0;
                    addFloatingNumber(canvas.width/2, canvas.height/2, "ATEŞ DALGASI!", "#f1c40f");
                }
            }

            // Kömür güncelleme
            for (let i = komurlar.length - 1; i >= 0; i--) {
                const k = komurlar[i];
                k.timer -= ts;

                // Oyuncuya dokunursa otomatik toplanır
                if (!player.isDead && getDist(player, k) < player.radius + 12) {
                    if (kampAtesi && kampAtesi.aktif) {
                        kampAtesi.kalanSure += KAMP_KOMUR_SURE_EKLE;
                        kampAtesi.hp = Math.min(kampAtesi.maxHp, kampAtesi.hp + 500);
                        addFloatingNumber(k.x, k.y, "+4 SN", "#f1c40f");
                    } else {
                        addFloatingNumber(k.x, k.y, "KAMP YOK", "#e74c3c");
                    }
                    komurlar.splice(i, 1);
                    continue;
                }

                // Süresi biterse Buz Cevheri doğar
                if (k.timer <= 0) {
                    if (buzCevherleri.length < 3) {
                        buzCevherleri.push(cevherOlustur(k.x, k.y));
                    }
                    komurlar.splice(i, 1);
                }
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

                // Kamp ateşi hedef kontrolü
                let hedefX, hedefY;
                if (kampAtesi && kampAtesi.aktif && getDist(c, kampAtesi) < getDist(c, player)) {
                    hedefX = kampAtesi.x;
                    hedefY = kampAtesi.y;
                } else {
                    hedefX = player.x;
                    hedefY = player.y;
                }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    c.angle = Math.atan2(hedefY - c.y, hedefX - c.x);
                    const d = getDist(c, {x: hedefX, y: hedefY});
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

                // Kamp ateşi hedef
                let hedefX, hedefY;
                if (kampAtesi && kampAtesi.aktif && getDist(b, kampAtesi) < getDist(b, player)) {
                    hedefX = kampAtesi.x;
                    hedefY = kampAtesi.y;
                } else {
                    hedefX = player.x;
                    hedefY = player.y;
                }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(hedefY - b.y, hedefX - b.x);
                    const d = getDist(b, {x: hedefX, y: hedefY});
                    if (d > b.radius + (hedefX === player.x ? player.radius : 35) + 5) {
                        b.x += Math.cos(b.angle) * b.speed * ts;
                        b.y += Math.sin(b.angle) * b.speed * ts;
                    } else {
                        const simdi = Date.now();
                        if (simdi - sonTemasZamani[b] >= BUZ_BOT_SALDIRI_ARALIK) {
                            sonTemasZamani[b] = simdi;
                            if (hedefX === player.x) {
                                player.hp -= BUZ_BOT_TEMAS_HASAR;
                                addFloatingNumber(player.x, player.y, BUZ_BOT_TEMAS_HASAR, "#e74c3c");
                                player.lastHitTime = Date.now();
                                const itmeAci = getAngle(b, player);
                                player.x += Math.cos(itmeAci) * BUZ_BOT_ITME_MESAFE;
                                player.y += Math.sin(itmeAci) * BUZ_BOT_ITME_MESAFE;
                                player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                                player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                            } else if (kampAtesi) {
                                kampAtesi.hp -= BUZ_BOT_TEMAS_HASAR;
                                addFloatingNumber(kampAtesi.x, kampAtesi.y, BUZ_BOT_TEMAS_HASAR, "#e74c3c");
                            }
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

            // Buz Cevheri güncelleme
            for (let i = buzCevherleri.length - 1; i >= 0; i--) {
                const c = buzCevherleri[i];

                if (c.hp <= 0 && !c.isDead) {
                    c.isDead = true;
                    spawnParticles(c.x, c.y, '#ff6b35', 'normal');
                    // Kömür bırak
                    komurlar.push({x: c.x, y: c.y, timer: CEVHER_KOMUR_SURE});
                    addFloatingNumber(c.x, c.y - 20, "KÖMÜR!", "#8b4513");
                    triggerBotKill(c.x, c);
                }
                if (c.isDead) { buzCevherleri.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    const d = getDist(c, player);
                    c.angle = Math.atan2(player.y - c.y, player.x - c.x);

                    if (d > 100) {
                        c.x += Math.cos(c.angle) * c.speed * ts;
                        c.y += Math.sin(c.angle) * c.speed * ts;
                    }

                    // Koni saldırı
                    if (d < 120 && Date.now() - c.lastShot > CEVHER_SALDIRI_INTERVAL) {
                        c.lastShot = Date.now();
                        c.mermiSayaç = 0;
                        c.saldiriAktif = true;
                    }

                    if (c.saldiriAktif) {
                        c.mermiSayaç += ts;
                        if (c.mermiSayaç >= CEVHER_MERMI_ARALIK) {
                            c.mermiSayaç = 0;
                            c.atilanMermi = (c.atilanMermi || 0) + 1;

                            const merkezAci = c.angle;
                            const baslangic = merkezAci - CEVHER_KONI_ACI / 2;
                            const bitis = merkezAci + CEVHER_KONI_ACI / 2;
                            const rastgeleAci = baslangic + Math.random() * (bitis - baslangic);

                            botBullets.push({
                                x: c.x, y: c.y,
                                sx: c.x, sy: c.y,
                                vx: Math.cos(rastgeleAci) * BOT_BULLET_SPEED * 0.9,
                                vy: Math.sin(rastgeleAci) * BOT_BULLET_SPEED * 0.9,
                                dmgMod: 0,
                                type: 'buz_cevheri_alev',
                                owner: c
                            });

                            if (c.atilanMermi >= CEVHER_MERMI_SAYISI) {
                                c.saldiriAktif = false;
                                c.atilanMermi = 0;
                            }
                        }
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
        },
        onReset: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            buzCevherleri = [];
            komurlar = [];
            kampAtesi = null;
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciRespawnTimer = -1;
            ciritciSpawnUyarilari = [];
            cevherSpawnTimer = 0;
            cevherSpawnUyarilari = [];
            sonTemasZamani = {};
            kampYokOlduktanSonraKills = 0;

            if (originalSpawnObstacle) {
                window.spawnObstacle = originalSpawnObstacle;
            }
        }
    };

    // Buz Cevheri oluşturma yardımcı fonksiyonu
    function cevherOlustur(x, y) {
        return {
            x, y,
            radius: CEVHER_RADIUS,
            hp: CEVHER_HP, maxHp: CEVHER_HP,
            speed: CEVHER_SPEED, baseSpeed: CEVHER_SPEED,
            angle: 0,
            lastShot: 0,
            saldiriAktif: false,
            mermiSayaç: 0,
            atilanMermi: 0,
            isDead: false, isActive: true,
            color: '#8e44ad',
            kbX: 0, kbY: 0,
            oSp: CEVHER_SPEED, oR: CEVHER_RADIUS
        };
    }

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
        extras = extras.concat(buzCevherleri.filter(b => !b.isDead));
        return extras;
    };

    // ========== ÖLÜM SAYACI ==========
    const originalOnEnemyKilled = window.GAME_EXT.hooks.onEnemyKilled;
    window.GAME_EXT.hooks.onEnemyKilled = function (enemy) {
        if (typeof originalOnEnemyKilled === 'function') {
            originalOnEnemyKilled(enemy);
        }
        if (window.GAME_MODE === MOD_ID) {
            kampYokOlduktanSonraKills++;
        }
    };

    // ========== BUZ CEVHERİ MERMİ ÇARPIŞMA ==========
    const originalUpdateBulletLogic = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (isBot) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (b.type === 'buz_cevheri_alev') {
                    b.x += b.vx * ts;
                    b.y += b.vy * ts;

                    const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                    const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                    const mesafe = getDist(b, {x: b.sx, y: b.sy});

                    if (hwX || hwY || mesafe > 150) {
                        list.splice(i, 1);
                        continue;
                    }

                    if (!player.isDead && getDist(b, player) < player.radius + 12) {
                        player.hp -= CEVHER_MERMI_HASAR;
                        addFloatingNumber(player.x, player.y, CEVHER_MERMI_HASAR, "#ff6b35");
                        player.lastHitTime = Date.now();
                        // Buz alevi etkisi birikebilir
                        player.buzAleviSure = (player.buzAleviSure || 0) + CEVHER_BUZ_ALEV_SURE;
                        addFloatingNumber(player.x, player.y - 20, "BUZ ALEVİ!", "#8e44ad");
                        list.splice(i, 1);
                        continue;
                    }
                }
            }
        }
        originalUpdateBulletLogic(list, isBot, ts);
    };

    // ========== BUZ ALEVİ ETKİSİ ==========
    const originalUpdate = window.update;
    window.update = function (ts) {
        originalUpdate(ts);
        if (!gameStarted || window.GAME_MODE !== MOD_ID) return;

        if (player.buzAleviSure > 0) {
            player.buzAleviSure -= ts;
            if (Math.floor(player.buzAleviSure) % 60 === 0) {
                player.hp -= CEVHER_BUZ_ALEV_HASAR;
                addFloatingNumber(player.x, player.y, CEVHER_BUZ_ALEV_HASAR, "#8e44ad");
            }
            // Yenilenmeyi engelle
            player.lastHitTime = Date.now();
            if (player.buzAleviSure <= 0) player.buzAleviSure = 0;
        }
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

        // Kamp Ateşi çizimi
        if (kampAtesi && kampAtesi.aktif) {
            ctx.save();
            ctx.translate(kampAtesi.x, kampAtesi.y);

            // Aura
            ctx.beginPath();
            ctx.arc(0, 0, KAMP_AURA_YARICAP, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(241, 196, 15, 0.1)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Ateş
            for (let k = 0; k < 5; k++) {
                const alevAci = (k / 5) * Math.PI * 2 + Date.now() / 300;
                const alevBoy = 20 + Math.sin(Date.now() / 100 + k) * 5;
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(Math.cos(alevAci) * 15, Math.sin(alevAci) * 15, 8, 0, Math.PI * 2);
                ctx.fill();
            }
            // Merkez ateş
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            ctx.arc(0, 0, 12 + Math.sin(Date.now() / 150) * 3, 0, Math.PI * 2);
            ctx.fill();

            // Can barı
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-30, -kampAtesi.radius - 15, 60, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-30, -kampAtesi.radius - 15, 60 * (kampAtesi.hp / kampAtesi.maxHp), 5);

            ctx.restore();
        }

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

        cevherSpawnUyarilari.forEach(u => {
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx.beginPath();
            ctx.arc(0, 0, CEVHER_RADIUS + 12, 0, Math.PI * 2);
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

        // Kömürler
        komurlar.forEach(k => {
            ctx.save();
            ctx.translate(k.x, k.y);
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3e2710';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#f1c40f';
            ctx.font = "bold 8px Arial";
            ctx.textAlign = "center";
            ctx.fillText(Math.ceil(k.timer / 60), 0, 3);
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

        // Buz Cevherleri
        buzCevherleri.forEach(c => {
            if (c.isDead) return;
            ctx.save();
            ctx.translate(c.x, c.y);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-20, -c.radius - 15, 40, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-20, -c.radius - 15, 40 * (c.hp / c.maxHp), 5);

            // Gövde (normal bot formu)
            ctx.rotate(c.angle);
            ctx.fillStyle = '#8e44ad';
            ctx.beginPath();
            ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Üzerinde cevher (parlak kristal)
            ctx.fillStyle = '#ff6b35';
            ctx.shadowColor = '#ff6b35';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(5, -7);
            ctx.lineTo(0, 0);
            ctx.lineTo(-5, -7);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;

            // Gözler
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(8, -5, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(8, 5, 3.5, 0, Math.PI * 2);
            ctx.fill();
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
            '<small>Buz Botu + Ciritçi + Cevher<br>Kamp Ateşi + Kömür</small>';
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