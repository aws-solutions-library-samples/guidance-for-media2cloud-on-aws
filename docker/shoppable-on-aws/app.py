# pyright: reportMissingImports=false, reportMissingModuleSource=false
import os
import json
import time
import traceback
import math
import torch
from PIL import Image
from pathlib import Path
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, AutoModelForZeroShotImageClassification
from utils import get_object, put_object, load_from_file, load_from_s3, load_from_s3uri, load_from_blob, load_classes, load_query_images, quit_now

OBJ_CHECKPOINT = "google/owlvit-base-patch32"
#CLS_CHECKPOINT = "laion/CLIP-ViT-B-32-laion2B-s34B-b79K"
CLS_CHECKPOINT = "openai/clip-vit-large-patch14"

# first pass labels that work well with the obj model
FIRST_PASS_LABELS = [
    "off shoulder top",
    "skirt",
    "trousers",
    "dress",
    "suit",
    "footwear",
]
# second pass labels to further identify subcategory labels
SECOND_PASS_LABELS = [
    "skirt",
    "off shoulder top",
    "shoulder handbag",
    "dress"
]
# labels that should enable second pass
AMBIGUOUS_LABELS = [
    "dress"
]

def load_obj_model(checkpoint = OBJ_CHECKPOINT):
    """
    load_obj_model() load object detection model

    :param checkpoint: (optional) model checkpoint
    :return: model, processor
    """
    model = AutoModelForZeroShotObjectDetection.from_pretrained(checkpoint)
    processor = AutoProcessor.from_pretrained(checkpoint)
    return model, processor

def load_cls_model(checkpoint = CLS_CHECKPOINT):
    """
    load_cls_model() load classification model

    :param checkpoint: (optional) model checkpoint
    :return: model, processor
    """
    model = AutoModelForZeroShotImageClassification.from_pretrained(checkpoint)
    processor = AutoProcessor.from_pretrained(checkpoint)
    return model, processor

def run_object_detection(
        model,
        processor,
        image,
        text_labels):
    """
    run_object_detection() runs object detection

    :param model: object detection model
    :param processor: object detection processor
    :param image: image to inference
    :param text_labels: zero shot labels
    :return: [ [label, score, box, xy], ... ]
    """
    inputs = processor(text=text_labels, images=image, return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)

    target_sizes = torch.tensor([image.size[::-1]])
    results = processor.post_process_object_detection(outputs, threshold=0.1, target_sizes=target_sizes)[0]

    boxes = results["boxes"].tolist()
    labels = results["labels"].tolist()
    scores = results["scores"].tolist()

    image_w, image_h = image.size    
    return [
        [
            text_labels[label],
            round(score, 3),
            box,
            [
                (((box[2] - box[0]) / 2) + box[0]) / image_w,
                (((box[3] - box[1]) / 2) + box[1]) / image_h
            ]
        ] for box, label, score in zip(boxes, labels, scores)
    ]

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

def find_bounding_boxes(
        model,
        processor,
        image):
    """
    find_bounding_boxes() find apparel bounding boxes with object detection model

    :param model: object detection model
    :param processor: object detection processor
    :param image: image to find apparel bounding boxes
    :return: [{ label, score, box, xy, cropped, second_pass }]
    """
    _candidates = []

    first_pass_labels = FIRST_PASS_LABELS

    image_w, image_h = image.size

    print(f"IMAGE WxH = {image_w} x {image_h}")

    outputs = run_object_detection(model, processor, image, first_pass_labels)

    for label, score, box, xy in outputs:
        xmin, ymin, xmax, ymax = box

        # filter out items that are too small
        _w = xmax - xmin
        _h = ymax - ymin
        ratio_wh = _w / _h if _h > _w else _h / _w
        ratio_img = (_w * _h) / (image_w * image_h)

        # Conditions to ignore cropped image
        # if w and h ratio is < 0.3
        # if image ratio is < 0.05 unless ratio is > 0.03 AND score is > 0.20
        should_ignore = False
        if ratio_wh < 0.3:
            should_ignore = True
        elif ratio_img < 0.05:
            should_ignore = True
            if score > 0.20 and ratio_img > 0.03:
                should_ignore = False

        cropped = image.crop((xmin, ymin, xmax, ymax))

        if should_ignore == True:
            print(f"!!!!! IGNORED: SIZE TOO SMALL: {label}, {score}, [{round(ratio_img, 2)}], ({round(xmax - xmin, 2)} x {round(ymax - ymin, 2)})")
            continue

        if label not in AMBIGUOUS_LABELS:
            _candidates.append({
                "label": label,
                "score": score,
                "box": box,
                "xy": xy,
                "cropped": cropped
            })
        else:
            cropped_w, cropped_h = cropped.size
            second_pass_labels = SECOND_PASS_LABELS

            inner_outputs = run_object_detection(model, processor, cropped, second_pass_labels)

            # if find nothing, use the previous detected object
            if len(inner_outputs) == 0:
                _candidates.append({
                    "label": label,
                    "score": score,
                    "box": box,
                    "xy": xy,
                    "cropped": cropped
                })
            else:
                # ignore the previous detected object
                for _label, _score, _box, _xy in inner_outputs:
                    _xmin, _ymin, _xmax, _ymax = _box

                    _cropped = cropped.crop((_xmin, _ymin, _xmax, _ymax))

                    # recalculate box and xy
                    _w = _xmax - _xmin
                    _h = _ymax - _ymin

                    _xmin = xmin + _xmin
                    _ymin = ymin + _ymin
                    _xmax = _xmin + _w
                    _ymax = _ymin + _h

                    _candidates.append({
                        "label": _label,
                        "score": _score,
                        "box": [_xmin, _ymin, _xmax, _ymax],
                        "xy": [((_w / 2) + _xmin) / image_w, ((_h / 2) + _ymin) / image_h],
                        "cropped": _cropped,
                        "second_pass": True
                    })
    # filter duplicated
    filtered = filter_duplicated(_candidates)
    return filtered

def filter_duplicated(items):
    """
    filter_duplicated() filter out duplicated bounding boxes within the image

    :param items: list of boxes from find_bounding_boxes
    :return: [{ label, score, box, xy, cropped, second_pass }]
    """
    filtered = []

    if len(items) == 0:
        return filtered

    filtered.append(items.pop(0))

    for item in items:
        found = None
        xy = item["xy"]

        for _idx in range(len(filtered)):
            _item = filtered[_idx]
            _xy = _item["xy"]

            distance = math.dist(xy, _xy)
            if distance < 0.12:
                # swap the item
                if item["score"] > _item["score"]:
                    found = _idx
                # keep the original
                else:
                    found = -1

        if found == None:
            filtered.append(item)
        elif found >= 0:
            filtered[found] = item
    return filtered

def get_embeddings(
    model,
    processor,
    items,
    image_w,
    image_h,
    options = {}
    ):
    """
    get_embeddings() runs get embeddings from classification model

    :param model: classification model
    :param processor: classification processor
    :param items: list of item returns from find_bounding_boxes
    :param image_w: width of the original image
    :param image_h: height of the original image
    :param options: option dict to merge into the response
    :return: { label, score, embeddings, box, **options }
    """
    embedding_items = []
    for item in items:
        embedding_item = run_classification(
            model,
            processor,
            item["cropped"],
            [item["label"]])
        if embedding_item != None:
            xmin, ymin, xmax, ymax = item["box"]
            box = {
                "w": float((xmax - xmin) / image_w),
                "h": float((ymax - ymin) / image_h),
                "l": float(xmin / image_w),
                "t": float(ymin / image_h)
            }
            embedding_items.append({
                **embedding_item,
                **options,
                "box": box
            })
    return embedding_items

def process_image(
        obj_model,
        obj_processor,
        cls_model,
        cls_processor,
        bucket,
        prefix,
        name):
    """
    process_image() process per image

    :param obj_model: object detection model
    :param obj_processor: object detection processor
    :param cls_model: classification model
    :param cls_processor: classification processor
    :param bucket: bucket of the image
    :param prefix: prefix of the image
    :param name: name of the image
    :return: [ { label, score, embeddings, box, name }, ...]
    """
    embedding_items = []

    key = os.path.join(prefix, name)

    image = load_from_s3(bucket, key)
    image_w, image_h = image.size

    items = find_bounding_boxes(
        obj_model,
        obj_processor,
        image)

    options = {
        "name": name
    }
    embedding_items = get_embeddings(cls_model,
                                     cls_processor,
                                     items,
                                     image_w,
                                     image_h,
                                     options)
    return embedding_items

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
    process_local_file() special case for processing local file and preloaded the models

    :param file: local file of the image
    :return: [item_embeddings]
    """
    obj_model, obj_processor = load_obj_model()
    cls_model, cls_processor = load_cls_model()

    image = Image.open(file)
    image_w, image_h = image.size

    items = find_bounding_boxes(
        obj_model,
        obj_processor,
        image)

    options = {
        "name": file
    }
    embedding_items = get_embeddings(cls_model,
                                     cls_processor,
                                     items,
                                     image_w,
                                     image_h,
                                     options)

    with open("embeddings.json", "w") as f:
        f.write(json.dumps(embedding_items))
    return embedding_items

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
        # special case
        if "local_file" in event:
            return process_local_file(event["local_file"])

        if not set(("bucket", "prefix", "json", "embeddings")).issubset(event):
            raise ValueError("missing input field(s)")

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

        item_embeddings = load_previous_run(bucket, prefix, output)
        print(f"== [info]: loaded {event['embeddings']}: item_embeddings: {len(item_embeddings)}")

        print(f"=== LOADING MODELS ===")
        t0 = time.time()
        obj_model, obj_processor = load_obj_model()
        t1 = time.time()
        print(f"=== OBJECT MODEL LOADED: {round(t1 - t0)}s")

        t0 = time.time()
        cls_model, cls_processor = load_cls_model()
        t1 = time.time()
        print(f"=== CLASSIFICATION MODEL LOADED: {round(t1 - t0)}s")

        while not quit_now(context) and len(names) > 0:
            name = names.pop(0)
            print(f"=== PROCESSING: {name}")
            t0 = time.time()
            image_embeddings = process_image(
                obj_model,
                obj_processor,
                cls_model,
                cls_processor,
                bucket,
                prefix,
                name
            )
            t1 = time.time()
            print(f"=== PROCESSED: {name} ({len(image_embeddings)} items), {round(t1 - t0)}s")
            item_embeddings.extend(image_embeddings)

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
