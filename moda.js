// ========== mod5.js (ÇARPIŞÇI) ==========
// Karakter: Çarpışçı
// Ana saldırı: Mermi atmaz, Devko menzili kadar (95) dash yapar.
// Dash sonunda 95 yarıçaplı alanda 800 hasar verir.
// Dash sırasında temas ettiği her düşman için +200 can kazanır.
// Ulti: yok, Aksesuar: yok.

(function () {
    'use strict';

    const CHAR_ID = 'carpisci';
    const CHAR_COLOR = '#ff6b35';
    const CHAR_HP = 3600;
    const CHAR_SPEED = 4.0;

    const DASH_MESAFE = 95;          // Devko'nun saldırı menzili
    const ALAN_HASAR = 800;
    const ALAN_YARICAP = 95;
    const DASH_HIZ = 8;              // birim/frame
    const TEMAS_CAN = 200;
    const CEPhane_MAKS = 2;
    const RELOAD_SPEED = 0.01;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    // ---- Karakter kartı ----
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Çarpışçı</span>' +
            '<small>Hasar: 800 (alan)<br>Dash + Temas Canı</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ---- setCharacter override ----
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            this.maxAmmo = CEPhane_MAKS;
            this.ammo = this.maxAmmo;
            this.reloadSpeed = RELOAD_SPEED;
            this.carpisciDashAktif = false;
            this.carpisciDashYon = 0;
            this.carpisciDashKalan = 0;
            this.carpisciTemasEdilenler = [];
            // Butonları gizle
            if (ultiBtn) ultiBtn.style.display = 'none';
            if (gadgetBtn) gadgetBtn.style.display = 'none';
            if (gadgetBtn2) gadgetBtn2.style.display = 'none';
        }
    };

    // ---- fire override ----
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead || this.carpisciDashAktif) return;

        this.carpisciDashAktif = true;
        this.carpisciDashYon = a;
        this.carpisciDashKalan = DASH_MESAFE;
        this.carpisciTemasEdilenler = [];
        this.consumeAmmo();
        this.lastShotTime = Date.now();
        addFloatingNumber(this.x, this.y - 30, "ÇARPIŞ!", CHAR_COLOR);
    };

    // ---- window.update override ----
    const originalUpdate = window.update;
    window.update = function (ts) {
        originalUpdate(ts);
        if (!gameStarted) return;

        if (player.charType === CHAR_ID && player.carpisciDashAktif) {
            const p = player;
            const dx = Math.cos(p.carpisciDashYon) * DASH_HIZ * ts;
            const dy = Math.sin(p.carpisciDashYon) * DASH_HIZ * ts;

            // Dash mesafesini azalt
            p.carpisciDashKalan -= Math.hypot(dx, dy);
            p.x += dx;
            p.y += dy;

            // Sınırlara çarpma (duvarlar)
            p.x = clampPos(p.x, p.radius + WALL_THICKNESS, canvas.width - p.radius - WALL_THICKNESS);
            p.y = clampPos(p.y, p.radius + WALL_THICKNESS, canvas.height - p.radius - WALL_THICKNESS);

            // Dash sırasında temas hasarı ve can kazanma
            getActiveEnemies().forEach(e => {
                if (e.isDead) return;
                if (!p.carpisciTemasEdilenler.includes(e) && getDist(p, e) < p.radius + e.radius) {
                    p.carpisciTemasEdilenler.push(e);
                    p.hp = Math.min(p.maxHp, p.hp + TEMAS_CAN);
                    addFloatingNumber(p.x, p.y - 20, "+" + TEMAS_CAN, "#2ecc71");
                }
            });

            // Dash bitti mi?
            if (p.carpisciDashKalan <= 0) {
                p.carpisciDashAktif = false;
                // Alan hasarı ver
                getActiveEnemies().forEach(e => {
                    if (getDist(p, e) <= ALAN_YARICAP + e.radius) {
                        e.hp -= ALAN_HASAR;
                        addFloatingNumber(e.x, e.y, ALAN_HASAR, CHAR_COLOR);
                    }
                });
                // Görsel efekt: genişleyen daire
                explosions.push({x: p.x, y: p.y, radius: 10, maxRadius: ALAN_YARICAP, life: 15, maxLife: 15});
                // Hafif parçacık
                for (let k = 0; k < 5; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    spawnParticles(p.x + Math.cos(ang) * 20, p.y + Math.sin(ang) * 20, CHAR_COLOR, 'normal');
                }
                screenShake = 5;
                addFloatingNumber(p.x, p.y - 40, "ŞOK DALGASI!", CHAR_COLOR);
            }
        }
    };

    // ---- Nişan çizgisi ----
    const originalDraw = window.draw;
    window.draw = function () {
        originalDraw();
        if (!gameStarted) return;

        if (player.charType === CHAR_ID && aimData.active && player.ammo >= 1 && !player.isDead) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(aimData.angle);
            // Dash mesafesi çizgisi
            ctx.fillStyle = 'rgba(255, 107, 53, 0.15)';
            ctx.fillRect(0, -5, DASH_MESAFE, 10);
            ctx.strokeStyle = 'rgba(255, 107, 53, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.strokeRect(0, -5, DASH_MESAFE, 10);
            ctx.setLineDash([]);
            // Hedef noktada alan göstergesi
            ctx.beginPath();
            ctx.arc(DASH_MESAFE, 0, ALAN_YARICAP, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 107, 53, 0.2)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 107, 53, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    };
})();