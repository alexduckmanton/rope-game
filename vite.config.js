import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const isItch = process.env.BUILD_TARGET === 'itch'

  return {
    base: isItch ? './' : '/',
  }
})
