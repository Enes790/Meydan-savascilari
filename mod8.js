
// ========== mod7.js (BUZUL ÇAĞI) - GÜNCELLENMİŞ ==========
// Mod: Buzul Çağı
// Normal siperler buz siperi gibi davranır: yok edilince 2 Buz Slime doğurur.
// Buz Botu: 5000 can, yakın dövüş, temas hasarı 600 + itme, ölünce patlama (68 yarıçap, 200 hasar).
// Buz Slime: Küçük (radius 12), hızlı (2.5), temas hasarı 150.
// Klasik botlar tamamen kapalı.

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
    const BUZ_BOT_SPEED = 1.0;
    const BUZ_BOT_RADIUS = 22;
    const BUZ_BOT_TEMAS_HASAR = 600;
    const BUZ_BOT_ITME_GUCU = 40;          // güçlü itme
    const BUZ_BOT_PATLAMA_YARICAP = 68;    // ninja alanının %40 küçüğü
    const BUZ_BOT_PATLAMA_HASAR = 200;
    const BUZ_BOT_SPAWN_INTERVAL = 600;    // 10 saniyede bir
    const BUZ_BOT_SPAWN_WARN = 90;

    let buzSlimeLari = [];
    let buzBotlari = [];
    let buzBotSpawnTimer = 0;
    let buzBotSpawnUyarilari = [];
    let oncekiEngeller = []; // normal siperleri takip için

    // ========== MOD TANIMI ==========
    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Buzul Çağı',
        onStart: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            oncekiEngeller = [];
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

            // ========== NORMAL SİPERLERDEN BUZ SLIME DOĞURMA ==========
            // Mevcut engelleri kontrol et, hp'si 0'a düşenleri tespit et
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                if (o.hp <= 0) {
                    // Bu engel ölmek üzere, 2 Buz Slime doğur
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
                    spawnParticles(o.x, o.y, '#5dade2', 'normal');
                    addFloatingNumber(o.x, o.y - 20, "BUZ SLIME ÇIKTI!", "#5dade2");
                }
            }

            // ========== BUZ BOTU SPAWN ==========
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
                    buzBotlari.push({
                        x: u.x, y: u.y,
                        radius: BUZ_BOT_RADIUS,
                        hp: BUZ_BOT_HP,
                        maxHp: BUZ_BOT_HP,
                        speed: BUZ_BOT_SPEED,
                        baseSpeed: BUZ_BOT_SPEED,
                        angle: 0,
                        isDead: false,
                        isActive: true,
                        isNest: false,
                        isFog: false,
                        color: '#2e86c1',
                        kbX: 0, kbY: 0,
                        bombaBulasti: false,
                        bombaSayaci: 0,
                        ghostRingDebounce: 0,
                        alerted: false,
                        stage: 0,
                        oSp: BUZ_BOT_SPEED,
                        oR: BUZ_BOT_RADIUS,
                        temasAtis: false
                    });
                    buzBotSpawnUyarilari.splice(i, 1);
                }
            }

            // ========== BUZ BOTU GÜNCELLEME ==========
            for (let i = buzBotlari.length - 1; i >= 0; i--) {
                const b = buzBotlari[i];

                // Can kontrolü
                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    // Patlama
                    if (!player.isDead && getDist(b, player) < BUZ_BOT_PATLAMA_YARICAP + player.radius) {
                        player.hp -= BUZ_BOT_PATLAMA_HASAR;
                        addFloatingNumber(player.x, player.y, BUZ_BOT_PATLAMA_HASAR, "#e74c3c");
                        player.lastHitTime = Date.now();
                    }
                    spawnParticles(b.x, b.y, '#2e86c1', 'normal');
                    screenShake = 8;
                    triggerBotKill(b.x, b);
                }
                if (b.isDead) { buzBotlari.splice(i, 1); continue; }

                // Görünmezlik kontrolü
                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                    const d = getDist(b, player);
                    // Uzaktan vuramaz, sadece yaklaşır
                    if (d > b.radius + player.radius + 5) {
                        b.x += Math.cos(b.angle) * b.speed * ts;
                        b.y += Math.sin(b.angle) * b.speed * ts;
                    } else {
                        // Temas anı: 600 hasar + itme
                        if (!b.temasAtis) {
                            b.temasAtis = true;
                            player.hp -= BUZ_BOT_TEMAS_HASAR;
                            addFloatingNumber(player.x, player.y, BUZ_BOT_TEMAS_HASAR, "#e74c3c");
                            player.lastHitTime = Date.now();
                            // Oyuncuyu güçlü it
                            const itmeAci = getAngle(b, player);
                            player.kbX = Math.cos(itmeAci) * BUZ_BOT_ITME_GUCU;
                            player.kbY = Math.sin(itmeAci) * BUZ_BOT_ITME_GUCU;
                            // Bot biraz geri çekilsin
                            b.kbX = -Math.cos(itmeAci) * 20;
                            b.kbY = -Math.sin(itmeAci) * 20;
                        }
                    }
                }

                // Knockback uygula
                if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
                    b.x += b.kbX * ts;
                    b.y += b.kbY * ts;
                    b.kbX *= 0.85;
                    b.kbY *= 0.85;
                }

                // Sınır kontrolü
                b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
                b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
                resolveObstacleCollision(b);
            }

            // ========== BUZ SLIME GÜNCELLEME ==========
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
                resolveObstacleCollision(b);

                // Oyuncuya temas hasarı
                if (!player.isDead && !player.jumpInvulnerable && getDist(b, player) < b.radius + player.radius) {
                    player.hp -= SLIME_DAMAGE;
                    addFloatingNumber(player.x, player.y, SLIME_DAMAGE, "#e74c3c");
                    player.lastHitTime = Date.now();
                    b.hp = 0;
                }
            }
        },
        onReset: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            oncekiEngeller = [];
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
        extras = extras.concat(buzSlimeLari.filter(b => !b.isDead));
        extras = extras.concat(buzBotlari.filter(b => !b.isDead));
        return extras;
    };

    // ========== ÇİZİM ==========
    const originalDraw = window.draw;
    window.draw = function () {
        originalDraw();
        if (!gameStarted || window.GAME_MODE !== MOD_ID) return;

        // Buz Botu spawn uyarıları
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

        // Buz Botları
        buzBotlari.forEach(b => {
            if (b.isDead) return;
            ctx.save();
            ctx.translate(b.x, b.y);
            // Can barı
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-25, -b.radius - 15, 50, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-25, -b.radius - 15, 50 * (b.hp / b.maxHp), 5);
            // Gövde
            ctx.rotate(b.angle);
            ctx.fillStyle = '#2e86c1';
            ctx.beginPath();
            ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1a5276';
            ctx.lineWidth = 3;
            ctx.stroke();
            // Buz çatlakları
            ctx.strokeStyle = '#aed6f1';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-5, -8);
            ctx.lineTo(3, 0);
            ctx.lineTo(-4, 8);
            ctx.stroke();
            // Gözler
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(8, -5, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(8, 5, 4, 0, Math.PI * 2);
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

    // ========== MOD SEÇİM KARTI ==========
    const track = document.getElementById('difficulty-track');
    if (track && !document.getElementById('diff-buzul')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-buzul';
        card.innerHTML =
            '<span>Buzul Çağı</span>' +
            '<small>Normal siperler buz keser<br>Buz Botu + Buz Slime</small>';
        track.appendChild(card);
        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        });
    }

})();