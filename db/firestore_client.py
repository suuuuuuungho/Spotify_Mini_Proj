import os

from dotenv import load_dotenv
from google.cloud import firestore

load_dotenv()

_client = None


def get_client():
    global _client
    if _client is None:
        _client = firestore.Client.from_service_account_json(
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
        )
    return _client
