import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import '@mdi/font/css/materialdesignicons.css'
import { setAccessTokenGetter } from './api/client'
import { useAuthStore } from './stores/auth'
import { useLocationStore } from './stores/location'

const app = createApp(App)
const pinia = createPinia()

app.use(router)
app.use(pinia)

/*
	- Wire API client → auth store token (not a one-off localStorage read).
	- Location store owns load/clear of places when the session changes.
*/
setAccessTokenGetter(() => useAuthStore(pinia).token)
useLocationStore(pinia).bindAuthSession()

app.mount('#app')
