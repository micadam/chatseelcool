import os
import time

import requests

from nl_twitch_chat import auth

BASE_API_URL = "https://api.twitch.tv/helix"
CLIENT_ID = "qeyx02kvx8uffv4std0did44iyoj35"
CLIENT_SECRET = "s9jf674kb2ekkqqyv1nrs8uftnxuum"


class TwitchApi:
    def __init__(self):
        self.app_access_token, self.expiration_time = auth.get_access_token()

    def get_access_token(self):
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

    def twitch_api_get(self, url, params=None):
        if time.time() > self.expiration_time:
            print("Refreshing token")
            self.app_access_token, self.expiration_time = self.get_access_token()
        full_url = os.path.join(BASE_API_URL, url)
        return requests.get(
            full_url,
            params=params,
            headers={
                "Client-Id": auth.CLIENT_ID,
                "Authorization": f"Bearer {self.app_access_token}",
            },
        )
