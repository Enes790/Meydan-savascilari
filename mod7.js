// ========== mod10.js (TURUNCU BASKIN) ==========
// - Klasik botlar tamamen kapalı.
// - Sadece turuncu bot spawn olur.
// - Turuncu bot ölünce 6 saniye sonra yeniden doğar.
// - Siperler gri renkte ve 2.5 kat daha fazla cana sahip.
// - Diğer modlar etkilenmez.

(function () {
    'use strict';

    const MOD_ID = 'turuncu';

    // Turuncu bot sabitleri
    const BOT_HP = 2500;
    const BOT_RADIUS = 20;
    const BOT_SPEED = 1.4;
    const BOT_HASAR = 500;
    const BOT_MENZIL = 400;
    const BOT_ATIS_ARALIK = 1500;
    const BOT_RESPAWN_SURESI = 360; // 6 saniye (60fps)
    const BOT_SPAWN_WARN = 120; // 2 saniye uyarı

    // Siper
    const SIPER_CAN = 2000; // 800 * 2.5

    // Aktif turuncu bot (tek bot)
    let turuncuBot = null;
    // Respawn zamanlayıcısı (bot öldükten sonra saymaya başlar)
    let respawnTimer = 0;
    // Spawn uyarı zamanlayıcısı (respawn öncesi gösterilir)
    let spawnUyariTimer = 0;
    // Botun doğacağı yer (respawn sırasında belli olur)
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

            // İlk turuncu botu hemen doğur
            dogurTuruncuBot();
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

            // Bot ölüyse respawn sayacı çalışsın
            if (!turuncuBot || turuncuBot.isDead) {
                if (spawnUyariTimer > 0) {
                    // Uyarı aşaması: kırmızı çember gösteriliyor
                    spawnUyariTimer -= ts;
                    if (spawnUyariTimer <= 0) {
                        dogurTuruncuBot();
                    }
                } else if (respawnTimer > 0) {
                    // Bekleme aşaması: 6 saniye
                    respawnTimer -= ts;
                    if (respawnTimer <= 0) {
                        // Uyarı aşamasına geç
                        respawnTimer = 0;
                        const x = Math.random() * (canvas.width - 200) + 100;
                        const y = Math.random() * (canvas.height - 200) + 100;
                        spawnX = x;
                        spawnY = y;
                        spawnUyariTimer = BOT_SPAWN_WARN;
                    }
                }
            }

            // Turuncu botu güncelle
            if (turuncuBot && !turuncuBot.isDead) {
                const b = turuncuBot;

                // Can kontrolü (Ders 6)
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    triggerBotKill(b.x, b);
                    // Respawn sayacını başlat
                    respawnTimer = BOT_RESPAWN_SURESI;
                } else {
                    // Görünmezlik kontrolü (Ders 5)
                    const canSee = !player.isDead && !player.isInvisible;

                    if (canSee) {
                        b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                        const d = getDist(b, player);

                        if (d > BOT_MENZIL * 0.8) {
                            b.x += Math.cos(b.angle) * b.speed * ts;
                            b.y += Math.sin(b.angle) * b.speed * ts;
                        } else if (d < 150) {
                            b.x -= Math.cos(b.angle) * b.speed * ts;
                            b.y -= Math.sin(b.angle) * b.speed * ts;
                        }

                        if (d < BOT_MENZIL && Date.now() - b.lastShot > BOT_ATIS_ARALIK) {
                            b.lastShot = Date.now();
                            botBullets.push({
                                x: b.x, y: b.y,
                                sx: b.x, sy: b.y,
                                vx: Math.cos(b.angle) * BOT_BULLET_SPEED,
                                vy: Math.sin(b.angle) * BOT_BULLET_SPEED,
                                dmgMod: 1,
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

                    // Sınırlar
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

    // Yeni turuncu bot doğur
    function dogurTuruncuBot() {
        turuncuBot = {
            x: spawnX || (Math.random() * (canvas.width - 200) + 100),
            y: spawnY || (Math.random() * (canvas.height - 200) + 100),
            radius: BOT_RADIUS,
            hp: BOT_HP, maxHp: BOT_HP,
            speed: BOT_SPEED,
            angle: 0,
            lastShot: 0,
            isDead: false,
            isActive: true,
            color: '#e67e22',
            kbX: 0, kbY: 0
        };
        spawnParticles(turuncuBot.x, turuncuBot.y, '#e67e22', 'smoke');
        spawnX = 0;
        spawnY = 0;
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

        // Siperleri gri çiz
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
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-15, -o.radius - 15, 30, 4);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-15, -o.radius - 15, 30 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // Spawn uyarısı (bot gelecek yerdeki çember)
        if (spawnUyariTimer > 0) {
            ctx2.save();
            ctx2.translate(spawnX, spawnY);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, BOT_RADIUS + 15, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e67e22';
            ctx2.lineWidth = 4;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#e67e22';
            ctx2.font = "bold 16px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(spawnUyariTimer / 60), 0, 6);
            ctx2.restore();
        }

        // Respawn geri sayım göstergesi (bot ölüyken)
        if ((!turuncuBot || turuncuBot.isDead) && respawnTimer > 0) {
            ctx2.save();
            ctx2.translate(canvas.width / 2, 80);
            ctx2.fillStyle = 'rgba(0,0,0,0.5)';
            ctx2.fillRect(-100, -20, 200, 40);
            ctx2.fillStyle = '#e67e22';
            ctx2.font = "bold 16px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText("YENİ BOT: " + Math.ceil(respawnTimer / 60) + "s", 0, 6);
            ctx2.restore();
        }

        // Turuncu botu çiz
        if (turuncuBot && !turuncuBot.isDead) {
            const b = turuncuBot;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-20, -b.radius - 15, 40, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-20, -b.radius - 15, 40 * (b.hp / b.maxHp), 5);
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
            ctx2.arc(8, -5, 4, 0, Math.PI * 2);
            ctx2.arc(8, 5, 4, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.fillStyle = '#1a1a2e';
            ctx2.beginPath();
            ctx2.arc(9, -5, 2, 0, Math.PI * 2);
            ctx2.arc(9, 5, 2, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        }
    });

    // Mod kartı
    window.GAME_EXT.modKartiEkle('turuncu', 'Turuncu Baskın', 'Gri siperler, tek turuncu bot');

    console.log('[MOD YÜKLENDİ] turuncu');
})();