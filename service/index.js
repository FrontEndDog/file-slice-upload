import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
//当前的绝对路径
const __dirname = path.dirname(fileURLToPath(import.meta.url))
//文件的存储目录
const filesDir = 'files'
//文件分片存储目录
const chunksDir = 'chunks'
//文件临时目录
const tempDir = '.temp'
//系统启动时，如果目录不存在 则创建
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir)
}
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir)
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir)
}

const app = express()

// ----------普通上传start----------

//配置multer的存储设置
const storage = multer.diskStorage({
  //存储的文件位置
  destination: function (req, file, cb) {
    cb(null, tempDir)
  },
  //存储的文件名称
  filename: function (req, file, cb) {
    cb(null, req.body.md5 + '.' + req.body.ext)
  },
})
const upload = multer({ storage: storage })

// 文件上传
app.post('/upload', upload.single('file'), (req, res) => {
  // 文件上传成功后从临时文件夹移动到正式文件夹
  const newPath = path.join(filesDir, req.body.md5 + '.' + req.body.ext)
  fs.renameSync(req.file.path, newPath)
  res.send(newPath)
})

// ----------普通上传end----------

// ----------分片上传start----------

// 配置multer的存储设置
const chunkStorage = multer.diskStorage({
  //存储的文件位置
  destination: function (req, file, cb) {
    const chunkPath = path.join(tempDir, req.body.md5)
    if (!fs.existsSync(chunkPath)) {
      fs.mkdirSync(chunkPath)
    }
    cb(null, chunkPath)
  },
  //存储的文件名称
  filename: function (req, file, cb) {
    cb(null, req.body.index)
  },
})
const chunkUpload = multer({ storage: chunkStorage })

// 文件分片上传
app.post('/chunkUpload', chunkUpload.single('file'), (req, res) => {
  const newPath = path.join(chunksDir, req.body.md5)
  if (!fs.existsSync(newPath)) {
    fs.mkdirSync(newPath)
  }
  fs.renameSync(req.file.path, path.join(newPath, req.body.index))
  const chunkSize = fs.readdirSync(newPath).length
  if (chunkSize.toString() === req.body.total) {
    const filePath = path.join(filesDir, req.body.md5 + '.' + req.body.ext)
    if (!fs.existsSync(filePath)) {
      for (let i = 0; i < chunkSize; i++) {
        const data = fs.readFileSync(path.join(chunksDir, req.body.md5, i.toString()))
        fs.appendFileSync(filePath, data)
        fs.unlinkSync(path.join(chunksDir, req.body.md5, i.toString()))
      }
    }
    res.send(filePath)
  } else {
    res.send('')
  }
})
// ----------分片上传end----------

// 读取文件
app.get('/' + filesDir + '/*', function (req, res) {
  const fileName = req.params[0]
  res.sendFile(path.resolve(__dirname, filesDir, fileName))
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
