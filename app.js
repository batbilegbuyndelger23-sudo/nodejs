const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000;
const U=path.join(__dirname,'uploads');
const V=path.join(U,'videos');
const S=path.join(U,'subs');
const DB=path.join(__dirname,'movies.json');
[U,V,S].forEach(d=>{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true})});
const rdb=()=>fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):{movies:[]};
const wdb=d=>fs.writeFileSync(DB,JSON.stringify(d,null,2));
const MIME={'.html':'text/html;charset=utf-8','.js':'application/javascript','.json':'application/json','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt','.jpg':'image/jpeg','.png':'image/png'};
function srt(s){return'WEBVTT\n\n'+s.replace(/\r\n/g,'\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2').trim()}
function mp(req,cb){
  let b=Buffer.alloc(0);
  req.on('data',c=>{b=Buffer.concat([b,c])});
  req.on('end',()=>{
    const bm=(req.headers['content-type']||'').match(/boundary=(.+)$/);
    if(!bm)return cb(new Error('no boundary'));
    const bd='--'+bm[1],buf=Buffer.from('\r\n'+bd);
    let sf=bd.length+2;
    const parts=[],fields={},files={};
    while(true){const i=b.indexOf(buf,sf-2);if(i===-1)break;parts.push(b.slice(sf,i));sf=i+buf.length+2}
    parts.forEach(p=>{
      const he=p.indexOf('\r\n\r\n');if(he===-1)return;
      const hs=p.slice(0,he).toString(),data=p.slice(he+4);
      const nm=(hs.match(/name="([^"]+)")||[])[1];
      const fn=(hs.match(/filename="([^"]+)")||[])[1];
      if(!nm)return;
      if(fn)files[nm]={filename:fn,data};else fields[nm]=data.toString().trim();
    });
    cb(null,fields,files);
  });
}
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname,m=req.method;
  res.setHeader('Access-Control-Allow-Origin','*');
  if(m==='OPTIONS'){res.writeHead(204);return res.end()}
  if(p==='/api/movies'&&m==='GET'){
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify(rdb().movies));
  }
  if(p==='/api/upload'&&m==='POST'){
    return mp(req,(err,fields,files)=>{
      if(err){res.writeHead(400);return res.end(JSON.stringify({error:err.message}))}
      const vf=files.video,sf=files.subtitle;
      if(!vf){res.writeHead(400);return res.end(JSON.stringify({error:'no video'}))}
      const id=Date.now().toString(),ve=path.extname(vf.filename).toLowerCase(),vn=id+ve;
      fs.writeFileSync(path.join(V,vn),vf.data);
      let sn=null;
      if(sf&&sf.filename){
        sn=id+'.vtt';
        const se=path.extname(sf.filename).toLowerCase();
        fs.writeFileSync(path.join(S,sn),se==='.srt'?srt(sf.data.toString('utf8')):sf.data);
      }
      const db=rdb();
      const mv={id,title:fields.title||vf.filename,year:fields.year||2024,genre:fields.genre||'Бусад',description:fields.description||'',videoFile:vn,subFile:sn,thumbnail:null,uploadedAt:new Date().toISOString()};
      db.movies.push(mv);wdb(db);
      res.writeHead(200,{'Content-Type':'application/json'});
      return res.end(JSON.stringify({success:true,movie:mv}));
    });
  }
  if(p.startsWith('/api/movies/')&&m==='DELETE'){
    const id=p.split('/')[3],db=rdb(),mv=db.movies.find(x=>x.id===id);
    if(mv){try{fs.unlinkSync(path.join(V,mv.videoFile))}catch(e){}if(mv.subFile)try{fs.unlinkSync(path.join(S,mv.subFile))}catch(e){} db.movies=db.movies.filter(x=>x.id!==id);wdb(db)}
    res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({success:true}));
  }
  if(p.startsWith('/uploads/videos/')){
    const fp=path.join(V,p.replace('/uploads/videos/',''));
    if(!fs.existsSync(fp)){res.writeHead(404);return res.end()}
    const st=fs.statSync(fp),tot=st.size,rng=req.headers.range;
    if(rng){
      const[s,e]=rng.replace(/bytes=/,'').split('-');
      const st2=parseInt(s,10),en=e?parseInt(e,10):Math.min(st2+1048575,tot-1);
      res.writeHead(206,{'Content-Range':`bytes ${st2}-${en}/${tot}`,'Accept-Ranges':'bytes','Content-Length':en-st2+1,'Content-Type':'video/mp4'});
      fs.createReadStream(fp,{start:st2,end:en}).pipe(res);
    }else{res.writeHead(200,{'Content-Length':tot,'Content-Type':'video/mp4','Accept-Ranges':'bytes'});fs.createReadStream(fp).pipe(res)}
    return;
  }
  if(p.startsWith('/uploads/subs/')){
    const fp=path.join(S,p.replace('/uploads/subs/',''));
    if(!fs.existsSync(fp)){res.writeHead(404);return res.end()}
    res.writeHead(200,{'Content-Type':'text/vtt;charset=utf-8'});return fs.createReadStream(fp).pipe(res);
  }
  let fp;
  if(p==='/'||p==='/index.html')fp=path.join(__dirname,'public/index.html');
  else if(p==='/admin'||p==='/admin.html')fp=path.join(__dirname,'public/admin.html');
  else fp=path.join(__dirname,'public',p);
  if(fs.existsSync(fp)&&fs.statSync(fp).isFile()){
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});
    return fs.createReadStream(fp).pipe(res);
  }
  res.writeHead(404);res.end('404');
}).listen(PORT,()=>console.log('MNFLIX:'+PORT));
