// ============================================================================
// KARAKTER: KUKLACI (character-kuklaci.js)
// ----------------------------------------------------------------------------
// Bu dosya ana oyun dosyasına (index.html) HİÇ dokunmadan, ayrı bir
// <script src="character-kuklaci.js"></script> etiketiyle </body>'den önce
// eklenir. Ana dosyanın kendisiyle AYNI global scope'u paylaştığı için
// (klasik <script> etiketleri, module değil) ana dosyadaki top-level
// const/let/function/class tanımlarına (player, bullets, getDist, canvas,
// chargeUlti, vb.) doğrudan erişebiliyoruz.
//
// NEDEN PROTOTİP SARMALAMA (OVERRIDE) KULLANIYORUZ:
// Ana dosyadaki GAME_EXT sistemi karakterler için sadece STAT (hp/hız/renk)
// kaydı sağlıyor; yetenek DAVRANIŞI için hook yok (bu, önceki konuşmalarda
// tespit ettiğimiz bilinen bir sınır). Bu yüzden Player.prototype.fire,
// fireUlti gibi metodları SARMALAYIP (eskisini saklayıp, sadece kendi
// charType'ımız için farklı davranıp diğer her şeyi olduğu gibi asıl
// fonksiyona yönlendirerek) çalışıyoruz. Bu kırılgan bir yöntemdir: ana
// dosya ileride bu metodları değiştirirse, bu sarmalama o değişikliği
// görmez. Karakter davranışı için gerçek bir hook sistemi eklenene kadar
// bilinen/kabul edilmiş bir risktir.
// ============================================================================

(function () {
    'use strict';

    // --- Karakter kimliği ve temel stat'lar (varsayım - istersen değiştir) ---
    const CHAR_ID = 'kuklaci';
    const CHAR_COLOR = '#8e44ad';
    const CHAR_HP = 3200;      // [VARSAYIM] belirtilmedi, orta-tank aralığına koydum
    const CHAR_SPEED = 3.6;    // [VARSAYIM] belirtilmedi, orta hız

    // --- Ana atış sabitleri (istek metninden) ---
    const MAIN_IMPACT_DAMAGE = 700;   // mermi indiği yerde direkt alan hasarı
    const MAIN_IMPACT_RADIUS = 90;
    const FIELD_DPS = 100;            // alan, saniyede 100 hasar verir
    const FIELD_DURATION_FRAMES = 120; // 2 saniye (60fps varsayımıyla)
    const FIELD_RADIUS = 90;

    // --- Ulti sabitleri ---
    const ULTI_EXPLOSION_DAMAGE = 500;  // [VARSAYIM] "patlar ve yok eder" için somut hasar, belirtilmemişti
    const ULTI_EXPLOSION_RADIUS = 130;  // [VARSAYIM]
    const PUPPET_HP = 400;
    const PUPPET_DAMAGE = 700;
    const PUPPET_ATTACK_INTERVAL = 72;  // [VARSAYIM] 1.2 saniyede bir saldırır, belirtilmemişti
    const PUPPET_SPEED = 2.5;           // [VARSAYIM]
    const PUPPET_RADIUS = 18;
    const PUPPET_SOAK_DAMAGE = 150;     // [VARSAYIM] bot mermisi kuklaya çarpınca kuklanın aldığı hasar

    // --- Karakteri stat sistemine kaydet ---
    window.GAME_EXT.characters[CHAR_ID] = { color: CHAR_COLOR, hp: CHAR_HP, speed: CHAR_SPEED };

    // --- Kendi bağımsız durum dizilerimiz (ana dosyanın bullets/botBullets dizilerinden ayrı) ---
    let kBolts = [];   // ana atış / ulti mermileri (loblu uçuş simülasyonu)
    let kZones = [];   // alan hasarı bırakan bölgeler
    let kPuppets = []; // çağrılan kukla yardımcı botlar

    // --- Hook zincirleme yardımcı fonksiyonu: başka bir script aynı hook'u
    // kullanıyorsa onu EZMEK yerine, önce onu çağırıp sonra kendimizinkini
    // ekliyoruz. Bu, ileride kule savunması gibi başka bir mod/karakter
    // script'i eklenince çakışma olmamasını sağlıyor. ---
    function chainHook(name, fn) {
        const prev = window.GAME_EXT.hooks[name];
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') prevResult = prev.apply(this, args);
            const ownResult = fn.apply(this, args);
            // checkGameOver gibi boolean dönen hook'larda ikisinden biri true ise true dönsün
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult;
        };
    }

    // ------------------------------------------------------------------
    // Player.prototype.fire SARMALAMA — ana atış
    // ------------------------------------------------------------------
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);

        // Spike'ınki gibi çekiş (pull) tabanlı hedef mesafesi hesabı
        let pullMag = Math.min(1, Math.hypot(aimData.x, aimData.y));
        if (aimData.isMouse || pullMag < 0.1) pullMag = 1;
        const targetDist = Math.max(70, pullMag * RANGE * 0.78);
        const targetX = this.x + Math.cos(a) * targetDist;
        const targetY = this.y + Math.sin(a) * targetDist;

        // Alan hâlâ aktifse (this.kFieldActive), bu atış "basit" olur:
        // sadece direkt hasar verir, yeni alan BIRAKMAZ (yığılmayı önler).
        const isSimple = !!this.kFieldActive;

        kBolts.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            targetX, targetY, flightProgress: 0, isLanded: false,
            isUlti: false, simple: isSimple
        });
        this.consumeAmmo();
    };

    // ------------------------------------------------------------------
    // Player.prototype.fireUlti SARMALAMA — kukla ordusu ultisi
    // ------------------------------------------------------------------
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a, pull) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a, pull);
        if (!this.ultReady || this.isDead) return;

        let pullMag = pull !== undefined ? Math.max(0, Math.min(1, pull)) : 1;
        const targetDist = Math.max(70, RANGE * 0.9 * pullMag);
        const tx = clampPos(this.x + Math.cos(a) * targetDist, WALL_THICKNESS + 45, canvas.width - WALL_THICKNESS - 45);
        const ty = clampPos(this.y + Math.sin(a) * targetDist, WALL_THICKNESS + 45, canvas.height - WALL_THICKNESS - 45);

        kBolts.push({
            x: this.x, y: this.y, sx: this.x, sy: this.y,
            targetX: tx, targetY: ty, flightProgress: 0, isLanded: false,
            isUlti: true, simple: false
        });
        addFloatingNumber(this.x, this.y - 40, "KUKLA ÇAĞRISI!", "#8e44ad");

        this.ultReady = false; this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ------------------------------------------------------------------
    // setCharacter SARMALAMA — kendi state alanlarımızı ilklendirmek için
    // ------------------------------------------------------------------
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            this.kFieldActive = false;
        }
    };

    // ------------------------------------------------------------------
    // chargeUlti SARMALAMA — ana dosyadaki whitelist (['spike','ninja',
    // 'hayalet','sam']) bizim charType'ımızı içermediği için ultimiz hiç
    // dolmazdı; bu yüzden bu fonksiyonu sarmalıyoruz.
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // startGame SARMALAMA — ulti butonunu bu karakter için de göster.
    // (Gadget butonları bilerek gizli kalıyor — "aksesuarlar daha sonra".)
    // ------------------------------------------------------------------
    const originalStartGame = window.startGame;
    window.startGame = function () {
        originalStartGame();
        if (selectedCharacter === CHAR_ID) {
            if (ultiBtn) ultiBtn.style.display = 'flex';
        }
        kBolts = []; kZones = []; kPuppets = [];
    };

    // ------------------------------------------------------------------
    // Karakter seçim ekranına yeni bir kart ekle (dinamik DOM enjeksiyonu,
    // ana dosyadaki 4 sabit karta hiç dokunmadan)
    // ------------------------------------------------------------------
    const charContainer = document.querySelector('.char-select-container');
    if (charContainer) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Kuklacı</span>' +
            '<small>Hasar: 700+Alan<br>Güç: Kukla Ordusu</small>';
        charContainer.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ------------------------------------------------------------------
    // onReset ZİNCİRLEME — restart/yeni oyunda kendi dizilerimizi temizle
    // ------------------------------------------------------------------
    chainHook('onReset', function () {
        kBolts = []; kZones = []; kPuppets = [];
        if (player) player.kFieldActive = false;
    });

    // ------------------------------------------------------------------
    // onDraw ZİNCİRLEME — mermi/alan/kukla görselleri
    // ------------------------------------------------------------------
    chainHook('onDraw', function (ctx2) {
        // Alanlar
        kZones.forEach(z => {
            ctx2.save();
            ctx2.translate(z.x, z.y);
            ctx2.globalAlpha = Math.min(0.5, z.life / 30);
            ctx2.beginPath(); ctx2.arc(0, 0, z.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#8e44ad'; ctx2.fill();
            ctx2.strokeStyle = '#c39bd3'; ctx2.lineWidth = 2; ctx2.setLineDash([8, 10]); ctx2.stroke();
            ctx2.restore();
        });
        // Mermiler (loblu - yükseldikçe büyüyüp gölge bırakan basit görsel)
        kBolts.forEach(b => {
            if (b.isLanded) return;
            const h = Math.sin((b.flightProgress || 0) * Math.PI);
            const scale = 1 + h * 1.1;
            ctx2.save();
            ctx2.translate(b.x, b.y + h * 22);
            ctx2.beginPath(); ctx2.ellipse(0, 22, 10, 4, 0, 0, Math.PI * 2);
            ctx2.fillStyle = 'rgba(0,0,0,0.3)'; ctx2.fill();
            ctx2.scale(scale, scale);
            ctx2.beginPath(); ctx2.arc(0, 0, b.isUlti ? 13 : 9, 0, Math.PI * 2);
            ctx2.fillStyle = b.isUlti ? '#6c3483' : '#8e44ad';
            ctx2.fill();
            ctx2.strokeStyle = '#c39bd3'; ctx2.lineWidth = 2; ctx2.stroke();
            ctx2.restore();
        });
        // Kuklalar
        kPuppets.forEach(p => {
            ctx2.save();
            ctx2.translate(p.x, p.y);
            ctx2.fillStyle = '#444'; ctx2.fillRect(-16, -p.radius - 12, 32, 4);
            ctx2.fillStyle = '#8e44ad'; ctx2.fillRect(-16, -p.radius - 12, Math.max(0, p.hp) / p.maxHp * 32, 4);
            ctx2.beginPath(); ctx2.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx2.fillStyle = '#a569bd'; ctx2.fill();
            ctx2.strokeStyle = '#5b2c6f'; ctx2.lineWidth = 3; ctx2.stroke();
            ctx2.restore();
        });
    });

    // ------------------------------------------------------------------
    // Bağımsız güncelleme döngüsü — ana oyunun requestAnimationFrame
    // döngüsünden TAMAMEN ayrı çalışır (GAME_MODE'a bağlı olmadığı için
    // her zaman, hangi mod aktif olursa olsun tıklar). gameStarted false
    // iken hiçbir şey yapmaz.
    // ------------------------------------------------------------------
    let kLastTime = 0;
    function kLoop(t) {
        if (!kLastTime) kLastTime = t;
        const ts = Math.min(3, (t - kLastTime) / 16.666);
        kLastTime = t;
        if (gameStarted) kUpdate(ts);
        requestAnimationFrame(kLoop);
    }
    requestAnimationFrame(kLoop);

    function kUpdate(ts) {
        // --- Mermileri güncelle (loblu uçuş + iniş) ---
        for (let i = kBolts.length - 1; i >= 0; i--) {
            const b = kBolts[i];
            const d = getDist(b, { x: b.targetX, y: b.targetY });
            const move = PLAYER_BULLET_SPEED * 1.3 * ts;
            if (d <= move) {
                b.x = b.targetX; b.y = b.targetY; b.isLanded = true;
                landBolt(b);
                kBolts.splice(i, 1);
            } else {
                const ang = Math.atan2(b.targetY - b.y, b.targetX - b.x);
                b.x += Math.cos(ang) * move; b.y += Math.sin(ang) * move;
                const totalDist = getDist({ x: b.sx, y: b.sy }, { x: b.targetX, y: b.targetY }) || 1;
                b.flightProgress = 1 - (d / totalDist);
            }
        }

        // --- Alanları güncelle ---
        for (let i = kZones.length - 1; i >= 0; i--) {
            const z = kZones[i];
            z.life -= ts;
            z.tickTimer = (z.tickTimer || 0) + ts;
            const doTick = z.tickTimer >= 60;
            if (doTick) z.tickTimer = 0;
            getActiveEnemies().forEach(e => {
                if (getDist(z, e) < z.radius) {
                    e.hp -= (FIELD_DPS / 60) * ts;
                    if (doTick) addFloatingNumber(e.x, e.y, FIELD_DPS, "#8e44ad");
                }
            });
            if (z.life <= 0) kZones.splice(i, 1);
        }
        if (kZones.length === 0 && player) player.kFieldActive = false;

        // --- Kuklaları güncelle ---
        for (let i = kPuppets.length - 1; i >= 0; i--) {
            const p = kPuppets[i];
            if (p.hp <= 0) {
                spawnParticles(p.x, p.y, '#8e44ad');
                kPuppets.splice(i, 1);
                continue;
            }
            // En yakın düşmanı bul
            const enemies = getActiveEnemies();
            let nearest = null, nearestDist = Infinity;
            enemies.forEach(e => {
                const dd = getDist(p, e);
                if (dd < nearestDist) { nearestDist = dd; nearest = e; }
            });
            p.attackCooldown = Math.max(0, (p.attackCooldown || 0) - ts);
            if (nearest) {
                const attackRange = p.radius + nearest.radius + 8;
                if (nearestDist > attackRange) {
                    const ang = Math.atan2(nearest.y - p.y, nearest.x - p.x);
                    p.x += Math.cos(ang) * PUPPET_SPEED * ts;
                    p.y += Math.sin(ang) * PUPPET_SPEED * ts;
                } else if (p.attackCooldown <= 0) {
                    nearest.hp -= PUPPET_DAMAGE;
                    addFloatingNumber(nearest.x, nearest.y, PUPPET_DAMAGE, "#8e44ad");
                    p.attackCooldown = PUPPET_ATTACK_INTERVAL;
                }
            }
            // Bot mermilerini "soak" et (oyuncuya gitmesi gereken mermiyi kukla üstlenir)
            for (let j = botBullets.length - 1; j >= 0; j--) {
                const bb = botBullets[j];
                if (getDist(bb, p) < p.radius + 10) {
                    p.hp -= PUPPET_SOAK_DAMAGE;
                    addFloatingNumber(p.x, p.y, PUPPET_SOAK_DAMAGE, "#e74c3c");
                    botBullets.splice(j, 1);
                    break;
                }
            }
        }
    }

    function landBolt(b) {
        spawnParticles(b.x, b.y, b.isUlti ? '#6c3483' : '#8e44ad', b.isUlti ? 'smoke' : 'normal');

        if (b.isUlti) {
            // Patlama hasarı ("patlar ve yok eder" görsel/etki karşılığı - [VARSAYIM] miktar)
            screenShake = 12;
            getActiveEnemies().forEach(e => {
                if (getDist(b, e) < ULTI_EXPLOSION_RADIUS + e.radius) {
                    e.hp -= ULTI_EXPLOSION_DAMAGE;
                    addFloatingNumber(e.x, e.y, ULTI_EXPLOSION_DAMAGE, "#6c3483");
                }
            });
            // Her aktif düşmanın olduğu yerden bir kukla çağır
            const enemiesAtCast = getActiveEnemies();
            enemiesAtCast.forEach(e => {
                kPuppets.push({
                    x: e.x, y: e.y, radius: PUPPET_RADIUS,
                    hp: PUPPET_HP, maxHp: PUPPET_HP, attackCooldown: 0
                });
            });
            addFloatingNumber(b.x, b.y - 20, "KUKLALAR GELDİ!", "#8e44ad");
            return;
        }

        // Ana atış: direkt alan hasarı
        let hitAny = false;
        getActiveEnemies().forEach(e => {
            if (getDist(b, e) < MAIN_IMPACT_RADIUS + e.radius) {
                e.hp -= MAIN_IMPACT_DAMAGE;
                addFloatingNumber(e.x, e.y, MAIN_IMPACT_DAMAGE, "#8e44ad");
                hitAny = true;
            }
        });

        // "Basit" atış (alan zaten aktifken atılan ikinci mermi) burada biter, yeni alan bırakmaz
        if (b.simple) return;

        // Yeni alan bırak, alan bitmeden atılan sonraki atışlar "basit" olacak
        kZones.push({ x: b.x, y: b.y, radius: FIELD_RADIUS, life: FIELD_DURATION_FRAMES, tickTimer: 0 });
        if (player) player.kFieldActive = true;
    }

})();
