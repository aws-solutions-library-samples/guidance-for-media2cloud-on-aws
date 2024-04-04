# Analysis Main State Machine

The Analysis Main State Machine performs various types of analysis on different types of media (video, audio, images, and documents). The state machine starts with the "Prepare analysis" step, followed by a "Parallel states" step that runs multiple analysis branches concurrently.

After all the enabled analysis branches complete, the state machine moves to the "Collect analysis results" step, which aggregates the results from the various analysis processes.

Next, the state machine runs another Lambda function called "Run analysis post process" to perform any post-processing tasks on the analysis results.

Finally, the state machine ends with the "Analysis completed" step, indicating the successful completion of the entire analysis workflow.

![Analysis state machine](../../../../deployment/tutorials/images/analysis-main-state-machine.png)


#### _State: Prepare analysis_

The lambda function checks the analysis options in $.input.aiOptions and prepares the optimal settings to run the analysis based on the type of the media file and the availability of detections.

For an example, when "facematch" option is enabled but the "faceCollectionId" is not set, the lambda function disables the "facematch" option as the "facematch" detection depends on the "faceCollectionId".

Similarly, when "scene" option is enabled but framebased option is set to false, the lambda function disables the "scene" feature as the scene feature requires Frame Based Analysis to be enabled.

#### _State: Run parallel states_

A Parallel state to execute multiple analysis branches in parallel.

#### _State: Video analysis enabled?_

A Choice state checks the `$.input.video.enabled` flag. If it sets to `true`, continues with "Start video analysis and wait" state. If the flag is set to `false`, moves to "Skip video analysis" indicating the video analysis branch completes.

#### _State: Start video analysis and wait_

When video analysis is enabled, the workflow executes the nested state machine, "Video Analysis State Machine" and waits for its completion. The Video Analysis State Machine focuses on the visual part of the media file using various computer vision ML models / services.


#### _State: Skip video analysis_

A Succeed state indicates the video analysis branch is skipped.

#### _State: Audio analysis enabled?_

A Choice state checks the `$.input.audio.enabled` flag. If it sets to `true`, continues with "Start audio analysis and wait" state. If the flag is set to `false`, moves to "Skip audio analysis" indicating the audio analysis branch completes.


#### _State: Start audio analysis and wait_

When audio analysis is enabled, the workflow executes the nested state machine, "Audio Analysis State Machine" and waits for its completion. The Audio Analysis State Machine focuses on the audio part of the media file using Automatic Speech Recognition (ASR) and various Natural Language Processing (NLP) ML models / services.

#### _State: Skip audio analysis_

A Succeed state indicates the audio analysis branch is skipped.

#### _State: Image analysis enabled?_

A Choice state checks the `$.input.image.enabled` flag. If it sets to `true`, continues with "Start image analysis and wait" state. If the flag is set to `false`, moves to "Skip image analysis" indicating the image analysis branch completes.


#### _State: Start image analysis and wait_

When image analysis is enabled, the workflow executes the nested state machine, "Image Analysis State Machine" and waits for its completion. The Image Analysis State Machine analyzes the image with various computer vision models and services and Generative AI model.

#### _State: Skip image analysis_

A Succeed state indicates the image analysis branch is skipped.


#### _State: Document analysis enabled?_

A Choice state checks the `$.input.document.enabled` flag. If it sets to `true`, continues with "Start document analysis and wait" state. If the flag is set to `false`, moves to "Skip document analysis" indicating the document analysis branch completes.


#### _State: Start document analysis and wait_

When document analysis is enabled, the workflow executes the nested state machine, "Document Analysis State Machine" and waits for its completion. The Document Analysis State Machine analyzes the document with primarily Amazon Textract service.

#### _State: Skip document analysis_

A Succeed state indicates the document analysis branch is skipped.

#### _State: Collect analysis results_

The lambda function parses the results from the parallel branches and merges them to prepare for the next step.

#### _State: Run analysis post process and wait_

After the parallel branches complete, the workflow runs the next state machine, "Analysis Post Processing State Machine" and waits for its completion. The Analysis Post Processing State Machine uses the video and audio analysis results to further process complex use cases such as scene or ad break detection. Both rely on the video and audio analysis results.

#### _State: Analysis completed_

The lambda function updates the analysis results to the status on INGEST_TABLE and the AIML_TABLE.

__

#### _Execution input_

The state machine execution input is passed through from the [Main State Machine](../../README.md#execution-input). The aiOptions dictates the types of analysis to run. The analysis options are explained [here](../../README.md#inputaioptions).


__

### AWS Lambda function (analysis-main)

The analysis-main lambda function provides the implementation to support different states of the Analysis Main state machine. As the lambda function prepare the analysis options, it requires various permissions to validate the input request. Permission includes reading objects from the Amazon S3 proxy bucket to ensure frame capture images are generated or the video and audio proxies are present; ensuring the Amazon Rekognition Face Collection (faceCollectionId) is present; making sure the Amazon Rekognition Custom Labels (customLabelModels) models, Amazon Transcribe Vocabulary (customVocabulary or customLanguageModel), Amazon Comprehend Entity Recognizer (customEntityRecognizer) are ready to use.


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
            "Action": "s3:GetObject",
            "Resource": "[PROXY_BUCKET]",
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
                "[INGEST_TABLE]",
                "[AIML_TABLE]"
            ],
            "Effect": "Allow"
        },
        {
            "Action": "iot:Publish",
            "Resource": "[IOT_TOPIC]",
            "Effect": "Allow"
        },
        {
            "Action": "sns:Publish",
            "Resource": "[SNS_TOPIC]",
            "Effect": "Allow"
        },
        {
            "Action": "rekognition:ListFaces",
            "Resource": "[REKOGNITION_COLLECTION]",
            "Effect": "Allow"
        },
        {
            "Action": "rekognition:DescribeProjectVersions",
            "Resource": "[REKOGNITION_CUSTOM_LABELS]",
            "Effect": "Allow"
        },
        {
            "Action": "comprehend:DescribeEntityRecognizer",
            "Resource": "[COMPREHEND_ENTITY_RECOGNIZER]",
            "Effect": "Allow"
        },
        {
            "Action": [
                "transcribe:GetVocabulary",
                "transcribe:DescribeLanguageModel"
            ],
            "Resource": "*",
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
            "Resource": [
                "[OPENSEARCH_DOMAIN]"
            ],
            "Effect": "Allow"
        },
        {
            "Action": "aoss:APIAccessAll",
            "Resource": "[OPENSEARCH_SERVERLESS]",
            "Effect": "Allow"
        }
    ]
}

```


#### _X-Ray Trace_

The following AWS XRAY trace diagram demonstrates the AWS services this lambda function communicates to.

![Analysis Main Lambda function](../../../../deployment/tutorials/images/analysis-main-lambda.png)

__

## Related topics
- [Analysis Video State Machine](../video/README.md)
- [Analysis Audio State Machine](../audio/README.md)
- [Analysis Image State Machine](../image/README.md)
- [Analysis Document State Machine](../document/README.md)
- [Analysis Post Processing State Machine](../post-process/README.md)

__

Back to [Main State Machine](../../README.md) | Back to [Table of contents](../../../../README.md#table-of-contents)
