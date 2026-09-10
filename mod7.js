// ========== egitim.js — KORKU MODU EĞİTİM KATMANI ==========
// Korku modu aktifken çalışır, adım adım öğretir.
// Ana oyuna dokunmaz, kendi panelini oluşturur, sadece mod tarafından çağrılır.
// Bağımsız bir "overlay" katmanıdır; oyun mantığına karışmaz.

(function () {
    'use strict';

    const EGITIM = {
        aktif: false,
        adim: 1,
        toplamAdim: 4,
        tamamlandi: false,
        // İlerleme bayrakları (korku modu bunları günceller)
        hareketTimer: 0,
        hareketHedef: 1.5,
        hareketTamam: false,
        atesTamam: false,
        anahtarTamam: false,
        kapiTamam: false
    };

    const adimlar = {
        1: { baslik: 'ADIM 1', metin: 'Hareket etmek için SOL joystick\'i kullan' },
        2: { baslik: 'ADIM 2', metin: 'Sağ joystick ile nişan al ve SİS BOTUNU yok et' },
        3: { baslik: 'ADIM 3', metin: 'Yukarıdaki ANAHTARI al' },
        4: { baslik: 'ADIM 4', metin: 'KAPIYI aç ve koridora geç' }
    };

    let panelEl = null;
    let gorevEl = null;
    let glowSolEl = null;
    let glowSagEl = null;

    function olustur() {
        // Talimat paneli
        panelEl = document.createElement('div');
        panelEl.id = 'egitim-panel';
        panelEl.style.cssText = `
            position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(10,15,25,0.92); border: 2px solid #3e5078;
            border-radius: 8px; padding: 12px 20px; color: #e8f4ff;
            font-size: clamp(0.9rem, 3vw, 1.1rem); text-align: center;
            max-width: 90%; z-index: 30; pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); display: none;
            font-family: 'Segoe UI', Arial, sans-serif;
        `;
        document.body.appendChild(panelEl);

        // Görev listesi
        gorevEl = document.createElement('div');
        gorevEl.id = 'egitim-gorevler';
        gorevEl.style.cssText = `
            position: absolute; top: 20px; left: 20px;
            background: rgba(10,15,25,0.85); border: 1px solid #2e3d5e;
            border-radius: 6px; padding: 10px 14px; z-index: 30;
            font-size: clamp(0.75rem, 2.5vw, 0.9rem);
            pointer-events: none; color: #6f7d92;
            font-family: 'Segoe UI', Arial, sans-serif;
            display: none; line-height: 1.5;
        `;
        document.body.appendChild(gorevEl);

        // Joystick vurgu çemberleri
        glowSolEl = document.createElement('div');
        glowSolEl.style.cssText = `
            position: absolute; bottom: 60px; left: 30px;
            width: 140px; height: 140px; border-radius: 50%;
            pointer-events: none; border: 3px dashed #f1c40f;
            box-shadow: 0 0 0 0 rgba(241,196,15,0.6);
            animation: egitimPulse 1.2s ease-in-out infinite;
            z-index: 25; opacity: 0; transition: opacity 0.3s;
        `;
        document.body.appendChild(glowSolEl);

        glowSagEl = document.createElement('div');
        glowSagEl.style.cssText = glowSolEl.style.cssText.replace('left: 30px', 'right: 30px');
        glowSagEl.style.left = 'auto';
        glowSagEl.style.right = '30px';
        document.body.appendChild(glowSagEl);

        // Animasyon stilini ekle (tek seferlik)
        if (!document.getElementById('egitim-style')) {
            const style = document.createElement('style');
            style.id = 'egitim-style';
            style.textContent = `
                @keyframes egitimPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(241,196,15,0.6); }
                    50% { box-shadow: 0 0 0 15px rgba(241,196,15,0); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function guncellePanel() {
        if (!panelEl) return;
        const a = adimlar[EGITIM.adim];
        if (!a) return;
        panelEl.innerHTML = `<span style="color:#f1c40f;font-weight:700;font-size:0.85em;letter-spacing:0.1em;display:block;margin-bottom:4px;">${a.baslik}</span><span>${a.metin}</span>`;
    }

    function guncelleGorevler() {
        if (!gorevEl) return;
        const satirlar = [];
        for (let i = 1; i <= EGITIM.toplamAdim; i++) {
            const metinler = ['Hareket etmeyi öğren', 'Sis botunu yok et', 'Anahtarı al', 'Kapıyı aç'];
            let sinif = '';
            if (i < EGITIM.adim || EGITIM.tamamlandi) sinif = 'color:#2ecc71;text-decoration:line-through;';
            else if (i === EGITIM.adim) sinif = 'color:#f1c40f;font-weight:700;';
            satirlar.push(`<div style="${sinif}">${i}. ${metinler[i-1]}</div>`);
        }
        gorevEl.innerHTML = satirlar.join('');
    }

    function guncelleGlow() {
        if (!glowSolEl || !glowSagEl) return;
        glowSolEl.style.opacity = (EGITIM.adim === 1 && EGITIM.aktif) ? '1' : '0';
        glowSagEl.style.opacity = (EGITIM.adim === 2 && EGITIM.aktif) ? '1' : '0';
    }

    function adimIlerlet() {
        if (EGITIM.adim >= EGITIM.toplamAdim) {
            EGITIM.tamamlandi = true;
            panelEl.innerHTML = `<span style="color:#2ecc71;font-weight:700;font-size:0.85em;letter-spacing:0.1em;display:block;margin-bottom:4px;">TEBRİKLER</span><span>Öğretici tamamlandı! Koridora ilerleyebilirsin.</span>`;
            guncelleGorevler();
            guncelleGlow();
            setTimeout(() => {
                if (panelEl) panelEl.style.display = 'none';
                if (gorevEl) gorevEl.style.display = 'none';
            }, 3000);
            return;
        }
        EGITIM.adim++;
        guncellePanel();
        guncelleGorevler();
        guncelleGlow();
    }

    // ========== DIŞA AÇIK API (korku modu kullanır) ==========
    window.KORKU_EGITIM = {
        baslat() {
            if (!panelEl) olustur();
            EGITIM.aktif = true;
            EGITIM.adim = 1;
            EGITIM.tamamlandi = false;
            EGITIM.hareketTimer = 0;
            EGITIM.hareketTamam = false;
            EGITIM.atesTamam = false;
            EGITIM.anahtarTamam = false;
            EGITIM.kapiTamam = false;
            panelEl.style.display = 'block';
            gorevEl.style.display = 'block';
            guncellePanel();
            guncelleGorevler();
            guncelleGlow();
        },

        bitir() {
            EGITIM.aktif = false;
            if (panelEl) panelEl.style.display = 'none';
            if (gorevEl) gorevEl.style.display = 'none';
            if (glowSolEl) glowSolEl.style.opacity = '0';
            if (glowSagEl) glowSagEl.style.opacity = '0';
        },

        // Her karede çağrılır — hareket süresi takibi
        hareketBildir(dt, hareketEdiyorMu) {
            if (!EGITIM.aktif || EGITIM.adim !== 1) return;
            if (hareketEdiyorMu) {
                EGITIM.hareketTimer += dt;
                if (EGITIM.hareketTimer >= EGITIM.hareketHedef) {
                    EGITIM.hareketTamam = true;
                    adimIlerlet();
                }
            }
        },

        // Sis botu öldürüldüğünde çağrılır
        atesBildir() {
            if (!EGITIM.aktif || EGITIM.adim !== 2) return;
            if (!EGITIM.atesTamam) {
                EGITIM.atesTamam = true;
                adimIlerlet();
            }
        },

        anahtarBildir() {
            if (!EGITIM.aktif || EGITIM.adim !== 3) return;
            if (!EGITIM.anahtarTamam) {
                EGITIM.anahtarTamam = true;
                adimIlerlet();
            }
        },

        kapiBildir() {
            if (!EGITIM.aktif || EGITIM.adim !== 4) return;
            if (!EGITIM.kapiTamam) {
                EGITIM.kapiTamam = true;
                adimIlerlet();
            }
        },

        // Sorgu
        aktifMi() { return EGITIM.aktif; },
        adimNo() { return EGITIM.adim; }
    };

    console.log('[EĞİTİM] Katman hazır — KORKU_EGITIM API kullanılabilir.');
})();