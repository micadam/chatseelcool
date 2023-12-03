import argparse
from collections import Counter

from nl_twitch_chat.chat_log import get_chats
from nl_twitch_chat.twitch_api import TwitchApi
from nl_twitch_chat.util import get_vod_link_from_comment

STREAMER_IDS = {"northernlion": 14371185, "singsing": 21390470, "rinbanana": 434464251}


def parse_args():
    parser = argparse.ArgumentParser(description="Twitch Chat Log Analyzer")
    parser.add_argument(
        "--streamer-name", type=str.lower, help="Name of the streamer to analyze"
    )
    return parser.parse_args()


def main(args):
    streamer_id = STREAMER_IDS[args.streamer_name]
    print(f"Analyzing {args.streamer_name}'s chat log...")
    twitch_api = TwitchApi()
    videos = twitch_api.twitch_api_get(
        "videos",
        params={"user_id": streamer_id, "type": "archive"},
    )
    chat_logs = get_chats(videos, args.streamer_name)
    print(f"Found {len(chat_logs)} chat logs")
    # Comments by coolseel
    print(
        [
            (c, get_vod_link_from_comment(c, -10))
            for cs in chat_logs.values()
            for c in cs
            if c.commenter == "coolseel"
        ]
    )


if __name__ == "__main__":
    main(parse_args())
