// ============================================================================
// KARAKTER: FÜNYECİ (mod3.js)
// ----------------------------------------------------------------------------
// MEKANİK:
// - Normal atış: düz giden, SINIRSIZ düşmana değebilen (delici) bir mermi.
//   Her değdiği düşmana 200 hasar verir, durmadan devam eder.
// - Mermi havadayken (menzilin sonuna ulaşmadan) tekrar ateş tuşuna basılırsa,
//   mermi o anki konumunda PATLAR: ninja'nın alan yeteneğinin (114) %20'si
//   kadar bir yarıçapta (23), 800 hasar veren bir alan patlaması yapar.
// - Tetiklenmezse mermi menzilin sonuna ulaşınca patlamadan sessizce kaybolur.
// - Aynı anda sadece BİR mermi olabilir - mermi bitmeden yeni atış yapılamaz,
//   sadece "patlat" tetiklenebilir.
//
// [VARSAYIM] etiketli değerler tahmini konuldu.
// NOT: Bu karakter için şimdilik ULTİ eklenmedi (istenirse ayrıca eklenir).
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'funyeci';
    const CHAR_COLOR = '#c0392b';        // [VARSAYIM]
    const CHAR_HP = 3000;                // [VARSAYIM]
    const CHAR_SPEED = 3.2;              // [VARSAYIM]

    const PIERCE_DAMAGE = 200;
    const EXPLOSION_RADIUS = 23;         // ninja alanı 114'ün %20'si (22.8, yuvarlandı)
    const EXPLOSION_DAMAGE = 800;
    const BULLET_SPEED = PLAYER_BULLET_SPEED;
    const BULLET_RANGE = RANGE;

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let funBullets = []; // aynı anda en fazla 1 eleman olacak

    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    function spawnPiercingBullet(angle) {
        funBullets.push({
            x: player.x, y: player.y, sx: player.x, sy: player.y,
            vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
            hitTargets: []
        });
    }

    function explodeAt(x, y) {
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

    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);

        if (this.funMermiAktif) {
            // mermi zaten havada - tekrar basınca patlat, yeni mermi ATMA
            detonateActiveBullet();
        } else {
            spawnPiercingBullet(a);
            this.funMermiAktif = true;
            this.consumeAmmo();
        }
    };

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            funBullets = [];
            this.funMermiAktif = false;
        }
    };

    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Fünyeci</span>' +
            '<small>Hasar: 200 (delici)<br>Tekrar bas: Patlat (800)</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    chainHook('onReset', function () {
        funBullets = [];
        if (player) player.funMermiAktif = false;
    });

    chainHook('onDraw', function (ctx2) {
        funBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(Math.atan2(b.vy, b.vx));
            ctx2.beginPath();
            ctx2.arc(0, 0, 8, 0, Math.PI * 2);
            ctx2.fillStyle = CHAR_COLOR;
            ctx2.fill();
            ctx2.strokeStyle = '#f1c40f';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // küçük bir "fitil" çizgisi - görsel tema için
            ctx2.beginPath();
            ctx2.moveTo(-8, 0); ctx2.lineTo(-14, 0);
            ctx2.strokeStyle = '#f1c40f'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });
    });

    let fLastTime = 0;
    function fLoop(t) {
        if (!fLastTime) fLastTime = t;
        const ts = Math.min(3, (t - fLastTime) / 16.666);
        fLastTime = t;
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
