// ========== mod10.js (TURUNCU BASKIN) ==========
// - Klasik botlar kapalı.
// - Tek turuncu bot (klasik stationary tipi), sabit durur, sınırsız menzilli ateş eder.
// - Bot ölünce 6 saniye sonra ciritçi gibi spawn olur (uyarı çemberi + geri sayım).
// - Siperler mor siperlerin birebir aynı şekli, gri renkte, canı 2.5 kat (2000).
// - "YENİ BOT" gibi ekstra yazı yok.

(function () {
    'use strict';

    const MOD_ID = 'turuncu';

    // Bot sabitleri (klasik stationary bot gibi)
    const BOT_HP = 2500;
    const BOT_RADIUS = 25;
    const BOT_SHOOT_INTERVAL = 750;
    const BOT_RESPAWN_SURESI = 360; // 6 saniye
    const BOT_SPAWN_WARN = 180;     // 3 saniye uyarı çemberi

    // Siper
    const SIPER_CAN = 2000; // 800 * 2.5

    let turuncuBot = null;
    let respawnTimer = 0;
    let spawnUyariTimer = 0;
    let spawnX = 0;
    let spawnY = 0;

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Turuncu Baskın',
        onStart: function () {
            turuncuBot = null;
            respawnTimer = 0;
            spawnUyariTimer = 0;
            spawnX = 0;
            spawnY = 0;

            // Klasik botları kapat
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];

            // Siperleri gri yap ve canını 2.5 katına çıkar
            obstacles.forEach(o => {
                o.maxHp = SIPER_CAN;
                o.hp = SIPER_CAN;
                o._griSiper = true;
            });

            // İlk turuncu botu spawn uyarısıyla hazırla
            botSpawnHazirla();
        },

        onUpdate: function (ts) {
            // Diğer spawn timerlarını sıfırla
            slimeTimer = 0; stationaryTimer = 0;
            boomerangTimer = 0; fogBotTimer = 0;
            spawnIndicators = [];

            // Yeni eklenen siperleri de gri yap
            obstacles.forEach(o => {
                if (!o._griSiper) {
                    o.maxHp = SIPER_CAN;
                    o.hp = SIPER_CAN;
                    o._griSiper = true;
                }
            });

            // Spawn aşaması
            if (!turuncuBot || turuncuBot.isDead) {
                if (spawnUyariTimer > 0) {
                    spawnUyariTimer -= ts;
                    if (spawnUyariTimer <= 0) {
                        dogurTuruncuBot();
                    }
                } else if (respawnTimer > 0) {
                    respawnTimer -= ts;
                    if (respawnTimer <= 0) {
                        respawnTimer = 0;
                        botSpawnHazirla();
                    }
                }
            }

            // Botu güncelle
            if (turuncuBot && !turuncuBot.isDead) {
                const b = turuncuBot;

                // Can kontrolü (Ders 6)
                if (b.hp <= 0) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color, 'smoke');
                    triggerBotKill(b.x, b);
                    respawnTimer = BOT_RESPAWN_SURESI;
                } else {
                    // Görünmezlik kontrolü (Ders 5)
                    const canSee = !player.isDead && !player.isInvisible;

                    if (canSee) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);

                        // Ateş (stationary_bot_bullet -> 9999 menzil)
                        if (Date.now() - b.lastShot > BOT_SHOOT_INTERVAL) {
                            b.lastShot = Date.now();
                            botBullets.push({
                                x: b.x, y: b.y,
                                sx: b.x, sy: b.y,
                                vx: Math.cos(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED,
                                vy: Math.sin(b.angle + (Math.random() - 0.5) * 0.15) * BOT_BULLET_SPEED,
                                dmgMod: 1,
                                type: 'stationary_bot_bullet',
                                owner: b
                            });
                        }
                    }

                    // Knockback
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
            }
        },

        onReset: function () {
            turuncuBot = null;
            respawnTimer = 0;
            spawnUyariTimer = 0;
            spawnX = 0;
            spawnY = 0;
        }
    });

    function botSpawnHazirla() {
        spawnX = Math.random() * (canvas.width - 200) + 100;
        spawnY = Math.random() * (canvas.height - 200) + 100;
        spawnUyariTimer = BOT_SPAWN_WARN;
    }

    function dogurTuruncuBot() {
        turuncuBot = {
            x: spawnX, y: spawnY,
            radius: BOT_RADIUS,
            hp: BOT_HP, maxHp: BOT_HP,
            speed: 0,
            angle: 0,
            lastShot: 0,
            shootInterval: BOT_SHOOT_INTERVAL,
            isDead: false,
            isActive: true,
            color: '#e67e22',
            kbX: 0, kbY: 0,
            alerted: false,
            bombaBulasti: false,
            bombaSayaci: 0,
            ghostRingDebounce: 0
        };
        spawnParticles(turuncuBot.x, turuncuBot.y, '#e67e22', 'smoke');
    }

    // ========== DÜŞMAN LİSTESİNE EKLE ==========
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return [];
        if (!turuncuBot || turuncuBot.isDead) return [];
        return [turuncuBot];
    });

    // ========== ÇİZİM ==========
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Siperleri gri çiz (mor siperlerin birebir aynı şekli)
        for (const o of obstacles) {
            ctx2.save();
            ctx2.translate(o.x, o.y);
            ctx2.fillStyle = '#808080';
            ctx2.beginPath();
            ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 10);
            ctx2.fill();
            ctx2.strokeStyle = '#505050';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // Can barı
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-15, -o.radius - 15, 30, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-15, -o.radius - 15, 30 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // Spawn uyarı çemberi (ciritçi gibi, turuncu)
        if (spawnUyariTimer > 0) {
            ctx2.save();
            ctx2.translate(spawnX, spawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, BOT_RADIUS + 12, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#e67e22';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(spawnUyariTimer / 60), 0, 5);
            ctx2.restore();
        }

        // Turuncu bot
        if (turuncuBot && !turuncuBot.isDead) {
            const b = turuncuBot;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-b.radius, -b.radius - 12, b.radius * 2, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-b.radius, -b.radius - 12, b.radius * 2 * (b.hp / b.maxHp), 5);
            ctx2.rotate(b.angle);
            ctx2.fillStyle = b.color;
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#a04000';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.fillStyle = '#fff';
            ctx2.beginPath();
            ctx2.arc(8, -5, 5, 0, Math.PI * 2);
            ctx2.arc(8, 5, 5, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.fillStyle = '#1a1a2e';
            ctx2.beginPath();
            ctx2.arc(9, -5, 2.5, 0, Math.PI * 2);
            ctx2.arc(9, 5, 2.5, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        }
    });

    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Gri siperler, sınırsız menzilli turuncu bot');

    console.log('[MOD YÜKLENDİ] turuncu');
})();