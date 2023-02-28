# Analysis Main State Machine

The Analysis Main State Machine focuses on extracting machine learning metadata from the media file. Depending on the media type of the file and the types of AI/ML detection specified in the request, the Analysis Main State Machine activates different branches of the detections. For instance, if the media file is a document, the analysis workflow focuses on extracting tabular data from the document using Amazon Textract service. If the uploaded file is a video file, the analysis workflow activates the video analysis workflow to extract visual data using Amazon Rekognition service _AND_ the audio analysis workflow to extract speech-to-text data using Amazon Transcribe service as well as to run Natural Language Processing (NLP) process to extract key phrases, entities, locations, quantities, and so forth using Amazon Comprehend service.

![Analysis state machine](../../../../deployment/tutorials/images/analysis-main-state-machine.png)

__

## Execution input
The state machine execution input is a pass through from the [Main State Machine](../README.md) where the mandatory field is the ```input.uuid``` that is used to look up the the ingestion data from the Ingest DynamoDB Table. The ```input.aiOptions.*``` fields specify the type of AI/ML detection to run. See all possible option in the following table. If ```$.input.aiOptions``` field is not specified, the state machine lambda function defaults to the AI/ML settings specified when the CloudFormation stack was created.

```json
{
    "input": {
        "uuid": "UUID",
        "aiOptions": {
            "minConfidence": 80,
            /* Rekognition settings */
            "celeb": true,
            "face": true,
            "facematch": true,
            "faceCollectionId": "REKOGNITION_COLLECTION_ID",
            "label": true,
            "moderation": true,
            "person": true,
            "text": true,
            "textROI": [true, true, true, false, false, false, false, false, false],
            "segment": true,
            "customlabel": true,
            "customLabelModels": [
                "REKONIGTION_CUSTOM_LABEL_01",
                "REKONIGTION_CUSTOM_LABEL_02"
            ],
            /* Transcribe settings */
            "transcribe": true,
            "languageCode": "en-US",
            "customLanguageModel": "TRANSCRIBE_CUSTOM_LANGUAGE_MODEL",
            "customVocabulary": "TRANSCRIBE_CUSTOM_VOCABULARY",
            /* Comprehend settings */
            "keyphrase": true,
            "entity": true,
            "sentiment": true,
            "customentity": true,
            "customEntityRecognizer": "COMPREHEND_CUSTOM_ENTITY_RECOGNIZER",
            /* Textract settings */
            "textract": true,
            /* frame based analysis */
            "framebased": false,
            "frameCaptureMode": 1003,
        }
    }
}
```

| Field | Description | Required? |
| :-----| :-----------| :---------|
| input.uuid | UUID of the media file used to look up the ingest data from Ingest DynamoDB Table | Mandatory |
| _input.aiOptions.*_ | AI/ML options to run the analysis workflow. If not specified, the solution uses the default AI/ML options specified when the Amazon CloudFormation stack was created | Optional |
| _input.aiOptions.minConfidence_ | Minimum confidence level to return detection results | Optional |
| _input.aiOptions.celeb_ | Enable/disable Amazon Rekognition Celebrity Recognition detection | Optional |
| _input.aiOptions.face_ | Enable/disable Amazon Rekognition Face detection | Optional |
| _input.aiOptions.facematch_ | Enable/disable Amazon Rekognition Search Face in collection. ```faceCollectionId``` field must also be specified. | Optional |
| _input.aiOptions.faceCollectionId_ | Specify the face collection to use to run Amazon Rekognition Search Face API. If ```facematch``` is set to false, this field is ignored. | Optional |
| _input.aiOptions.label_ | Enable/disable Amazon Rekognition Label detection | Optional |
| _input.aiOptions.moderation_ | Enable/disable Amazon Rekognition Content Moderation Label detection | Optional |
| _input.aiOptions.person_ | Enable/disable Amazon Rekognition People Pathing detection. | Optional |
| _input.aiOptions.text_ | Enable/disable Amazon Rekognition Text detection. | Optional |
| _input.aiOptions.textROI_ | Limit the text detection to specific region of the video/image frame. The field is an array of 3x3 grid representing: Top Left (TL), Top Center (TC), Top Right (TR), Middle Left (ML), Center (C), Middle Right (MR), Bottom Left (BL), Bottom Center (BC), and Bottom Right (BR). Setting the grid(s) to true indicates the area is in interests. | Optional |
| _input.aiOptions.segment_ | Enable/disable Amazon Rekognition Video Segment detection. | Optional |
| _input.aiOptions.customlabel_ | Enable/disable Amazon Rekognition Custom Labels feature. ```customLabelModels``` field must also be specified. | Optional |
| _input.aiOptions.customLabelModels_ | Specify the Custom Label model(s) to be used to run the analysis. This field is an array of the models. You can specify _TWO_ models at most. If ```customlabel``` field is not specified, this field is ignored. | Optional |
| _input.aiOptions.transcribe_ | Enable/disable Amazon Transcribe | Optional |
| _input.aiOptions.languageCode_ | Specify the language code to run Amazon Transcribe. To enable ```Auto Language Detection```, _DO NOT_ specify this field  | Optional |
| _input.aiOptions.customLanguageModel_ | Specify [Amazon Transcribe Custom Language Models](https://docs.aws.amazon.com/transcribe/latest/dg/custom-language-models.html) (CLM) to use | Optional |
| _input.aiOptions.customVocabulary_ | Specify [Amazon Transcribe Custom Vocabularies](https://docs.aws.amazon.com/transcribe/latest/dg/custom-vocabulary.html) to use | Optional |
| _input.aiOptions.keyphrase_ | Enable/disable Amazon Comprehend Key Phrases detection | Optional |
| _input.aiOptions.entity_ | Enable/disable Amazon Comprehend Entities detection | Optional |
| _input.aiOptions.sentiment_ | Enable/disable Amazon Comprehend Sentiment Analysis | Optional |
| _input.aiOptions.customEntityRecognizer_ | Specify [Amazon Comprehend Custom Entity Recognizer](https://docs.aws.amazon.com/comprehend/latest/dg/custom-entity-recognition.html) to use to improve domain specific entity detection | Optional |
| _input.aiOptions.framebased_ | Opt-in to use Frame based analysis which converts video into image frames and uses Amazon Rekognition Image APIs instead of Video APIs with the exceptions of _TWO_ Amazon Rekognition Video APIs that are [Amazon Rekognition Video Segment](https://docs.aws.amazon.com/rekognition/latest/dg/segments.html) and [Amazon Rekognition People Pathing](https://docs.aws.amazon.com/rekognition/latest/dg/persons.html) APIs.  | Optional |
| _input.aiOptions.frameCaptureMode_ | When opt-in to use Frame-based analysis, this field specifies the frame capture rate such as ```1 frame every 2 seconds```, ```1 frame every second```, and so forth. The full list can be found in [source/layers/core-lib/lib/frameCaptureMode.js](../../../layers/core-lib/lib/frameCaptureMode.js)  | Optional |

__

## State: Prepare analysis
A state where a lambda function checks the incoming analysis request, _$.input.aiOptions_ field and prepares the optimal AI/ML analysis options to run based on the media type of the file and the availability of specific detections.

An example is that when user specifies an Amazon Rekognition Face Collection (XYZ) to run _face matching_ analysis but XYZ does not contain any face, the lambda function automatically opts out the _face matching_ detection to minimize the cost and to reduce the processing time.

Another example is that when user specifies an Amazon Transcribe Custom Language Model (ABC) but the ABC Model is not in COMPLETED state, the lambda function opts out the Custom Language Model (_customLanguageModel_) setting automatically to avoid potential failure caused by the availability of the Custom Language Model.

__

## State: Video analysis enabled?
A Choice state to check whether video analysis is enabled by checking _$.input.video.enabled_ flag.

__

## State: Start video analysis and wait
Start video analysis and wait is a sub-state machine where it runs Computer Vision (CV) analysis using Amazon Rekognition service.

__

## State: Skip video analysis
An End state to indicate video analysis is not enabled.

__

## State: Audio analysis enabled?
A Choice state to check whether audio analysis is enabled by checking _$.input.audio.enabled_ flag.

__

## State: Start audio analysis and wait
Start audio analysis and wait is a sub-state machine where it runs Speech-to-Text (STT) and Natural Language Processing (NLP) analysis using Amazon Transcribe and Amazon Comprehend services. The audio analysis is activated when the media type is ```audio``` or ```video```.

__

## State: Skip audio analysis
An End state to indicate audio analysis is not enabled.

__

## State: Image analysis enabled?
A Choice state to check whether audio analysis is enabled by checking _$.input.image.enabled_ flag.

__

## State: Start image analysis and wait
Start image analysis and wait is a sub-state machine where it runs Computer Vision (CV) analysis using Amazon Rekognition Image APIs.

__

## State: Skip image analysis
An End state to indicate image analysis is not enabled.

__

## State: Document analysis enabled?
A Choice state to check whether document analysis is enabled by checking _$.input.document.enabled_ flag.

__

## State: Start document analysis and wait
Start document analysis and wait is a sub-state machine where it runs OCR analysis using Amazon Textract service.

__

## State: Skip document analysis
An End state to indicate document analysis is not enabled.

__

## State: Collect analysis results
A state where a lambda function parses and merges results from the nested states above.

__

## State: Analysis completed
A state where a lambda function updates _analysis_ field of the Ingest DynamoDB table to indicate types of analysis have been run. The lambda function also creates records on the ```aiml``` DynamoDB table with information including _start time_ and _end time_ of each analysis detection, _pointers_ to where the analysis metadata JSON results stored in the Amazon S3 proxy bucket, the _job name_ of the detection, and the ARN of the state machine execution.

__

## AWS Lambda function (analysis-main)
The analysis-main lambda function provides the implementation to support different states of the Analysis Main state machine. The following AWS XRAY trace diagram demonstrates the AWS services this lambda function communicates to.

![Analysis Main Lambda function](../../../../deployment/tutorials/images/analysis-main-lambda.png)

__

## IAM Role Permission

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "s3:ListBucket",
            "Resource": "PROXY_BUCKET",
            "Effect": "Allow"
        },
        {
            "Action": "s3:GetObject",
            "Resource": "PROXY_BUCKET",
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": [
                "INGEST_TABLE",
                "AIML_TABLE",
                "SERVICE_TOKEN_TABLE"
            ],
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
            "Resource": "OPENSEARCH_DOMAIN",
            "Effect": "Allow"
        },
        {
            "Action": "iot:Publish",
            "Resource": "IOT_STATUS_TOPIC",
            "Effect": "Allow"
        },
        {
            "Action": "sns:Publish",
            "Resource": "SNS_STATUS_TOPIC",
            "Effect": "Allow"
        },
        {
            "Action": "rekognition:ListFaces",
            "Resource": "arn:aws:rekognition:REGION:ACCOUNT:collection/*",
            "Effect": "Allow"
        },
        {
            "Action": "rekognition:DescribeProjectVersions",
            "Resource": "arn:aws:rekognition:REGION:ACCOUNT:project/*/*",
            "Effect": "Allow"
        },
        {
            "Action": "comprehend:DescribeEntityRecognizer",
            "Resource": "arn:aws:comprehend:REGION:ACCOUNT:entity-recognizer/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "transcribe:GetVocabulary",
                "transcribe:DescribeLanguageModel"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}

```

__

## Related topics
* [Analysis Video State Machine](../video/README.md)
* [Analysis Audio State Machine](../audio/README.md)
* [Analysis Image State Machine](../image/README.md)
* [Analysis Document State Machine](../document/README.md)

__

Back to [Main State Machine](../../README.md) | Back to [Table of contents](../../../../README.md#table-of-contents)
