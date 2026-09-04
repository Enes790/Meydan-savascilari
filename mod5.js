// ========== mod5.js (ÇARPIŞÇI) - GÜNCELLENMİŞ ==========
// Karakter: Çarpışçı
// Ana saldırı: Mermi atmaz, Devko menzili kadar (95) dash yapar.
// Dash sonunda 70 yarıçaplı alanda 550 hasar verir.
// Dash sırasında temas ettiği her düşmana 400 hasar verir ve +200 can kazanır.
// Alan hasarında vurduğu her düşman başına +150 can kazanır.
// Cephane: 3, dolum normalden hızlı.
// Can: 3000.

(function () {
    'use strict';

    const CHAR_ID = 'carpisci';
    const CHAR_COLOR = '#ff6b35';
    const CHAR_HP = 3000;
    const CHAR_SPEED = 4.0;

    const DASH_MESAFE = 95;
    const ALAN_HASAR = 550;
    const ALAN_YARICAP = 70;          // küçültüldü
    const DASH_HIZ = 8;
    const DASH_VURUS_HASAR = 400;     // dash temas hasarı
    const DASH_TEMAS_CAN = 200;       // dash temas canı
    const ALAN_BASINA_CAN = 150;      // alan vuruşu başına can
    const CEPhane_MAKS = 3;
    const RELOAD_SPEED = 0.025;       // normalden hızlı

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
            '<small>Hasar: 550 (alan)<br>Dash + Temas Canı</small>';
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

            p.carpisciDashKalan -= Math.hypot(dx, dy);
            p.x += dx;
            p.y += dy;
            p.x = clampPos(p.x, p.radius + WALL_THICKNESS, canvas.width - p.radius - WALL_THICKNESS);
            p.y = clampPos(p.y, p.radius + WALL_THICKNESS, canvas.height - p.radius - WALL_THICKNESS);

            getActiveEnemies().forEach(e => {
                if (e.isDead) return;
                if (!p.carpisciTemasEdilenler.includes(e) && getDist(p, e) < p.radius + e.radius) {
                    p.carpisciTemasEdilenler.push(e);
                    e.hp -= DASH_VURUS_HASAR;
                    addFloatingNumber(e.x, e.y, DASH_VURUS_HASAR, CHAR_COLOR);
                    p.hp = Math.min(p.maxHp, p.hp + DASH_TEMAS_CAN);
                    addFloatingNumber(p.x, p.y - 20, "+" + DASH_TEMAS_CAN, "#2ecc71");
                }
            });

            if (p.carpisciDashKalan <= 0) {
                p.carpisciDashAktif = false;
                // Alan hasarı
                let vurulanDusman = 0;
                getActiveEnemies().forEach(e => {
                    if (getDist(p, e) <= ALAN_YARICAP + e.radius) {
                        e.hp -= ALAN_HASAR;
                        addFloatingNumber(e.x, e.y, ALAN_HASAR, CHAR_COLOR);
                        vurulanDusman++;
                    }
                });
                if (vurulanDusman > 0) {
                    const toplamCan = vurulanDusman * ALAN_BASINA_CAN;
                    p.hp = Math.min(p.maxHp, p.hp + toplamCan);
                    addFloatingNumber(p.x, p.y - 30, "+" + toplamCan, "#2ecc71");
                }
                // Animasyonlu alan efekti: iç içe 2 genişleyen daire
                explosions.push({x: p.x, y: p.y, radius: 10, maxRadius: ALAN_YARICAP, life: 15, maxLife: 15});
                explosions.push({x: p.x, y: p.y, radius: 5, maxRadius: ALAN_YARICAP * 0.7, life: 20, maxLife: 20});
                for (let k = 0; k < 8; k++) {
                    const ang = Math.random() * Math.PI * 2;
                    const dist = Math.random() * ALAN_YARICAP;
                    spawnParticles(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, CHAR_COLOR, 'normal');
                }
                screenShake = 5;
            }
        }
    };

    // ---- Nişan çizgisi (orijinali engelle) ----
    const originalDraw = window.draw;
    window.draw = function () {
        // Çarpışçı nişan alırken orijinal çizgiyi kapat
        if (player.charType === CHAR_ID && aimData.active && player.ammo >= 1 && !player.isDead) {
            const geciciAim = aimData.active;
            aimData.active = false;
            originalDraw();
            aimData.active = geciciAim;

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
            // Hedef noktada alan göstergesi (küçültülmüş)
            ctx.beginPath();
            ctx.arc(DASH_MESAFE, 0, ALAN_YARICAP, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 107, 53, 0.2)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 107, 53, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else {
            originalDraw();
        }
    };
})();