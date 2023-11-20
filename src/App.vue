<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <input ref="input" type="file" @change="fileChoose" />
  <div>
    <a v-if="fileLink" :href="fileLink" target="_blank">{{ fileLink }}</a>
  </div>
  <HelloWorld msg="Vite + Vue" />
</template>
<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import sparkMd5 from 'spark-md5'
import axios from 'axios'
import { ref } from 'vue'

const fileLink = ref<string>('')
//获取文件的MD5
const getFileMd5 = async (file: File): Promise<string> => {
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
const fileChoose = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    upload(file)
  }
}

const upload = async (file: File) => {
  const formData = new FormData()
  const md5 = await getFileMd5(file)
  formData.append('md5', md5)
  formData.append('file', file)
  const result = await axios.post('/api/upload', formData)
  fileLink.value = 'http://localhost:3000/file/' + result.data.data
}
</script>
<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
