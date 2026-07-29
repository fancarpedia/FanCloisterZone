import path from 'path'

// URLs for addon assets (tile images, artwork icons).
//
// On desktop, addons are folders on the local disk, so their assets are `file://` URLs. This module
// is the single place that knows that — the browser build aliases it to resolve the same logical
// paths over HTTP instead. Keep `file://` construction out of the rest of the app so the platform
// difference stays in one file.

/** URL prefix for an addon/artwork folder. Ends with '/', so `prefix + relPath` is a valid URL. */
export function assetDirUrl (folder) {
  return `file://${folder}/`
}

/** Absolute URL of a single file inside an addon folder. */
export function assetFileUrl (folder, relPath) {
  return 'file://' + path.join(folder, relPath)
}
