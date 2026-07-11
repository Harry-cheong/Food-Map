# Local Set-up

1. Frontend
- runs vue's development server

```shell
npm run dev
```

2. Backend
- runs FastAPI REST API and exposes a public URL for a webhook for Meta Instagram Graph API

```shell
uvicorn main:app --reload --port 8000
ngrok http 8000
```