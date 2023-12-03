import requests
from datetime import datetime
import uuid

from nl_twitch_chat.coment import Comment


def get_datetime(date_string):
    return datetime.strptime(
        date_string,
        "%Y-%m-%dT%H:%M:%S.%fZ" if "." in date_string else "%Y-%m-%dT%H:%M:%SZ",
    )


def get_vod_link_from_comment(comment: Comment, offset=0) -> str:
    return f"https://twitch.tv/videos/{comment.video_id}?t={comment.contentOffsetSeconds + offset}s"


HEADERS = {
    "Client-ID": "kd1unb4b3q4t58fwlpcbzcbnm76a8fp",
    "Accept": "application/vnd.twitchtv.v5+json",
    "X-Device-Id": uuid.uuid4().hex,
}


def gql(query: str):
    response = requests.post(
        "https://gql.twitch.tv/gql", json={"query": query}, headers=HEADERS
    )
    if response.status_code != 200 or "errors" in response.json():
        print(response.json())
        print(response.request.body)
        raise RuntimeError("GQL request failed")
    return response
