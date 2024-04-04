# pyright: reportMissingImports=false, reportMissingModuleSource=false
import traceback
import os
import json
import time
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotImageClassification
from utils import get_object, put_object, load_from_file, load_from_s3, quit_now

DEFAULT_CLASSES_JSON = "default_classes.json"
CLS_CHECKPOINT = "openai/clip-vit-large-patch14"

def load_cls_model(checkpoint = CLS_CHECKPOINT):
    """
    load_cls_model() load classification model

    :param checkpoint: (optional) model checkpoint
    :return: model, processor
    """
    model = AutoModelForZeroShotImageClassification.from_pretrained(checkpoint)
    processor = AutoProcessor.from_pretrained(checkpoint)
    return model, processor

def run_classification(
        model,
        processor,
        image,
        labels):
    """
    run_classification() runs classification

    :param model: classification model
    :param processor: classification processor
    :param image: image to inference
    :param text_labels: zero shot labels
    :return: { label, score, embeddings } where embeddings size is 768
    """
    inputs = processor(text = labels, images = image, return_tensors = "pt", padding = True)
    outputs = None

    with torch.no_grad():
        outputs = model(**inputs)

    logits = outputs.logits_per_image[0]
    probs = logits.softmax(dim=-1).numpy()
    result = [
        {"score": score, "label": label}
        for score, label in sorted(zip(probs, labels), key=lambda x: -x[0])
    ]

    if len(result) == 0:
        print("FAILED TO FIND LABEL")
        return None

    image_embeddings = outputs.image_embeds.cpu().numpy().tolist()[0]
    item = {
        "label": result[0]["label"],
        "score": round(float(result[0]["score"]), 3),
        "embeddings": image_embeddings,
    }
    return item

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
    :return: [item_embeddings]
    """
    item_embeddings = []

    try:
        key = os.path.join(prefix, output)
        item_embeddings = get_object(bucket, key).decode('utf-8')
        item_embeddings = json.loads(item_embeddings)
    except:
        pass
    return item_embeddings

def process_local_file(file):
    """
    process_local_file() special case for processing local file and preloaded the model

    :param file: local file of the image
    :return: embedding_item
    """
    cls_model, cls_processor = load_cls_model()

    image = Image.open(file)

    embedding_item = run_classification(
        cls_model,
        cls_processor,
        image,
        ["cat", "dog"])

    return embedding_item

def process_image(
        cls_model,
        cls_processor,
        labels,
        bucket,
        prefix,
        name):
    """
    process_image() process per image

    :param cls_model: classification model
    :param cls_processor: classification processor
    :param labels: labels to identify
    :param bucket: bucket of the image
    :param prefix: prefix of the image
    :param name: name of the image
    :return: { label, score, embeddings, name }
    """
    key = os.path.join(prefix, name)

    image = load_from_s3(bucket, key)

    embedding_item = run_classification(
        cls_model,
        cls_processor,
        image,
        labels)

    if embedding_item != None:
        return {
            **embedding_item,
            "name": name
        }
    return None

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

        # special case
        if "local_file" in event:
            return process_local_file(event["local_file"])

        if not set(("bucket", "prefix", "json", "embeddings")).issubset(event):
            raise ValueError("missing input field(s)")

        # check to see if re-entry
        bucket = event["bucket"]
        prefix = event["prefix"]
        output = event["embeddings"]

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
        labels = load_labels(event)
        item_embeddings = load_previous_run(bucket, prefix, output)
        print(f"== [info]: loaded {event['embeddings']}: item_embeddings: {len(item_embeddings)}")

        print(f"=== LOADING MODELS ===")
        t0 = time.time()
        cls_model, cls_processor = load_cls_model()
        t1 = time.time()
        print(f"=== CLASSIFICATION MODEL LOADED: {round(t1 - t0)}s")

        # count = 0
        while not quit_now(context) and len(names) > 0:
            name = names.pop(0)
            # print(f"=== PROCESSING: {name}")
            t0 = time.time()
            image_embedding = process_image(
                cls_model,
                cls_processor,
                labels,
                bucket,
                prefix,
                name
            )
            t1 = time.time()
            print(f"=== PROCESSED: {name} ({round(t1 - t0, 3)}s)")
            item_embeddings.append(image_embedding)
            # # TESTING
            # count += 1
            # if count > 20:
            #     break

        print(f"== [info]: completed {event['embeddings']}: item_embeddings: {len(item_embeddings)}, names: {len(names)}")

        # upload json output
        output_key = os.path.join(prefix, output)
        put_object(
            bucket,
            output_key,
            json.dumps(item_embeddings, default=str),
            "application/json")

        tend = round(time.time() * 1000)
        print(f"== TOTAL RUNTIME: {round((tend - tsta) / 1000)}s ==")

        # update event for the next re-entry of the lambda
        if len(names) == 0:
            return set_completed(event)

        print(f"== [info]: next_index.before = {next_index}, .after = {len(item_embeddings)}");
        next_index = len(item_embeddings)
        return set_progress(event, {
            "next_index": next_index
        })
    except Exception as e:
        print(f"[ERR]: {type(e).__name__}")
        traceback.print_exc()
        raise e
