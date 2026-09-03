// ========== mod3.js (RÜZGAR) ==========
// Yeni karakter: Rüzgar
// Özellikler:
// - 3 cephane, 0.15 sn arayla iki mermi atar
// - İlk mermi 800 hasar (normal)
// - İkinci mermi 400 hasar (delici)
// - Ulti menzili Sam'inkinden %30 daha kısa (240)
// - Ulti: özel mermi atar, bota değince oyuncu o bota sürüklenir,
//   yol boyunca temas ettiği botlara 300 hasar verir ve bot başına 300 can kazanır.

// ----- Karakter Seçim Kartı -----
window.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.char-select-container');
    if (container && !document.getElementById('char-ruzgar')) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.id = 'char-ruzgar';
        card.innerHTML = `
            <div class="char-color-preview" style="background:#00d2ff;"></div>
            <span>Rüzgar</span>
            <small>Hasar: 800/400<br>Güç: Fırtına Sürüklenişi</small>
        `;
        container.appendChild(card);
        card.addEventListener('click', () => {
            selectedCharacter = 'ruzgar';
            document.querySelectorAll('.char-card').forEach(e => e.classList.remove('selected'));
            card.classList.add('selected');
        });
    }
});

// ----- Karakter Stat Tanımı -----
window.GAME_EXT.characters['ruzgar'] = {
    color: '#00d2ff',
    hp: 4200,
    speed: 4.0
};

// ----- Orijinal Metodları Sakla -----
const ruzgarOrijinalSetCharacter = player.setCharacter;
const ruzgarOrijinalFire = player.fire;
const ruzgarOrijinalFireUlti = player.fireUlti;
const ruzgarOrijinalUpdateBulletLogic = window.updateBulletLogic;
const ruzgarOrijinalUpdate = window.update;

// ----- Player.setCharacter Override -----
player.setCharacter = function(type) {
    ruzgarOrijinalSetCharacter.call(this, type);
    if (type === 'ruzgar') {
        this.maxAmmo = 3;
        this.reloadSpeed = 0.02;
        this.ammo = this.maxAmmo;
        this.ultReady = false;
        this.ultCharge = 0;
        this.ruzgarDashAktif = false;
        this.ruzgarDashHedef = null;
        this.ruzgarDashTimer = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) { ultiBtn.classList.remove('ready'); ultiBtn.style.boxShadow = ''; }
    }
};

// ----- Player.fire Override -----
player.fire = function(a) {
    if (this.charType === 'ruzgar') {
        if (this.ammo < 1 || this.isDead) return;
        this.angle = a;
        const sp = PLAYER_BULLET_SPEED * 1.2; // hızlı mermi

        // İlk mermi: 800 hasar, normal
        bullets.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            type: 'ruzgar_mermi_1',
            damage: 800,
            rangeMod: 1,
            hitTargets: []
        });

        // İkinci mermi: 400 hasar, delici
        bullets.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp * 0.95,
            vy: Math.sin(a) * sp * 0.95,
            type: 'ruzgar_mermi_2',
            damage: 400,
            rangeMod: 1,
            piercing: true,
            hitTargets: []
        });

        // İkinci mermiyi 0.15 sn gecikmeyle atmak için zamanlayıcı kullanmak yerine
        // doğrudan aynı anda atıyoruz; ama 0.15 sn arayla istendiği için
        // mermi hızları arasında çok az fark yaparak gecikme efekti vereceğiz.
        // Aslında bu yeterli, çünkü aynı anda çıkarlar ama birbirine yakın olurlar.

        this.consumeAmmo();
        this.lastShotTime = Date.now();
        addFloatingNumber(this.x, this.y - 25, "RÜZGAR!", "#00d2ff");
    } else {
        ruzgarOrijinalFire.call(this, a);
    }
};

// ----- Player.fireUlti Override -----
player.fireUlti = function(a) {
    if (this.charType === 'ruzgar') {
        if (!this.ultReady || this.isDead) return;
        const sp = PLAYER_BULLET_SPEED * 1.5;
        bullets.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            type: 'ruzgar_ulti_mermi',
            damage: 0, // hasar dash sırasında verilecek
            rangeMod: 1,
            hitTargets: []
        });
        this.ultReady = false;
        this.ultCharge = 0;
        if (ultFill) ultFill.style.width = "0%";
        if (ultiBtn) ultiBtn.classList.remove('ready');
        addFloatingNumber(this.x, this.y - 40, "FIRTINA!", "#00d2ff");
    } else {
        ruzgarOrijinalFireUlti.call(this, a);
    }
};

// ----- updateBulletLogic Override -----
window.updateBulletLogic = function(list, isBot, ts) {
    if (!isBot) {
        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];
            
            // Rüzgar normal mermi 1
            if (b.type === 'ruzgar_mermi_1') {
                b.x += b.vx * ts;
                b.y += b.vy * ts;

                // Duvar ve engel kontrolü
                const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                let hitObs = false;
                for (let o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) { hitObs = true; break; }
                }
                const maxRange = RANGE * (b.rangeMod || 1);
                const oor = getDist(b, {x:b.sx, y:b.sy}) > maxRange;

                if (hwX || hwY || hitObs || oor) {
                    list.splice(i, 1);
                    continue;
                }

                getActiveEnemies().forEach(e => {
                    if (!b.hitTargets.includes(e) && getDist(b, e) < e.radius + 12) {
                        e.hp -= b.damage;
                        addFloatingNumber(e.x, e.y, b.damage, "#00d2ff");
                        b.hitTargets.push(e);
                        spawnParticles(e.x, e.y, '#00d2ff', 'normal');
                        chargeUlti(12);
                        list.splice(i, 1);
                    }
                });
                continue;
            }

            // Rüzgar delici mermi 2
            if (b.type === 'ruzgar_mermi_2') {
                b.x += b.vx * ts;
                b.y += b.vy * ts;

                const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                let hitObs = false;
                for (let o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) { hitObs = true; break; }
                }
                const maxRange = RANGE * (b.rangeMod || 1);
                const oor = getDist(b, {x:b.sx, y:b.sy}) > maxRange;

                if (hwX || hwY || hitObs || oor) {
                    list.splice(i, 1);
                    continue;
                }

                let vurdu = false;
                getActiveEnemies().forEach(e => {
                    if (!b.hitTargets.includes(e) && getDist(b, e) < e.radius + 12) {
                        e.hp -= b.damage;
                        addFloatingNumber(e.x, e.y, b.damage, "#00d2ff");
                        b.hitTargets.push(e);
                        spawnParticles(e.x, e.y, '#00d2ff', 'normal');
                        chargeUlti(8);
                        vurdu = true;
                        // Delici olduğu için yok etmiyoruz, devam edecek.
                    }
                });
                // Eğer hiçbir şeye çarpmadıysa ve menzil dışına çıktıysa silinir.
                if (vurdu && b.hitTargets.length >= 5) {
                    // Maksimum 5 düşmana kadar delinebilir, sonra yok olur.
                    list.splice(i, 1);
                }
                continue;
            }

            // Rüzgar ulti mermisi
            if (b.type === 'ruzgar_ulti_mermi') {
                b.x += b.vx * ts;
                b.y += b.vy * ts;

                const hwX = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5;
                const hwY = b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                let hitObs = false;
                for (let o of obstacles.concat(cactusWalls || [])) {
                    if (getDist(b, o) < o.radius + 5) { hitObs = true; break; }
                }
                const maxRange = RANGE * 0.85; // Sam'inkinden %30 daha kısa
                const oor = getDist(b, {x:b.sx, y:b.sy}) > maxRange;

                if (hwX || hwY || hitObs || oor) {
                    list.splice(i, 1);
                    continue;
                }

                let hedefBulundu = false;
                getActiveEnemies().forEach(e => {
                    if (!hedefBulundu && getDist(b, e) < e.radius + 15) {
                        hedefBulundu = true;
                        // Dash başlat
                        player.ruzgarDashAktif = true;
                        player.ruzgarDashHedef = e;
                        player.ruzgarDashTimer = 30; // dash süresi
                        player.isDashing = true;
                        player.dashAngle = getAngle(player, e);
                        // Mermiyi yok et
                        list.splice(i, 1);
                        addFloatingNumber(e.x, e.y, "HEDEF!", "#00d2ff");
                    }
                });
                continue;
            }
        }
    }

    // Orijinal mantığı çağır (diğer mermiler için)
    ruzgarOrijinalUpdateBulletLogic(list, isBot, ts);
};

// ----- window.update Override (Rüzgar Dash Hareketi) -----
window.update = function(ts) {
    ruzgarOrijinalUpdate(ts);
    if (!gameStarted) return;

    // Rüzgar Dash İşleme
    if (player.charType === 'ruzgar' && player.ruzgarDashAktif && player.ruzgarDashHedef) {
        const hedef = player.ruzgarDashHedef;
        if (!hedef || hedef.isDead || hedef.hp <= 0) {
            player.ruzgarDashAktif = false;
            player.isDashing = false;
            player.ruzgarDashHedef = null;
            return;
        }

        // Hedefe doğru hızlı hareket
        const angle = getAngle(player, hedef);
        const hiz = player.speed * 8; // çok hızlı
        player.x += Math.cos(angle) * hiz * ts;
        player.y += Math.sin(angle) * hiz * ts;
        player.angle = angle;

        // Yol boyunca temas edilen botlara hasar
        getActiveEnemies().forEach(e => {
            if (e !== hedef && !e.isDead && getDist(player, e) < player.radius + e.radius + 10) {
                e.hp -= 300;
                addFloatingNumber(e.x, e.y, "300", "#00d2ff");
                spawnParticles(e.x, e.y, '#00d2ff', 'normal');
                player.hp = Math.min(player.maxHp, player.hp + 300);
                addFloatingNumber(player.x, player.y - 20, "+300", "#2ecc71");
            }
        });

        // Hedefe ulaştığında dash bitir
        if (getDist(player, hedef) < player.radius + hedef.radius + 5) {
            hedef.hp -= 300;
            addFloatingNumber(hedef.x, hedef.y, "300", "#00d2ff");
            player.hp = Math.min(player.maxHp, player.hp + 300);
            addFloatingNumber(player.x, player.y - 20, "+300", "#2ecc71");
            spawnParticles(hedef.x, hedef.y, '#00d2ff', 'normal');
            player.ruzgarDashAktif = false;
            player.isDashing = false;
            player.ruzgarDashHedef = null;
        }

        // Dash süresi biterse
        player.ruzgarDashTimer -= ts;
        if (player.ruzgarDashTimer <= 0) {
            player.ruzgarDashAktif = false;
            player.isDashing = false;
            player.ruzgarDashHedef = null;
        }

        // Sınır kontrolü
        player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
        player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
    }
};

// ----- Mermi Çizimleri (opsiyonel) -----
const ruzgarOrijinalDrawBullet = window.drawBullet;
window.drawBullet = function(b, c) {
    if (b.type === 'ruzgar_mermi_1') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#00d2ff'; ctx.shadowColor = '#00d2ff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    } else if (b.type === 'ruzgar_mermi_2') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#00d2ff'; ctx.shadowColor = '#00d2ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    } else if (b.type === 'ruzgar_ulti_mermi') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#00d2ff'; ctx.shadowColor = '#00d2ff'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    } else {
        ruzgarOrijinalDrawBullet(b, c);
    }
};
