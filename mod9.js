// ========== mod8.js (ASKERİ ÜS) - UZAK DÖVÜŞ MODU ==========
// - Siperler iki kat canlı, askeri yeşil desenli.
// - Siper yıkılınca kaktüs duvarı gibi patlar, 4-5 yavaş mermi saçar.
// - Bu mermiler duvarlara da zarar verir, zincirleme patlama olabilir.
// - Botlar: Hızlı Okçu, Ağır Okçu, Kule Okçusu, Zehirli Okçu, Komutan Okçu.
// - Tüm botlar uzaktan saldırır, yaklaşmaz.

(function () {
    'use strict';

    const MOD_ID = 'askeri';

    // ========== Bot Sabitleri ==========
    const HIZLI_HP = 800;
    const HIZLI_SPEED = 1.0;
    const HIZLI_RADIUS = 16;
    const HIZLI_DAMAGE = 150;
    const HIZLI_MENZIL = 250;
    const HIZLI_ATIS_ARALIK = 30; // 0.5 saniye (60fps)
    const HIZLI_MERMI_HIZ = BOT_BULLET_SPEED * 1.2;
    const HIZLI_SPAWN_INTERVAL = 480; // 8 saniye
    const HIZLI_MAX = 4;
    const HIZLI_SPAWN_WARN = 120;

    const AGIR_HP = 1800;
    const AGIR_SPEED = 0.5;
    const AGIR_RADIUS = 20;
    const AGIR_DAMAGE = 800;
    const AGIR_MENZIL = 350;
    const AGIR_ATIS_ARALIK = 180; // 3 saniye
    const AGIR_MERMI_HIZ = BOT_BULLET_SPEED * 0.9;
    const AGIR_SPAWN_INTERVAL = 720; // 12 saniye
    const AGIR_MAX = 2;
    const AGIR_SPAWN_WARN = 150;

    const KULE_HP = 2500;
    const KULE_RADIUS = 28;
    const KULE_DAMAGE = 600;
    const KULE_MENZIL = 500;
    const KULE_ATIS_ARALIK = 120; // 2 saniye
    const KULE_MERMI_HIZ = BOT_BULLET_SPEED * 1.0;
    const KULE_SPAWN_INTERVAL = 1200; // 20 saniye
    const KULE_MAX = 4;
    const KULE_SPAWN_WARN = 180;
    const KULE_BASLANGIC_ADET = 2;

    const ZEHIR_HP = 1200;
    const ZEHIR_SPEED = 0.8;
    const ZEHIR_RADIUS = 18;
    const ZEHIR_DAMAGE = 200;
    const ZEHIR_DOT = 50; // saniyede zehir hasarı
    const ZEHIR_DOT_SURE = 180; // 3 saniye
    const ZEHIR_MENZIL = 220;
    const ZEHIR_ATIS_ARALIK = 90; // 1.5 saniye
    const ZEHIR_MERMI_HIZ = BOT_BULLET_SPEED * 1.0;
    const ZEHIR_SPAWN_INTERVAL = 600; // 10 saniye
    const ZEHIR_MAX = 3;
    const ZEHIR_SPAWN_WARN = 120;

    const KOMUTAN_HP = 1500;
    const KOMUTAN_SPEED = 0.6;
    const KOMUTAN_RADIUS = 22;
    const KOMUTAN_DAMAGE = 300;
    const KOMUTAN_MENZIL = 300;
    const KOMUTAN_ATIS_ARALIK = 120; // 2 saniye
    const KOMUTAN_MERMI_HIZ = BOT_BULLET_SPEED * 1.0;
    const KOMUTAN_SPAWN_INTERVAL = 1500; // 25 saniye
    const KOMUTAN_MAX = 1;
    const KOMUTAN_SPAWN_WARN = 180;
    const KOMUTAN_AURA_YARICAP = 200;

    // Siper patlama
    const SIPER_PATLAMA_MERMI_SAYISI = 5;
    const SIPER_PATLAMA_HASAR = 100;
    const SIPER_PATLAMA_MERMI_HIZ = BOT_BULLET_SPEED * 0.5; // yavaş
    const SIPER_PATLAMA_MENZIL = 150;
    const SIPER_CAN_CARPANI = 2; // siper canı iki kat

    // ========== Değişkenler ==========
    let hizliOkcular = [];
    let agirOkcular = [];
    let kuleOkculari = [];
    let zehirliOkcular = [];
    let komutanOkcular = [];
    let askeriSpawnUyarilari = [];
    let askeriSpawnTimer = { hizli: 0, agir: 0, kule: 0, zehir: 0, komutan: 0 };
    let askeriSiperParcalari = [];

    // ========== MOD KAYDI ==========
    window.GAME_EXT.registerMode(MOD_ID, {
        label: 'Askeri Üs',
        onStart: function () {
            hizliOkcular = [];
            agirOkcular = [];
            kuleOkculari = [];
            zehirliOkcular = [];
            komutanOkcular = [];
            askeriSpawnUyarilari = [];
            askeriSiperParcalari = [];
            askeriSpawnTimer = { hizli: 0, agir: 0, kule: 0, zehir: 0, komutan: 0 };

            // Orijinal botları devre dışı bırak
            bot.isActive = false;
            bot.isDead = true;
            bot2.isActive = false;
            bot2.isDead = true;
            slimeBots = [];
            stationaryBots = [];
            boomerangBots = [];
            fogBots = [];
            nests = [];
            spawnIndicators = [];

            // Siperlerin canını iki kat yap
            obstacles.forEach(o => {
                o.maxHp = 1600; // normal 800'ün iki katı
                o.hp = o.maxHp;
            });

            // Başlangıç kule okçuları
            const kuleKonumlari = [
                { x: WALL_THICKNESS + 60, y: WALL_THICKNESS + 60 },
                { x: canvas.width - WALL_THICKNESS - 60, y: WALL_THICKNESS + 60 },
                { x: WALL_THICKNESS + 60, y: canvas.height - WALL_THICKNESS - 60 },
                { x: canvas.width - WALL_THICKNESS - 60, y: canvas.height - WALL_THICKNESS - 60 }
            ];
            for (let i = 0; i < KULE_BASLANGIC_ADET; i++) {
                const pos = kuleKonumlari[i];
                kuleOkculari.push(createKuleOkcu(pos.x, pos.y));
            }
        },

        onUpdate: function (ts) {
            // Orijinal bot spawn timerlarını sıfırla
            slimeTimer = 0;
            stationaryTimer = 0;
            boomerangTimer = 0;
            fogBotTimer = 0;
            spawnIndicators = [];

            // Spawn yönetimi
            askeriSpawnTimer.hizli += ts;
            if (askeriSpawnTimer.hizli >= HIZLI_SPAWN_INTERVAL && hizliOkcular.length < HIZLI_MAX) {
                askeriSpawnTimer.hizli = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                askeriSpawnUyarilari.push({ x, y, timer: HIZLI_SPAWN_WARN, tip: 'hizli' });
            }

            askeriSpawnTimer.agir += ts;
            if (askeriSpawnTimer.agir >= AGIR_SPAWN_INTERVAL && agirOkcular.length < AGIR_MAX) {
                askeriSpawnTimer.agir = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                askeriSpawnUyarilari.push({ x, y, timer: AGIR_SPAWN_WARN, tip: 'agir' });
            }

            askeriSpawnTimer.kule += ts;
            if (askeriSpawnTimer.kule >= KULE_SPAWN_INTERVAL && kuleOkculari.length < KULE_MAX) {
                askeriSpawnTimer.kule = 0;
                const kose = Math.floor(Math.random() * 4);
                const konumlar = [
                    { x: WALL_THICKNESS + 60, y: canvas.height / 2 },
                    { x: canvas.width - WALL_THICKNESS - 60, y: canvas.height / 2 },
                    { x: canvas.width / 2, y: WALL_THICKNESS + 60 },
                    { x: canvas.width / 2, y: canvas.height - WALL_THICKNESS - 60 }
                ];
                askeriSpawnUyarilari.push({ x: konumlar[kose].x, y: konumlar[kose].y, timer: KULE_SPAWN_WARN, tip: 'kule' });
            }

            askeriSpawnTimer.zehir += ts;
            if (askeriSpawnTimer.zehir >= ZEHIR_SPAWN_INTERVAL && zehirliOkcular.length < ZEHIR_MAX) {
                askeriSpawnTimer.zehir = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                askeriSpawnUyarilari.push({ x, y, timer: ZEHIR_SPAWN_WARN, tip: 'zehir' });
            }

            askeriSpawnTimer.komutan += ts;
            if (askeriSpawnTimer.komutan >= KOMUTAN_SPAWN_INTERVAL && komutanOkcular.length < KOMUTAN_MAX) {
                askeriSpawnTimer.komutan = 0;
                const x = Math.random() * (canvas.width - 200) + 100;
                const y = Math.random() * (canvas.height - 200) + 100;
                askeriSpawnUyarilari.push({ x, y, timer: KOMUTAN_SPAWN_WARN, tip: 'komutan' });
            }

            // Spawn uyarılarını işle
            for (let i = askeriSpawnUyarilari.length - 1; i >= 0; i--) {
                const u = askeriSpawnUyarilari[i];
                u.timer -= ts;
                if (u.timer <= 0) {
                    switch (u.tip) {
                        case 'hizli':
                            hizliOkcular.push(createHizliOkcu(u.x, u.y));
                            break;
                        case 'agir':
                            agirOkcular.push(createAgirOkcu(u.x, u.y));
                            break;
                        case 'kule':
                            kuleOkculari.push(createKuleOkcu(u.x, u.y));
                            break;
                        case 'zehir':
                            zehirliOkcular.push(createZehirliOkcu(u.x, u.y));
                            break;
                        case 'komutan':
                            komutanOkcular.push(createKomutanOkcu(u.x, u.y));
                            break;
                    }
                    askeriSpawnUyarilari.splice(i, 1);
                }
            }

            // Bot davranışları
            updateHizliOkcular(ts);
            updateAgirOkcular(ts);
            updateKuleOkculari(ts);
            updateZehirliOkcular(ts);
            updateKomutanOkcular(ts);

            // Siper patlama mermilerini güncelle
            updateSiperParcalari(ts);

            // Siperlerin canını iki kat yap (yeni eklenenler için)
            obstacles.forEach(o => {
                if (!o._askeriCanAyarla) {
                    o.maxHp = 1600;
                    o.hp = 1600;
                    o._askeriCanAyarla = true;
                }
            });
        },

        onReset: function () {
            hizliOkcular = [];
            agirOkcular = [];
            kuleOkculari = [];
            zehirliOkcular = [];
            komutanOkcular = [];
            askeriSpawnUyarilari = [];
            askeriSiperParcalari = [];
            askeriSpawnTimer = { hizli: 0, agir: 0, kule: 0, zehir: 0, komutan: 0 };
        }
    });

    // ========== Bot Oluşturma Fonksiyonları ==========
    function createHizliOkcu(x, y) {
        return {
            x, y, radius: HIZLI_RADIUS,
            hp: HIZLI_HP, maxHp: HIZLI_HP,
            speed: HIZLI_SPEED, baseSpeed: HIZLI_SPEED,
            angle: 0, lastShot: 0, isDead: false, isActive: true,
            color: '#8B8B00', tip: 'hizli',
            kbX: 0, kbY: 0, oSp: HIZLI_SPEED, oR: HIZLI_RADIUS,
            askeriBotu: true
        };
    }

    function createAgirOkcu(x, y) {
        return {
            x, y, radius: AGIR_RADIUS,
            hp: AGIR_HP, maxHp: AGIR_HP,
            speed: AGIR_SPEED, baseSpeed: AGIR_SPEED,
            angle: 0, lastShot: 0, isDead: false, isActive: true,
            color: '#5D6D3A', tip: 'agir',
            kbX: 0, kbY: 0, oSp: AGIR_SPEED, oR: AGIR_RADIUS,
            askeriBotu: true
        };
    }

    function createKuleOkcu(x, y) {
        return {
            x, y, radius: KULE_RADIUS,
            hp: KULE_HP, maxHp: KULE_HP,
            speed: 0, baseSpeed: 0,
            angle: 0, lastShot: 0, isDead: false, isActive: true,
            color: '#4A5D23', tip: 'kule',
            kbX: 0, kbY: 0, oSp: 0, oR: KULE_RADIUS,
            askeriBotu: true, isKule: true
        };
    }

    function createZehirliOkcu(x, y) {
        return {
            x, y, radius: ZEHIR_RADIUS,
            hp: ZEHIR_HP, maxHp: ZEHIR_HP,
            speed: ZEHIR_SPEED, baseSpeed: ZEHIR_SPEED,
            angle: 0, lastShot: 0, isDead: false, isActive: true,
            color: '#9ACD32', tip: 'zehir',
            kbX: 0, kbY: 0, oSp: ZEHIR_SPEED, oR: ZEHIR_RADIUS,
            askeriBotu: true, zehirDOT: ZEHIR_DOT, zehirDOTSuresi: ZEHIR_DOT_SURE
        };
    }

    function createKomutanOkcu(x, y) {
        return {
            x, y, radius: KOMUTAN_RADIUS,
            hp: KOMUTAN_HP, maxHp: KOMUTAN_HP,
            speed: KOMUTAN_SPEED, baseSpeed: KOMUTAN_SPEED,
            angle: 0, lastShot: 0, isDead: false, isActive: true,
            color: '#6B8E23', tip: 'komutan',
            kbX: 0, kbY: 0, oSp: KOMUTAN_SPEED, oR: KOMUTAN_RADIUS,
            askeriBotu: true, auraAktif: false
        };
    }

    // ========== Bot Güncelleme Fonksiyonları ==========
    function updateHizliOkcular(ts) {
        for (let i = hizliOkcular.length - 1; i >= 0; i--) {
            const b = hizliOkcular[i];
            if (b.hp <= 0 && !b.isDead) {
                b.isDead = true;
                spawnParticles(b.x, b.y, '#8B8B00', 'normal');
                triggerBotKill(b.x, b);
            }
            if (b.isDead) { hizliOkcular.splice(i, 1); continue; }

            const canSeePlayer = !player.isDead && !player.isInvisible;
            if (canSeePlayer) {
                b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                const d = getDist(b, player);
                if (d > HIZLI_MENZIL) {
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                } else if (d < 150) {
                    b.x -= Math.cos(b.angle) * b.speed * ts;
                    b.y -= Math.sin(b.angle) * b.speed * ts;
                }
                if (d < HIZLI_MENZIL + 50 && Date.now() - b.lastShot > HIZLI_ATIS_ARALIK) {
                    b.lastShot = Date.now();
                    botBullets.push({
                        x: b.x, y: b.y, sx: b.x, sy: b.y,
                        vx: Math.cos(b.angle) * HIZLI_MERMI_HIZ,
                        vy: Math.sin(b.angle) * HIZLI_MERMI_HIZ,
                        dmgMod: 1, type: 'askeri_hizli_ok', owner: b
                    });
                }
            }
            hareketVeSinir(b, ts);
        }
    }

    function updateAgirOkcular(ts) {
        for (let i = agirOkcular.length - 1; i >= 0; i--) {
            const b = agirOkcular[i];
            if (b.hp <= 0 && !b.isDead) {
                b.isDead = true;
                spawnParticles(b.x, b.y, '#5D6D3A', 'smoke');
                triggerBotKill(b.x, b);
            }
            if (b.isDead) { agirOkcular.splice(i, 1); continue; }

            const canSeePlayer = !player.isDead && !player.isInvisible;
            if (canSeePlayer) {
                b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                const d = getDist(b, player);
                if (d > AGIR_MENZIL) {
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                } else if (d < 200) {
                    b.x -= Math.cos(b.angle) * b.speed * ts;
                    b.y -= Math.sin(b.angle) * b.speed * ts;
                }
                if (d < AGIR_MENZIL + 50 && Date.now() - b.lastShot > AGIR_ATIS_ARALIK) {
                    b.lastShot = Date.now();
                    botBullets.push({
                        x: b.x, y: b.y, sx: b.x, sy: b.y,
                        vx: Math.cos(b.angle) * AGIR_MERMI_HIZ,
                        vy: Math.sin(b.angle) * AGIR_MERMI_HIZ,
                        dmgMod: 1, type: 'askeri_agir_ok', owner: b
                    });
                }
            }
            hareketVeSinir(b, ts);
        }
    }

    function updateKuleOkculari(ts) {
        for (let i = kuleOkculari.length - 1; i >= 0; i--) {
            const b = kuleOkculari[i];
            if (b.hp <= 0 && !b.isDead) {
                b.isDead = true;
                spawnParticles(b.x, b.y, '#4A5D23', 'smoke');
                triggerBotKill(b.x, b);
            }
            if (b.isDead) { kuleOkculari.splice(i, 1); continue; }

            const canSeePlayer = !player.isDead && !player.isInvisible;
            if (canSeePlayer) {
                b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                const d = getDist(b, player);
                if (d < KULE_MENZIL && Date.now() - b.lastShot > KULE_ATIS_ARALIK) {
                    b.lastShot = Date.now();
                    botBullets.push({
                        x: b.x, y: b.y, sx: b.x, sy: b.y,
                        vx: Math.cos(b.angle) * KULE_MERMI_HIZ,
                        vy: Math.sin(b.angle) * KULE_MERMI_HIZ,
                        dmgMod: 1, type: 'askeri_kule_ok', owner: b
                    });
                }
            }
            // Kule hareket etmez, sadece sınır kontrolü
            b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
            b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
        }
    }

    function updateZehirliOkcular(ts) {
        for (let i = zehirliOkcular.length - 1; i >= 0; i--) {
            const b = zehirliOkcular[i];
            if (b.hp <= 0 && !b.isDead) {
                b.isDead = true;
                spawnParticles(b.x, b.y, '#9ACD32', 'smoke');
                triggerBotKill(b.x, b);
            }
            if (b.isDead) { zehirliOkcular.splice(i, 1); continue; }

            const canSeePlayer = !player.isDead && !player.isInvisible;
            if (canSeePlayer) {
                b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                const d = getDist(b, player);
                if (d > ZEHIR_MENZIL) {
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                } else if (d < 140) {
                    b.x -= Math.cos(b.angle) * b.speed * ts;
                    b.y -= Math.sin(b.angle) * b.speed * ts;
                }
                if (d < ZEHIR_MENZIL + 30 && Date.now() - b.lastShot > ZEHIR_ATIS_ARALIK) {
                    b.lastShot = Date.now();
                    botBullets.push({
                        x: b.x, y: b.y, sx: b.x, sy: b.y,
                        vx: Math.cos(b.angle) * ZEHIR_MERMI_HIZ,
                        vy: Math.sin(b.angle) * ZEHIR_MERMI_HIZ,
                        dmgMod: 1, type: 'askeri_zehir_ok', owner: b
                    });
                }
            }
            hareketVeSinir(b, ts);
        }
    }

    function updateKomutanOkcular(ts) {
        for (let i = komutanOkcular.length - 1; i >= 0; i--) {
            const b = komutanOkcular[i];
            if (b.hp <= 0 && !b.isDead) {
                b.isDead = true;
                spawnParticles(b.x, b.y, '#6B8E23', 'smoke');
                triggerBotKill(b.x, b);
                // Ölünce tüm botlar kısa süre hızlanır
                tumBotlarHizlan(300);
            }
            if (b.isDead) { komutanOkcular.splice(i, 1); continue; }

            const canSeePlayer = !player.isDead && !player.isInvisible;
            if (canSeePlayer) {
                b.angle = Math.atan2(player.y - b.y, player.x - b.x);
                const d = getDist(b, player);
                if (d > KOMUTAN_MENZIL) {
                    b.x += Math.cos(b.angle) * b.speed * ts;
                    b.y += Math.sin(b.angle) * b.speed * ts;
                } else if (d < 180) {
                    b.x -= Math.cos(b.angle) * b.speed * ts;
                    b.y -= Math.sin(b.angle) * b.speed * ts;
                }
                if (d < KOMUTAN_MENZIL + 30 && Date.now() - b.lastShot > KOMUTAN_ATIS_ARALIK) {
                    b.lastShot = Date.now();
                    botBullets.push({
                        x: b.x, y: b.y, sx: b.x, sy: b.y,
                        vx: Math.cos(b.angle) * KOMUTAN_MERMI_HIZ,
                        vy: Math.sin(b.angle) * KOMUTAN_MERMI_HIZ,
                        dmgMod: 1, type: 'askeri_komutan_ok', owner: b
                    });
                }
            }
            // Aura: yakındaki botların atış hızını artır
            const auraYaricap = KOMUTAN_AURA_YARICAP;
            tumAskeriBotlar().forEach(diger => {
                if (diger !== b && getDist(b, diger) < auraYaricap) {
                    diger._komutanAura = true;
                }
            });
            hareketVeSinir(b, ts);
        }
    }

    function hareketVeSinir(b, ts) {
        if (Math.abs(b.kbX) > 0.1 || Math.abs(b.kbY) > 0.1) {
            b.x += b.kbX * ts;
            b.y += b.kbY * ts;
            b.kbX *= 0.85;
            b.kbY *= 0.85;
        }
        b.x = clampPos(b.x, b.radius + WALL_THICKNESS, canvas.width - b.radius - WALL_THICKNESS);
        b.y = clampPos(b.y, b.radius + WALL_THICKNESS, canvas.height - b.radius - WALL_THICKNESS);
        resolveObstacleCollision(b);
    }

    function tumAskeriBotlar() {
        return hizliOkcular.concat(agirOkcular).concat(kuleOkculari)
            .concat(zehirliOkcular).concat(komutanOkcular)
            .filter(b => !b.isDead);
    }

    function tumBotlarHizlan(sure) {
        tumAskeriBotlar().forEach(b => {
            b._geciciHizArtisi = sure;
        });
    }

    // ========== Siper Patlama ==========
    function siperPatlat(o) {
        spawnParticles(o.x, o.y, '#5D6D3A', 'smoke');
        for (let k = 0; k < SIPER_PATLAMA_MERMI_SAYISI; k++) {
            const ang = Math.random() * Math.PI * 2;
            const hiz = SIPER_PATLAMA_MERMI_HIZ * (0.7 + Math.random() * 0.6);
            askeriSiperParcalari.push({
                x: o.x, y: o.y, sx: o.x, sy: o.y,
                vx: Math.cos(ang) * hiz,
                vy: Math.sin(ang) * hiz,
                hasar: SIPER_PATLAMA_HASAR,
                menzil: SIPER_PATLAMA_MENZIL,
                isDead: false,
                hitTargets: []
            });
        }
        // Diğer siperlere de zincirleme hasar verme ihtimali
        obstacles.forEach(diger => {
            if (diger !== o && getDist(o, diger) < SIPER_PATLAMA_MENZIL + diger.radius) {
                // Biraz hasar ver, yeterince hasar alırsa o da patlar
                diger.hp -= SIPER_PATLAMA_HASAR * 0.5;
                if (diger.hp <= 0) {
                    setTimeout(() => {
                        if (obstacles.includes(diger)) {
                            siperPatlat(diger);
                            obstacles.splice(obstacles.indexOf(diger), 1);
                        }
                    }, 200);
                }
            }
        });
        addFloatingNumber(o.x, o.y, "SİPER PATLADI!", "#8B8B00");
    }

    function updateSiperParcalari(ts) {
        for (let i = askeriSiperParcalari.length - 1; i >= 0; i--) {
            const p = askeriSiperParcalari[i];
            if (p.isDead) { askeriSiperParcalari.splice(i, 1); continue; }

            p.x += p.vx * ts;
            p.y += p.vy * ts;

            const hw = p.x < WALL_THICKNESS + 5 || p.x > canvas.width - WALL_THICKNESS - 5 ||
                p.y < WALL_THICKNESS + 5 || p.y > canvas.height - WALL_THICKNESS - 5;
            const mesafe = getDist({ x: p.sx, y: p.sy }, p);
            if (hw || mesafe > p.menzil) {
                p.isDead = true;
                continue;
            }

            // Oyuncuya çarpma
            if (!player.isDead && getDist(p, player) < player.radius + 6) {
                player.hp -= p.hasar;
                addFloatingNumber(player.x, player.y, p.hasar, "#8B8B00");
                player.lastHitTime = Date.now();
                p.isDead = true;
                continue;
            }

            // Diğer siperlere çarpma
            for (const o of obstacles) {
                if (getDist(p, o) < o.radius + 6) {
                    o.hp -= p.hasar;
                    addFloatingNumber(o.x, o.y, p.hasar, "#8B8B00");
                    if (o.hp <= 0) {
                        siperPatlat(o);
                        // Obstacle dizisinden çıkarılması ana döngüde olacak
                    }
                    p.isDead = true;
                    break;
                }
            }

            // Düşmanlara çarpma (askeri botlar dahil)
            if (!p.isDead) {
                for (const e of getActiveEnemies()) {
                    if (getDist(p, e) < e.radius + 6) {
                        e.hp -= p.hasar;
                        addFloatingNumber(e.x, e.y, p.hasar, "#8B8B00");
                        p.isDead = true;
                        break;
                    }
                }
            }
        }
    }

    // ========== MERMİ ÇARPIŞMA (Bot mermileri) ==========
    const originalUpdateBulletLogic = window.updateBulletLogic;
    window.updateBulletLogic = function (list, isBot, ts) {
        if (isBot && window.GAME_MODE === MOD_ID) {
            for (let i = list.length - 1; i >= 0; i--) {
                const b = list[i];
                if (b.type && b.type.startsWith('askeri_')) {
                    b.x += b.vx * ts;
                    b.y += b.vy * ts;

                    const hw = b.x < WALL_THICKNESS + 5 || b.x > canvas.width - WALL_THICKNESS - 5 ||
                        b.y < WALL_THICKNESS + 5 || b.y > canvas.height - WALL_THICKNESS - 5;
                    let hitObs = false;
                    for (const o of obstacles) {
                        if (getDist(b, o) < o.radius + 5) {
                            o.hp -= b.type === 'askeri_agir_ok' ? 300 : 150;
                            hitObs = true;
                            break;
                        }
                    }
                    if (hw || hitObs || getDist(b, { x: b.sx, y: b.sy }) > 600) {
                        list.splice(i, 1);
                        continue;
                    }

                    if (!player.isDead && getDist(b, player) < player.radius + 10) {
                        let dmg = b.dmgMod ? (b.type === 'askeri_agir_ok' ? AGIR_DAMAGE : HIZLI_DAMAGE) : 0;
                        if (b.type === 'askeri_zehir_ok') {
                            dmg = ZEHIR_DAMAGE;
                            // Zehir uygula
                            player._askeriZehir = { hasar: ZEHIR_DOT, sure: ZEHIR_DOT_SURE };
                        }
                        player.hp -= dmg;
                        addFloatingNumber(player.x, player.y, dmg, "#8B8B00");
                        player.lastHitTime = Date.now();
                        list.splice(i, 1);
                        continue;
                    }
                }
            }
            // Zehir etkisini güncelle
            if (player._askeriZehir && player._askeriZehir.sure > 0) {
                player._askeriZehir.sure -= ts;
                player.hp -= (player._askeriZehir.hasar / 60) * ts;
                if (player._askeriZehir.sure <= 0) delete player._askeriZehir;
            }
        }
        originalUpdateBulletLogic(list, isBot, ts);
    };

    // ========== BOTLARI LİSTEYE EKLE ==========
    window.GAME_EXT.chainHook('getExtraEnemies', function () {
        if (window.GAME_MODE !== MOD_ID) return undefined;
        return tumAskeriBotlar();
    });

    // ========== SİPER YIKILMA KONTROLÜ ==========
    window.GAME_EXT.chainHook('onUpdate', function (ts) {
        if (window.GAME_MODE !== MOD_ID) return;
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            if (o.hp <= 0) {
                siperPatlat(o);
                spawnParticles(o.x, o.y, '#5D6D3A', 'smoke');
                obstacles.splice(i, 1);
            }
        }
    });

    // ========== ÇİZİM ==========
    window.GAME_EXT.chainHook('onDraw', function (ctx2) {
        if (window.GAME_MODE !== MOD_ID || !gameStarted) return;

        // Siperleri askeri yeşil desenle çiz
        for (const o of obstacles) {
            ctx2.save();
            ctx2.translate(o.x, o.y);
            // Askeri yeşil zemin
            ctx2.fillStyle = '#4B5320';
            ctx2.beginPath();
            ctx2.roundRect(-o.radius, -o.radius, o.radius * 2, o.radius * 2, 8);
            ctx2.fill();
            ctx2.strokeStyle = '#3A3F1B';
            ctx2.lineWidth = 2;
            ctx2.stroke();
            // Desen: noktalar ve lekeler
            ctx2.fillStyle = '#5D6D3A';
            for (let dx = -o.radius + 5; dx < o.radius; dx += 12) {
                for (let dy = -o.radius + 5; dy < o.radius; dy += 12) {
                    if (Math.random() < 0.4) continue;
                    ctx2.beginPath();
                    ctx2.arc(dx + Math.random() * 4, dy + Math.random() * 4, 2, 0, Math.PI * 2);
                    ctx2.fill();
                }
            }
            ctx2.fillStyle = '#e74c3c';
            ctx2.fillRect(-o.radius, -o.radius - 12, o.radius * 2 * (o.hp / o.maxHp), 4);
            ctx2.restore();
        }

        // Spawn uyarıları
        askeriSpawnUyarilari.forEach(u => {
            ctx2.save();
            ctx2.translate(u.x, u.y);
            ctx2.globalAlpha = Math.abs(Math.sin(Date.now() / 150));
            ctx2.beginPath();
            ctx2.arc(0, 0, 25, 0, Math.PI * 2);
            ctx2.strokeStyle = '#8B8B00';
            ctx2.lineWidth = 3;
            ctx2.stroke();
            ctx2.globalAlpha = 1;
            ctx2.fillStyle = '#8B8B00';
            ctx2.font = "bold 14px Arial";
            ctx2.textAlign = "center";
            ctx2.fillText(Math.ceil(u.timer / 60), 0, 5);
            ctx2.restore();
        });

        // Botları çiz
        hizliOkcular.forEach(b => { if (!b.isDead) cizAskeriBot(ctx2, b, '#8B8B00', 'H'); });
        agirOkcular.forEach(b => { if (!b.isDead) cizAskeriBot(ctx2, b, '#5D6D3A', 'A'); });
        kuleOkculari.forEach(b => { if (!b.isDead) cizAskeriBot(ctx2, b, '#4A5D23', 'K'); });
        zehirliOkcular.forEach(b => { if (!b.isDead) cizAskeriBot(ctx2, b, '#9ACD32', 'Z'); });
        komutanOkcular.forEach(b => { if (!b.isDead) cizAskeriBot(ctx2, b, '#6B8E23', 'C'); });

        // Siper parçaları
        askeriSiperParcalari.forEach(p => {
            if (p.isDead) return;
            ctx2.save();
            ctx2.translate(p.x, p.y);
            ctx2.rotate(Math.atan2(p.vy, p.vx));
            ctx2.fillStyle = '#8B8B00';
            ctx2.fillRect(-5, -2, 10, 4);
            ctx2.restore();
        });
    });

    function cizAskeriBot(ctx2, b, renk, harf) {
        ctx2.save();
        ctx2.translate(b.x, b.y);
        // Can barı
        ctx2.fillStyle = '#e74c3c';
        ctx2.fillRect(-b.radius, -b.radius - 10, b.radius * 2, 4);
        ctx2.fillStyle = '#2ecc71';
        ctx2.fillRect(-b.radius, -b.radius - 10, b.radius * 2 * (b.hp / b.maxHp), 4);
        // Gövde
        ctx2.rotate(b.angle);
        ctx2.fillStyle = renk;
        ctx2.beginPath();
        ctx2.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.strokeStyle = '#333';
        ctx2.lineWidth = 2;
        ctx2.stroke();
        // Silah (yay)
        ctx2.strokeStyle = '#333';
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.arc(b.radius + 4, 0, 8, -0.8, 0.8);
        ctx2.stroke();
        ctx2.beginPath();
        ctx2.moveTo(b.radius + 2, -6);
        ctx2.lineTo(b.radius + 2, 6);
        ctx2.stroke();
        // Harf göstergesi
        ctx2.rotate(-b.angle);
        ctx2.fillStyle = '#fff';
        ctx2.font = "bold 10px Arial";
        ctx2.textAlign = "center";
        ctx2.fillText(harf, 0, 4);
        ctx2.restore();
    }

    // ========== MOD SEÇİM KARTI ==========
    const track = document.getElementById('difficulty-track');
    if (track && !document.getElementById('diff-askeri')) {
        const card = document.createElement('div');
        card.className = 'diff-card';
        card.id = 'diff-askeri';
        card.style.flex = '0 0 auto';
        card.style.width = 'min(76vw,300px)';
        card.style.margin = '5px auto';
        card.style.padding = '15px 10px';
        card.innerHTML =
            '<span>Askeri Üs</span>' +
            '<small>Uzak dövüş modu<br>Siperler patlayıcı</small>';
        track.appendChild(card);

        card.addEventListener('click', () => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        });
        card.addEventListener('touchstart', (e) => {
            document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            window.GAME_MODE = MOD_ID;
        }, { passive: true });
    }

    console.log('Askeri Üs modu yüklendi.');
})();