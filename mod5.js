// ========== mod6.js (MUTASYON MODU - AŞAMA 1: HIZLI BOT + HEMŞİRE BOT) ==========
// Mutasyon modu: Klasik botlar değişir.
// Hızlı Bot: her 8.17 sn'de spawn, yakınındaki bot başına %5 hız, max %100.
// Hemşire Bot: 10 bot ölünce aktif, botlara +400 iyileştirme, oyuncuya 400 hasar + zehir.

(function () {
    'use strict';

    const MOD_ID = 'mutasyon';
    const HIZLI_BOT_HP = 2500;
    const HIZLI_BOT_SPEED = 1.36;
    const HIZLI_SPAWN_INTERVAL = 490; // 8.17 sn (60fps)
    const HIZLI_YAKIN_MESAFE = 200;
    const HIZLI_HIZ_ARTIS = 0.05; // %5
    const HIZLI_MAX_HIZ = 2.0; // %100

    const HEMSIRE_HP = 4500;
    const HEMSIRE_MENZIL = 95;
    const HEMSIRE_ATIS_INTERVAL = 60; // 1 sn
    const HEMSIRE_IYILESTIRME = 400;
    const HEMSIRE_HASAR = 400;
    const HEMSIRE_ZEHIR_SURESI = 180; // 3 sn
    const HEMSIRE_ZEHIR_HASAR = 20; // saniyede

    let hizliBotlar = [];
    let hemsireBot = null;
    let hizliSpawnTimer = 0;
    let toplamOldurulen = 0;
    let hemsireAktif = false;

    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Mutasyon',
        onStart: function () {
            hizliBotlar = [];
            hemsireBot = null;
            hizliSpawnTimer = 0;
            toplamOldurulen = 0;
            hemsireAktif = false;
        },
        onUpdate: function (ts) {
            // Hızlı bot spawn
            hizliSpawnTimer += ts;
            if (hizliSpawnTimer >= HIZLI_SPAWN_INTERVAL) {
                hizliSpawnTimer = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                hizliBotlar.push({
                    x, y,
                    radius: 20,
                    hp: HIZLI_BOT_HP,
                    maxHp: HIZLI_BOT_HP,
                    speed: HIZLI_BOT_SPEED,
                    baseSpeed: HIZLI_BOT_SPEED,
                    angle: 0,
                    lastShot: 0,
                    shootInterval: 1500,
                    isDead: false,
                    kbX: 0, kbY: 0,
                    color: '#9b59b6',
                    alerted: false,
                    bombaBulasti: false,
                    bombaSayaci: 0,
                    ghostRingDebounce: 0,
                    isActive: true,
                    isNest: false,
                    isFog: false,
                    stage: 0,
                    oSp: HIZLI_BOT_SPEED,
                    oR: 20,
                    ilkAtis: true
                });
            }

            // Hızlı bot güncelleme
            for (let i = hizliBotlar.length - 1; i >= 0; i--) {
                const b = hizliBotlar[i];
                if (b.isDead) { hizliBotlar.splice(i, 1); continue; }

                // Yakın bot sayısı
                let yakinBotSayisi = 0;
                getActiveEnemies().forEach(e => {
                    if (e !== b && !e.isDead && getDist(b, e) < HIZLI_YAKIN_MESAFE) {
                        yakinBotSayisi++;
                    }
                });
                // Hız artışı
                b.speed = Math.min(HIZLI_MAX_HIZ, b.baseSpeed * (1 + yakinBotSayisi * HIZLI_HIZ_ARTIS));

                // Hareket
                if (!player.isDead) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                }
                const d = getDist(b, player);
                if (d > 180) {
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                }

                // Ateş (ilk mermi daha hızlı)
                if (d < RANGE && Date.now() - b.lastShot > b.shootInterval && !player.isDead) {
                    const bulletSpeed = b.ilkAtis ? BOT_BULLET_SPEED * 1.3 : BOT_BULLET_SPEED;
                    b.ilkAtis = false;
                    botBullets.push({
                        x: b.x, y: b.y,
                        sx: b.x, sy: b.y,
                        vx: Math.cos(b.angle) * bulletSpeed,
                        vy: Math.sin(b.angle) * bulletSpeed,
                        dmgMod: 1,
                        owner: b,
                        type: 'hizli_bot_mermi'
                    });
                    b.lastShot = Date.now();
                }

                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }

            // Hemşire bot güncelleme
            if (hemsireAktif && hemsireBot && !hemsireBot.isDead) {
                const h = hemsireBot;
                if (!player.isDead) {
                    h.angle = Math.atan2(player.y - h.y, player.x - h.x);
                }
                const d = getDist(h, player);
                if (d > 100) {
                    h.x += Math.cos(h.angle) * h.speed * ts;
                    h.y += Math.sin(h.angle) * h.speed * ts;
                }

                if (Date.now() - h.lastShot > HEMSIRE_ATIS_INTERVAL) {
                    h.lastShot = Date.now();
                    // En yakın botu bul (iyileştirme hedefi)
                    let hedefBot = null;
                    let minBotDist = Infinity;
                    getActiveEnemies().forEach(e => {
                        if (e !== h && !e.isDead && getDist(h, e) < HEMSIRE_MENZIL) {
                            const dist = getDist(h, e);
                            if (dist < minBotDist) {
                                minBotDist = dist;
                                hedefBot = e;
                            }
                        }
                    });

                    if (hedefBot) {
                        // Botlara iyileştirme mermisi
                        botBullets.push({
                            x: h.x, y: h.y,
                            sx: h.x, sy: h.y,
                            vx: Math.cos(getAngle(h, hedefBot)) * BOT_BULLET_SPEED,
                            vy: Math.sin(getAngle(h, hedefBot)) * BOT_BULLET_SPEED,
                            dmgMod: 0,
                            owner: h,
                            type: 'hemsire_iyilestirme',
                            hedefBot: hedefBot
                        });
                    } else if (!player.isDead && d < HEMSIRE_MENZIL) {
                        // Oyuncuya hasar mermisi
                        botBullets.push({
                            x: h.x, y: h.y,
                            sx: h.x, sy: h.y,
                            vx: Math.cos(h.angle) * BOT_BULLET_SPEED,
                            vy: Math.sin(h.angle) * BOT_BULLET_SPEED,
                            dmgMod: 0,
                            owner: h,
                            type: 'hemsire_hasar'
                        });
                    }
                }

                h.x = clampPos(h.x, h.radius + WALL_THICKNESS, canvas.width - h.radius - WALL_THICKNESS);
                h.y = clampPos(h.y, h.radius + WALL_THICKNESS, canvas.height - h.radius - WALL_THICKNESS);
                resolveObstacleCollision(h);
            }
        },
        onReset: function () {
            hizliBotlar = [];
            hemsireBot = null;
            hizliSpawnTimer = 0;
            toplamOldurulen = 0;
            hemsireAktif = false;
        }
    };

    // Botları aktif düşman listesine ekle
    const originalGetExtraEnemies = window.GAME_EXT.hooks.getExtraEnemies;
    window.GAME_EXT.hooks.getExtraEnemies = function () {
        let extras = [];
        if (typeof originalGetExtraEnemies === 'function') {
            extras = originalGetExtraEnemies() || [];
        }
        extras = extras.concat(hizliBotlar.filter(b => !b.isDead));
        if (hemsireAktif && hemsireBot && !hemsireBot.isDead) {
            extras.push(hemsireBot);
        }
        return extras;
    };

    // Bot ölümlerini say
    const originalOnEnemyKilled = window.GAME_EXT.hooks.onEnemyKilled;
    window.GAME_EXT.hooks.onEnemyKilled = function (enemy) {
        if (typeof originalOnEnemyKilled === 'function') {
            originalOnEnemyKilled(enemy);
        }
        if (window.GAME_MODE === MOD_ID) {
            toplamOldurulen++;
            if (toplamOldurulen >= 10 && !hemsireAktif) {
                hemsireAktif = true;
                const x = Math.random() > 0.5 ? canvas.width - 120 : 120;
                const y = Math.random() * (canvas.height - 240) + 120;
                hemsireBot = {
                    x, y,
                    radius: 20,
                    hp: HEMSIRE_HP,
                    maxHp: HEMSIRE_HP,
                    speed: 1.36,
                    angle: 0,
                    lastShot: 0,
                    isDead: false,
                    kbX: 0, kbY: 0,
                    color: '#ff69b4',
                    alerted: false,
                    bombaBulasti: false,
                    bombaSayaci: 0,
                    ghostRingDebounce: 0,
                    isActive: true,
                    isNest: false,
                    isFog: false,
                    stage: 0,
                    oSp: 1.36,
                    oR: 20
                };
                addFloatingNumber(hemsireBot.x, hemsireBot.y - 30, "HEMŞİRE BOT GELDİ!", "#ff69b4");
            }
        }
    };

    // Hemşire mermileri çarpışma kontrolü
    const originalUpdateBulletLogic = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (isBot) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (b.type === 'hemsire_iyilestirme') {
                    b.x += b.vx * ts;
                    b.y += b.vy * ts;
                    const hedef = b.hedefBot;
                    if (hedef && !hedef.isDead && getDist(b, hedef) < hedef.radius + 12) {
                        hedef.hp = Math.min(hedef.maxHp, hedef.hp + HEMSIRE_IYILESTIRME);
                        addFloatingNumber(hedef.x, hedef.y, "+" + HEMSIRE_IYILESTIRME, "#2ecc71");
                        list.splice(i, 1);
                        continue;
                    }
                    if (getDist(b, {x: b.sx, y: b.sy}) > HEMSIRE_MENZIL * 2) {
                        list.splice(i, 1);
                    }
                } else if (b.type === 'hemsire_hasar') {
                    b.x += b.vx * ts;
                    b.y += b.vy * ts;
                    if (!player.isDead && getDist(b, player) < player.radius + 12) {
                        player.hp -= HEMSIRE_HASAR;
                        addFloatingNumber(player.x, player.y, HEMSIRE_HASAR, "#e74c3c");
                        player.lastHitTime = Date.now();
                        // Zehir etkisi
                        player.hemsireZehirSure = HEMSIRE_ZEHIR_SURESI;
                        list.splice(i, 1);
                        continue;
                    }
                    if (getDist(b, {x: b.sx, y: b.sy}) > HEMSIRE_MENZIL * 2) {
                        list.splice(i, 1);
                    }
                }
            }
        }
        originalUpdateBulletLogic(list, isBot, ts);
    };

    // Zehir etkisi güncelleme
    const originalUpdate = window.update;
    window.update = function (ts) {
        originalUpdate(ts);
        if (!gameStarted || window.GAME_MODE !== MOD_ID) return;

        if (player.hemsireZehirSure > 0) {
            player.hemsireZehirSure -= ts;
            if (Math.floor(player.hemsireZehirSure) % 60 === 0) {
                player.hp -= HEMSIRE_ZEHIR_HASAR;
                addFloatingNumber(player.x, player.y, HEMSIRE_ZEHIR_HASAR, "#00ff00");
            }
            if (player.hemsireZehirSure <= 0) {
                player.hemsireZehirSure = 0;
            }
        }
    };

    // Görsel çizim
    const originalDraw = window.draw;
    window.draw = function () {
        originalDraw();
        if (!gameStarted || window.GAME_MODE !== MOD_ID) return;

        // Hızlı botlar
        hizliBotlar.forEach(b => {
            if (b.isDead) return;
            ctx.save();
            ctx.translate(b.x, b.y);
            // Can barı
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-20, -b.radius - 15, 40, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
            // Gövde
            ctx.rotate(b.angle);
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Hız çizgileri (yanlarda)
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-10, -10);
            ctx.lineTo(-20, -15);
            ctx.moveTo(-10, 10);
            ctx.lineTo(-20, 15);
            ctx.stroke();
            ctx.restore();
        });

        // Hemşire bot
        if (hemsireAktif && hemsireBot && !hemsireBot.isDead) {
            const h = hemsireBot;
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-20, -h.radius - 15, 40, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-20, -h.radius - 15, 40 * (h.hp / h.maxHp), 5);
            ctx.rotate(h.angle);
            ctx.fillStyle = h.color;
            ctx.beginPath();
            ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Artı işareti
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(0, 10);
            ctx.moveTo(-10, 0);
            ctx.lineTo(10, 0);
            ctx.stroke();
            ctx.restore();
        }
    };

    // Mod seçim kartını ekle
    window.addEventListener('DOMContentLoaded', function () {
        const track = document.getElementById('difficulty-track');
        if (track && !document.getElementById('diff-mutasyon')) {
            const card = document.createElement('div');
            card.className = 'diff-card';
            card.id = 'diff-mutasyon';
            card.innerHTML =
                '<span>Mutasyon</span>' +
                '<small>Botlar evrim geçirdi!<br>Hızlı Bot + Hemşire Bot</small>';
            track.appendChild(card);
            card.addEventListener('click', () => {
                document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                // Mod seçimini işaretle
                window.GAME_MODE = MOD_ID;
                // Zorluk değişkenini de ayarla (kolay/klasik fark etmez, mod öncelikli)
                window.GAME_DIFFICULTY = 'normal';
            });
            // Kaydırma ile seçim için tıklama yeterli
        }
    });

})();