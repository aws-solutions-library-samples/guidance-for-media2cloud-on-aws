# Analysis Workflow Status Updater

The Analysis Workflow Status Updater implements the State Machine Service Integration logic that communicates task results back the [Analysis Video state machine](../../video/README.md) and the [Analysis Audio state machine](../../audio/README.md). The tasks include:
* Speech-to-text transcription process from Amazon Transcribe service which emits [Transcribe Job State Change](https://docs.aws.amazon.com/transcribe/latest/dg/cloud-watch-events.html#events) CloudWatch events
* Backlog-enabled processes from our [Service Backlog Management System](../../../../layers/service-backlog-lib/README.md) which sends _Service Backlog Status Change_ event to an Amazon EventBridge bus. The processes managed by our Backlog Management System include: [Amazon Rekognition Video operation](../../video/README.md#video-based-detection-branch), [Amazon Rekognition Custom Labels operation](../../video/README.md#custom-detection-branch) and [Amazon Comprehend Custom Entity Recognition operation](../../audio/README.md#custom-entity-recognition-branch)

__

## AWS Lambda function (analysis-status-updater)
The _analysis-status-updater_ lambda function simply calls [StepFunctions.SendTaskSuccess](https://docs.aws.amazon.com/step-functions/latest/apireference/API_SendTaskSuccess.html) or SendTaskFailure APIs to send the task result back to the Analysis Video or Analysis Audio state machines and unregisters (removes) the token from the _service-token_ DynamoDB table.

The following AWS XRAY trace diagram illustrates the AWS resources this lambda function communicates to.

![Analysis Status Updater Lambda function](../../../../deployment/tutorials/images/analysis-status-updater-lambda.png)

__

## IAM Role Permission

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "states:SendTaskSuccess",
                "states:SendTaskFailure"
            ],
            "Resource": [
                "ANALYSIS_VIDEO_STATE_MACHINE",
                "ANALYSIS_AUDIO_STATE_MACHINE"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "dynamodb:DescribeTable",
                "dynamodb:Scan",
                "dynamodb:Query",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "SERVICE_TOKEN_TABLE",
            "Effect": "Allow"
        },
        {
            "Action": "sns:Publish",
            "Resource": "SNS_TOPIC",
            "Effect": "Allow"
        },
        {
            "Action": "transcribe:GetTranscriptionJob",
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}
```

__

## Related topics
* [Analysis Video State Machine](../../video/README.md)
* [Analysis Audio State Machine](../../audio/README.md)
* [Service Backlog Management System](../../../../layers/service-backlog-lib/README.md)

__

Back to [Table of contents](../../../../../README.md#table-of-contents)
