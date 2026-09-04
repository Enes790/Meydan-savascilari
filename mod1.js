// ============================================================================
// KARAKTER: BUMERANGCI (mod2.js)
// ----------------------------------------------------------------------------
// Kuklacı (mod1.js) ile aynı yöntemle çalışır: Player.prototype fonksiyonlarını
// sarmalar (monkey-patch), ana dosyaya hiç dokunmaz. Kendi mermi dizisini
// (bBolts) ve kendi update/draw döngüsünü kullanır — ana dosyanın 'boomerang'
// mermi tipine veya dmMap'ine bağımlı DEĞİLDİR, o yüzden çakışma riski yok.
//
// ÖZELLİKLER:
// - Normal atış: tek bumerang, 800 hasar, gidip geri dönüyor
// - Bumerang oyuncuya geri döndüğünde: +200 can
// - Ulti: belli aralıklarla (art arda) 5 adet bumerang fırlatır, yelpaze açılı
//
// [VARSAYIM] etiketli değerler tahmini konuldu, istenirse tek satırla değişir.
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'bumerangci';           // teknik isim - kodun içinde bu kullanılır
    const CHAR_COLOR = '#16a085';           // [VARSAYIM] karakter rengi
    const CHAR_HP = 3000;                   // [VARSAYIM]
    const CHAR_SPEED = 3.4;                 // [VARSAYIM]

    const NORMAL_DAMAGE = 800;              // istenen: normal bumerang hasarı
    const NORMAL_RANGE = RANGE;             // ana dosyadaki menzil sabitini kullanır
    const NORMAL_SPEED = PLAYER_BULLET_SPEED;
    const RETURN_HEAL = 200;                // istenen: geri dönünce +200 can

    const ULTI_COUNT = 5;                   // istenen: ulti'de 5 bumerang
    const ULTI_SPREAD = Math.PI / 3;        // [VARSAYIM] 60 derecelik yelpaze
    const ULTI_STAGGER_FRAMES = 6;          // [VARSAYIM] her biri ~0.1sn arayla çıkar

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let bBolts = [];      // aktif bumerang mermileri
    let ultiQueue = [];   // ulti sırasında sırayla fırlatılacak bumerangların bekleme listesi

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

    function spawnBoomerang(angle) {
        bBolts.push({
            x: player.x, y: player.y, sx: player.x, sy: player.y,
            vx: Math.cos(angle) * NORMAL_SPEED, vy: Math.sin(angle) * NORMAL_SPEED,
            returning: false, hitTargets: []
        });
    }

    // --- Normal atış: tek bumerang ---
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        spawnBoomerang(a);
        this.consumeAmmo();
    };

    // --- Ulti: 5 bumerang, aralıklı, yelpaze açılı ---
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pullOverride);
        if (!this.ultReady || this.isDead) return;

        for (let i = 0; i < ULTI_COUNT; i++) {
            const ang = a + (-ULTI_SPREAD / 2) + (ULTI_SPREAD / (ULTI_COUNT - 1)) * i;
            ultiQueue.push({ angle: ang, framesLeft: i * ULTI_STAGGER_FRAMES });
        }
        addFloatingNumber(this.x, this.y - 40, "BUMERANG YAĞMURU!", CHAR_COLOR);

        this.ultReady = false; this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // --- Ulti şarjı: ana dosyanın listesi bu karakteri tanımadığı için sarmalamak gerekiyor ---
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

    // --- Ulti tuşunun görünmesi: startGame listesine bu karakter dahil değil, elle açıyoruz ---
    const originalStartGame = window.startGame;
    window.startGame = function () {
        originalStartGame();
        if (selectedCharacter === CHAR_ID && ultiBtn) ultiBtn.style.display = 'flex';
        bBolts = []; ultiQueue = [];
    };

    // --- Karakter seçim kartı ---
    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Bumerangcı</span>' +
            '<small>Hasar: 800<br>Güç: 5\'li Bumerang</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    chainHook('onReset', function () {
        bBolts = []; ultiQueue = [];
    });

    // --- Çizim: bumerangları döndürerek çiz ---
    chainHook('onDraw', function (ctx2) {
        bBolts.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(Date.now() / 100);
            ctx2.beginPath();
            ctx2.moveTo(15, 0); ctx2.lineTo(-10, 10); ctx2.lineTo(-5, 0); ctx2.lineTo(-10, -10);
            ctx2.closePath();
            ctx2.fillStyle = CHAR_COLOR;
            ctx2.fill();
            ctx2.strokeStyle = '#ffffff';
            ctx2.lineWidth = 1;
            ctx2.stroke();
            ctx2.restore();
        });
    });

    // --- Kendi bağımsız güncelleme döngüsü (ana dosyanın bullets dizisine hiç dokunmuyor) ---
    let bLastTime = 0;
    function bLoop(t) {
        if (!bLastTime) bLastTime = t;
        const ts = Math.min(3, (t - bLastTime) / 16.666);
        bLastTime = t;
        if (gameStarted) bUpdate(ts);
        requestAnimationFrame(bLoop);
    }
    requestAnimationFrame(bLoop);

    function bUpdate(ts) {
        // Ulti kuyruğu: sırayla, aralıklı fırlatma
        for (let i = ultiQueue.length - 1; i >= 0; i--) {
            const q = ultiQueue[i];
            q.framesLeft -= ts;
            if (q.framesLeft <= 0) {
                spawnBoomerang(q.angle);
                ultiQueue.splice(i, 1);
            }
        }

        for (let i = bBolts.length - 1; i >= 0; i--) {
            const b = bBolts[i];

            if (!b.returning) {
                b.x += b.vx * ts; b.y += b.vy * ts;
                const outOfRange = getDist(b, { x: b.sx, y: b.sy }) > NORMAL_RANGE;
                const hitWall = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5 ||
                                 b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                if (outOfRange || hitWall) {
                    b.returning = true;
                    b.hitTargets = []; // dönüş yolunda tekrar vurabilsin diye sıfırlanıyor
                }
            } else {
                const ang = getAngle(b, player);
                b.vx = Math.cos(ang) * NORMAL_SPEED;
                b.vy = Math.sin(ang) * NORMAL_SPEED;
                b.x += b.vx * ts; b.y += b.vy * ts;
                if (getDist(b, player) < player.radius + 15) {
                    player.hp = Math.min(player.maxHp, player.hp + RETURN_HEAL);
                    addFloatingNumber(player.x, player.y, "+" + RETURN_HEAL, "#2ecc71");
                    bBolts.splice(i, 1);
                    continue;
                }
            }

            getActiveEnemies().forEach(e => {
                if (b.hitTargets.includes(e)) return;
                if (getDist(b, e) < e.radius + 12) {
                    e.hp -= NORMAL_DAMAGE;
                    addFloatingNumber(e.x, e.y, NORMAL_DAMAGE, CHAR_COLOR);
                    b.hitTargets.push(e);
                }
            });
        }
    }

})();
