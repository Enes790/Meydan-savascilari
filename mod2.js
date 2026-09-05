// ============================================================================
// KARAKTER: YAPRAKÇI (mod2.js)
// ----------------------------------------------------------------------------
// Ana dosyaya dokunulmadan çalışır. Ana atış DÜZ giden (loblu değil) bir
// mermi olduğu için, ana dosyanın 'bullets' dizisini KULLANMIYORUZ -
// ana dosya bilmediği bir mermi tipini (dmMap içinde tanımlı olmayan)
// hasar/temizleme açısından doğru işleyemiyor (Kuklacı'da da aynı sebeple
// kendi dizimizi kullanmıştık). Bu yüzden kendi bağımsız 'leafBullets'
// dizimiz ve güncelleme döngümüz var - düz çizgi hareketi olduğu için
// kuklacı'nınkinden çok daha basit.
// ============================================================================

(function () {
    'use strict';

    const CHAR_ID = 'yaprakci';
    const CHAR_COLOR = '#229954';
    const CHAR_HP = 2600;    // [VARSAYIM]
    const CHAR_SPEED = 4.2;  // [VARSAYIM]

    // Menzil: hayalet'in ana atışının menzili 430 - istenen "10 daha küçük" -> 420
    const LEAF_RANGE = 420;
    const LEAF_BULLET_SPEED = PLAYER_BULLET_SPEED * 0.85; // normalden biraz yavaş
    const MID_DAMAGE = 500;
    const SIDE_DAMAGE = 400;
    const SIDE_OFFSET = 25;      // yan yaprakların dikey kayma mesafesi
    const SIDE_DELAY_MS = 100;   // yan yapraklar 0.1s sonra
    const KNOCKBACK_MAG = 2;     // "çok çok çok küçük" itiş
    const LEAF_HIT_PAD = 8;      // yaprağın çarpışma toleransı

    const RAIN_COUNT = 6;
    const RAIN_SPREAD = Math.PI / 3;
    const RAIN_DAMAGE = 400;
    const RAIN_COOLDOWN_FRAMES = 900; // 15 saniye

    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    let leafBullets = []; // {x,y,sx,sy,vx,vy,dmg}

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

    function spawnLeaf(x, y, angle, dmg) {
        leafBullets.push({
            x, y, sx: x, sy: y,
            vx: Math.cos(angle) * LEAF_BULLET_SPEED, vy: Math.sin(angle) * LEAF_BULLET_SPEED,
            angle, dmg
        });
    }

    // ------------------------------------------------------------------
    // Ana atış: orta yaprak hemen, yan iki yaprak 0.1s sonra
    // ------------------------------------------------------------------
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);

        const fx = this.x, fy = this.y;
        const perpAngle = a + Math.PI / 2;

        spawnLeaf(fx, fy, a, MID_DAMAGE);
        this.consumeAmmo();

        setTimeout(() => {
            if (!gameStarted || this.isDead) return;
            [-SIDE_OFFSET, SIDE_OFFSET].forEach(off => {
                spawnLeaf(
                    fx + Math.cos(perpAngle) * off,
                    fy + Math.sin(perpAngle) * off,
                    a, SIDE_DAMAGE
                );
            });
        }, SIDE_DELAY_MS);
    };

    // ------------------------------------------------------------------
    // Yetenek (Q): Yaprak Yağmuru - geniş açılı yaprak salvosu
    // ------------------------------------------------------------------
    const originalActivateGadget = Player.prototype.activateGadget;
    Player.prototype.activateGadget = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalActivateGadget.call(this, a, pull);
        if (!this.gadgetReady || this.isDead) return;

        const angle = a !== undefined ? a : this.angle;
        for (let i = 0; i < RAIN_COUNT; i++) {
            const off = -RAIN_SPREAD / 2 + (RAIN_SPREAD / (RAIN_COUNT - 1)) * i;
            spawnLeaf(this.x, this.y, angle + off, RAIN_DAMAGE);
        }
        addFloatingNumber(this.x, this.y - 30, "YAPRAK YAĞMURU!", "#229954");
        this.gadgetReady = false;
        this.gadgetCooldown = RAIN_COOLDOWN_FRAMES;
        if (gadgetBtn) gadgetBtn.classList.add('cooldown');
    };

    // ------------------------------------------------------------------
    // Karakter seçim kartı
    // ------------------------------------------------------------------
    const charContainer = document.querySelector('.char-select-container');
    if (charContainer && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Yaprakçı</span>' +
            '<small>Hasar: 500+400x2<br>Güç: Yaprak Yağmuru</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    chainHook('onReset', function () {
        leafBullets = [];
    });

    // ------------------------------------------------------------------
    // Görsel: yaprak mermisi (ahşap sap + yeşil yaprak) + doğru menzil çizgisi.
    // "Çakışma olmasın" isteği: ana dosya, bu karakter için varsayılan
    // menzili (RANGE=300) baz alan YANLIŞ bir şerit çiziyor (gerçek menzilimiz
    // 420). Onu ana dosyadan kaldıramıyoruz ama üstüne DOĞRU uzunlukta,
    // net renkli kendi çizgimizi çiziyoruz ki karışıklık yaratmasın.
    // ------------------------------------------------------------------
    chainHook('onDraw', function (ctx2) {
        if (player.charType === CHAR_ID && !player.isDead && aimData.active && player.ammo >= 1) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(aimData.angle);
            ctx2.beginPath(); ctx2.moveTo(0, 0); ctx2.lineTo(LEAF_RANGE, 0);
            ctx2.strokeStyle = 'rgba(34, 153, 84, 0.85)'; ctx2.lineWidth = 3; ctx2.setLineDash([10, 6]);
            ctx2.stroke();
            ctx2.restore();
        }

        leafBullets.forEach(b => {
            ctx2.save();
            ctx2.translate(b.x, b.y);
            ctx2.rotate(b.angle);
            // ahşap sap
            ctx2.beginPath(); ctx2.moveTo(-11, 0); ctx2.lineTo(-4, 0);
            ctx2.strokeStyle = '#6b4226'; ctx2.lineWidth = 2; ctx2.setLineDash([]); ctx2.stroke();
            // yaprak gövdesi
            ctx2.beginPath(); ctx2.ellipse(2, 0, 9, 5, 0, 0, Math.PI * 2);
            ctx2.fillStyle = '#27ae60'; ctx2.fill();
            ctx2.strokeStyle = '#1e8449'; ctx2.lineWidth = 1.5; ctx2.stroke();
            ctx2.restore();
        });
    });

    // ------------------------------------------------------------------
    // Bağımsız güncelleme döngüsü (düz mermi hareketi + çarpışma)
    // ------------------------------------------------------------------
    let lastTimeLeaf = 0;
    function leafLoop(t) {
        if (!lastTimeLeaf) lastTimeLeaf = t;
        const ts = Math.min(3, (t - lastTimeLeaf) / 16.666);
        lastTimeLeaf = t;
        if (gameStarted) leafUpdate(ts);
        ensureLeafUI();
        requestAnimationFrame(leafLoop);
    }
    requestAnimationFrame(leafLoop);

    // Gadget butonunu bu karakter için her karede garantiye al (tek bir tıklama
    // anına bağlı kalmamak için - önceki denemede ultiBtn'in tek bir butona
    // bağlı kalması sorun çıkarmıştı, bu yüzden burada en baştan sağlam yöntemi kullanıyoruz).
    function ensureLeafUI() {
        if (!gameStarted || !gadgetBtn) return;
        if (player.charType === CHAR_ID) {
            if (gadgetBtn.style.display !== 'flex') gadgetBtn.style.display = 'flex';
            if (gadgetBtn.dataset.yaprakLabelSet !== '1') {
                gadgetBtn.innerHTML = 'YAPRAK<br>YAĞMURU<br><span id="gadget-timer"></span>';
                gadgetBtn.dataset.yaprakLabelSet = '1';
            }
        } else {
            if (gadgetBtn.dataset.yaprakLabelSet === '1') {
                gadgetBtn.dataset.yaprakLabelSet = '0';
            }
        }
    }

    function leafUpdate(ts) {
        for (let i = leafBullets.length - 1; i >= 0; i--) {
            const b = leafBullets[i];
            b.x += b.vx * ts; b.y += b.vy * ts;

            const hw = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - (WALL_THICKNESS + 5) ||
                b.y < WALL_THICKNESS + 5 || b.y > canvas.height - (WALL_THICKNESS + 5);
            const traveled = getDist({ x: b.sx, y: b.sy }, b);
            const oor = traveled > LEAF_RANGE;

            if (hw || oor) { leafBullets.splice(i, 1); continue; }

            let hit = false;
            for (const e of getActiveEnemies()) {
                if (getDist(b, e) < e.radius + LEAF_HIT_PAD) {
                    e.hp -= b.dmg;
                    addFloatingNumber(e.x, e.y, b.dmg, "#27ae60");
                    e.kbX = (e.kbX || 0) + Math.cos(b.angle) * KNOCKBACK_MAG;
                    e.kbY = (e.kbY || 0) + Math.sin(b.angle) * KNOCKBACK_MAG;
                    hit = true;
                    break;
                }
            }
            if (hit) { leafBullets.splice(i, 1); continue; }
        }
    }

})();
