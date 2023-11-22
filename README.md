# 文件切片上传

## 实现的功能

- [ ] 文件切片上传
- [ ] 服务端合并文件
- [ ] 断点续传
- [ ] 秒传

## 服务端

- 使用 `express` 作为服务端框架
- 使用 `fs` 模块来处理文件系统操作
- 使用 `multer` 中间件处理上传文件

## 环境准备

```bash
# 初始化项目 选择 Vue + TypeScript
pnpm create vite
# 安装相关依赖
pnpm i express multer axios spark-md5 uuid -S
pnpm i @types/spark-md5 @types/uuid node-dev -D
# 代码规范(可跳过)
pnpm i eslint-config-fed -D
```

代码规范可按照[README.md](https://github.com/FrontEndDog/eslint-prettier)中的步骤配置代码规范。

### 处理开发环境跨域

```ts
// vite.config.ts 添加server.proxy配置
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

### 实现一个最简单的文件上传

```html
<template>
  <input type="file" @change="handleInputChange" />
</template>

<script setup lang="ts">
  import axios from 'axios'
  const handleInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      const file = input.files[0]
      simpleUpload(file)
    }
  }
  const simpleUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await axios.post('/api/simpleUpload', formData)
  }
</script>
```

### 添加一个上传进度展示

```html
<template>
  <input type="file" @change="handleInputChange" />
  <div v-for="item in fileList" :key="item.uuid">
    <a :href="item.url" target="_blank">{{ item.file.name }}</a>
    {{ item.progress.toFixed(2) + '%' }}
  </div>
</template>

<script setup lang="ts">
  import axios from 'axios'
  import { reactive } from 'vue'
  import { v4 as uuidv4 } from 'uuid'
  interface RawFile {
    uuid: string
    file: File
    progress: number
    url: string
  }
  const fileList = reactive<RawFile[]>([])
  const handleInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      const file = input.files[0]
      const rawFile = reactive({
        uuid: uuidv4(),
        file: file,
        progress: 0,
        url: '',
      })
      fileList.push(rawFile)
      simpleUpload(rawFile)
      input.value = ''
    }
  }
  const simpleUpload = async (rawFile: RawFile) => {
    const formData = new FormData()
    formData.append('file', rawFile.file)
    const res = await axios.post('/api/simpleUpload', formData, {
      onUploadProgress: (e) => {
        if (e.progress) {
          rawFile.progress = e.progress * 100
        }
      },
    })
    rawFile.url = 'http://localhost:3000/' + res.data
  }
</script>
```
