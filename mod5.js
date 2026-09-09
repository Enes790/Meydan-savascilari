// ========== mod9.js (KÜL) - AURALI CAN EMİCİ ==========
// - Kısa menzilli iki mermi atar (600 + 300 delici).
// - Aura: 70 birim yarıçap, hasar vermez, içindeki her düşman başına
//   saniyede 100 can kazandırır.
// - Ulti: anında 200 can verir, 1 saniye sonra aura patlar,
//   1000 hasar + Buz Botu kadar savurma.
// - Tema: sıcaklık / kül. Renk: koyu gri-turuncu.
// - Mimari: IIFE içinde, zincirleme hook'lar, bağımsız mermi dizisi.

(function () {
    'use strict';

    const CHAR_ID = 'kul';
    const CHAR_COLOR = '#4a4a4a';
    const CHAR_ACCENT = '#d35400';
    const CHAR_HP = 2800;
    const CHAR_SPEED = 3.8;

    // Saldırı
    const SALDIRI_MENZILI = 95;           // Devko yumruğu kadar
    const ILK_MERMI_HASAR = 600;
    const IKINCI_MERMI_HASAR = 300;
    const IKINCI_MERMI_DELME = 2;          // kaç düşmanı delebilir
    const MERMI_ARALIK_MS = 100;           // 0.1 saniye
    const MERMI_BOYUT = 8;                // mermi yarıçapı (artırıldı)

    // Aura
    const AURA_YARICAP = 70;
    const AURA_CAN_KAZANIM = 100;          // saniyede düşman başına

    // Ulti
    const ULTI_ANINDA_CAN = 200;
    const ULTI_GECIKME = 60;               // 1 saniye (60 frame)
    const ULTI_PATLAMA_HASAR = 1000;
    const ULTI_SAVURMA = 40;               // Buz Botu kadar
    const ULTI_PATLAMA_YARICAP = 100;

    window.GAME_EXT.characters[CHAR_ID] = {
        color: CHAR_COLOR,
        hp: CHAR_HP,
        speed: CHAR_SPEED
    };

    // Kendi mermi dizimiz (ana oyunun bilmediği tipler için güvenli)
    let kulMermileri = [];

    // Zincirleme hook yardımcısı (core.js'te yoksa diye kendi içinde de tanımlı)
    function chainHook(name, fn) {
        const prev = window.GAME_EXT && window.GAME_EXT.hooks ? window.GAME_EXT.hooks[name] : undefined;
        window.GAME_EXT = window.GAME_EXT || { hooks: {} };
        window.GAME_EXT.hooks = window.GAME_EXT.hooks || {};
        window.GAME_EXT.hooks[name] = function (...args) {
            let prevResult;
            if (typeof prev === 'function') {
                prevResult = prev.apply(this, args);
            }
            const ownResult = fn.apply(this, args);
            if (typeof prevResult === 'boolean' || typeof ownResult === 'boolean') {
                return !!prevResult || !!ownResult;
            }
            return ownResult !== undefined ? ownResult : prevResult;
        };
    }

    // ========== KARAKTER KARTI ==========
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-' + CHAR_ID)) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-' + CHAR_ID;
        card.innerHTML =
            '<div class="char-color-preview" style="background:' + CHAR_COLOR + ';"></div>' +
            '<span>Kül</span>' +
            '<small>Hasar: 600+300<br>Aura: Can emme<br>Güç: Aura Patlaması</small>';
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = CHAR_ID;
            document.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
            card.classList.add('selected');
        });
    }

    // ========== setCharacter OVERRIDE ==========
    const originalSetCharacter = Player.prototype.setCharacter;
    Player.prototype.setCharacter = function (type) {
        originalSetCharacter.call(this, type);
        if (type === CHAR_ID) {
            // Aura ve ulti state'lerini sıfırla
            this.kulUltiZamanlayici = 0;
            this.kulUltiAktif = false;
            kulMermileri = [];
            // Butonları ayarla
            if (gadgetBtn) gadgetBtn.style.display = 'none'; // aksesuar yok şimdilik
            if (gadgetBtn2) gadgetBtn2.style.display = 'none';
            if (ultiBtn) ultiBtn.style.display = 'flex';
        }
    };

    // ========== FIRE OVERRIDE ==========
    const originalFire = Player.prototype.fire;
    Player.prototype.fire = function (a, pullOverride) {
        if (this.charType !== CHAR_ID) return originalFire.call(this, a, pullOverride);
        if (this.ammo < 1 || this.isDead) return;

        const fx = this.x, fy = this.y;
        const sp = PLAYER_BULLET_SPEED * 1.1;

        // İlk mermi: 600 hasar
        kulMermileri.push({
            x: fx, y: fy,
            sx: fx, sy: fy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            hasar: ILK_MERMI_HASAR,
            delmeHakki: 0,          // ilk mermi delmez
            isDead: false,
            angle: a,
            age: 0
        });

        // İkinci mermi: 300 hasar, 2 düşmanı delebilir, 0.1 saniye sonra
        setTimeout(() => {
            if (!gameStarted || this.isDead) return;
            kulMermileri.push({
                x: fx, y: fy,
                sx: fx, sy: fy,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                hasar: IKINCI_MERMI_HASAR,
                delmeHakki: IKINCI_MERMI_DELME,
                isDead: false,
                angle: a,
                age: 0
            });
        }, MERMI_ARALIK_MS);

        this.consumeAmmo();
        this.lastShotTime = Date.now();
    };

    // ========== FIREULTI OVERRIDE ==========
    const originalFireUlti = Player.prototype.fireUlti;
    Player.prototype.fireUlti = function (a) {
        if (this.charType !== CHAR_ID) return originalFireUlti.call(this, a);
        if (!this.ultReady || this.isDead) return;

        // Anında can ver
        this.hp = Math.min(this.maxHp, this.hp + ULTI_ANINDA_CAN);
        addFloatingNumber(this.x, this.y - 30, "+" + ULTI_ANINDA_CAN, "#2ecc71");

        // Zamanlayıcıyı başlat
        this.kulUltiZamanlayici = ULTI_GECIKME;
        this.kulUltiAktif = true;
        addFloatingNumber(this.x, this.y - 40, "KÜL PATLAMASI YAKLAŞIYOR!", CHAR_ACCENT);

        // Ulti barını sıfırla
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    };

    // ========== UPDATE (onUpdate hook) ==========
    chainHook('onUpdate', function (ts) {
        if (!gameStarted || player.charType !== CHAR_ID) return;

        // Aura can kazanımı
        let toplamCan = 0;
        getActiveEnemies().forEach(e => {
            if (getDist(player, e) <= AURA_YARICAP + e.radius) {
                toplamCan += (AURA_CAN_KAZANIM / 60) * ts;
            }
        });
        if (toplamCan > 0) {
            player.hp = Math.min(player.maxHp, player.hp + toplamCan);
            // Saniyede bir toplam kazancı göster (bot başı 100 can/sn)
            if (!player._kulCanYazisiZaman || Date.now() - player._kulCanYazisiZaman > 1000) {
                addFloatingNumber(player.x, player.y - 20, "+" + Math.floor(toplamCan * 60), "#2ecc71");
                player._kulCanYazisiZaman = Date.now();
            }
        }

        // Ulti gecikmesi
        if (player.kulUltiAktif) {
            player.kulUltiZamanlayici -= ts;
            if (player.kulUltiZamanlayici <= 0) {
                player.kulUltiAktif = false;
                patlatAura();
            }
        }

        // Kendi mermilerimizi güncelle
        for (let i = kulMermileri.length - 1; i >= 0; i--) {
            const m = kulMermileri[i];
            if (m.isDead) { kulMermileri.splice(i, 1); continue; }

            m.age += ts;
            m.x += m.vx * ts;
            m.y += m.vy * ts;

            // Menzil kontrolü
            if (getDist({x: m.sx, y: m.sy}, m) > SALDIRI_MENZILI) {
                m.isDead = true;
                continue;
            }

            // Duvar kontrolü
            if (m.x < WALL_THICKNESS + 5 || m.x > canvas.width - WALL_THICKNESS - 5 ||
                m.y < WALL_THICKNESS + 5 || m.y > canvas.height - WALL_THICKNESS - 5) {
                m.isDead = true;
                continue;
            }

            // Engel kontrolü
            let hitObs = false;
            for (const o of obstacles.concat(cactusWalls || [])) {
                if (getDist(m, o) < o.radius + 6) {
                    hitObs = true;
                    break;
                }
            }
            if (hitObs) { m.isDead = true; continue; }

            // Düşman çarpışma
            let hedefVuruldu = false;
            getActiveEnemies().forEach(e => {
                if (m.isDead || hedefVuruldu) return;
                if (getDist(m, e) < e.radius + 8) {
                    e.hp -= m.hasar;
                    addFloatingNumber(e.x, e.y, m.hasar, CHAR_ACCENT);
                    if (m.delmeHakki > 0) {
                        m.delmeHakki--;
                        // Delme: hedefi atla, devam et
                        hedefVuruldu = false; // delme var, başka düşmana da çarpabilir
                        // Aynı düşmana tekrar vurmamak için hitTargets
                        if (!m.hitTargets) m.hitTargets = [];
                        m.hitTargets.push(e);
                    } else {
                        hedefVuruldu = true;
                        m.isDead = true;
                    }
                }
            });
            // Eğer delme bitti ama hâlâ hayattaysa, m.isDead zaten true yapıldı
        }
    });

    // ========== RESET HOOK ==========
    chainHook('onReset', function () {
        kulMermileri = [];
        if (player) {
            player.kulUltiAktif = false;
            player.kulUltiZamanlayici = 0;
        }
    });

    // ========== DRAW HOOK ==========
    chainHook('onDraw', function (ctx2) {
        if (!gameStarted || player.charType !== CHAR_ID) return;

        // Aura çizimi
        const auraAlpha = 0.2 + Math.sin(Date.now() / 300) * 0.05;
        ctx2.save();
        ctx2.translate(player.x, player.y);
        ctx2.beginPath();
        ctx2.arc(0, 0, AURA_YARICAP, 0, Math.PI * 2);
        ctx2.fillStyle = `rgba(211, 84, 0, ${auraAlpha})`;
        ctx2.fill();
        ctx2.strokeStyle = `rgba(211, 84, 0, 0.6)`;
        ctx2.lineWidth = 2;
        ctx2.stroke();
        // İç halka
        ctx2.beginPath();
        ctx2.arc(0, 0, AURA_YARICAP * 0.7, 0, Math.PI * 2);
        ctx2.strokeStyle = `rgba(211, 84, 0, 0.3)`;
        ctx2.lineWidth = 1;
        ctx2.stroke();
        ctx2.restore();

        // Mermileri çiz (boyut artırıldı)
        kulMermileri.forEach(m => {
            ctx2.save();
            ctx2.translate(m.x, m.y);
            ctx2.rotate(m.angle);
            ctx2.fillStyle = m.delmeHakki > 0 ? CHAR_ACCENT : '#a04000';
            ctx2.beginPath();
            ctx2.arc(0, 0, MERMI_BOYUT, 0, Math.PI * 2); // artırılmış boyut
            ctx2.fill();
            // Küçük iz
            ctx2.fillStyle = 'rgba(255,255,255,0.3)';
            ctx2.beginPath();
            ctx2.arc(2, 0, MERMI_BOYUT * 0.4, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.restore();
        });

        // Ulti yaklaşırken uyarı
        if (player.kulUltiAktif) {
            const kalan = player.kulUltiZamanlayici / 60;
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.globalAlpha = 0.7;
            ctx2.beginPath();
            ctx2.arc(0, 0, AURA_YARICAP + 20, 0, Math.PI * 2);
            ctx2.strokeStyle = '#e74c3c';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#e74c3c';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(kalan.toFixed(1), 0, -AURA_YARICAP - 25);
            ctx2.restore();
        }
    });

    // ========== NİŞAN ÇİZGİSİ (Özel) ==========
    // Kül'ün menzili kısa olduğu için ana oyunun standart uzun çizgisi uygun değil.
    // Taşçı'daki gibi onPreDraw/onAimDraw/onPostDraw kullanarak kısa menzil çizgisi çiziyoruz.
    chainHook('onPreDraw', function (ctx2) {
        if (player.charType === CHAR_ID && aimData.active && !player.isDead) {
            player._kulAimGeriGetir = true;
            aimData.active = false;
        }
    });

    chainHook('onAimDraw', function (ctx2) {
        if (player.charType === CHAR_ID && player._kulAimGeriGetir && player.ammo >= 1 && !player.isDead) {
            ctx2.save();
            ctx2.translate(player.x, player.y);
            ctx2.rotate(aimData.angle);
            // Kısa menzil çizgisi
            ctx2.fillStyle = 'rgba(211, 84, 0, 0.15)';
            ctx2.fillRect(0, -5, SALDIRI_MENZILI, 10);
            ctx2.strokeStyle = 'rgba(211, 84, 0, 0.8)';
            ctx2.lineWidth = 2;
            ctx2.setLineDash([5, 5]);
            ctx2.strokeRect(0, -5, SALDIRI_MENZILI, 10);
            ctx2.setLineDash([]);
            // Hedef noktası
            ctx2.beginPath();
            ctx2.arc(SALDIRI_MENZILI, 0, 6, 0, Math.PI * 2);
            ctx2.fillStyle = CHAR_ACCENT;
            ctx2.fill();
            ctx2.restore();
        }
    });

    chainHook('onPostDraw', function (ctx2) {
        if (player._kulAimGeriGetir) {
            aimData.active = true;
            player._kulAimGeriGetir = false;
        }
    });

    // ========== PATLAMA FONKSİYONU ==========
    function patlatAura() {
        const p = player;
        // Görsel efekt
        explosions.push({x: p.x, y: p.y, radius: 10, maxRadius: ULTI_PATLAMA_YARICAP, life: 15, maxLife: 15});
        for (let k = 0; k < 12; k++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * ULTI_PATLAMA_YARICAP;
            spawnParticles(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, CHAR_ACCENT, 'normal');
        }
        screenShake = 10;
        addFloatingNumber(p.x, p.y - 30, "KÜL PATLAMASI!", CHAR_ACCENT);

        // Hasar ve savurma
        getActiveEnemies().forEach(e => {
            const d = getDist(p, e);
            if (d <= ULTI_PATLAMA_YARICAP + e.radius) {
                e.hp -= ULTI_PATLAMA_HASAR;
                addFloatingNumber(e.x, e.y, ULTI_PATLAMA_HASAR, "#e74c3c");
                const ang = getAngle(p, e);
                e.kbX = Math.cos(ang) * ULTI_SAVURMA;
                e.kbY = Math.sin(ang) * ULTI_SAVURMA;
            }
        });
    }

    console.log('[MOD YÜKLENDİ]', CHAR_ID);
})();