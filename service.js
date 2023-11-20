const express = require('express')
const multer = require('multer')
const app = express()

// 配置multer的存储设置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // 保存的路径
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname) // 文件名
  },
})

const upload = multer({ storage: storage })

// 文件上传路由
app.post('/upload', upload.single('file'), (req, res) => {
  // 文件上传成功后的处理逻辑
  res.send('File uploaded successfully!')
})

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})
