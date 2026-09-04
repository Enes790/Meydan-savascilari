// ============================================================================
// KARAKTER: BUMERANGCI (mod2.js) — v3 (düzeltmeler)
// ----------------------------------------------------------------------------
// BU SÜRÜMDE DÜZELTİLENLER:
// 1) Ulti tuşu artık KESİN görünüyor: ana dosyanın startGame fonksiyonu
//    ultiBtn'i "bumerangci" listede olmadığı için senkron şekilde tekrar
//    gizliyordu. Artık her karede (bUpdate içinde) zorla açık tutuluyor,
//    ana kodun gizlemesine rağmen bir sonraki karede geri düzeltiliyor.
// 2) Gidiş hasarı: 650 -> 300
// 3) Dönüş hasarı: yeni eklendi, 700 (önceden dönüşte hiç hasar yoktu)
// 4) Bumerang artık çarptığı engele (obstacles/cactusWalls) hasar veriyor
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'bumerangci';
    const CHAR_COLOR = '#16a085';           // [VARSAYIM]
    const CHAR_HP = 3000;                   // [VARSAYIM]
    const CHAR_SPEED = 3.4;                 // [VARSAYIM]

    const OUTBOUND_DAMAGE = 300;            // güncellendi: gidiş hasarı
    const RETURN_DAMAGE = 700;              // yeni: dönüş hasarı
    const OBSTACLE_DAMAGE = 200;            // [VARSAYIM] engele verilen hasar
    const NORMAL_RANGE = RANGE;
    const NORMAL_SPEED = PLAYER_BULLET_SPEED;
    const RETURN_HEAL = 200;
    const MAX_HITS_BEFORE_RETURN = 3;       // gidişte 3 düşmana vurunca döner

    const ULTI_COUNT = 5;
    const ULTI_SPREAD = Math.PI / 3;        // [VARSAYIM]
    const ULTI_STAGGER_FRAMES = 6;          // [VARSAYIM]

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let bBolts = [];
    let ultiQueue = [];

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

    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        spawnBoomerang(a);
        this.consumeAmmo();
    };

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

    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) { bBolts = []; ultiQueue = []; }
    };

    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Bumerangcı</span>' +
            '<small>Hasar: 300 / 700<br>Güç: 5\'li Bumerang</small>';
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
        // DÜZELTME 1: ana kodun her karede gizlemesine karşı, burada zorla açık tutuluyor
        if (player.charType === CHAR_ID && ultiBtn && ultiBtn.style.display !== 'flex') {
            ultiBtn.style.display = 'flex';
        }

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

                // DÜZELTME 4: çarptığı engele hasar veriyor
                let hitObstacle = false;
                for (const o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) {
                        o.hp -= OBSTACLE_DAMAGE;
                        hitObstacle = true;
                        break;
                    }
                }

                if (outOfRange || hitWall || hitObstacle) {
                    b.returning = true;
                    b.hitTargets = [];
                }

                if (!b.returning) {
                    getActiveEnemies().forEach(e => {
                        if (b.hitTargets.includes(e)) return;
                        if (getDist(b, e) < e.radius + 12) {
                            e.hp -= OUTBOUND_DAMAGE;
                            addFloatingNumber(e.x, e.y, OUTBOUND_DAMAGE, CHAR_COLOR);
                            b.hitTargets.push(e);
                            if (b.hitTargets.length >= MAX_HITS_BEFORE_RETURN) {
                                b.returning = true;
                                b.hitTargets = [];
                            }
                        }
                    });
                }
            } else {
                const ang = getAngle(b, player);
                b.vx = Math.cos(ang) * NORMAL_SPEED;
                b.vy = Math.sin(ang) * NORMAL_SPEED;
                b.x += b.vx * ts; b.y += b.vy * ts;

                // DÜZELTME 3: dönüş sırasında da hasar veriyor
                getActiveEnemies().forEach(e => {
                    if (b.hitTargets.includes(e)) return;
                    if (getDist(b, e) < e.radius + 12) {
                        e.hp -= RETURN_DAMAGE;
                        addFloatingNumber(e.x, e.y, RETURN_DAMAGE, "#e67e22");
                        b.hitTargets.push(e);
                    }
                });

                if (getDist(b, player) < player.radius + 15) {
                    player.hp = Math.min(player.maxHp, player.hp + RETURN_HEAL);
                    addFloatingNumber(player.x, player.y, "+" + RETURN_HEAL, "#2ecc71");
                    bBolts.splice(i, 1);
                    continue;
                }
            }
        }
    }

})();
