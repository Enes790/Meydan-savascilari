// ========== mod7.js (BUZUL ÇAĞI) - GÜNCELLENMİŞ v3 ==========
// - Buz Botu oyuncuyu 2.5 kare (yaklaşık 25 birim) iter, kendini itmez.
// - Oyuncuya doğrudan konum değişikliği ile itme uygulanır (kbX/kbY değil).
// - Patlama titreşimi kaldırıldı.
// - Normal siperler buz renginde.
// - Buz Botu daha iyi kristal görünümde.
// - Spawn uyarısı 3 saniye.
// - Mod seçim ekranı kaydırma düzeltmesi güçlendirildi.
// - İkinci bot: Buz Ciritçisi (orta menzilli, yavaşlatma yapmaz).

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
    const BUZ_BOT_ITME_MESAFE = 25; // 2.5 kare (10 birim = 1 kare varsayımıyla)
    const BUZ_BOT_PATLAMA_YARICAP = 68;
    const BUZ_BOT_PATLAMA_HASAR = 200;
    const BUZ_BOT_SPAWN_INTERVAL = 600;
    const BUZ_BOT_SPAWN_WARN = 180;
    const BUZ_BOT_SALDIRI_ARALIK = 2000;

    // Buz Ciritçisi (ikinci bot)
    const CIRITCI_HP = 2500;
    const CIRITCI_SPEED = 1.0;
    const CIRITCI_RADIUS = 18;
    const CIRITCI_SHOOT_RANGE = 300;
    const CIRITCI_SHOOT_INTERVAL = 1500;
    const CIRITCI_DAMAGE = 400;
    const CIRITCI_SPAWN_INTERVAL = 480; // 8 saniyede bir
    const CIRITCI_SPAWN_WARN = 120;       // 2 saniye

    let buzSlimeLari = [];
    let buzBotlari = [];
    let ciritciBotlari = [];
    let buzBotSpawnTimer = 0;
    let buzBotSpawnUyarilari = [];
    let ciritciSpawnTimer = 0;
    let ciritciSpawnUyarilari = [];
    let sonTemasZamani = {};

    // ========== MOD TANIMI ==========
    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Buzul Çağı',
        onStart: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciSpawnTimer = 0;
            ciritciSpawnUyarilari = [];
            sonTemasZamani = {};

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
            slimeTimer = 0;
            stationaryTimer = 0;
            boomerangTimer = 0;
            fogBotTimer = 0;
            spawnIndicators = [];

            // Normal siperlerden buz slime çıkarma
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

            // Buz Botu spawn
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
                    const bot = {
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
                        oR: BUZ_BOT_RADIUS
                    };
                    buzBotlari.push(bot);
                    sonTemasZamani[bot] = 0;
                    buzBotSpawnUyarilari.splice(i, 1);
                }
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
                    spawnParticles(b.x, b.y, '#2e86c1', 'normal');
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
                            // Oyuncuyu doğrudan konum ile it
                            const itmeAci = getAngle(b, player);
                            player.x += Math.cos(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            player.y += Math.sin(itmeAci) * BUZ_BOT_ITME_MESAFE;
                            // Sınır kontrolü
                            player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
                            player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
                        }
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

            // Buz Ciritçisi spawn
            ciritciSpawnTimer += ts;
            if (ciritciSpawnTimer >= CIRITCI_SPAWN_INTERVAL && ciritciBotlari.length < 2) {
                ciritciSpawnTimer = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                ciritciSpawnUyarilari.push({ x, y, timer: CIRITCI_SPAWN_WARN });
            }

            for (let i = ciritciSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = ciritciSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    ciritciBotlari.push({
                        x: u.x, y: u.y,
                        radius: CIRITCI_RADIUS,
                        hp: CIRITCI_HP,
                        maxHp: CIRITCI_HP,
                        speed: CIRITCI_SPEED,
                        baseSpeed: CIRITCI_SPEED,
                        angle: 0,
                        lastShot: 0,
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
                        oSp: CIRITCI_SPEED,
                        oR: CIRITCI_RADIUS
                    });
                    ciritciSpawnUyarilari.splice(i, 1);
                }
            }

            // Buz Ciritçisi güncelleme
            for (let i = ciritciBotlari.length - 1; i >= 0; i--) {
                const c = ciritciBotlari[i];

                if (c.hp <= 0 && !c.isDead) {
                    c.isDead = true;
                    spawnParticles(c.x, c.y, c.color);
                    triggerBotKill(c.x, c);
                }
                if (c.isDead) { ciritciBotlari.splice(i, 1); continue; }

                const canSeePlayer = !player.isDead && !player.isInvisible;
                if (canSeePlayer) {
                    c.angle = Math.atan2(player.y - c.y, player.x - c.x);
                    const d = getDist(c, player);
                    // Orta menzilde dur, çok yaklaşma
                    if (d > CIRITCI_SHOOT_RANGE) {
                        c.x += Math.cos(c.angle) * c.speed * ts;
                        c.y += Math.sin(c.angle) * c.speed * ts;
                    } else if (d < 150) {
                        // Çok yakınsa geri çekil
                        c.x -= Math.cos(c.angle) * c.speed * ts;
                        c.y -= Math.sin(c.angle) * c.speed * ts;
                    }

                    // Mızrak atışı
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

            // Buz Slime güncelleme
            for (let i = buzSlimeLari.length - 1; i >= 0; i--) {
                const b = buzSlimeLari[i];

                if (b.hp <= 0 && !b.isDead) {
                    b.isDead = true;
                    spawnParticles(b.x, b.y, b.color);
                    triggerBotKill(b.x, b);
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
        },
        onReset: function () {
            buzSlimeLari = [];
            buzBotlari = [];
            ciritciBotlari = [];
            buzBotSpawnTimer = 0;
            buzBotSpawnUyarilari = [];
            ciritciSpawnTimer = 0;
            ciritciSpawnUyarilari = [];
            sonTemasZamani = {};
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

        // Ciritçi spawn uyarıları
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

        // Buz Botları (kristal)
        buzBotlari.forEach(b => {
            if (b.isDead) return;
            ctx.save();
            ctx.translate(b.x, b.y);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-25, -b.radius - 15, 50, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-25, -b.radius - 15, 50 * (b.hp / b.maxHp), 5);

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
            // Gövde
            ctx.fillStyle = '#5dade2';
            ctx.beginPath();
            ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2e86c1';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Mızrak
            ctx.fillStyle = '#aed6f1';
            ctx.fillRect(12, -2, 15, 4);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(27, 0);
            ctx.lineTo(22, -4);
            ctx.lineTo(22, 4);
            ctx.closePath();
            ctx.fill();
            // Gözler
            ctx.fillStyle = '#1a5276';
            ctx.beginPath();
            ctx.arc(6, -5, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(6, 5, 2.5, 0, Math.PI * 2);
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

    // ========== MOD SEÇİM KARTI + KAYDIRMA DÜZELTME ==========
    const track = document.getElementById('difficulty-track');
    if (track) {
        track.style.touchAction = 'pan-y';
        track.style.webkitOverflowScrolling = 'touch';
        track.style.overflowY = 'scroll';
        track.style.maxHeight = '70vh';
        track.style.scrollSnapType = 'none'; // scroll-snap'i kapat, serbest kaydırma
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
            '<small>Normal siperler buz keser<br>Buz Botu + Buz Slime + Ciritçi</small>';
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

})();