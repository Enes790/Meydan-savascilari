// ========== mod7.js (BUZUL ÇAĞI) ==========
// Mod: Buzul Çağı
// Buz Siperi: Sabit engel, 3000 can, yok edilince 2 Buz Slime doğurur.
// Buz Slime: Küçük (radius 12), hızlı (2.5), temas hasarı 150.
// Klasik botlar tamamen kapalı.

(function () {
    'use strict';

    const MOD_ID = 'buzul';

    // Buz Siperi
    const SIPER_HP = 3000;
    const SIPER_RADIUS = 35;
    const SIPER_SPAWN_INTERVAL = 480; // 8 saniyede bir
    const SIPER_SPAWN_WARN = 90;       // 1.5 saniye uyarı

    // Buz Slime
    const SLIME_HP = 600;
    const SLIME_SPEED = 2.5;
    const SLIME_RADIUS = 12;
    const SLIME_DAMAGE = 150;

    let buzlSiperler = [];
    let buzSlimeLari = [];
    let siperSpawnTimer = 0;
    let siperSpawnUyarilari = [];

    // ========== MOD TANIMI ==========
    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Buzul Çağı',
        onStart: function () {
            buzlSiperler = [];
            buzSlimeLari = [];
            siperSpawnTimer = 0;
            siperSpawnUyarilari = [];
            player.buzulYavaslatma = 0;

            // Klasik botları kapat
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];
        },
        onUpdate: function (ts) {
            // Klasik spawn timerlarını sıfırla
            slimeTimer = 0;
            stationaryTimer = 0;
            boomerangTimer = 0;
            fogBotTimer = 0;
            spawnIndicators = [];

            // --- Buz Siperi Spawn ---
            siperSpawnTimer += ts;
            if (siperSpawnTimer >= SIPER_SPAWN_INTERVAL && buzlSiperler.length < 5) {
                siperSpawnTimer = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                siperSpawnUyarilari.push({ x, y, timer: SIPER_SPAWN_WARN });
            }

            for (let i = siperSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = siperSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    buzlSiperler.push({
                        x: u.x, y: u.y,
                        radius: SIPER_RADIUS,
                        hp: SIPER_HP,
                        maxHp: SIPER_HP,
                        isDead: false,
                        isActive: true,
                        isNest: false,
                        isFog: false,
                        color: '#5dade2',
                        kbX: 0, kbY: 0,
                        bombaBulasti: false,
                        bombaSayaci: 0,
                        ghostRingDebounce: 0,
                        alerted: false,
                        stage: 0,
                        oSp: 0,
                        oR: SIPER_RADIUS
                    });
                    siperSpawnUyarilari.splice(i, 1);
                }
            }

            // --- Buz Siperi Güncelleme (yok edilince slime doğur) ---
            for (let i = buzlSiperler.length - 1; i >= 0; i--) {
                const s = buzlSiperler[i];

                // Can kontrolü
                if (s.hp <= 0 && !s.isDead) {
                    s.isDead = true;
                    // 2 Buz Slime doğur
                    for (let k = 0; k < 2; k++) {
                        const offsetX = (Math.random() - 0.5) * 30;
                        const offsetY = (Math.random() - 0.5) * 30;
                        buzSlimeLari.push({
                            x: s.x + offsetX, y: s.y + offsetY,
                            radius: SLIME_RADIUS,
                            hp: SLIME_HP,
                            maxHp: SLIME_HP,
                            speed: SLIME_SPEED,
                            baseSpeed: SLIME_SPEED,
                            angle: Math.random() * Math.PI * 2,
                            isDead: false,
                            isActive: true,
                            isNest: false,
                            isFog: false,
                            color: '#aed6f1',
                            kbX: 0, kbY: 0,
                            bombaBulasti: false,
                            bombaSayaci: 0,
                            ghostRingDebounce: 0,
                            alerted: false,
                            stage: 0,
                            oSp: SLIME_SPEED,
                            oR: SLIME_RADIUS
                        });
                    }
                    spawnParticles(s.x, s.y, '#5dade2', 'normal');
                    addFloatingNumber(s.x, s.y - 20, "BUZ SLIME ÇIKTI!", "#5dade2");
                    buzlSiperler.splice(i, 1);
                    continue;
                }
                if (s.isDead) { buzlSiperler.splice(i, 1); continue; }

                // Siper sabit olduğu için hareket yok, sadece sınır kontrolü
                s.x = clampPos(s.x, s.radius + WALL_THICKNESS, canvas.width - s.radius - WALL_THICKNESS);
                s.y = clampPos(s.y, s.radius + WALL_THICKNESS, canvas.height - s.radius - WALL_THICKNESS);
            }

            // --- Buz Slime Güncelleme ---
            for (let i = buzSlimeLari.length - 1; i >= 0; i--) {
                const b = buzSlimeLari[i];

                // Can kontrolü
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { buzSlimeLari.splice(i, 1); continue; }

                // Görünmezlik kontrolü
                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                }

                // Sınır kontrolü
                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);

                // Engellerle çarpışma
                resolveObstacleCollision(b);

                // Oyuncuya temas hasarı
                if (!player.isDead && !player.jumpInvulnerable && getDist(b, player) < b.radius + player.radius) {
                    player.hp -= SLIME_DAMAGE;
                    addFloatingNumber(player.x, player.y, SLIME_DAMAGE, "#e74c3c");
                    player.lastHitTime = Date.now();
                    b.hp = 0; // temas edince kendini yok et
                }
            }

            // Buz Slime'lar için yavaşlatma etkisi (özel alan)
            if (player.buzulYavaslatma > 0) {
                player.buzulYavaslatma -= ts;
                if (player.buzulYavaslatma <= 0) {
                    player.buzulYavaslatma = 0;
                    player.speed = player.originalSpeed;
                }
            }
        },
        onReset: function () {
            buzlSiperler = [];
            buzSlimeLari = [];
            siperSpawnTimer = 0;
            siperSpawnUyarilari = [];
            player.buzulYavaslatma = 0;
        }
    };

    // ========== EK DÜŞMANLAR ==========
    const originalGetExtraEnemies = window.GAME_EXT.hooks.getExtraEnemies;
    window.GAME_EXT.hooks.getExtraEnemies = function () {
        let extras = [];
        if (typeof originalGetExtraEnemies === 'function') {
            extras = originalGetExtraEnemies() || [];
        }
        extras = extras.concat(buzlSiperler.filter(s => !s.isDead));
        extras = extras.concat(buzSlimeLari.filter(b => !b.isDead));
        return extras;
    };

    // ========== ÇİZİM ==========
    const originalDraw = window.draw;
    window.draw = function () {
        originalDraw();
        if (!gameStarted || window.GAME_MODE !== MOD_ID) return;

        // Siper spawn uyarıları
        siperSpawnUyarilari.forEach(u => {
            ctx.save();
            ctx.translate(u.x, u.y);
            ctx.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx.beginPath();
            ctx.arc(0, 0, SIPER_RADIUS + 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#5dade2';
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.fillText(Math.ceil(u.timer / 60), 0, 6);
            ctx.restore();
        });

        // Buz Siperleri
        buzlSiperler.forEach(s => {
            if (s.isDead) return;
            ctx.save();
            ctx.translate(s.x, s.y);
            // Can barı
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-30, -s.radius - 15, 60, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-30, -s.radius - 15, 60 * (s.hp / s.maxHp), 5);
            // Gövde (buz kristali görünümü)
            ctx.fillStyle = '#5dade2';
            ctx.beginPath();
            ctx.moveTo(s.radius, 0);
            ctx.lineTo(s.radius * 0.3, -s.radius);
            ctx.lineTo(-s.radius * 0.8, -s.radius * 0.6);
            ctx.lineTo(-s.radius * 0.6, s.radius * 0.4);
            ctx.lineTo(s.radius * 0.4, s.radius);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#2e86c1';
            ctx.lineWidth = 3;
            ctx.stroke();
            // İç parlama
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.arc(0, 0, s.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Buz Slime'ları
        buzSlimeLari.forEach(b => {
            if (b.isDead) return;
            ctx.save();
            ctx.translate(b.x, b.y);
            // Can barı (küçük)
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-10, -b.radius - 10, 20, 3);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-10, -b.radius - 10, 20 * (b.hp / b.maxHp), 3);
            // Gövde
            ctx.rotate(b.angle);
            ctx.fillStyle = '#aed6f1';
            ctx.beginPath();
            ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#5dade2';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Gözler
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

    // ========== MOD SEÇİM KARTI ==========
    const track = document.getElementById('difficulty-track');
    if (track && !document.getElementById('diff-buzul')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-buzul';
        card.innerHTML =
            '<span>Buzul Çağı</span>' +
            '<small>Buz Siperleri + Buz Slime\'lar<br>Klasik botlar kapalı</small>';
        track.appendChild(card);
        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        });
    }

})();