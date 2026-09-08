// ========== mod8.js (ASKERİ ÜS) - SADE SÜRÜM ==========
// - Sadece 1 bot tipi: Keskin Nişancı.
// - Siperler gri, canları normalden 2.5 kat fazla (2000).
// - Siperler patlamaz, mermi çıkarmaz.
// - Keskin Nişancı: 500 hasar, 5 saniyede bir atış, çok hızlı mermi.

(function () {
    'use strict';

    const MOD_ID = 'askeri';

    // Keskin Nişancı
    const NISANCI_HP = 4000;
    const NISANCI_RADIUS = 20;
    const NISANCI_SPEED = 0.6;          // yavaş
    const NISANCI_DAMAGE = 500;
    const NISANCI_MENZIL = 500;         // uzun menzil
    const NISANCI_ATIS_ARALIK = 300;    // 5 saniye (60fps)
    const NISANCI_MERMI_HIZ = BOT_BULLET_SPEED * 2.0; // çok hızlı

    // Siper
    const SIPER_CAN = 2000; // 2.5 kat (normal 800)

    // Mod durumu
    let nisanci = null;
    let spawnUyari = null;

    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Askeri Üs',
        onStart: function () {
            nisanci = null;
            spawnUyari = null;

            // Orijinal botları kapat
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = []; boomerangBots = [];
            fogBots = []; nests = []; spawnIndicators = [];

            // Siperleri gri yap, canlarını 2.5 kat yap
            obstacles.forEach(o => {
                o.maxHp = SIPER_CAN;
                o.hp = SIPER_CAN;
                o._griSiper = true;
            });

            // Başlangıçta 1 keskin nişancı spawn et
            nisanci = createNisanci(
                Math.random() * (canvas.width - 200) + 100,
                Math.random() * (canvas.height - 200) + 100
            );
        },

        onUpdate: function (ts) {
            // Diğer bot timerlarını sıfırla
            slimeTimer = 0; stationaryTimer = 0; boomerangTimer = 0;
            fogBotTimer = 0; spawnIndicators = [];

            // Keskin nişancı öldüyse respawn
            if (!nisanci || nisanci.isDead) {
                if (!spawnUyari) {
                    spawnUyari = { timer: 180 }; // 3 saniye sonra spawn
                }
            }

            if (spawnUyari) {
                spawnUyari.timer -= ts;
                if (spawnUyari.timer <= 0) {
                    nisanci = createNisanci(
                        Math.random() * (canvas.width - 200) + 100,
                        Math.random() * (canvas.height - 200) + 100
                    );
                    spawnUyari = null;
                }
            }

            // Keskin nişancıyı güncelle
            if (nisanci && !nisanci.isDead) {
                updateNisanci(nisanci, ts);
            }

            // Yeni eklenen siperleri de gri yap ve canını ayarla
            obstacles.forEach(o => {
                if (!o._griSiper) {
                    o._griSiper = true;
                    o.maxHp = SIPER_CAN;
                    o.hp = SIPER_CAN;
                }
            });
        },

        onReset: function () {
            nisanci = null;
            spawnUyari = null;
        }
    });

    function createNisanci(x, y) {
        return {
            x, y,
            radius: NISANCI_RADIUS,
            hp: NISANCI_HP, maxHp: NISANCI_HP,
            speed: NISANCI_SPEED,
            angle: 0,
            lastShot: 0,
            isDead: false,
            isActive: true,
            color: '#2C3E50',
            kbX: 0, kbY: 0,
            tip: 'keskin'
        };
    }

    function updateNisanci(b, ts) {
        const canSee = !player.isDead && !player.isInvisible;

        if (canSee) {
            b.angle = Math.atan2(player.y - b.y, player.x - b.x);
            const d = getDist(b, player);

            // Uzak mesafede yavaşça yaklaş, çok yaklaşınca geri çekil
            if (d > NISANCI_MENZIL) {
                b.x += Math.cos(b.angle) * b.speed * ts;
                b.y += Math.sin(b.angle) * b.speed * ts;
            } else if (d < 200) {
                b.x -= Math.cos(b.angle) * b.speed * ts;
                b.y -= Math.sin(b.angle) * b.speed * ts;
            }

            // Ateş et
            if (d < NISANCI_MENZIL + 100 && Date.now() - b.lastShot > NISANCI_ATIS_ARALIK) {
                b.lastShot = Date.now();
                botBullets.push({
                    x: b.x, y: b.y,
                    sx: b.x, sy: b.y,
                    vx: Math.cos(b.angle) * NISANCI_MERMI_HIZ,
                    vy: Math.sin(b.angle) * NISANCI_MERMI_HIZ,
                    dmgMod: 1,
                    type: 'nisanci_mermi',
                    owner: b
                });
                addFloatingNumber(b.x, b.y - 20, "KESKİN ATIŞ!", "#2C3E50");
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

        // Ölüm kontrolü
        if (b.hp <= 0) {
            b.isDead = true;
            spawnParticles(b.x, b.y, '#2C3E50', 'smoke');
            triggerBotKill(b.x, b);
        }
    }

    // Bot listesine ekle
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        return nisanci && !nisanci.isDead ? [nisanci] : [];
    });

    // Bot mermisi çarpışması (özel hasar zaten 500, ana oyun halleder)
    const originalBullet = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (isBot && window.GAME_MODE === MOD_ID) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (b.type === 'nisanci_mermi') {
                    // Hızlı mermi olduğu için standart güncelleme yeterli,
                    // ama engellere çarpınca yok olsun.
                    // Ana oyun bunu zaten yapıyor, ekstra bir şey yok.
                }
            }
        }
        originalBullet(list, isBot, ts);
    };

    // Çizim
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Siperleri gri çiz
        for (const o of obstacles) {
            ctx2.save();
            ctx2.translate(o.x, o.y);
            ctx2.fillStyle = '#808080'; // gri
            ctx2.beginPath();
            ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 8);
            ctx2.fill();
            ctx2.strokeStyle = '#505050';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // Can barı
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-o.radius, -o.radius - 12, o.radius * 2 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // Spawn uyarısı
        if (spawnUyari && spawnUyari.timer > 0) {
            ctx2.save();
            ctx2.translate(canvas.width / 2, canvas.height / 2);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, 30, 0, Math.PI * 2);
            ctx2.strokeStyle = '#2C3E50';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#2C3E50';
            ctx2.font = "bold 16px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText("KESKİN NİŞANCI GELİYOR", 0, 40);
            ctx2.restore();
        }

        // Keskin nişancıyı çiz
        if (nisanci && !nisanci.isDead) {
            const b = nisanci;
            ctx2.save();
            ctx2.translate(b.x, b.y);
            // Can barı
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-b.radius - 5, -b.radius - 15, (b.radius + 5) * 2, 5);
            ctx2.fillStyle = '#2ecc71';
            ctx2.fillRect(-b.radius - 5, -b.radius - 15, (b.radius + 5) * 2 * (b.hp / b.maxHp), 5);
            // Gövde
            ctx2.rotate(b.angle);
            ctx2.fillStyle = '#2C3E50';
            ctx2.beginPath();
            ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = '#1A252F';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // Nişan çizgisi (tüfek)
            ctx2.fillStyle = '#7F8C8D';
            ctx2.fillRect(b.radius - 2, -3, 20, 6);
            ctx2.restore();
        }
    });

    // Mod seçim kartı
    const track = document.getElementById('difficulty-track');
    if (track && !document.getElementById('diff-askeri')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-askeri';
        card.innerHTML = '<span>Askeri Üs</span><small>Keskin Nişancı</small>';
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

    console.log('Askeri Üs modu (sade) yüklendi.');
})();