// ========== mod3.js (YILDIRIM) ==========
// Yeni karakter: Yıldırım
// Özellikler:
// - Menzil: Hortlak'tan %40 daha uzun (600)
// - Hasar: Uzaklığa göre değişir (max 2000 yakın, min 400 uzak)
// - Mermi bota çarpınca 2'ye ayrılır, parçalar ana merminin çarptığı bota değil,
//   diğer botlara gider; tek bota çarpar ve yok olur.
// - Parça hasarı: Ana merminin verdiği hasarın %80'i
// - Ulti YOK (buton gösterilmez)

window.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-yildirim')) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-yildirim';
        card.innerHTML = `
            <div class="char-color-preview" style="background:#ffd700;"></div>
            <span>Yıldırım</span>
            <small>Hasar: 400-2000<br>Menzil: Uzun</small>
        `;
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = 'yildirim';
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
    }
});

window.GAME_EXT.characters['yildirim'] = {
    color: '#ffd700',
    hp: 3000,
    speed: 3.8
};

// ----- Orijinal metodları sakla -----
const yildirimOrijinalSetCharacter = player.setCharacter;
const yildirimOrijinalFire = player.fire;
const yildirimOrijinalUpdateBulletLogic = window.updateBulletLogic;
const yildirimOrijinalUpdate = window.update;
const yildirimOrijinalDraw = window.draw;
const yildirimOrijinalStartGame = window.startGame;
const yildirimOrijinalDrawBullet = window.drawBullet;

// ----- Sabitler -----
const YILDIRIM_MENZIL = 600; // Hortlak 430'un %40 fazlası

// ----- setCharacter -----
player.setCharacter = function(type) {
    yildirimOrijinalSetCharacter.call(this, type);
    if (type === 'yildirim') {
        this.maxAmmo = 3;
        this.reloadSpeed = 0.018;
        this.ammo = this.maxAmmo;
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
    }
};

// ----- fire -----
player.fire = function(a) {
    if (this.charType === 'yildirim') {
        if (this.ammo < 1 || this.isDead) return;
        this.angle = a;
        const sp = PLAYER_BULLET_SPEED * 1.1;
        bullets.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            type: 'yildirim_mermi',
            rangeMod: 1,
            hitTargets: [],
            maxRange: YILDIRIM_MENZIL
        });
        this.consumeAmmo();
        this.lastShotTime = Date.now();
    } else {
        yildirimOrijinalFire.call(this, a);
    }
};

// ----- updateBulletLogic -----
window.updateBulletLogic = function(list, isBot, ts) {
    if (!isBot) {
        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];

            if (b.type === 'yildirim_mermi') {
                b.x += b.vx * ts;
                b.y += b.vy * ts;

                const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                let hitObs = false;
                for (let o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) { hitObs = true; break; }
                }
                const mesafe = getDist(b, {x:b.sx, y:b.sy});
                if (hwX || hwY || hitObs || mesafe > b.maxRange) {
                    list.splice(i, 1);
                    continue;
                }

                // Hasar hesabı: uzaklık arttıkça düşer
                const hasar = Math.max(400, Math.round(2000 - (2000 - 400) * (mesafe / b.maxRange)));

                let carptiMi = false;
                getActiveEnemies().forEach(e => {
                    if (!carptiMi && getDist(b, e) < e.radius + 12) {
                        carptiMi = true;
                        e.hp -= hasar;
                        addFloatingNumber(e.x, e.y, hasar, "#ffd700");
                        spawnParticles(e.x, e.y, '#ffd700', 'normal');

                        // İkiye ayrıl: parçalar ana merminin çarptığı bota değil
                        const parcaHasar = Math.round(hasar * 0.8);
                        const parcaAcisi1 = Math.atan2(b.vy, b.vx) + 0.3;
                        const parcaAcisi2 = Math.atan2(b.vy, b.vx) - 0.3;
                        const parcaHiz = PLAYER_BULLET_SPEED * 0.9;

                        bullets.push({
                            x: b.x, y: b.y,
                            sx: b.x, sy: b.y,
                            vx: Math.cos(parcaAcisi1) * parcaHiz,
                            vy: Math.sin(parcaAcisi1) * parcaHiz,
                            type: 'yildirim_parca',
                            damage: parcaHasar,
                            rangeMod: 0.7,
                            hitTargets: [e], // çarptığı bota çarpmasın
                            maxRange: 420
                        });
                        bullets.push({
                            x: b.x, y: b.y,
                            sx: b.x, sy: b.y,
                            vx: Math.cos(parcaAcisi2) * parcaHiz,
                            vy: Math.sin(parcaAcisi2) * parcaHiz,
                            type: 'yildirim_parca',
                            damage: parcaHasar,
                            rangeMod: 0.7,
                            hitTargets: [e],
                            maxRange: 420
                        });

                        list.splice(i, 1);
                    }
                });
                continue;
            }

            if (b.type === 'yildirim_parca') {
                b.x += b.vx * ts;
                b.y += b.vy * ts;

                const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                let hitObs = false;
                for (let o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) { hitObs = true; break; }
                }
                const mesafe = getDist(b, {x:b.sx, y:b.sy});
                if (hwX || hwY || hitObs || mesafe > b.maxRange) {
                    list.splice(i, 1);
                    continue;
                }

                let vurdu = false;
                getActiveEnemies().forEach(e => {
                    if (!vurdu && !b.hitTargets.includes(e) && getDist(b, e) < e.radius + 12) {
                        e.hp -= b.damage;
                        addFloatingNumber(e.x, e.y, b.damage, "#ffd700");
                        spawnParticles(e.x, e.y, '#ffd700', 'normal');
                        b.hitTargets.push(e);
                        vurdu = true;
                        list.splice(i, 1);
                    }
                });
                continue;
            }
        }
    }
    yildirimOrijinalUpdateBulletLogic(list, isBot, ts);
};

// ----- draw (nişan çizgisi) -----
window.draw = function() {
    yildirimOrijinalDraw();
    if (!gameStarted) return;

    if (player.charType === 'yildirim' && aimData.active && player.ammo >= 1 && !player.isDead) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(aimData.angle);

        const maxMenzil = YILDIRIM_MENZIL;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.fillRect(0, -8, maxMenzil, 16);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -8, maxMenzil, 16);

        // Hasar göstergesi: yakın kısım parlak, uzak kısım soluk
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.fillRect(0, -8, maxMenzil * 0.4, 16);

        ctx.restore();
    }
};

// ----- startGame override (ulti butonunu gizle) -----
window.startGame = function() {
    yildirimOrijinalStartGame();
    if (selectedCharacter === 'yildirim') {
        ultiBtn.style.display = 'none';
        gadgetBtn.style.display = 'none';
        gadgetBtn2.style.display = 'none';
    }
};

// ----- Mermi çizimleri -----
window.drawBullet = function(b, c) {
    if (b.type === 'yildirim_mermi') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    } else if (b.type === 'yildirim_parca') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    } else {
        yildirimOrijinalDrawBullet(b, c);
    }
};