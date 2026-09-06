// Synthesized ambience and feedback: no external audio downloads or autoplay.
export function createAudio() {
  let ctx, master, drone, engine, enabled=false, started=false;
  function init() {
    if (started) return;
    ctx=new (window.AudioContext || window.webkitAudioContext)();
    master=ctx.createGain();master.gain.value=.28;master.connect(ctx.destination);started=true;
    const noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate), data=noiseBuffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.18;
    const rain=ctx.createBufferSource();rain.buffer=noiseBuffer;rain.loop=true;
    const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=1800;
    rain.connect(low);low.connect(master);rain.start();
    drone=ctx.createOscillator();drone.type='sine';drone.frequency.value=55;
    const droneGain=ctx.createGain();droneGain.gain.value=.06;drone.connect(droneGain);droneGain.connect(master);drone.start();
    engine=ctx.createOscillator();engine.type='sawtooth';engine.frequency.value=35;
    engine.gainNode=ctx.createGain();engine.gainNode.gain.value=0;engine.connect(engine.gainNode);engine.gainNode.connect(master);engine.start();
  }
  function tone(freq=330,duration=.13,type='sine',volume=.15,end=80) {
    if(!enabled||!ctx)return;
    const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime;
    o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),now+duration);
    g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(g);g.connect(master);o.start(now);o.stop(now+duration+.02);
  }
  return {
    async toggle(){init();enabled=!enabled;if(ctx.state==='suspended')await ctx.resume();master.gain.setTargetAtTime(enabled?.28:0,ctx.currentTime,.08);return enabled},
    get enabled(){return enabled},
    shot(){tone(170,.13,'sawtooth',.24,35);tone(1000,.07,'square',.025,210)},
    hit(){tone(550,.05,'triangle',.18,800)},
    emp(){tone(55,.8,'sawtooth',.3,1200)},
    hack(){[0,130,260,400].forEach((ms,i)=>setTimeout(()=>tone(300+i*160,.3,'sine',.15,400+i*200),ms))},
    damage(){tone(70,.3,'triangle',.25,30)},
    reload(){tone(800,.09,'square',.07,300)},
    motor(speed,driving){if(engine){engine.frequency.setTargetAtTime(35+Math.abs(speed)*5,ctx.currentTime,.15);engine.gainNode.gain.setTargetAtTime(driving?.035:0,ctx.currentTime,.1)}}
  };
}
