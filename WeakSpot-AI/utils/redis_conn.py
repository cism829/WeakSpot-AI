from redis import Redis, from_url
import os

def get_redis() -> Redis:
    """
    Robust Redis client for Windows:
    - IPv4 loopback (127.0.0.1)
    - Default port 6380 
    - Keepalive + health checks
    - Timeouts + retry on timeout
    """
    url = os.getenv("RQ_REDIS_URL")  # e.g. redis://127.0.0.1:6380/0
    if url:
        return from_url(
            url,
            socket_keepalive=True,
            health_check_interval=10,
            socket_timeout=10,
            retry_on_timeout=True,
            decode_responses=False,
        )

    host = os.getenv("REDIS_HOST", "127.0.0.1")
    port = int(os.getenv("REDIS_PORT", "6380"))
    db   = int(os.getenv("REDIS_DB", "0"))

    return Redis(
        host=host,
        port=port,
        db=db,
        socket_keepalive=True,
        health_check_interval=10,
        socket_timeout=10,
        retry_on_timeout=True,
        decode_responses=False,
    )
