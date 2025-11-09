// Curling end evaluator — full red/yellow version
// Input: stones = [["red"|"yellow", x, y], ...] in Cartesian (m, button-centered),
//        shotNumber 0..15, hammerTeam "red"|"yellow", skillPercent 10–90 (default 50)
// Output: { advantage:{red,yellow}, buckets17:{-8..+8} }   // probabilities sum to 1.0

// ===== Constants =====
const R_HOUSE = 1.829;
const D_STONE = 0.285;

// Positional weights
const H0 = 0.90;
const ALPHA1 = 1.0;
const GAMMA = 1.5;
const W_GUARD = 0.60;
const W_CENTER = 0.30;
const W_FREEZE = 0.40;
const W_TAKEOUT = 0.50;
const W_CONG = 0.20;
const CENTER_BAND = 0.60;
const FREEZE_RADIUS = 0.35;

// Geometry
const HALF_WIDTH = 2.44;
const BACK_LINE = -5.486;
const HOG_LINE  = 6.40;

// Baseline priors
const BASELINE_HAMMER = [0.30,0.40,0.25,0.04,0.01,0,0,0,0];
const BASELINE_STEAL  = [0.035,0.010,0.003,0.001,0.0006,0.0003,0.0001,0.00005];

// Double-takeout penalty
const DBL_DMAX = 0.95;
const DBL_THETA_MAX = (12*Math.PI)/180;
const DBL_J = 0.10;
const DBL_L = 0.20;
const DBL_KAPPA = 4.0;
const DBL_BETA0 = 0.3;
const DBL_BETA1 = 1.0;
const DBL_LAMBDA = 0.5;
const DBL_CAP_RHO = 0.6;

// Distribution shaping
const A_EV = 1.0;
const BETA0 = 0.35;
const BETA1 = 0.90;

// ===== Utility =====
function clamp(x,lo,hi){ return Math.max(lo,Math.min(hi,x)); }
function softmax1D(arr){
  const m = Math.max(...arr);
  const exps = arr.map(v=>Math.exp(v-m));
  const s = exps.reduce((a,b)=>a+b,0);
  return exps.map(v=>v/(s||1));
}
function isInPlay(x,y){
  if (Math.abs(x) > HALF_WIDTH+D_STONE/2) return false;
  if (y < BACK_LINE-D_STONE/2) return false;
  if (y > HOG_LINE+D_STONE/2)  return false;
  return true;
}
function hypot2(x,y){ return Math.hypot(x,y); }

// ===== Positional scoring =====
function baseHammer(s, team, hammerTeam){
  return H0*Math.sqrt(Math.max(s,0)/16.0)*(team===hammerTeam?1:-1);
}
function radialValue(r){
  if (r>R_HOUSE) return 0.0;
  const depthBoost = (r<1.3? 1.25 : 0.9);
  return depthBoost*ALPHA1*(1.0-Math.pow(r/R_HOUSE,GAMMA));
}
function hasLineOfSightBlocker([x,y],blockers,phiDeg=7.5){
  const vx=-x, vy=-y, vr=Math.hypot(vx,vy);
  if (vr<1e-6) return 1.0;
  const ux=vx/vr, uy=vy/vr, phi=(phiDeg*Math.PI)/180;
  for (const [bx,by] of blockers){
    if (Math.hypot(bx,by)>=vr-1e-6) continue;
    const wx=bx-x, wy=by-y, wr=Math.hypot(wx,wy);
    if (wr<1e-6) return 1.0;
    let dot=(wx*ux+wy*uy)/wr; dot=Math.max(-1,Math.min(1,dot));
    const sinT=Math.sqrt(Math.max(0,1-dot*dot));
    const perp=wr*sinT, theta=Math.acos(dot);
    if (theta<=phi && perp<=D_STONE/2) return 1.0;
  }
  return 0.0;
}
function takeoutEase(G){ return 1.0-0.9*G; }
function centerFactor(x){ return 1.0-Math.min(Math.abs(x),1.0); }

function computeTeamStoneValues(team,stones){
  const allPos=stones.map(([t,x,y])=>[x,y]);
  const teamPos=stones.filter(([t])=>t===team).map(([t,x,y])=>[x,y]);
  const entries=[];
  for (const [x,y] of teamPos){
    const r=hypot2(x,y);
    let v=radialValue(r);
    if (v<=0){ entries.push({x,y,r,G:0,T:1,v:0,pre:0,acc:0}); continue; }
    const G=hasLineOfSightBlocker([x,y],allPos);
    v*=(1+W_GUARD*G);
    v*=(1+W_CENTER*centerFactor(x));
    let F=0; for (const [fx,fy] of teamPos){
      if (fx===x&&fy===y) continue;
      if (hypot2(fx-x,fy-y)<=FREEZE_RADIUS && hypot2(fx,fy)<=r+0.10){F=1;break;}
    }
    v*=(1+W_FREEZE*F);
    const T=takeoutEase(G); v*=(1-W_TAKEOUT*T);
    entries.push({x,y,r,G,T,v,pre:v,acc:0});
  }
  return entries;
}

// ===== Double-takeout vulnerability =====
function applyDoubleVulnerability(teamEntries,allStones,s,skill){
  if (teamEntries.length<2) return;
  const q=clamp((skill||50)/100,0.1,0.9), S=Math.sqrt(Math.max(s,0)/16.0);
  const beta=DBL_BETA0+DBL_BETA1*(1-q)*(1-S);
  const ux=0,uy=-1, nx=1,ny=0;
  const others=allStones.map(([t,x,y])=>[x,y]);
  for (let i=0;i<teamEntries.length;i++){
    for (let j=i+1;j<teamEntries.length;j++){
      const ei=teamEntries[i], ej=teamEntries[j];
      if (ei.r>R_HOUSE||ej.r>R_HOUSE) continue;
      const dx=ej.x-ei.x, dy=ej.y-ei.y, dij=Math.hypot(dx,dy);
      if (dij>DBL_DMAX||dij<1e-6) continue;
      const X=Math.min(ei.T,ej.T);
      let cos=(dx*ux+dy*uy)/dij; cos=Math.max(-1,Math.min(1,cos));
      const thetaSmall=Math.acos(Math.abs(cos));
      const A=Math.max(0,1-thetaSmall/DBL_THETA_MAX);
      const off=Math.abs(dx*nx+dy*ny), w=Math.max(0,D_STONE/2-off);
      const W=clamp(w/DBL_J,0,1);
      let B=1; for (const [kx,ky] of others){
        if ((kx===ei.x&&ky===ei.y)||(kx===ej.x&&ky===ej.y)) continue;
        const okx=kx-ei.x, oky=ky-ei.y, offK=Math.abs(okx*nx+oky*ny);
        B*=1-Math.exp(-((offK/DBL_L)**2));
      } B=clamp(B,0,1);
      const Pdbl=1/(1+Math.exp(-(DBL_KAPPA*(X*A*W*B)-beta)));
      const Mi=Math.max(ei.v,0), Mj=Math.max(ej.v,0), M=Mi+Mj;
      if (M<=0) continue;
      const delta=DBL_LAMBDA*Pdbl*M;
      const capi=DBL_CAP_RHO*ei.pre-ei.acc, capj=DBL_CAP_RHO*ej.pre-ej.acc;
      const di=Math.min(delta*(Mi/M),Math.max(0,capi));
      const dj=Math.min(delta*(Mj/M),Math.max(0,capj));
      ei.v=Math.max(0,ei.v-di); ei.acc+=di;
      ej.v=Math.max(0,ej.v-dj); ej.acc+=dj;
    }
  }
}

// ===== Congestion =====
function congestionTerm(stones,hammerTeam,s){
  const nh=hammerTeam==="red"?"yellow":"red";
  function countCenter(team){
    let c=0; for (const [t,x,y] of stones){
      if (t!==team) continue; const r=hypot2(x,y);
      if (r<=R_HOUSE) continue;
      if (Math.abs(x)<=CENTER_BAND) c++;
    } return c;
  }
  return W_CONG*(countCenter(nh)-countCenter(hammerTeam))*Math.sqrt(Math.max(s,0)/16.0);
}

// ===== Distribution =====
function distribution17_fromScore(scoreForHammer,s,skill){
  const sRoot=Math.sqrt(Math.max(s,0)/16.0), q=clamp((skill||50)/100,0.1,0.9);
  const mu=clamp(A_EV*scoreForHammer,-6,6);
  const beta=BETA0+BETA1*(1-q)*(1-sRoot);
  const kVals=[...Array(17).keys()].map(k=>k-8);
  const base=kVals.map(k=>{
    if (k===0) return BASELINE_HAMMER[0];
    if (k>0) return BASELINE_HAMMER[k]||1e-5;
    return BASELINE_STEAL[-k-1]||1e-5;
  });
  const logits=kVals.map((k,i)=>Math.log(base[i]+1e-12)-beta*(k-mu)**2);
  const probs=softmax1D(logits);
  const out={}; kVals.forEach((k,i)=>out[k]=probs[i]);
  return out;
}

// ===== Constraints =====
function countThrown(n,hammerTeam){
  n=n+1;
  return hammerTeam==="red"?{red:Math.floor(n/2),yellow:Math.floor((n+1)/2)}
                           :{yellow:Math.floor(n/2),red:Math.floor((n+1)/2)};
}
function collapseToTerminal(stones,hammerTeam){
  const rRed=stones.filter(([t,x,y])=>t==="red"&&isInPlay(x,y)&&hypot2(x,y)<=R_HOUSE).map(([t,x,y])=>hypot2(x,y)).sort((a,b)=>a-b);
  const rYel=stones.filter(([t,x,y])=>t==="yellow"&&isInPlay(x,y)&&hypot2(x,y)<=R_HOUSE).map(([t,x,y])=>hypot2(x,y)).sort((a,b)=>a-b);
  let score=0;
  if (rRed.length||rYel.length){
    if (rRed.length&&(!rYel.length||rRed[0]<rYel[0]-1e-9)){
      const cutoff=rYel.length?rYel[0]:Infinity;
      const raw=rRed.filter(r=>r<cutoff-1e-9).length;
      score=hammerTeam==="red"?raw:-raw;
    } else if (rYel.length&&(!rRed.length||rYel[0]<rRed[0]-1e-9)){
      const cutoff=rRed.length?rRed[0]:Infinity;
      const raw=rYel.filter(r=>r<cutoff-1e-9).length;
      score=hammerTeam==="yellow"?raw:-raw;
    } else score=0;
  }
  const b={}; for (let k=-8;k<=8;k++) b[k]=0; b[score]=1; return b;
}
function applyConstraints(buckets,stones,hammerTeam,s,n){
  const inRed=stones.filter(([t,x,y])=>t==="red"&&isInPlay(x,y)).length;
  const inYel=stones.filter(([t,x,y])=>t==="yellow"&&isInPlay(x,y)).length;
  const {red:thRed,yellow:thYel}=countThrown(n,hammerTeam);
  const remRed=8-thRed, remYel=8-thYel;
  const maxRed=inRed+remRed, maxYel=inYel+remYel;
  if (s===0) return collapseToTerminal(stones,hammerTeam);
  for (let k=1;k<=8;k++){ if (hammerTeam==="red"&&k>maxRed) buckets[k]=0; if (hammerTeam==="yellow"&&k>maxYel) buckets[k]=0; }
  for (let k=1;k<=8;k++){ if (hammerTeam==="red"&&k>maxYel) buckets[-k]=0; if (hammerTeam==="yellow"&&k>maxRed) buckets[-k]=0; }
  let Z=Object.values(buckets).reduce((a,b)=>a+b,0); if (Z>0){ for (const k in buckets) buckets[k]/=Z; }
  return buckets;
}

// ===== Entry point =====
function evaluatePosition17(shotNumber,hammerTeam,stones,skillPercent=50){
  const s=16-(shotNumber+1);
  const teamRed=computeTeamStoneValues("red",stones);
  const teamYel=computeTeamStoneValues("yellow",stones);
  applyDoubleVulnerability(teamRed,stones,s,skillPercent);
  applyDoubleVulnerability(teamYel,stones,s,skillPercent);
  const posRed=teamRed.reduce((a,e)=>a+e.v,0), posYel=teamYel.reduce((a,e)=>a+e.v,0);
  const cong=congestionTerm(stones,hammerTeam,s);
  const base=baseHammer(s,"red",hammerTeam);
  const scoreRed=base+(posRed-posYel)+cong;
  const scoreForHammer=hammerTeam==="red"?scoreRed:-scoreRed;
  let buckets=distribution17_fromScore(scoreForHammer,s,skillPercent);
  buckets=applyConstraints(buckets,stones,hammerTeam,s,shotNumber);
  return {advantage:{red:scoreRed,yellow:-scoreRed}, buckets17:buckets};
}

// Export
if (typeof module!=='undefined') module.exports={evaluatePosition17};
// Export for ES modules
export { evaluatePosition17 };
