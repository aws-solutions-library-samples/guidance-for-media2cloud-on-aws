## Media2Cloud RESTful API

The _Guidance for Media2Cloud on AWS_ exposes RESTful APIs to drive the entire workflows through Amazon API Gateway endpoints. Before using the RESTful API to programmatically communicate with Media2Cloud, you need an IAM Role or User to access the API endpoint. You also need to find the RESTful API endpoint URL. This README covers:
- [Creating an API user with AWS Identity and Access Management (IAM)](#creating-an-api-user-with-aws-identity-and-access-management-iam)
- [Find the Media2Cloud API Endpoint from the CloudFormation stack](#find-the-media2cloud-api-endpoint-from-the-cloudformation-stack)
- [API documentation](#api-documentation)

## _Creating an API user with AWS Identity and Access Management (IAM)_

To access and invoke the Media2Cloud RESTful API, we would first create an IAM User with an IAM Policy that allows us to execute the api.


_1.1 Create an IAM user and called it `Media2CloudApiUser`_


```shell

aws iam create-user --user Media2CloudApiUser

# Response should look like this:
# {
#     "User": {
#         "Path": "/",
#         "UserName": "Media2CloudApiUser",
#         "UserId": "[USER_ID]",
#         "Arn": "arn:aws:iam::[ACCOUNT]:user/Media2CloudApiUser",
#         ...
#     }
# }

```

_1.2 Attach the IAM Policies to the Media2CloudApiUser_

```shell

# allow Media2CloudApiUser to invoke the RESTful APIs
aws iam attach-user-policy \
    --policy-arn arn:aws:iam::aws:policy/AmazonAPIGatewayInvokeFullAccess \
    --user Media2CloudApiUser

# allow Media2CloudApiUser to have full access to the Amazon S3 buckets
aws iam attach-user-policy \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess \
    --user Media2CloudApiUser

```

For simplicity, this step attaches the `AmazonAPIGatewayInvokeFullAccess` and `AmazonS3FullAccess` managed IAM Policies to the Media2CloudApiUers that grants the user full access to the Amazon API Gateway endpoints and full access to the Amazon S3 buckets in your account.

The best practice is to always grant the least privileges to any IAM role or IAM user by limiting the "Resource" and "Action" in the IAM Policy as follows:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        // Specific Amazon S3 bucket and actions
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": [
                "[INGEST_BUCKET_ARN]",
                "[PROXY_BUCKET_ARN]"
            ]
        },
        // Specific Amazon API Gateway Endpoint
        {
            "Effect": "Allow",
            "Action": "execute-api:Invoke",
            "Resource": "arn:aws:execute-api:[REGION]:[REGION]:[API_ID]/demo/*/*"
        }
    ]
}

```

_1.3 Create an access key for Media2CloudApiUser_

```shell

aws iam create-access-key \
    --user Media2CloudApiUser

# Response should look like this:
# {
#     "AccessKey": {
#         "UserName": "Media2CloudApiUser",
#         "AccessKeyId": "[ACCESS_KEY_ID]",
#         "Status": "Active",
#         "SecretAccessKey": "[SECRET_ACCESS_KEY]"
#     }
# }

```

Store the `AccessKeyId` and `SecretAccessKey` in notepad or text editor. This is the credentials that are used to authenticate with the Media2Cloud API endpoint.


## _Find the Media2Cloud API Endpoint from the CloudFormation stack_

Now that we have created an IAM User, `Media2CloudApiUser` that allows us to invoke the API endpoint. Let's find out the API endpoint created by the Guidance for Media2Cloud on AWS CloudFormation stack. If you follow the [Installation](../../README.md#installation) steps, the name of the stack you created should be `media2cloudv4`.

```shell

# Describe stack outputs and look for ApiEndpoint OutputKey
aws cloudformation describe-stacks \
    --stack-name media2cloudv4 | \
    jq '.Stacks[0].Outputs[] | select(.OutputKey == "ApiEndpoint")'

# Response looks like this
# {
#   "OutputKey": "ApiEndpoint",
#   "OutputValue": "https://[API_ID].execute-api.[REGION].amazonaws.com/demo",
#   "Description": "ApiEndpoint"
# }

```

The `OutputValue` of the response is the API endpoint that we will use to communicate with the Media2Cloud instance.

## _API documentation_

### _Managing assets in Media2Cloud library_

<details>
  <summary>
    <code>GET</code> <code><b>/demo/assets</b></code> <code><i>(get a list of asset uuids)</i></code>
  </summary>

##### _Parameters_

> |Name|Value|Description|
> |--|--|--|
> |pageSize|`20`|(optional) Pagination setting - specify the page size. Default is `20`|
> |type|`image\|video\|audio\|document`|(optional) Query assets by asset type|
> |overallStatus|`COMPLETED\|PROCESSING\|ERROR`|(optional) Query assets by overall status|

##### _Request headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Request body_

> None

##### _Response code_

> `200`

##### _Response headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Response body_

> ```json
> {
>   "Items": [
>     {
>       "uuid": "[UUID]",
>       "schemaVersion": 1,
>       "type": "image",
>       "timestamp": 1712450008235
>     }
>   ],
>   "NextToken": "[TOKEN]"
> }
> ```

##### _Example cURL_

> ```shell
> curl https://[API_ID].execute-api.us-east.amazonaws.com/demo/assets \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]" \
>   --get
> ```

##### _Example cURL with optional paramters_

_Get the next 100 records of video assets that are still being processed_

> ```shell
> curl https://[API_ID].execute-api.us-east.amazonaws.com/demo/assets \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]" \
>   --get \
>   --data-urlencode "pageSize=100" \
>   --data-urlencode "overallStatus=PROCESSING" \
>   --data-urlencode "type=video" \
>   --data-urlencode "token=[NEXT_TOKEN]"
> ```

</details>

<details>
  <summary>
    <code>GET</code> <code><b>/demo/assets/{uuid}</b></code> <code><i>(get ingest info of an asset)</i></code>
  </summary>

##### _Parameters_

> |Name|Value|Description|
> |--|--|--|
> |uuid|`[UUID]`|(mandatory) uuid of the media asset|

##### _Request headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Request body_

> None

##### _Response code_

> `200`

##### _Response headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Response body_

> ```json
> {
>   "overallStatus": "COMPLETED",
>   "schemaVersion": 1,
>   "lastModified": 1712449994000,
>   "aiOptions": {...},
>   "timestamp": 1712450008235,
>   "status": "ANALYSIS_COMPLETED",
>   "basename": "[FILENAME]",
>   "analysis": ["image"],
>   "bucket": "[INGEST_BUCKET]",
>   "storageClass": "STANDARD",
>   "executionArn": "[ANALYSIS_MAIN_EXECUTION_ARN]",
>   "fileSize": 840324,
>   "imageinfo": "[JSON_IMAGEINF)]",
>   "mediainfo": "[JSON_MEDIAINFO]",
>   "docinfo": "[JSON_DOCINFO]",
>   "mime": "image/png",
>   "uuid": "[UUID]",
>   "destination": {
>     "bucket": "[PROXY_BUCKET]",
>     "prefix": "[PREFIX]"
>   },
>   "key": "[OBJECT_KEY]",
>   "proxies": [
>     {
>       "storageClass": "STANDARD",
>       "fileSize": 1211335,
>       "mime": "image/jpeg",
>       "outputType": "proxy",
>       "lastModified": 1712450017000,
>       "type": "image",
>       "key": "[PROXY_KEY]"
>     }
>   ],
>   "type": "image",
>   "md5": "[MD5]"
> }
> ```

##### _Example cURL_

> ```shell
> curl https://[API_ID].execute-api.us-east.amazonaws.com/demo/assets/{uuid} \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]" \
>   --get
> ```

</details>

<details>
  <summary>
    <code>GET</code> <code><b>/demo/analysis/{uuid}</b></code> <code><i>(get analysis results of an asset)</i></code>
  </summary>

##### _Parameters_

> |Name|Value|Description|
> |--|--|--|
> |uuid|`[uuid]`|(mandatory) uuid of the asset|

##### _Request headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Request body_

> None

##### _Response code_

> `200`

##### _Response headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Response body_

> ```json
> [
>   {
>     "startTime": 1710950164758,
>     "executionArn": "[ANALYSIS_VIDEO_EXECUTION_ARN]",
>     "endTime": 1710950532430,
>     "status": "COMPLETED",
>     "uuid": "[UUID]",
>     "rekognition": {
>       "celeb": {
>         "output": "[JSON_OUTPUT]",
>         "metadata": "[JSON_METADATA]",
>         "timeseries": "[JSON_TIMESERIES]",
>         "vtt": "[JSON_WEBVTT]",
>         "apiCount": 188,
>         "startTime": 1710950319289,
>         "endTime": 1710950422515,
>         "numOutputs": 0
>       },
>       ...
>     },
>     "type": "video"
>   },
>   {
>     "startTime": 1710950164737,
>     "executionArn": "[ANALYSIS_AUDIO_EXECUTION_ARN]",
>     "endTime": 1710950256237,
>     "status": "COMPLETED",
>     "uuid": "[UUID]",
>     "transcribe": {
>       "output": "[JSON_TRANSCRIPT]",
>       "jobId": "[JOBID]",
>       "vtt": "[VTT]",
>       "startTime": 1710950165478,
>       "endTime": 1710950250186,
>       "languageCode": "en-GB",
>       "conversations": "[JSON_CONVERSATION]"
>     },
>     "comprehend": {
>       "keyphrase": {
>         "output": "[JSON_OUTPUT]",
>         "startTime": 1710950252093,
>         "metadata": "[JSON_METADATA]",
>         "endTime": 1710950255650
>       },
>       ...
>     },
>     "type": "audio"
>   }
> ]
> ```

##### _Example cURL_

> ```shell
> curl https://[API_ID].execute-api.us-east.amazonaws.com/demo/analysis/{uuid} \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]" \
>   --get
> ```

</details>

<details>
  <summary>
    <code>POST</code> <code><b>/demo/assets</b></code> <code><i>(start ingestion workflow. The asset must have resided on your ingest bucket)</i></code>
  </summary>

##### _Parameters_

> None

##### _Request headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Request body_

> ```json
> {
>   "input" : {
>     "uuid": "[UUID]",
>     "bucket": "[INGEST_BUCKET]",
>     "key": "[OBJECT_KEY]",
>      ...
>   }
> }
> ```

> |Key|Value|Description|
> |--|--|--|
> |input.bucket|`[INGEST_BUCKET]`|(mandatory) specify which bucket the asset resides|
> |input.key|`[OBJECT_KEY]`|(mandatory) specify the asset object key|
> |input.uuid|`[UUID]`|(optional) user defined uuid. Must be UUIDv4 format. If not specified, Media2Cloud auto-generates it|

For the full list of input options, check out [Main State Machine, Execution input](../main/README.md#execution-input)

##### _Response code_

> `200`

##### _Response headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Response body_

> ```json
> {
>   "executionArn": "[MAIN_EXECUTION_ARN]",
>   "startDate": "2024-04-10T22:37:58.905Z",
>   "uuid": "[UUID]",
>   "status": "STARTED"
> }
> ```

##### _Example cURL_

> ```shell
> curl -X POST \
> https://[API_ID].execute-api.us-east.amazonaws.com/demo/assets \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]" \
>   -d "{\
>        \"input\": {\
>            \"bucket\": \"[INGEST_BUCKET]\",
>            \"key\": \"tutorial/demo.png\"
>        }\
>    }"
> ```

</details>

<details>
  <summary>
    <code>DELETE</code> <code><b>/demo/assets/{uuid}</b></code> <code><i>(delete an asset)</i></code>
  </summary>

##### _Parameters_

> |Name|Value|Description|
> |--|--|--|
> |uuid|`[UUID]`|(optional) uuid of the asset to delete|

##### _Request headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Request body_

> None

##### _Response code_

> `200`

##### _Response headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Response body_

> ```json
> {
>   "uuid": "[UUID]",
>   "status": "REMOVED"
> }
> ```

##### _Example cURL_

> ```shell
> curl -X DELETE \
> https://[API_ID].execute-api.us-east.amazonaws.com/demo/assets/{uuid} \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]"
> ```

</details>

___

### _Searching content from Amazon OpenSearch cluster_

<details>
  <summary>
    <code>GET</code> <code><b>/demo/search</b></code> <code><i>(search content)</i></code>
  </summary>

##### _Parameters_

> |Name|Value|Description|
> |--|--|--|
> |query|`Andy Jassy`|(mandatory) search term (keyword) of the search request|
> |pageSize|`20`|(optional) pagination of the results. Default is `30`|
> |token|`10`|(optional) last token of the search results|
> |\[media_type\]|`true\|false`|(optional) limit the search to specific media type. Media type can be `video`, `audio`, `image`, `document`. Default is set to `true` for each media type. To skip document search, specify `document=false` for an example|

##### _Request headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Request body_

> None

##### _Response code_

> `200`

##### _Response headers_

> |Header|Value|
> |--|--|
> |`Content-Type`|`application/json`|

##### _Response body_

> ```json
> {
>   "term": "\"Andy Jassy\"",
>   "totalHits": 3,
>   "nextToken": 1,
>   "elapsed": 49,
>   "hits": [
>     {
>       "id": "[UUID]",
>       "score": 7.0853496,
>       "type": "video",
>       "fields": {
>         "text": {
>           "highlights": [
>             "Executive Producer <em>Andy</em> <em>Jassy</em>"
>           ],
>           "hits": [
>             {
>               "name": "Executive Producer Andy Jassy",
>               "timecodes": [
>                 {
>                   "end": 834901,
>                   "begin": 834001
>                 },
>                 ...
>               ]
>             }
>           ]
>         }
>       }
>     }
>   ]
> }
> ```

##### _Example cURL_

It is important to note that V4 requires convert the search query into `base64` string.

> ```shell
> curl \
> https://[API_ID].execute-api.us-east.amazonaws.com/demo/search \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]" \
>   --get \
>   --data-urlencode "pageSize=1" \
>   --data-urlencode "$(echo \"Andy Jassy\" | base64)"
> ```

_(Tip: quoting the query, \"Andy Jassy\" perform an exact match search.)_

##### _Example cURL (complex search)_

V4 supports `AND`, `OR`, `NOT` operators. Here is an example of searching contents that contains `Andy` but not `Jassy`.

> ```shell
> curl \
> https://[API_ID].execute-api.us-east.amazonaws.com/demo/search \
>   --aws-sigv4 "aws:amz:us-east-1:execute-api" \
>   --user "[AccessKeyId]:[SecretAccessKey]" \
>   --get \
>   --data-urlencode "pageSize=1" \
>   --data-urlencode "$(echo Andy NOT Jassy | base64)"
> ```

</details>
