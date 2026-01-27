const https = require('https')
const fs = require('fs')

function download (url, w) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res1 => {
        https
          .get(res1.headers.location, res2 => {
            res2.pipe(w)
            res2.on('error', reject)
            res2.on('end', resolve)
          })
          .on('error', reject)
      })
      .on('error', reject)
  })
};

fs.access('Engine.jar', fs.F_OK, err => {
  if (err) {
    download('https://github.com/fancarpedia/JCloisterZoneEngine/releases/download/v6.1.8/Engine.jar', fs.createWriteStream('Engine.jar'))
  }
})
