import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import axios from 'axios'

export default function () {
  console.log('[installer] Module initialized')

  ipcMain.on('installer.download-file', async (event, payload) => {
    console.log('[installer] Download request received:', payload)
    
    const { url, id } = payload
    const win = event.sender
    const fileName = path.basename(url.split('?')[0]) // Remove query params from filename
    const downloadPath = path.join(app.getPath('downloads'), fileName)

    console.log('[installer] Starting download:', { url, id, fileName, downloadPath })

    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        maxRedirects: 5, // Follow up to 5 redirects
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = (progressEvent.loaded / progressEvent.total) * 100
            console.log('[installer] Progress:', percent.toFixed(1) + '%')
            win.send('download-progress', { id, percent })
          }
        }
      })

      console.log('[installer] Got response, status:', response.status)

      const totalBytes = parseInt(response.headers['content-length'], 10)
      let receivedBytes = 0

      const writer = fs.createWriteStream(downloadPath)

      response.data.on('data', (chunk) => {
        receivedBytes += chunk.length
        if (totalBytes) {
          const percent = (receivedBytes / totalBytes) * 100
          console.log('[installer] Progress:', percent.toFixed(1) + '%')
          win.send('download-progress', { id, percent })
        }
      })

      response.data.pipe(writer)

      writer.on('finish', () => {
        console.log('[installer] Download complete:', downloadPath)
        win.send('download-complete', { id, filePath: downloadPath })
      })

      writer.on('error', (err) => {
        console.error('[installer] Write error:', err)
        fs.unlink(downloadPath, () => {})
        win.send('download-error', { id, errorMessage: err.message })
      })

    } catch (err) {
      console.error('[installer] Axios error:', err.message)
      if (err.response) {
        console.error('[installer] Response status:', err.response.status)
        console.error('[installer] Response headers:', err.response.headers)
      }
      fs.unlink(downloadPath, () => {})
      win.send('download-error', { id, errorMessage: err.message })
    }
  })

  ipcMain.on('installer.run', async (event, filePath) => {
    console.log('[installer] Running installer:', filePath)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('[installer] File does not exist:', filePath)
      event.sender.send('installer.error', 'File not found: ' + filePath)
      return
    }
    
    console.log('[installer] File exists, executing...')
    event.sender.send('installer.started')
    
    exec(`"${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('[installer] Exec error:', error)
        event.sender.send('installer.error', error.message)
      } else {
        console.log('[installer] Installer started successfully')
        if (stdout) console.log('[installer] stdout:', stdout)
        if (stderr) console.log('[installer] stderr:', stderr)
      }
    })
  })

  return {
    winCreated (win) {
      console.log('[installer] Window created')
    },
    winClosed (win) {
      console.log('[installer] Window closed')
    }
  }
}
