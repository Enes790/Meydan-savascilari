// ============================================================================
// KARAKTER: FÜNYECİ (mod3.js) — v2, Taşçı yapısına uygun yeniden yazıldı
// ----------------------------------------------------------------------------
// NOT: Taşçı örneğindeki 'onPreDraw' / 'onAimDraw' / 'onPostDraw' kancaları
// ana dosyada HİÇ ÇAĞRILMIYOR (sadece 'onDraw' gerçek ve çalışıyor) - o yüzden
// burada SADECE gerçekten çalışan 'onDraw' kancası kullanıldı, nişan çizgisini
// "bastırma" numarası hiç denenmedi (çalışmayacağı için).
//
// MEKANİK (değişmedi):
// - Normal atış: düz giden, sınırsız düşmana değebilen (delici) mermi,
//   her değdiği düşmana 200 hasar verir.
// - Mermi havadayken tekrar ateş tuşuna basılırsa, o anki konumunda patlar:
//   23 yarıçapında alan, 800 hasar.
// - Tetiklenmezse menzilin sonunda sessizce kaybolur.
//
// GÜNCELLENEN DEĞERLER:
// - Mermi hızı: 0.75x (Taşçı'nın 0.6x'inden hızlı, tam hızdan biraz yavaş)
// - Menzil: 252 (Taşçı'nın 126'sının 2 katı, Hortlak'ın 430'undan kısa)
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'funyeci';
    const CHAR_COLOR = '#c0392b';        // [VARSAYIM]
    const CHAR_HP = 3000;                // [VARSAYIM]
    const CHAR_SPEED = 3.2;              // [VARSAYIM]

    const PIERCE_DAMAGE = 200;
    const EXPLOSION_RADIUS = 23;         // ninja alanı 114'ün %20'si
    const EXPLOSION_DAMAGE = 800;
    const BULLET_SPEED = PLAYER_BULLET_SPEED * 0.75; // Taşçı'nın 0.6'sından hızlı
    const BULLET_RANGE = 252;                        // Taşçı'nın (126) 2 katı

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let funBullets = []; // aynı anda en fazla 1 eleman olacak

    // ---- Karakter kartı ----
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Fünyeci</span>' +
            '<small>Hasar: 200 (delici)<br>Tekrar bas: Patlat (800)</small>';
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
            funBullets = [];
            this.funMermiAktif = false;
        }
    };

    // ---- Fire override ----
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;

        if (this.funMermiAktif) {
            // mermi zaten havada - tekrar basınca patlat, yeni mermi ATMA
            detonateActiveBullet();
            return;
        }

        funBullets.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
            rotasyon: Math.random() * Math.PI * 2,
            hitTargets: []
        });
        this.funMermiAktif = true;
        this.consumeAmmo();
    };

    function explodeAt(x, y) {
        explosions.push({ x, y, radius: 5, maxRadius: EXPLOSION_RADIUS, life: 15, maxLife: 15 });
        spawnParticles(x, y, CHAR_COLOR, 'smoke');
        screenShake = 10;
        getActiveEnemies().forEach(e => {
            if (getDist({ x, y }, e) < EXPLOSION_RADIUS + e.radius) {
                e.hp -= EXPLOSION_DAMAGE;
                addFloatingNumber(e.x, e.y, EXPLOSION_DAMAGE, CHAR_COLOR);
            }
        });
        addFloatingNumber(x, y - 20, "PATLADI!", "#f1c40f");
    }

    function detonateActiveBullet() {
        if (funBullets.length === 0) return;
        const b = funBullets[0];
        explodeAt(b.x, b.y);
        funBullets.splice(0, 1);
        if (player.charType === CHAR_ID) player.funMermiAktif = false;
    }

    // ---- Reset hook ----
    chainHook('onReset', function () {
        funBullets = [];
        if (player) player.funMermiAktif = false;
    });

    // ---- Draw hook (gerçekten çalışan tek çizim kancası) ----
    chainHook('onDraw', function (ctx2) {
        funBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.rotasyon + Date.now() / 150);
            ctx2.beginPath();
            ctx2.arc(0, 0, 8, 0, Math.PI * 2);
            ctx2.fillStyle = CHAR_COLOR;
            ctx2.fill();
            ctx2.strokeStyle = '#f1c40f';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // fitil çizgisi - görsel tema
            ctx2.rotate(-(b.rotasyon + Date.now() / 150)); // döndürmeyi geri al, fitil sabit dursun
            ctx2.beginPath();
            ctx2.moveTo(-8, 0); ctx2.lineTo(-14, 0);
            ctx2.strokeStyle = '#f1c40f'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });
    });

    // ---- Bağımsız güncelleme döngüsü ----
    let lastTime = 0;
    function fLoop(t) {
        if (!lastTime) lastTime = t;
        const ts = Math.min(3, (t - lastTime) / 16.666);
        lastTime = t;
        if (gameStarted) fUpdate(ts);
        requestAnimationFrame(fLoop);
    }
    requestAnimationFrame(fLoop);

    function fUpdate(ts) {
        for (let i = funBullets.length - 1; i >= 0; i--) {
            const b = funBullets[i];
            b.x += b.vx * ts; b.y += b.vy * ts;

            const outOfRange = getDist(b, { x: b.sx, y: b.sy }) > BULLET_RANGE;
            const hitWall = b.x < WALL_THICKNESS || b.x > canvas.width - WALL_THICKNESS ||
                             b.y < WALL_THICKNESS || b.y > canvas.height - WALL_THICKNESS;

            if (outOfRange || hitWall) {
                funBullets.splice(i, 1);
                if (player.charType === CHAR_ID) player.funMermiAktif = false;
                continue;
            }

            getActiveEnemies().forEach(e => {
                if (b.hitTargets.includes(e)) return;
                if (getDist(b, e) < e.radius + 10) {
                    e.hp -= PIERCE_DAMAGE;
                    addFloatingNumber(e.x, e.y, PIERCE_DAMAGE, CHAR_COLOR);
                    b.hitTargets.push(e);
                }
            });
        }
    }

})();
