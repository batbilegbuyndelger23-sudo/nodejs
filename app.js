const http=require('http'),fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const PORT=process.env.PORT||3000;
const VID=path.join(__dirname,'uploads/videos');
const SUB=path.join(__dirname,'uploads/subs');
const THB=path.join(__dirname,'uploads/thumbnails');
const DB=path.join(__dirname,'movies.json');
[path.join(__dirname,'uploads'),VID,SUB,THB].forEach(d=>{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true})});
const rdb=()=>fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):{movies:[]};
const wdb=d=>fs.writeFileSync(DB,JSON.stringify(d,null,2));
const MIME={'.html':'text/html;charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.mp4':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska','.vtt':'text/vtt;charset=utf-8','.srt':'text/plain','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};
function srt2vtt(s){return'WEBVTT\n\n'+s.replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2').trim()}
function thumb(vp,tp){try{execSync(`ffmpeg -i "${vp}" -ss 3 -vframes 1 -vf scale=320:-1 "${tp}" -y 2>/dev/null`,{timeout:15000});return true}catch(e){return false}}
function mp(req,cb){let b=Buffer.alloc(0);req.on('data',c=>{b=Buffer.concat([b,c])});req.on('end',()=>{const bm=(req.headers['content-type']||'').match(/boundary=(.+)$/);if(!bm)return cb(new Error('no boundary'));const bd='--'+bm[1],buf=Buffer.from('\r\n'+bd);let sf=bd.length+2;const parts=[],fields={},files={};while(true){const i=b.indexOf(buf,sf-2);if(i===-1)break;parts.push(b.slice(sf,i));sf=i+buf.length+2}parts.forEach(p=>{const he=p.indexOf('\r\n\r\n');if(he===-1)return;const hs=p.slice(0,he).toString(),data=p.slice(he+4),nm=(hs.match(/name="([^"]+)")||[])[1],fn=(hs.match(/filename="([^"]+)")||[])[1];if(!nm)return;fn?files[nm]={filename:fn,data,ct:(hs.match(/Content-Type: (.+)/)||[])[1]||'application/octet-stream'}:fields[nm]=data.toString().trim()});cb(null,fields,files)})}
const srv=http.createServer((req,res)=>{
const u=new URL(req.url,`http://localhost:${PORT}`),p=u.pathname,m=req.method;
res.setHeader('Access-Control-Allow-Origin','*');
res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
if(m==='OPTIONS'){res.writeHead(204);return res.end()}
if(p==='/api/movies'&&m==='GET'){const db=rdb();res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(db.movies))}
if(p==='/api/upload'&&m==='POST'){mp(req,(err,fields,files)=>{if(err){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:err.message}))}
const vf=files.video,sf=files.subtitle;if(!vf){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Видео файл байхгүй'}))}
const id=Date.now().toString(),ve=path.extname(vf.filename).toLowerCase(),vn=id+ve,vp=path.join(VID,vn);fs.writeFileSync(vp,vf.data);
let sn=null;if(sf&&sf.filename){sn=id+'.vtt';fs.writeFileSync(path.join(SUB,sn),path.extname(sf.filename).toLowerCase()==='.srt'?srt2vtt(sf.data.toString('utf8')):sf.data)}
const tn=id+'.jpg',tok=thumb(vp,path.join(THB,tn));
const db=rdb(),mv={id,title:fields.title||vf.filename,year:fields.year||new Date().getFullYear(),genre:fields.genre||'Бусад',description:fields.description||'',videoFile:vn,subFile:sn,thumbnail:tok?tn:null,uploadedAt:new Date().toISOString()};
db.movies.push(mv);wdb(db);res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({success:true,movie:mv}))});return}
if(p.startsWith('/api/movies/')&&m==='DELETE'){const id=p.split('/')[3],db=rdb(),mv=db.movies.find(x=>x.id===id);if(mv){try{fs.unlinkSync(path.join(VID,mv.videoFile))}catch(e){}if(mv.subFile)try{fs.unlinkSync(path.join(SUB,mv.subFile))}catch(e){}if(mv.thumbnail)try{fs.unlinkSync(path.join(THB,mv.thumbnail))}catch(e){}db.movies=db.movies.filter(x=>x.id!==id);wdb(db)}res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({success:true}))}
if(p.startsWith('/uploads/videos/')){const fn=p.replace('/uploads/videos/',''),fp=path.join(VID,fn);if(!fs.existsSync(fp)){res.writeHead(404);return res.end()}const st=fs.statSync(fp),tot=st.size,rng=req.headers.range,mt=MIME[path.extname(fn).toLowerCase()]||'video/mp4';if(rng){const[s,e]=rng.replace(/bytes=/,'').split('-'),st2=parseInt(s,10),en=e?parseInt(e,10):Math.min(st2+1048575,tot-1);res.writeHead(206,{'Content-Range':`bytes ${st2}-${en}/${tot}`,'Accept-Ranges':'bytes','Content-Length':en-st2+1,'Content-Type':mt});fs.createReadStream(fp,{start:st2,end:en}).pipe(res)}else{res.writeHead(200,{'Content-Length':tot,'Content-Type':mt,'Accept-Ranges':'bytes'});fs.createReadStream(fp).pipe(res)}return}
if(p.startsWith('/uploads/subs/')){const fp=path.join(SUB,p.replace('/uploads/subs/',''));if(!fs.existsSync(fp)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':'text/vtt;charset=utf-8'});return fs.createReadStream(fp).pipe(res)}
if(p.startsWith('/uploads/thumbnails/')){const fp=path.join(THB,p.replace('/uploads/thumbnails/',''));if(!fs.existsSync(fp)){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':'image/jpeg'});return fs.createReadStream(fp).pipe(res)}
let fp;if(p==='/'||p==='/index.html')fp=path.join(__dirname,'public/index.html');
else if(p==='/admin'||p==='/admin.html')fp=path.join(__dirname,'public/admin.html');
else fp=path.join(__dirname,'public',p);
if(fs.existsSync(fp)&&fs.statSync(fp).isFile()){res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'text/plain'});return fs.createReadStream(fp).pipe(res)}
res.writeHead(404);res.end('404')});
srv.listen(PORT,()=>console.log(`MNFLIX running on port ${PORT}`));
