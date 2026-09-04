// ========== mod4.js (TAŞÇI) - SON DÜZELTMELER ==========
// Karakter: Taşçı
// Ana saldırı: Ağır taş atar (1500 hasar, 2 kez seker).
// Menzil: 140
// Taş engele çarpınca engele hasar verir (200) ve sekme hakkı varsa seker.
// Parçalanma efekti çok hafifletildi.
// Nişan çizgisi güzelleştirildi.
// Taş ve parça hızları düşürüldü.

(function () {
    'use strict';

    const CHAR_ID = 'tasci';
    const CHAR_COLOR = '#8b5e3c';
    const CHAR_HP = 3400;
    const CHAR_SPEED = 3.6;

    const TAS_MENZIL = 140;
    const TAS_HASAR = 1500;
    const TAS_HIZ = PLAYER_BULLET_SPEED * 0.65; // hız düşürüldü
    const TAS_SEKME_HAKKI = 2;
    const ENGELE_HASAR = 200;
    const PARCA_HASAR = 200;
    const PARCA_SAYISI = 9;
    const PARCA_HIZ = PLAYER_BULLET_SPEED * 0.55; // parça hızı düşürüldü
    const PARCA_MENZIL = 90;
    const PARCA_MAX_ACI = Math.PI / 3;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let tasciKayalar = [];
    let tasciParcalar = [];

    // ---- Karakter kartı ----
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Taşçı</span>' +
            '<small>Hasar: 1500<br>Parçalanan Taş</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ---- Hook yardımcısı ----
    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult;
        };
    }

    // ---- setCharacter override ----
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            if (ultiBtn) ultiBtn.style.display = 'none';
            if (gadgetBtn) gadgetBtn.style.display = 'none';
            if (gadgetBtn2) gadgetBtn2.style.display = 'none';
            tasciKayalar = [];
            tasciParcalar = [];
        }
    };

    // ---- Fire override ----
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;

        tasciKayalar.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * TAS_HIZ,
            vy: Math.sin(a) * TAS_HIZ,
            sekmeHakki: TAS_SEKME_HAKKI,
            hasar: TAS_HASAR,
            isDead: false,
            rotasyon: Math.random() * Math.PI * 2
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ---- Reset hook ----
    chainHook('onReset', function () {
        tasciKayalar = [];
        tasciParcalar = [];
    });

    // ---- Draw hook ----
    chainHook('onDraw', function (ctx2) {
        tasciKayalar.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.rotasyon + Date.now() / 200);
            ctx2.beginPath();
            ctx2.moveTo(12, 0);
            ctx2.lineTo(6, -9);
            ctx2.lineTo(-10, -6);
            ctx2.lineTo(-9, 5);
            ctx2.lineTo(2, 11);
            ctx2.closePath();
            ctx2.fillStyle = '#8b5e3c';
            ctx2.fill();
            ctx2.strokeStyle = '#3e2710';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            ctx2.beginPath();
            ctx2.moveTo(-2, -4);
            ctx2.lineTo(5, 1);
            ctx2.lineTo(-3, 5);
            ctx2.strokeStyle = '#5d3a1a';
            ctx2.lineWidth = 1;
            ctx2.stroke();
            ctx2.restore();
        });

        tasciParcalar.forEach(p => {
            ctx2.save();
            ctx2.translate(p.x, p.y);
            ctx2.rotate(p.rotasyon + Date.now() / 150);
            ctx2.beginPath();
            ctx2.moveTo(5, 0);
            ctx2.lineTo(1, -4);
            ctx2.lineTo(-4, 0);
            ctx2.lineTo(1, 4);
            ctx2.closePath();
            ctx2.fillStyle = '#8b5e3c';
            ctx2.fill();
            ctx2.strokeStyle = '#3e2710';
            ctx2.lineWidth = 1;
            ctx2.stroke();
            ctx2.restore();
        });
    });

    // ---- Bağımsız güncelleme döngüsü ----
    let lastTime = 0;
    function tasciLoop(t) {
        if (!lastTime) lastTime = t;
        const ts = Math.min(3, (t - lastTime) / 16.666);
        lastTime = t;
        if (gameStarted) tasciUpdate(ts);
        requestAnimationFrame(tasciLoop);
    }
    requestAnimationFrame(tasciLoop);

    // ---- Parça oluşturma (hafif efekt) ----
    function tasciParcala(tas) {
        const anaAci = Math.atan2(tas.vy, tas.vx);
        const acilar = [];
        acilar.push(0);
        const adim = (PARCA_MAX_ACI * 2) / (PARCA_SAYISI - 1);
        for (let i = 1; i < PARCA_SAYISI; i++) {
            const sapma = -PARCA_MAX_ACI + (i - 1) * adim;
            acilar.push(sapma);
        }
        acilar.forEach(sapma => {
            const aci = anaAci + sapma;
            tasciParcalar.push({
                x: tas.x, y: tas.y,
                sx: tas.x, sy: tas.y,
                vx: Math.cos(aci) * PARCA_HIZ,
                vy: Math.sin(aci) * PARCA_HIZ,
                hasar: PARCA_HASAR,
                isDead: false,
                rotasyon: Math.random() * Math.PI * 2
            });
        });
        // Çok hafif parçacık (3 adet)
        for (let k = 0; k < 3; k++) {
            spawnParticles(tas.x, tas.y, '#8b5e3c', 'normal');
        }
        addFloatingNumber(tas.x, tas.y, "PARÇALANDI!", "#8b5e3c");
    }

    // ---- Güncelleme ----
    function tasciUpdate(ts) {
        for (let i = tasciKayalar.length - 1; i >= 0; i--) {
            const t = tasciKayalar[i];
            if (t.isDead) { tasciKayalar.splice(i, 1); continue; }

            t.x += t.vx * ts;
            t.y += t.vy * ts;

            const hwX = t.x < WALL_THICKNESS + 8 || t.x > canvas.width - WALL_THICKNESS - 8;
            const hwY = t.y < WALL_THICKNESS + 8 || t.y > canvas.height - WALL_THICKNESS - 8;

            let hitObs = null;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(t, o) < o.radius + 11) { hitObs = o; break; }
            }

            if ((hwX || hwY || hitObs) && t.sekmeHakki > 0) {
                if (hwX) { t.vx *= -1; t.x = t.x < canvas.width / 2 ? WALL_THICKNESS + 9 : canvas.width - WALL_THICKNESS - 9; }
                if (hwY) { t.vy *= -1; t.y = t.y < canvas.height / 2 ? WALL_THICKNESS + 9 : canvas.height - WALL_THICKNESS - 9; }
                if (hitObs) {
                    if (hitObs.hp !== undefined) hitObs.hp -= ENGELE_HASAR;
                    addFloatingNumber(hitObs.x, hitObs.y, ENGELE_HASAR, "#8b5e3c");
                    // Yansıma
                    const dx = t.x - hitObs.x;
                    const dy = t.y - hitObs.y;
                    const d = Math.max(1, Math.hypot(dx, dy));
                    const nx = dx / d;
                    const ny = dy / d;
                    const dot = t.vx * nx + t.vy * ny;
                    t.vx -= 2 * dot * nx;
                    t.vy -= 2 * dot * ny;
                    t.x += nx * 5;
                    t.y += ny * 5;
                }
                t.sekmeHakki--;
                t.sx = t.x; t.sy = t.y;
                spawnParticles(t.x, t.y, '#8b5e3c', 'normal');
            }
            else if ((hwX || hwY || hitObs)) {
                t.isDead = true;
                continue;
            }

            const mesafe = getDist(t, { x: t.sx, y: t.sy });
            if (mesafe >= TAS_MENZIL) {
                tasciParcala(t);
                t.isDead = true;
                continue;
            }

            let hedefVuruldu = false;
            getActiveEnemies().forEach(e => {
                if (!hedefVuruldu && getDist(t, e) < e.radius + 11) {
                    e.hp -= t.hasar;
                    addFloatingNumber(e.x, e.y, t.hasar, CHAR_COLOR);
                    spawnParticles(e.x, e.y, CHAR_COLOR, 'normal');
                    hedefVuruldu = true;
                    t.isDead = true;
                }
            });
        }

        for (let i = tasciParcalar.length - 1; i >= 0; i--) {
            const p = tasciParcalar[i];
            if (p.isDead) { tasciParcalar.splice(i, 1); continue; }

            p.x += p.vx * ts;
            p.y += p.vy * ts;

            const hwX = p.x < WALL_THICKNESS + 3 || p.x > canvas.width - WALL_THICKNESS - 3;
            const hwY = p.y < WALL_THICKNESS + 3 || p.y > canvas.height - WALL_THICKNESS - 3;
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(p, o) < o.radius + 4) { hitObs = true; break; }
            }
            const mesafe = getDist(p, { x: p.sx, y: p.sy });
            if (hwX || hwY || hitObs || mesafe > PARCA_MENZIL) {
                p.isDead = true;
                continue;
            }

            let vurdu = false;
            getActiveEnemies().forEach(e => {
                if (!vurdu && getDist(p, e) < e.radius + 8) {
                    e.hp -= p.hasar;
                    addFloatingNumber(e.x, e.y, p.hasar, "#8b5e3c");
                    spawnParticles(e.x, e.y, '#8b5e3c', 'normal');
                    vurdu = true;
                    p.isDead = true;
                }
            });
        }
    }

    // ---- Nişan çizgisi ----
    const originalDraw = window.draw;
    window.draw = function() {
        if (player.charType === CHAR_ID && aimData.active && player.ammo >= 1 && !player.isDead) {
            const geciciAmmo = player.ammo;
            player.ammo = 0;
            originalDraw();
            player.ammo = geciciAmmo;

            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(aimData.angle);
            // Yarı saydam dolgu
            ctx.fillStyle = 'rgba(139, 94, 60, 0.15)';
            ctx.fillRect(0, -5, TAS_MENZIL, 10);
            // Kesikli çizgi
            ctx.strokeStyle = 'rgba(139, 94, 60, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.strokeRect(0, -5, TAS_MENZIL, 10);
            ctx.setLineDash([]);
            // Menzil sonu taş simgesi
            ctx.beginPath();
            ctx.arc(TAS_MENZIL, 0, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#8b5e3c';
            ctx.fill();
            ctx.strokeStyle = '#3e2710';
            ctx.lineWidth = 2;
            ctx.stroke();
            // İç parlama
            ctx.beginPath();
            ctx.arc(TAS_MENZIL, 0, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#d4a574';
            ctx.fill();
            ctx.restore();
        } else {
            originalDraw();
        }
    };

})();