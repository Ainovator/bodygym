import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
async function walk(path) {
  const entries = await readdir(`dist${path}`, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(`${path}/${e.name}`) : `${path}/${e.name}`)),
  )
  return files.flat()
}
const assets = (await walk('')).filter((p) => p !== '/sw.js')
const hash = createHash('sha256')
  .update(await readFile('dist/index.html'))
  .update(JSON.stringify(assets))
  .digest('hex')
  .slice(0, 12)
await writeFile(
  'dist/sw.js',
  `const CACHE='feetwork-${hash}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('feetwork-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
`,
)
console.log(`PWA shell: ${assets.length} local assets, version ${hash}`)
