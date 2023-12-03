from dataclasses import dataclass
from datetime import datetime


@dataclass
class Comment:
    commenter: str
    createdAt: datetime
    contentOffsetSeconds: int
    message: str
    video_id: str
    game: str
