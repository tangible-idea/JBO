// Original score and frame-matched Foley. No samples or external services.
// 120 BPM / 4-4 / C major. All events use the same seconds as the GSAP cut.
import fs from 'node:fs';
const SR=48000,D=40,N=SR*D;
const music=[new Float64Array(N),new Float64Array(N)];
const fx=[new Float64Array(N),new Float64Array(N)];
let seed=731;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296*2-1};
const hz=n=>440*2**((n-69)/12);
function add(buf,t,d,fn,vol=1,pan=0){
 const a=Math.floor(t*SR),len=Math.floor(d*SR); const L=Math.sqrt((1-pan)/2),R=Math.sqrt((1+pan)/2);
 for(let i=0;i<len&&a+i<N;i++){if(a+i<0)continue;const v=fn(i/SR,i)*vol;buf[0][a+i]+=v*L;buf[1][a+i]+=v*R;}
}
function mallet(t,n,v=.14,p=0){const f=hz(n),dur=.65;add(music,t,dur,x=>{
 const e=(1-Math.exp(-x*650))*Math.exp(-x*8);
 return e*(Math.sin(2*Math.PI*f*x)+.24*Math.sin(2*Math.PI*f*3.998*x)*Math.exp(-x*12)+.1*Math.sin(2*Math.PI*f*9.98*x)*Math.exp(-x*18));},v,p);
 // A restrained stereo ping-pong tail.
 for(let k=1;k<=3;k++)add(music,t+.1875*k,.5,x=>Math.sin(2*Math.PI*f*x)*(1-Math.exp(-x*500))*Math.exp(-x*10),v*.19**k,p*-1);
}
function bass(t,n,v=.18){const f=hz(n);add(music,t,.4,x=>{
 const e=Math.min(x/.008,1)*Math.exp(-x*7);return (Math.sin(2*Math.PI*f*x)+.17*Math.sin(4*Math.PI*f*x))*e;},v);}
function chord(t,notes,d=1.7,v=.035){for(let i=0;i<notes.length;i++){let f=hz(notes[i]);add(music,t+i*.014,d,x=>Math.min(x/.04,1)*Math.min((d-x)/.4,1)*Math.exp(-x*.75)*(Math.sin(2*Math.PI*f*x)+.2*Math.sin(2*Math.PI*f*2*x)),v,(i-1.5)*.35);}}
function kick(t,v=.2){add(music,t,.24,x=>Math.sin(2*Math.PI*(48*x+5*(1-Math.exp(-x*35))))*Math.exp(-x*19),v);}
function hat(t,v=.025,p=.3){add(music,t,.08,x=>rand()*Math.exp(-x*70),v,p);}
function clap(t,v=.04){add(music,t,.14,x=>rand()*Math.exp(-x*28)*(0.7+.3*Math.cos(2*Math.PI*1800*x)),v,-.12);}
const chords=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,67]];
const roots=[36,33,29,31];
const motif=[[76,79,81,79,76,74,72,76],[76,79,84,83,81,79,76,72],[77,81,84,81,79,77,76,72],[74,79,83,81,79,76,74,71]];
for(let bar=0;bar<19;bar++){
 const t=bar*2,c=bar%4;
 const quiet=t>=28&&t<34,level=quiet?.55:1;
 chord(t,chords[c],1.8,.04*level);
 for(let b=0;b<4;b++){kick(t+b*.5,.18*level);hat(t+b*.5+.25,.034*level,(b%2?.55:-.55));if(b%2)clap(t+b*.5,.052*level);}
 bass(t,roots[c],.23*level);bass(t+.75,roots[c]+12,.14*level);bass(t+1.5,roots[c]+7,.14*level);
 if(bar%4!==3||bar>=16){
  const pat=motif[c]; const times=[0,.375,.75,1,1.25,1.5,1.75,1.875];
  const count=quiet?3:(bar<2?4:6);
  for(let i=0;i<count;i++)mallet(t+times[i],pat[i],(.095+(i%3===0?.025:0))*level,(i%2?.28:-.28));
 }
 if(!quiet&&bar>2)for(let i=0;i<8;i++)hat(t+i*.25+.035,.012,i%2?.7:-.7);
}
chord(38,[48,60,64,67,72],2,.065);mallet(38,84,.14,.15);bass(38,36,.2);
function pop(t,n=84,v=.24){const f=hz(n);add(fx,t,.16,x=>Math.sin(2*Math.PI*f*x+3*(1-Math.exp(-x*50)))*Math.exp(-x*30)*(1-Math.exp(-x*800)),v);}
function whoosh(t,d=.4,v=.12){let prev=0;add(fx,t,d,x=>{let n=rand();prev=prev*.75+n*.25;return prev*Math.sin(Math.PI*x/d)**2;},v,-.12);}
function tick(t){add(fx,t,.05,x=>rand()*Math.exp(-x*140),.17);pop(t,93,.09);}
function sparkle(t){[84,88,91,96].forEach((n,i)=>{let f=hz(n);add(fx,t+i*.09,.65,x=>(Math.sin(2*Math.PI*f*x)+.3*Math.sin(2*Math.PI*2*f*x))*Math.exp(-x*7)*Math.min(x/.004,1),.11,(i-1.5)*.3);});}
const events=[];
for(const t of [.5,1,2,2.5,3,3.5,4]){pop(t,72+Math.round(t*2));events.push({t,type:'bookmark arrival'});}
for(const t of [5.65,9.65,17.65,27.65,33.65]){whoosh(t);events.push({t,type:'scene handoff'});}
for(const t of [6,10,18,28,34]){pop(t,60,.25);events.push({t,type:'scene impact'});}
[7.5,8,8.5].forEach((t,i)=>pop(t,76+i*3));
[12,14.5,17].forEach(t=>{tick(t);sparkle(t+.08);events.push({t,type:'save click and confirmation'});});
[18,20.5,23,25.5].forEach((t,i)=>{pop(t,72+i*4);events.push({t,type:'mode selection'});});
[30,31,32].forEach((t,i)=>pop(t,79+i*2));
whoosh(32.2,.45,.09);sparkle(34.35);sparkle(37);
function write(file,buf,peak=.8){let max=0;for(let i=0;i<N;i++)max=Math.max(max,Math.abs(buf[0][i]),Math.abs(buf[1][i]));const gain=peak/Math.max(max,.001);
 const out=Buffer.alloc(44+N*4);out.write('RIFF',0);out.writeUInt32LE(36+N*4,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(SR,24);out.writeUInt32LE(SR*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(N*4,40);
 for(let i=0;i<N;i++){const t=i/SR;const env=Math.min(1,t/.015,(D-t)/.55);for(let c=0;c<2;c++){const v=Math.max(-1,Math.min(1,buf[c][i]*gain*env));out.writeInt16LE(Math.round(v*32767),44+(i*2+c)*2);}}
 fs.writeFileSync(file,out);
}
fs.mkdirSync('assets/audio',{recursive:true});
write('assets/audio/music.wav',music,.7);write('assets/audio/foley.wav',fx,.68);
fs.writeFileSync('assets/audio/cues.json',JSON.stringify({bpm:120,duration:D,events},null,2));
fs.writeFileSync('audio_meta.json',JSON.stringify({voices:[],sfx:[],bgm:{path:'assets/audio/music.wav',duration_s:D},total_duration_s:D,source:'Original JavaScript synthesis; see make-audio.mjs'},null,2));
console.log('40-second original stereo music and synchronized Foley written at 48 kHz.');
