# 文件切片上传

## 实现的功能

- [ ] 上传进度展示
- [ ] 秒传
- [ ] 文件切片上传
- [ ] 控制切片的并发数
- [ ] 断点续传

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

如有添加代码规范可按照[README.md](https://github.com/FrontEndDog/eslint-prettier)中的步骤配置。

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

### 添加一个上传进度和文件预览

```html
<template>
  <input type="file" @change="handleInputChange" />

  <div v-for="item in fileList" :key="item.uuid">
    <a :href="SERVICE_PATH + item.url" target="_blank">{{ item.file.name }}</a>
    {{ item.progress.toFixed(2) + '%' }}
  </div>
</template>

<script setup lang="ts">
  import axios from 'axios'
  import { reactive } from 'vue'
  import { v4 as uuidv4 } from 'uuid'
  const SERVICE_PATH = 'http://localhost:3000/'
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
    rawFile.url = res.data
  }
</script>
```

### 秒传

在文件上传之前，先发一个请求给服务器，询问服务器该文件是否存在

如果存在，服务器返回该文件路径。

如果不存在，则开始上传。

### 文件唯一性的判断

```html
<script setup lang="ts">
  import sparkMd5 from 'spark-md5'
  //获取文件的MD5
  const getFileMd5 = async (file: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const spark = new sparkMd5.ArrayBuffer()
      const fileReader = new FileReader()
      fileReader.onload = (e: ProgressEvent<FileReader>) => {
        spark.append(e.target?.result as ArrayBuffer)
        resolve(spark.end())
      }
      fileReader.readAsArrayBuffer(file)
    })
  }
</script>
```

### 在formData中添加额外的信息

```html
<script setup lang="ts">
  const md5 = await getFileMd5(file)

  formData.append('md5', rawFile.md5)
</script>
```

### 文件特别大 计算MD5的时候浏览器卡死怎么办

有三种处理方法

1.window.requestIdleCallback 传入一个函数,这个函数将在浏览器空闲时期被调用

2.new Worker 开一个新的后台线程，来计算MD5

3.抽样计算MD5（牺牲了一部分准确性）

前两种方法计算依赖于文件切片，后面再介绍，这里先说一下第三种方法

```html
<script setup lang="ts">
  //取第一块切片的全部
  const sampleFile = [file.slice(0, CHUNK_SIZE)]
  for (let i = CHUNK_SIZE; i < file.size; i += CHUNK_SIZE) {
    if (i + CHUNK_SIZE >= file.size) {
      //取最后一个切片的全部
      sampleFile.push(file.slice(i, file.size))
    } else {
      //中间切片取2个字节
      sampleFile.push(file.slice(i, i + 2))
    }
  }
  fileReader.readAsArrayBuffer(new Blob(sampleFile))
</script>
```

### 判断文件是否已经上传过

```html
<script setup lang="ts">
  //判断文件是否存在
  const isExistFile = async (rawFile: RawFile) => {
    const res = await axios.post('/api/checkFile', { md5: rawFile.md5, ext: getFileExt(rawFile.file.name) })
    if (res.data) {
      rawFile.progress = 100
      rawFile.url = res.data
      return true
    } else {
      return false
    }
  }
</script>
```

### 分片上传

```html
<script setup lang="ts">
  //分片上传
  const chunkUpload = async (rawFile: RawFile) => {
    if (await isExistFile(rawFile)) return
    const chunkList: Blob[] = []
    for (let i = 0; i < rawFile.file.size; i += CHUNK_SIZE) {
      const chunk = rawFile.file.slice(i, Math.min(i + CHUNK_SIZE, rawFile.file.size))
      chunkList.push(chunk)
    }
    const chunkProgressList = chunkList.map(() => 0)
    await Promise.all(
      chunkList.map(async (item, index) => {
        const chunkMd5 = await getFileMd5(item)
        const formData = new FormData()
        formData.append('chunkMd5', chunkMd5)
        formData.append('md5', rawFile.md5)
        formData.append('ext', getFileExt(rawFile.file.name))
        formData.append('index', index.toString())
        formData.append('total', chunkList.length.toString())
        formData.append('file', item)
        const res = await axios.post('/api/chunkUpload', formData, {
          onUploadProgress: (e) => {
            chunkProgressList[index] = Math.min(CHUNK_SIZE, e.loaded)
            const total = chunkProgressList.reduce((total, item) => total + item, 0)
            rawFile.progress = Math.min(100, (total / rawFile.file.size) * 100)
          },
        })
        if (res.data) {
          rawFile.url = res.data
        }
      }),
    )
  }
</script>
```
