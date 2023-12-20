<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>

  <div class="flex">
    <FileUpload></FileUpload>
    <FileUpload2></FileUpload2>
  </div>
</template>
<script setup lang="ts">
import FileUpload from './components/FileUpload.vue'
import FileUpload2 from './components/FileUpload2.vue'
</script>
<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.flex {
  display: flex;
  text-align: left;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
@keyframes move {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-200px);
  }
  100% {
    transform: translateY(0px);
  }
}
.logo {
  /* animation: move 3s linear infinite; */
}
</style>
