// ========== mod4.js (TAŞÇI) ==========
// Karakter: Taşçı
// Ana saldırı: Ağır taş atar (1500 hasar, 2 kez seker).
// Menzil sonunda 9 parçaya ayrılır (her biri 200 hasar).
// Parçalar: biri taşın gittiği yönde, diğerleri maksimum ±60° sapma ile.
// Taş bota çarparsa parçalanmaz, direkt hasar verir ve yok olur.

(function () {
    'use strict';

    const CHAR_ID = 'tasci';
    const CHAR_COLOR = '#8b5e3c';
    const CHAR_HP = 3400;
    const CHAR_SPEED = 3.6;

    const TAS_MENZIL = 380;                  // Hortlak'tan biraz kısa
    const TAS_HASAR = 1500;
    const TAS_HIZ = PLAYER_BULLET_SPEED * 0.8; // ağır taş, yavaş
    const TAS_SEKME_HAKKI = 2;               // 2 kez sekebilir
    const PARCA_HASAR = 200;
    const PARCA_SAYISI = 9;
    const PARCA_HIZ = PLAYER_BULLET_SPEED * 0.7; // parçalar yavaş
    const PARCA_MENZIL = 180;
    const PARCA_MAX_ACI = Math.PI / 3;       // 60 derece

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let tasciKayalar = [];    // ana taşlar
    let tasciParcalar = [];   // parçalar

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

    // ---- setCharacter override: ulti butonunu gizle ve dizileri temizle ----
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

    // ---- Fire override: taş at ----
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
            isDead: false
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ---- chargeUlti override gereksiz, ulti yok ----

    // ---- Reset hook ----
    chainHook('onReset', function () {
        tasciKayalar = [];
        tasciParcalar = [];
    });

    // ---- Draw hook: taş ve parçaları çiz ----
    chainHook('onDraw', function (ctx2) {
        tasciKayalar.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(Math.atan2(b.vy, b.vx));
            ctx2.beginPath();
            ctx2.arc(0, 0, 11, 0, Math.PI * 2);
            ctx2.fillStyle = CHAR_COLOR;
            ctx2.fill();
            ctx2.strokeStyle = '#3e2710';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // Kaya dokusu
            ctx2.beginPath();
            ctx2.arc(-2, -2, 3, 0, Math.PI * 2);
            ctx2.fillStyle = '#6b4a2b';
            ctx2.fill();
            ctx2.restore();
        });

        tasciParcalar.forEach(p => {
            ctx2.save();
            ctx2.translate(p.x, p.y);
            ctx2.rotate(Math.atan2(p.vy, p.vx));
            ctx2.beginPath();
            ctx2.arc(0, 0, 4, 0, Math.PI * 2);
            ctx2.fillStyle = '#8b5e3c';
            ctx2.fill();
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

    // ---- Parça oluşturma ----
    function tasciParcala(tas) {
        const anaAci = Math.atan2(tas.vy, tas.vx);
        // 9 parça: biri düz, diğerleri -60 ile +60 arasında eşit dağılım
        const acilar = [];
        acilar.push(0); // düz
        const adim = (PARCA_MAX_ACI * 2) / (PARCA_SAYISI - 1); // 120° / 8 = 15°
        for (let i = 1; i < PARCA_SAYISI; i++) {
            const sapma = -PARCA_MAX_ACI + (i - 1) * adim;
            acilar.push(sapma);
        }
        // Karıştır veya sıralı bırak, fark etmez
        acilar.forEach(sapma => {
            const aci = anaAci + sapma;
            tasciParcalar.push({
                x: tas.x, y: tas.y,
                sx: tas.x, sy: tas.y,
                vx: Math.cos(aci) * PARCA_HIZ,
                vy: Math.sin(aci) * PARCA_HIZ,
                hasar: PARCA_HASAR,
                isDead: false
            });
        });
        addFloatingNumber(tas.x, tas.y, "PARÇALANDI!", "#8b5e3c");
    }

    // ---- Güncelleme ----
    function tasciUpdate(ts) {
        // Taşlar
        for (let i = tasciKayalar.length - 1; i >= 0; i--) {
            const t = tasciKayalar[i];
            if (t.isDead) { tasciKayalar.splice(i, 1); continue; }

            t.x += t.vx * ts;
            t.y += t.vy * ts;

            // Duvarlara çarpma
            const hwX = t.x < WALL_THICKNESS + 8 || t.x > canvas.width - WALL_THICKNESS - 8;
            const hwY = t.y < WALL_THICKNESS + 8 || t.y > canvas.height - WALL_THICKNESS - 8;

            // Engeller
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(t, o) < o.radius + 11) { hitObs = true; break; }
            }

            // Duvara çarptıysa ve sekme hakkı varsa
            if ((hwX || hwY || hitObs) && t.sekmeHakki > 0) {
                if (hwX) { t.vx *= -1; t.x = t.x < canvas.width / 2 ? WALL_THICKNESS + 9 : canvas.width - WALL_THICKNESS - 9; }
                if (hwY) { t.vy *= -1; t.y = t.y < canvas.height / 2 ? WALL_THICKNESS + 9 : canvas.height - WALL_THICKNESS - 9; }
                if (hitObs) { t.vx *= -1; t.vy *= -1; t.x += t.vx; t.y += t.vy; }
                t.sekmeHakki--;
                // Menzili yeniden başlat (böylece sekme sonrası daha uzağa gidebilir)
                t.sx = t.x; t.sy = t.y;
            }
            else if ((hwX || hwY || hitObs)) {
                // Sekme hakkı bitti, parçalanmadan yok olabilir veya parçalansın
                // İsteğe göre parçalanabilir, ama biz yok edelim
                t.isDead = true;
                continue;
            }

            // Menzil kontrolü
            const mesafe = getDist(t, { x: t.sx, y: t.sy });
            if (mesafe >= TAS_MENZIL) {
                // Menzil sonunda parçalan
                tasciParcala(t);
                t.isDead = true;
                continue;
            }

            // Bota çarpma (parçalanmaz, hasar verir)
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

        // Parçalar
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

    // ---- Nişan çizgisi (opsiyonel) ----
    const originalDraw = window.draw;
    window.draw = function() {
        originalDraw();
        if (!gameStarted || player.charType !== CHAR_ID) return;
        if (aimData.active && player.ammo >= 1 && !player.isDead) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(aimData.angle);
            ctx.fillStyle = 'rgba(139, 94, 60, 0.2)';
            ctx.fillRect(0, -6, TAS_MENZIL, 12);
            ctx.strokeStyle = 'rgba(139, 94, 60, 0.6)';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, -6, TAS_MENZIL, 12);
            ctx.restore();
        }
    };

})();