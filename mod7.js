// ==========================================================================
// GÖRSEL İYİLEŞTİRME SCRIPT'İ: DEVKO (SAM)
// --------------------------------------------------------------------------
// Ana dosyaya (index.html) HİÇBİR ŞEKİLDE dokunmadan çalışır. Kapanış
// </body> etiketinden önce, ana <script> bloğundan SONRA eklenmelidir:
//   <script src="gorsel-devko.js"></script>
//
// YÖNTEM: drawBullet ve drawEntity'yi SARIYORUZ (wrap). Oyun mantığına
// (hasar, hız, mesafe vb.) HİÇ dokunulmuyor, sadece görsel.
//
// Kapsam:
//   1) Normal yumruk mermileri (sam_punch_heavy/light) -> gerçek bir yumruk
//      şekli + hareket çizgileri, öfke modundayken kızıl aura
//   2) Ulti gidiş (sam_super) -> artık eldiv değil, çatlaklı/ateşli bir
//      "meteor yumruk", arkasında alev izi bırakıyor
//   3) Ulti dönüş (sam_return) -> aynı meteor ama altın/mavi enerjiyle
//      "eve dönüş" hissi veren farklı bir renk teması
//   4) Öfke modu (samRageActive) -> sade kırmızı halka yerine katmanlı
//      alev auresi + etrafında dönen kıvılcımlar
// ==========================================================================

(function () {
    'use strict';

    const RAGE_COLOR = '#e74c3c';

    // --------------------------------------------------------------------
    // Yardımcı: köşeli/çatlaklı bir "meteor" şekli çizer (ulti mermileri için)
    // --------------------------------------------------------------------
    function drawMeteorShape(size, coreColor, edgeColor, spin) {
        ctx.save();
        ctx.rotate(spin);
        // Düzensiz (köşeli) dış hat
        ctx.beginPath();
        const pts = 8;
        for (let i = 0; i < pts; i++) {
            const ang = (Math.PI * 2 * i) / pts;
            const jitter = (i % 2 === 0) ? 1 : 0.72;
            const r = size * jitter;
            const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = coreColor;
        ctx.fill();
        // Çatlaklar (birkaç ince çizgi)
        ctx.strokeStyle = edgeColor; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
        for (let i = 0; i < 3; i++) {
            const a1 = (Math.PI * 2 * i) / 3 + 0.4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a1) * size * 0.15, Math.sin(a1) * size * 0.15);
            ctx.lineTo(Math.cos(a1) * size * 0.85, Math.sin(a1) * size * 0.85);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawFistShape(size, color, empowered) {
        ctx.save();
        // Gövde (yuvarlatılmış kare - yumruk)
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(-size * 0.9, -size * 0.7, size * 1.8, size * 1.4, size * 0.4)
            : ctx.rect(-size * 0.9, -size * 0.7, size * 1.8, size * 1.4);
        ctx.fillStyle = color;
        if (empowered) { ctx.shadowColor = RAGE_COLOR; ctx.shadowBlur = size; }
        ctx.fill();
        ctx.shadowBlur = 0;
        // Parmak eklem çizgileri (ön yüzde 3 küçük çizgi)
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(size * 0.55, i * size * 0.4);
            ctx.lineTo(size * 0.9, i * size * 0.4);
            ctx.stroke();
        }
        ctx.restore();
    }

    const originalDrawBullet = drawBullet;
    drawBullet = function (b, c) {
        if (b.type === 'sam_punch_heavy' || b.type === 'sam_punch_light') {
            const size = b.type === 'sam_punch_heavy' ? 13 : 9;
            const color = b.empowered ? '#ff6b4a' : (b.type === 'sam_punch_heavy' ? '#c0392b' : '#e74c3c');
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(Math.atan2(b.vy, b.vx));
            // Hareket izi (arkaya doğru solan 3 iz)
            for (let i = 1; i <= 3; i++) {
                ctx.globalAlpha = (1 - i * 0.28) * 0.5;
                ctx.beginPath();
                ctx.arc(-i * size * 0.9, 0, size * (1 - i * 0.15), 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            drawFistShape(size, color, !!b.empowered);
            ctx.restore();
            return;
        }
        if (b.type === 'sam_super' || b.type === 'sam_return') {
            const isReturn = b.type === 'sam_return';
            ctx.save();
            ctx.translate(b.x, b.y);
            // Arkaya doğru enerji/alev izi
            ctx.save();
            ctx.rotate(Math.atan2(b.vy, b.vx));
            for (let i = 1; i <= 4; i++) {
                ctx.beginPath();
                ctx.arc(-i * 8, (Math.sin(Date.now() / 40 + i) * 3), 5 - i * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = isReturn ? '#f1c40f' : '#e67e22';
                ctx.globalAlpha = 1 - i * 0.2;
                ctx.fill();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
            const spin = (Date.now() / 45) % (Math.PI * 2);
            if (isReturn) {
                drawMeteorShape(16, '#f39c12', '#fffde7', spin);
            } else {
                drawMeteorShape(18, '#7f2914', '#ff5722', spin);
            }
            // Dış parıltı halkası
            ctx.beginPath();
            ctx.arc(0, 0, isReturn ? 21 : 23, 0, Math.PI * 2);
            ctx.strokeStyle = isReturn ? 'rgba(241,196,15,0.5)' : 'rgba(230,74,25,0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            return;
        }
        return originalDrawBullet(b, c);
    };

    // --------------------------------------------------------------------
    // Öfke modu için ek görsel (ana kod zaten sade bir kırmızı halka
    // çiziyor, biz üzerine katmanlı alev + kıvılcım ekliyoruz)
    // --------------------------------------------------------------------
    const originalDrawEntity = drawEntity;
    drawEntity = function (e, isP) {
        originalDrawEntity(e, isP);
        if (!(isP && e.charType === 'sam' && e.samRageActive && !e.isDead)) return;
        ctx.save();
        ctx.translate(e.x, e.y);
        const pulse = (Math.sin(Date.now() / 120) + 1) / 2; // 0-1
        // Katmanlı alev aurası
        const grad = ctx.createRadialGradient(0, 0, e.radius * 0.5, 0, 0, e.radius + 14 + pulse * 6);
        grad.addColorStop(0, 'rgba(231, 76, 60, 0)');
        grad.addColorStop(0.7, `rgba(231, 76, 60, ${0.15 + pulse * 0.1})`);
        grad.addColorStop(1, 'rgba(243, 156, 18, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 14 + pulse * 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        // Etrafında dönen kıvılcımlar
        const sparkCount = 4;
        const spin = Date.now() / 220;
        for (let i = 0; i < sparkCount; i++) {
            const ang = spin + (Math.PI * 2 * i) / sparkCount;
            const dist = e.radius + 10;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 === 0 ? '#f1c40f' : '#e74c3c';
            ctx.fill();
        }
        ctx.restore();
    };

})();
