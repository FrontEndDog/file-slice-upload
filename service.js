import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

//获取文件后缀名
const getFileExt = (fileName) => {
  const tempArr = fileName.split('.')
  return tempArr[tempArr.length - 1]
}
//成功的返回体
const success = (data = null, msg = '请求成功！') => {
  return { data, code: 0, msg: msg }
}

// 配置multer的存储设置
const storage = multer.diskStorage({
  //存储的文件位置
  destination: function (req, file, cb) {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads')
    }
    cb(null, 'uploads/') // 保存的路径
  },
  //存储的文件名称
  filename: function (req, file, cb) {
    cb(null, req.body.md5 + '.' + getFileExt(file.originalname)) // 文件名
  },
})

const upload = multer({ storage: storage })

// 文件上传路由
app.post('/upload', upload.single('file'), (req, res) => {
  // 文件上传成功后的处理逻辑
  res.send(success(req.file.path, '上传成功'))
})

app.get('/file/*', function (req, res) {
  var fileName = req.params[0]
  res.sendFile(path.resolve(__dirname, fileName))
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
