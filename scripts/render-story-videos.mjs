import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,copyFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'references/video/20261012/rendered');
const ff=path.join(root,'.tools/ffmpeg/ffmpeg.exe'), probe=path.join(root,'.tools/ffmpeg/ffprobe.exe');
const plans=[
 {name:'intro-01',duration:6,sourceFrames:72,reverse:true,note:'Uses only dark first 3 seconds; reversed gentle pullback becomes forward dolly, retimed.'},
 {name:'intro-02',duration:6,sourceFrames:48,reverse:false,note:'Uses first 2 seconds before the generated lamp lights; retimed.'},
 {name:'intro-03',duration:4,sourceFrames:79,reverse:false,note:'Core remains inactive and receiver empty.'},
 {name:'final-01',duration:4,sourceFrames:79,reverse:true,note:'Reverse short supported-core motion: hands settle on seated core; camera pushes in.'},
 {name:'final-02',duration:6,sourceFrames:127,reverse:false,note:'Restored plaza, natural small gesture and backward dolly.'},
 {name:'final-03',duration:6,sourceFrames:127,reverse:true,note:'Reversed generated forward dolly to requested backward reveal.'}
];
function run(cmd,args){const p=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(p.status!==0)throw Error(p.stderr||p.stdout);return p.stdout;}
const checks=[];
for(const p of plans){const dest=path.join(out,p.name+'.mp4');if(existsSync(dest))throw Error('Will not overwrite '+dest);const frames=p.duration*24, active=frames-17;
 const vf=`trim=end_frame=${p.sourceFrames},${p.reverse?'reverse,':''}setpts=(PTS-STARTPTS)*${active}/${p.sourceFrames},fps=24,trim=end_frame=${active},tpad=stop_mode=clone:stop_duration=2,trim=end_frame=${frames},setpts=N/(24*TB),setsar=1`;
 run(ff,['-hide_banner','-loglevel','error','-n','-i',path.join(out,'raw',p.name+'-v2-8s.mp4'),'-vf',vf,'-af',`atrim=duration=${p.duration},asetpts=PTS-STARTPTS,volume=0.4,afade=t=in:d=0.08,afade=t=out:st=${p.duration-0.25}:d=0.25`,'-t',String(p.duration),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',dest]);
 console.log('CUT_DONE',p.name); checks.push({file:dest,edit:p,probe:JSON.parse(run(probe,['-v','error','-show_format','-show_streams','-of','json',dest]))});}
for(const [name,ids] of [['intro',plans.slice(0,3)],['ending',plans.slice(3)]]){
 const list=path.join(out,name+'-concat.txt');writeFileSync(list,ids.map(p=>`file '${p.name}.mp4'`).join('\n'));
 const dest=path.join(out,name+'.mp4');run(ff,['-hide_banner','-loglevel','error','-n','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',dest]);
 const data=JSON.parse(run(probe,['-v','error','-show_format','-show_streams','-of','json',dest]));
 run(ff,['-hide_banner','-v','error','-i',dest,'-f','null','-']);
 checks.push({file:dest,fullDecode:'pass',probe:data});
 console.log('FINAL_DONE',name,data.format.duration);
 const target=path.join(root,'public/assets/story',name+'.mp4');if(existsSync(target))throw Error('Will not overwrite existing game asset '+target);copyFileSync(dest,target);
}
writeFileSync(path.join(out,'media-validation.json'),JSON.stringify({createdAt:new Date().toISOString(),fps:24,holdFrames:17,creditsTotal:240,checks},null,2));
console.log('ALL_DONE');
