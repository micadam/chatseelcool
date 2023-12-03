import requests
import time

CLIENT_ID = "qeyx02kvx8uffv4std0did44iyoj35"
CLIENT_SECRET = "s9jf674kb2ekkqqyv1nrs8uftnxuum"


def get_access_token():
    app_access_token_response = requests.post(
        "https://id.twitch.tv/oauth2/token",
        params={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "client_credentials",
        },
    )

    expires_in = app_access_token_response.json()["expires_in"]
    expiration_time = time.time() + expires_in
    return app_access_token_response.json()["access_token"], expiration_time
