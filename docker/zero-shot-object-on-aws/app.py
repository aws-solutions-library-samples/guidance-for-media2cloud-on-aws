# pyright: reportMissingImports=false, reportMissingModuleSource=false
import os
import json
import time
import traceback
import torch
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
from utils import get_object, put_object, load_from_file, load_from_s3, quit_now

CHECKPOINT = "google/owlvit-base-patch32"
DEFAULT_CLASSES_JSON = "default_classes.json"

def load_model(checkpoint = CHECKPOINT):
    """
    load_model() load object detection model

    :param checkpoint: (optional) model checkpoint
    :return: model, processor
    """
    t0 = time.time()
    model = AutoModelForZeroShotObjectDetection.from_pretrained(checkpoint)
    processor = AutoProcessor.from_pretrained(checkpoint)
    t1 = time.time()
    print(f"=== Loading model: {round(t1 - t0, 3)}s")
    return model, processor

def run_model(
        model,
        processor,
        image,
        candidate_labels):
    """
    run_model() runs object detection model

    :param model: object detection model
    :param processor: object detection processor
    :param image: image to inference
    :param candidate_labels: zero shot labels
    :return: [{ label, score, box: {l, t, w, h} }, ...]
    """
    outputs = None
    w, h = image.size
    _image = image.convert("RGB")
    inputs = processor(images=_image, text=candidate_labels, return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)
        target_sizes = torch.tensor([_image.size[::-1]])
        outputs = processor.post_process_object_detection(
            outputs,
            threshold=0.1,
            target_sizes=target_sizes
        )[0]

    scores = outputs["scores"].tolist()
    labels = outputs["labels"].tolist()
    boxes = outputs["boxes"].tolist()

    # convert to l, t, w, h and normalize them to (0, 1)
    return [
        {
            "label": candidate_labels[label],
            "score": round(score, 3),
            "box": {
                "l": round(box[0] / w, 5),
                "t": round(box[1] / h, 5),
                "w": round((box[2] - box[0]) / w, 5),
                "h": round((box[3] - box[1]) / h, 5),
            }
        }
        for box, score, label in zip(boxes, scores, labels)
    ]

def load_labels(event):
    """
    load_labels() loads labels. If labelconfig present, loads labels from s3. Otherwise, use default_classes.json

    :param event: event from lambda_handler
    :return: [labels]
    """
    if "labelconfig" not in event:
        return json.load(open(DEFAULT_CLASSES_JSON))
    labels = get_object(event["bucket"], event["labelconfig"])
    return json.loads(labels)

def load_previous_run(bucket, prefix, output):
    """
    load_previous_run() loads json results from the previous run if exists

    :param bucket: bucket of the image
    :param prefix: prefix of the image
    :param output: name of the output json file
    :return: [ { name, labels }, ...]
    """
    items = []
    try:
        key = os.path.join(prefix, output)
        items = get_object(bucket, key).decode('utf-8')
        items = json.loads(items)
    except:
        pass
    return items

def process_local_file(file):
    """
    process_local_file() special case for processing local file and preloaded the model

    :param file: local file of the image
    :return: item
    """
    model, processor = load_model()
    image = load_from_file(file)
    item = run_model(
        model,
        processor,
        image,
        ["woman", "dog"])
    return item

def process_image(
        model,
        processor,
        candidate_labels,
        bucket,
        prefix,
        name):
    """
    process_image() process per image

    :param model: object detection model
    :param processor: object detection processor
    :oaram candidate_labels: labels to detect
    :param bucket: bucket of the image
    :param prefix: prefix of the image
    :param name: name of the image
    :return: { name, labels }
    """
    t0 = time.time()

    key = os.path.join(prefix, name)
    image = load_from_s3(bucket, key)
    labels = run_model(
        model,
        processor,
        image,
        candidate_labels)

    t1 = time.time()
    print(f"=== PROCESSED: {name} ({len(labels)} labels), {round(t1 - t0)}s")

    return {
        "name": name,
        "labels": labels
    }

def set_completed(event, params = {}):
    if "next_index" in event:
        del event["next_index"]
    return {
        **event,
        **params,
        "tend": round(time.time() * 1000),
        "status": "COMPLETED"
    }

def set_progress(event, params = {}):
    print(f"== [info]: set_progress.before: {event}, {params}")
    _params = {
        **event,
        **params,
        "status": "IN_PROGRESS"
    }
    print(f"== [info]: set_progress.after: {_params}")
    return _params

def lambda_handler(event, context):
    """
    lambda_handler() lambda entrypoint
    """
    try:
        print("event =", json.dumps(event, indent=2))

        if "local_file" in event:
            return process_local_file(event["local_file"])

        if not set(("bucket", "prefix", "json", "output")).issubset(event):
            raise ValueError("missing input field(s)")

        bucket = event["bucket"]
        prefix = event["prefix"]
        output = event["output"]

        # set start time
        tsta = round(time.time() * 1000)
        if "tsta" in event:
            tsta = event["tsta"]
        else:
            event["tsta"] = tsta

        # load framesegmentation json
        next_index = 0 if "next_index" not in event else int(event["next_index"])
        key = os.path.join(prefix, event["json"])
        names = json.loads(get_object(bucket, key))
        print(f"== [info]: loaded {event['json']}: names: {len(names)}")

        # no more frame to process?
        names = [ item["name"] for item in names[next_index:] ]
        print(f"== [info]: sliced {event['json']}: names: {len(names)}")

        if len(names) == 0:
            return set_completed(event)

        # load label config
        candidate_labels = load_labels(event)

        items = load_previous_run(bucket, prefix, output)
        print(f"== [info]: loaded {event['output']}: items: {len(items)}")

        model, processor = load_model()

        while not quit_now(context) and len(names) > 0:
            name = names.pop(0)
            item = process_image(
                model,
                processor,
                candidate_labels,
                bucket,
                prefix,
                name
            )
            items.extend(item)

        print(f"== [info]: completed {event['output']}: items: {len(items)}, names: {len(names)}")

        # upload json output
        output_key = os.path.join(prefix, output)
        put_object(
            bucket,
            output_key,
            json.dumps(items, default=str),
            "application/json")

        tend = round(time.time() * 1000)
        print(f"== TOTAL RUNTIME: {round((tend - tsta) / 1000)}s ==")

        # update event for the next re-entry of the lambda
        if len(names) == 0:
            return set_completed(event)

        print(f"== [info]: next_index.before = {next_index}, .after = {len(items)}")
        next_index = len(items)
        return set_progress(event, {
            "next_index": next_index
        })
    except Exception as e:
        print(f"[ERR]: {type(e).__name__}")
        traceback.print_exc()
        raise e
