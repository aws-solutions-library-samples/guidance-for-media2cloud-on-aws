# pyright: reportMissingImports=false, reportMissingModuleSource=false
import boto3
import json
import base64
from io import BytesIO
from PIL import Image
from urllib.parse import urlparse

session = boto3.Session()
s3 = session.client("s3")

def get_object(bucket, key):
    """
    get_object() get_object from S3 and loads it into Image.

    :param bucket: S3 bucket name
    :param key: S3 object key
    :return: Body
    """
    if bucket is None or key is None:
        raise ValueError('missing bucket or key')

    return s3.get_object(
        Bucket = bucket,
        Key = key
    )["Body"].read()

def get_object_uri(s3uri):
    """
    get_object_uri() get object from S3

    :param s3uri: in a format of s3://bucket/key
    :return: Body
    """
    url = urlparse(s3uri)
    bucket = url.netloc
    key = url.path[1:]
    return get_object(bucket, key)

def put_object(bucket, key, body, mime = "application/json"):
    """
    put_object() wrapper function of s3.put_object

    :param bucket: S3 bucket name
    :param key: S3 object key
    :param body: payload
    :param mime: default to application/json
    """
    return s3.put_object(
        Bucket = bucket,
        Key = key,
        Body = body,
        ContentType = mime
    )

def load_from_s3(bucket, key):
    """
    load_from_s3() get_object from S3 and loads it into Image.

    :param bucket: S3 bucket name
    :param key: S3 object key
    :return: Image object
    """
    bytes = get_object(bucket, key)
    return Image.open(BytesIO(bytes))

def load_from_s3uri(s3uri):
    """
    load_from_s3uri() get_object from S3 and loads it into Image.

    :param s3uri: in a format of s3://bucket/key
    :return: Image object
    """
    url = urlparse(s3uri)
    bucket = url.netloc
    key = url.path[1:]

    return load_from_s3(bucket, key)

def load_from_file(file):
    """
    load_from_file() loads image from local path

    :param file path
    :return: Image object
    """
    return Image.open(file)
    
def load_from_blob(blob):
    """
    load_from_blob() loads image from blob via HTTP request

    :param file path
    :return: Image object
    """
    return Image.open(BytesIO(base64.b64decode(blob)))

def load_classes(path):
    if path.find("s3://") > -1:
        body = get_object_uri(path).decode('utf-8')
        return json.loads(body)
    return json.load(open(path))

def load_query_images(image_list = []):
    """
    load_query_images() loads a list of query_images to be used for zero-shot model.

    :param image_list: a list of dictionary contains "s3uri" or "file" of the image and "label" of the image
    :return: a list of dictionary contains "image" and "label"
    """
    items = []
    for item in image_list:
        image = None
        if "s3uri" in item:
            image = load_from_s3uri(item["s3uri"])
        elif "file" in item:
            image = load_from_file(item["file"])

        if image is not None:
            items.append({
                "image": image.convert("RGB"),
                "label": item["label"],
            })
    return items

def quit_now(context):
    """
    quit_now() checks AWS Lambda remaining time. If it is about to terminate, return True

    :param context: context pass in to the lambda function
    :return: True indicates we have less than a minute of the lambda time
    """ 

    if (context is not None
        and "get_remaining_time_in_millis" in dir(context)
        and context.get_remaining_time_in_millis() <= 60000):
        return True
    return False
