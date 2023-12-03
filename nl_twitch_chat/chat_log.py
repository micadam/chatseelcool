import json
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from tqdm import tqdm

from nl_twitch_chat.coment import Comment
from nl_twitch_chat.util import get_datetime, gql


def get_chats(videos, streamer_name):
    DURATION_RE = re.compile(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?")

    result: Dict[str, List[Comment]] = defaultdict(list)
    chapters: Dict[str, List] = defaultdict(list)
    data_dir = f"data-{streamer_name}"
    os.makedirs(data_dir, exist_ok=True)
    for video in tqdm(videos.json()["data"]):
        res = []
        has_next_page = True
        cursor = None
        video_id = video["id"]
        chapters[video_id] = get_video_chapters(video_id)
        duration_match = DURATION_RE.match(video["duration"])
        duration = sum(
            int(x or 0) * 60**i
            for i, x in enumerate(reversed(duration_match.groups()))
        )

        with tqdm(total=duration, unit="s", desc=video["created_at"]) as video_bar:
            if os.path.isfile(f"{data_dir}/{video['created_at']}.json"):
                with open(os.path.join(data_dir, f"{video['created_at']}.json")) as f:
                    objs = json.load(f)
                    result[video["created_at"]] = [
                        Comment(
                            comment["commenter"],
                            datetime.fromisoformat(comment["createdAt"]),
                            comment["contentOffsetSeconds"],
                            comment["message"],
                            comment["video_id"],
                            comment["game"] if "game" in comment else None,
                        )
                        for comment in objs
                    ]
                    video_bar.update(video_bar.total)
                    continue
            while has_next_page:
                query = f"""
                    query {{
                        video(id: "{video_id}") {{
                            comments{f'(after: "{cursor}")' if cursor else ''} {{
                                edges {{
                                    cursor
                                    node {{
                                        commenter {{
                                            displayName
                                            login
                                        }}
                                        createdAt
                                        contentOffsetSeconds
                                        message {{
                                            fragments {{
                                                text
                                            }}
                                        }}
                                    }}
                                }}
                                pageInfo {{
                                    hasNextPage
                                }}
                            }}
                        }}
                    }}
                """
                response = gql(query)
                comments = response.json()["data"]["video"]["comments"]
                has_next_page = comments["pageInfo"]["hasNextPage"]
                if len(comments["edges"]) == 0:
                    print(response.json())
                    raise IOError("Bad.")
                for comment in comments["edges"]:
                    if len(comment["node"]["message"]["fragments"]) == 0:
                        print(comment)
                        continue
                    res.append(
                        Comment(
                            commenter=comment["node"]["commenter"]["displayName"]
                            if comment["node"]["commenter"]
                            else "UNKNOWN",
                            createdAt=get_datetime(comment["node"]["createdAt"]),
                            contentOffsetSeconds=comment["node"][
                                "contentOffsetSeconds"
                            ],
                            message=comment["node"]["message"]["fragments"][0]["text"],
                            video_id=video_id,
                            game=max(
                                (
                                    c
                                    for c in chapters[video_id]
                                    if c["positionMilliseconds"] // 1000
                                    <= comment["node"]["contentOffsetSeconds"]
                                ),
                                key=lambda c: c["positionMilliseconds"],
                                default={"description": "UNKNOWN"},
                            )["description"],
                        )
                    )
                cursor = comments["edges"][-1]["cursor"]
                video_bar.update(
                    comments["edges"][-1]["node"]["contentOffsetSeconds"] - video_bar.n
                )
            result[video["created_at"]] = res
            with open(f"{data_dir}/{video['created_at']}.json", "w") as f:
                json.dump(
                    res,
                    f,
                    indent=2,
                    default=lambda o: o.isoformat()
                    if isinstance(o, datetime)
                    else o.__dict__,
                )
    return result


def get_video_chapters(video_id: str) -> list:
    has_next_page = True
    cursor = None
    chapters = []
    while has_next_page:
        query = f"""
            query {{
                video(id: "{video_id}") {{
                    moments(momentRequestType: VIDEO_CHAPTER_MARKERS {f', after: "{cursor}"' if cursor else ''}) {{
                        edges {{
                            cursor
                            node {{
                                description
                                positionMilliseconds
                            }}
                        }}
                        pageInfo {{
                            hasNextPage
                        }}
                    }}
                }}
            }}
        """
        response = gql(query).json()["data"]
        cursor = (
            response["video"]["moments"]["edges"][-1]["cursor"]
            if len(response["video"]["moments"]["edges"]) > 0
            else None
        )
        has_next_page = response["video"]["moments"]["pageInfo"]["hasNextPage"]
        chapters.extend(e["node"] for e in response["video"]["moments"]["edges"])
    return chapters
