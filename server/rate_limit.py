import os
import time
from collections import defaultdict, deque

MAX_PER_HOUR = int(os.environ.get("HEIRLOOM_MAX_CALLS_PER_HOUR", "60"))
WINDOW_S = 3600
_hits: dict[str, deque[float]] = defaultdict(deque)


def allow(ip: str) -> bool:
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > WINDOW_S:
        q.popleft()
    if len(q) >= MAX_PER_HOUR:
        return False
    q.append(now)
    return True
