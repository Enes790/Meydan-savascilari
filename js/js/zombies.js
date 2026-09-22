import {Entity} from './entities.js';
import {CFG, ZB, BADGE, PL} from './config.js';

export class Zombie extends Entity {
  constructor(type, row, x, y, w, h){
    super(x, y, w, h);
    this.type = type;
    this.row = row;
    const d = ZB[type];
    this.hp = d.hp;
    this.mhp = d.hp;
    this.speed = d.spd;
    this.dmg = d.dmg;
    this.color = d.col;
    this.weakenTimer = 0;
    this.burnTimer = 0;
  }

  update(dt, g){
    // Zayıflatma (İğneatar)
    if(this.weakenTimer > 0) this.weakenTimer -= dt;
    // Yanma (Alev Çiçeği)
    if(this.burnTimer > 0){
      this.hit(CFG.BURN_D * dt);
      this.burnTimer -= dt;
    }
    // Hasar hesabı
    const dmg = this.weakenTimer > 0 ? this.dmg * PL.ignear.wm : this.dmg;
    // Önündeki hedefi bul ve ye, yoksa yürü
    const target = g.plantInFront(this);
    if(target) target.hit(dmg * dt);
    else this.x -= this.speed * dt;
    // Eve vardıysa oyun biter
    if(this.x + this.w < g.board.ox) g.gameOver();
  }

  hit(d){
    this.hp -= d;
    if(this.hp <= 0) this.alive = 0;
  }

  draw(ctx){
    // Gövde
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // Zayıflatma efekti (mor tint)
    if(this.weakenTimer > 0){
      ctx.fillStyle = "rgba(160,80,220,.35)";
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
    // Yanma efekti
    if(this.burnTimer > 0){
      const pu = .4 + .3 * Math.sin(performance.now()/100);
      ctx.fillStyle = `rgba(255,120,0,${pu})`;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.font = `${this.h*.35}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔥", this.x+this.w*.5, this.y+this.h*.15);
    }
    // Zombi emoji
    ctx.font = `${this.h*.55}px serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🧟", this.x, this.y+this.h/2);
    // Rozet (runner/armored)
    const badge = BADGE[this.type];
    if(badge){
      ctx.font = `${this.h*(this.type==="armored"?.35:.3)}px serif`;
      ctx.textAlign = this.type==="runner" ? "left" : "center";
      ctx.fillText(badge,
        this.type==="runner" ? this.x+this.w*.55 : this.x+this.w*.5,
        this.y + this.h*(this.type==="runner"?.25:.3));
    }
    // Zayıflatma ikonu
    if(this.weakenTimer > 0){
      ctx.font = `${this.h*.28}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("💜", this.x+this.w*.85, this.y+this.h*.15);
    }
    // HP bar
    ctx.fillStyle = "#000";
    ctx.fillRect(this.x, this.y-4, this.w, 3);
    ctx.fillStyle = this.burnTimer>0 ? "#ff8c00" : "#f00";
    ctx.fillRect(this.x, this.y-4, this.w*(this.hp/this.mhp), 3);
  }
}