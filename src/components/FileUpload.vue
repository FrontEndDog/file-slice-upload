<template>
  <input type="file" @change="handleInputChange" />

  <div v-for="item in fileList" :key="item.md5">
    <a :href="SERVICE_PATH + item.url" target="_blank">{{ item.file.name }}</a>
    {{ item.progress.toFixed(2) + '%' }}
  </div>
</template>

<script setup lang="ts">
import sparkMd5 from 'spark-md5'
import axios from 'axios'
import { reactive } from 'vue'
const SERVICE_PATH = 'http://localhost:3000/' //服务器地址
const CHUNK_SIZE = 100 * 1024 //切片大小

interface RawFile {
  file: File
  md5: string
  progress: number
  url: string
}
const fileList = reactive<RawFile[]>([])

const handleInputChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    const md5 = await getFileMd5(file)
    const rawFile: RawFile = reactive({
      file,
      md5,
      progress: 0,
      url: '',
    })
    fileList.push(rawFile)
    // simpleUpload(rawFile)
    chunkUpload(rawFile)
    input.value = ''
  }
}

//普通上传
const simpleUpload = async (rawFile: RawFile) => {
  if (await isExistFile(rawFile)) return
  const formData = new FormData()
  formData.append('md5', rawFile.md5)
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

//创建文件切片列表
// const createChunkList = (file: File): Blob[] => {
//   let chunkList: Blob[] = []
//   for (let i = 0; i < file.size; i += CHUNK_SIZE) {
//     const chunk = file.slice(i, Math.min(i + CHUNK_SIZE, file.size))
//     chunkList.push(chunk)
//   }
//   return chunkList
// }

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
console.log(simpleUpload, chunkUpload)

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

//获取文件的MD5
const getFileMd5 = async (file: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const spark = new sparkMd5.ArrayBuffer()
    const fileReader = new FileReader()
    fileReader.onload = (e: ProgressEvent<FileReader>) => {
      spark.append(e.target?.result as ArrayBuffer)
      resolve(spark.end())
    }
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
    // fileReader.readAsArrayBuffer(file)
    fileReader.readAsArrayBuffer(new Blob(sampleFile))
  })
}

//获取文件后缀名
const getFileExt = (fileName: string): string => {
  return fileName.split('.').pop() || ''
}
</script>

<style scoped></style>
