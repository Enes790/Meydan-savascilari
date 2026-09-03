// ========== mod3.js (RÜZGAR) - GÜNCELLENMİŞ ==========
// - Ulti butonu artık görünür
// - Menzil kısaltıldı: normal saldırı 240, ulti 180
// - Nişan çizgisi eklendi

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

window.GAME_EXT.characters['ruzgar'] = {
    color: '#00d2ff',
    hp: 4200,
    speed: 4.0
};

const ruzgarOrijinalSetCharacter = player.setCharacter;
const ruzgarOrijinalFire = player.fire;
const ruzgarOrijinalFireUlti = player.fireUlti;
const ruzgarOrijinalUpdateBulletLogic = window.updateBulletLogic;
const ruzgarOrijinalUpdate = window.update;
const ruzgarOrijinalDraw = window.draw;
const ruzgarOrijinalStartGame = window.startGame;
const ruzgarOrijinalRestart = document.getElementById('restart-btn').click;

// ----- setCharacter -----
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

// ----- fire -----
player.fire = function(a) {
    if (this.charType === 'ruzgar') {
        if (this.ammo < 1 || this.isDead) return;
        this.angle = a;
        const sp = PLAYER_BULLET_SPEED * 1.2;

        bullets.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            type: 'ruzgar_mermi_1',
            damage: 800,
            rangeMod: 0.8,   // menzil: 240
            hitTargets: []
        });

        bullets.push({
            x: this.x, y: this.y,
            sx: this.x, sy: this.y,
            vx: Math.cos(a) * sp * 0.95,
            vy: Math.sin(a) * sp * 0.95,
            type: 'ruzgar_mermi_2',
            damage: 400,
            rangeMod: 0.8,
            piercing: true,
            hitTargets: []
        });

        this.consumeAmmo();
        this.lastShotTime = Date.now();
        addFloatingNumber(this.x, this.y - 25, "RÜZGAR!", "#00d2ff");
    } else {
        ruzgarOrijinalFire.call(this, a);
    }
};

// ----- fireUlti -----
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
            damage: 0,
            rangeMod: 0.6,   // menzil: 180
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

// ----- updateBulletLogic -----
window.updateBulletLogic = function(list, isBot, ts) {
    if (!isBot) {
        for (let i = list.length - 1; i >= 0; i--) {
            const b = list[i];

            if (b.type === 'ruzgar_mermi_1') {
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

                getActiveEnemies().forEach(e => {
                    if (!b.hitTargets.includes(e) && getDist(b, e) < e.radius + 12) {
                        e.hp -= b.damage;
                        addFloatingNumber(e.x, e.y, b.damage, "#00d2ff");
                        b.hitTargets.push(e);
                        spawnParticles(e.x, e.y, '#00d2ff', 'normal');
                        chargeUlti(8);
                        if (b.hitTargets.length >= 5) list.splice(i, 1);
                    }
                });
                continue;
            }

            if (b.type === 'ruzgar_ulti_mermi') {
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

                let hedefBulundu = false;
                getActiveEnemies().forEach(e => {
                    if (!hedefBulundu && getDist(b, e) < e.radius + 15) {
                        hedefBulundu = true;
                        player.ruzgarDashAktif = true;
                        player.ruzgarDashHedef = e;
                        player.ruzgarDashTimer = 30;
                        player.isDashing = true;
                        player.dashAngle = getAngle(player, e);
                        list.splice(i, 1);
                        addFloatingNumber(e.x, e.y, "HEDEF!", "#00d2ff");
                    }
                });
                continue;
            }
        }
    }
    ruzgarOrijinalUpdateBulletLogic(list, isBot, ts);
};

// ----- update -----
window.update = function(ts) {
    ruzgarOrijinalUpdate(ts);
    if (!gameStarted) return;

    if (player.charType === 'ruzgar' && player.ruzgarDashAktif && player.ruzgarDashHedef) {
        const hedef = player.ruzgarDashHedef;
        if (!hedef || hedef.isDead || hedef.hp <= 0) {
            player.ruzgarDashAktif = false;
            player.isDashing = false;
            player.ruzgarDashHedef = null;
            return;
        }

        const angle = getAngle(player, hedef);
        const hiz = player.speed * 8;
        player.x += Math.cos(angle) * hiz * ts;
        player.y += Math.sin(angle) * hiz * ts;
        player.angle = angle;

        getActiveEnemies().forEach(e => {
            if (e !== hedef && !e.isDead && getDist(player, e) < player.radius + e.radius + 10) {
                e.hp -= 300;
                addFloatingNumber(e.x, e.y, "300", "#00d2ff");
                spawnParticles(e.x, e.y, '#00d2ff', 'normal');
                player.hp = Math.min(player.maxHp, player.hp + 300);
                addFloatingNumber(player.x, player.y - 20, "+300", "#2ecc71");
            }
        });

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

        player.ruzgarDashTimer -= ts;
        if (player.ruzgarDashTimer <= 0) {
            player.ruzgarDashAktif = false;
            player.isDashing = false;
            player.ruzgarDashHedef = null;
        }

        player.x = clampPos(player.x, player.radius + WALL_THICKNESS, canvas.width - player.radius - WALL_THICKNESS);
        player.y = clampPos(player.y, player.radius + WALL_THICKNESS, canvas.height - player.radius - WALL_THICKNESS);
    }
};

// ----- draw (nişan çizgisi) -----
window.draw = function() {
    ruzgarOrijinalDraw();
    if (!gameStarted) return;

    if (player.charType === 'ruzgar' && aimData.active && player.ammo >= 1 && !player.isDead) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(aimData.angle);

        // İki mermi menzil göstergesi
        const normalMenzil = RANGE * 0.8;
        const deliciMenzil = RANGE * 0.8;

        // İlk mermi çizgisi (kalın)
        ctx.fillStyle = 'rgba(0, 210, 255, 0.2)';
        ctx.fillRect(0, -4, normalMenzil, 8);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -4, normalMenzil, 8);

        // İkinci mermi çizgisi (ince, hafif aşağıda)
        ctx.fillStyle = 'rgba(0, 210, 255, 0.15)';
        ctx.fillRect(0, 6, deliciMenzil, 4);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 6, deliciMenzil, 4);

        // Menzil sonu noktası
        ctx.beginPath();
        ctx.arc(normalMenzil, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00d2ff';
        ctx.fill();

        ctx.restore();
    }

    if (player.charType === 'ruzgar' && ultAim.active && player.ultReady && !player.isDead) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(ultAim.angle);
        const ultiMenzil = RANGE * 0.6;
        ctx.fillStyle = 'rgba(0, 210, 255, 0.25)';
        ctx.fillRect(0, -5, ultiMenzil, 10);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, -5, ultiMenzil, 10);
        ctx.restore();
    }
};

// ----- startGame override (ulti butonunu göster) -----
window.startGame = function() {
    ruzgarOrijinalStartGame();
    if (selectedCharacter === 'ruzgar') {
        ultiBtn.style.display = 'flex';
        gadgetBtn.style.display = 'none'; // Rüzgar'da gadget yok
        gadgetBtn2.style.display = 'none';
    }
};

// ----- restart butonuna ekleme -----
document.getElementById('restart-btn').addEventListener('click', () => {
    setTimeout(() => {
        if (selectedCharacter === 'ruzgar') {
            ultiBtn.style.display = 'none';
        }
    }, 100);
});

// ----- Mermi çizimleri -----
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