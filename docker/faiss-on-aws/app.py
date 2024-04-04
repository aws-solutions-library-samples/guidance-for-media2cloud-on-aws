# pyright: reportMissingImports=false, reportMissingModuleSource=false
import traceback
import os
import json
import time
import faiss
import numpy as np
from utils import get_object, put_object

# image embedding size
DIMENSION = 768

def test_mode():
    """
    test_mode() runs test to ensure faiss installed
    """
    index = faiss.IndexFlatIP(3)

    for item in [[1, 1, 1], [1, 2, 1], [1, 3, 1], [1, 4, 1]]:
        embeddings = np.array([item])
        index.add(embeddings)
    print(index.ntotal)

def lambda_handler(event, context):
    """
    lambda_handler() lambda entrypoint
    :param event: requires {"bucket", "prefix", "embeddings", "similarity"}
    :param context: lambda context
    : return: event
    """
    frame_similarity = []
    try:
        # special case
        if len(event.keys()) == 0:
            return test_mode()

        if not set(("bucket", "prefix", "embeddings", "similarity")).issubset(event):
            raise ValueError("missing input field(s)")

        bucket = event["bucket"]
        prefix = event["prefix"]
        key = os.path.join(prefix, event["embeddings"])
        output = event["similarity"]

        tsta = round(time.time() * 1000) if "tsta" not in event else event["tsta"]

        # load embeddings json and index it
        frames = json.loads(get_object(bucket, key))

        # create index
        dimension = len(frames[0]["embeddings"])
        index = faiss.IndexFlatIP(dimension) # cosine similarity

        for frame in frames:
            embeddings = np.array([frame["embeddings"]])
            index.add(embeddings)
        print(index.ntotal)

        # for each item, search for similar frames
        for idx in range(len(frames)):
            frame = frames[idx]
            embeddings = np.array([frame["embeddings"]])
            D, I = index.search(embeddings, k = 20)
            similar_frames = [ { "I": int(i), "D": float(d) } for i, d in zip(I[0], D[0]) ]
            similar_frames = list(filter(lambda x: x["D"] > 0.70 and x["I"] != idx, similar_frames))

            frame_similarity.append({
                "idx": idx,
                "name": frame["name"],
                "similar_frames": similar_frames
            })

        # upload json output
        output_key = os.path.join(prefix, output)
        put_object(
            bucket,
            output_key,
            json.dumps(frame_similarity, default=str),
            "application/json")

        # update event for the next re-entry of the lambda
        tend = round(time.time() * 1000)
        event["tsta"] = tsta
        event["tend"] = tend
        print(f"== TOTAL RUNTIME: {round((tend - tsta) / 1000)}s ==")

        return event
    except Exception as e:
        print(f"[ERR]: {type(e).__name__}")
        traceback.print_exc()
        raise e
