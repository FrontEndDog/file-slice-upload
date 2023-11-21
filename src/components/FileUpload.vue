<template>
  <div>
    <input type="file" @change="fileChoose" />
    <!-- 文件列表 -->
    <div v-for="item in fileList" :key="item.md5">
      <a :href="item.url" target="_blank">{{ item.file.name }}</a>
      {{ item.progress.toFixed(2) + '%' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import sparkMd5 from 'spark-md5'
import axios from 'axios'
import { reactive } from 'vue'
interface RawFile {
  file: File
  progress: number
  md5: string
  url: string
}
const fileList = reactive<RawFile[]>([])

const fileChoose = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    const md5 = await getFileMd5(file)
    const rawFile: RawFile = reactive({
      file,
      progress: 0,
      md5,
      url: '',
    })
    fileList.push(rawFile)
    console.log(upload, chunkUpload)
    // upload(rawFile)
    chunkUpload(rawFile)
    input.value = ''
  }
}

//普通上传
const upload = async (rawFile: RawFile) => {
  const formData = new FormData()
  formData.append('md5', rawFile.md5)
  formData.append('ext', getFileExt(rawFile.file.name))
  formData.append('file', rawFile.file)
  const res = await axios.post('/api/upload', formData, {
    onUploadProgress: (e) => {
      if (e.progress) {
        rawFile.progress = e.progress * 100
      }
    },
  })
  rawFile.progress = 100
  rawFile.url = 'http://localhost:3000/' + res.data
}

//分片上传
const chunkUpload = async (rawFile: RawFile) => {
  const chunkSize = 100 * 1024
  const chunkList: Blob[] = []
  for (let i = 0; i < rawFile.file.size; i += chunkSize) {
    const chunk = rawFile.file.slice(i, Math.min(i + chunkSize, rawFile.file.size))
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
          chunkProgressList[index] = e.loaded
          const total = chunkProgressList.reduce((item) => (item += e.loaded), 0)
          rawFile.progress = (total / rawFile.file.size) * 100
        },
      })
      if (res.data) {
        rawFile.progress = 100
        rawFile.url = 'http://localhost:3000/' + res.data
      }
    }),
  )
}

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

//获取文件后缀名
const getFileExt = (fileName: string): string => {
  const tempArr = fileName.split('.')
  return tempArr[tempArr.length - 1]
}
</script>

<style scoped></style>
