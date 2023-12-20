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
  console.log(res)
}
</script>
