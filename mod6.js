// ==========================================================================
// GÖRSEL İYİLEŞTİRME SCRIPT'İ: GÖLGE (NİNJA)
// --------------------------------------------------------------------------
// Ana dosyaya (index.html) HİÇBİR ŞEKİLDE dokunmadan çalışır. Kapanış
// </body> etiketinden önce, ana <script> bloğundan SONRA eklenmelidir:
//   <script src="gorsel-ninja.js"></script>
//
// YÖNTEM: drawBullet ve draw fonksiyonlarını SARIYORUZ (wrap) - ninja'ya
// özel durumlarda kendi çizimimizi yapıyoruz, geri kalan her şey için
// orijinal çizimi olduğu gibi çağırıyoruz. Oyun mantığına (hasar, hız,
// mesafe vb.) HİÇ dokunulmuyor, sadece görsel.
//
// Kapsam:
//   1) Gölge'nin normal mermisi (ninja_bullet)  -> dönen ninja yıldızı
//   2) Gölge'nin ulti mermisi (ninja_bomb_bullet) -> daha büyük, alevli yıldız
//   3) Zincirleme bomba patlaması (bombaBulasti süresi dolunca) -> çok daha
//      belirgin bir patlama efekti (şok dalgası + saçılan yıldız parçaları)
//   4) Gölge'nin ALAN aksesuarı (ninjaZoneActive) -> döner yıldızlarla
//      süslenmiş, daha canlı bir bölge görseli
// ==========================================================================

(function () {
    'use strict';

    const NINJA_COLOR = '#e67e22';
    const NINJA_GLOW = '#f1c40f';

    // --------------------------------------------------------------------
    // Yardımcı: dönen bir ninja yıldızı (shuriken) çizer. ctx zaten
    // b.x,b.y'ye translate edilmiş ve hızının açısına rotate edilmiş
    // olarak gelir (drawBullet'ın orijinal davranışıyla aynı sözleşme).
    // --------------------------------------------------------------------
    function drawShurikenShape(size, fill, glow, spin) {
        ctx.save();
        ctx.rotate(spin);
        ctx.beginPath();
        const spikes = 4;
        for (let i = 0; i < spikes * 2; i++) {
            const ang = (Math.PI * i) / spikes;
            const r = (i % 2 === 0) ? size : size * 0.35;
            const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.9; }
        ctx.fill();
        if (glow) ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
        // merkez göbek
        ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
        ctx.restore();
    }

    const originalDrawBullet = drawBullet;
    drawBullet = function (b, c) {
        if (b.type === 'ninja_bullet') {
            ctx.save();
            ctx.translate(b.x, b.y);
            drawShurikenShape(9, NINJA_COLOR, NINJA_GLOW, (Date.now() / 60) % (Math.PI * 2));
            ctx.restore();
            return;
        }
        if (b.type === 'ninja_bomb_bullet') {
            ctx.save();
            ctx.translate(b.x, b.y);
            // Alevli iz - arkaya doğru birkaç kıvılcım
            ctx.save();
            ctx.rotate(Math.atan2(b.vy, b.vx));
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.arc(-i * 7, (Math.random() - 0.5) * 4, 3 - i * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = i === 1 ? '#f1c40f' : '#e74c3c';
                ctx.globalAlpha = 1 - i * 0.25;
                ctx.fill();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
            drawShurikenShape(14, '#e74c3c', '#f39c12', (Date.now() / 40) % (Math.PI * 2));
            ctx.restore();
            return;
        }
        return originalDrawBullet(b, c);
    };

    // --------------------------------------------------------------------
    // Zincirleme bomba patlamasını yakala. Bir anda 10-15 bot birden
    // patlayabildiği için efekt HAFİF tutulmalı: gradyan/gölge (shadowBlur)
    // gibi pahalı çizimler sınırlı sayıda patlamada kullanılır, geri kalanı
    // basit/ucuz bir versiyonla gösterilir - kasma yaşanmaz.
    // --------------------------------------------------------------------
    const bombWatch = new WeakMap();
    let ninjaBursts = []; // {x,y,life,maxLife,full}
    const MAX_FULL_BURSTS = 5; // aynı anda en fazla bu kadarı "tam" efekt alır

    function triggerNinjaBurst(x, y) {
        const fullCount = ninjaBursts.reduce((n, b) => n + (b.full ? 1 : 0), 0);
        const full = fullCount < MAX_FULL_BURSTS;
        ninjaBursts.push({ x: x, y: y, life: full ? 24 : 12, maxLife: full ? 24 : 12, full: full });
        // Parçacıklar her patlamada ucuzdur (basit daire), sayıyı az tutuyoruz
        const count = full ? 4 : 2;
        for (let i = 0; i < count; i++) {
            const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            spawnParticles(x + Math.cos(ang) * 8, y + Math.sin(ang) * 8, i % 2 === 0 ? '#f1c40f' : '#e74c3c', 'normal');
        }
    }

    function watchBombInfections() {
        getActiveEnemies().forEach(e => {
            const prev = bombWatch.get(e);
            const wasBulasti = prev ? prev.wasBulasti : false;
            if (wasBulasti && !e.bombaBulasti) {
                triggerNinjaBurst(e.x, e.y);
            }
            bombWatch.set(e, { wasBulasti: e.bombaBulasti });
        });
    }

    function updateNinjaBursts(ts) {
        for (let i = ninjaBursts.length - 1; i >= 0; i--) {
            ninjaBursts[i].life -= ts;
            if (ninjaBursts[i].life <= 0) ninjaBursts.splice(i, 1);
        }
    }

    function drawNinjaBursts() {
        ninjaBursts.forEach(b => {
            const t = 1 - b.life / b.maxLife; // 0 -> 1
            ctx.save();
            ctx.translate(b.x, b.y);
            if (b.full) {
                // Tam efekt: şok dalgası + ateş topu + 3 saçılan yıldız parçası (gölgesiz)
                ctx.beginPath();
                ctx.arc(0, 0, 18 + t * 90, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(241, 196, 15, ${(1 - t) * 0.85})`;
                ctx.lineWidth = 4 * (1 - t) + 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0, 28 * (1 - t)), 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, 28 * (1 - t)));
                grad.addColorStop(0, `rgba(255, 255, 255, ${1 - t})`);
                grad.addColorStop(0.5, `rgba(241, 196, 15, ${(1 - t) * 0.85})`);
                grad.addColorStop(1, `rgba(230, 126, 34, 0)`);
                ctx.fillStyle = grad;
                ctx.fill();
                for (let i = 0; i < 3; i++) {
                    const ang = (Math.PI * 2 * i) / 3 + t * 2;
                    const dist = t * 55;
                    ctx.save();
                    ctx.translate(Math.cos(ang) * dist, Math.sin(ang) * dist);
                    ctx.globalAlpha = 1 - t;
                    drawShurikenShape(5, '#e67e22', null, ang * 3);
                    ctx.restore();
                }
            } else {
                // Ucuz versiyon: tek düz daire, gölge/gradyan yok
                ctx.globalAlpha = (1 - t) * 0.8;
                ctx.beginPath();
                ctx.arc(0, 0, 12 + t * 40, 0, Math.PI * 2);
                ctx.fillStyle = '#f1c40f';
                ctx.fill();
            }
            ctx.restore();
        });
    }

    // --------------------------------------------------------------------
    // Gölge Sıçrayışı'nın iniş anı için ninja temalı efekt: duman halkası +
    // yere gömülen küçük yıldızlar + kısa bir parlama.
    // --------------------------------------------------------------------
    let ninjaLandings = []; // {x,y,life,maxLife}

    function triggerNinjaLanding(x, y) {
        ninjaLandings.push({ x: x, y: y, life: 22, maxLife: 22 });
        spawnParticles(x, y, '#7f8c8d', 'smoke');
        for (let i = 0; i < 4; i++) {
            spawnParticles(x, y, '#e67e22', 'normal');
        }
    }

    function updateNinjaLandings(ts) {
        for (let i = ninjaLandings.length - 1; i >= 0; i--) {
            ninjaLandings[i].life -= ts;
            if (ninjaLandings[i].life <= 0) ninjaLandings.splice(i, 1);
        }
    }

    function drawNinjaLandings() {
        ninjaLandings.forEach(b => {
            const t = 1 - b.life / b.maxLife;
            ctx.save();
            ctx.translate(b.x, b.y);
            // Genişleyen toz/duman halkası
            ctx.beginPath();
            ctx.arc(0, 0, 10 + t * 60, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(127, 140, 141, ${(1 - t) * 0.7})`;
            ctx.lineWidth = 6 * (1 - t) + 1;
            ctx.stroke();
            // Kısa bir zemin parlaması
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, 20 * (1 - t)), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(230, 126, 34, ${(1 - t) * 0.5})`;
            ctx.fill();
            // Yere gömülen 3 küçük yıldız
            for (let i = 0; i < 3; i++) {
                const ang = (Math.PI * 2 * i) / 3;
                const dist = 22 + t * 8;
                ctx.save();
                ctx.translate(Math.cos(ang) * dist, Math.sin(ang) * dist);
                ctx.globalAlpha = Math.min(1, (1 - t) * 1.4);
                drawShurikenShape(6, NINJA_COLOR, null, ang);
                ctx.restore();
            }
            ctx.restore();
        });
    }

    // --------------------------------------------------------------------
    // Gölge'nin ALAN bölgesi için ek görsel süsleme (orijinal daireler +
    // döner çizgiler zaten ana kodda çiziliyor, biz üzerine yıldız
    // ikonları ve ekstra parıltı katmanı ekliyoruz).
    // --------------------------------------------------------------------
    function drawNinjaZoneEnhancement() {
        if (!(player.charType === 'ninja' && player.ninjaZoneActive)) return;
        const alpha = Math.min(1, player.ninjaZoneTimer / 60);
        ctx.save();
        ctx.translate(player.ninjaZoneX, player.ninjaZoneY);

        // Zeminde yumuşak yeşil-turuncu karışık bir parıltı
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, player.ninjaZoneRadius);
        grad.addColorStop(0, `rgba(46, 204, 113, ${alpha * 0.25})`);
        grad.addColorStop(0.7, `rgba(230, 126, 34, ${alpha * 0.12})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(0, 0, player.ninjaZoneRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        // Çevrede dönen küçük yıldızlar
        const count = 6;
        const spin = Date.now() / 500;
        for (let i = 0; i < count; i++) {
            const ang = spin + (Math.PI * 2 * i) / count;
            ctx.save();
            ctx.translate(Math.cos(ang) * (player.ninjaZoneRadius - 6), Math.sin(ang) * (player.ninjaZoneRadius - 6));
            ctx.globalAlpha = alpha;
            drawShurikenShape(7, NINJA_COLOR, NINJA_GLOW, -spin * 2);
            ctx.restore();
        }
        ctx.restore();
    }

    // --------------------------------------------------------------------
    // update/draw'ı sar
    // --------------------------------------------------------------------
    const originalUpdate = update;
    update = function (ts) {
        const wasNinjaJumping = player.charType === 'ninja' && player.isJumping;
        originalUpdate(ts);
        if (!gameStarted) return;
        if (wasNinjaJumping && !player.isJumping) {
            triggerNinjaLanding(player.x, player.y);
        }
        watchBombInfections();
        updateNinjaBursts(ts);
        updateNinjaLandings(ts);
    };

    const originalDraw = draw;
    draw = function () {
        originalDraw();
        if (!gameStarted) return;
        drawNinjaZoneEnhancement();
        drawNinjaBursts();
        drawNinjaLandings();
    };

    // Reset'te kendi state'imizi temizle
    window.GAME_EXT = window.GAME_EXT || { characters: {}, modes: {}, obstacleTypes: {}, botTypes: {}, hooks: {} };
    window.GAME_EXT.hooks.onReset = (function (prev) {
        return function () {
            ninjaBursts = [];
            ninjaLandings = [];
            if (typeof prev === 'function') prev();
        };
    })(window.GAME_EXT.hooks.onReset);

})();
