<template>
  <div>
    <input type="file" @change="handleInputChange" />

    <div v-for="item in fileList" :key="item.md5">
      <a :href="SERVICE_PATH + item.url" target="_blank">{{ item.file.name }}</a>
      {{ item.progress.toFixed(2) + '%' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import sparkMd5 from 'spark-md5'
import axios from 'axios'
import { reactive } from 'vue'
const SERVICE_PATH = 'http://localhost:3000/' //服务器地址
const CHUNK_SIZE = 1 * 1024 * 1024 //切片大小

interface RawFile {
  file: File
  md5: string
  progress: number
  url: string
}

interface ChunkType {
  index: number
  formData: FormData
  blob: Blob
}

const fileList = reactive<RawFile[]>([])

//input内容发生改变
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
    chunkUpload(rawFile)
    input.value = ''
  }
}

//创建文件切片列表
const createChunkList = (rawFile: RawFile): ChunkType[] => {
  let chunkList: ChunkType[] = []
  const { file, md5 } = rawFile
  const total = Math.ceil(file.size / CHUNK_SIZE)
  for (let i = 0; i < total; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size))
    const formData = new FormData()
    formData.append('md5', md5)
    formData.append('ext', getFileExt(file.name))
    formData.append('index', i.toString())
    formData.append('total', total.toString())
    formData.append('file', chunk)
    chunkList.push({ index: i, formData: formData, blob: chunk })
  }
  return chunkList
}

//分片上传
const chunkUpload = async (rawFile: RawFile) => {
  const existFileRes = await isExistFile(rawFile)
  if (existFileRes.url) {
    rawFile.progress = 100
    rawFile.url = existFileRes.url
    console.log('秒传成功')
    return
  }

  console.log('文件未上传成功过，已经上传过的分片有', existFileRes.uploadedList)

  let chunkList: ChunkType[] = createChunkList(rawFile)
  //过滤掉已经上传过的
  const unloadList: ChunkType[] = chunkList.filter((item) => !existFileRes.uploadedList?.includes(item.index))
  //上传进度列表
  const chunkProgressList: number[] = chunkList.map((_, index) =>
    existFileRes.uploadedList?.includes(index) ? CHUNK_SIZE : 0,
  )
  console.log('还需上传的分片有', unloadList)
  const taskList = unloadList.map((item) => {
    return async () => {
      const res = await axios.post('/api/chunkUpload', item.formData, {
        onUploadProgress: (e) => {
          chunkProgressList[item.index] = Math.min(CHUNK_SIZE, e.loaded)
          const total = chunkProgressList.reduce((total, item) => total + item, 0)
          rawFile.progress = Math.min(100, (total / rawFile.file.size) * 100)
        },
      })
      if (res.data) {
        return res.data
      }
    }
  })
  const res = await asyncQueue(taskList)
  rawFile.url = res

  // await Promise.all(
  //   unloadList.map(async (item) => {
  //     const res = await axios.post('/api/chunkUpload', item.formData, {
  //       onUploadProgress: (e) => {
  //         chunkProgressList[item.index] = Math.min(CHUNK_SIZE, e.loaded)
  //         const total = chunkProgressList.reduce((total, item) => total + item, 0)
  //         rawFile.progress = Math.min(100, (total / rawFile.file.size) * 100)
  //       },
  //     })
  //     if (res.data) {
  //       rawFile.url = res.data
  //     }
  //   }),
  // )
}

// 异步队列 这一部分可以使用p-limit这个库替代
const asyncQueue = (taskList: (() => Promise<string | void>)[], concurrency = 3) => {
  //当前有多少个任务在执行
  let running = 0
  //当前执行到第几个任务
  let currentTaskIndex = 0
  //最终的接口返回结果
  let res: string
  return new Promise<string>((resolve) => {
    const runTask = async (task: () => Promise<string | void>) => {
      running++
      const result = await task()
      if (result) {
        res = result
      }
      running--
      starTask()
    }

    const starTask = () => {
      while (running < concurrency && currentTaskIndex < taskList.length) {
        const task = taskList[currentTaskIndex++]
        runTask(task)
      }
      if (running === 0 && currentTaskIndex === taskList.length) {
        resolve(res)
      }
    }

    starTask()
  })
}

//请求接口判断文件是否存在
const isExistFile = async (rawFile: RawFile) => {
  const res = await axios.post<{ url?: string; uploadedList?: number[] }>('/api/checkFile', {
    md5: rawFile.md5,
    ext: getFileExt(rawFile.file.name),
  })
  return res.data
}

//获取文件的MD5 不做优化的
const getFileMd5 = async (file: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const spark = new sparkMd5.ArrayBuffer()
    const fileReader = new FileReader()
    fileReader.onload = (e: ProgressEvent<FileReader>) => {
      spark.append(e.target?.result as ArrayBuffer)
      resolve(spark.end())
    }
    fileReader.onerror = () => {
      console.log('读取文件出现错误了')
    }
    fileReader.readAsBinaryString(file)
  })
}

//获取文件的MD5 抽样哈希
const getFileMd5Sample = async (file: Blob): Promise<string> => {
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
    fileReader.readAsArrayBuffer(new Blob(sampleFile))
  })
}

//获取文件的MD5 利用浏览器的空闲帧来计算
const getFileMd5Idle = async (file: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const chunkList: Blob[] = []
    for (let i = 0; i < file.size; i += CHUNK_SIZE) {
      const chunk = file.slice(i, Math.min(i + CHUNK_SIZE, file.size))
      chunkList.push(chunk)
    }

    let index = 0
    const spark = new sparkMd5.ArrayBuffer()
    const appendToSpark = async (file: Blob) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.readAsArrayBuffer(file)
        reader.onload = (e: ProgressEvent<FileReader>) => {
          spark.append(e.target?.result as ArrayBuffer)
          resolve()
        }
      })
    }

    const work = async (deadline: { timeRemaining: () => number }) => {
      while (index < chunkList.length && deadline.timeRemaining() > 1) {
        console.log(`正在计算第${index}个,浏览器空闲剩余:${deadline.timeRemaining()}ms`)
        await appendToSpark(chunkList[index])
        index++
        if (index == chunkList.length) {
          console.log('计算完毕')
          resolve(spark.end())
          return
        }
      }
      console.log(`浏览器不空闲了，计算到了第${index}个，等待下次浏览器空闲`)
      window.requestIdleCallback(work)
    }
    window.requestIdleCallback(work)
  })
}

//获取文件后缀名
const getFileExt = (fileName: string): string => {
  return fileName.split('.').pop() || ''
}

defineExpose({
  getFileMd5,
  getFileMd5Idle,
  getFileMd5Sample,
})
</script>

<style scoped></style>
