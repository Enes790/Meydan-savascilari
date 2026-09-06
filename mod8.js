// ========== mod7.js (BUZUL ÇAĞI) - SADECE BUZ CEVHERİ BOTU ==========
// - Buz Cevheri: 1600 can, yavaş (1.0), yakın mesafeden tek mermi (300 hasar).
// - Mermi isabet ederse 3 saniye buz alevi etkisi (saniyede 15 hasar, birikebilir).
// - Spawn: 5 saniyede bir (maksimum 3), siperlerden %70 ihtimalle çıkar.
// - Görsel: mor gövde, sırtında doğal kristal, yürüme ve parçalanma animasyonu.
// - Klasik botlar tamamen kapalı.

(function () {
    'use strict';

    const MOD_ID = 'buzul';

    // Buz Cevheri
    const CEVHER_HP = 1600;
    const CEVHER_SPEED = 1.0;
    const CEVHER_RADIUS = 18;
    const CEVHER_SPAWN_INTERVAL = 300;    // 5 saniye
    const CEVHER_SPAWN_WARN = 90;         // 1.5 saniye uyarı
    const CEVHER_MERMI_HASAR = 300;
    const CEVHER_BUZ_ALEV_HASAR = 15;     // saniyede
    const CEVHER_BUZ_ALEV_SURE = 180;     // 3 saniye
    const CEVHER_SALDIRI_INTERVAL = 2000; // 2 saniye

    let buzCevherleri = [];
    let cevherSpawnTimer = 0;
    let cevherSpawnUyarilari = [];

    const originalSpawnObstacle = window.spawnObstacle;

    // ========== MOD TANIMI ==========
    window.GAME_EXT.modes[MOD_ID] = {
        label: 'Buzul Çağı',
        onStart: function () {
            buzCevherleri = [];
            cevherSpawnTimer = 0;
            cevherSpawnUyarilari = [];

            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];

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

            // Siperlerden Buz Cevheri çıkarma (%70)
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                if (o.hp <= 0) {
                    if (Math.random() < 0.7 && buzCevherleri.length < 3) {
                        buzCevherleri.push(cevherOlustur(o.x, o.y));
                    }
                    spawnParticles(o.x, o.y, '#5dade2', 'normal');
                }
            }

            // Buz Cevheri periyodik spawn
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

            // Buz Cevheri güncelleme
            for (let i = buzCevherleri.length - 1; i >= 0; i--) {
                const c = buzCevherleri[i];

                if (c.hp <= 0 && !c.isDead) {
                    c.isDead = true;
                    // Parçalanma animasyonu: kristal parçacıkları
                    for (let k = 0; k < 15; k++) {
                        const ang = Math.random() * Math.PI * 2;
                        const dist = Math.random() * 25;
                        spawnParticles(c.x + Math.cos(ang) * dist, c.y + Math.sin(ang) * dist, '#ff6b35', 'normal');
                    }
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

                    // Yakın mesafeden tek mermi
                    if (d < 120 && Date.now() - c.lastShot > CEVHER_SALDIRI_INTERVAL) {
                        c.lastShot = Date.now();
                        botBullets.push({
                            x: c.x, y: c.y,
                            sx: c.x, sy: c.y,
                            vx: Math.cos(c.angle) * BOT_BULLET_SPEED * 0.9,
                            vy: Math.sin(c.angle) * BOT_BULLET_SPEED * 0.9,
                            dmgMod: 0,
                            type: 'buz_cevheri_alev',
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
        },
        onReset: function () {
            buzCevherleri = [];
            cevherSpawnTimer = 0;
            cevherSpawnUyarilari = [];

            if (originalSpawnObstacle) {
                window.spawnObstacle = originalSpawnObstacle;
            }
        }
    };

    function cevherOlustur(x, y) {
        return {
            x, y,
            radius: CEVHER_RADIUS,
            hp: CEVHER_HP, maxHp: CEVHER_HP,
            speed: CEVHER_SPEED, baseSpeed: CEVHER_SPEED,
            angle: 0,
            lastShot: 0,
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
        extras = extras.concat(buzCevherleri.filter(b => !b.isDead));
        return extras;
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

        // Cevher spawn uyarıları
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

        // Buz Cevherleri
        buzCevherleri.forEach(c => {
            if (c.isDead) return;
            ctx.save();
            ctx.translate(c.x, c.y);

            // Yürüme animasyonu: hafif dikey salınım
            const yurumeOffset = Math.sin(Date.now() / 150) * 2;
            ctx.translate(0, yurumeOffset);

            // Can barı
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-20, -c.radius - 15, 40, 5);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-20, -c.radius - 15, 40 * (c.hp / c.maxHp), 5);

            // Gövde (mor)
            ctx.rotate(c.angle);
            ctx.fillStyle = '#8e44ad';
            ctx.beginPath();
            ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Sırtında doğal kristal (gömülü görünüm)
            ctx.fillStyle = '#ff6b35';
            ctx.shadowColor = '#ff6b35';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(4, -12);
            ctx.lineTo(10, -6);
            ctx.lineTo(4, -2);
            ctx.lineTo(-2, -6);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;

            // Gözler
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(8, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(8, 5, 3, 0, Math.PI * 2);
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
            '<small>Buz Cevheri botu</small>';
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