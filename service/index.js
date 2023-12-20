import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
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
const getFileExt = (fileName) => {
  return fileName.split('.').pop() || ''
}
const app = express()
app.use(express.json())
// 1.最简单的上传
const simpleUploadMulter = multer({
  storage: multer.diskStorage({
    //文件位置
    destination: function (req, file, cb) {
      cb(null, tempDir)
    },
    //文件名称
    filename: function (req, file, cb) {
      const fileName = (req.body.md5 || uuidv4()) + '.' + getFileExt(file.originalname)
      req.body.tempPath = path.join(tempDir, fileName)
      req.body.filePath = path.join(filesDir, fileName)
      cb(null, fileName)
    },
  }),
})
app.post('/simpleUpload', simpleUploadMulter.single('file'), (req, res) => {
  const { tempPath, filePath } = req.body
  fs.renameSync(tempPath, filePath)
  res.send(filePath)
})

// 2.分片上传
const chunkUpload = multer({
  storage: multer.diskStorage({
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
  }),
})
app.post('/chunkUpload', chunkUpload.single('file'), (req, res) => {
  const newPath = path.join(chunksDir, req.body.md5)
  if (!fs.existsSync(newPath)) {
    fs.mkdirSync(newPath)
  }
  fs.renameSync(req.file.path, path.join(newPath, req.body.index))
  const chunkNumber = fs.readdirSync(newPath).length
  if (chunkNumber.toString() === req.body.total) {
    const filePath = path.join(filesDir, req.body.md5 + '.' + req.body.ext)
    if (!fs.existsSync(filePath)) {
      for (let i = 0; i < chunkNumber; i++) {
        const data = fs.readFileSync(path.join(chunksDir, req.body.md5, i.toString()))
        fs.appendFileSync(filePath, data)
      }
    }
    //删除分片目录
    res.send(filePath)
    fs.rmSync(newPath, { recursive: true, force: true })
  } else {
    res.send('')
  }
})

// 读取文件
app.get('/' + filesDir + '/*', function (req, res) {
  const fileName = req.params[0]
  res.sendFile(path.resolve(__dirname, filesDir, fileName))
})

// 检查文件是否上传过
app.post('/checkFile', (req, res) => {
  const { md5, ext } = req.body
  const filePath = path.join(filesDir, md5 + '.' + ext)

  if (fs.existsSync(filePath)) {
    console.log('文件已经上传过了')
    res.send({ url: filePath })
  } else {
    const chunkPath = path.join(chunksDir, md5)
    if (fs.existsSync(chunkPath)) {
      console.log('文件没有上传成功过')
      const uploadedList = fs.readdirSync(chunkPath)
      res.send({ uploadedList: uploadedList.map((item) => Number(item)) })
    } else {
      res.send({ uploadedList: [] })
    }
  }
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
