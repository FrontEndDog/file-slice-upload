# 文件切片上传

文件切片上传demo

- [ ] 切片上传
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
pnpm i express multer axios spark-md5 -S
pnpm i @types/spark-md5 -D
# 代码规范(可跳过)
pnpm i eslint-config-fed -D
# 启动项目
pnpm run dev
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
