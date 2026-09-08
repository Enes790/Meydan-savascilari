// ========== core.js (MERKEZİ KAYIT VE OLAY SİSTEMİ) ==========
// Bu dosya, modüllerin ana oyunu ezmesini önler.
// Modüller artık window.draw, window.update gibi global fonksiyonları
// doğrudan değiştirmek yerine buradaki register ve on fonksiyonlarını kullanır.
// Ana oyun dosyasına dokunmadan çalışır.

(function () {
    'use strict';

    // GAME_EXT objesini garanti altına al
    window.GAME_EXT = window.GAME_EXT || { modes: {}, characters: {}, hooks: {} };

    // ========== MOD KAYIT ==========
    window.GAME_EXT.registerMode = function (id, modObj) {
        if (!modObj || typeof modObj !== 'object') {
            console.warn('registerMode: Geçersiz mod objesi:', id);
            return;
        }
        if (window.GAME_EXT.modes[id]) {
            console.warn('registerMode: "' + id + '" zaten kayıtlı, üzerine yazılıyor.');
        }
        window.GAME_EXT.modes[id] = modObj;
    };

    // ========== KARAKTER KAYIT ==========
    window.GAME_EXT.registerCharacter = function (id, stats) {
        if (!stats || typeof stats !== 'object') {
            console.warn('registerCharacter: Geçersiz karakter özellikleri:', id);
            return;
        }
        if (window.GAME_EXT.characters[id]) {
            console.warn('registerCharacter: "' + id + '" zaten kayıtlı, üzerine yazılıyor.');
        }
        window.GAME_EXT.characters[id] = stats;
    };

    // ========== OLAY YAYINLAMA ==========
    window.GAME_EXT.emit = function (eventName, data) {
        const handlers = window.GAME_EXT._eventHandlers && window.GAME_EXT._eventHandlers[eventName];
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data);
                } catch (e) {
                    console.error('Olay işleyici hatası (' + eventName + '):', e);
                }
            }
        }
    };

    // ========== OLAY DİNLEME ==========
    window.GAME_EXT.on = function (eventName, callback) {
        if (!window.GAME_EXT._eventHandlers) {
            window.GAME_EXT._eventHandlers = {};
        }
        if (!window.GAME_EXT._eventHandlers[eventName]) {
            window.GAME_EXT._eventHandlers[eventName] = [];
        }
        window.GAME_EXT._eventHandlers[eventName].push(callback);

        // Dinlemeyi kaldırmak için fonksiyon döndür
        return function () {
            const arr = window.GAME_EXT._eventHandlers[eventName];
            if (arr) {
                const idx = arr.indexOf(callback);
                if (idx > -1) arr.splice(idx, 1);
            }
        };
    };

    // ========== ZİNCİRLEME HOOK YARDIMCISI ==========
    window.GAME_EXT.chainHook = function (hookName, fn) {
        if (!window.GAME_EXT.hooks) window.GAME_EXT.hooks = {};
        const prev = window.GAME_EXT.hooks[hookName];
        window.GAME_EXT.hooks[hookName] = function (...args) {
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
    };

    // ========== ÇİZİM SARMALAYICI (DRAW WRAPPER) ==========
    // window.draw fonksiyonunu güvenli şekilde sarmalar.
    // Modlar artık window.draw'u ezmek yerine hook'lara bağlanır.
    // Hook sırası: onPreDraw -> orijinal draw -> onAimDraw -> onDraw -> onPostDraw
    function wrapDrawFunction() {
        if (typeof window.draw !== 'function') {
            console.warn('core.js: window.draw bulunamadı, çizim sarmalayıcı kurulmadı.');
            return;
        }

        const originalDraw = window.draw;

        window.draw = function () {
            // 1) Çizim öncesi hook
            if (typeof window.GAME_EXT.hooks.onPreDraw === 'function') {
                window.GAME_EXT.hooks.onPreDraw(ctx);
            }

            // 2) Ana çizim
            originalDraw();

            // 3) Nişan çizimi hook'u (ana çizimden hemen sonra, nişan çizgileri için)
            if (typeof window.GAME_EXT.hooks.onAimDraw === 'function') {
                window.GAME_EXT.hooks.onAimDraw(ctx);
            }

            // 4) Genel çizim hook'u (ekstra çizimler için)
            if (typeof window.GAME_EXT.hooks.onDraw === 'function') {
                window.GAME_EXT.hooks.onDraw(ctx);
            }

            // 5) Çizim sonrası hook (temizlik veya ek efektler için)
            if (typeof window.GAME_EXT.hooks.onPostDraw === 'function') {
                window.GAME_EXT.hooks.onPostDraw(ctx);
            }
        };

        console.log('core.js: window.draw sarmalayıcısı kuruldu.');
    }

    // ========== Varsayılan Hook'ları Tanımla ==========
    window.GAME_EXT.hooks.onPreDraw = window.GAME_EXT.hooks.onPreDraw || function () {};
    window.GAME_EXT.hooks.onAimDraw = window.GAME_EXT.hooks.onAimDraw || function () {};
    window.GAME_EXT.hooks.onDraw = window.GAME_EXT.hooks.onDraw || function () {};
    window.GAME_EXT.hooks.onPostDraw = window.GAME_EXT.hooks.onPostDraw || function () {};

    // ========== Draw Sarmalayıcıyı Kur ==========
    wrapDrawFunction();

    console.log('core.js yüklendi: Merkezi kayıt ve olay sistemi hazır.');
})();