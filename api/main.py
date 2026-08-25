import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import auth, catalog, chat, discover, my_library, playlists, stats

app = FastAPI(title="Spotify Mini Project API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ["FRONTEND_URL"], "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(chat.router)
app.include_router(discover.router)
app.include_router(my_library.router)
app.include_router(playlists.router)
app.include_router(stats.router)
