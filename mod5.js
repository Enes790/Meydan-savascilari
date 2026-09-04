// ========== mod5.js (ÇARPIŞÇI) - SON GÜNCELLEME ==========
// Karakter: Çarpışçı
// Saldırı: Önce yerinde alan hasarı (patlama), sonra dash.
// Dash sırasında temas hasarı 400, can kazancı 50/düşman.
// Ulti: 6 saniyelik yavaşlatma alanı oluşturur.
// Ulti alanı aktifken her saldırıda alan içindeki botlar oyuncuya çekilir ve 100 hasar alır.
// Efektlerde parçacık yok, sadece patlama animasyonu (genişleyen daire).

(function () {
    'use strict';

    const CHAR_ID = 'carpisci';
    const CHAR_COLOR = '#ff6b35';
    const CHAR_HP = 3000;
    const CHAR_SPEED = 4.0;

    const DASH_MESAFE = 95;
    const BASLANGIC_ALAN_HASAR = 550;
    const BASLANGIC_ALAN_YARICAP = 70;
    const DASH_TEMAS_HASAR = 400;
    const DASH_TEMAS_CAN = 50;
    const CEPhane_MAKS = 3;
    const RELOAD_SPEED = 0.025; // hızlı

    // Ulti
    const ULTI_ALAN_YARICAP = 180;
    const ULTI_SURE = 360; // 6 saniye (60fps)
    const ULTI_YAVASLATMA_ORANI = 0.5; // %50 yavaşlatma
    const ULTI_CEKIM_HASAR = 100;
    const ULTI_CEKIM_GUCU = 30;

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
            '<small>Hasar: 550 (alan)<br>Dash + Ulti Yavaşlatma</small>';
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
            this.carpisciUltiAktif = false;
            this.carpisciUltiSure = 0;
            this.ultReady = false;
            this.ultCharge = 0;
            if (ultiBtn) {
                ultiBtn.style.display = 'flex';
                ultiBtn.classList.remove('ready');
            }
            if (gadgetBtn) gadgetBtn.style.display = 'none';
            if (gadgetBtn2) gadgetBtn2.style.display = 'none';
        }
    };

    // ---- fire override ----
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead || this.carpisciDashAktif) return;

        // 1) Başlangıç patlaması
        getActiveEnemies().forEach(e => {
            if (getDist(this, e) <= BASLANGIC_ALAN_YARICAP + e.radius) {
                e.hp -= BASLANGIC_ALAN_HASAR;
                addFloatingNumber(e.x, e.y, BASLANGIC_ALAN_HASAR, CHAR_COLOR);
            }
        });
        explosions.push({x: this.x, y: this.y, radius: 10, maxRadius: BASLANGIC_ALAN_YARICAP, life: 15, maxLife: 15});
        screenShake = 4;

        // 2) Ulti alanı aktifse çekim ve hasar
        if (this.carpisciUltiAktif) {
            getActiveEnemies().forEach(e => {
                const mesafe = getDist(this, e);
                if (mesafe <= ULTI_ALAN_YARICAP + e.radius) {
                    e.hp -= ULTI_CEKIM_HASAR;
                    addFloatingNumber(e.x, e.y, ULTI_CEKIM_HASAR, "#ff6b35");
                    const ang = getAngle(e, this); // bot -> oyuncu
                    e.kbX = Math.cos(ang) * ULTI_CEKIM_GUCU;
                    e.kbY = Math.sin(ang) * ULTI_CEKIM_GUCU;
                }
            });
        }

        // 3) Dash başlat
        this.carpisciDashAktif = true;
        this.carpisciDashYon = a;
        this.carpisciDashKalan = DASH_MESAFE;
        this.carpisciTemasEdilenler = [];
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ---- fireUlti override (nişan gerektirmez) ----
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a);
        if (!this.ultReady || this.isDead) return;

        this.carpisciUltiAktif = true;
        this.carpisciUltiSure = ULTI_SURE;
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
        addFloatingNumber(this.x, this.y - 40, "YAVAŞLATMA ALANI!", CHAR_COLOR);
    };

    // ---- chargeUlti override ----
    const originalChargeUlti = window.chargeUlti;
    window.chargeUlti = function (amount) {
        if (player.charType !== CHAR_ID) return originalChargeUlti(amount);
        if (!gameStarted || player.ultReady) return;
        player.ultCharge = Math.min(100, player.ultCharge + amount);
        if (player.ultCharge === 100) {
            player.ultReady = true;
            if (ultiBtn) ultiBtn.classList.add('ready');
            addFloatingNumber(player.x, player.y - 40, "GÜÇ HAZIR!", "#f1c40f");
        }
        if (ultFill) ultFill.style.width = player.ultCharge + "%";
    };

    // ---- window.update override ----
    const originalUpdate = window.update;
    window.update = function (ts) {
        originalUpdate(ts);
        if (!gameStarted) return;

        if (player.charType === CHAR_ID) {
            // Ulti butonunu zorla görünür tut
            if (ultiBtn && ultiBtn.style.display !== 'flex') ultiBtn.style.display = 'flex';

            // Ulti alanı süresi
            if (player.carpisciUltiAktif) {
                player.carpisciUltiSure -= ts;
                if (player.carpisciUltiSure <= 0) {
                    player.carpisciUltiAktif = false;
                    player.carpisciUltiSure = 0;
                    // Yavaşlatmayı geri al (alan bitince tüm botların hızını normale döndür)
                    getActiveEnemies().forEach(e => {
                        if (e.carpisciOrijinalHiz !== undefined) {
                            e.speed = e.carpisciOrijinalHiz;
                            delete e.carpisciOrijinalHiz;
                        }
                    });
                } else {
                    // Alan içindeki botları yavaşlat
                    getActiveEnemies().forEach(e => {
                        const mesafe = getDist(player, e);
                        if (mesafe <= ULTI_ALAN_YARICAP + e.radius) {
                            if (e.carpisciOrijinalHiz === undefined) {
                                e.carpisciOrijinalHiz = e.speed;
                            }
                            e.speed = e.carpisciOrijinalHiz * ULTI_YAVASLATMA_ORANI;
                        } else {
                            // Alan dışına çıktıysa hızını geri ver
                            if (e.carpisciOrijinalHiz !== undefined) {
                                e.speed = e.carpisciOrijinalHiz;
                                delete e.carpisciOrijinalHiz;
                            }
                        }
                    });
                }
            }

            // Dash hareketi
            if (player.carpisciDashAktif) {
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
                        e.hp -= DASH_TEMAS_HASAR;
                        addFloatingNumber(e.x, e.y, DASH_TEMAS_HASAR, CHAR_COLOR);
                        p.hp = Math.min(p.maxHp, p.hp + DASH_TEMAS_CAN);
                        addFloatingNumber(p.x, p.y - 20, "+" + DASH_TEMAS_CAN, "#2ecc71");
                    }
                });

                if (p.carpisciDashKalan <= 0) {
                    p.carpisciDashAktif = false;
                }
            }
        }
    };

    // ---- Nişan çizgisi (orijinali engelle) ----
    const originalDraw = window.draw;
    window.draw = function () {
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
            // Başlangıç alan göstergesi (patlama alanı)
            ctx.beginPath();
            ctx.arc(0, 0, BASLANGIC_ALAN_YARICAP, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 107, 53, 0.2)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 107, 53, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } else {
            originalDraw();
        }

        // Ulti alanı göstergesi (aktifken)
        if (player.charType === CHAR_ID && player.carpisciUltiAktif) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.beginPath();
            ctx.arc(0, 0, ULTI_ALAN_YARICAP, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 107, 53, 0.1)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 107, 53, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    };
})();