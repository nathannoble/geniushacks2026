from fastapi.staticfiles import StaticFiles

app.mount("/ui", StaticFiles(directory="app/ui/static", html=True), name="ui")