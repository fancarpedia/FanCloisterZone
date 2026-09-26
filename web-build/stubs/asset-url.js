// Browser implementation of @/utils/asset-url.
//
// Desktop resolves addon assets to `file://<disk path>`. A browser cannot load file:// URLs, so the
// same logical paths (/userdata/addons/classic/..., /resources/...) resolve to HTTP URLs under the
// virtual filesystem that build-vfs.js mirrors into dist/vfs/.
//
// Resolved against document.baseURI, so it also works when the build is hosted in a subdirectory.
//
// /resources ships in the build under dist/vfs/<VFS_VER>/ — the version segment (from build.js)
// cache-busts the fixed-name artwork files (city.png, resources.svg…) across rebuilds. /userdata is
// NOT versioned: it is served by the Service Worker out of IndexedDB at a plain /vfs/userdata path.
const VFS_VER = (typeof window !== 'undefined' && window.__FCZ_VFS_VER__) || ''

const toUrl = (p) => {
  const s = String(p).replace(/\\/g, '/').replace(/\/+$/, '')
  const base = s.startsWith('/userdata') ? 'vfs' : 'vfs' + (VFS_VER ? '/' + VFS_VER : '')
  return new URL(base + s, document.baseURI).href
}

export function assetDirUrl (folder) {
  return toUrl(folder) + '/'
}

export function assetFileUrl (folder, relPath) {
  return toUrl(folder + '/' + relPath)
}
