// ========== korku-core.js — KORKU MODU MOTORU ==========
// Ortak mekanikler: kamera, karanlık, gözcü AI, oda sistemi.
// Bölümler bu motora odaKaydet ile kendi odalarını ekler.

(function () {
    'use strict';

    const WALL_THICKNESS = 30;
    const CAMERA_ZOOM = 0.85;
    const CAMERA_LERP = 4;
    const GORUS_ACIK = 260;
    const GORUS_KAPALI = 90;

    // ========== DURUM ==========
    const KORKU = {
        aktif: false,
        oda: null,
        odaId: null,
        odalar: {},
        oyuncu: null,
        gozcu: null,
        kamera: { x: 0, y: 0 },
        fener: true,
        kameraShake: 0
    };
    window.KORKU = KORKU;

    // Görüş yarıçapı (sorgu fonksiyonu)
    KORKU.gorusYaricap = function () {
        return KORKU.fener ? GORUS_ACIK : GORUS_KAPALI;
    };

    // Kamera sarsıntısı tetikle
    KORKU.sarsinti = function (miktar) {
        KORKU.kameraShake = Math.max(KORKU.kameraShake, miktar);
    };

    // ========== ODA SİSTEMİ ==========
    KORKU.odaKaydet = function (id, odaObj) {
        KORKU.odalar[id] = odaObj;
    };

    KORKU.odaYukle = function (id) {
        const oda = KORKU.odalar[id];
        if (!oda) { console.warn('Oda bulunamadı:', id); return; }
        KORKU.oda = oda;
        KORKU.odaId = id;
        if (typeof oda.baslangic === 'function') oda.baslangic();
        console.log('[KORKU] Oda yüklendi:', id);
    };

    // ========== FENER AÇ/KAPA ==========
    window.KORKU_fenerDegistir = function () {
        KORKU.fener = !KORKU.fener;
    };

    // ========== MOD KAYDI ==========
    window.GAME_EXT.registerMode('korku', {
        label: 'Korku',
        tamEkranModu: true,
        onStart: function () {
            KORKU.aktif = true;
            KORKU.fener = true;
            KORKU.kameraShake = 0;
            // Klasik botları devre dışı bırak
            bot.isActive = false; bot.isDead = true;
            bot2.isActive = false; bot2.isDead = true;
            slimeBots = []; stationaryBots = []; boomerangBots = [];
            fogBots = []; nests = []; spawnIndicators = [];
            // İlk odayı yükle
            const baslangicOda = KORKU._baslangicOda || 'bolum1_oda1';
            KORKU.odaYukle(baslangicOda);
        },
        onReset: function () {
            KORKU.aktif = false;
            KORKU.oda = null;
            KORKU.odaId = null;
            KORKU.kameraShake = 0;
            if (window.KORKU_EGITIM) window.KORKU_EGITIM.bitir();
        }
    });

    // Mod kartı (tek satır)
    window.GAME_EXT.modKartiEkle('korku', 'Korku', 'Buzluk — Bölüm 1: Uyanış');

    // ========== GÜNCELLEME ==========
    window.GAME_EXT.chainHook('onFullUpdate', function (ts) {
        if (!KORKU.aktif || !KORKU.oda) return;
        const dt = Math.min(ts * 0.0166, 0.1);

        // Odanın güncelleme fonksiyonu
        if (typeof KORKU.oda.guncelle === 'function') KORKU.oda.guncelle(dt);

        // Kamera takibi
        if (KORKU.oyuncu) {
            const lerpF = 1 - Math.exp(-dt * CAMERA_LERP);
            KORKU.kamera.x += (KORKU.oyuncu.x - KORKU.kamera.x) * lerpF;
            KORKU.kamera.y += (KORKU.oyuncu.y - KORKU.kamera.y) * lerpF;
        }

        // Kamera sarsıntısı sönümü
        if (KORKU.kameraShake > 0) KORKU.kameraShake = Math.max(0, KORKU.kameraShake - dt * 30);
    });

    // ========== ÇİZİM ==========
    window.GAME_EXT.chainHook('onFullRender', function (ctx2) {
        if (!KORKU.aktif || !KORKU.oda) return;

        ctx2.fillStyle = '#05070a';
        ctx2.fillRect(0, 0, canvas.width, canvas.height);

        ctx2.save();
        const shakeX = KORKU.kameraShake > 0 ? (Math.random() - 0.5) * KORKU.kameraShake : 0;
        const shakeY = KORKU.kameraShake > 0 ? (Math.random() - 0.5) * KORKU.kameraShake : 0;
        const cx = canvas.width / 2 - KORKU.kamera.x * CAMERA_ZOOM + shakeX;
        const cy = canvas.height / 2 - KORKU.kamera.y * CAMERA_ZOOM + shakeY;
        ctx2.translate(cx, cy);
        ctx2.scale(CAMERA_ZOOM, CAMERA_ZOOM);

        // Odanın çizim fonksiyonu
        if (typeof KORKU.oda.ciz === 'function') KORKU.oda.ciz(ctx2);

        ctx2.restore();

        // Karanlık katmanı (ekran koordinatında)
        cizKaranlik(ctx2);
    });

    // ========== KARANLIK KATMANI ==========
    const darkCanvas = document.createElement('canvas');
    const darkCtx = darkCanvas.getContext('2d');
    function boyutGuncelle() {
        darkCanvas.width = canvas.width;
        darkCanvas.height = canvas.height;
    }
    window.addEventListener('resize', boyutGuncelle);
    boyutGuncelle();

    function cizKaranlik(ctx2) {
        if (!KORKU.oyuncu) return;
        if (darkCanvas.width !== canvas.width) boyutGuncelle();
        darkCtx.clearRect(0, 0, darkCanvas.width, darkCanvas.height);
        darkCtx.fillStyle = 'rgba(2,3,6,0.97)';
        darkCtx.fillRect(0, 0, darkCanvas.width, darkCanvas.height);
        const sx = canvas.width / 2 + (KORKU.oyuncu.x - KORKU.kamera.x) * CAMERA_ZOOM;
        const sy = canvas.height / 2 + (KORKU.oyuncu.y - KORKU.kamera.y) * CAMERA_ZOOM;
        const r = KORKU.gorusYaricap() * CAMERA_ZOOM;
        const g = darkCtx.createRadialGradient(sx, sy, r * 0.15, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.7, 'rgba(0,0,0,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        darkCtx.globalCompositeOperation = 'destination-out';
        darkCtx.fillStyle = g;
        darkCtx.beginPath();
        darkCtx.arc(sx, sy, r, 0, Math.PI * 2);
        darkCtx.fill();
        darkCtx.globalCompositeOperation = 'source-over';
        ctx2.drawImage(darkCanvas, 0, 0);
    }

    // ========== YARDIMCILAR ==========
    KORKU.mesafe = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
    KORKU.WALL_THICKNESS = WALL_THICKNESS;
    KORKU.CAMERA_ZOOM = CAMERA_ZOOM;

    // ========== FENER BUTONU ==========
    window.addEventListener('load', function () {
        const btn = document.getElementById('korkuFenerBtn');
        if (btn) btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            KORKU.fener = !KORKU.fener;
            btn.textContent = KORKU.fener ? '💡' : '🔦';
            btn.style.borderColor = KORKU.fener ? '#f1c40f' : '#4a4a5a';
            btn.style.color = KORKU.fener ? '#f1c40f' : '#4a4a5a';
        });
    });

    console.log('[KORKU] Motor hazır.');
})();