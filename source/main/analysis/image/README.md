# Analysis Image State Machine

The Analysis Image State Machine extracts visual metadata from the image file by using various Amazon Rekognition Image APIs and Amazon Bedrock Anthropic Claude 3 Haiku or Sonnet model. It then indexes the metadata to an Amazon OpenSearch cluster.

![Analysis Image state machine](../../../../deployment/tutorials/images/analysis-image-state-machine.png)


#### _State: Start image analysis_

The lambda function runs the following Amazon Rekognition Image APIs when the specific detection (such as celeb, label) is enabled:
- [RecognizeCelebrities](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_RecognizeCelebrities.html)
- [DetectFaces](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_DetectFaces.html)
- [SearchFacesByImage](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_SearchFacesByImage.html)
- [DetectLabels](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_DetectLabels.html)
- [DetectModerationLabels](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_DetectModerationLabels.html)
- [DetectText](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_DetectText.html)
- [DetectCustomLabels](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_DetectCustomLabels.html)

In V4, the lambda function also uses Amazon Bedrock Anthropic Claude 3 Haiku (or Sonnet) to further analyze the image and provide information including:
- Detail description of the image
- One-line ALT-TEXT
- Image file name
- Top 5 relevant tags

Publishers can use these information to optimze the accessibility of their websites.

#### _State: Index analysis results_

The lambda function parses each analysis typed metadata and indexes the results to an Amazon OpenSearch cluster to provide the searchability.

__

#### _Metadata location_

The metatadata JSON result is stored in the Amazon S3 bucket with the following naming convention, `s3://[PROXY_BUCKET]/[UUID]/[FILE_BASENAME]/raw/[DATE_TIME]/rekog-image/[ANALYSIS_TYPE]/output.json`.

For an example, when you upload an image ("MY_IMAGE.jpg") and you have enabled both `celeb` and `label` analysis. The metadata are then stored in:

- _s3://[PROXY_BUCKET]/0000xxx/**MY_IMAGE**/raw/[DATE_TIME]/rekog-image/**celeb**/output.json_
- _s3://[PROXY_BUCKET]/0000xxx/**MY_IMAGE**/raw/[DATE_TIME]/rekog-image/**label**/output.json_

__

#### _Execution input_

The state execution input is similar to the [Analysis Main State Machine](../main/README.md#execution-input) with additional fields generated (or modified) by the [Prepare analysis](../main/README.md#state-prepare-analysis) state.

Here are the settings that are relevant to the image analysis workflow.

```json
{
  "input": {
    ...
    "aiOptions": {
      "minConfidence": 80,
      "celeb": true,
      "face": true,
      "facematch": true,
      "faceCollectionId": "[COLLECTION_ID]",
      "label": true,
      "moderation": true,
      "text": true,
      "textROI": [true, true, true, false, false, false, false, false, false]
    },
    "image": {
      "enabled": true,
      "key": "[PROXY_IMAGE_KEY]"
    },
    "request": {
      "timestamp": 1637743896177
    }
  }
}

```

The analysis options (aiOptions.*) are explained [here](../../README.md#inputaioptions).

__

### AWS Lambda function (analysis-image)
The analysis-image lambda function provides the implementation to support different states of the Analysis Image state machine.

#### _IAM Role Policy_

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "[CLOUDWATCH_LOGS]",
            "Effect": "Allow"
        },
        {
            "Action": "s3:ListBucket",
            "Resource": "[PROXY_BUCKET]",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": "[PROXY_BUCKET]",
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:BatchGetItem"
            ],
            "Resource": "[AIML_TABLE]",
            "Effect": "Allow"
        },
        {
            "Action": [
                "rekognition:DetectFaces",
                "rekognition:DetectLabels",
                "rekognition:DetectModerationLabels",
                "rekognition:DetectText",
                "rekognition:RecognizeCelebrities",
                "rekognition:DescribeCollection",
                "rekognition:SearchFacesByImage"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "rekognition:DescribeProjectVersions",
            "Resource": "[REKOGNITION_CUSTOM_LABEL_PROJECTS]",
            "Effect": "Allow"
        },
        {
            "Action": "rekognition:DetectCustomLabels",
            "Resource": "[REKOGNITION_CUSTOM_LABEL_PROJECTS]",
            "Effect": "Allow"
        },
        {
            "Action": [
                "es:ESHttpGet",
                "es:ESHttpHead",
                "es:ESHttpPost",
                "es:ESHttpPut",
                "es:ESHttpDelete"
            ],
            "Resource": "[OPENSEARCH_DOMAIN]",
            "Effect": "Allow"
        },
        {
            "Action": "aoss:APIAccessAll",
            "Resource": "[OPENSEARCH_SERVERLESS_COLLECTION]",
            "Effect": "Allow"
        }
    ]
}

```

#### _IAM Role Policy (Amazon Bedrock)_

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "bedrock:ListFoundationModels",
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "bedrock:InvokeModel",
            "Resource": "[ANTHROPIC_CLAUDE_3_MODEL]",
            "Effect": "Allow"
        }
    ]
}

```

#### _X-Ray Trace_

The following AWS XRAY trace diagram illustrates the AWS resources this lambda function communicates to.

![Analysis Image Lambda function](../../../../deployment/tutorials/images/analysis-image-lambda.png)

__

Back to [Analysis Main State Machine](../main/README.md) | Back to [Table of contents](../../../../README.md#table-of-contents)
