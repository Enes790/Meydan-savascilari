import {CFG, PL} from './config.js';
import {cl, ri, rf, col} from './utils.js';
import {Board} from './entities.js';
import {Boom} from './effects.js';
import {Pea, Needle, Shell, Sun} from './projectiles.js';
import {Zombie} from './zombies.js';
import {Plant, Mini} from './plants.js';

export class Game {
  constructor(cv){
    this.cv = cv;
    this.ctx = cv.getContext("2d");
    this.width = 0;
    this.height = 0;
    this.lastTime = 0;
    this._fps = 0;
    this._fr = 0;
    this._ft = 0;
    this.state = "menu";
    this.selectedPlants = ["sunflower","peashooter","wallnut","mine"];
    this._loop = this.loop.bind(this);
  }

  // ============ STATE ============
  showMenu(){
    this.state = "menu";
    document.getElementById("menu").classList.remove("h");
    document.getElementById("ps").classList.add("h");
    document.getElementById("topbar").style.display = "none";
    document.getElementById("dbg").style.display = "none";
    document.getElementById("go").style.display = "none";
  }

  showPlantSelect(){
    this.state = "plantSelect";
    document.getElementById("menu").classList.add("h");
    document.getElementById("ps").classList.remove("h");
    document.getElementById("topbar").style.display = "none";
    document.getElementById("dbg").style.display = "none";
    document.getElementById("go").style.display = "none";
    this.renderPS();
  }

  startFromSelection(){
    if(this.state === "playing") return;
    this.reset();
    this.state = "playing";
    document.getElementById("menu").classList.add("h");
    document.getElementById("ps").classList.add("h");
    document.getElementById("topbar").style.display = "flex";
    document.getElementById("dbg").style.display = "block";
    document.getElementById("go").style.display = "none";
    this.lastTime = performance.now();
  }

  goToMenu(){ this.showMenu(); }

  gameOver(){
    if(this.state === "over") return;
    this.state = "over";
    document.getElementById("go").style.display = "flex";
  }

  // ============ ANA KÖK KILL ============
  onMotherKill(mother, z){
    const c = this.board.cellAt(z.x+z.w/2, z.y+z.h/2);
    if(!c) return;
    let occ = !this.board.isFree(c.row, c.col);
    if(!occ){
      for(const m of this.minis){
        if(m.alive && m.row===c.row && m.col===c.col){ occ=1; break; }
      }
    }
    if(occ){
      mother.burstCount = PL.anakok.burst;
      mother.burstTimer = 0;
      mother.restTimer = 0;
    } else {
      const cc = this.board.center(c.row, c.col);
      const w = this.board.cw*.6, h = this.board.ch*.6;
      this.minis.push(new Mini(c.row, c.col, cc.x-w/2, cc.y-h/2, w, h));
    }
  }

  // ============ SHELL PATLAMA ============
  explodeShell(s){
    const isAna = s.owner && s.owner.type==="anakok";
    const maxT = isAna ? 1 : PL.alev.max;
    const r = this.board.cw * PL.alev.lRT;
    const arr = [];
    for(const z of this.zombies){
      if(!z.alive || z.row !== s.row) continue;
      const d = Math.abs(z.x+z.w/2 - s.ex);
      if(d <= r) arr.push({z, d});
    }
    arr.sort((a,b) => a.d - b.d);
    for(const t of arr.slice(0, maxT)){
      t.z.hit(s.dmg);
      if(!isAna) t.z.burnTimer = PL.alev.bT;
      if(!t.z.alive && isAna && s.owner.alive) this.onMotherKill(s.owner, t.z);
    }
    if(!isAna){
      const cy = this.board.oy + s.row*this.board.ch + this.board.ch/2;
      this.effects.push(new Boom(s.ex, cy, this.board.cw, ["255,140,0","255,60,0"]));
    }
  }

  // ============ SEÇİM EKRANI ============
  renderPS(){
    const g = document.getElementById("grid");
    g.innerHTML = "";
    for(const [t, d] of Object.entries(PL)){
      const c = document.createElement("div");
      c.className = "pc" + (this.selectedPlants.includes(t) ? " s" : "");
      c.innerHTML = `<div class="e">${d.em}</div><div class="n">${d.n}</div><div class="c">☀${d.c}</div>`;
      const h = e => { e.preventDefault(); this.togglePlant(t); };
      c.addEventListener("touchstart", h, {passive:false});
      c.addEventListener("click", h);
      g.appendChild(c);
    }
    const b = document.getElementById("bar");
    b.innerHTML = "";
    for(let i=0; i<CFG.MAX_SLOTS; i++){
      const s = document.createElement("div");
      s.className = "slot";
      if(i < this.selectedPlants.length){
        s.classList.add("f");
        s.textContent = PL[this.selectedPlants[i]].em;
        const h = e => { e.preventDefault(); this.removeSlot(i); };
        s.addEventListener("touchstart", h, {passive:false});
        s.addEventListener("click", h);
      }
      b.appendChild(s);
    }
    const ct = this.selectedPlants.length;
    const c = document.getElementById("cnt");
    c.textContent = `${ct}/${CFG.MAX_SLOTS}`;
    c.classList.toggle("f", ct >= CFG.MAX_SLOTS);
    document.getElementById("bG").disabled = ct < 1;
  }

  togglePlant(t){
    const i = this.selectedPlants.indexOf(t);
    if(i >= 0) this.selectedPlants.splice(i, 1);
    else if(this.selectedPlants.length < CFG.MAX_SLOTS) this.selectedPlants.push(t);
    this.renderPS();
  }

  removeSlot(i){ this.selectedPlants.splice(i, 1); this.renderPS(); }

  // ============ RESET ============
  reset(){
    this.board = this.makeBoard();
    this.sun = CFG.SUN0;
    this.skyTimer = rf(CFG.SKY_MIN, CFG.SKY_MAX);
    this.wave = 0;
    this.queue = [];
    this.spawnT = 0;
    this.spawnI = 0;
    this.nextW = CFG.ZFIRST;
    this.lastVal = 0;
    this.plants = [];
    this.zombies = [];
    this.peas = [];
    this.needles = [];
    this.shells = [];
    this.minis = [];
    this.suns = [];
    this.effects = [];
    this.winds = [];
    this.selected = null;
    this.lastTime = performance.now();
    this.buildSeedBar();
    this.refreshSeeds();
  }

  makeBoard(){
    const s = Math.min(this.width/CFG.COLS, this.height/CFG.ROWS);
    return new Board(CFG.COLS, CFG.ROWS, s,
      (this.width - s*CFG.COLS)/2,
      (this.height - s*CFG.ROWS)/2);
  }

  resize(){
    const r = this.cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = r.width;
    this.height = r.height;
    this.cv.width = r.width * dpr;
    this.cv.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if(this.board) this.board = this.makeBoard();
  }

  // ============ SEED BAR ============
  buildSeedBar(){
    const el = document.getElementById("seeds");
    el.innerHTML = "";
    for(const type of this.selectedPlants){
      const d = PL[type];
      const b = document.createElement("button");
      b.className = "seed";
      b.dataset.type = type;
      b.innerHTML = `<span class="e">${d.em}</span><span>${d.c}</span>`;
      const h = e => { e.preventDefault(); this.selectSeed(type); };
      b.addEventListener("touchstart", h, {passive:false});
      b.addEventListener("click", h);
      el.appendChild(b);
    }
  }

  spawnSun(x, y){
    this.suns.push(new Sun(x, y, Math.min(this.height-50, y+ri(40, 90))));
  }

  zombieInRow(row, fromX){
    return this.zombies.some(z => z.alive && z.row===row && z.x > fromX);
  }

  plantInFront(z){
    let best = null, bx = -1e9;
    for(const p of this.plants){
      if(!p.alive || p.row !== z.row) continue;
      if(p.type === "spike") continue;
      if(p.type === "anka" && p.form === 2) continue;
      if(col(z.rect, p.rect) && (p.x+p.w) > bx){ bx = p.x+p.w; best = p; }
    }
    for(const m of this.minis){
      if(!m.alive || m.row !== z.row) continue;
      if(col(z.rect, m.rect) && (m.x+m.w) > bx){ bx = m.x+m.w; best = m; }
    }
    return best;
  }

  mineTriggered(m){
    const cx = m.x+m.w/2, cy = m.y+m.h/2, r = m.w*CFG.MINE_R;
    return this.zombies.some(z => {
      if(!z.alive) return 0;
      const dx = z.x+z.w/2-cx, dy = z.y+z.h/2-cy;
      return dx*dx + dy*dy < r*r;
    });
  }

  explodeMine(m){
    const cx = m.x+m.w/2, cy = m.y+m.h/2, r = m.w*CFG.MINE_R;
    const arr = [];
    for(const z of this.zombies){
      if(!z.alive) continue;
      const dx = z.x+z.w/2-cx, dy = z.y+z.h/2-cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < r*r) arr.push({z, d2});
    }
    arr.sort((a,b) => a.d2 - b.d2);
    for(const t of arr.slice(0, PL.mine.max)) t.z.hit(PL.mine.dmg);
    this.effects.push(new Boom(cx, cy, r));
  }

  tryPlant(row, c, type){
    if(!this.board.isFree(row, c)) return 0;
    for(const m of this.minis){
      if(m.alive && m.row===row && m.col===c) return 0;
    }
    if(this.sun < PL[type].c) return 0;
    const cc = this.board.center(row, c);
    const w = this.board.cw*.8, h = this.board.ch*.8;
    const p = new Plant(type, row, c, cc.x-w/2, cc.y-h/2, w, h);
    this.plants.push(p);
    this.board.place(row, c, p);
    this.sun -= PL[type].c;
    this.refreshSeeds();
    return 1;
  }

  collectSun(s){ s.alive = 0; this.sun += CFG.SUNVAL; this.refreshSeeds(); }

  onPointer(px, py){
    if(this.state !== "playing") return;
    for(let i = this.suns.length-1; i>=0; i--){
      const s = this.suns[i];
      if(px >= s.x && px <= s.x+s.w && py >= s.y && py <= s.y+s.h){
        this.collectSun(s);
        return;
      }
    }
    if(this.selected){
      const c = this.board.cellAt(px, py);
      if(c && this.tryPlant(c.row, c.col, this.selected)){
        this.selected = null;
        this.refreshSeeds();
      }
    }
  }

  selectSeed(t){
    if(this.selected === t) this.selected = null;
    else if(this.sun >= PL[t].c) this.selected = t;
    this.refreshSeeds();
  }

  refreshSeeds(){
    document.querySelectorAll(".seed").forEach(el => {
      const t = el.dataset.type;
      el.classList.toggle("s", this.selected === t);
      el.classList.toggle("d", this.sun < PL[t].c);
    });
  }

  // ============ ANA DÖNGÜ ============
  loop(t){
    this._fr++;
    if(t - this._ft > 500){
      this._fps = Math.round(this._fr * 1000 / (t - this._ft));
      this._fr = 0;
      this._ft = t;
    }
    if(this.state === "playing"){
      const dt = cl((t - this.lastTime)/1000 || 0, 0, .05);
      this.update(dt);
      this.draw();
    }
    this.lastTime = t;
    requestAnimationFrame(this._loop);
  }

  // ============ UPDATE ============
  update(dt){
    this.skyTimer -= dt;
    if(this.skyTimer <= 0){
      this.skyTimer = rf(CFG.SKY_MIN, CFG.SKY_MAX);
      this.spawnSun(rf(this.board.ox+30, this.board.ox+this.board.cols*this.board.cw-30), -20);
    }
    this.nextW -= dt;
    if(this.nextW <= 0){
      this.wave++;
      this.buildWave();
      this.nextW = this.waveInt(this.wave);
    }
    if(this.queue.length > 0){
      this.spawnT -= dt;
      if(this.spawnT <= 0){
        this.spawnZ(this.queue.shift());
        this.spawnT = this.spawnI;
      }
    }
    for(const p of this.plants) p.update(dt, this);
    for(const z of this.zombies) z.update(dt, this);
    for(const p of this.peas) p.update(dt, this);
    for(const n of this.needles) n.update(dt, this);
    for(const s of this.shells) s.update(dt, this);
    for(const w of this.winds) w.update(dt, this);
    for(const m of this.minis) m.update(dt, this);
    for(const s of this.suns) s.update(dt);
    for(const e of this.effects) e.update(dt);
    for(const p of this.plants){
      if(p.healFlash > 0) p.healFlash -= dt;
      if(p.type==="anka" && p.form===1 && p.hp<=0){
        p.form = 2;
        p.formTimer = PL.anka.gT;
        p.hp = 0;
        if(this.board.grid[p.row][p.col] === p) this.board.remove(p.row, p.col);
      }
      if(!p.alive && this.board.grid[p.row][p.col] === p) this.board.remove(p.row, p.col);
    }
    this.plants = this.plants.filter(p => p.alive);
    this.zombies = this.zombies.filter(z => z.alive);
    this.peas = this.peas.filter(p => p.alive);
    this.needles = this.needles.filter(n => n.alive);
    this.shells = this.shells.filter(s => s.alive);
    this.winds = this.winds.filter(w => w.alive);
    this.minis = this.minis.filter(m => m.alive);
    this.suns = this.suns.filter(s => s.alive);
    this.effects = this.effects.filter(e => e.alive);
    document.getElementById("sv").textContent = Math.floor(this.sun);
  }

  // ============ DALGA ============
  waveInt(w){ return w===0 ? 20 : w===1 ? 20 : w===2 ? 15 : w===3 ? 13 : 12; }

  valWave(w){
    const t = {1:1,2:1,3:2,4:2,5:4,6:5,7:8,8:8,9:8,10:11,11:11,12:12,13:12,14:13,15:14,16:14,
               17:15,18:15,19:16,20:16,21:17,22:17,23:17,24:17,25:17};
    return t[w] || 17;
  }

  buildWave(){
    const w = this.wave, val = this.valWave(w);
    this.lastVal = val;
    const rMax = w<=6 ? 0 : (w<=14 ? 2 : 3);
    const aMax = w<=19 ? 0 : (w<=21 ? 1 : (w<=24 ? 2 : 3));
    let rem = val;
    const list = [];
    let c = 0; while(c<aMax && rem>=6){ list.push("armored"); rem-=6; c++; }
    c = 0; while(c<rMax && rem>=3){ list.push("runner"); rem-=3; c++; }
    while(rem >= 1){ list.push("normal"); rem -= 1; }
    list.sort(() => Math.random() - .5);
    this.queue = list;
    this.spawnI = list.length>0 ? this.waveInt(w)/list.length : 0;
    this.spawnT = 0;
  }

  spawnZ(type){
    const row = ri(0, this.board.rows-1);
    const x = this.board.ox + this.board.cols*this.board.cw + 10 + ri(0, 60);
    const c = this.board.center(row, 0);
    const w = this.board.cw*.6, h = this.board.ch*.7;
    this.zombies.push(new Zombie(type, row, x, c.y-h/2, w, h));
  }

  // ============ DRAW ============
  draw(){
    const ctx = this.ctx, b = this.board;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#5a8f3a";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(0,0,0,.15)";
    ctx.lineWidth = 1;
    for(let r=0; r<=b.rows; r++){
      ctx.beginPath();
      ctx.moveTo(b.ox, b.oy+r*b.ch);
      ctx.lineTo(b.ox+b.cols*b.cw, b.oy+r*b.ch);
      ctx.stroke();
    }
    for(let c=0; c<=b.cols; c++){
      ctx.beginPath();
      ctx.moveTo(b.ox+c*b.cw, b.oy);
      ctx.lineTo(b.ox+c*b.cw, b.oy+b.rows*b.ch);
      ctx.stroke();
    }
    const ghosts = this.plants.filter(p => p.type==="anka" && p.form===2);
    const grounds = this.plants.filter(p => p.type==="spike");
    const uppers = this.plants.filter(p => p.type!=="spike" && !(p.type==="anka" && p.form===2));
    for(const p of ghosts) p.draw(ctx);
    for(const p of grounds) p.draw(ctx);
    for(const p of uppers) p.draw(ctx);
    for(const m of this.minis) m.draw(ctx);
    for(const z of this.zombies) z.draw(ctx);
    for(const p of this.peas) p.draw(ctx);
    for(const n of this.needles) n.draw(ctx);
    for(const s of this.shells) s.draw(ctx);
    for(const w of this.winds) w.draw(ctx);
    for(const e of this.effects) e.draw(ctx);
    for(const s of this.suns) s.draw(ctx);
    document.getElementById("dbg").textContent =
      `FPS:${this._fps} Z:${this.zombies.length} B:${this.plants.length} M:${this.minis.length} D:${this.wave} Değer:${this.lastVal}`;
  }
}